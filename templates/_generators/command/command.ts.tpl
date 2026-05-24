import { defineCommand } from '../shared/vsxf';

export default defineCommand({
  title: '{{title}}',{{categoryLine}}
  run: (vscode) => {
    vscode.window.showInformationMessage('{{title}} ran');
  },
});
