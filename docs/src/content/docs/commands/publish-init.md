---
title: publish init
description: Prepare the project for the marketplace.
---

Marketplace preflight: ensure a README, CHANGELOG, icon placeholder, and the
required `package.json` fields, then run a dry-run `vsce ls`.

```bash
vsceasy publish init
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--skipDryPack` | boolean | Skip the `vsce ls` dry run. |

## What it checks / adds

- `README.md` and `CHANGELOG.md` (created if missing).
- An icon placeholder + `icon` field in `package.json`.
- Required publish fields (`publisher`, `repository`, `categories`, …).
- A dry-run package listing so you see exactly what would ship.

## Then package

```bash
bun run package     # builds prod + vsce package --no-dependencies
```

This produces a `.vsix` you can upload to the marketplace or install locally with
**Extensions: Install from VSIX…**.
