---
title: "2. The database and the Todo model"
description: Initialize the mini-ORM and define a typed, persisted Todo entity.
---

The CRUD UI in the next step is generated *from a model*, so we define the data
first.

## Initialize the database

```bash
vsceasy db init
```

```text
✓ Database initialized (provider: storage).

  + src/helpers/db.ts
  ~ wired initDb(context) into src/extension/extension.ts
```

This drops the [mini-ORM](/guides/orm/) at `src/helpers/db.ts` and wires
`initDb(context)` into your activate hook so the database is ready before any
panel queries it. The default `storage` provider writes one JSON file per entity
under the extension's storage directory.

`src/extension/extension.ts` now reads:

```ts title="src/extension/extension.ts"
export const activate = bootstrap(registry, { onActivate: [initDb] });
```

## Add the Todo model

We give the model five fields, each picked to show a different input later:

```bash
vsceasy model add --name todo \
  --fields 'id:string!,title:string,done:boolean,priority:"low"|"medium"|"high",dueDate?:Date'
```

```text
✓ Model created (primaryKey: id).

  + src/models/Todo.ts
```

### Reading the field spec

| Spec piece | Meaning |
| ---------- | ------- |
| `id:string!` | `string` field, `!` marks it the **primary key** |
| `title:string` | required text |
| `done:boolean` | a boolean → renders as a **checkbox** |
| `priority:"low"\|"medium"\|"high"` | a **literal union** → renders as a **dropdown** |
| `dueDate?:Date` | the `?` makes it **optional**; `Date` → renders as a **date picker** |

## What got generated

```ts title="src/models/Todo.ts"
import { defineEntity, db } from '../helpers/db';

export interface Todo {
  id: string;
  title: string;
  done: boolean;
  priority: "low"|"medium"|"high";
  dueDate?: Date;
}

export const Todos = defineEntity<Todo>('todos', {
  primaryKey: 'id',
});

/** Typed repo accessor. Lazy — assumes `initDb(context)` ran on activate. */
export const TodosRepo = () => db()(Todos);
```

Three things to notice:

- **`interface Todo`** is the single source of truth for the shape. The form and
  list UIs, the service, and the RPC contracts all derive from it.
- **`Todos`** is the entity definition (name + primary key).
- **`TodosRepo()`** is your typed data access — `findMany`, `findById`,
  `insert`, `upsert`, `delete`, all returning `Todo`. You'll use it from services
  and jobs.

No UI yet — just typed, persisted data. The next command turns this model into a
working interface.

Next: [generate the CRUD UI →](/tutorial/03-crud/)
