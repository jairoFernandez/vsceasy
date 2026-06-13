import React, { useEffect, useState } from 'react';
import { Button, Card } from '../../components';
import '../../components/components.css';
{{apiBlock}}
interface Stats {
  total: number;
  active: number;
  updatedAt: string;
}

export function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      {{statsCall}}
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <div className="app">
      <h1>{{title}}</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(8rem, 1fr))', gap: '0.75rem' }}>
        <Card title="Total"><strong style={{ fontSize: '1.5rem' }}>{stats?.total ?? '—'}</strong></Card>
        <Card title="Active"><strong style={{ fontSize: '1.5rem' }}>{stats?.active ?? '—'}</strong></Card>
        <Card title="Updated"><span>{stats?.updatedAt ?? '—'}</span></Card>
      </div>
      <div style={{ marginTop: '0.75rem' }}>
        <Button variant="secondary" onClick={refresh} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>
      </div>
    </div>
  );
}
