/** Raw-input editors for peers, transactions, segments, broker targets and key risks, with results. */
import type { ReactNode } from 'react';
import type { SecondaryInputs, PeerInput, TransactionInput, SegmentInput, BrokerTarget } from '../../domain/secondary';
import type { ValuationResult } from '../../engine/valuation';
import { fmtAmount, fmtMultiple, fmtPerShare } from '../../export/format';
import { Section, NumInput, TextInput } from '../components/common';

interface Props {
  s: SecondaryInputs;
  set: (fn: (s: SecondaryInputs) => SecondaryInputs) => void;
  v: ValuationResult | null;
  today: string;
}

type Col<T> = { key: keyof T; label: string; kind: 'text' | 'num' | 'date' };

function Editor<T>({ rows, cols, onChange, make, addLabel }: { rows: T[]; cols: Col<T>[]; onChange: (rows: T[]) => void; make: () => T; addLabel: string }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tbl">
        <thead><tr>{cols.map((c) => <th key={String(c.key)} className={c.kind === 'num' ? 'num' : ''}>{c.label}</th>)}<th /></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {cols.map((c) => (
                <td key={String(c.key)} style={{ minWidth: c.kind === 'num' ? 120 : 140 }}>
                  {c.kind === 'num'
                    ? <NumInput value={r[c.key] as unknown as number | null} nullable onChange={(val) => onChange(rows.map((x, j) => (j === i ? { ...x, [c.key]: val } : x)))} ariaLabel={`${c.label} row ${i + 1}`} />
                    : <TextInput type={c.kind === 'date' ? 'date' : 'text'} value={String(r[c.key] ?? '')} onChange={(val) => onChange(rows.map((x, j) => (j === i ? { ...x, [c.key]: val } : x)))} ariaLabel={`${c.label} row ${i + 1}`} />}
                </td>
              ))}
              <td><button className="btn" onClick={() => onChange(rows.filter((_, j) => j !== i))}>Remove</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => onChange([...rows, make()])}>{addLabel}</button>
    </div>
  );
}

function Results({ children }: { children: ReactNode }) {
  return <div style={{ marginTop: 12 }}>{children}</div>;
}

