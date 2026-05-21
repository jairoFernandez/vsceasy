import * as vscode from 'vscode';
import { DashboardPanel } from './panels/DashboardPanel';

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand('{{commandPrefix}}.hello', () => {
      vscode.window.showInformationMessage('Hello from {{displayName}}!');
    }),
    vscode.commands.registerCommand('{{commandPrefix}}.openDashboard', () => {
      DashboardPanel.show(context);
    }),
  );
}

export function deactivate() {}
