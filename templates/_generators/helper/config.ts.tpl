import * as vscode from 'vscode';

/**
 * Typed wrapper over `vscode.workspace.getConfiguration('{{commandPrefix}}')`.
 * Reads settings declared under `contributes.configuration` in package.json.
 *
 * Example package.json snippet:
 *   "contributes": {
 *     "configuration": {
 *       "title": "{{displayName}}",
 *       "properties": {
 *         "{{commandPrefix}}.apiUrl": { "type": "string", "default": "" }
 *       }
 *     }
 *   }
 *
 * Usage:
 *   const url = config.get<string>('apiUrl');
 *   await config.set('apiUrl', 'https://...');
 */
const SECTION = '{{commandPrefix}}';

export const config = {
  /**
   * The settings prefix these helpers read and write. Exposed so callers that
   * need the fully-qualified key — opening the Settings UI at a section, for
   * instance — don't hardcode the prefix a second time and risk drifting.
   */
  section: SECTION,
  get<T>(key: string, fallback?: T): T {
    const v = vscode.workspace.getConfiguration(SECTION).get<T>(key);
    return (v === undefined ? (fallback as T) : v) as T;
  },
  set(key: string, value: unknown, target: vscode.ConfigurationTarget = vscode.ConfigurationTarget.Global): Thenable<void> {
    return vscode.workspace.getConfiguration(SECTION).update(key, value, target);
  },
  onChange(listener: (key: string) => void): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(SECTION)) listener(SECTION);
    });
  },
};
