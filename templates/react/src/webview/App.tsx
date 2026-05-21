import React, { useEffect, useState } from 'react';
import { createRpcClient, vscodeApiTransport } from '../shared/rpc';
import type { DashboardApi } from '../shared/api';

declare function acquireVsCodeApi(): { postMessage(m: any): void };
const vscode = acquireVsCodeApi();
const api = createRpcClient<DashboardApi>(vscodeApiTransport(vscode));

export function App() {
  const [info, setInfo] = useState<{ workspace: string | null; vscodeVersion: string } | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [pattern, setPattern] = useState('**/*.ts');

  useEffect(() => {
    api.getInfo().then(setInfo);
  }, []);

  const search = async () => {
    setFiles(await api.listFiles(pattern));
  };

  return (
    <div className="app">
      <h1>{{displayName}} Dashboard</h1>
      {info && (
        <section>
          <p><strong>Workspace:</strong> {info.workspace ?? '(none)'}</p>
          <p><strong>VS Code:</strong> {info.vscodeVersion}</p>
        </section>
      )}
      <section>
        <input value={pattern} onChange={(e) => setPattern(e.target.value)} />
        <button onClick={search}>Find files</button>
        <button onClick={() => api.showMessage('Hello from the webview!')}>Toast</button>
        <ul>{files.map((f) => <li key={f}>{f}</li>)}</ul>
      </section>
    </div>
  );
}
