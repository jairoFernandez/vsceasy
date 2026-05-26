import * as vscode from 'vscode';

/**
 * Concise wrappers over `vscode.window.show*Message`. Each accepts an optional
 * list of action labels and resolves to the selected label (or undefined).
 *
 * Usage:
 *   notify.info('Saved');
 *   const pick = await notify.warn('Discard?', 'Discard', 'Keep');
 *   if (pick === 'Discard') ...
 *
 * For long-running tasks use `withProgress`:
 *   await withProgress('Indexing…', async (report) => {
 *     for (let i = 0; i <= 100; i += 10) {
 *       report({ increment: 10, message: `${i}%` });
 *       await new Promise(r => setTimeout(r, 100));
 *     }
 *   });
 */
export const notify = {
  info(message: string, ...actions: string[]) {
    return vscode.window.showInformationMessage(message, ...actions);
  },
  warn(message: string, ...actions: string[]) {
    return vscode.window.showWarningMessage(message, ...actions);
  },
  error(message: string, ...actions: string[]) {
    return vscode.window.showErrorMessage(message, ...actions);
  },
  confirm(message: string, yesLabel = 'Yes', noLabel = 'No'): Thenable<boolean> {
    return vscode.window
      .showInformationMessage(message, { modal: true }, yesLabel, noLabel)
      .then((pick) => pick === yesLabel);
  },
};

export function withProgress<T>(
  title: string,
  task: (report: (p: { message?: string; increment?: number }) => void) => Thenable<T> | T,
  location: vscode.ProgressLocation = vscode.ProgressLocation.Notification,
): Thenable<T> {
  return vscode.window.withProgress({ location, title, cancellable: false }, (progress) =>
    Promise.resolve(task((p) => progress.report(p))),
  );
}
