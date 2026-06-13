---
title: db init
description: Initialize the project database (mini-ORM).
---

Scaffold the mini-ORM at `src/helpers/db.ts`. Idempotent — safe to run again.

```bash
vsceasy db init
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--provider` | `storage` \| `global` | Where data lives. Default `storage`. |
| `--force` | boolean | Overwrite an existing `db.ts`. |

## Providers

- **`storage`** — writes under the workspace storage dir. Falls back to global
  storage automatically when no folder is open (so activation never fails).
- **`global`** — writes under the global storage dir, shared across workspaces.

## Wire it on activate

```ts title="src/extension/extension.ts"
import { bootstrap } from '../shared/vsceasy';
import { registry } from './_registry';
import { initDb } from '../helpers/db';

export const activate = bootstrap(registry, { onActivate: [initDb] });
```

Next: define a [model](/commands/model-add/), then use it via its repo. See the
[mini-ORM guide](/guides/orm/) for the full API.
