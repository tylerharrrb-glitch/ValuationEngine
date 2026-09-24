/** Rates panel: registry with computed status badges, update check, and "Update to current rates" with a diff. */
import { useState } from 'react';
import type { RatesRegistry, RatesSnapshot, RateEntry } from '../../domain/rates';
import type { SnapshotDiffRow } from '../../data/registry/registry';
import { stalenessInfo } from '../../data/registry/registry';
import { fmtNumber, fmtPct } from '../../export/format';
import { Section, StatusBadge } from '../components/common';

export function valueText(e: Pick<RateEntry, 'value' | 'unit'>): string {
  if (Array.isArray(e.value)) return e.unit === 'date_list' ? (e.value as string[]).join(', ') : `Table, ${e.value.length} rows`;
  if (typeof e.value === 'number') return e.unit === 'pct' ? fmtPct(e.value, 3) : fmtNumber(e.value, 4);
  return String(e.value);
}

export function RegistryTable({ entries, today }: { entries: RateEntry[]; today: string }) {
  const cal = (entries.find((e) => e.id === 'cbe.mpcCalendar')?.value as string[]) ?? [];
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl">
        <thead><tr><th>Rate</th><th className="num">Value</th><th>Nature</th><th>Status</th><th>Source</th><th>Notes</th></tr></thead>
        <tbody>
          {entries.map((e) => {
            const s = stalenessInfo(e, today, cal);
            return (
              <tr key={e.id}>
                <td>{e.label}<div className="muted" style={{ fontSize: 11 }}>{e.id}</div></td>
                <td className="num">{valueText(e)}</td>
                <td>{e.nature}</td>
                <td><StatusBadge status={s.status} /><div className="muted" style={{ fontSize: 11 }}>{s.badge}</div></td>
                <td style={{ fontSize: 12 }}>{e.sourceName}<div>{e.sourceUrl === 'TO_VERIFY' ? <span className="warn">TO_VERIFY</span> : <a href={e.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text2)' }}>{e.sourceUrl}</a>}</div></td>
                <td className="muted" style={{ fontSize: 11, maxWidth: 360 }}>{e.notes}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  registry: RatesRegistry;
  originText: string;
  loading: boolean;
  refresh: () => void;
  snapshot: RatesSnapshot | null;
  diff: (r: RatesRegistry) => SnapshotDiffRow[];
  apply: (r: RatesRegistry) => void;
}

export function RatesPage({ registry, originText, loading, refresh, snapshot, diff, apply }: Props) {
  const [pending, setPending] = useState<SnapshotDiffRow[] | null>(null);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div>
      <Section title="Rates registry" right={<button className="btn" onClick={refresh} disabled={loading}>{loading ? 'Checking' : 'Check for updates'}</button>}>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>{originText}. Statuses are computed for today ({today}) from each entry's update cycle.</p>
        <RegistryTable entries={registry.entries} today={today} />
      </Section>
      {snapshot && (
        <Section title="This valuation's rates snapshot" right={<button className="btn" onClick={() => setPending(diff(registry))}>Update to current rates</button>}>
          <p>Snapshot {snapshot.snapshotId}, frozen {snapshot.frozenAt}. The valuation keeps these values until you update.</p>
          {pending && (
            pending.length === 0 ? <p className="muted">No differences between the snapshot and the current registry.</p> : (
              <>
                <table className="tbl">
                  <thead><tr><th>Rate</th><th className="num">Snapshot</th><th>As of</th><th className="num">Current</th><th>As of</th></tr></thead>
                  <tbody>{pending.map((r) => (
                    <tr key={r.id}><td>{r.label}<div className="muted" style={{ fontSize: 11 }}>{r.id}</div></td>
                      <td className="num">{r.oldValue === null ? 'none' : valueText({ value: r.oldValue, unit: registry.entries.find((e) => e.id === r.id)?.unit ?? 'text' })}</td><td>{r.oldAsOf}</td>
                      <td className="num">{r.newValue === null ? 'none' : valueText({ value: r.newValue, unit: registry.entries.find((e) => e.id === r.id)?.unit ?? 'text' })}</td><td>{r.newAsOf}</td></tr>
                  ))}</tbody>
                </table>
                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-primary" onClick={() => { apply(registry); setPending(null); }}>Apply current rates</button>
                  <button className="btn" onClick={() => setPending(null)}>Keep snapshot</button>
                </div>
              </>
            )
          )}
        </Section>
      )}
    </div>
  );
}
