// Shared RPC contract between extension and webview.
// Types defined here flow into both sides.

export interface DashboardApi {
  getInfo(): Promise<{ workspace: string | null; vscodeVersion: string }>;
  showMessage(text: string): Promise<void>;
  listFiles(pattern: string): Promise<string[]>;
}
