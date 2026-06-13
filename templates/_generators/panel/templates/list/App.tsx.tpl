import React, { useEffect, useState } from 'react';
import { Button, List, Card } from '../../components';
import '../../components/components.css';
{{apiBlock}}
interface Row {
  id: string;
  label: string;
}

export function App() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    try {
      {{loadCall}}
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
      <Card title="Items" actions={<Button variant="secondary" onClick={refresh} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</Button>}>
        <List
          items={rows}
          getKey={(r) => r.id}
          renderItem={(r) => r.label}
          empty="No items yet."
        />
      </Card>
    </div>
  );
}
