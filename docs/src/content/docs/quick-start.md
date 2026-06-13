---
title: Quick start
description: Scaffold a vsceasy extension, run it, and add your first feature.
---

## Prerequisites

- **Node.js** ≥ 18 (the project targets node 18 for the extension bundle).
- **bun** or **npm**. Examples use bun; npm works everywhere too.
- **VS Code** to launch the Extension Development Host.

## 1. Scaffold

```bash
bunx vsceasy create my-extension
cd my-extension
bun install
```

Or fully scripted:

```bash
bunx vsceasy create \
  --name my-extension \
  --displayName "My Extension" \
  --description "Does cool things" \
  --publisher my-publisher \
  --ui react \
  --preset full
```

`--preset full` includes a sample panel + RPC. `--preset minimal` gives an empty
extension.

## 2. Run it

```bash
bun run dev
```

This runs `gen` then builds the extension (esbuild) and webviews (vite) in watch
mode. Press **F5** in VS Code to launch the Extension Development Host with the
bundled launch config.

:::tip
First launch with no folder open is fine — the mini-ORM falls back to global
storage so activation never fails.
:::

## 3. Add a feature

```bash
# a webview panel with a ready-made form UI + RPC
vsceasy panel add --name signup --template form

# a palette command
vsceasy command add --name sayHello --title "Say Hello"
```

After a generator runs it executes `bun run gen` to wire the registry and
`contributes`. If that didn't run automatically, run it yourself:

```bash
bun run gen
```

## 4. Try the data stack

```bash
vsceasy db init
vsceasy model add --name user --fields "id:string!,name:string,email?:string@,active:boolean"
vsceasy crud add --model user --menu new:admin
```

You now have a list panel, a form panel, a service, and an activity-bar menu —
all typed end to end. Reload the window and open the **admin** menu.

## Prefer to be guided?

```bash
vsceasy wizard
```

The [wizard](/guides/wizard/) detects whether you're inside a project and walks
you through creating one or adding features.
