import { bootstrap } from '../shared/vsceasy';
import { registry } from './_registry';
import { applyColors, removeColors, colorizeEnabled } from '../colorize';

export const activate = bootstrap(registry, {
  onActivate: [
    async (context, vscode) => {
      // Auto-apply scoped token colors on activate when opted in (default).
      // Scoped to {{scopeName}} only — other languages are untouched.
      if (colorizeEnabled(vscode)) {
        await applyColors(vscode);
      }
      // React to the user toggling `{{commandPrefix}}.colorize` at runtime.
      context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration(async (e) => {
          if (!e.affectsConfiguration('{{commandPrefix}}.colorize')) return;
          if (colorizeEnabled(vscode)) await applyColors(vscode);
          else await removeColors(vscode);
        }),
      );
    },
  ],
});

export function deactivate() {}
