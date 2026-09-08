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

## LLM-readable docs

`starlight-llms-txt` emits three plain-text files at build time, following the
[llms.txt](https://llmstxt.org/) convention, so coding agents can read the whole
documentation in one fetch instead of crawling the site:

| File             | Contents                                                        |
| ---------------- | --------------------------------------------------------------- |
| `/llms.txt`      | Index: project summary plus links to the two dumps below         |
| `/llms-full.txt` | Every page, concatenated                                         |
| `/llms-small.txt`| Same, minus the tutorial (see `exclude` in `astro.config.mjs`)   |

They regenerate on every `bun run build` — nothing to maintain by hand. New
pages are picked up automatically.

The plugin runs with `rawContent: true`, which emits the source Markdown rather
than rendering each page to HTML first. That keeps ` ```mermaid ` blocks as
readable diagram source and avoids rendering the React demos embedded in the
`.mdx` pages, which have no renderer available in that route. The cost is that
raw MDX component tags (`<Card>`, `<CardGrid>`) appear in the output.
