import { definePanel } from '../shared/vsceasy';
import { {{Name}}Service } from '../services/{{Name}}Service';
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
      return {{Name}}Service.delete(id);
    },
    async openForm(id) {
      // Defer to the form panel — opens beside the current view.
      await vscode.commands.executeCommand('{{prefix}}.open{{Name}}Form', id ?? null);
    },
  }),
});
