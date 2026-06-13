---
title: "Tutorial: Build a Todo extension"
description: Build a complete VS Code Todo-list extension with vsceasy, one command at a time.
---

This tutorial builds a working **Todo list** VS Code extension from nothing — a
database, a typed model, a full CRUD UI, and a background reminder — using only
`vsceasy` commands. After each command you'll see exactly what it generated and
why.

It mirrors the shape of Angular's *Tour of Heroes*: small steps, each one runnable,
each one explained.

## What you'll build

A VS Code extension that:

- Stores todos in the built-in [mini-ORM](/guides/orm/).
- Shows a **list panel** (table with Refresh / New / Edit / Delete).
- Shows a **form panel** with the right input per field — text, checkbox for the
  boolean, a **dropdown** for the priority union, a **date picker** for the due date.
- Fires a **daily reminder** notification for overdue todos.

![The finished Todo list panel running in the Extension Development Host](/tutorial/todos-list.svg)

## What you'll learn

- How `create` scaffolds a project, and what each generated file is for.
- How `db init` + `model add` define typed, persisted data.
- How `crud add` turns a model into a full list + form UI with typed RPC.
- How `job add` registers background work.
- How `bun run gen` wires everything into `package.json` and the registry.

## Prerequisites

- [Bun](https://bun.sh) installed (`bun --version`).
- VS Code with the `code` CLI on your `PATH` (Command Palette →
  *Shell Command: Install 'code' command in PATH*).

## The steps

1. [Scaffold the project](/tutorial/01-scaffold/) — `vsceasy create`.
2. [Add the database and the Todo model](/tutorial/02-model/) — `db init` + `model add`.
3. [Generate the CRUD UI](/tutorial/03-crud/) — `crud add`.
4. [Add a reminder job and run it](/tutorial/04-job-and-run/) — `job add`, then launch.

:::tip[Flags vs. prompts]
Every command below is shown in its non-interactive **flag** form so you can copy
it verbatim. Run any command with no flags to get the interactive prompts instead.
Note that `create` requires `--name` — it has no positional argument.
:::
