import { defineCommand } from '../shared/vsceasy';
import { applyColors } from '../colorize';

export default defineCommand({
  id: 'applyColors',
  title: '{{displayName}}: Apply Colors',
  run: async (vscode) => {
    await applyColors(vscode);
    vscode.window.showInformationMessage('{{displayName}} colors applied.');
  },
});
