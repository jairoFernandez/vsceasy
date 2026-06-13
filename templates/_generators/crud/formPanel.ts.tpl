import { definePanel } from '../shared/vsceasy';
import { {{Name}}Service } from '../services/{{Name}}Service';
import { takePending{{Name}}Id } from '../services/{{name}}FormNav';
import type { {{Name}}FormApi } from '../shared/api';
import type { {{Name}} } from '../models/{{Name}}';
{{relationImports}}
export default definePanel<{{Name}}FormApi>({
  title: '{{title}}',
  column: 'beside',
  command: { title: '{{title}}: New / Edit' },
  rpc: (vscode) => ({
    async pendingId() {
      // Consumed once by the webview on mount to decide edit vs new.
      return (takePending{{Name}}Id() as {{Name}}['{{primaryKey}}'] | null) ?? null;
    },
    async get(id) {
      if (!id) return null;
      return {{Name}}Service.get(id as {{Name}}['{{primaryKey}}']);
    },
    async save(row) {
      const saved = await {{Name}}Service.save(row);
      void vscode.window.showInformationMessage(`{{title}} saved (${String(saved.{{primaryKey}})})`);
      // Reveal the list so the new/edited row shows. Revealing fires the list
      // webview's focus/visibility listener, which reloads it.
      void vscode.commands.executeCommand('{{prefix}}.open{{Plural}}List');
      return saved;
    },
{{relationOptionsHandler}}    async cancel() {
      // No-op — webview closes itself.
    },
  }),
});
