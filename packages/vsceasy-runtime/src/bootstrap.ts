import * as vscode from 'vscode';
import type { PanelDef, CommandDef, MenuDef, MenuItem, StatusBarDef, StatusBarMenuItem, SubpanelDef, TreeViewDef, TreeNode } from './define';
import { createRpcServer, webviewTransport } from './rpc';

export interface Registry {
  panels: Record<string, PanelDef>;
  commands: Record<string, CommandDef>;
  menus?: Record<string, MenuDef>;
  statusBars?: Record<string, StatusBarDef>;
  subpanels?: Record<string, SubpanelDef>;
  treeViews?: Record<string, TreeViewDef>;
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

    if (registry.menus) {
      for (const [id, def] of Object.entries(registry.menus)) {
        registerMenu(context, registry, id, def);
      }
    }

    if (registry.statusBars) {
      for (const [id, def] of Object.entries(registry.statusBars)) {
        registerStatusBar(context, registry, id, def);
      }
    }

    if (registry.subpanels) {
      for (const [id, def] of Object.entries(registry.subpanels)) {
        registerSubpanel(context, registry, id, def);
      }
    }

    if (registry.treeViews) {
      for (const [id, def] of Object.entries(registry.treeViews)) {
        registerTreeView(context, registry, id, def);
      }
    }
  };
}

// --- Tree Views (data-driven) ---

function registerTreeView(
  context: vscode.ExtensionContext,
  registry: Registry,
  id: string,
  def: TreeViewDef,
) {
  const viewId = `${registry.prefix}-${def.menu}-${def.id ?? id}`;
  const provider = new DataTreeProvider(def, context);
  const view = vscode.window.createTreeView(viewId, {
    treeDataProvider: provider,
    showCollapseAll: def.showCollapseAll !== false,
  });
  context.subscriptions.push(view);

  const refreshCmd = `${registry.prefix}._tree.${def.id ?? id}.refresh`;
  context.subscriptions.push(
    vscode.commands.registerCommand(refreshCmd, () => provider.refresh()),
  );

  const dispatchCmd = `${registry.prefix}._tree.${def.id ?? id}.run`;
  context.subscriptions.push(
    vscode.commands.registerCommand(dispatchCmd, async (node: TreeNode) => {
      if (node.run) return node.run(vscode, context);
      if (node.panel) {
        const p = registry.panels[node.panel];
        if (p) return openPanel(context, registry.prefix, node.panel, p);
      }
      if (node.command) {
        const c = registry.commands[node.command];
        if (c) return c.run(vscode, context);
      }
    }),
  );
  provider.setDispatchCommand(dispatchCmd);
}

class DataTreeProvider implements vscode.TreeDataProvider<TreeNode> {
  private _onDidChange = new vscode.EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private dispatchCmd = '';

  constructor(private readonly def: TreeViewDef, private readonly context: vscode.ExtensionContext) {}

  setDispatchCommand(cmd: string) {
    this.dispatchCmd = cmd;
  }

  refresh() {
    this._onDidChange.fire(undefined);
  }

  getTreeItem(node: TreeNode): vscode.TreeItem {
    const hasChildren = !!node.children?.length;
    const state = hasChildren || node.children === undefined
      ? node.collapsed === 'expanded'
        ? vscode.TreeItemCollapsibleState.Expanded
        : vscode.TreeItemCollapsibleState.Collapsed
      : vscode.TreeItemCollapsibleState.None;
    const item = new vscode.TreeItem(node.label, state);
    item.id = node.id;
    item.tooltip = node.tooltip;
    item.description = node.description;
    item.contextValue = node.contextValue;
    item.iconPath = resolveIcon(this.context, node.icon);
    if (this.dispatchCmd && (node.run || node.panel || node.command)) {
      item.command = { command: this.dispatchCmd, title: node.label, arguments: [node] };
    }
    return item;
  }

  async getChildren(node?: TreeNode): Promise<TreeNode[]> {
    if (node?.children) return node.children;
    return Promise.resolve(this.def.getChildren(node, vscode, this.context));
  }
}

