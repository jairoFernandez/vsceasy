# vsceasy

Build VS Code extensions fast. React UI + typed RPC bridge between extension and webview + zero-config build.

> Status: v0.1 — React UI. Typed RPC bridge + file-based registry + scaffolding for panels, commands, menus, tree views, subpanels, status bars.

## Quick start

```bash
bunx vsceasy create my-extension
cd my-extension
bun install
bun run dev
# press F5 in VS Code to launch the Extension Development Host
```

Or with flags:

```bash
bunx vsceasy create \
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

Structure: `vsceasy <resource> <verb> [flags]`. Every command runs interactively when flags are omitted (banner + per-param prompts) or fully scripted via flags.

```
vsceasy
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
├── treeview
│   └── add             data-driven tree view (getChildren/getTreeItem) under a menu
├── test
│   └── setup           Vitest config + sample test
├── publish
│   └── init            marketplace preflight (README, CHANGELOG, icon, vsce ls)
├── doctor              diagnose project + safe --fix
└── upgrade             sync framework-owned files from the bundled templates
```

Run `vsceasy <resource> --help` for verbs and `vsceasy <resource> <verb> --help` for params.

### `panel add`
```bash
vsceasy panel add --name settings --title "Settings" --withApi yes
```
Generates `src/panels/<name>.ts` + `src/webview/panels/<name>/{App.tsx,main.tsx}` + appends `<Name>Api` to `src/shared/api.ts` when `withApi=yes`.

### `command add`
```bash
vsceasy command add \
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
vsceasy menu add --name main --title "My Tools" --icon rocket
```

### `menu edit`
Add an item to an existing menu — opens a panel, runs a command, opens a URL, or creates a collapsible group. Conditional prompts adapt to the chosen item kind.
```bash
vsceasy menu edit --name main --kind panel --panel dashboard --label "Dashboard" --icon window
```

### `rpc add`
Extends `src/shared/api.ts` (creates the interface if missing) + inserts a handler stub into the panel (creates the `rpc:` block if missing). Auto-adds `import type` + `definePanel<…Api>` generic when needed.
```bash
vsceasy rpc add --panel dashboard --method getCount --params "limit: number" --returns "number"
```

### `statusBar add`
Bind to a command, panel, or popup menu (QuickPick). Markdown tooltip available (Copilot/GitLens-style hover).
```bash
# existing command
vsceasy statusBar add --name buildBtn --text Build --bindTo command --command hello --icon tools

# panel (auto-wires <prefix>.open<Panel>)
vsceasy statusBar add --name openDash --text Dashboard --bindTo panel --panel dashboard

# bootstrap new command + status bar together
vsceasy statusBar add --name sync --text Sync --bindTo "create new command" --newCommandTitle "Run Sync"

# popup menu — interactive loop builds each item
vsceasy statusBar add --name tools --text Tools --bindTo menu
```
Rich markdown tooltip:
```bash
vsceasy statusBar add \
  --name copilotPro --text "Copilot Pro" --icon copilot \
  --bindTo panel --panel dashboard \
  --tooltipMarkdown "### Copilot Pro\n\n**18% used**\n\n[Upgrade](command:myext.openDashboard)"
```

### `subpanel add`
Inline sidebar section (the GitLens / Copilot pattern — collapsible webview that lives inside a menu container). Each subpanel becomes a new section under the chosen activity-bar menu, stacked alongside the tree view and any other sibling subpanels.

```bash
vsceasy subpanel add --name welcome --menu main --title "Welcome" --withApi yes
```

Files:
- `src/subpanels/<name>.ts` (defineSubpanel with `menu: '<container>'`)
- `src/webview/subpanels/<name>/{App.tsx,main.tsx}` (React bundle)
- `<Name>ViewApi` appended to `src/shared/api.ts` when `withApi=yes`

Multiple subpanels can reference the same `menu` — they render as stacked collapsible sections in that container.

### `doctor`
Diagnose engine, scripts, panels, RPC contract sync, menu refs, codicons, status bar refs, package.json `contributes` drift, `.gitignore`.
```bash
vsceasy doctor             # report
vsceasy doctor --fix=true  # auto-fix: missing RPC handler stubs, orphan menu items, .gitignore entries
```

### `upgrade`
Sync framework-owned files (`src/shared/vsceasy/*`, `scripts/gen.ts`) from the bundled templates. Use after upgrading `vsceasy`.
```bash
vsceasy upgrade              # dry-run
vsceasy upgrade --apply=true # write + auto-run `bun run gen`
```

### `treeview add`
Data-driven tree view inside an existing menu container. Lazy children via `getChildren`. Built-in dispatch for `run` / `panel` / `command` on click.
```bash
vsceasy treeview add --name explorer --menu main --title "Explorer"
```
Generates `src/treeViews/<name>.ts`. Refresh from anywhere: `vscode.commands.executeCommand('<prefix>._tree.<name>.refresh')`.

### `test setup`
Drops a `vitest.config.ts`, a sample `src/__tests__/sample.test.ts`, and adds `test` / `test:watch` scripts + `vitest` devDep to package.json.
```bash
vsceasy test setup
bun install && bun run test
```

### `publish init`
Marketplace preflight: writes `README.md`, `CHANGELOG.md`, an `assets/icon.png` placeholder, fills `repository` / `categories` / `icon` in package.json, and runs `npx @vscode/vsce ls` as a dry-pack.
```bash
vsceasy publish init
# fix any warnings, then:
npx @vscode/vsce package
npx @vscode/vsce publish
```

### Project config (`vsceasy.config.ts`)
Optional. Persists defaults so you don't repeat them per generator command.
```ts
import type { VsceasyConfig } from 'vsceasy';

const config: VsceasyConfig = {
  publisher: 'my-publisher',
  commandPrefix: 'myExt',
  ui: 'react',
};

export default config;
```

## Convention

Files in `src/{panels,commands,menus,statusBars,subpanels}/*.ts` are auto-discovered by `bun run gen`, which produces `src/extension/_registry.ts` and keeps `package.json#contributes` in sync. The framework's runtime (`bootstrap(registry)`) wires everything into VS Code on activation.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md).

## License

MIT
