import * as vscode from 'vscode';

/**
 * Typed wrapper over `context.{workspaceState, globalState}`.
 * - workspace: scoped to the current workspace (per-project preferences)
 * - global: shared across all workspaces (user-wide settings, last-opened file)
 *
 * Usage:
 *   await state.workspace.set('lastQuery', 'foo');
 *   const q = state.workspace.get<string>('lastQuery');
 */
let _ctx: vscode.ExtensionContext | undefined;

export function initState(ctx: vscode.ExtensionContext) {
  _ctx = ctx;
}

function ctx(): vscode.ExtensionContext {
  if (!_ctx) throw new Error('State helper not initialized — call initState(context) on activate.');
  return _ctx;
}

function wrap(memento: () => vscode.Memento) {
  return {
    get<T>(key: string, fallback?: T): T | undefined {
      const v = memento().get<T>(key);
      return v === undefined ? fallback : v;
    },
    set(key: string, value: unknown): Thenable<void> {
      return memento().update(key, value);
    },
    delete(key: string): Thenable<void> {
      return memento().update(key, undefined);
    },
    keys(): readonly string[] {
      return memento().keys();
    },
  };
}

export const state = {
  workspace: wrap(() => ctx().workspaceState),
  global: wrap(() => ctx().globalState),
};
