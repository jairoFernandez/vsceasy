# {{displayName}}

Generated with [`@ideascol/vscode-extension-framework`](https://www.npmjs.com/package/@ideascol/vscode-extension-framework).

## Develop

Two ways to launch the Extension Development Host:

### Option A — one-shot launch (recommended for first run)

```bash
bun install
bun run launch
```

Builds extension + webview once, then opens a new VS Code window with the extension loaded.
Then in the dev window: Command Palette → **{{displayName}}: Open Dashboard**.

### Option B — watch mode + F5

```bash
bun install
bun run dev          # leave running — watches both extension + webview
```

Then in VS Code (this folder open):
- Press <kbd>F5</kbd> → picks **Run Extension** launch config → opens Extension Development Host.
- Re-press <kbd>Ctrl/Cmd+R</kbd> inside the dev host after code changes to reload.

> Note: `bun run dev` only builds — it does NOT launch VS Code. F5 (or `bun run launch`) does.

## Commands

- Command Palette → **{{displayName}}: Hello** → info toast
- Command Palette → **{{displayName}}: Open Dashboard** → React webview

## Structure

- `src/extension/extension.ts` — entry, registers commands
- `src/extension/panels/DashboardPanel.ts` — webview panel + RPC handlers
- `src/webview/App.tsx` — React UI (typed RPC client)
- `src/shared/api.ts` — RPC contract (types flow to both sides)
- `src/shared/rpc.ts` — bridge implementation

## Package as `.vsix`

```bash
bun run build
bun run package   # → {{name}}-0.0.1.vsix
```
