---
title: Introduction
description: What vsceasy is, what it generates, and when to reach for it.
---

vsceasy is a CLI that scaffolds and grows VS Code extensions. It is **codegen**,
not a runtime you ship — your extension has no dependency on vsceasy at run time.
The CLI writes plain TypeScript + React into your project; you own and edit it.

:::tip[How to say it]
**vsceasy** is a blend of `VSC` (VS Code) and `easy`.

- **English:** "vee-see-easy"
- **Español:** "visici"

That's the whole pitch in the name: VS Code, made easy.
:::

## What you get

- **File-based routing.** One file per panel, command, menu, tree view,
  subpanel, or status bar item. A `gen` step scans the convention directories and
  writes `src/extension/_registry.ts` plus `package.json#contributes`.
- **Typed RPC.** A single interface in `src/shared/api.ts` types both the
  extension handlers and the webview client. Call `api.method(...)` — no manual
  message plumbing.
- **React webviews.** Panels and subpanels render React, themed with VS Code CSS
  variables. Optional UI templates (`form`, `list`, `dashboard`) start you from a
  working screen.
- **A mini-ORM.** `db init` + `model add` give you typed entities with a
  filesystem-backed store. `crud add` scaffolds a full list + form UI over a model.
- **Editor-surface primitives.** Completions, ghost text, hovers, typing guards
  (intercept keystrokes, paste and deletions), decorations, and terminals — the
  same one-file-per-feature convention. See
  [Editor surface](/guides/editor-surface/).
- **A built-in LLM client.** Ollama or any OpenAI-compatible endpoint over
  `fetch`, with streaming, JSON mode, model auto-resolution and settings-driven
  configuration. No SDK dependency. See [The LLM client](/guides/llm/).
- **Operational helpers.** Jobs (interval / daily / event / file watch), runtime
  helpers (secrets, config, state, notifications, cache, colorize), a test
  harness, and publish tooling.

## When to use it

Reach for vsceasy when you're building a webview-heavy extension and want to skip
the boilerplate: panel registration, the RPC bridge, the build pipeline, and the
`contributes` bookkeeping. You stay in plain VS Code APIs everywhere it matters —
vsceasy just removes the repetitive wiring.

It isn't only for webviews. `create --type language` scaffolds a full
[language extension](/guides/language-extensions/) (grammar, snippets, file icon,
scoped colors) with no React at all, and `--type empty` gives you a bare
extension with the same file-based routing. See the
[showcase](/showcase/) for one of each.

## How it fits together

```mermaid
flowchart LR
  CLI["vsceasy CLI"] -->|scaffolds| PROJ["your extension"]
  PROJ --> GEN["bun run gen"]
  GEN --> REG["_registry.ts"]
  GEN --> CONTRIB["package.json#contributes"]
  REG --> BOOT["bootstrap(registry)"]
  BOOT --> VSCODE["VS Code on activate"]
```

Next: [Quick start](/quick-start/) to scaffold a project, or
[Concepts](/concepts/) for the mental model.
