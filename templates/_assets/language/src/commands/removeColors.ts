import { defineCommand } from '../shared/vsceasy';
import { removeColors } from '../colorize';

export default defineCommand({
  id: 'removeColors',
  title: '{{displayName}}: Remove Colors',
  run: async (vscode) => {
    await removeColors(vscode);
    vscode.window.showInformationMessage('{{displayName}} colors removed.');
  },
});
