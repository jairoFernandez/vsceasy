# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **Model relations — `ref(Model)` fields with populated CRUD dropdowns.** Symfony-`make:entity`-style relations.
  - `vsceasy model add --fields "…,category:ref(Category)"` emits a `categoryId` foreign key plus a `<Name>Relations` metadata block. `ref(Category, label=name)` picks the dropdown label field. The referenced model must exist (errors otherwise, naming what to create); the interactive loop lists relatable models.
  - `crud add` reads the relation metadata and generates a populated `<select>`: an `options()` RPC handler on the form panel loads the related rows, and the form webview renders a dropdown of them and stores the chosen id. Non-relational CRUD output is unchanged.
  - ManyToOne only (FK on this model) — no join table or cascade. See the [Relations guide](https://vsceasy.dev/guides/relations/).
- **Reactivity — keep a webview in sync with data.** A visual element can now track a source and update the instant it changes, no manual refresh.
  - ORM entities fire change events on every mutation; subscribe with `watchEntity(Todos, () => emit('todos:changed'))` from your generated `db.ts`.
  - `defineStore(initial)` — a framework-agnostic observable value (`get`/`set`/`update`/`subscribe`) for non-ORM state. Scaffold one with **`vsceasy store add --name X --type number|string|boolean|json`**.
  - `watch(source, effect)` (host) bridges a store/entity to an RPC emit; `listen(api, topic, cb)` (webview) runs a callback when the event arrives. Both return an unsubscribe.
  - Panel/subpanel `rpc` factories receive a third arg, `emit`, for pushing events to their own webview. (Reuses the existing RPC event channel — no transport change.)
  - See the [Reactivity guide](https://vsceasy.dev/guides/reactivity/) and tutorial step 8.
- **`vsceasy create` post-scaffold setup** — after generating the project, `create` now offers to **initialize a git repository** (`git init`) and **install dependencies** (`bun`, falling back to `npm`). Both prompts default to yes in an interactive terminal. New `--git` / `--install` flags (and `--git=false` / `--install=false`) skip the prompts for scripting/CI. Non-interactive runs without the flags skip both, as before.
- **`vsceasy job add`** — scaffold recurring / event-triggered jobs into `src/jobs/`. Schedules: `--every "60s"`, `--dailyAt "09:00"`, `--on startup|saveDocument|openDocument|changeActiveEditor|changeConfig`, `--onFile "**/*.md"`. Optional `--minIntervalMs` throttles re-runs via globalState. Runtime (`bootstrap`) auto-registers timers/listeners + cleanup on deactivate, catches errors so they don't crash the host.
- **`command add --when <expr>`** — declare VS Code `when` clauses on commands. Auto-written to `contributes.commands[].enablement` and `contributes.menus.commandPalette` by `bun run gen`. Enables context-aware visibility (e.g. `editorTextFocus`, `resourceLangId == typescript`).
- **`vsceasy helper add <kind>`** — generate typed runtime wrappers in `src/helpers/`:
  - `secrets` — `context.secrets.{get,set,delete}` typed and lazily initialized.
  - `config` — `getConfiguration('<prefix>')` with `get<T>` / `set` / `onChange`.
  - `state` — workspace + global memento with typed `get`/`set`/`delete`.
  - `notifications` — `notify.{info,warn,error,confirm}` + `withProgress`.
  - `cache` — in-memory TTL + LRU cache (`createCache({ ttlMs, max })`) with `wrap(key, fn)` memoization, in-flight de-dupe, and `refresh(key, fn)`. Pairs with the ORM for cheap reads.
- **`vsceasy db init`** — scaffold the project database at `src/helpers/db.ts` (idempotent). Exposes `initDb(ctx)` + `db()` singleton + `defineEntity<T>()`. Filesystem JSON provider out of the box (`--provider storage|global`). Provider interface designed to host SQLite/etc. next.
- **`vsceasy crud add --model X`** — Rails-style scaffold: reads `src/models/X.ts`, generates `src/services/XService.ts`, `src/panels/{xsList,xForm}.ts`, React webview bundles, and appends `XsListApi` + `XFormApi` to `src/shared/api.ts`. Auto-renders inputs by TS type (number, boolean, Date, literal union → select, string → text). Optional menu wiring (none / existing / new). Optional `src/models/X.crud.ts` overrides labels, hidden fields, field order, and input kinds per field.
- **`vsceasy model add --name X`** — typed entity + repo under `src/models/X.ts`. Interactive field loop (`name:type` per line, empty to finish) or compact flag spec `--fields "id:string!,email?:string@,score:number"`. Flags: `!` = primaryKey, `@` = indexed, `?` after name = optional. Generates `interface X`, `export const Xs = defineEntity<X>(...)`, and `export const XsRepo = () => db()(Xs)`. Requires `db init` first.

### Removed
- `vsceasy helper add --kind orm` — replaced by `vsceasy db init` for clearer UX.
- **Webview RPC call timeout** (`createRpcClient(transport, { callTimeoutMs })`, default 15s) — rejects pending calls when the extension host reloads mid-flight, preventing infinite hangs during `bun run dev`.
- **`webviewState<T>(defaults)`** helper exported from `vsceasy-runtime` — typed wrapper over `vscode.getState/setState`. Persists scroll position, form data, selection across panel hide/show and host reloads.
- **Doctor checks (3 new):**
  - `activationEvents` — flags redundant `onCommand:` entries (VS Code ≥1.74 auto-activates).
  - `icon` — validates `package.json#icon` exists on disk, is PNG, ≥128×128, square.
  - `gen-script` — detects outdated `scripts/gen.ts` (missing `TREE_VIEWS_DIR`, `commandPalette`) and suggests `vsceasy upgrade --apply=true`.
- **Test helpers** — `vsceasy test setup` now drops `src/__tests__/_helpers.ts` exporting `mockVscode()`, `mockContext()`, `mockRpcPair<H>()` for unit-testing handlers end-to-end.
- `vsceasy.config.ts` — persistent project defaults (publisher, commandPrefix, defaultCategory, defaultIcon). Auto-written by `create`; consumed by `command add` (category) and `menu add` (icon).
- **New package: `vsceasy-runtime`** — the framework runtime (`bootstrap`, `define*`, RPC bridge) extracted as a standalone npm package. Single source of truth at `packages/vsceasy-runtime/src/`; the bundled template is now kept in sync via `bun run sync:runtime`. Allows external consumers to import the runtime without scaffolding a full project.
- `treeview add` — scaffold native VS Code tree views with `getChildren`/`getTreeItem` handlers and auto-registered `views` contribution.
- `create --preset minimal|full` — `minimal` ships only extension entry + one command; `full` includes panel + tree view + subpanel + RPC sample.
- `test:setup` — adds Vitest config and a sample panel test inside a generated project.
- `.vscode/launch.json` autogenerated by `vsceasy create` (Extension Development Host launch).
- `publish --init` — generates marketplace metadata (icon placeholder, README sections, CHANGELOG), runs `vsce ls` for a publish dry-run.
- Input validation across generators: duplicate name detection, identifier format checks, helpful error messages quoting target paths.
- ESLint + Prettier configs and `lint` / `format` scripts.

### Changed
- Bumped to **0.1.0** — first signed/tagged release.
- Dropped Svelte/Vue/Vanilla mentions from docs and CLI options. Only React UI is supported in this release.

### Fixed
- **`crud add --menu` flag parsing** — passing a raw policy string (`--menu none`, `--menu new:<id>`, `--menu existing:<id>`) non-interactively was mis-mapped to `existing:<literal>`, so `--menu none` failed with `Menu not found: src/menus/none.ts`. The flag forms now work the same as the interactive choices (which was already the documented behavior).
- **Generated CRUD form wiped on reveal** — the scaffolded form panel re-ran its loader on every focus/visibility change. With no row pending it reset to an empty "New" form, discarding whatever the user was typing (e.g. ticking a boolean then losing focus). The loader now only resets on the initial mount; later reveals adopt a newly-requested edit row but otherwise leave the in-progress form untouched. Re-run `crud add` (or pull the change into existing `*/App.tsx` form panels) to pick up the fix.
- **Generated CRUD date fields didn't prefill when editing** — `<input type="date">` only accepts a `yyyy-MM-dd` value, but stored dates are ISO strings (or `Date` objects), so editing a row showed the date field blank. The generated form now normalizes through a `toDateInput()` helper. Re-run `crud add` (or add the helper to existing form panels) to pick up the fix.

## [0.0.1] — 2026-05-21

- Initial MVP. React template, typed RPC bridge, file-based registry, CLI generators (`panel`, `command`, `menu`, `rpc`, `statusBar`, `subpanel`), `doctor`, `upgrade`.
