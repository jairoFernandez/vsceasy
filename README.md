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

Structure: `vsxf <resource> <verb> [flags]`. Every command runs interactively when flags are omitted (banner + per-param prompts) or fully scripted via flags.

```
vsxf
├── create              scaffold a new extension project
├── panel
│   └── add             new webview panel + optional typed RPC (opens in editor area)
├── menu
│   ├── add             new sidebar tree view (activity bar)
│   └── edit            add an item (panel / command / url / group)
├── command
│   └── add             new palette command (with optional menu entry + keybinding)
├── rpc
│   └── add             add a typed RPC method to a panel
├── statusBar
│   └── add             status bar item → command / panel / menu popup
├── subpanel
│   └── add             inline sidebar section (lives under a menu container)
├── doctor              diagnose project + safe --fix
└── upgrade             sync framework-owned files from the bundled templates
```

Run `vsxf <resource> --help` for verbs and `vsxf <resource> <verb> --help` for params.

### `panel add`
```bash
vsxf panel add --name settings --title "Settings" --withApi yes
```
Generates `src/panels/<name>.ts` + `src/webview/panels/<name>/{App.tsx,main.tsx}` + appends `<Name>Api` to `src/shared/api.ts` when `withApi=yes`.

### `command add`
```bash
vsxf command add \
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
// or an array
keybinding: ['ctrl+a', { key: 'ctrl+b', mac: 'cmd+b' }]
```

### `menu add`
Sidebar tree view. Icon picker is searchable across 186+ codicons.
```bash
vsxf menu add --name main --title "My Tools" --icon rocket
```

### `menu edit`
Add an item to an existing menu — opens a panel, runs a command, opens a URL, or creates a collapsible group. Conditional prompts adapt to the chosen item kind.
```bash
vsxf menu edit --name main --kind panel --panel dashboard --label "Dashboard" --icon window
```

### `rpc add`
Extends `src/shared/api.ts` (creates the interface if missing) + inserts a handler stub into the panel (creates the `rpc:` block if missing). Auto-adds `import type` + `definePanel<…Api>` generic when needed.
```bash
vsxf rpc add --panel dashboard --method getCount --params "limit: number" --returns "number"
```

### `statusBar add`
Bind to a command, panel, or popup menu (QuickPick). Markdown tooltip available (Copilot/GitLens-style hover).
```bash
# existing command
vsxf statusBar add --name buildBtn --text Build --bindTo command --command hello --icon tools

# panel (auto-wires <prefix>.open<Panel>)
vsxf statusBar add --name openDash --text Dashboard --bindTo panel --panel dashboard

# bootstrap new command + status bar together
vsxf statusBar add --name sync --text Sync --bindTo "create new command" --newCommandTitle "Run Sync"

# popup menu — interactive loop builds each item
vsxf statusBar add --name tools --text Tools --bindTo menu
```
Rich markdown tooltip:
```bash
vsxf statusBar add \
  --name copilotPro --text "Copilot Pro" --icon copilot \
  --bindTo panel --panel dashboard \
  --tooltipMarkdown "### Copilot Pro\n\n**18% used**\n\n[Upgrade](command:myext.openDashboard)"
```

### `subpanel add`
Inline sidebar section (the GitLens / Copilot pattern — collapsible webview that lives inside a menu container). Each subpanel becomes a new section under the chosen activity-bar menu, stacked alongside the tree view and any other sibling subpanels.

```bash
vsxf subpanel add --name welcome --menu main --title "Welcome" --withApi yes
```

Files:
- `src/subpanels/<name>.ts` (defineSubpanel with `menu: '<container>'`)
- `src/webview/subpanels/<name>/{App.tsx,main.tsx}` (React bundle)
- `<Name>ViewApi` appended to `src/shared/api.ts` when `withApi=yes`

Multiple subpanels can reference the same `menu` — they render as stacked collapsible sections in that container.

### `doctor`
Diagnose engine, scripts, panels, RPC contract sync, menu refs, codicons, status bar refs, package.json `contributes` drift, `.gitignore`.
```bash
vsxf doctor             # report
vsxf doctor --fix=true  # auto-fix: missing RPC handler stubs, orphan menu items, .gitignore entries
```

### `upgrade`
Sync framework-owned files (`src/shared/vsxf/*`, `scripts/gen.ts`) from the bundled templates. Use after upgrading `@ideascol/vscode-extension-framework`.
```bash
vsxf upgrade              # dry-run
vsxf upgrade --apply=true # write + auto-run `bun run gen`
```

## Convention

Files in `src/{panels,commands,menus,statusBars,subpanels}/*.ts` are auto-discovered by `bun run gen`, which produces `src/extension/_registry.ts` and keeps `package.json#contributes` in sync. The framework's runtime (`bootstrap(registry)`) wires everything into VS Code on activation.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## License

MIT
