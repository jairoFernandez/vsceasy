# @ideascol/vscode-extension-framework

Build VS Code extensions fast. React UI + typed RPC bridge between extension and webview + zero-config build.

> Status: v0.1 — MVP. React template only. Svelte/Vue/Vanilla coming.

## Quick start

```bash
bunx @ideascol/vscode-extension-framework create my-extension
cd my-extension
bun install
bun run dev
# press F5 in VS Code to launch the Extension Development Host
```

Or with flags:

```bash
bunx @ideascol/vscode-extension-framework create \
  --name my-extension \
  --displayName "My Extension" \
  --description "Does cool things" \
  --publisher my-publisher \
  --ui react
```

## What you get

```
my-extension/
├── src/
│   ├── extension/
│   │   ├── extension.ts            # entry, command registration
│   │   └── panels/DashboardPanel.ts # webview panel + RPC handlers
│   ├── webview/
│   │   ├── App.tsx                 # React UI (typed RPC client)
│   │   ├── main.tsx
│   │   └── styles.css              # VS Code theme tokens
│   └── shared/
│       ├── api.ts                  # RPC contract (types both sides)
│       └── rpc.ts                  # bridge implementation
├── vite.config.ts                  # webview build
└── package.json                    # esbuild for extension, vite for UI
```

## Typed RPC

Define the contract once:

```ts
// src/shared/api.ts
export interface DashboardApi {
  listFiles(pattern: string): Promise<string[]>;
}
```

Extension side — implement:

```ts
const handlers: DashboardApi = {
  async listFiles(pattern) {
    const uris = await vscode.workspace.findFiles(pattern);
    return uris.map(u => vscode.workspace.asRelativePath(u));
  },
};
createRpcServer(webviewTransport(panel.webview), handlers);
```

Webview side — call with full type inference:

```tsx
const api = createRpcClient<DashboardApi>(vscodeApiTransport(vscode));
const files = await api.listFiles('**/*.ts');  // typed string[]
```

No manual `postMessage`. No string-typed message channels.

## CLI commands

Every command runs interactively when flags are omitted (banner + per-param prompts) or fully scripted via flags.

### `create`
Scaffold a new extension project. See Quick start above.

### `addPanel`
Add a webview panel (React UI + optional typed RPC interface).

```bash
vsxf addPanel --name settings --title "Settings" --withApi yes
```

Generates `src/panels/<name>.ts` + `src/webview/panels/<name>/{App.tsx,main.tsx}` + appends `<Name>Api` to `src/shared/api.ts` when `withApi=yes`.

### `addCommand`
Scaffold a palette command. Optionally bind it to a menu entry and/or a keyboard shortcut.

```bash
vsxf addCommand \
  --name doStuff \
  --title "Do Stuff" \
  --menuEntry main \
  --group "Actions" \
  --icon play \
  --keybinding "ctrl+shift+h"
```

For richer keybindings (mac override / `when` clause) edit the generated file:

```ts
keybinding: { key: 'ctrl+shift+h', mac: 'cmd+shift+h', when: 'editorTextFocus' }
// or an array of any combination of the above
keybinding: ['ctrl+a', { key: 'ctrl+b', mac: 'cmd+b' }]
```

### `addMenu`
Add a sidebar tree view (activity bar icon + items). Icon picker is searchable across 186+ codicons.

```bash
vsxf addMenu --name main --title "My Tools" --icon rocket
```

### `editMenu`
Add an item to an existing menu — opens a panel, runs a command, opens a URL, or creates a collapsible group. Conditional prompts adapt to the selected item kind.

```bash
vsxf editMenu --name main --kind panel --panel dashboard --label "Dashboard" --icon window
```

### `addRpcMethod`
Extend a panel's typed RPC contract. Patches `src/shared/api.ts` (creates interface if missing) and inserts a handler stub into the panel (creates the `rpc:` block if missing). Auto-adds `import type` + `definePanel<…Api>` generic when needed.

```bash
vsxf addRpcMethod --panel dashboard --method getCount --params "limit: number" --returns "number"
```

### `addStatusBar`
Add a status bar item bound to a command, a panel, or a popup menu (QuickPick). Includes a markdown tooltip option (Copilot/GitLens-style hover).

```bash
# bind to existing command
vsxf addStatusBar --name buildBtn --text Build --bindTo command --command hello --icon tools

# bind to panel (auto-wires <prefix>.open<Panel> command)
vsxf addStatusBar --name openDash --text Dashboard --bindTo panel --panel dashboard

# bootstrap a new command + status bar in one shot
vsxf addStatusBar --name sync --text Sync --bindTo "create new command" --newCommandTitle "Run Sync"

# popup menu — interactive loop prompts each item
vsxf addStatusBar --name tools --text Tools --bindTo menu
```

Rich markdown tooltip:

```bash
vsxf addStatusBar \
  --name copilotPro --text "Copilot Pro" --icon copilot \
  --bindTo panel --panel dashboard \
  --tooltipMarkdown "### Copilot Pro\n\n**18% used**\n\n[Upgrade](command:myext.openDashboard)"
```

### `doctor`
Diagnose the project — engine, scripts, panels, RPC contract sync, menu refs, codicons, status bar refs, package.json `contributes` drift, `.gitignore`.

```bash
vsxf doctor             # report
vsxf doctor --fix=true  # auto-fix: missing RPC handler stubs, orphan menu items, .gitignore entries
```

### `upgrade`
Sync framework-owned files (`src/shared/vsxf/*`, `scripts/gen.ts`) from the bundled templates. Use after upgrading `@ideascol/vscode-extension-framework` to pick up framework changes in existing projects.

```bash
vsxf upgrade              # dry-run (shows what would change)
vsxf upgrade --apply=true # write changes + auto-run `bun run gen`
```

## Convention

Files in `src/{panels,commands,menus,statusBars}/*.ts` are auto-discovered by `bun run gen`, which produces `src/extension/_registry.ts` and keeps `package.json#contributes` in sync. The framework's runtime (`bootstrap(registry)`) wires everything into VS Code on activation.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## License

MIT
