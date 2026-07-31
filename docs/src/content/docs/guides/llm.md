---
title: The LLM client
description: Talk to Ollama or any OpenAI-compatible endpoint from your extension — streaming, JSON mode, model resolution, and user-configurable settings.
---

`createLlm` is a dependency-free client for **Ollama** and any
**OpenAI-compatible** endpoint. Everything goes through `fetch`, which the
extension host has had natively since VS Code 1.82 (Node 18) — nothing is added
to your `package.json`.

```ts
import { createLlm } from '../shared/vsceasy';

const llm = createLlm({ provider: 'ollama', model: 'qwen2.5-coder:7b' });
const text = await llm.chat([{ role: 'user', content: 'hi' }]);
```

## Options

| Option | Default | Notes |
| ------ | ------- | ----- |
| `provider` | `'ollama'` | `'ollama'` or `'openai'` (any OpenAI-compatible server). |
| `baseUrl` | `http://localhost:11434` / `https://api.openai.com/v1` | Per provider. |
| `model` | — | e.g. `qwen2.5-coder:7b`, `gpt-4o-mini`. Empty string means **auto** (see below). |
| `apiKey` | — | Sent as `Authorization: Bearer …`. Ignored by a plain Ollama. |
| `temperature` | provider default | |
| `maxTokens` | provider default | `num_predict` on Ollama, `max_tokens` on OpenAI. |
| `timeoutMs` | `60_000` | Aborts the request. |

## What the client can do

```ts
// full chat turn → assistant content
await llm.chat([{ role: 'system', content: 'Be terse.' }, { role: 'user', content: 'why?' }]);

// single-prompt shorthand
await llm.complete('Explain closures', { system: 'You are a tutor.', maxTokens: 200 });

// strict JSON, parsed and typed
const plan = await llm.json<{ steps: string[] }>([{ role: 'user', content: 'plan as JSON' }]);

// streaming — passing onToken switches the request to stream mode
await llm.chat(messages, { onToken: (chunk) => append(chunk) });

// what's installed on the endpoint
const models = await llm.models();          // [{ name, size? }]

// reachability probe, never throws
const status = await llm.ping();            // { ok, model?, warning?, error? }
```

`json()` tolerates the ```` ```json ```` fences and stray prose small local
models still emit even in JSON mode: it retries the raw text, the fenced block,
and finally the outermost `{…}` / `[…]` before throwing.

Cancel a call with an `AbortSignal` — useful in an inline-completion provider,
where the user has usually typed on already:

```ts
const ctl = new AbortController();
const p = llm.complete(prompt, { signal: ctl.signal, timeoutMs: 8_000 });
ctl.abort();   // rejects with "Request aborted"
```

## Model resolution (Ollama)

Ollama addresses models by their **full `name:tag`**. A configured
`qwen2.5-coder` does *not* match an installed `qwen2.5-coder:0.5b` — the request
404s. The client resolves the configured name against what is actually installed:

1. Exact match wins.
2. A name without a tag takes the first installed tag of that model.
3. An empty `model` means **auto** — pick something usable.
4. Nothing close → fall back to an installed model rather than 404ing.

The fallback prefers a coding model, then any general chat model, and never
picks an embedding model (it can't chat) or a `:cloud` alias (it needs
credentials). Resolution happens once per client and is cached.

```ts
await llm.resolveModel();   // the name requests will really use
await llm.ping();
// → { ok: true, model: 'qwen2.5-coder:0.5b',
//     warning: '"qwen2.5-coder" is not installed — using "qwen2.5-coder:0.5b".' }
```

`ping()` deliberately checks the *model*, not just the server: reaching the
endpoint isn't enough if every call is about to 404.

## Reasoning models: `think`

```ts
await llm.chat(messages, { think: true, maxTokens: 2048 });
```

`think` is **off by default**. Ollama counts hidden reasoning against
`num_predict`, so a thinking model given a modest budget burns all of it and
returns **empty content**. When that happens the client throws a specific error
instead of silently returning `''`:

> The model used its entire token budget on internal reasoning and produced no
> answer. Raise maxTokens … or choose a non-reasoning model.

Turn `think` on only for tasks where the deliberation is worth the tokens, and
raise `maxTokens` with it.

## User-configurable: `initLlm` + `useLlm`

Hard-coding the host and model is fine for a prototype. To let the user choose,
build the **shared** client from settings on activate:

```ts title="src/extension/extension.ts"
import { bootstrap, initLlm } from '../shared/vsceasy';
import { registry } from './_registry';

export const activate = bootstrap(registry, {
  // Pass the settings prefix explicitly when you know it.
  onActivate: [(ctx) => initLlm(ctx, undefined, 'myExt')],
});
```

Then anywhere else:

```ts
import { useLlm } from '../shared/vsceasy';

const text = await useLlm().complete('…');
```

`initLlm` reads `<section>.llm.*` and **rebuilds the client whenever those
settings change**, so switching model in the Settings UI takes effect without a
reload. `useLlm()` throws if called before activate.

### Settings to declare

Put them in [`contributes.extra.json`](/guides/language-extensions/#contributesextrajson)
— `gen` merges that file into `package.json#contributes`:

```json title="contributes.extra.json"
{
  "configuration": {
    "title": "My Extension",
    "properties": {
      "myExt.llm.provider":    { "type": "string", "enum": ["ollama", "openai"], "default": "ollama" },
      "myExt.llm.baseUrl":     { "type": "string", "default": "http://localhost:11434" },
      "myExt.llm.model":       { "type": "string", "default": "", "markdownDescription": "Empty = auto-select an installed model." },
      "myExt.llm.apiKey":      { "type": "string", "default": "" },
      "myExt.llm.temperature": { "type": "number" },
      "myExt.llm.timeoutMs":   { "type": "number", "default": 60000 }
    }
  }
}
```

:::caution[Pass the section, or declare the settings]
Without an explicit `section`, `initLlm` infers it by scanning installed
extensions for a `contributes.configuration` property matching
`<x>.llm.(model|provider|baseUrl)`. That works once the settings above are
declared — but if they aren't, it falls back to `vsceasy.llm.*` and changing the
model appears to do nothing. Passing `'myExt'` removes the guesswork.
:::

## Using it for ghost text

The natural home for an LLM is an inline completion provider, where `delayMs`
and `cacheMs` keep you from hammering it:

```ts title="src/inlineCompletions/predict.ts"
import { defineInlineCompletion, useLlm } from '../shared/vsceasy';

export default defineInlineCompletion({
  selector: 'typescript',
  delayMs: 900,
  cacheMs: 15_000,
  provide: async (ctx) => {
    const text = await useLlm().complete(`Continue:\n${ctx.linePrefix}`, { maxTokens: 64 });
    if (ctx.token.isCancellationRequested) return null;   // the user typed on
    return { text };
  },
});
```

See [Editor surface](/guides/editor-surface/) for the rest of the providers, and
[Code Trainer](/showcase/) for a full extension built on this client.
