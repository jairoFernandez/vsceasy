# @ideascol/vscode-extension-framework

Framework para crear VSCode extensions rapido con UI React/Svelte/Vue/Vanilla, RPC tipado webview-extension, y file-based routing de panels/commands

## Quick start
```bash
# Using npm
npx @ideascol/vscode-extension-framework

# Using bun
bunx @ideascol/vscode-extension-framework
```

## Installation

```bash
# Using npm
npm install -g @ideascol/vscode-extension-framework

# Using bun
bun install -g @ideascol/vscode-extension-framework
```

## Usage as cli
```bash
# Using npm
npm link # to test the cli locally

# Using bun
bun link # to test the cli locally

vscode-extension-framework greet --name=John
```

## Usage as library

```ts
import { Greet } from '@ideascol/vscode-extension-framework';

Greet('John'); // should print 'Hello, John!'

```

