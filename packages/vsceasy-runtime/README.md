# vsceasy-runtime

Runtime companion to the [`vsceasy`](https://www.npmjs.com/package/vsceasy) CLI.

Exports:

- `bootstrap(registry)` — wires generated `Registry` into VS Code on `activate(context)`.
- `definePanel`, `defineCommand`, `defineMenu`, `defineTreeView`, `defineSubpanel`, `defineStatusBar` — typed helpers used in the convention dirs (`src/panels`, `src/commands`, etc).
- `createRpcServer`, `createRpcClient`, `webviewTransport`, `vscodeApiTransport`, `connectWebview` — typed RPC bridge between the extension host and webview UI.

Installed automatically by `vsceasy create`. Use the CLI's `vsceasy upgrade` to bump versions in an existing project.

## License

MIT
