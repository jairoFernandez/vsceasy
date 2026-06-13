import { useEffect, useState, useCallback } from 'react';
import { connectWebview } from '../../../shared/vsceasy/client';
import type { {{Plural}}ListApi } from '../../../shared/api';
import type { {{Name}} } from '../../../models/{{Name}}';

const api = connectWebview<{{Plural}}ListApi>();

export function App() {
  const [rows, setRows] = useState<{{Name}}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await api.list());
      setError(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // Webviews keep their state when hidden (retainContextWhenHidden), so the
    // mount effect won't re-run when the panel is revealed again. Reload when the
    // webview regains focus/visibility so edits made in another panel show up.
    const onFocus = () => { void reload(); };
    const onVisible = () => { if (document.visibilityState === 'visible') void reload(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [reload]);

  const onDelete = async (id: {{Name}}['{{primaryKey}}']) => {
    // `confirm()` is disabled inside VS Code webviews — confirmation happens in
    // the host (the `delete` RPC handler shows a modal). Just call + reload.
    await api.delete(id);
    await reload();
  };

  return (
    <div style={{ padding: 16, color: 'var(--vscode-foreground)' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>{{title}}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => void reload()} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
          <button onClick={() => api.openForm()}>+ New</button>
        </div>
      </header>

      {error && <div style={{ color: 'var(--vscode-errorForeground)', marginBottom: 8 }}>{error}</div>}
      {loading ? <div>Loading…</div> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--vscode-panel-border)' }}>
{{listHeaderCells}}
              <th style={{ padding: '6px 8px' }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={{{listColCount}}} style={{ padding: 16, opacity: 0.6 }}>No rows yet.</td></tr>
            )}
            {rows.map((r) => (
              <tr key={String(r.{{primaryKey}})} style={{ borderBottom: '1px solid var(--vscode-panel-border)' }}>
{{listBodyCells}}
                <td style={{ padding: '6px 8px', whiteSpace: 'nowrap' }}>
                  <button onClick={() => api.openForm(r.{{primaryKey}})}>Edit</button>{' '}
                  <button onClick={() => onDelete(r.{{primaryKey}})}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