// --- Webview Views (sidebar inline) ---

function registerSubpanel(
  context: vscode.ExtensionContext,
  registry: Registry,
  id: string,
  def: SubpanelDef,
) {
  // Must match the view id gen.ts writes into package.json#views.<container>.
  const viewId = `${registry.prefix}-${def.menu}-${def.id ?? id}`;
  const provider: vscode.WebviewViewProvider = {
    resolveWebviewView(view) {
      view.webview.options = {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
      };
      const ui = def.ui ?? `subpanels/${def.id ?? id}`;
      view.webview.html = renderHtml(view.webview, context, ui, def.title);
      if (def.rpc) {
        const handlers = def.rpc(vscode, context);
        const server = createRpcServer(webviewTransport(view.webview), handlers);
        view.onDidDispose(() => server.dispose());
      }
    },
  };
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(viewId, provider, {
      webviewOptions: { retainContextWhenHidden: def.retainContext ?? true },
    }),
  );
}

// --- Status bar items ---

function registerStatusBar(
  context: vscode.ExtensionContext,
  registry: Registry,
  id: string,
  def: StatusBarDef,
) {
  const alignment = def.alignment === 'right'
    ? vscode.StatusBarAlignment.Right
    : vscode.StatusBarAlignment.Left;
  const item = vscode.window.createStatusBarItem(alignment, def.priority ?? 100);
  item.text = def.icon ? `$(${def.icon}) ${def.text}` : def.text;

  // Tooltip: markdown takes precedence over plain string
  if (def.tooltipMarkdown) {
    const md = new vscode.MarkdownString(def.tooltipMarkdown, true);
    md.supportHtml = true;
    md.isTrusted = true;
    item.tooltip = md;
  } else if (def.tooltip) {
    item.tooltip = def.tooltip;
  }

  // Click behaviour priority: menu > panel > command
  if (def.menu && def.menu.length > 0) {
    const dispatchCmd = `${registry.prefix}._statusBar.${id}.click`;
    context.subscriptions.push(
      vscode.commands.registerCommand(dispatchCmd, () => openStatusBarMenu(context, registry, def.menu!)),
    );
    item.command = dispatchCmd;
  } else if (def.panel) {
    const panelDef = registry.panels[def.panel];
    if (panelDef) {
      const suffix = capitalize(panelDef.id ?? def.panel);
      item.command = `${registry.prefix}.open${suffix}`;
    } else {
      console.warn(`[vsceasy] statusBar "${id}" references unknown panel "${def.panel}"`);
    }
  } else if (def.command) {
    item.command = registry.commands[def.command]
      ? `${registry.prefix}.${registry.commands[def.command].id ?? def.command}`
      : def.command;
  }

  if (def.backgroundColor) {
    item.backgroundColor = new vscode.ThemeColor(def.backgroundColor);
  }
  item.show();
  context.subscriptions.push(item);
}

async function openStatusBarMenu(
  context: vscode.ExtensionContext,
  registry: Registry,
  items: StatusBarMenuItem[],
) {
  type QP = vscode.QuickPickItem & { __item: StatusBarMenuItem };
  const picks: QP[] = items.map((it) => ({
    label: it.label,
    description: it.description,
    detail: it.detail,
    __item: it,
  }));
  const selected = await vscode.window.showQuickPick(picks, { placeHolder: 'Choose action' });
  if (!selected) return;
  const it = selected.__item;
  if (it.url) {
    await vscode.env.openExternal(vscode.Uri.parse(it.url));
    return;
  }
  if (it.panel) {
    const panelDef = registry.panels[it.panel];
    if (panelDef) {
      const cmd = `${registry.prefix}.open${capitalize(panelDef.id ?? it.panel)}`;
      await vscode.commands.executeCommand(cmd);
    }
    return;
  }
  if (it.command) {
    const cmd = registry.commands[it.command]
      ? `${registry.prefix}.${registry.commands[it.command].id ?? it.command}`
      : it.command;
    await vscode.commands.executeCommand(cmd);
  }
}

// --- Menus ---

