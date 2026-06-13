---
title: subpanel add
description: Add an inline sidebar webview section inside a menu container.
---

A subpanel is a webview view rendered inline inside a menu's activity-bar
container (unlike a panel, which opens in the editor area).

```bash
vsceasy subpanel add --name history --menu settings --title "History"
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--name` | text | **Required.** Subpanel id. |
| `--menu` | menu id | **Required.** Container to render inside. |
| `--title` | text | View title. |
| `--withApi` | `yes` \| `no` | Generate a typed RPC interface. |

## What it generates

- `src/subpanels/<name>.ts` — the subpanel definition.
- `src/webview/subpanels/<name>/{App.tsx,main.tsx}` — the React UI.
- Appends `<Name>ViewApi` to `src/shared/api.ts` when the API is on.

```ts title="src/subpanels/history.ts"
import { defineSubpanel } from '../shared/vsceasy';

export default defineSubpanel({
  title: 'History',
  menu: 'settings',
});
```

Subpanels and panels share the same RPC machinery — see [Typed RPC](/guides/rpc/).
