// RPC contracts — one interface per panel. Imported by both extension and webview.

export interface DashboardApi {
  getInfo(): Promise<{ workspace: string | null; vscodeVersion: string }>;
  showMessage(text: string): Promise<void>;
  listFiles(pattern: string): Promise<string[]>;
}
