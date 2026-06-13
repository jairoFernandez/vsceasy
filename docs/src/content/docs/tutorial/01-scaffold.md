---
title: "1. Scaffold the project"
description: Create the Todo extension project and understand every generated file.
---

We start from an empty extension and grow it. The `minimal` preset gives us a
clean slate — no sample panel to delete later.

## Run it

```bash
vsceasy create \
  --name todo-demo \
  --displayName "Todo Demo" \
  --description "A todo list built with vsceasy" \
  --publisher demo \
  --ui react \
  --preset minimal
```

Output:

```text
✓ Created todo-demo at todo-demo

Next steps:
  cd todo-demo
  bun install
  bun run launch        # builds + opens Extension Development Host
```

`create` then asks whether to **init git** and **install dependencies**. Say yes
to both (or pass `--git --install` to skip the prompts). Then:

```bash
cd todo-demo
```

## What got generated

```text
todo-demo/
├─ .vscode/launch.json        F5 launches the Extension Development Host
├─ package.json               extension manifest + build scripts
├─ vsceasy.config.ts          per-project defaults (publisher, ui, …)
├─ scripts/gen.ts             the code generator (`bun run gen`)
├─ vite.config.ts             builds the React webviews
└─ src/
   ├─ extension/extension.ts  the activate() entry point
   ├─ commands/hello.ts       one sample command
   ├─ webview/styles.css      shared webview styling
   └─ shared/
      ├─ api.ts               RPC contracts (empty for now)
      └─ vsceasy/             the runtime (bootstrap, rpc, define, client)
```

The pieces worth knowing up front:

| File | What it does |
| ---- | ------------ |
| `src/extension/extension.ts` | Calls `bootstrap(registry)` — the single activate hook. You rarely edit it. |
| `src/shared/vsceasy/` | The vendored runtime: `definePanel`, `defineJob`, the typed RPC bridge, the webview client. Generators import from here. |
| `src/shared/api.ts` | One TypeScript interface per panel. This is the **contract** shared by the extension host and the React UI — the source of end-to-end type safety. |
| `scripts/gen.ts` | Scans `src/panels`, `src/commands`, `src/menus`, `src/jobs`, builds a registry, and writes the `contributes` block of `package.json`. You run it via `bun run gen`. |

Nothing here is locked away — every generated file lands in your `src/` and is
yours to edit.

## The build scripts

`package.json` ships a handful of scripts you'll use:

| Script | Purpose |
| ------ | ------- |
| `bun run gen` | Regenerate the registry + `package.json` contributions. Run after adding panels/commands/jobs. |
| `bun run dev` | Watch-build the extension and webviews. Press **F5** in VS Code for the dev host. |
| `bun run launch` | One-shot build + open the Extension Development Host in a new window. |

:::note
`create` requires `--name`; it has **no** positional argument
(`vsceasy create todo-demo` errors). All other fields fall back to sensible
defaults or prompts.
:::

Next: [add the database and the Todo model →](/tutorial/02-model/)
