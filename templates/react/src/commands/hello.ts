import { defineCommand } from '../shared/vsxf';

export default defineCommand({
  title: 'Hello',
  run: (vscode) => vscode.window.showInformationMessage('Hello from {{displayName}}!'),
});
