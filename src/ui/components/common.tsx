/** Shared UI building blocks: clickable figures with audit drawer, inputs, badges, sections. */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { EngineMessage } from '../../domain/result';
import type { RateStatus } from '../../domain/rates';
import { fmtAbbrev, fmtAmount, fmtMultiple, fmtNumber, fmtPct, fmtPctFrac, fmtPerShare } from '../../export/format';

export interface AuditRate {
  id: string;
  label: string;
  sourceName: string;
  sourceUrl: string;
  asOf: string;
  status: string;
  overridden?: boolean;
  reason?: string | null;
}

export interface AuditEntry {
  title: string;
  value: string;
  formula: string;
  inputs?: { label: string; value: string }[];
  rates?: AuditRate[];
  note?: string;
}

const AuditCtx = createContext<(e: AuditEntry) => void>(() => undefined);

export function AuditProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<AuditEntry | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setEntry(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <AuditCtx.Provider value={setEntry}>
      {children}
      {entry && (
        <aside className="drawer" role="dialog" aria-label="Calculation audit" data-testid="audit-panel">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12 }}>
            <h2 className="section-title" style={{ flex: 1 }}>{entry.title}</h2>
            <button className="btn" onClick={() => setEntry(null)} aria-label="Close audit panel">Close</button>
          </div>
          <div className="display key-figure" style={{ fontSize: 26, margin: '4px 0 12px' }}>{entry.value}</div>
          <div className="label">Formula</div>
          <p style={{ marginTop: 4 }}>{entry.formula}</p>
          {entry.inputs && entry.inputs.length > 0 && (
            <table className="tbl" style={{ marginTop: 8 }}>
              <thead><tr><th>Input</th><th className="num">Value</th></tr></thead>
              <tbody>{entry.inputs.map((i, k) => <tr key={k}><td>{i.label}</td><td className="num">{i.value}</td></tr>)}</tbody>
            </table>
          )}
          {entry.rates && entry.rates.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div className="label">Rates</div>
              {entry.rates.map((r) => (
                <div key={r.id} className="panel" style={{ marginTop: 8, padding: 10 }}>
                  <div><strong>{r.label}</strong> <StatusBadge status={r.status as RateStatus} /></div>
                  <div className="muted" style={{ fontSize: 12 }}>{r.id}</div>
                  <div style={{ fontSize: 13, marginTop: 4 }}>Source: {r.sourceName}</div>
                  <div style={{ fontSize: 13 }}>URL: {r.sourceUrl === 'TO_VERIFY' ? 'TO_VERIFY' : <a href={r.sourceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--text)' }}>{r.sourceUrl}</a>}</div>
                  <div style={{ fontSize: 13 }}>As of: {r.asOf}</div>
                  {r.overridden && <div className="warn" style={{ fontSize: 13 }}>Analyst override: {r.reason}</div>}
                </div>
              ))}
            </div>
          )}
          {entry.note && <p className="muted" style={{ marginTop: 12 }}>{entry.note}</p>}
        </aside>
      )}
    </AuditCtx.Provider>
  );
}

export const useAudit = () => useContext(AuditCtx);

export type FigKind = 'amount' | 'abbrev' | 'pershare' | 'pct' | 'pctFrac' | 'multiple' | 'ratio' | 'ratio4' | 'int';

export function fmt(v: number | null | undefined, kind: FigKind): string {
  switch (kind) {
    case 'amount': return fmtAmount(v);
    case 'abbrev': return fmtAbbrev(v);
    case 'pershare': return fmtPerShare(v);
    case 'pct': return fmtPct(v);
    case 'pctFrac': return fmtPctFrac(v);
    case 'multiple': return fmtMultiple(v, 2);
    case 'ratio': return fmtNumber(v, 2);
    case 'ratio4': return fmtNumber(v, 4);
    case 'int': return fmtNumber(v, 0);
  }
}

