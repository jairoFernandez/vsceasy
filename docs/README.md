# vsceasy docs

Documentation site for vsceasy, built with [Astro](https://astro.build) +
[Starlight](https://starlight.astro.build).

This is a **standalone subproject**. It is not part of the CLI build and is never
published to npm (the root `package.json#files` whitelist excludes it).

## Develop

```bash
cd docs
bun install
bun run dev      # http://localhost:4321
```

## Build

```bash
bun run build    # outputs to docs/dist/
bun run preview  # serve the built site locally
```

## Structure

```
docs/
├── astro.config.mjs        # site + sidebar config
├── src/
│   ├── content.config.ts   # Starlight content collection
│   └── content/docs/       # all pages (Markdown / MDX)
│       ├── *.md            # top-level pages
│       ├── guides/         # task guides
│       └── commands/       # one page per CLI command
└── public/                 # static assets
```

Add a page by creating a `.md` file under `src/content/docs/` and listing its
slug in `astro.config.mjs` under `sidebar`.
