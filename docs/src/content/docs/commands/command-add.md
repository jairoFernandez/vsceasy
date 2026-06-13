---
title: command add
description: Add a palette command, optionally wired into a menu with a keybinding.
---

Add a command registered in the command palette, with optional menu entry,
keybinding, and `when` clause.

```bash
vsceasy command add --name sayHello --title "Say Hello"
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--name` | text | **Required.** Command id (camelCase). |
| `--title` | text | Palette title. Defaults to PascalCase of name. |
| `--category` | text | Optional category prefix shown in the palette. |
| `--menuEntry` | text | Insert into this menu (file basename in `src/menus/`). |
| `--group` | text | Parent group label inside the menu. |
| `--icon` | codicon | Icon shown next to the menu entry. |
| `--keybinding` | text | Keyboard shortcut, e.g. `ctrl+shift+h`. |
| `--when` | text | `when` clause controlling palette enablement. |

## Examples

```bash
# simple palette command
vsceasy command add --name sayHello --title "Say Hello"

# with a menu entry, icon, and keybinding
vsceasy command add \
  --name doStuff \
  --title "Do Stuff" \
  --menuEntry main \
  --group Actions \
  --icon play \
  --keybinding "ctrl+alt+d"

# only enabled when an editor has focus
vsceasy command add --name format --title "Format" --when editorTextFocus
```

## `when` clause cheatsheet

| Clause | Meaning |
| ------ | ------- |
| `editorTextFocus` | active text editor |
| `editorHasSelection` | text is selected |
| `resourceLangId == typescript` | current file language |
| `resourceExtname == .json` | current file extension |
| `explorerResourceIsFolder` | folder selected in Explorer |
| `workspaceFolderCount != 0` | a workspace is open |
| `view == myExt-settings` | inside a specific tree view |
| `viewItem == myCtx` | tree item with that contextValue |
| `!virtualWorkspace` | exclude github.dev / codespaces |

Operators: `&&` `||` `!` `==` `!=` `=~` `in`. Full reference:
[when-clause contexts](https://code.visualstudio.com/api/references/when-clause-contexts).

```ts title="src/commands/sayHello.ts"
import { defineCommand } from '../shared/vsceasy';

export default defineCommand({
  title: 'Say Hello',
  run: async (vscode) => {
    await vscode.window.showInformationMessage('Hello!');
  },
});
```
