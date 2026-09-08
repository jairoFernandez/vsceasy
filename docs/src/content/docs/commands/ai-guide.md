---
title: ai-guide
description: Print a machine-readable spec of the whole CLI, for AI agents and tooling.
---

Print the full command surface — every command with its parameters, types,
defaults and options — in a form an agent or a script can consume directly.

```bash
vsceasy ai-guide
```

Point a coding agent at this when it is already working inside a project and
needs the exact command surface without fetching anything over the network. For
the conceptual documentation, use [`llms.txt`](/llms.txt) instead — the two are
complementary: `llms.txt` explains *what the framework is*, `ai-guide` states
*what you can run*.

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--format` | list | `json` (default) or `markdown`. |
| `--command` | text | Limit the output to a single top-level command. |
| `--pretty` | boolean | Pretty-print JSON. Ignored for markdown. |

## Scoping the output

The full JSON spec covers 21 commands and runs about 36 KB. When the agent only
needs one command, `--command` cuts that to a few KB:

```bash
vsceasy ai-guide --command panel   # ~4 KB instead of ~36 KB
```

## Markdown output

`--format markdown` emits the same spec as prose, which reads better when it is
being pasted into a chat rather than parsed:

```bash
vsceasy ai-guide --format markdown
```

## Piping into a parser

:::caution[Trailing banner]
The output ends with a "Star us on GitHub" banner printed to stdout *after* the
JSON, so piping straight into a parser fails with a JSON syntax error. Strip it
first:

```bash
vsceasy ai-guide | sed -n '1,/^}$/p' | jq
```
:::
