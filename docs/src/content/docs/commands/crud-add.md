---
title: crud add
description: Scaffold a full CRUD UI (service + list + form + RPC) for a model.
---

Rails-style scaffolding. For an existing [model](/commands/model-add/), generate a
service, a list panel, a form panel, the RPC contracts, and an optional menu wire.

```bash
vsceasy crud add --model user --menu new:admin
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--model` | model name | **Required.** Model to scaffold over. |
| `--menu` | `none` \| `existing:<id>` \| `new:<id>` | Menu wiring policy. |
| `--newMenuId` | text | Menu id when `--menu new:` is chosen interactively. |

## What it generates

- `src/services/<Model>Service.ts` — business logic over the repo.
- `src/services/<model>FormNav.ts` — list→form edit hand-off.
- `src/panels/<plural>List.ts` + its webview — the list UI.
- `src/panels/<model>Form.ts` + its webview — the create/edit form.
- `<Plural>ListApi` and `<Model>FormApi` appended to `src/shared/api.ts`.
- Optional menu entries for the list and form.

## Behavior worth knowing

- **List refreshes on reveal.** Webviews retain state when hidden, so the list
  reloads on focus/visibility and after a save in the form. There's also a manual
  **Refresh** button.
- **Delete confirms in the host.** Browser `confirm()` is disabled in webviews, so
  delete uses a native `showWarningMessage` modal.
- **Edit pre-loads.** Clicking Edit stashes the row id; the form pulls it on mount
  and pre-fills via `get(id)`. Creating a new row clears the form afterward.
- **Relations become dropdowns.** A `ref(Model)` field (see
  [`model add`](/commands/model-add/#relations)) renders as a `<select>` populated
  from the related model's rows — loaded over RPC via a generated `options()`
  handler. The form stores the related row's id.

## Examples

```bash
# no menu
vsceasy crud add --model user --menu none

# into an existing menu
vsceasy crud add --model user --menu existing:settings

# create a new menu for it
vsceasy crud add --model user --menu new:admin
```

See the [CRUD guide](/guides/crud/) for a full walkthrough.
