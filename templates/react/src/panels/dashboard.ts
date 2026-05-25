import { definePanel } from '../shared/vsceasy';
import type { DashboardApi } from '../shared/api';

export default definePanel<DashboardApi>({
  title: '{{displayName}} Dashboard',
  rpc: (vscode) => ({
    async getInfo() {
      return {
        workspace: vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null,
        vscodeVersion: vscode.version,
      };
    },
    async showMessage(text) {
      await vscode.window.showInformationMessage(text);
    },
    async listFiles(pattern) {
      const uris = await vscode.workspace.findFiles(pattern, '**/node_modules/**', 100);
      return uris.map((u) => vscode.workspace.asRelativePath(u));
    },
  }),
});
