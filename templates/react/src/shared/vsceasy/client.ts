// Webview-safe exports only — does NOT import 'vscode'.
export {
  createRpcClient,
  vscodeApiTransport,
  connectWebview,
} from './rpc';
export type { RpcClient, Handlers, Transport } from './rpc';
