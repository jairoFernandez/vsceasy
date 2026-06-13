---
title: The wizard
description: A guided, context-aware flow for creating projects and adding features.
---

`vsceasy wizard` is the fastest way to get going. It detects whether you're inside
a vsceasy project and adapts.

```bash
vsceasy wizard
```

## Outside a project

It offers to scaffold one, prompting for name, display name, publisher, and
preset — the same result as [`create`](/commands/create/).

## Inside a project

It menus the common generators:

```text
? What do you want to add?
❯ Panel        webview + typed RPC
  Command      palette command
  Database     init the mini-ORM
  Model        entity + repo
  Helper       secrets/config/state/…
  Components    themed React UI library
  Something else…  show the full command list
```

- **Panel** → id, title, starter UI (`blank` / `form` / `list` / `dashboard`), RPC
  on/off.
- **Database** → provider (`storage` / `global`).
- **Model** → name + a field spec (`id:string!,name:string,…`).
- **Helper** → kind.
- **Components** → generates the component library.
- **Something else…** → prints the exact commands for everything not wired in.

Every choice delegates to the same library functions the standalone commands use,
so the wizard and the CLI produce identical output.

:::tip
Arrow keys move, type to filter long lists, Enter selects, Esc cancels.
:::
