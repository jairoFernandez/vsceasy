// Typed RPC bridge — webview <-> extension.
// Used by both sides. Transport-agnostic core + thin adapters.

export type RpcMessage =
  | { id: string; kind: 'call'; method: string; args: unknown[] }
  | { id: string; kind: 'result'; ok: true; value: unknown }
  | { id: string; kind: 'result'; ok: false; error: { message: string; stack?: string } }
  | { kind: 'event'; topic: string; payload: unknown };

export interface Transport {
  send(msg: RpcMessage): void;
  onMessage(handler: (msg: RpcMessage) => void): () => void;
}

// --- Server (extension side) ---

/**
 * Loose constraint: an interface with method members. Using `object` (instead
 * of a Record with index signature) lets user-declared interfaces satisfy the
 * constraint without forcing them to declare `[k: string]: any`.
 */
export type Handlers = object;

export function createRpcServer<H extends Handlers>(transport: Transport, handlers: H) {
  const off = transport.onMessage(async (msg) => {
    if (msg.kind !== 'call') return;
    const fn = (handlers as Record<string, (...args: any[]) => any>)[msg.method];
    if (!fn) {
      transport.send({
        id: msg.id,
        kind: 'result',
        ok: false,
        error: { message: `Unknown RPC method: ${msg.method}` },
      });
      return;
    }
    try {
      const value = await fn(...msg.args);
      transport.send({ id: msg.id, kind: 'result', ok: true, value });
    } catch (err: any) {
      transport.send({
        id: msg.id,
        kind: 'result',
        ok: false,
        error: { message: String(err?.message ?? err), stack: err?.stack },
      });
    }
  });

  return {
    emit(topic: string, payload: unknown) {
      transport.send({ kind: 'event', topic, payload });
    },
    dispose: off,
  };
}

// --- Client (webview side) ---

export type RpcClient<H extends Handlers> = {
  [K in keyof H]: H[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
} & {
  on(topic: string, handler: (payload: any) => void): () => void;
};

export interface RpcClientOptions {
  /**
   * Max wait (ms) for a call's reply before rejecting with a timeout error.
   * Prevents hangs when the extension host reloads mid-flight during `bun run dev`.
   * Default: 15000. Set to 0 to disable.
   */
  callTimeoutMs?: number;
}

export function createRpcClient<H extends Handlers>(
  transport: Transport,
  opts: RpcClientOptions = {},
): RpcClient<H> {
  const callTimeoutMs = opts.callTimeoutMs ?? 15000;
  const pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void; timer?: ReturnType<typeof setTimeout> }>();
  const listeners = new Map<string, Set<(p: any) => void>>();

  transport.onMessage((msg) => {
    if (msg.kind === 'result') {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
      if (p.timer) clearTimeout(p.timer);
      if (msg.ok) p.resolve(msg.value);
      else p.reject(Object.assign(new Error(msg.error.message), { stack: msg.error.stack }));
    } else if (msg.kind === 'event') {
      listeners.get(msg.topic)?.forEach((l) => l(msg.payload));
    }
  });

  let counter = 0;
  const newId = () => `r${++counter}_${Date.now()}`;

  const proxy = new Proxy({} as any, {
    get(_t, prop: string) {
      if (prop === 'on') {
        return (topic: string, handler: (p: any) => void) => {
          let set = listeners.get(topic);
          if (!set) listeners.set(topic, (set = new Set()));
          set.add(handler);
          return () => set!.delete(handler);
        };
      }
      return (...args: unknown[]) =>
        new Promise((resolve, reject) => {
          const id = newId();
          const entry: { resolve: (v: any) => void; reject: (e: any) => void; timer?: ReturnType<typeof setTimeout> } = { resolve, reject };
          if (callTimeoutMs > 0) {
            entry.timer = setTimeout(() => {
              if (pending.delete(id)) {
                reject(new Error(`RPC \`${prop}\` timed out after ${callTimeoutMs}ms (extension host reloaded?)`));
              }
            }, callTimeoutMs);
          }
          pending.set(id, entry);
          try {
            transport.send({ id, kind: 'call', method: prop, args });
          } catch (err) {
            pending.delete(id);
            if (entry.timer) clearTimeout(entry.timer);
            reject(err);
          }
        });
    },
  });

  return proxy as RpcClient<H>;
}

// --- Transports ---

export function webviewTransport(webview: { postMessage(m: any): any; onDidReceiveMessage: any }): Transport {
  return {
    send: (m) => webview.postMessage(m),
    onMessage: (h) => {
      const sub = webview.onDidReceiveMessage((m: RpcMessage) => h(m));
      return () => sub.dispose();
    },
  };
}

export function vscodeApiTransport(vscode: { postMessage(m: any): void }): Transport {
  return {
    send: (m) => vscode.postMessage(m),
    onMessage: (h) => {
      const listener = (e: MessageEvent) => h(e.data as RpcMessage);
      window.addEventListener('message', listener);
      return () => window.removeEventListener('message', listener);
    },
  };
}

declare global {
  function acquireVsCodeApi(): WebviewApi;
}

export interface WebviewApi {
  postMessage(m: any): void;
  getState(): unknown;
  setState<T>(s: T): T;
}

let _cachedVscode: WebviewApi | null = null;
function vscodeApi(): WebviewApi {
  // acquireVsCodeApi() may only be called once per webview lifetime.
  if (_cachedVscode) return _cachedVscode;
  return (_cachedVscode = acquireVsCodeApi());
}

/** One-liner for webview: returns a typed RPC client. */
export function connectWebview<H extends Handlers>(opts?: RpcClientOptions): RpcClient<H> {
  return createRpcClient<H>(vscodeApiTransport(vscodeApi()), opts);
}

/**
 * Typed `vscode.getState() / setState()` wrapper for webviews. State survives
 * panel hide/show, host reloads triggered by `retainContextWhenHidden`, and
 * is the recommended way to persist scroll positions, form data, and selection.
 *
 * Usage:
 *   const state = webviewState<{ query: string }>({ query: '' });
 *   state.set({ query: 'foo' });
 *   const { query } = state.get();
 */
export function webviewState<T>(defaults: T): {
  get(): T;
  set(next: T | ((prev: T) => T)): T;
  patch(partial: Partial<T>): T;
} {
  const api = vscodeApi();
  const init = (): T => ({ ...defaults, ...((api.getState() as T | undefined) ?? {}) });
  return {
    get: init,
    set(next) {
      const current = init();
      const value = typeof next === 'function' ? (next as (p: T) => T)(current) : next;
      api.setState(value);
      return value;
    },
    patch(partial) {
      const current = init();
      const value = { ...current, ...partial };
      api.setState(value);
      return value;
    },
  };
}
