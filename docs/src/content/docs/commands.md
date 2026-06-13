---
title: Commands overview
description: Every vsceasy CLI command, grouped by what it does.
---

Structure: `vsceasy <resource> <verb> [flags]`. Every command runs interactively
when flags are omitted (banner + per-param prompts) or fully scripted via flags.

New to a project? Start with **[`wizard`](/commands/wizard/)** — it detects your
context and walks you through the rest.

## Scaffolding

| Command | What it does |
| ------- | ------------ |
| [`create`](/commands/create/) | Scaffold a new extension project |
| [`wizard`](/commands/wizard/) | Interactive guided flow |

## UI features

| Command | What it does |
| ------- | ------------ |
| [`panel add`](/commands/panel-add/) | Webview panel + optional typed RPC; `--template` for ready UIs |
| [`subpanel add`](/commands/subpanel-add/) | Inline sidebar webview section |
| [`menu add` / `edit`](/commands/menu/) | Activity-bar menu + items |
| [`treeview add`](/commands/treeview-add/) | Data-driven tree view |
| [`command add`](/commands/command-add/) | Palette command |
| [`statusBar add`](/commands/statusbar-add/) | Status bar item |
| [`rpc add`](/commands/rpc-add/) | Typed RPC method on a panel |
| [`components add`](/commands/components-add/) | Themed React component library |

## Data

| Command | What it does |
| ------- | ------------ |
| [`db init`](/commands/db-init/) | Initialize the mini-ORM |
| [`model add`](/commands/model-add/) | Typed entity + repo |
| [`crud add`](/commands/crud-add/) | Full CRUD UI for a model |

## Operations

| Command | What it does |
| ------- | ------------ |
| [`job add`](/commands/job-add/) | Recurring / event-triggered job |
| [`helper add`](/commands/helper-add/) | Runtime helper (secrets/config/state/notifications) |
| [`test setup`](/commands/test-setup/) | Vitest config + sample test |
| [`publish init`](/commands/publish-init/) | Marketplace preflight |
| [`doctor`](/commands/doctor/) | Diagnose project drift |
| [`upgrade`](/commands/upgrade/) | Sync framework-owned files |

:::note
There's also `vsceasy ai-guide` which prints a machine-readable spec of the whole
CLI (`--format json` or `markdown`) — handy for AI agents and tooling.
:::
