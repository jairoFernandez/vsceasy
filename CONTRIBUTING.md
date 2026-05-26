# Contributing

Thanks for hacking on **vsceasy**.

## Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- Node ≥ 24.11.1
- VS Code (for testing generated extensions)

## Dev setup

```bash
git clone https://github.com/<your-fork>/vscode-extension-framework
cd vscode-extension-framework
bun install
bun test
bun run build
```

Run the CLI from source:

```bash
bun run start <command>            # equivalent to ./dist/bin/cli.js
# or link globally
bun link && vsceasy <command>
```

## Project layout

```
src/
├── bin/cli.ts          # binary entry
├── cli.ts              # CLI wiring (commands → groups)
├── commands/<group>/   # CLI command definitions (param parsing, UX)
├── lib/<feature>/      # generators (pure functions; no CLI deps)
├── data/codicons.ts    # codicon list (regenerated via `bun run gen:types`)
└── tests/              # bun test suites mirroring lib/ and commands/
templates/
├── react/              # the project template copied by `create`
└── _generators/        # snippet templates used by `<group> add` commands
```

## Adding a generator

1. Snippet template → `templates/_generators/<feature>/`.
2. Pure generator → `src/lib/<feature>/add.ts` (signature: `(opts, projectRoot, templatesRoot) => { created: string[] }`).
3. CLI command → `src/commands/<feature>/add.ts` (param defs + thin call into the generator).
4. Wire into the group → `src/commands/groups.ts`.
5. Test the generator → `src/tests/lib/<feature>.test.ts` (use temp dirs, never the real cwd).
6. Update [README.md](./README.md) and [CHANGELOG.md](./CHANGELOG.md).

## Tests

```bash
bun test                  # all
bun test src/tests/lib    # generator unit tests
bun test src/tests/cli    # end-to-end CLI tests
```

Every PR must keep all tests green. New generator features need new tests.

## Style

- TypeScript strict mode (`tsconfig.base.json`).
- ESLint + Prettier — `bun run lint` and `bun run format` before committing.
- No new runtime dependencies without discussion. We rely on `@ideascol/cli-maker` only.

## Commits & PRs

- [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `refactor:`, `docs:`, `test:`).
- One logical change per PR. Update `CHANGELOG.md` under `[Unreleased]`.
- Reference an issue when relevant.

## Releases

Maintainers only:

```bash
bun run release:patch    # or release:minor / release:major
git push --follow-tags
```

CI publishes to npm on tag push.
