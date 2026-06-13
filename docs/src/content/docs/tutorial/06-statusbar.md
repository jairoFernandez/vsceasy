---
title: "6. A status bar item"
description: Add a status bar entry that opens the Todos panel, bound by id.
---

The status bar is the strip at the bottom of VS Code. A status bar item is a tiny
button there — it has no UI of its own; it **binds to** a command, a panel, or a
popup menu, reusing the same id-reference model from the previous step.

## Add it

We'll add a `Todos` button that opens the list panel:

```bash
vsceasy statusBar add --name todoCount \
  --text '$(checklist) Todos' \
  --bindTo panel --panel todosList \
  --alignment left --priority 100 \
  --tooltip "Open the todo list"
```

```text
✓ Status bar "todoCount" added.

  Created:
    + src/statusBars/todoCount.ts
```

The `$(checklist)` in `--text` is a codicon — status bar text supports inline
`$(icon)` syntax.

## What got generated

```ts title="src/statusBars/todoCount.ts"
import { defineStatusBar } from '../shared/vsceasy';

export default defineStatusBar({
  text: '$(checklist) Todos',
  tooltip: 'Open the todo list',
  alignment: 'left',
  priority: 100,
  panel: 'todosList',
});
```

## The binding model

A status bar item picks **one** click target. When more than one is set, this is
the precedence:

| Field | Click behavior | Precedence |
| ----- | -------------- | ---------- |
| `menu: [ … ]` | Opens a QuickPick popup of items | highest |
| `panel: 'id'` | Opens that panel | middle |
| `command: 'id'` | Runs that command | lowest |

`--bindTo` chooses which one the CLI writes:

```bash
# run a command
vsceasy statusBar add --name sync --text '$(sync) Sync' \
  --bindTo command --command doSync

# open a popup menu of choices
vsceasy statusBar add --name todoMenu --text '$(list-unordered) Todo' \
  --bindTo menu
# (then it prompts for the menu items: label + kind + target)

# create a brand-new command and bind to it in one shot
vsceasy statusBar add --name refresh --text '$(refresh)' \
  --bindTo "create new command" --newCommandTitle "Refresh Todos"
```

`alignment` (`left`/`right`) and `priority` (higher = further toward the center)
position it. No `package.json` contribution is needed — status bar items are pure
runtime, registered by `bootstrap` from the registry.

## See it run

After a reload the item sits at the bottom-left. Clicking it opens the Todos list
— the same `todosList` panel the menu links to:

![The Todos status bar item at the bottom of VS Code](/tutorial/statusbar.svg)

Next: [add sidebar views — a subpanel and a tree view →](/tutorial/07-sidebar-views/)
