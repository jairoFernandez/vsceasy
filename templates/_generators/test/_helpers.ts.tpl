import { vi } from 'vitest';
import { createRpcServer, createRpcClient } from '../shared/vsceasy/rpc';
import type { Transport, Handlers, RpcClient } from '../shared/vsceasy/rpc';

/**
 * Minimal `vscode` namespace mock — covers the surface most extensions touch.
 * Extend per test by spreading or assigning new spies onto the returned object.
 *
 *   const vscode = mockVscode();
 *   vscode.window.showInformationMessage('hi');
 *   expect(vscode.window.showInformationMessage).toHaveBeenCalledWith('hi');
 */
export function mockVscode() {
  const subscriptions: { dispose(): void }[] = [];
  return {
    window: {
      showInformationMessage: vi.fn(),
      showWarningMessage: vi.fn(),
      showErrorMessage: vi.fn(),
      showInputBox: vi.fn(),
      showQuickPick: vi.fn(),
      withProgress: vi.fn(async (_opts: any, task: any) => task({ report: vi.fn() })),
      createStatusBarItem: vi.fn(() => ({ show: vi.fn(), dispose: vi.fn(), text: '' })),
      createTreeView: vi.fn(() => ({ dispose: vi.fn() })),
      createWebviewPanel: vi.fn(),
      activeTextEditor: undefined as any,
    },
    workspace: {
      getConfiguration: vi.fn(() => ({ get: vi.fn(), update: vi.fn(async () => undefined) })),
      onDidChangeConfiguration: vi.fn(() => ({ dispose: vi.fn() })),
      findFiles: vi.fn(async () => [] as any[]),
      workspaceFolders: [] as any[],
    },
    commands: {
      registerCommand: vi.fn((_id: string, _fn: any) => ({ dispose: vi.fn() })),
      executeCommand: vi.fn(async () => undefined),
    },
    env: {
      openExternal: vi.fn(async () => true),
    },
    Uri: { parse: (s: string) => ({ toString: () => s }), file: (p: string) => ({ fsPath: p, toString: () => p }) },
    ProgressLocation: { Notification: 15, SourceControl: 1, Window: 10 } as const,
    ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 } as const,
    TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 } as const,
    StatusBarAlignment: { Left: 1, Right: 2 } as const,
    EventEmitter: class {
      private listeners: Array<(v: any) => void> = [];
      event = (l: (v: any) => void) => {
        this.listeners.push(l);
        return { dispose: () => (this.listeners = this.listeners.filter((x) => x !== l)) };
      };
      fire(v: any) {
        this.listeners.forEach((l) => l(v));
      }
      dispose() {
        this.listeners = [];
      }
    },
    Disposable: { from: (...d: any[]) => ({ dispose: () => d.forEach((x) => x.dispose?.()) }) },
    subscriptions,
  };
}

export type VscodeMock = ReturnType<typeof mockVscode>;

/**
 * Minimal `ExtensionContext` mock — backed by in-memory Maps for state/secrets.
 */
export function mockContext() {
  const wm = new Map<string, unknown>();
  const gm = new Map<string, unknown>();
  const sm = new Map<string, string>();
  const memento = (m: Map<string, unknown>) => ({
    get: (k: string, d?: unknown) => (m.has(k) ? m.get(k) : d),
    update: async (k: string, v: unknown) => void (v === undefined ? m.delete(k) : m.set(k, v)),
    keys: () => Array.from(m.keys()),
  });
  return {
    subscriptions: [] as { dispose(): void }[],
    workspaceState: memento(wm),
    globalState: memento(gm),
    secrets: {
      get: async (k: string) => sm.get(k),
      store: async (k: string, v: string) => void sm.set(k, v),
      delete: async (k: string) => void sm.delete(k),
      onDidChange: () => ({ dispose: () => {} }),
    },
    extensionPath: '/mock',
    extensionUri: { fsPath: '/mock' },
  };
}

/**
 * Build an in-memory RPC pair (server + typed client). No webview involved.
 * Useful for testing your handlers end-to-end with the same types the UI sees.
 *
 *   const handlers = { greet: (n: string) => `hi ${n}` };
 *   const api = mockRpcPair<typeof handlers>(handlers);
 *   expect(await api.greet('Jairo')).toBe('hi Jairo');
 */
export function mockRpcPair<H extends Handlers>(handlers: H): RpcClient<H> {
  const aListeners = new Set<(m: any) => void>();
  const bListeners = new Set<(m: any) => void>();
  const aToB: Transport = {
    send: (m) => bListeners.forEach((l) => l(m)),
    onMessage: (h) => {
      aListeners.add(h);
      return () => aListeners.delete(h);
    },
  };
  const bToA: Transport = {
    send: (m) => aListeners.forEach((l) => l(m)),
    onMessage: (h) => {
      bListeners.add(h);
      return () => bListeners.delete(h);
    },
  };
  createRpcServer<H>(bToA, handlers);
  return createRpcClient<H>(aToB, { callTimeoutMs: 0 });
}
