---
title: menu add / edit
description: Create an activity-bar menu and add items to it.
---

A menu is an activity-bar icon with a tree view of items (panels, commands, URLs,
and groups). Use `menu add` to create one, `menu edit` to add items.

## `menu add`

```bash
vsceasy menu add --name settings --title "Settings" --icon settings-gear
```

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--name` | text | **Required.** Menu id (file basename in `src/menus/`). |
| `--title` | text | Title shown on the view container. |
| `--icon` | codicon | **Required.** Activity-bar icon. |

## `menu edit`

Add one item to an existing menu.

```bash
vsceasy menu edit --name settings --kind panel --panel usersList --label Users --icon account
```

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--name` | menu id | **Required.** Which menu to edit. |
| `--kind` | `panel` \| `command` \| `url` \| `group` | **Required.** Item type. |
| `--group` | group label | Parent group. Defaults to root. |
| `--panel` | panel id | Required when `--kind panel`. |
| `--command` | command id | Required when `--kind command`. |
| `--url` | url | Required when `--kind url`. |
| `--label` | text | Item label. Defaults from the target. |
| `--icon` | codicon | Item icon. |

## Examples

```bash
# create a menu
vsceasy menu add --name settings --title "Settings" --icon settings-gear

# add a panel item
vsceasy menu edit --name settings --kind panel --panel dashboard --label Dashboard --icon play

# add a command item under a group
vsceasy menu edit --name settings --kind command --command sayHello --group Actions --icon play

# add an external link
vsceasy menu edit --name settings --kind url --url https://example.com --label Docs --icon book
```

```ts title="src/menus/settings.ts"
import { defineMenu } from '../shared/vsceasy';

export default defineMenu({
  title: 'Settings',
  icon: 'settings-gear',
  items: [
    {
      label: 'Panels',
      children: [
        { label: 'Dashboard', icon: 'play', panel: 'dashboard' },
        { label: 'Users', icon: 'account', panel: 'usersList' },
      ],
    },
  ],
});
```
