---
title: statusBar add
description: Add a status bar item bound to a command, panel, or popup menu.
---

Add a status bar item that runs a command, opens a panel, creates a new command,
or opens a popup menu.

```bash
vsceasy statusBar add --name sync --text "$(sync) Sync" --bindTo command --command doSync
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--name` | text | **Required.** Item id. |
| `--text` | text | **Required.** Label (supports `$(codicon)` syntax). |
| `--alignment` | `left` \| `right` | Side of the status bar. |
| `--priority` | number | Higher = further left within its side. |
| `--bindTo` | `command` \| `panel` \| `create new command` \| `menu` | What the item does on click. |
| `--command` | command id | When `--bindTo command`. |
| `--panel` | panel id | When `--bindTo panel`. |
| `--newCommandTitle` | text | When `--bindTo "create new command"`. |
| `--menu` | menu id | When `--bindTo menu`. |
| `--label` / `--kind` | — | Menu item details when binding to a popup menu. |

## Examples

```bash
# open a panel
vsceasy statusBar add --name dash --text "$(dashboard) Dashboard" --bindTo panel --panel dashboard

# run an existing command
vsceasy statusBar add --name fmt --text "$(wand) Format" --bindTo command --command format

# create the command at the same time
vsceasy statusBar add --name greet --text "Hello" --bindTo "create new command" --newCommandTitle "Say Hello"
```

```ts title="src/statusBars/sync.ts"
import { defineStatusBar } from '../shared/vsceasy';

export default defineStatusBar({
  text: '$(sync) Sync',
  alignment: 'left',
  command: 'doSync',
});
```
