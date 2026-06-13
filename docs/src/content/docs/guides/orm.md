---
title: The mini-ORM
description: A typed, filesystem-backed store for extension data.
---

vsceasy ships a small ORM with a pluggable provider. The bundled provider writes
each entity to a JSON file under the extension's storage dir. Entity definitions
and call sites don't change if you later swap the provider.

## Setup

```bash
vsceasy db init
vsceasy model add --name user --fields "id:string!,name:string,email?:string@"
```

Wire `initDb` on activate:

```ts title="src/extension/extension.ts"
export const activate = bootstrap(registry, { onActivate: [initDb] });
```

## Defining entities

```ts title="src/models/User.ts"
import { defineEntity, db } from '../helpers/db';

export interface User {
  id: string;
  name: string;
  email?: string;
}

export const Users = defineEntity<User>('users', {
  primaryKey: 'id',
  indexes: ['email'],
});

export const UsersRepo = () => db()(Users);
```

## Repository API

```ts
const repo = UsersRepo();

await repo.insert({ id: 'u1', name: 'Jane' });   // throws on duplicate id
await repo.upsert({ id: 'u1', name: 'Janet' });  // insert or replace
await repo.update('u1', { name: 'J' });          // patch; null if absent
await repo.delete('u1');                          // boolean
await repo.deleteMany({ active: false });         // count removed
await repo.clear();                               // empty the entity

await repo.findById('u1');                        // T | null
await repo.findOne({ email: 'j@x.io' });          // T | null
await repo.findMany({                             // T[]
  where: { active: true },
  orderBy: 'name:asc',
  limit: 20,
  offset: 0,
});
await repo.count({ where: { active: true } });    // number
```

### Where operators

```ts
await repo.findMany({ where: { role: { in: ['admin', 'mod'] } } });
await repo.findMany({ where: { status: { neq: 'archived' } } });
```

## Transactions

`db.transaction` commits on success and rolls back on throw. Nested transactions
are rejected.

```ts
await db().transaction(async (tx) => {
  await tx(Users).insert({ id: 'a', name: 'A' });
  await tx(Accounts).insert({ id: 'a', userId: 'a' });
  // if either throws, neither is committed
});
```

## Storage providers

- **`storage`** (default) — per-workspace storage dir. Falls back to global
  storage when no folder is open, so activation never fails.
- **`global`** — shared across workspaces.

```ts
const orm = createDb(context, { provider: 'global', subdir: 'db' });
```

The provider interface (`load` / `save` / `transaction`) is the seam for future
backends like SQLite — your models and call sites stay the same.
