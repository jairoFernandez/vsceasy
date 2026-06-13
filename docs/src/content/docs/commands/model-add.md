---
title: model add
description: Add a typed model (entity + repo) under src/models/.
---

Define a typed entity and its repo. Requires [`db init`](/commands/db-init/) first.

```bash
vsceasy model add --name user --fields "id:string!,name:string,email?:string@,active:boolean"
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--name` | text | **Required.** Model name (singular, e.g. `user`). |
| `--fields` | spec | Compact field spec. Omit to use the interactive loop. |
| `--plural` | text | Repo handle. Defaults to `<Name>s`. |
| `--collection` | text | On-disk collection name. Defaults to the lowercased plural. |

## Field spec

Comma-separated `name:type` entries with flags:

| Flag | Position | Meaning |
| ---- | -------- | ------- |
| `!` | after type | primary key |
| `@` | after type | indexed |
| `?` | after name | optional |

```text
id:string!            primary key
name:string           required
email?:string@        optional + indexed
role:"admin"|"user"   literal union
score:number!@        primary key + indexed
```

If no `!` is set, `id` (or the first field) becomes the primary key.

## Examples

```bash
# one-shot spec
vsceasy model add --name user --fields "id:string!,name:string,email?:string@"

# interactive — type one field per line, blank to finish
vsceasy model add --name post
```

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

Use the repo anywhere after `initDb` ran:

```ts
await UsersRepo().insert({ id: 'u1', name: 'Jane' });
const u = await UsersRepo().findById('u1');
```
