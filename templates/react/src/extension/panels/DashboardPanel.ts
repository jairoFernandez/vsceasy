import * as vscode from 'vscode';
import { createRpcServer, webviewTransport } from '../../shared/rpc';
import type { DashboardApi } from '../../shared/api';

export class DashboardPanel {
  private static current: DashboardPanel | undefined;
  private readonly panel: vscode.WebviewPanel;
  private disposables: vscode.Disposable[] = [];

  static show(context: vscode.ExtensionContext) {
    const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
    if (DashboardPanel.current) {
      DashboardPanel.current.panel.reveal(column);
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      '{{commandPrefix}}.dashboard',
      '{{displayName}} Dashboard',
      column,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview')],
      },
    );
    DashboardPanel.current = new DashboardPanel(panel, context);
  }

  private constructor(panel: vscode.WebviewPanel, context: vscode.ExtensionContext) {
    this.panel = panel;
    this.panel.webview.html = this.html(context);

    const handlers: DashboardApi = {
      async getInfo() {
        return {
          workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null,
          vscodeVersion: vscode.version,
        };
      },
      async showMessage(text: string) {
        await vscode.window.showInformationMessage(text);
      },
      async listFiles(pattern: string) {
        const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
        return uris.map((u) => vscode.workspace.asRelativePath(u));
      },
    };

    const server = createRpcServer(webviewTransport(this.panel.webview), handlers);
    this.disposables.push({ dispose: server.dispose });

    this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
  }

  private html(context: vscode.ExtensionContext): string {
    const webview = this.panel.webview;
    const distRoot = vscode.Uri.joinPath(context.extensionUri, 'dist', 'webview');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distRoot, 'assets', 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distRoot, 'assets', 'index.css'));
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
    <title>{{displayName}}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }

  dispose() {
    DashboardPanel.current = undefined;
    this.panel.dispose();
    while (this.disposables.length) this.disposables.pop()?.dispose();
  }
}
