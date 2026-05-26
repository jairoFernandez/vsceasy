import * as vscode from 'vscode';

/**
 * Typed wrapper over `context.secrets` (SecretStorage backed by OS keychain).
 * Inject the extension context once on activate (bootstrap does this if you
 * import this module from your extension entry).
 *
 * Usage:
 *   await secrets.set('githubToken', 'ghp_xxx');
 *   const token = await secrets.get('githubToken');
 */
let _ctx: vscode.ExtensionContext | undefined;

export function initSecrets(ctx: vscode.ExtensionContext) {
  _ctx = ctx;
}

function ctx(): vscode.ExtensionContext {
  if (!_ctx) throw new Error('Secrets helper not initialized — call initSecrets(context) on activate.');
  return _ctx;
}

export const secrets = {
  get(key: string): Thenable<string | undefined> {
    return ctx().secrets.get(key);
  },
  set(key: string, value: string): Thenable<void> {
    return ctx().secrets.store(key, value);
  },
  delete(key: string): Thenable<void> {
    return ctx().secrets.delete(key);
  },
  onChange(listener: (key: string) => void): vscode.Disposable {
    return ctx().secrets.onDidChange((e) => listener(e.key));
  },
};
