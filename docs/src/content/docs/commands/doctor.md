---
title: doctor
description: Diagnose a vsceasy project and optionally apply safe fixes.
---

Diagnose common project issues: scripts, RPC contracts, menu references,
codicons, and `contributes` sync.

```bash
vsceasy doctor
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--fix` | boolean | Apply the safe automatic fixes. |

## What it checks

- `package.json` scripts match the expected vsceasy set.
- RPC contracts in `shared/api.ts` line up with panel handlers.
- Menu items reference panels/commands that exist.
- Codicon names are valid.
- `package.json#contributes` is in sync with the files on disk.

```bash
# report only
vsceasy doctor

# report + apply safe fixes
vsceasy doctor --fix
```

Run it after manual edits, or when something doesn't show up after a `gen`.
