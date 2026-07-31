---
title: create
description: Scaffold a new VS Code extension project.
---

Scaffold a new vsceasy extension project into `./<name>` (or `--dir`).

```bash
vsceasy create my-extension
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--name` | text | **Required.** Package name, e.g. `my-extension` or `@scope/my-ext`. |
| `--displayName` | text | Human-readable name. Defaults to a title-cased name. |
| `--description` | text | Short description. |
| `--publisher` | text | VS Code publisher id. Defaults to `your-publisher`. |
| `--type` | `ui` \| `language` \| `empty` | Extension shape. Prompts when omitted in a terminal; defaults to `ui`. |
| `--ui` | `react` | UI framework. Only `react` for now. `--type ui` only. |
| `--preset` | `minimal` \| `full` | `full` (default) adds a sample panel + RPC; `minimal` is empty. `--type ui` only. |
| `--dir` | text | Target directory. Defaults to `./<name>`. |
| `--git` | boolean | Initialize a git repository. Skips the prompt; set `--git=false` to opt out. |
| `--install` | boolean | Install dependencies (bun, falling back to npm). Skips the prompt; set `--install=false` to opt out. |

## Extension types

`--type` picks the shape of the project. Run `create` without it in a terminal
and it asks.

| Type | You get |
| ---- | ------- |
| `ui` (default) | React webview + typed RPC + Vite build + a sample panel (`--preset full`). |
| `language` | Grammar, language configuration, snippets, file icon theme, scoped token colors, `contributes.extra.json`. No React. |
| `empty` | Bare `activate` / `deactivate`. No React, no Vite, no sample panel. |

`language` and `empty` strip React, Vite and the `dev:ui` / `build:ui` scripts
from `package.json` — the extension build, `gen`, and every convention directory
stay, so you can add a panel later with [`panel add`](/commands/panel-add/).

See [Language extensions](/guides/language-extensions/) for what the language
scaffold contains and how to grow it.

## Examples

```bash
# interactive — prompts for the type and the rest
vsceasy create my-extension

# a language extension (syntax + snippets + icon + scoped colors)
vsceasy create my-lang --type language

# a bare extension, no UI
vsceasy create my-tool --type empty

# fully scripted
vsceasy create \
  --name my-extension \
  --displayName "My Extension" \
  --publisher my-publisher \
  --ui react \
  --preset full

# scoped name, custom directory
vsceasy create --name @acme/cool-tool --dir tools/cool
```

## After scaffolding

When run in an interactive terminal, `create` then offers to:

- **Initialize a git repository** (`git init` in the project).
- **Install dependencies** with the first available package manager (`bun`, falling back to `npm`).

Both default to yes. Pass `--git` / `--install` (or `--git=false` / `--install=false`) to skip the prompts — handy for scripting and CI:

```bash
vsceasy create --name my-extension --preset full --git --install
```

In non-interactive contexts (CI, piped input) without those flags the prompts are skipped and you run the steps yourself:

```bash
cd my-extension
bun install
bun run dev      # press F5 in VS Code
```

For `--type language` the first run is `gen` first, since the contributions come
from `contributes.extra.json`:

```bash
cd my-lang
bun install
bun run gen       # merge contributes.extra.json into package.json#contributes
bun run launch    # open the dev host and open a matching file
```

See [Quick start](/quick-start/) for the full first-run walkthrough.
