// Webview-safe exports only — does NOT import 'vscode'.
export {
  createRpcClient,
  vscodeApiTransport,
  connectWebview,
  webviewState,
} from './rpc';
export type { RpcClient, Handlers, Transport, RpcClientOptions, WebviewApi } from './rpc';

export { defineStore } from './store';
export type { Store } from './store';

import type { RpcClient, Handlers } from './rpc';

/**
 * Listen for a change pushed from the host over the RPC event channel, and run a
 * callback when it arrives. This is the webview side of the reactivity model —
 * the host emits with `server.emit(topic, …)` (usually wired via `watch()` /
 * `watchEntity()`), and your visual element reacts here. Returns an unsubscribe
 * function; call it on unmount.
 *
 *   const api = connectWebview<TodoStatsViewApi>();
 *   // re-read + re-render whenever todos change on the host:
 *   const off = listen(api, 'todos:changed', () => refresh());
 *
 * It's a thin, named wrapper over `api.on(topic, handler)` so the place you
 * listen reads clearly in the UI code. The payload (if any) is passed through.
 */
export function listen<H extends Handlers>(
  api: RpcClient<H>,
  topic: string,
  handler: (payload?: unknown) => void,
): () => void {
  return api.on(topic, handler);
}
