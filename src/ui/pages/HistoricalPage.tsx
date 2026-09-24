/** Historical quality scores, credit metrics and EAS references (only standards evidenced by the statements). */
import type { ValuationResult } from '../../engine/valuation';
import { fmtAmount, fmtMultiple, fmtNumber, fmtPctFrac } from '../../export/format';
import { Section } from '../components/common';

export function HistoricalPage({ v }: { v: ValuationResult }) {
  const p = v.piotroski;
  const du = v.dupont;
  const cr = v.credit;
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 16 }}>
        <Section title="Piotroski F-score">
          {p.available ? (
            <>
              <table className="tbl">
                <thead><tr><th>Test</th><th className="num">Current</th><th className="num">Prior</th><th className="num">Score</th></tr></thead>
                <tbody>
                  {p.tests.map((t) => <tr key={t.id}><td>{t.name}</td><td className="num">{fmtNumber(t.current, 4)}</td><td className="num">{t.prior === null ? '' : fmtNumber(t.prior, 4)}</td><td className="num">{t.score}</td></tr>)}
                  <tr className="total"><td>F-score (of 9)</td><td /><td /><td className="num">{p.score}</td></tr>
                </tbody>
              </table>
              <p className="muted" style={{ fontSize: 12 }}>{p.variant}</p>
            </>
          ) : <p className="muted">N/A: {p.reason}</p>}
        </Section>
        <Section title="Altman Z''-EM">
          <table className="tbl">
            <thead><tr><th></th>{v.zScores.map((z) => <th key={z.fiscalYear} className="num">FY{z.fiscalYear}</th>)}</tr></thead>
            <tbody>
              {(['x1', 'x2', 'x3', 'x4'] as const).map((k) => <tr key={k}><td>{{ x1: 'X1 working capital / total assets', x2: 'X2 retained earnings / total assets', x3: 'X3 EBIT / total assets', x4: 'X4 book equity / total liabilities' }[k]}</td>{v.zScores.map((z) => <td key={z.fiscalYear} className="num">{fmtNumber(z[k], 4)}</td>)}</tr>)}
              <tr className="total"><td>Score</td>{v.zScores.map((z) => <td key={z.fiscalYear} className="num">{fmtNumber(z.score, 2)}</td>)}</tr>
              <tr><td>Zone</td>{v.zScores.map((z) => <td key={z.fiscalYear} className="num">{z.zone}</td>)}</tr>
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 12 }}>{v.zScores[0]?.variant}. Safe above 5.85, grey 4.35 to 5.85, distress below 4.35.</p>
        </Section>
        <Section title={`DuPont FY${du.fiscalYear}`}>
          <table className="tbl"><tbody>
            <tr><td>Net margin</td><td className="num">{fmtPctFrac(du.netMargin)}</td></tr>
            <tr><td>Asset turnover</td><td className="num">{fmtNumber(du.assetTurnover, 4)}</td></tr>
            <tr><td>Equity multiplier</td><td className="num">{fmtNumber(du.equityMultiplier, 4)}</td></tr>
            <tr className="total"><td>ROE (3-step)</td><td className="num">{fmtPctFrac(du.roe3)}</td></tr>
            <tr><td>Tax burden</td><td className="num">{fmtNumber(du.taxBurden, 4)}</td></tr>
            <tr><td>Interest burden</td><td className="num">{fmtNumber(du.interestBurden, 4)}</td></tr>
            <tr><td>EBIT margin</td><td className="num">{fmtPctFrac(du.ebitMargin)}</td></tr>
            <tr className="total"><td>ROE (5-step)</td><td className="num">{fmtPctFrac(du.roe5)}</td></tr>
          </tbody></table>
          <p className="muted" style={{ fontSize: 12 }}>{du.averageBalances ? 'Average balances.' : 'Year-end balances (one year available).'}</p>
        </Section>
        <Section title={`Credit metrics FY${cr.fiscalYear}`}>
          <table className="tbl"><tbody>
            <tr><td>Interest-bearing debt (incl. leases)</td><td className="num">{fmtAmount(cr.interestBearingDebt)}</td></tr>
            <tr><td>Cash and investments</td><td className="num">{fmtAmount(cr.cashAndInvestments)}</td></tr>
            <tr><td>Net debt</td><td className="num">{fmtAmount(cr.netDebt)}</td></tr>
            <tr><td>Net debt / EBITDA</td><td className="num">{fmtMultiple(cr.netDebtToEbitda, 2)}</td></tr>
            <tr><td>Interest cover (debt and lease interest)</td><td className="num">{Number.isFinite(cr.interestCover) ? fmtMultiple(cr.interestCover, 1) : 'n/a'}</td></tr>
            <tr><td>FFO / debt</td><td className="num">{Number.isFinite(cr.ffoToDebt) ? fmtMultiple(cr.ffoToDebt, 1) : 'n/a'}</td></tr>
          </tbody></table>
          {cr.notes.map((n) => <p key={n} className="muted" style={{ fontSize: 12 }}>{n}</p>)}
        </Section>
      </div>
      <Section title="FX sensitivity">
        {v.fx.available ? (
          <table className="tbl"><thead><tr><th>Move</th><th className="num">Value per share</th><th className="num">Change</th></tr></thead>
            <tbody>{v.fx.rows.map((r) => <tr key={r.move}><td>{r.label}</td><td className="num">{fmtNumber(r.perShare, 2)}</td><td className={`num ${r.change > 0 ? 'pos' : r.change < 0 ? 'neg' : ''}`}>{fmtPctFrac(r.change, 1)}</td></tr>)}</tbody>
          </table>
        ) : <p className="muted">Not computed: {v.fx.reason} Set it under Assumptions, section 7.</p>}
      </Section>
      <Section title="Egyptian Accounting Standards reflected in the statement lines">
        {v.eas.length === 0 ? <p className="muted">No EAS-specific lines present.</p> : v.eas.map((e) => <p key={e.standard}><strong>{e.standard}</strong> ({e.topic}): {e.text}</p>)}
      </Section>
    </div>
  );
}
