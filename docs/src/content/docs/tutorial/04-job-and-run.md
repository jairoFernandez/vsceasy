---
title: "4. A reminder job, then run it"
description: Add a background job that warns about overdue todos, then launch the extension.
---

A todo list should nag you. We'll add a background **job** that checks for
overdue todos once a day and shows a warning.

## Add the job

```bash
vsceasy job add --name dueReminder --title "Due Todo Reminder" --dailyAt "09:00"
```

```text
✓ Job "dueReminder" added.

  + src/jobs/dueReminder.ts
```

`job add` supports several schedule shapes — pick one:

| Flag | Fires |
| ---- | ----- |
| `--every "30s"` | on an interval (`30s`, `5m`, `2h`, `1d`) |
| `--dailyAt "09:00"` | once a day at local time |
| `--on startup` | on a VS Code event (`startup`, `saveDocument`, …) |
| `--onFile "**/*.md"` | when matching files change |

The runtime registers the timer on activate and cleans it up on deactivate — you
only write the work.

## Fill in the work

The generated job is a stub. Replace its `run` to query overdue todos with the
same `TodosRepo()` the panels use, and warn if any are past due:

```ts title="src/jobs/dueReminder.ts"
import { defineJob } from '../shared/vsceasy';
import { TodosRepo } from '../models/Todo';

export default defineJob({
  title: 'Due Todo Reminder',
  schedule: { dailyAt: '09:00' },
  run: async (vscode) => {
    const now = Date.now();
    const todos = await TodosRepo().findMany();
    const overdue = todos.filter(
      (t) => !t.done && t.dueDate && new Date(t.dueDate).getTime() < now,
    );
    if (overdue.length === 0) return;

    const titles = overdue.map((t) => t.title).join(', ');
    vscode.window.showWarningMessage(
      `${overdue.length} overdue todo${overdue.length > 1 ? 's' : ''}: ${titles}`,
    );
  },
});
```

Because the job and the panels share `TodosRepo()` and the `Todo` type, this is
fully type-checked — `t.done`, `t.dueDate`, `t.title` are all known fields.

:::tip[Testing a daily job]
A `dailyAt` job won't fire on demand. To see the notification while developing,
temporarily switch the schedule to `{ every: '10s' }`, reload, and add a todo
with a past `dueDate`. Switch it back when you're done.
:::

## Build and launch

Everything is wired. Build and open the Extension Development Host:

```bash
bun run launch
```

This builds the extension + webviews and opens a new VS Code window titled
**[Extension Development Host]**. Open the **Todos** view from the activity bar
to use the list and form.

Inside VS Code you can instead press **F5** (after `bun run dev`) for a
watch-mode loop: edit a panel, reload the host, see the change.

## What you built

Starting from an empty project, four commands produced:

- a typed, persisted `Todo` model (`db init` + `model add`),
- a full list + form UI with typed RPC and an activity-bar menu (`crud add`),
- a daily overdue-reminder notification (`job add`),

and `bun run gen` kept `package.json` and the registry in sync the whole way.

The CRUD step already gave us an activity-bar menu. The next steps go deeper into
how that menu works and what else can dock inside it.

Next: [menus — the navigation model →](/tutorial/05-menus/)

## Reference

- [The mini-ORM](/guides/orm/) — queries, indexes, and providers behind `TodosRepo()`.
- [Typed RPC](/guides/rpc/) — how the host ↔ webview bridge stays type-safe.
- [CRUD scaffolding](/guides/crud/) — customizing generated fields via `crud.config.ts`.
- [Publishing](/guides/publishing/) — ship your extension to the Marketplace.
