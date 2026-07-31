---
title: treeview add
description: Add a data-driven tree view to a menu.
---

A tree view renders hierarchical data inside a menu's container, driven by
`getChildren` / `getTreeItem`.

```bash
vsceasy treeview add --name files --menu settings --title "Files"
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--name` | text | **Required.** Tree view id. |
| `--menu` | menu id | **Required.** Container to render inside. |
| `--title` | text | View title. |

## What it generates

`src/treeViews/<name>.ts` with a `getChildren` you fill in with real data.

```ts title="src/treeViews/files.ts"
import { defineTreeView, TreeNode } from '../shared/vsceasy';

export default defineTreeView({
  title: 'Files',
  menu: 'settings',
  order: 1,                                    // position inside the container
  titleActions: [{ command: 'refreshFiles' }], // buttons on the title row
  getChildren: async (parent, vscode, ctx) => {
    if (!parent) {
      return [
        { label: 'Item 1', icon: 'file', tooltip: 'Replace with real data' },
        { label: 'Group', icon: 'folder', expandable: true },   // children load on expand
      ] as TreeNode[];
    }
    // Lazy children — return based on parent.id / parent.contextValue.
    return [];
  },
});
```

A `TreeNode` may carry a `panel`, `command` or `run` to fire on click (the node
is forwarded to the command), plus `icon`, `tooltip`, `description`, `collapsed`,
and `contextValue` for `when`-clause targeting.

:::note[`expandable` marks lazy nodes]
A node is collapsible when it has non-empty `children` **or** sets
`expandable: true`. Without it, a node with no `children` is a leaf — that's what
keeps every leaf from getting an expand arrow that opens nothing.
:::

`order` and `titleActions` are covered in [Sidebar views](/guides/sidebar-views/),
along with why a title-bar command needs an `icon`.