/** A computed figure: click opens the audit panel. */
export function Fig({ v, kind, audit, className = '', signed = false, testId }: { v: number | null | undefined; kind: FigKind; audit: Omit<AuditEntry, 'value'> & { value?: string }; className?: string; signed?: boolean; testId?: string }) {
  const open = useAudit();
  const text = fmt(v, kind);
  const cls = signed && typeof v === 'number' && Number.isFinite(v) ? (v > 0 ? 'pos' : v < 0 ? 'neg' : '') : '';
  return (
    <span role="button" tabIndex={0} data-testid={testId} className={`fig num ${cls} ${className}`}
      onClick={() => open({ ...audit, value: audit.value ?? text })}
      onKeyDown={(e) => e.key === 'Enter' && open({ ...audit, value: audit.value ?? text })}>
      {text}
    </span>
  );
}

export function StatusBadge({ status }: { status: RateStatus }) {
  const label = status === 'ok' ? 'Current' : status === 'stale' ? 'Stale' : status === 'fetch_failed' ? 'Fetch failed' : 'Unconfirmed';
  return <span className={`badge ${status}`}>{label}</span>;
}

export function Section({ title, children, right }: { title: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="panel" style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
        <h2 className="section-title" style={{ flex: 1 }}>{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Messages({ items }: { items: EngineMessage[] }) {
  if (!items.length) return null;
  return (
    <div style={{ margin: '8px 0' }}>
      {items.map((m, i) => (
        <div key={i} className={`msg ${m.severity}`}>
          <span className={m.severity === 'error' ? 'neg' : m.severity === 'warning' ? 'warn' : 'muted'}>{m.severity === 'error' ? 'Error' : m.severity === 'warning' ? 'Warning' : 'Note'}</span>: {m.text}
        </div>
      ))}
    </div>
  );
}

/** Numeric input that commits on blur or Enter. `null` allowed when `nullable`. */
export function NumInput({ value, onChange, nullable = false, step, width, ariaLabel, testId }: { value: number | null; onChange: (v: number | null) => void; nullable?: boolean; step?: number; width?: number; ariaLabel?: string; testId?: string }) {
  const [text, setText] = useState(value === null || value === undefined || !Number.isFinite(value) ? '' : String(round(value)));
  useEffect(() => setText(value === null || value === undefined || !Number.isFinite(value) ? '' : String(round(value))), [value]);
  const commit = () => {
    const t = text.replace(/,/g, '').trim();
    if (t === '') {
      if (nullable) onChange(null);
      else setText(value === null ? '' : String(round(value)));
      return;
    }
    const n = Number(t);
    if (Number.isFinite(n)) onChange(n);
    else setText(value === null ? '' : String(round(value)));
  };
  return (
    <input className="input num" inputMode="decimal" type="text" value={text} step={step} aria-label={ariaLabel} data-testid={testId}
      style={width ? { width } : undefined}
      onChange={(e) => setText(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
  );
}

function round(v: number) {
  return Math.abs(v) >= 1000 ? Math.round(v * 100) / 100 : Math.round(v * 1e6) / 1e6;
}

export function TextInput({ value, onChange, ariaLabel, type = 'text', testId, width }: { value: string; onChange: (v: string) => void; ariaLabel?: string; type?: string; testId?: string; width?: number | string }) {
  return <input className="input" type={type} value={value} aria-label={ariaLabel} data-testid={testId} style={{ width: width ?? '100%' }} onChange={(e) => onChange(e.target.value)} />;
}

export function Select<T extends string>({ value, options, onChange, ariaLabel }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; ariaLabel?: string }) {
  return (
    <select className="input" value={value} aria-label={ariaLabel} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /> {label}
    </label>
  );
}

/** Label / control row used in forms. */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 280px) minmax(0, 1fr)', gap: 12, alignItems: 'center', padding: '4px 0' }}>
      <div>
        <div>{label}</div>
        {hint && <div className="muted" style={{ fontSize: 12 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function TagNote({ tag, note }: { tag: string; note: string }) {
  return <div className="muted" style={{ fontSize: 12 }}>{tag}. {note}</div>;
}
