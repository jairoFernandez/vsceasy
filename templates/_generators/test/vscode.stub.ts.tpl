/**
 * Auto-generated `vscode` module stub for vitest. Replaces the real `vscode`
 * import inside tests (the real module only exists in the extension host).
 *
 * The stub exposes the enums and class shapes the runtime touches at module
 * load time so files that do `import * as vscode from 'vscode'` don't crash
 * during test collection.
 *
 * To assert behaviour against `vscode.window.X`, use `mockVscode()` from
 * `_helpers.ts` and inject it into the code under test directly.
 */
export const TreeItemCollapsibleState = { None: 0, Collapsed: 1, Expanded: 2 } as const;
export const StatusBarAlignment = { Left: 1, Right: 2 } as const;
export const ConfigurationTarget = { Global: 1, Workspace: 2, WorkspaceFolder: 3 } as const;
export const ProgressLocation = { SourceControl: 1, Window: 10, Notification: 15 } as const;
export const ViewColumn = { Active: -1, Beside: -2, One: 1, Two: 2, Three: 3 } as const;
export const ThemeIcon = class { constructor(public id: string) {} };
export const ThemeColor = class { constructor(public id: string) {} };
export const TreeItem = class { constructor(public label: string, public collapsibleState?: number) {} };
export const MarkdownString = class {
  value = '';
  isTrusted = false;
  supportHtml = false;
  constructor(value = '') {
    this.value = value;
  }
  appendMarkdown(v: string) {
    this.value += v;
    return this;
  }
};
export const Uri = {
  parse: (s: string) => ({ toString: () => s, fsPath: s }),
  file: (p: string) => ({ fsPath: p, toString: () => p }),
  joinPath: (base: { fsPath: string }, ...segs: string[]) => ({
    fsPath: [base.fsPath, ...segs].join('/'),
    toString: () => [base.fsPath, ...segs].join('/'),
  }),
};
export const EventEmitter = class<T> {
  private listeners: Array<(v: T) => void> = [];
  event = (l: (v: T) => void) => {
    this.listeners.push(l);
    return { dispose: () => (this.listeners = this.listeners.filter((x) => x !== l)) };
  };
  fire(v: T) {
    this.listeners.forEach((l) => l(v));
  }
  dispose() {
    this.listeners = [];
  }
};
export const Disposable = {
  from: (...d: Array<{ dispose: () => void }>) => ({ dispose: () => d.forEach((x) => x.dispose()) }),
};

const noop = () => {};
const noopDisposable = { dispose: noop };
const noopAsync = async () => undefined;
const noopReg = () => noopDisposable;

export const window = {
  showInformationMessage: noopAsync,
  showWarningMessage: noopAsync,
  showErrorMessage: noopAsync,
  showInputBox: noopAsync,
  showQuickPick: noopAsync,
  withProgress: async (_o: unknown, task: (p: { report: () => void }) => unknown) =>
    task({ report: noop }),
  createStatusBarItem: () => ({ show: noop, hide: noop, dispose: noop, text: '' }),
  createTreeView: () => ({ dispose: noop }),
  createWebviewPanel: () => ({
    webview: { html: '', onDidReceiveMessage: noopReg, postMessage: noop, asWebviewUri: (u: unknown) => u },
    onDidDispose: noopReg,
    dispose: noop,
  }),
  registerWebviewViewProvider: noopReg,
  activeTextEditor: undefined as unknown,
  onDidChangeActiveTextEditor: noopReg,
};

export const workspace = {
  getConfiguration: () => ({ get: noop, update: noopAsync, has: () => false, inspect: () => undefined }),
  onDidChangeConfiguration: noopReg,
  findFiles: async () => [] as unknown[],
  workspaceFolders: [] as unknown[],
  asRelativePath: (p: string) => p,
};

export const commands = {
  registerCommand: noopReg,
  executeCommand: noopAsync,
  getCommands: async () => [] as string[],
};

export const env = {
  openExternal: async () => true,
  clipboard: { writeText: noopAsync, readText: async () => '' },
};

export const extensions = {
  getExtension: () => undefined,
  all: [] as unknown[],
};

export const languages = {
  registerHoverProvider: noopReg,
  registerCompletionItemProvider: noopReg,
};
