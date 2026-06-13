import { useCallback, useEffect, useState } from 'react';
import { connectWebview } from '../../../shared/vsceasy/client';
import type { {{Name}}FormApi } from '../../../shared/api';
import type { {{Name}} } from '../../../models/{{Name}}';

const api = connectWebview<{{Name}}FormApi>();

type FormState = Partial<{{Name}}>;

const emptyForm: FormState = {{emptyFormLiteral}};

// `<input type="date">` only accepts a `yyyy-MM-dd` value. Stored dates may be
// ISO strings or Date objects, so normalize before binding to the input.
function toDateInput(v: unknown): string {
  if (v == null || v === '') return '';
  const d = v instanceof Date ? v : new Date(v as string);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

export function App() {
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<{{Name}}['{{primaryKey}}'] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (initial: boolean) => {
    // The list stashes a row id before revealing this panel. Pull it (the host
    // clears it after handing it over).
    const id = await api.pendingId();
    if (id == null || id === '') {
      // No row was requested. On the first mount, start with an empty "new" form.
      // On later reveals (focus/visibility), DON'T reset — that would wipe a form
      // the user is busy filling in. Just leave the current state as-is.
      if (initial) {
        setForm(emptyForm);
        setEditingId(null);
      }
      return;
    }
    // The list asked to edit a specific row — load it, replacing the current form.
    const row = await api.get(id);
    if (row) {
      setForm(row);
      setEditingId(row.{{primaryKey}});
    }
  }, []);

  useEffect(() => {
    void load(true);
    // Webviews retain state when hidden, so re-check on reveal: the list may have
    // asked to edit a different row. When nothing is pending, `load` leaves the
    // in-progress form untouched (see above).
    const onFocus = () => { void load(false); };
    const onVisible = () => { if (document.visibilityState === 'visible') void load(false); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const onChange = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const wasNew = editingId == null;
      await api.save(form as {{Name}});
      // After creating a new row, reset for the next entry. After an edit, keep
      // the row loaded so further tweaks are possible.
      if (wasNew) {
        setForm(emptyForm);
        setEditingId(null);
      }
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
