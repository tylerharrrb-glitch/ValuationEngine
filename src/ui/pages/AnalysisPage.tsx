/** Sensitivity grids, scenarios, Monte Carlo, reverse DCF and the USD consistency check. */
import type { ValuationResult } from '../../engine/valuation';
import { fmtAmount, fmtMultiple, fmtNumber, fmtPct, fmtPctFrac, fmtPerShare } from '../../export/format';
import { Section, useAudit } from '../components/common';

export function AnalysisPage({ v }: { v: ValuationResult }) {
  const open = useAudit();
  const mc = v.monteCarlo;
  const u = v.usd;
  const rv = v.reverse;
  const axis = (id: string, x: number, isRow: boolean) =>
    id === 'wacc_exit' && !isRow ? fmtMultiple(x, 1) : id === 'rf_beta' && !isRow ? fmtNumber(x, 2) : id === 'growth_margin' ? `${x >= 0 ? '+' : ''}${x.toFixed(1)}pp` : fmtPct(x);
  const maxCount = mc ? Math.max(...mc.histogram.map((h) => h.count), 1) : 1;
  return (
    <div>
      <Section title="Sensitivity (value per share, EGP; base case at the centre)">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 16 }}>
          {v.sensitivity.map((g) => (
            <div key={g.id}>
              <div className="label" style={{ marginBottom: 4 }}>{g.title}. Rows: {g.rowLabel}. Columns: {g.colLabel}.</div>
              <table className="tbl">
                <thead><tr><th></th>{g.cols.map((c, j) => <th key={j} className="num">{axis(g.id, c, false)}</th>)}</tr></thead>
                <tbody>
                  {g.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="num muted">{axis(g.id, r, true)}</td>
                      {g.values[i].map((x, j) => (
                        <td key={j} className="num" style={i === 2 && j === 2 ? { fontWeight: 700 } : undefined}>
                          <span className="fig" role="button" tabIndex={0} onClick={() => open({ title: `${g.title}`, value: fmtPerShare(x), formula: 'Full re-run of the operating model and DCF with the row and column values; all other inputs unchanged.', inputs: [{ label: g.rowLabel, value: axis(g.id, r, true) }, { label: g.colLabel, value: axis(g.id, g.cols[j], false) }] })}>{fmtPerShare(x)}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Scenarios (full re-runs)">
        <table className="tbl">
          <thead><tr><th></th>{v.scenarios.rows.map((s) => <th key={s.name} className="num">{s.name}</th>)}</tr></thead>
          <tbody>
            <tr><td>Probability</td>{v.scenarios.rows.map((s) => <td key={s.name} className="num">{fmtPct(s.probability, 0)}</td>)}</tr>
            <tr><td>Revenue growth delta</td>{v.scenarios.rows.map((s) => <td key={s.name} className="num">{s.revenueGrowthDelta}pp</td>)}</tr>
            <tr><td>Gross margin delta</td>{v.scenarios.rows.map((s) => <td key={s.name} className="num">{s.marginDelta}pp</td>)}</tr>
            <tr><td>WACC used</td>{v.scenarios.rows.map((s) => <td key={s.name} className="num">{fmtPct(s.wacc)}</td>)}</tr>
            <tr><td>Terminal growth used</td>{v.scenarios.rows.map((s) => <td key={s.name} className="num">{fmtPct(s.growth)}</td>)}</tr>
            <tr><td>Enterprise value</td>{v.scenarios.rows.map((s) => <td key={s.name} className="num">{fmtAmount(s.enterpriseValue)}</td>)}</tr>
            <tr className="total"><td>Value per share</td>{v.scenarios.rows.map((s) => <td key={s.name} className="num">{fmtPerShare(s.perShare)}</td>)}</tr>
          </tbody>
        </table>
        <p>Probability-weighted value per share: <strong className="num">{fmtPerShare(v.scenarios.weightedPerShare)}</strong></p>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <Section title="Monte Carlo">
          {mc ? (
            <>
              <table className="tbl"><tbody>
                <tr><td>Runs / seed</td><td className="num">{mc.runs.toLocaleString('en-US')} / {mc.seed}</td></tr>
                <tr><td>Mean / median</td><td className="num">{fmtPerShare(mc.mean)} / {fmtPerShare(mc.median)}</td></tr>
                <tr><td>P5 / P25</td><td className="num">{fmtPerShare(mc.p5)} / {fmtPerShare(mc.p25)}</td></tr>
                <tr><td>P75 / P95</td><td className="num">{fmtPerShare(mc.p75)} / {fmtPerShare(mc.p95)}</td></tr>
                <tr><td>Probability value above price</td><td className="num">{fmtPctFrac(mc.probAbovePrice, 1)}</td></tr>
              </tbody></table>
              <svg viewBox="0 0 400 120" width="100%" role="img" aria-label="Distribution of value per share">
                {mc.histogram.map((h, i) => {
                  const bw = 400 / mc.histogram.length;
                  const hh = (h.count / maxCount) * 100;
                  return <rect key={i} x={i * bw + 1} y={105 - hh} width={bw - 2} height={hh} fill="var(--text2)" />;
                })}
                <text x={0} y={118} fontSize={10} fill="var(--text3)">{fmtPerShare(mc.histogram[0]?.from)}</text>
                <text x={400} y={118} fontSize={10} fill="var(--text3)" textAnchor="end">{fmtPerShare(mc.histogram[mc.histogram.length - 1]?.to)}</text>
              </svg>
              <p className="muted" style={{ fontSize: 12 }}>Growth shift N(0, sd), margin shift N(0, sd), WACC N(base, sd), terminal growth uniform around base; WACC − g kept at or above the minimum spread by redrawing.</p>
            </>
          ) : <p className="muted">Not run.</p>}
        </Section>
        <Section title="Reverse DCF">
          <p>{rv.impliedTerminalGrowth.attainable ? `Terminal growth implied by the price of ${fmtPerShare(rv.price)}: ${fmtPct(rv.impliedTerminalGrowth.value)} (base ${fmtPct(v.core.growth)}).` : 'No terminal growth in the searched range reproduces the price.'}</p>
          <p>{rv.impliedRevenueGrowth.attainable ? `Uniform revenue growth in every projection year implied by the price: ${fmtPct(rv.impliedRevenueGrowth.value)}.` : 'No uniform revenue growth in the searched range reproduces the price.'}</p>
        </Section>
      </div>

      <Section title="USD consistency check">
        <table className="tbl"><tbody>
          <tr><td>Spot USD/EGP</td><td className="num">{fmtNumber(u.spot, 4)}</td></tr>
          <tr><td>Forward USD/EGP by year</td><td className="num">{u.forwards.map((x) => fmtNumber(x, 2)).join(' / ')}</td></tr>
          <tr><td>USD cost of equity / WACC</td><td className="num">{fmtPct(u.keUsd)} / {fmtPct(u.waccUsd)}</td></tr>
          <tr><td>USD terminal growth</td><td className="num">{fmtPct(u.growthUsd)}</td></tr>
          <tr><td>USD equity value converted at spot</td><td className="num">{fmtAmount(u.equityEgpEquivalent)}</td></tr>
          <tr><td>EGP DCF equity value</td><td className="num">{fmtAmount(u.equityEgp)}</td></tr>
          <tr className="total"><td>Gap</td><td className="num">{fmtPctFrac(u.gap, 1)}</td></tr>
        </tbody></table>
        <p>{u.explanation}</p>
      </Section>
    </div>
  );
}
