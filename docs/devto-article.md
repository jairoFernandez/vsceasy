---
title: "Build VS Code Extensions Fast with vsceasy"
published: false
description: "vsceasy scaffolds VS Code extensions with a React webview, a typed RPC bridge, and zero-config builds — so you write features, not boilerplate."
tags: vscode, javascript, typescript, react
cover_image: "https://dev-to-uploads.s3.amazonaws.com/uploads/articles/yk8elbwamrrwhbqewrpj.jpg"
---

![vsceasy promo](https://dev-to-uploads.s3.amazonaws.com/uploads/articles/s305i7n7jla1acvzbolt.gif)

*[▶ Watch the full 30-second promo (MP4)](https://github.com/jairoFernandez/vsceasy/releases/download/promo-assets/vsceasy-promo.mp4)*

If you've ever tried to build a VS Code extension with a UI, you know the pain: hand-wiring `postMessage` channels between the extension host and the webview, stringly-typed messages, a fragile build setup, and a `package.json#contributes` block that grows into a swamp.

[**vsceasy**](https://github.com/jairoFernandez/vsceasy) (pronounced *"vee-see-easy"*) removes that boilerplate. It scaffolds extensions with a React UI, a **typed RPC bridge** between extension and webview, and a **zero-config build** — so you spend time on features, not plumbing.

## Quick start

No install needed:

```bash
bunx @vsceasy/cli create my-extension   # or: npx @vsceasy/cli create my-extension
cd my-extension
bun run dev
# press F5 in VS Code to launch the Extension Development Host
```

Or fully scripted with flags:

```bash
bunx @vsceasy/cli create \
  --name my-extension \
  --displayName "My Extension" \
  --publisher my-publisher \
  --type ui --ui react \
  --git --install
```

New to a project? `vsceasy wizard` detects whether you're inside one and menus the common generators.

## The killer feature: typed RPC

This is what makes vsceasy worth it. Define your contract **once**:

```ts
// src/shared/api.ts
export interface DashboardApi {
  listFiles(pattern: string): Promise<string[]>;
}
```

Implement it on the extension side:

```ts
const handlers: DashboardApi = {
  async listFiles(pattern) {
    const uris = await vscode.workspace.findFiles(pattern);
    return uris.map(u => vscode.workspace.asRelativePath(u));
  },
};
createRpcServer(webviewTransport(panel.webview), handlers);
```

Call it from the webview with full type inference:

```tsx
const api = createRpcClient<DashboardApi>(vscodeApiTransport(vscode));
const files = await api.listFiles('**/*.ts');  // typed as string[]
```

No manual `postMessage`. No string-typed message channels. Change the interface and TypeScript flags both sides instantly.

## Three extension types

`create` asks what you're building:

| Type | What you get |
|------|--------------|
| `ui` *(default)* | React webview + typed RPC bridge |
| `language` | TextMate grammar, language config, snippets, opt-in file-icon theme |
| `empty` | Bare `activate`/`deactivate` |

Want to see a full extension built step by step? The docs have a [**"Build a Todo extension" tutorial**](https://vsceasy.dev/tutorial/) — database, typed model, CRUD UI, and a background reminder, one command at a time (Tour-of-Heroes style).

## Generators for everything

Structure is `vsceasy <resource> <verb>`. Every command runs interactively (prompts) or fully scripted (flags):

```
vsceasy panel add       # webview panel + optional typed RPC
vsceasy command add     # palette command + menu entry + keybinding
vsceasy menu add        # sidebar tree view
vsceasy treeview add    # data-driven tree (getChildren/getTreeItem)
vsceasy statusBar add   # status bar item
vsceasy rpc add         # add a typed RPC method to a panel
vsceasy db init         # mini-ORM database scaffold
vsceasy job add         # recurring / event-triggered jobs
vsceasy publish init    # marketplace preflight
```

## Contributions stay clean

`package.json#contributes` is split. vsceasy regenerates the parts it owns (commands, keybindings, views) on every build. Everything else — `languages`, `grammars`, `snippets`, `themes`, `walkthroughs` — lives in a `contributes.extra.json` file and gets deep-merged in. No more manual edits clobbered by codegen.

## Why it matters

- **Typed RPC** kills the most error-prone part of extension UIs.
- **Zero-config build** — esbuild for the extension, Vite for the webview, already wired.
- **File-based registry + generators** keep large extensions organized.

Give it a spin:

```bash
bunx @vsceasy/cli create my-extension
```

⭐ Star it on [GitHub](https://github.com/jairoFernandez/vsceasy) if it saves you time. Feedback and issues welcome.
