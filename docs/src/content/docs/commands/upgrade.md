---
title: upgrade
description: Sync framework-owned files from the bundled templates.
---

Sync the framework runtime (`src/shared/vsceasy/*`, `scripts/gen.ts`, and similar)
from the bundled templates. Dry-run by default.

```bash
vsceasy upgrade
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--apply` | boolean | Apply the changes. Without it, upgrade is a dry run. |
| `--ui` | text | UI variant subfolder. Default `react`. |

## What it does

Compares your framework-owned files against the version shipped with the CLI and
reports each as `in-sync`, `would-create`, or `would-update`. With `--apply` it
writes the updates and runs `gen` if anything changed.

```bash
# preview what would change
vsceasy upgrade

# apply the updates
vsceasy upgrade --apply
```

:::caution
Upgrade only touches **framework-owned** files (`src/shared/vsceasy/*`,
`scripts/gen.ts`). Your panels, commands, models, and webviews are never
modified.
:::
