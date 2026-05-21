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

interface ViteManifestEntry {
  file: string;
  css?: string[];
  assets?: string[];
  imports?: string[];
}
type ViteManifest = Record<string, ViteManifestEntry>;

let cachedManifest: { mtime: number; data: ViteManifest } | null = null;

function loadManifest(extensionUri: vscode.Uri): ViteManifest | null {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');
  // Vite manifest can land at either `manifest.json` (new) or `.vite/manifest.json` (default).
  const webviewRoot = vscode.Uri.joinPath(extensionUri, 'dist', 'webview').fsPath;
  for (const rel of ['manifest.json', '.vite/manifest.json']) {
    const p = path.join(webviewRoot, rel);
    if (!fs.existsSync(p)) continue;
    const mtime = fs.statSync(p).mtimeMs;
    if (cachedManifest?.mtime === mtime) return cachedManifest.data;
    cachedManifest = { mtime, data: JSON.parse(fs.readFileSync(p, 'utf8')) };
    return cachedManifest.data;
  }
  return null;
}

function resolveAssets(extensionUri: vscode.Uri, ui: string): { js: string[]; css: string[] } {
  const manifest = loadManifest(extensionUri);
  if (!manifest) {
    // Fallback to convention: <ui>/index.js + <ui>/index.css
    return { js: [`${ui}/index.js`], css: [`${ui}/index.css`] };
  }
  // Manifest keys for HTML entries look like `<ui>/index.html`.
  const key = `${ui}/index.html`;
  const entry = manifest[key];
  if (!entry) return { js: [`${ui}/index.js`], css: [] };
  const js = [entry.file];
  const css = [...(entry.css ?? [])];
  // Recursively pull CSS from imported chunks.
  const seen = new Set<string>();
  const walk = (imp: string) => {
    if (seen.has(imp)) return;
    seen.add(imp);
    const e = manifest[imp];
    if (!e) return;
    if (e.css) css.push(...e.css);
    e.imports?.forEach(walk);
  };
  entry.imports?.forEach(walk);
  return { js, css };
}

function renderHtml(panel: vscode.WebviewPanel, context: vscode.ExtensionContext, ui: string, title: string): string {
  const webview = panel.webview;
  const root = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview');
  const { js, css } = resolveAssets(context.extensionUri, ui);
  const toUri = (rel: string) =>
    webview.asWebviewUri(vscode.Uri.joinPath(root, ...rel.split('/'))).toString();
  const scriptTags = js
    .map((f) => `<script type="module" nonce="{{NONCE}}" src="${toUri(f)}"></script>`)
    .join('\n    ');
  const styleTags = css.map((f) => `<link rel="stylesheet" href="${toUri(f)}" />`).join('\n    ');
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
    ${styleTags}
    <title>${escapeHtml(title)}</title>
  </head>
  <body><div id="root"></div>
    ${scriptTags.replace(/\{\{NONCE\}\}/g, nonce)}
  </body>
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
