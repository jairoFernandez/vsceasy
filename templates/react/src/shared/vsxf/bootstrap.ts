import * as vscode from 'vscode';
import type { PanelDef, CommandDef } from './define';
import { createRpcServer, webviewTransport } from './rpc';

export interface Registry {
  panels: Record<string, PanelDef>;
  commands: Record<string, CommandDef>;
  /** Command prefix from package.json (e.g. "myExt"). */
  prefix: string;
}

const openPanels = new Map<string, vscode.WebviewPanel>();

export function bootstrap(registry: Registry) {
  return function activate(context: vscode.ExtensionContext) {
    for (const [id, def] of Object.entries(registry.commands)) {
      const cmd = `${registry.prefix}.${def.id ?? id}`;
      context.subscriptions.push(
        vscode.commands.registerCommand(cmd, (...args) => def.run(vscode, context, ...args)),
      );
    }

    for (const [id, def] of Object.entries(registry.panels)) {
      if (def.command !== false) {
        const cmd = `${registry.prefix}.open${capitalize(def.id ?? id)}`;
        context.subscriptions.push(
          vscode.commands.registerCommand(cmd, () => openPanel(context, registry.prefix, id, def)),
        );
      }
    }
  };
}

function openPanel(context: vscode.ExtensionContext, prefix: string, id: string, def: PanelDef) {
  const key = `${prefix}.${def.id ?? id}`;
  const existing = openPanels.get(key);
  const column = resolveColumn(def.column);
  if (existing) {
    existing.reveal(column);
    return existing;
  }

  const panel = vscode.window.createWebviewPanel(
    key,
    def.title,
    column,
    {
      enableScripts: true,
      retainContextWhenHidden: def.retainContext ?? true,
      localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
    },
  );

  const ui = def.ui ?? def.id ?? id;
  panel.webview.html = renderHtml(panel, context, ui, def.title);

  if (def.rpc) {
    const handlers = def.rpc(vscode, context);
    const server = createRpcServer(webviewTransport(panel.webview), handlers);
    panel.onDidDispose(() => server.dispose());
  }

  openPanels.set(key, panel);
  panel.onDidDispose(() => openPanels.delete(key));
  return panel;
}

function renderHtml(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, ui: string, title: string): string {
  const webview = panel.webview;
  const root = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview', ui);
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(root, 'index.js'));
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(root, 'index.css'));
  const nonce = Array.from({ length: 16 }, () => Math.random().toString(36)[2]).join('');
  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'unsafe-inline'`,
    `script-src 'nonce-${nonce}'`,
    `img-src ${webview.cspSource} https: data:`,
    `font-src ${webview.cspSource}`,
  ].join('; ');

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <link rel="stylesheet" href="${styleUri}" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body><div id="root"></div><script type="module" nonce="${nonce}" src="${scriptUri}"></script></body>
</html>`;
}

function resolveColumn(c: PanelDef['column']): vscode.ViewColumn {
  switch (c) {
    case 'beside': return vscode.ViewColumn.Beside;
    case 'one': return vscode.ViewColumn.One;
    case 'two': return vscode.ViewColumn.Two;
    case 'three': return vscode.ViewColumn.Three;
    default: return vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}
