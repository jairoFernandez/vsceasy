---
title: Roadmap
description: Where vsceasy is headed, what's shipped, and how to contribute to the next release.
---

This page is the public view of where **vsceasy** is going. It is intentionally
high-level — the source of truth for shipped work is [CHANGELOG.md](https://github.com/jairoFernandez/vsceasy/blob/main/CHANGELOG.md),
and for in-flight work it is the [issue tracker](https://github.com/jairoFernandez/vsceasy/issues).

:::note[Status]
**v0.1 — stable but pre-1.0.** The generated code and the runtime API may still
change between minor versions. Pin a version in CI and read the changelog before
upgrading. We aim to keep `vsceasy upgrade` able to migrate generated projects
across breaking changes.
:::

## Guiding principles

These don't change release to release — they're the lens we use to accept or
reject every feature.

- **Codegen, not a framework you ship.** vsceasy writes plain TypeScript + React
  into your project. Your extension never depends on vsceasy at run time. If a
  feature would force a runtime dependency, it has to justify itself hard.
- **You own the output.** Generated code is readable, editable, and yours. No
  hidden magic, no lock-in. Re-running a generator should never clobber your edits.
- **Stay close to the VS Code API.** We remove boilerplate (registration, the RPC
  bridge, the build pipeline, `contributes` bookkeeping) — not the platform. You
  keep using real `vscode.*` APIs everywhere it matters.
- **One file = one feature.** File-based routing stays the core mental model.
- **Every generator is tested.** A feature without generator tests doesn't ship.

## Shipped (v0.1)

For the full list see the [changelog](https://github.com/jairoFernandez/vsceasy/blob/main/CHANGELOG.md).
The headlines:

- **Scaffolding** — `create` (with post-scaffold git init + dep install), presets,
  and the interactive [wizard](/guides/wizard/).
- **File-based routing** — panels, commands, menus, tree views, subpanels, status
  bar items, RPC handlers; a `gen` step writes the registry + `contributes`.
- **Typed RPC** — one shared interface types both sides of the bridge. See the
  [RPC guide](/guides/rpc/).
- **React webviews** + a [component library](/guides/components/) themed with VS
  Code tokens.
- **Mini-ORM** — [`db init`](/commands/db-init/), [`model add`](/commands/model-add/),
  [`crud add`](/guides/crud/), with [relations](/guides/relations/) (`ref(Model)`)
  and [reactivity](/guides/reactivity/) (`watch` / `listen` / stores).
- **Operational helpers** — [jobs](/commands/job-add/) (interval / daily / event /
  file watch), runtime [helpers](/commands/helper-add/) (secrets, config, state,
  notifications, cache), a [test harness](/commands/test-setup/), and
  [publish tooling](/guides/publishing/).
- **Maintenance** — [`doctor`](/commands/doctor/) checks and
  [`upgrade`](/commands/upgrade/) migrations.

## In progress / next

Targeted for upcoming **0.1.x** and **0.2** releases. Order is rough, not a
commitment. Each item links to its tracking issue once one exists — if you want
one, open it.

### Data layer

- **SQLite provider for the ORM.** The provider interface was designed to host a
  real database next to the filesystem JSON store. SQLite is the first target.
- **Richer relations.** Today `ref(Model)` is ManyToOne only (FK on this model,
  no join table, no cascade). OneToMany / ManyToMany and cascade options are the
  natural next step.
- **Migrations.** A story for evolving entity shapes once a row store exists.

### UI

- **More webview UI options.** v0.1 ships React only (Svelte/Vue/Vanilla were
  intentionally dropped to focus the first release). Re-introducing additional
  UI targets is on the table once the React surface is stable.
- **More component primitives** in the generated component library.

### DX & tooling

- **More `doctor` checks** as common misconfigurations surface from real use.
- **Tighter `upgrade` migrations** so generated projects can cross breaking
  changes without hand-editing.
- **Better error messages** across generators — keep quoting the exact target
  path and naming what to create.

:::tip[Want something not listed?]
The roadmap is shaped by what people build. Open an
[issue](https://github.com/jairoFernandez/vsceasy/issues) describing the
extension you're trying to ship and where vsceasy got in your way. Concrete
use cases beat abstract feature requests.
:::

## How to contribute

vsceasy is MIT-licensed and contributions are welcome. The full setup lives in
[CONTRIBUTING.md](https://github.com/jairoFernandez/vsceasy/blob/main/CONTRIBUTING.md);
here's the shape of it.

### Get the repo running

```bash
git clone https://github.com/<your-fork>/vscode-extension-framework
cd vscode-extension-framework
bun install
bun test
bun run build
bun run start <command>   # run the CLI from source
```

### Where things live

```
src/
├── commands/<group>/   # CLI command definitions (param parsing, UX)
├── lib/<feature>/      # generators (pure functions; no CLI deps)
└── tests/              # bun test suites mirroring lib/ and commands/
packages/
└── vsceasy-runtime/    # standalone runtime — the source of truth, copied into the template
templates/
├── react/              # the project template `create` copies
└── _generators/        # snippet templates for `<group> add` commands
```

The runtime template under `templates/react/src/shared/vsceasy/` is
**regenerated** by `bun run sync:runtime`. Edit the canonical copy under
`packages/vsceasy-runtime/src/` — never the mirror.

### Adding a generator

The repeatable pattern for almost every feature:

1. Snippet template → `templates/_generators/<feature>/`.
2. Pure generator → `src/lib/<feature>/add.ts`
   — signature `(opts, projectRoot, templatesRoot) => { created: string[] }`.
3. CLI command → `src/commands/<feature>/add.ts` (param defs + a thin call into
   the generator).
4. Wire it into its group → `src/commands/groups.ts`.
5. Test the generator → `src/tests/lib/<feature>.test.ts` (use temp dirs, never
   the real cwd).
6. Update the [changelog](https://github.com/jairoFernandez/vsceasy/blob/main/CHANGELOG.md)
   (under `[Unreleased]`) and the docs.

### Ground rules

- **Conventional Commits** (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).
- **One logical change per PR**, with tests. PRs must keep `bun test` green.
- **No new runtime dependencies without discussion** — we rely on
  `@ideascol/cli-maker` only.
- **TypeScript strict mode**; run `bun run lint` and `bun run format` first.

### Good first contributions

- A new [`doctor`](/commands/doctor/) check for a misconfiguration you hit.
- A new component for the [component library](/guides/components/).
- Docs fixes — wrong path, stale flag, a guide that didn't match what the CLI did.
- A generator test covering an edge case (duplicate names, odd field specs).

These touch one area, have a clear test pattern to copy, and get you through the
build/test loop without needing the whole architecture in your head.
