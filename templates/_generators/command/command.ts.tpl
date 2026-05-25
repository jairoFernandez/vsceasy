import { defineCommand } from '../shared/vsceasy';

export default defineCommand({
  title: '{{title}}',{{categoryLine}}{{keybindingLine}}
  run: (vscode) => {
    vscode.window.showInformationMessage('{{title}} ran');
  },
});
