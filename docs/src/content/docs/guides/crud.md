---
title: CRUD scaffolding
description: Generate a full list + form UI over a model, end to end.
---

`crud add` is the fastest path from a model to a working UI. It generates a
service, a list panel, a form panel, the RPC contracts, and an optional menu wire.

## Walkthrough

```bash
# 1. database + model
vsceasy db init
vsceasy model add --name user \
  --fields "id:string!,name:string,email?:string@,role:\"admin\"|\"user\",active:boolean"

# 2. full CRUD, wired into a new menu
vsceasy crud add --model user --menu new:admin
```

Reload the window and open the **admin** menu. You get:

- A **list** panel: table of rows, Refresh, + New, Edit, Delete.
- A **form** panel: typed inputs (text, number, checkbox, select for unions).
- A **service** (`UserService`) sitting between the RPC handlers and the repo.

## What's generated

```
src/services/UserService.ts     business logic over UsersRepo()
src/services/userFormNav.ts     list → form edit hand-off
src/panels/usersList.ts         list panel definition + RPC
src/panels/userForm.ts          form panel definition + RPC
src/webview/panels/usersList/   list React UI
src/webview/panels/userForm/    form React UI
src/shared/api.ts               UsersListApi + UserFormApi appended
```

## Behavior built in

The scaffold handles the webview gotchas for you:

- **Live list.** The list reloads on focus/visibility and after a save, plus a
  manual **Refresh** button — because webviews keep state when hidden.
- **Host-side delete.** Delete confirms with a native modal, since browser
  `confirm()` is disabled in webviews.
- **Edit pre-fill.** Edit stashes the row id; the form pulls it on mount and
  pre-fills via `get(id)`. Creating a new row clears the form afterward.

## Customizing

A generated `crud.config.ts` lets you hide fields or relabel columns:

```ts title="crud.config.ts"
export default {
  fields: {
    createdAt: { hideInForm: true },
    email: { label: 'Email address' },
  },
};
```

Re-run `crud add` after editing the config, or tweak the generated panels
directly — they're yours.
