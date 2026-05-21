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

export type Handlers = Record<string, (...args: any[]) => any | Promise<any>>;

export function createRpcServer<H extends Handlers>(transport: Transport, handlers: H) {
  const off = transport.onMessage(async (msg) => {
    if (msg.kind !== 'call') return;
    const fn = handlers[msg.method];
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
  [K in keyof H]: (...args: Parameters<H[K]>) => Promise<Awaited<ReturnType<H[K]>>>;
} & {
  on(topic: string, handler: (payload: any) => void): () => void;
};

export function createRpcClient<H extends Handlers>(transport: Transport): RpcClient<H> {
  const pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
  const listeners = new Map<string, Set<(p: any) => void>>();

  transport.onMessage((msg) => {
    if (msg.kind === 'result') {
      const p = pending.get(msg.id);
      if (!p) return;
      pending.delete(msg.id);
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
          pending.set(id, { resolve, reject });
          transport.send({ id, kind: 'call', method: prop, args });
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
  function acquireVsCodeApi(): { postMessage(m: any): void };
}

/** One-liner for webview: returns a typed RPC client. */
export function connectWebview<H extends Handlers>(): RpcClient<H> {
  const vscode = acquireVsCodeApi();
  return createRpcClient<H>(vscodeApiTransport(vscode));
}
