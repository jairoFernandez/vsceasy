import React, { useState } from 'react';
// These are synced verbatim from templates/_generators/components — the exact
// sources `vsceasy components add` writes into a project. See scripts/syncComponents.ts.
import { Button } from './generated/Button';
import { Input } from './generated/Input';
import { Field } from './generated/Field';
import { Card } from './generated/Card';
import { List } from './generated/List';
import './generated/components.css';
import './theme.css';

type Theme = 'dark' | 'light';

interface Row {
  id: string;
  name: string;
}

/**
 * Live, interactive preview of the vsceasy webview component library, rendered
 * with representative VS Code theme tokens. Toggle dark/light to see the same
 * components adapt the way they do inside the editor.
 */
export default function Showcase() {
  const [theme, setTheme] = useState<Theme>('dark');
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
    <div className="vx-frame" data-vx-theme={theme}>
      <div className="vx-frame__bar">
        <span style={{ color: 'var(--vscode-descriptionForeground)' }}>Live preview · VS Code tokens</span>
        <span className="vx-frame__toggle" role="group" aria-label="Preview theme">
          <button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>Dark</button>
          <button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>Light</button>
        </span>
      </div>

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
    </div>
  );
}
