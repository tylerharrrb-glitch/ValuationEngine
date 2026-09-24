/** Saved valuations (IndexedDB, this browser only) with JSON export and import. */
import { useEffect, useRef, useState } from 'react';
import { Section } from '../components/common';
import { deleteSaved, downloadBlob, listSaved, readJsonFile, saveValuation, type SavedValuation } from '../state/storage';
import type { Session } from '../state/session';

export function SavedPage({ session, onOpen }: { session: Session | null; onOpen: (s: Session) => void }) {
  const [items, setItems] = useState<SavedValuation[]>([]);
  const [msg, setMsg] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const reload = () => listSaved().then((x) => setItems(x.sort((a, b) => b.savedAt.localeCompare(a.savedAt)))).catch((e) => setMsg(String(e)));
  useEffect(() => void reload(), []);
  const save = async () => {
    if (!session) return;
    await saveValuation({ ...session, savedAt: new Date().toISOString() });
    setMsg(`Saved "${session.name}".`);
    reload();
  };
  return (
    <Section title="Saved valuations (this browser only)" right={
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={save} disabled={!session}>Save current valuation</button>
        <button className="btn" onClick={() => file.current?.click()}>Import JSON</button>
        <input ref={file} type="file" accept="application/json" hidden onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          const v = await readJsonFile<SavedValuation>(f);
          if (!v?.company || !v?.assumptions || !v?.snapshot) { setMsg('Not a WOLF valuation file.'); return; }
          await saveValuation({ ...v, id: v.id ?? `import-${Date.now()}`, savedAt: new Date().toISOString() });
          reload();
        }} />
      </div>
    }>
      {msg && <p className="muted">{msg}</p>}
      {items.length === 0 ? <p className="muted">No saved valuations.</p> : (
        <table className="tbl">
          <thead><tr><th>Name</th><th>Company</th><th>Saved</th><th>Rates snapshot</th><th /></tr></thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.company.name} ({s.company.ticker})</td><td>{s.savedAt.slice(0, 16).replace('T', ' ')}</td><td>{s.snapshot.snapshotId}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className="btn" onClick={() => onOpen({ id: s.id, name: s.name, company: s.company, assumptions: s.assumptions, secondary: s.secondary, snapshot: s.snapshot })}>Open</button>{' '}
                  <button className="btn" onClick={() => downloadBlob(JSON.stringify(s, null, 2), `${s.name.replace(/\W+/g, '_')}.json`, 'application/json')}>Export JSON</button>{' '}
                  <button className="btn" onClick={async () => { await deleteSaved(s.id); reload(); }}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted" style={{ fontSize: 12 }}>Opening a saved valuation uses its own rates snapshot. Use "Update to current rates" on the Rates tab to see the differences before applying them.</p>
    </Section>
  );
}
