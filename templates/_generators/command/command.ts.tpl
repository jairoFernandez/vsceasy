import { defineCommand } from '../shared/vsceasy';

export default defineCommand({
  title: '{{title}}',{{categoryLine}}{{keybindingLine}}{{whenLine}}
  run: (vscode) => {
    vscode.window.showInformationMessage('{{title}} ran');
  },
});
