---
title: Language extensions
description: Scaffold syntax highlighting, snippets, a file icon and scoped token colors with `create --type language`.
---

Not every extension is a webview. `create` takes a `--type` that decides the
**shape** of the project:

| `--type` | You get |
| -------- | ------- |
| `ui` (default) | React webview + typed RPC bridge + Vite build. |
| `language` | Grammar, language configuration, snippets, file icon theme, scoped colors. No React. |
| `empty` | Bare `activate` / `deactivate`. No React, no Vite. |

```bash
vsceasy create my-lang --type language
```

Run without `--type` in a terminal and it asks. `language` and `empty` both drop
React, Vite and the sample panel from the template, including the `dev:ui` /
`build:ui` scripts and the React dependencies — the extension build (esbuild),
`gen`, and every convention directory stay exactly as they are, so you can add a
panel later with [`panel add`](/commands/panel-add/).

## What `--type language` generates

```
my-lang/
├── contributes.extra.json          # languages, grammars, snippets, iconThemes, configuration
├── language-configuration.json     # brackets, comments, auto-closing pairs
├── syntaxes/<langId>.tmLanguage.json   # the TextMate grammar
├── snippets/<langId>.json
├── fileicons/<langId>-icon-theme.json
├── icons/<langId>.svg
└── src/
    ├── colorize.ts                 # SCOPE + RULES for this language — edit these
    ├── helpers/colorize.ts         # apply/removeTokenColors (the generic helper)
    ├── commands/applyColors.ts     # <Name>: Apply Colors
    ├── commands/removeColors.ts    # <Name>: Remove Colors
    └── extension/extension.ts      # bootstrap + auto-colorize on activate
```

The language id and TextMate scope are derived from the package name
(`my-lang` → `mylang`, `source.mylang`) and substituted into every file name and
file body. Rename them freely afterwards — they're plain files you own.

`activationEvents` is set to `onLanguage:<langId>` so the extension wakes up when
a matching file is opened.

```bash
cd my-lang
bun install
bun run gen       # merges contributes.extra.json into package.json#contributes
bun run launch    # opens the dev host — open a .mylang file
```

## `contributes.extra.json`

`gen` owns `commands`, `keybindings`, `viewsContainers` and `views` — it
rewrites them from the files on disk on every run. Everything else VS Code
contributes (languages, grammars, snippets, themes, iconThemes, configuration,
walkthroughs, …) goes in an optional **`contributes.extra.json`** at the project
root, which `gen` deep-merges into `package.json#contributes`.

Merge rules:

- Keys `gen` owns are **ignored** if present in extra — the generator stays
  authoritative for those.
- Plain objects merge recursively; arrays and primitives from extra **replace**.
- Invalid JSON is skipped with a warning rather than failing the build.

This is where LLM settings, feature flags, and any other
`contributes.configuration` block belong too — see [The LLM client](/guides/llm/).

:::tip
Never hand-edit `package.json#contributes`. `gen` rewrites it. Put it in
`contributes.extra.json` and re-run `bun run gen`.
:::

## Scoped token colors

A theme decides what your language looks like, and most themes have never heard
of it. The generated `colorize` helper writes TextMate rules into the user's
`editor.tokenColorCustomizations` so your constructs are legible in any theme —
and only yours:

```ts title="src/colorize.ts"
export const SCOPE = 'source.mylang';

export const RULES: TokenColorRule[] = [
  { scope: 'comment.line.number-sign.mylang', settings: { foreground: '#6b7a6e', fontStyle: 'italic' } },
  { scope: 'string.quoted.double.basic.mylang', settings: { foreground: '#98c379' } },
  { scope: 'constant.numeric.mylang', settings: { foreground: '#d19a66' } },
];
```

Scope names must match your grammar. Because each rule carries the language
suffix baked into its TextMate scope, other languages keep the user's theme
untouched.

The generated `extension.ts` applies the rules on activate when the user has
opted in (default), and reacts to the toggle at runtime:

```ts title="src/extension/extension.ts"
export const activate = bootstrap(registry, {
  onActivate: [
    async (context, vscode) => {
      if (colorizeEnabled(vscode)) await applyColors(vscode);
      context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
          if (!e.affectsConfiguration('mylang.colorize')) return;
          if (colorizeEnabled(vscode)) await applyColors(vscode);
          else await removeColors(vscode);
        }),
      );
    },
  ],
});
```

The opt-out setting `<prefix>.colorize` is declared for you in
`contributes.extra.json`, and the two commands (**Apply Colors** / **Remove
Colors**) are ordinary files in `src/commands/`.

:::note[Rules go at the root]
`applyTokenColors` writes to the **root** `textMateRules`, not under a
`[<scope>]` key. `editor.tokenColorCustomizations` only supports `[ThemeName]`
keys, not `[language]` ([microsoft/vscode#66729](https://github.com/microsoft/vscode/issues/66729)).
Language targeting comes from the scope suffix on each rule.
:::

Rules this extension writes are tagged with a marker, so `removeColors` strips
exactly those and leaves rules the user wrote by hand intact. Re-applying is
idempotent.

### In a project that isn't `--type language`

The same helper is one command away:

```bash
vsceasy helper add --kind colorize
```

## Checking your work

[`doctor`](/commands/doctor/) verifies that every file referenced by your
`languages`, `grammars`, `snippets` and `iconThemes` contributions actually
exists — reading both `contributes.extra.json` and the merged `package.json`.
It stays silent on projects that declare none, so it costs `ui` projects nothing.

```bash
vsceasy doctor
```
