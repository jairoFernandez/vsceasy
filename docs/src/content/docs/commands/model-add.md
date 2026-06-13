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

## Relations

Point a field at another model with `ref(Model)` — Symfony-style. The field
becomes a `<name>Id` foreign key, and the relation is recorded so
[`crud add`](/commands/crud-add/) renders a **populated dropdown** for it.

```text
category:ref(Category)              FK categoryId, dropdown of Category rows
category:ref(Category, label=name)  show Category.name in the dropdown
```

The referenced model must already exist (`model add` errors otherwise, naming the
model to create first). In the interactive loop, the prompt lists the models you
can relate to.

```bash
vsceasy model add --name category --fields "id:string!,name:string"
vsceasy model add --name todo \
  --fields "id:string!,title:string,category:ref(Category)"
```

```ts title="src/models/Todo.ts" {4,12-14}
export interface Todo {
  id: string;
  title: string;
  categoryId: string;  // → Category
}

export const Todos = defineEntity<Todo>('todos', { primaryKey: 'id' });
export const TodosRepo = () => db()(Todos);

/** Relation metadata — used by `vsceasy crud add` to populate pickers. */
export const TodoRelations = {
  categoryId: { model: 'Category' },
} as const;
```

The default dropdown label is the related model's first string field; override it
with `label=<field>`.

:::note
Relations are **ManyToOne** (a foreign key on this model). The FK stores the
related row's id; there's no join table or cascade — the mini-ORM stays simple.
:::

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
