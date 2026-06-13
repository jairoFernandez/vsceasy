---
title: store add
description: Add a reactive store — an observable value a webview can track.
---

Scaffold a reactive store under `src/stores/`. A store holds one observable value;
mutate it and anything watching reacts. See the [Reactivity guide](/guides/reactivity/)
for the full picture.

```bash
vsceasy store add --name badgeCount --type number --initial 0
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--name` | text | **Required.** Store id (camelCase, e.g. `badgeCount`). |
| `--type` | `number` \| `string` \| `boolean` \| `json` | Value type. Default `number`. |
| `--initial` | text | Initial value expression. Defaults per type: `0` / `''` / `false` / `null`. |

## What it generates

```ts title="src/stores/badgeCount.ts"
import { defineStore } from '../shared/vsceasy';

export const badgeCount = defineStore<number>(0);
```

`defineStore` gives `get()`, `set(v)`, `update(fn)`, and `subscribe(cb)`.

## Using it

Mutate the store anywhere on the host:

```ts
import { badgeCount } from '../stores/badgeCount';
badgeCount.set(3);
badgeCount.update((n) => n + 1);
```

Push changes to a webview — `watch` the store in a panel's `rpc()` and `emit`:

```ts
import { watch } from '../shared/vsceasy';
import { badgeCount } from '../stores/badgeCount';

rpc: (vscode, ctx, emit) => {
  watch(badgeCount, () => emit('badgeCount:changed', badgeCount.get()));
  return { /* … */ };
}
```

React in the webview:

```ts
import { listen } from '../shared/vsceasy/client';
listen(api, 'badgeCount:changed', (v) => render(v));
```

## Examples

```bash
# a boolean flag, starts false
vsceasy store add --name sidebarOpen --type boolean

# a string with a custom initial value
vsceasy store add --name filter --type string --initial "'all'"

# arbitrary JSON state
vsceasy store add --name selection --type json --initial "{ ids: [] }"
```

See the [Reactivity guide](/guides/reactivity/) for ORM-entity reactivity
(`watchEntity`) and the host↔webview flow.
