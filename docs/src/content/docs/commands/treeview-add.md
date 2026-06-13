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
  getChildren: async (parent, vscode, ctx) => {
    if (!parent) {
      return [
        { label: 'Item 1', icon: 'file', tooltip: 'Replace with real data' },
        { label: 'Group', icon: 'folder', collapsed: 'collapsed', children: [] },
      ] as TreeNode[];
    }
    // Lazy children — return based on parent.id / parent.contextValue.
    return [];
  },
});
```

A `TreeNode` may carry a `panel` or `command` to run on click, plus `icon`,
`tooltip`, `collapsed`, and `contextValue` for `when`-clause targeting.
