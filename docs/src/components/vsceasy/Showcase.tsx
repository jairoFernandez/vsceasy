import React, { useState } from 'react';
import Preview from './Preview';
// Synced verbatim from templates/_generators/components (source of truth).
import { Button } from './generated/Button';
import { Input } from './generated/Input';
import { Field } from './generated/Field';
import { Card } from './generated/Card';
import { List } from './generated/List';
import './generated/components.css';

interface Row {
  id: string;
  name: string;
}

/**
 * Live, interactive preview composing the whole component library into one
 * small CRUD-style screen — the shape a generated panel takes.
 */
export default function Showcase() {
  const [name, setName] = useState('Jane Doe');
  const [email, setEmail] = useState('');
  const [rows, setRows] = useState<Row[]>([
    { id: 'u1', name: 'Ada Lovelace' },
    { id: 'u2', name: 'Alan Turing' },
    { id: 'u3', name: 'Grace Hopper' },
  ]);
  const [selected, setSelected] = useState<string | null>('u2');

  const addRow = () => {
    const n = name.trim() || 'New user';
    setRows((r) => [...r, { id: `u${r.length + 1}`, name: n }]);
  };

  return (
    <Preview label="Live preview · the whole library together">
      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(15rem, 1fr))' }}>
        <Card
          title="New user"
          actions={<Button variant="secondary" onClick={() => { setName(''); setEmail(''); }}>Reset</Button>}
        >
          <Field label="Name" htmlFor="sc-name" hint="Shown in the list.">
            <Input id="sc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Doe" />
          </Field>
          <Field
            label="Email"
            htmlFor="sc-email"
            error={email && !email.includes('@') ? 'Enter a valid email.' : undefined}
          >
            <Input id="sc-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@acme.io" />
          </Field>
          <Button onClick={addRow}>Add to list</Button>
        </Card>

        <Card title="Users">
          <List
            items={rows}
            getKey={(r) => r.id}
            onSelect={(r) => setSelected(r.id)}
            renderItem={(r) => (
              <span style={{ fontWeight: r.id === selected ? 600 : 400 }}>
                {r.name}
                {r.id === selected ? '  ·  selected' : ''}
              </span>
            )}
            empty="No users yet."
          />
        </Card>
      </div>
    </Preview>
  );
}
