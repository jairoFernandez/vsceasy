---
title: components add
description: Generate a theme-aware React component library for webviews.
---

Write a small library of theme-aware React components into
`src/webview/components/`, styled with VS Code theme tokens. Panel
[`--template`](/commands/panel-add/) UIs import from here.

```bash
vsceasy components add
```

## Flags

| Flag | Type | Notes |
| ---- | ---- | ----- |
| `--force` | boolean | Overwrite existing component files. Idempotent without it. |

## What it generates

`src/webview/components/` with `Button`, `Input`, `Field`, `Card`, `List`, a
barrel `index.ts`, and `components.css`.

```tsx
import { Button, Input, Field, Card, List } from '../../components';
import '../../components/components.css';

<Card title="New entry">
  <Field label="Name" htmlFor="name">
    <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
  </Field>
  <Button type="submit">Save</Button>
</Card>
```

Everything is styled with `var(--vscode-*)` tokens, so components match the
user's theme in light and dark mode. See [Webview components](/guides/components/).
