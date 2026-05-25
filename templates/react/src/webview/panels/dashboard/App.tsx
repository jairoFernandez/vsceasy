import React, { useEffect, useState } from 'react';
import { connectWebview } from '../../../shared/vsceasy/client';
import type { DashboardApi } from '../../../shared/api';

const api = connectWebview<DashboardApi>();

export function App() {
  const [info, setInfo] = useState<{ workspace: string | null; vscodeVersion: string } | null>(null);
  const [files, setFiles] = useState<string[]>([]);
  const [pattern, setPattern] = useState('**/*.ts');

  useEffect(() => { api.getInfo().then(setInfo); }, []);

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
        <button onClick={async () => setFiles(await api.listFiles(pattern))}>Find files</button>
        <button onClick={() => api.showMessage('Hello from the webview!')}>Toast</button>
        <ul>{files.map((f) => <li key={f}>{f}</li>)}</ul>
      </section>
    </div>
  );
}
