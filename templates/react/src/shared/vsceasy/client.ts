// Webview-safe exports only — does NOT import 'vscode'.
export {
  createRpcClient,
  vscodeApiTransport,
  connectWebview,
  webviewState,
} from './rpc';
export type { RpcClient, Handlers, Transport, RpcClientOptions, WebviewApi } from './rpc';
