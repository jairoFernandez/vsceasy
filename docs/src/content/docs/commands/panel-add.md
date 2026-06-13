---
title: panel add
description: Add a webview panel (React UI + typed RPC) to your extension.
---

Add a panel: a webview that opens in the editor area, with a React UI and an
optional typed RPC bridge.

```bash
vsceasy panel add --name settings --title "Settings"
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--name` | text | **Required.** Panel id, e.g. `settings`. |
| `--title` | text | Tab title. Defaults to PascalCase of name. |
| `--template` | `blank` \| `form` \| `list` \| `dashboard` | Starter UI. Default `blank`. |
| `--withApi` | `yes` \| `no` | Generate a typed RPC interface. Forced on for non-blank templates. |

## What it generates

- `src/panels/<name>.ts` — the panel definition.
- `src/webview/panels/<name>/{App.tsx,main.tsx}` — the React UI.
- Appends `<Name>Api` to `src/shared/api.ts` when the API is on.
- An auto command `<prefix>.open<Name>` to open it.

## Templates

`--template` starts you from a working screen built on the shared
[component library](/commands/components-add/) (auto-generated on first use) and
wires the matching RPC method.

```bash
vsceasy panel add --name signup --template form        # inputs + save() RPC
vsceasy panel add --name items  --template list        # list + load() RPC
vsceasy panel add --name stats  --template dashboard   # stat cards + stats() RPC
```

| Template | UI | RPC method added |
| -------- | -- | ---------------- |
| `blank` | empty `App.tsx` | none |
| `form` | inputs + Save | `save(input)` |
| `list` | list + Refresh | `list()` |
| `dashboard` | stat cards | `stats()` |

## Example

```ts title="src/panels/settings.ts"
import { definePanel } from '../shared/vsceasy';
import type { SettingsApi } from '../shared/api';

export default definePanel<SettingsApi>({
  title: 'Settings',
  rpc: (vscode) => ({
    // add RPC handlers here
  }),
});
```
