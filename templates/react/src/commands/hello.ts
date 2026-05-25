import { defineCommand } from '../shared/vsceasy';

export default defineCommand({
  title: 'Hello',
  run: (vscode) => vscode.window.showInformationMessage('Hello from {{displayName}}!'),
});
