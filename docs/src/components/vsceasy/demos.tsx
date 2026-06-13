import React, { useState } from 'react';
import Preview from './Preview';
// Synced verbatim from templates/_generators/components (source of truth).
import { Button } from './generated/Button';
import { Input } from './generated/Input';
import { Field } from './generated/Field';
import { Card } from './generated/Card';
import { List } from './generated/List';
import './generated/components.css';

const row = { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' as const, alignItems: 'center' };

export function ButtonDemo() {
  const [count, setCount] = useState(0);
  return (
    <Preview label="Button — primary + secondary variants">
      <div style={row}>
        <Button onClick={() => setCount((c) => c + 1)}>Primary</Button>
        <Button variant="secondary" onClick={() => setCount((c) => c + 1)}>Secondary</Button>
        <Button disabled>Disabled</Button>
        <span style={{ color: 'var(--vscode-descriptionForeground)' }}>clicked {count}×</span>
      </div>
    </Preview>
  );
}

export function InputDemo() {
  const [value, setValue] = useState('');
  return (
    <Preview label="Input — themed text field">
      <div style={{ maxWidth: '20rem' }}>
        <Input value={value} onChange={(e) => setValue(e.target.value)} placeholder="Type something…" />
      </div>
    </Preview>
  );
}

export function FieldDemo() {
  const [email, setEmail] = useState('not-an-email');
  const invalid = email.length > 0 && !email.includes('@');
  return (
    <Preview label="Field — label + hint + error">
      <div style={{ maxWidth: '22rem', display: 'grid', gap: '0.25rem' }}>
        <Field label="Username" htmlFor="d-user" hint="Lowercase, no spaces.">
          <Input id="d-user" placeholder="jane" />
        </Field>
        <Field label="Email" htmlFor="d-email" error={invalid ? 'Enter a valid email.' : undefined}>
          <Input id="d-email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>
    </Preview>
  );
}

export function CardDemo() {
  return (
    <Preview label="Card — titled surface with actions">
      <Card title="Settings" actions={<Button variant="secondary">Edit</Button>}>
        <p style={{ margin: 0 }}>
          A bordered surface for grouping content, with an optional title and an
          actions row in the header.
        </p>
      </Card>
    </Preview>
  );
}

export function ListDemo() {
  const [items, setItems] = useState([
    { id: 'u1', name: 'Ada Lovelace' },
    { id: 'u2', name: 'Alan Turing' },
    { id: 'u3', name: 'Grace Hopper' },
  ]);
  const [selected, setSelected] = useState<string | null>('u2');
  return (
    <Preview label="List — selectable, hover-highlighted rows">
      <Card title="Users" actions={<Button variant="secondary" onClick={() => setItems([])}>Clear</Button>}>
        <List
          items={items}
          getKey={(r) => r.id}
          onSelect={(r) => setSelected(r.id)}
          renderItem={(r) => (
            <span style={{ fontWeight: r.id === selected ? 600 : 400 }}>
              {r.name}{r.id === selected ? '  ·  selected' : ''}
            </span>
          )}
          empty="No users yet."
        />
      </Card>
    </Preview>
  );
}
