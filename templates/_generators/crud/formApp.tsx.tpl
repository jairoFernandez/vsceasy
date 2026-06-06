import { useEffect, useState } from 'react';
import { connectWebview } from '../../../shared/vsceasy/client';
import type { {{Name}}FormApi } from '../../../shared/api';
import type { {{Name}} } from '../../../models/{{Name}}';

const api = connectWebview<{{Name}}FormApi>();

type FormState = Partial<{{Name}}>;

const emptyForm: FormState = {{emptyFormLiteral}};

export function App() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<{{Name}}['{{primaryKey}}'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Panel may be opened with `executeCommand('...openXForm', id)`.
    // VS Code forwards args via the openWith pattern — here we just listen
    // for an `init` event the panel emits, if you wire one. For now, the form
    // starts empty; load by id from a host helper if you need pre-fill.
  }, []);

  const onChange = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = await api.save(form as {{Name}});
      setEditingId(saved.{{primaryKey}});
    } catch (err: any) {
      setError(String(err?.message ?? err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} style={{ padding: 16, display: 'grid', gap: 12, color: 'var(--vscode-foreground)' }}>
      <h2 style={{ margin: 0 }}>{editingId ? 'Edit {{title}}' : 'New {{title}}'}</h2>
{{formFieldInputs}}
      {error && <div style={{ color: 'var(--vscode-errorForeground)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        <button type="button" onClick={() => { setForm(emptyForm); setEditingId(null); }}>Reset</button>
      </div>
    </form>
  );
}
