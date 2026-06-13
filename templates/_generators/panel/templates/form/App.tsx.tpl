import React, { useState } from 'react';
import { Button, Input, Field, Card } from '../../components';
import '../../components/components.css';
{{apiBlock}}
export function App() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      {{submitCall}}
      setStatus('Saved.');
      setName('');
      setEmail('');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <h1>{{title}}</h1>
      <Card title="New entry">
        <form onSubmit={onSubmit}>
          <Field label="Name" htmlFor="name">
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" required />
          </Field>
          <Field label="Email" htmlFor="email">
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.io" />
          </Field>
          <Button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
          {status ? <span style={{ marginLeft: '0.75rem' }}>{status}</span> : null}
        </form>
      </Card>
    </div>
  );
}
