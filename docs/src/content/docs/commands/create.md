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
| `--ui` | `react` | UI framework. Only `react` for now. |
| `--preset` | `minimal` \| `full` | `full` (default) adds a sample panel + RPC; `minimal` is empty. |
| `--dir` | text | Target directory. Defaults to `./<name>`. |
| `--git` | boolean | Initialize a git repository. Skips the prompt; set `--git=false` to opt out. |
| `--install` | boolean | Install dependencies (bun, falling back to npm). Skips the prompt; set `--install=false` to opt out. |

## Examples

```bash
# interactive — prompts for the rest
vsceasy create my-extension

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

See [Quick start](/quick-start/) for the full first-run walkthrough.
