---
title: wizard
description: Interactive guided flow — create a project or add features step by step.
---

The wizard detects whether you're inside a vsceasy project and guides you
accordingly. It takes no flags — it asks.

```bash
vsceasy wizard
```

## What it does

- **Outside a project** → walks you through [`create`](/commands/create/): name,
  display name, publisher, preset.
- **Inside a project** → menus the common generators: panel, command, database,
  model, helper, components. Anything not wired into the wizard is listed as the
  exact command to run.

It reuses the same library functions the individual commands call, so the result
is identical to running the commands directly.

## Example session

```text
vsceasy — interactive wizard
Project: .

? What do you want to add?
❯ Panel        webview + typed RPC
  Command      palette command
  Database     init the mini-ORM
  Model        entity + repo
  Helper       secrets/config/state/…
  Components    themed React UI library
  Something else…  show the full command list
```

Picking **Panel** asks for an id, title, a starter UI
(`blank` / `form` / `list` / `dashboard`), and whether to generate the RPC API.

See the [wizard guide](/guides/wizard/) for the full flow.
