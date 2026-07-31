---
title: Editor surface
description: Completions, ghost text, typing guards, decorations and terminals — the primitives that act on the editor itself.
---

Panels and menus put UI *next to* the editor. The primitives on this page act
**on the editor itself**: what appears as you type, what is allowed to be typed,
what is painted over the text, and what runs in a terminal.

Each one is a convention directory scanned by `bun run gen`, exactly like
`panels/` and `commands/`.

| Directory            | API                       | Registers                          |
|----------------------|---------------------------|------------------------------------|
| `completions/`       | `defineCompletion`        | `CompletionItemProvider`           |
| `inlineCompletions/` | `defineInlineCompletion`  | `InlineCompletionItemProvider`     |
| `hovers/`            | `defineHover`             | `HoverProvider`                    |
| `typingGuards/`      | `defineTypingGuard`       | `type` / paste / delete overrides  |
| `decorations/`       | `defineDecoration`        | `TextEditorDecorationType`         |
| `terminals/`         | `defineTerminal`          | headless `exec` + visible terminal |

## Completions

A completion provider with two extras VS Code doesn't give you: a **delay** that
measures real keyboard silence, and a **gate** that can veto a request outright.

```ts
// src/completions/hints.ts
import { defineCompletion } from '../shared/vsceasy';

export default defineCompletion({
  selector: 'typescript',
  triggerCharacters: ['.'],
  // Nothing appears until the user has been still for 700ms.
  delayMs: 700,
  gate: (ctx) => ctx.prefix.length >= 2,
  provide: (ctx) => [
    { label: 'toSorted', kind: 'method', detail: 'non-mutating sort' },
  ],
});
```

`delayMs` is what makes a provider *non-invasive*: while you type fluently the
list never opens, because the debounce is measured against the last keystroke in
the document, not against the request. If the user types again while the
provider is waiting, the request is dropped — a newer one is already coming.

`selector` accepts a language id (`'python'`), a glob (`'**/practice/*.ts'`), a
full selector object, or an array of any of those.

## Inline completions (ghost text)

Same shape, but the result is grey text at the cursor. This is where an LLM
belongs — `delayMs` and `cacheMs` exist to keep you from hammering it.

```ts
// src/inlineCompletions/predict.ts
import { defineInlineCompletion, useLlm } from '../shared/vsceasy';

export default defineInlineCompletion({
  selector: 'typescript',
  delayMs: 900,
  cacheMs: 15_000,      // don't re-ask while the user reads the same suggestion
  provide: async (ctx) => {
    const text = await useLlm().complete(`Continue:\n${ctx.linePrefix}`, { maxTokens: 64 });
    // Always re-check: the user has usually typed on while the model thought.
    if (ctx.token.isCancellationRequested) return null;
    return { text, onAccept: () => console.log('accepted') };
  },
});
```

`onAccept` is the hook VS Code's own API lacks — use it for telemetry or scoring.

## Hovers

A hover provider returns **markdown** for the symbol under the pointer. Return
`null` or `''` to show nothing and let other providers answer.

```ts
// src/hovers/explain.ts
import { defineHover } from '../shared/vsceasy';

export default defineHover({
  selector: 'typescript',
  provide: async (ctx) => {
    const doc = lookup(ctx.word);
    if (!doc) return null;
    return `**${ctx.word}** — ${doc.summary}\n\n[Practise it](command:myExt.practice)`;
  },
});
```

The context carries `word`, the full `line`, `lineNumber`, `document`,
`position` and a `token`. Command links (`[text](command:ext.foo)`) are enabled,
so the panel can be interactive — a hover is a decent place to put an action the
user shouldn't have to hunt for in the palette.

## Typing guards

A guard sits between the keyboard and the document. It can let a keystroke
through, swallow it, or substitute something else.

```ts
// src/typingGuards/practice.ts
import { defineTypingGuard } from '../shared/vsceasy';

export default defineTypingGuard({
  selector: '**/practice/**',
  enabled: () => sessionIsRunning(),
  onType: (e) => {
    if (e.text !== expectedChar()) return { block: true, message: 'Wrong key' };
    return true;
  },
  onPaste: () => ({ block: true, message: 'Paste disabled — type it out.' }),
  onDelete: (e) => (e.hasSelection ? { block: true } : true),
  onChange: (e) => countKeystrokes(e),   // observe only, cannot block
});
```

:::danger[Deletions do not arrive through `onType`]
VS Code routes backspace, delete, the word-wise variants and cut as their own
commands. A guard that implements only `onType` will let the user delete
anything — and if the guard tracks an offset, one backspace desyncs it from the
buffer permanently. Implement `onDelete` whenever you implement `onType`.
:::

`onDelete` receives which command fired (`kind`), the text that would be
removed, and whether a selection was involved:

```ts
onDelete: (e) => {
  if (e.kind === 'cut') return { block: true, message: 'No cutting.' };
  if (e.hasSelection) return { block: true, message: 'Delete one character at a time.' };
  return true;   // allow, then resync your own state
},
```

