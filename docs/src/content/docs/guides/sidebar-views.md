---
title: Sidebar views
description: Ordering tree views and subpanels inside a container, title-bar buttons, and lazily loaded tree nodes.
---

A [menu](/commands/menu/) is an activity-bar container. Inside it live the
container's own tree, plus any number of **tree views** (`defineTreeView`) and
**subpanels** (`defineSubpanel`). This page covers what you control about how
they're arranged and what they can do.

## Ordering

Subpanels and tree views share **one** ordering inside a container, so the two
kinds can be interleaved deliberately:

```ts title="src/treeViews/catalog.ts"
export default defineTreeView({ title: 'Catalog', menu: 'trainer', order: 1, getChildren });
```

```ts title="src/subpanels/ask.ts"
export default defineSubpanel({ title: 'Ask', menu: 'trainer', order: 2 });
```

Low `order` first. Views without an `order` keep their discovery order, **after**
every ordered one. `gen` writes the resulting sequence into
`package.json#contributes.views`, so re-run it after changing an `order`.

## Title-bar buttons

`titleActions` pins commands to a view's title row:

```ts title="src/treeViews/catalog.ts"
export default defineTreeView({
  title: 'Catalog',
  menu: 'trainer',
  titleActions: [
    { command: 'refreshCatalog' },                          // icon button
    { command: 'exportCatalog', group: 'overflow' },        // … menu
    { command: 'addProblem', when: 'config.myExt.editing' },
  ],
  getChildren,
});
```

| Field | Default | Meaning |
| ----- | ------- | ------- |
| `command` | — | The id you gave `defineCommand` — **without** the extension prefix. |
| `group` | `'navigation'` | `navigation` renders an inline icon button; anything else drops into the `…` overflow menu. |
| `when` | — | ANDed with the view match rather than replacing it. |

`gen` writes these to `contributes.menus['view/title']` as
`view == <viewId> && <your when>`.

:::caution[Give the command an icon]
A `view/title` entry with no icon renders as its plain **title text**, which
looks broken next to real buttons. Set `icon` on the command:

```ts title="src/commands/refreshCatalog.ts"
export default defineCommand({
  id: 'refreshCatalog',
  title: 'Refresh Catalog',
  icon: 'refresh',            // codicon name; '$(refresh)' also accepted
  run: () => reload(),
});
```

`gen` writes it to `contributes.commands[].icon`. Codicon names autocomplete.
:::

`titleActions` works the same on subpanels.

## Tree nodes: leaves vs. lazy children

A node is collapsible when it **has** children, or when it says it will load
them later:

```ts
getChildren: async (parent) => {
  if (!parent) {
    return [
      { label: 'Arrays & Hashing', icon: 'symbol-array', expandable: true },  // lazy
      { label: 'README.md', icon: 'file' },                                   // leaf
      { label: 'Group', collapsed: 'expanded', children: [{ label: 'child' }] },
    ];
  }
  return loadProblems(parent.id ?? parent.label);   // called on expand
},
```

| Node shape | Renders as |
| ---------- | ---------- |
| `children: [...]` (non-empty) | collapsible, children already in hand |
| `expandable: true` | collapsible, `getChildren(node)` runs on expand |
| neither | leaf — no expand arrow |

`expandable` exists because an omitted `children` cannot mean both "leaf" and
"load later": most leaves never set the field, so treating `undefined` as lazy
would put a useless expand arrow on every one of them.

`collapsed: 'expanded' | 'collapsed'` sets the initial state (default
`collapsed`), and `showCollapseAll` on the view toggles the *Collapse All*
button (default `true`).

## Clicks

A node can carry `panel`, `command`, or `run`. When it carries a `command`, the
clicked **node is forwarded** to the handler — a data-driven tree's command is
almost always about *which* item was clicked:

```ts
run: (vscode, ctx, node) => openProblem((node as TreeNode).id),
```

Command references from tree nodes, menu items and status-bar items resolve by
**either** the registry key (the filename) **or** the `id` declared on the def.
So a file `src/commands/refresh.ts` exporting `defineCommand({ id: 'refreshCatalog' })`
can be referenced as either name without a runtime "unknown command" error.

## Keeping a view live

`watch` receives a `refresh` callback and returns an unsubscribe — the same
shape used by status bar items and decorations:

```ts
watch: (refresh) => watchEntity(Problems, refresh),
```

See [Reactivity](/guides/reactivity/) for the store and `watchEntity` side of it.
