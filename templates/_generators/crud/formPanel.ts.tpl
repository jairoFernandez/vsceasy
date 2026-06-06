import { definePanel } from '../shared/vsceasy';
import { {{Name}}Service } from '../services/{{Name}}Service';
import type { {{Name}}FormApi } from '../shared/api';
import type { {{Name}} } from '../models/{{Name}}';

export default definePanel<{{Name}}FormApi>({
  title: '{{title}}',
  column: 'beside',
  command: { title: '{{title}}: New / Edit' },
  rpc: (vscode) => ({
    async get(id) {
      if (!id) return null;
      return {{Name}}Service.get(id as {{Name}}['{{primaryKey}}']);
    },
    async save(row) {
      const saved = await {{Name}}Service.save(row);
      void vscode.window.showInformationMessage(`{{title}} saved (${String(saved.{{primaryKey}})})`);
      return saved;
    },
    async cancel() {
      // No-op — webview closes itself.
    },
  }),
});
