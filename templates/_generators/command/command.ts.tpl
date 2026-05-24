import { defineCommand } from '../shared/vsxf';

export default defineCommand({
  title: '{{title}}',{{categoryLine}}{{keybindingLine}}
  run: (vscode) => {
    vscode.window.showInformationMessage('{{title}} ran');
  },
});
