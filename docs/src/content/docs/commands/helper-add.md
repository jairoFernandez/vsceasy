---
title: helper add
description: Generate a typed runtime helper into src/helpers/.
---

Generate a typed helper for a common runtime concern.

```bash
vsceasy helper add --kind secrets
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--kind` | `secrets` \| `config` \| `state` \| `notifications` \| `cache` | **Required.** Which helper. |
| `--force` | boolean | Overwrite an existing helper file. |

## Kinds

| Kind | Wraps |
| ---- | ----- |
| `secrets` | `context.secrets` (typed get/set/delete). Wire `initSecrets(context)`. |
| `config` | `workspace.getConfiguration(...)` with typed keys. |
| `state` | `globalState` / `workspaceState`. Wire `initState(context)`. |
| `notifications` | info / warning / error message helpers. |
| `cache` | in-memory TTL + LRU cache with a `wrap(key, fn)` helper. |

## Examples

```bash
vsceasy helper add --kind config
vsceasy helper add --kind secrets
vsceasy helper add --kind cache
```

```ts title="src/helpers/cache.ts (usage)"
import { createCache } from '../helpers/cache';

const cache = createCache<User>({ ttlMs: 60_000, max: 200 });
const u = await cache.wrap('user:' + id, () => orm(User).findById(id));
```

:::tip
For the database, use the dedicated [`db init`](/commands/db-init/) +
[`model add`](/commands/model-add/) commands rather than a helper.
:::
