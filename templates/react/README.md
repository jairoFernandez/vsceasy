# {{displayName}}

Generated with [`@ideascol/vscode-extension-framework`](https://www.npmjs.com/package/@ideascol/vscode-extension-framework).

## Develop

```bash
bun install
bun run dev
```

Then press <kbd>F5</kbd> in VS Code to launch the Extension Development Host.

- Command Palette → **{{displayName}}: Hello** → toast
- Command Palette → **{{displayName}}: Open Dashboard** → webview panel

## What you get

- `src/extension/extension.ts` — extension entry, registers commands
- `src/extension/panels/DashboardPanel.ts` — webview panel + RPC handlers
- `src/webview/App.tsx` — React UI (uses typed RPC client)
- `src/shared/api.ts` — RPC contract (types flow to both sides)
- `src/shared/rpc.ts` — bridge implementation

## Package

```bash
bun run build
bun run package   # → {{name}}-0.0.1.vsix
```
