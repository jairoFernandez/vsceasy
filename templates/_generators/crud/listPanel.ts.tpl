import { definePanel } from '../shared/vsceasy';
import { {{Name}}Service } from '../services/{{Name}}Service';
import { setPending{{Name}}Id } from '../services/{{name}}FormNav';
import type { {{Plural}}ListApi } from '../shared/api';

export default definePanel<{{Plural}}ListApi>({
  title: '{{title}}',
  column: 'active',
  command: { title: '{{title}}: List' },
  rpc: (vscode) => ({
    async list() {
      return {{Name}}Service.list();
    },
    async delete(id) {
      // Confirm in the host — browser confirm() is disabled in webviews.
      const pick = await vscode.window.showWarningMessage(
        `Delete {{title}} "${String(id)}"?`,
        { modal: true },
        'Delete',
      );
      if (pick !== 'Delete') return false;
      return {{Name}}Service.delete(id);
    },
    async openForm(id) {
      // Stash the id so the form can pre-load it on mount, then reveal the form.
      setPending{{Name}}Id(id ?? null);
      await vscode.commands.executeCommand('{{prefix}}.open{{Name}}Form', id ?? null);
    },
  }),
});
