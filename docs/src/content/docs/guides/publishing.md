---
title: Publishing
description: Prepare and package your extension for the marketplace.
---

## Preflight

```bash
vsceasy publish init
```

This ensures a README, CHANGELOG, an icon placeholder, the required
`package.json` fields, and runs a dry-run `vsce ls` so you see exactly what would
ship. See [`publish init`](/commands/publish-init/).

## Package

```bash
bun run package
```

Builds a production bundle (`build:prod`) and runs `vsce package
--no-dependencies`, producing a `.vsix`.

## Install locally

Test the packaged extension before publishing:

- In VS Code: **Extensions: Install from VSIX…** and pick the generated file.
- Or `code --install-extension your-extension-x.y.z.vsix`.

## Publish

Use the [vsce](https://github.com/microsoft/vscode-vsce) CLI with a publisher
token:

```bash
npx vsce publish
```

:::caution
Make sure `publisher` in `package.json` matches a publisher you control on the
marketplace, and bump the `version` before each publish.
:::

## Checklist

- [ ] `publisher`, `version`, `repository`, `categories` set
- [ ] icon present and referenced
- [ ] README + CHANGELOG accurate
- [ ] `vsceasy doctor` is clean
- [ ] tested the `.vsix` locally