Rather than counting deleted characters — which breaks on selections,
word-deletes and multi-cursors — allow the deletion and re-derive your state
from the buffer afterwards. That's the only approach that survives every
deletion path, including undo.

Return values:

| Return                        | Effect                          |
|-------------------------------|---------------------------------|
| `true` / `undefined`          | let the keystroke through       |
| `false`                       | swallow it silently             |
| `{ block: true, message? }`   | swallow it and warn             |
| `{ insert: '…' }`             | insert something else instead   |

:::caution[`type` is exclusive]
VS Code lets only **one** extension override the `type` command. The runtime
registers a single override and fans it out to every guard in registration
order, so multiple guards coexist — but another extension that overrides `type`
will conflict with yours. Keep `enabled` tight so the guard is transparent
whenever it isn't needed.
:::

### Who owns paste, and when

`type` has a `default:type` twin to delegate back to. **Paste and the delete
commands don't** — once you override `editor.action.clipboardPasteAction` you own
it for the *whole window*, webview inputs and the terminal included, with nothing
to hand it back to.

So the runtime registers the paste override **only while a guard actually
applies** to the active document, and disposes it the moment none does. It
re-evaluates when the active editor changes and when a document opens.

That leaves one case it can't see: a guard whose `enabled` flips on state of your
own — a practice session starting or finishing — with no editor event to hang
off. Tell the runtime:

```ts
import { refreshTypingGuards } from '../shared/vsceasy';

session.start();
refreshTypingGuards();   // re-evaluate paste ownership now
```

Skip it and the override can stay registered after the guard goes inactive,
which breaks <kbd>Cmd</kbd>+<kbd>V</kbd> in webviews and the terminal.

Deletions are the same story: there is no `default:deleteLeft`, so when every
guard allows a deletion the runtime **performs it itself** through the edit API —
backspace/delete at line boundaries, the word-wise variants, cut, and every
selection in a multi-cursor. You get the normal editing behaviour back, but it is
the runtime doing it, not VS Code.

## Decorations

Paint over the editor without touching the buffer — ghost text, highlights,
gutter icons.

```ts
// src/decorations/target.ts
import { defineDecoration } from '../shared/vsceasy';

export default defineDecoration({
  style: { after: { color: '#6a737d', fontStyle: 'italic' } },
  on: ['changeActiveEditor', 'changeDocument', 'changeSelection'],
  watch: (refresh) => session.subscribe(refresh),   // same shape as treeViews
  compute: (editor) => [
    { line: editor.selection.active.line, style: { after: { contentText: '  ← type this' } } },
  ],
});
```

Spans may carry their own `style`, merged over the base. Decoration types for
those variants are created lazily and cached, so a redraw doesn't leak one per
frame.

For a decoration that only ever updates on demand, use `on: ['manual']` and call
`refreshDecoration('<id>')`.

## Terminals

Two modes: **captured** (`exec`, for scoring and parsing) and **visible**
(`send`, for output the user should watch).

```ts
// src/terminals/runner.ts
import { defineTerminal } from '../shared/vsceasy';

export default defineTerminal({
  title: 'Test Runner',
  timeoutMs: 45_000,
  env: { NO_COLOR: '1' },
});
```

```ts
import { useTerminal } from '../shared/vsceasy';

const t = useTerminal('runner')!;
const run = await t.exec('bun test', { cwd: '/path/to/dir' });
if (run.code !== 0) console.log(run.stdout, run.stderr);

t.send('bun test --watch');   // visible terminal, output not captured
```

`exec` never throws on a non-zero exit — inspect `code`. A run killed by
`timeoutMs` comes back with `timedOut: true` and `code: null`.

## The LLM client

`createLlm` speaks to Ollama and any OpenAI-compatible endpoint over `fetch` —
no SDK dependency.

```ts
import { createLlm } from '../shared/vsceasy';

const llm = createLlm({ provider: 'ollama', model: 'qwen2.5-coder:7b' });
const text = await llm.chat([{ role: 'user', content: 'hi' }]);
const data = await llm.json<{ items: string[] }>([{ role: 'user', content: 'list 3 fruits as JSON' }]);
await llm.chat(messages, { onToken: (t) => append(t) });   // streaming
```

Streaming, JSON mode, model auto-resolution, `ping()`, reasoning models and the
settings-driven shared client (`initLlm` / `useLlm`) all have their own page:
**[The LLM client](/guides/llm/)**.

## Reactive status bar

`defineStatusBar` also takes `render` + `watch`, so an item can track live state
using the same pattern as tree views and decorations:

```ts
export default defineStatusBar({
  text: 'Idle',
  icon: 'dashboard',
  watch: (refresh) => session.subscribe(refresh),
  render: () => {
    const s = session.get();
    return s
      ? { text: `${s.wpm} wpm`, backgroundColor: s.wpm < 30 ? 'statusBarItem.warningBackground' : undefined }
      : { text: 'Idle' };
  },
});
```

Anything `render` omits falls back to the static fields, and returning
`{ visible: false }` hides the item.
