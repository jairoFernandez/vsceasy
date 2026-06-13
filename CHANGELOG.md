# Changelog

All notable changes follow [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
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

## [0.0.1] — 2026-05-21

- Initial MVP. React template, typed RPC bridge, file-based registry, CLI generators (`panel`, `command`, `menu`, `rpc`, `statusBar`, `subpanel`), `doctor`, `upgrade`.