export function RelativePage({ s, set, v, today }: Props) {
  const peerCols: Col<PeerInput>[] = [
    { key: 'name', label: 'Name', kind: 'text' }, { key: 'ticker', label: 'Ticker', kind: 'text' }, { key: 'price', label: 'Price', kind: 'num' }, { key: 'priceDate', label: 'Price date', kind: 'date' },
    { key: 'shares', label: 'Shares', kind: 'num' }, { key: 'debt', label: 'Debt incl. leases', kind: 'num' }, { key: 'cash', label: 'Cash and investments', kind: 'num' }, { key: 'minorityInterest', label: 'Minority interest', kind: 'num' },
    { key: 'revenueLtm', label: 'Revenue LTM', kind: 'num' }, { key: 'ebitdaLtm', label: 'EBITDA LTM', kind: 'num' }, { key: 'ebitdaNtm', label: 'EBITDA NTM', kind: 'num' },
    { key: 'netIncomeLtm', label: 'Net income LTM', kind: 'num' }, { key: 'netIncomeNtm', label: 'Net income NTM', kind: 'num' }, { key: 'bookEquity', label: 'Book equity', kind: 'num' },
    { key: 'source', label: 'Source', kind: 'text' }, { key: 'sourceDate', label: 'Source date', kind: 'date' },
  ];
  const dealCols: Col<TransactionInput>[] = [
    { key: 'target', label: 'Target', kind: 'text' }, { key: 'acquirer', label: 'Acquirer', kind: 'text' }, { key: 'date', label: 'Date', kind: 'date' },
    { key: 'enterpriseValue', label: 'EV', kind: 'num' }, { key: 'revenue', label: 'Revenue', kind: 'num' }, { key: 'ebitda', label: 'EBITDA', kind: 'num' }, { key: 'source', label: 'Source', kind: 'text' },
  ];
  const segCols: Col<SegmentInput>[] = [
    { key: 'name', label: 'Segment', kind: 'text' }, { key: 'ebitda', label: 'EBITDA', kind: 'num' }, { key: 'multiple', label: 'EV/EBITDA', kind: 'num' }, { key: 'value', label: 'Value (if not by multiple)', kind: 'num' }, { key: 'source', label: 'Source', kind: 'text' },
  ];
  const brokerCols: Col<BrokerTarget>[] = [
    { key: 'broker', label: 'Broker', kind: 'text' }, { key: 'target', label: 'Target (EGP)', kind: 'num' }, { key: 'date', label: 'Date', kind: 'date' }, { key: 'rating', label: 'Rating', kind: 'text' }, { key: 'sourceUrl', label: 'Source URL', kind: 'text' },
  ];
  return (
    <div>
      <Section title="Trading comparables (raw inputs; multiples are computed)">
        <Editor rows={s.peers} cols={peerCols} addLabel="Add peer" onChange={(peers) => set((x) => ({ ...x, peers }))}
          make={() => ({ name: '', ticker: '', currency: 'EGP', price: 0, priceDate: today, shares: 0, debt: 0, cash: 0, minorityInterest: 0, revenueLtm: 0, ebitdaLtm: 0, ebitdaNtm: null, netIncomeLtm: 0, netIncomeNtm: null, bookEquity: 0, source: '', sourceDate: today })} />
        {v && (
          <Results>
            {v.comps.peers.length === 0 ? <p className="muted">No peers entered. The method is excluded from the blend; no default peer set is used.</p> : (
              <>
                <table className="tbl">
                  <thead><tr><th>Peer</th><th className="num">EV</th><th className="num">EV/EBITDA LTM</th><th className="num">EV/EBITDA NTM</th><th className="num">P/E LTM</th><th className="num">P/B</th><th className="num">EV/Revenue</th></tr></thead>
                  <tbody>{v.comps.peers.map((p, i) => <tr key={i}><td>{p.name}</td><td className="num">{fmtAmount(p.enterpriseValue)}</td><td className="num">{fmtMultiple(p.evEbitdaLtm)}</td><td className="num">{fmtMultiple(p.evEbitdaNtm)}</td><td className="num">{fmtMultiple(p.peLtm)}</td><td className="num">{fmtMultiple(p.pb)}</td><td className="num">{fmtMultiple(p.evRevenue)}</td></tr>)}</tbody>
                </table>
                {v.comps.implied.map((i) => <p key={i.multiple}>{i.multiple}: {fmtMultiple(i.statistic, 2)} gives <strong className="num">{fmtPerShare(i.perShare)}</strong> per share.</p>)}
              </>
            )}
          </Results>
        )}
      </Section>
      <Section title="Precedent transactions">
        <Editor rows={s.transactions} cols={dealCols} addLabel="Add transaction" onChange={(transactions) => set((x) => ({ ...x, transactions }))}
          make={() => ({ target: '', acquirer: '', date: today, enterpriseValue: 0, revenue: 0, ebitda: 0, currency: 'EGP', source: '' })} />
        {v && <Results>{v.precedents.implied.length === 0 ? <p className="muted">No transactions entered. The method is excluded from the blend.</p> : v.precedents.implied.map((i) => <p key={i.multiple}>{i.multiple}: {fmtMultiple(i.statistic, 2)} gives <strong className="num">{fmtPerShare(i.perShare)}</strong> per share.</p>)}</Results>}
      </Section>
      <Section title="Sum of the parts">
        <Editor rows={s.segments} cols={segCols} addLabel="Add segment" onChange={(segments) => set((x) => ({ ...x, segments: segments.map((g) => ({ ...g, method: g.multiple ? ('multiple' as const) : ('value' as const) })) }))}
          make={() => ({ name: '', method: 'multiple' as const, ebitda: 0, multiple: 0, value: 0, source: '' })} />
        {v && <Results>{v.sotp.segments.length === 0 ? <p className="muted">No segments entered. The method is excluded from the blend.</p> : <p>Segment EV {fmtAmount(v.sotp.enterpriseValue)}; equity {fmtAmount(v.sotp.equityValue)}; <strong className="num">{fmtPerShare(v.sotp.perShare)}</strong> per share.</p>}</Results>}
      </Section>
      <Section title="Broker targets (reference only, never in the blend)">
        <Editor rows={s.brokers} cols={brokerCols} addLabel="Add broker target" onChange={(brokers) => set((x) => ({ ...x, brokers }))} make={() => ({ broker: '', target: 0, date: today, rating: '', sourceUrl: '' })} />
      </Section>
      <Section title="Key risks (appear in the PDF only when entered)">
        {s.risks.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
            <TextInput value={r} onChange={(val) => set((x) => ({ ...x, risks: x.risks.map((q, j) => (j === i ? val : q)) }))} ariaLabel={`Risk ${i + 1}`} />
            <button className="btn" onClick={() => set((x) => ({ ...x, risks: x.risks.filter((_, j) => j !== i) }))}>Remove</button>
          </div>
        ))}
        <button className="btn" onClick={() => set((x) => ({ ...x, risks: [...x.risks, ''] }))}>Add risk</button>
      </Section>
    </div>
  );
}
