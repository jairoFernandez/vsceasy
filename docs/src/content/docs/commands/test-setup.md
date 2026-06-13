---
title: test setup
description: Add Vitest config and a sample test to the project.
---

Scaffold a test harness: Vitest config, a sample test, and vscode/RPC mock
helpers.

```bash
vsceasy test setup
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--force` | boolean | Overwrite existing test files. |

## What it generates

- A Vitest config.
- A sample test under `src/__tests__/`.
- Mock helpers for the `vscode` API and the RPC bridge, so you can unit-test
  panel handlers and services without a running extension host.

```bash
bun run test        # vitest run
bun run test:watch  # vitest
```
