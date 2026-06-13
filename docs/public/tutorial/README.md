# Tutorial illustrations

The tutorial pages reference three SVG mockups by absolute path
(`/tutorial/<name>.svg`). SVGs are used (not PNG screenshots) so they live in git
as text, render crisply at any zoom, and adapt to the page.

| File | What it shows | Referenced by |
| ---- | ------------- | ------------- |
| `todos-list.svg` | The **Todos** list panel: Id/Title/Done/Priority/Due Date table with Refresh, + New, Edit, Delete (rows t1–t4). | `tutorial/index.md`, `tutorial/03-crud.md` |
| `todos-form.svg` | The **New Todos** form beside the list: text inputs, Done checkbox, Priority dropdown, Due Date picker. | `tutorial/03-crud.md` |
| `todos-priority.svg` | The **Priority** dropdown expanded: `low` / `medium` / `high` (the model's union type). | `tutorial/03-crud.md` |

They reproduce the live `todo-demo` extension built in the tutorial. To swap in
real screenshots later, drop PNGs with the same base name and update the `.svg`
extensions in `index.md` and `03-crud.md`.
