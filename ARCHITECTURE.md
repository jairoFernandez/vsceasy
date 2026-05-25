# vsceasy — Architecture

Goal: build VS Code extensions fast. Zero boilerplate for panels, commands, webview UI, and extension↔webview messaging.

## Pieces

```
vsceasy
├── CLI                    → scaffold + dev + build commands
├── @vsceasy/runtime          → file-based loader, panel/command registry
├── @vsceasy/bridge           → typed RPC bridge (ext ↔ webview)
└── templates/             → react | svelte | vue | vanilla
```

Packages publish under `@ideascol/vsceasy-*` (single repo, eventually a monorepo). Start as one package; split when stable.

## Generated project layout

```
my-extension/
├── src/
│   ├── extension/
│   │   ├── commands/         # one file = one command
│   │   │   └── hello.ts
│   │   ├── panels/           # one folder = one webview panel
│   │   │   └── dashboard/
│   │   │       ├── panel.ts  # ext-side handlers (RPC)
│   │   │       └── ui/       # webview UI (React/Svelte/Vue)
│   │   │           └── App.tsx
│   │   └── api.ts            # shared RPC type contract
│   └── shared/
├── vsceasy.config.ts            # publisher, displayName, activation
└── package.json
```

## Conventions

### Commands

```ts
// src/extension/commands/hello.ts
import { defineCommand } from '@ideascol/vsceasy-runtime';
export default defineCommand({
  id: 'myExt.hello',          // optional; inferred from path
  title: 'Hello World',
  run: async (ctx) => ctx.window.showInformationMessage('hi'),
});
```

Loader scans `commands/`, auto-registers each export with `vscode.commands.registerCommand` and patches `package.json#contributes.commands`.

### Panels

```ts
// src/extension/panels/dashboard/panel.ts
import { definePanel } from '@ideascol/vsceasy-runtime';
import type { DashboardApi } from './api';

export default definePanel<DashboardApi>({
  id: 'myExt.dashboard',
  title: 'Dashboard',
  viewColumn: 'beside',
  ui: () => import('./ui/App'),   // bundled by Vite
  rpc: {
    async getProjects() { /* ext-side */ },
    async runTask(name: string) { /* ext-side */ },
  },
});
```

UI side:

```tsx
// src/extension/panels/dashboard/ui/App.tsx
import { useRpc } from '@ideascol/vsceasy-bridge/react';
import type { DashboardApi } from '../api';

export default function App() {
  const api = useRpc<DashboardApi>();
  return <button onClick={() => api.runTask('build')}>Build</button>;
}
```

Types flow from `rpc` definition → webview client. No manual `postMessage`.

## RPC bridge

Transport: `webview.postMessage` + `acquireVsCodeApi`.

Protocol:
```
{ id: string, kind: 'call', method: string, args: unknown[] }
{ id: string, kind: 'result', ok: true, value: unknown }
{ id: string, kind: 'result', ok: false, error: { message, stack? } }
{ kind: 'event', topic: string, payload: unknown }   // ext → webview push
```

Client API:
- `api.<method>(...args)` → Promise
- `api.on('topic', handler)` for push events
- Auto-reconnect on panel revive

## Build pipeline

- Extension code → `esbuild` → `dist/extension.js` (CJS, node target)
- Each panel UI → `vite build` → `dist/webview/<panel>/`
- `vsceasy dev` runs both in watch; webview HMR via Vite dev server; extension hot-restart via `vscode --extensionDevelopmentPath`.
- `vsceasy build` → produces `.vsix` via `@vscode/vsce`.

## Theming

Inject CSS vars from VS Code theme into webview root automatically. Provide `useTheme()` hook for React/Svelte/Vue.

## Activation events

Auto-derived from registered commands and panels — no need to edit `package.json#activationEvents`.

## What we explicitly DON'T do

- No React server components, no SSR
- No custom bundler — Vite + esbuild only
- No state management opinions — userland choice
- No tree-view, status-bar, language-server abstractions in v1 (add later)

## Roadmap

- v0.1: CLI scaffold + React template + RPC + commands + single panel
- v0.2: Svelte/Vue/Vanilla templates, multi-panel, hot reload
- v0.3: Tree views, status bar, sidebar containers
- v0.4: LSP helper, test harness
