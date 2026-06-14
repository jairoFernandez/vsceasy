## {{displayName}} language support

This extension was scaffolded with `vsceasy create --type language`. It provides
editor support for `.{{langId}}` files:

- **Syntax highlighting** — TextMate grammar in `syntaxes/{{langId}}.tmLanguage.json`
- **Language configuration** — comments, brackets, auto-closing pairs, folding in
  `language-configuration.json`
- **Snippets** — `snippets/{{langId}}.json`
- **File icon** (opt-in) — `fileicons/{{langId}}-icon-theme.json`

### How contributions are wired

`vsceasy`'s `scripts/gen.ts` regenerates the generated parts of
`package.json#contributes` (commands, views…) on every build. Language
contributions are **not** generated — they live in **`contributes.extra.json`**
at the project root and are deep-merged into `package.json` by `gen.ts`. Edit
`contributes.extra.json` to change languages / grammars / snippets / iconThemes,
then run `bun run gen`.

### File icon is opt-in

VS Code file icons are provided by an **icon theme**, which is global: activating
it replaces *all* file icons in the workbench, not just `.{{langId}}`. This
extension ships a `{{displayName}} Icons` theme but does **not** force it. To use
it: `Preferences: File Icon Theme` → pick `{{displayName}} Icons`. If you don't
want to override every icon, leave it unselected — highlighting, config and
snippets work regardless.

### Develop

```sh
bun install
bun run gen        # sync package.json#contributes
bun run package    # build a .vsix
```

Press `F5` (or run `bun run launch`) to open an Extension Development Host and
open a `.{{langId}}` file to see highlighting.