function registerMenu(
  context: vscode.ExtensionContext,
  registry: Registry,
  id: string,
  def: MenuDef,
) {
  // Must match the id gen.ts writes into package.json#viewsContainers/views.
  // VS Code disallows '.' in view ids, so we use '-' as separator.
  const viewId = `${registry.prefix}-${def.id ?? id}`;
  const provider = new MenuTreeDataProvider(def.items, context);
  const view = vscode.window.createTreeView(viewId, {
    treeDataProvider: provider,
    showCollapseAll: true,
  });
  context.subscriptions.push(view);

  // Single dispatch command per menu — passes the item through arguments[0] of contributes.commands.
  const dispatchCmd = `${registry.prefix}._menu.${def.id ?? id}.run`;
  context.subscriptions.push(
    vscode.commands.registerCommand(dispatchCmd, (item: MenuItem) =>
      dispatchMenuItem(context, registry, item),
    ),
  );

  provider.setDispatchCommand(dispatchCmd);
}

async function dispatchMenuItem(
  context: vscode.ExtensionContext,
  registry: Registry,
  item: MenuItem,
) {
  if (item.url) {
    await vscode.env.openExternal(vscode.Uri.parse(item.url));
    return;
  }
  if (item.panel) {
    const panel = registry.panels[item.panel];
    if (!panel) {
      vscode.window.showErrorMessage(`Menu item references unknown panel: ${item.panel}`);
      return;
    }
    openPanel(context, registry.prefix, item.panel, panel);
    return;
  }
  if (item.command) {
    const cmd = registry.commands[item.command];
    if (!cmd) {
      vscode.window.showErrorMessage(`Menu item references unknown command: ${item.command}`);
      return;
    }
    await cmd.run(vscode, context);
    return;
  }
  if (item.run) {
    await item.run(vscode, context);
    return;
  }
}

class MenuTreeDataProvider implements vscode.TreeDataProvider<MenuItem> {
  private _onDidChange = new vscode.EventEmitter<MenuItem | undefined>();
  readonly onDidChangeTreeData = this._onDidChange.event;
  private dispatchCmd = '';

  constructor(private readonly items: MenuItem[], private readonly context: vscode.ExtensionContext) {}

  setDispatchCommand(cmd: string) {
    this.dispatchCmd = cmd;
    this._onDidChange.fire(undefined);
  }

  getTreeItem(item: MenuItem): vscode.TreeItem {
    const hasChildren = !!item.children?.length;
    const collapsibleState = hasChildren
      ? item.collapsed === 'collapsed'
        ? vscode.TreeItemCollapsibleState.Collapsed
        : vscode.TreeItemCollapsibleState.Expanded
      : vscode.TreeItemCollapsibleState.None;
    const node = new vscode.TreeItem(item.label, collapsibleState);
    node.tooltip = item.description ?? item.label;
    node.description = item.description;
    node.iconPath = resolveIcon(this.context, item.icon);
    if (!hasChildren && this.dispatchCmd) {
      node.command = {
        command: this.dispatchCmd,
        title: item.label,
        arguments: [item],
      };
    }
    return node;
  }

  getChildren(item?: MenuItem): MenuItem[] {
    if (!item) return this.items;
    return item.children ?? [];
  }
}

function resolveIcon(
  context: vscode.ExtensionContext,
  icon: MenuItem['icon'],
): vscode.TreeItem['iconPath'] {
  if (!icon) return undefined;
  if (typeof icon === 'string') return new vscode.ThemeIcon(icon);
  const path = require('path') as typeof import('path');
  const toUri = (p: string) =>
    path.isAbsolute(p) ? vscode.Uri.file(p) : vscode.Uri.joinPath(context.extensionUri, p);
  if ('path' in icon) return toUri(icon.path);
  return { light: toUri(icon.light), dark: toUri(icon.dark) };
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

  const ui = def.ui ?? `panels/${def.id ?? id}`;
  panel.webview.html = renderHtml(panel.webview, context, ui, def.title);

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

function renderHtml(webview: vscode.Webview, context: vscode.ExtensionContext, ui: string, title: string): string {
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
