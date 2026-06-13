---
title: Glossary
description: Plain-language definitions of the terms used across the vsceasy docs.
---

Quick reference for the vocabulary used throughout these docs. Terms link to the
guide that covers them in full.

## RPC (Remote Procedure Call)

A way for the webview (React UI) to call functions that run in the extension
host as if they were local async functions — no manual `postMessage` plumbing.
In vsceasy the contract is a single **typed** TypeScript interface shared by both
sides, so calls are checked at compile time. See [Typed RPC](/guides/rpc/).

```ts
const api = connectWebview<DashboardApi>();
const stats = await api.getStats(); // typed call across the bridge
```

## Webview

A sandboxed browser frame VS Code renders inside the editor or sidebar. vsceasy
runs your React UI inside it. The webview cannot touch the VS Code API or the
filesystem directly — it reaches the extension host through [RPC](#rpc-remote-procedure-call).

## Extension host

The Node.js process where your extension code runs. It has full access to the
VS Code API, the filesystem, and secrets. The counterpart to the
[webview](#webview).

## Panel

A webview that opens in the editor area. Defined by a file in `panels/` with
`definePanel`. Each panel auto-registers an `<prefix>.open<Name>` command. See
[Concepts](/concepts/).

## Subpanel

A webview section rendered **inline** inside a menu's activity-bar container,
instead of opening in the editor area like a panel. Defined in `subpanels/`.

## Command

A palette action (the `Cmd/Ctrl+Shift+P` list). A file in `commands/` with
`defineCommand` registers the command plus any keybindings.

## Menu

An activity-bar container (the icons down the left side) that holds tree views
and subpanels. Defined in `menus/` with `defineMenu`.

## Tree view

A data-driven list/tree rendered inside a menu container. Defined in
`treeViews/` with `defineTreeView`.

## Status bar item

A widget in the bottom status bar. Defined in `statusBars/` with
`defineStatusBar`.

## Convention directory

A directory whose name maps to a feature type (`panels/`, `commands/`,
`menus/`, …). Dropping a file into it **is** how you declare that feature — no
central registration list to edit. See [Concepts](/concepts/).

## The gen step

`scripts/gen.ts` — scans the convention directories and writes the generated
[registry](#registry) and the `package.json#contributes` block, keeping both in
sync with the files on disk. Run with `bun run gen`; generators run it for you.

## Registry

`src/extension/_registry.ts` — a generated, typed map of every feature found on
disk. Produced by [the gen step](#the-gen-step) and consumed by
[bootstrap](#bootstrap). You don't edit it by hand.

## contributes

The `contributes` block in `package.json` — VS Code's manifest of commands,
keybindings, view containers, and views. vsceasy generates and maintains it from
your files rather than asking you to hand-edit it.

## Bootstrap

`bootstrap(registry)` — the one-liner in `extension.ts` that registers
everything from the generated [registry](#registry) on activate. `onActivate`
hooks (e.g. `initDb`, `initSecrets`) run once at activation.

## Codegen

Code generation. vsceasy is codegen, not a runtime you ship — it writes plain
TypeScript + React into your project, and your built extension has **no runtime
dependency** on vsceasy. See [Introduction](/introduction/).

## Mini-ORM

The small, typed, filesystem-backed data store vsceasy ships. The bundled
provider writes each entity to a JSON file under the extension's storage dir;
swapping the provider doesn't change your entity definitions or call sites. See
[The mini-ORM](/guides/orm/).

## Model / Entity

A typed record definition (e.g. `User`) created with `vsceasy model add`. Lives
in `models/` and is persisted through the [mini-ORM](#mini-orm).

## CRUD

Create, Read, Update, Delete — the four basic operations on a record. `vsceasy
crud add` scaffolds a panel + RPC that perform them against a
[model](#model--entity). See [CRUD scaffolding](/guides/crud/).

## Helper

A generated typed wrapper for a common runtime concern — `secrets`, `config`,
`state`, `notifications`, or `cache` — written into `src/helpers/`. Added with
`vsceasy helper add`.

## Job

A unit of work that runs on a schedule (`--every 30s`) or in response to an
event. Added with `vsceasy job add`.

## Provider

A swappable backend behind an abstraction. The [mini-ORM](#mini-orm) has a
storage provider; the database can target per-workspace `storage` or shared
`global` storage.
