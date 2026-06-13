# Tutorial illustrations

The tutorial pages reference SVG mockups by absolute path
(`/tutorial/<name>.svg`). SVGs are used (not PNG screenshots) so they live in git
as text, render crisply at any zoom, and adapt to the page.

| File | What it shows | Referenced by |
| ---- | ------------- | ------------- |
| `todos-list.svg` | The **Todos** list panel: Id/Title/Done/Priority/Due Date table with Refresh, + New, Edit, Delete (rows t1–t4). | `tutorial/index.md`, `tutorial/03-crud.md` |
| `todos-form.svg` | The **New Todos** form beside the list: text inputs, Done checkbox, Priority dropdown, Due Date picker. | `tutorial/03-crud.md` |
| `todos-priority.svg` | The **Priority** dropdown expanded: `low` / `medium` / `high` (the model's union type). | `tutorial/03-crud.md` |
| `menu-tree.svg` | The **Todos** menu in the activity bar: Panels/Actions groups + Todos/New Todo items linking panels. | `tutorial/05-menus.md` |
| `statusbar.svg` | The **Todos** status bar item bound to the list panel. | `tutorial/06-statusbar.md` |
| `sidebar-views.svg` | The **Todos** container: menu tree + Stats subpanel (totals) + By Priority tree view. | `tutorial/07-sidebar-views.md` |
| `treeview-expanded.svg` | The **By Priority** tree with the high group expanded, showing a todo node. | `tutorial/07-sidebar-views.md` |
| `reactivity-stats.svg` | The Stats subpanel before/after a save — updates live. | `tutorial/08-reactivity.md` |
| `relation-form.svg` | A CRUD form with a Category field rendered as a populated dropdown. | `guides/relations.md` |

They reproduce the live `todo-demo` extension built in the tutorial. To swap in
real screenshots later, drop PNGs with the same base name and update the `.svg`
extensions in `index.md` and `03-crud.md`.
