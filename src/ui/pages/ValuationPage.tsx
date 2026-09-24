/** Valuation summary: headline value, method table, football field, DCF, terminal value and bridge. */
import type { ValuationResult } from '../../engine/valuation';
import { footballField } from '../../engine/football';
import { fmtAmount, fmtDate, fmtMultiple, fmtNumber, fmtPct, fmtPctFrac, fmtPerShare } from '../../export/format';
import { Section, Fig, Messages, useAudit } from '../components/common';
import { FootballField } from '../components/FootballField';
import { auditBlend, auditDdm, auditEquity, auditEv, auditKe, auditPerShare, auditTv, auditWacc, FORECAST_ROWS } from '../audit';

interface Props {
  v: ValuationResult;
  onExportExcel: () => void;
  onExportPdf: () => void;
  exporting: string | null;
}

export function ValuationPage({ v, onExportExcel, onExportPdf, exporting }: Props) {
  const open = useAudit();
  const d = v.core.dcf;
  const w = v.core.wacc;
  const f = v.core.forecast;
  const up = v.blend.verdict.upside;
  return (
    <div>
      <Section title="Valuation" right={
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" data-testid="export-excel" disabled={!!exporting} onClick={onExportExcel}>{exporting === 'excel' ? 'Building workbook' : 'Export Excel'}</button>
          <button className="btn" data-testid="export-pdf" disabled={!!exporting} onClick={onExportPdf}>{exporting === 'pdf' ? 'Building PDF' : 'Export PDF'}</button>
        </div>
      }>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 16 }}>
          <div>
            <div className="label">Blended value per share (EGP)</div>
            <div className="display key-figure" style={{ fontSize: 34 }}><Fig v={v.blend.blendedValue} kind="pershare" audit={auditBlend(v)} testId="blended-value" /></div>
          </div>
          <div>
            <div className="label">Versus price {fmtPerShare(v.company.price)} ({fmtDate(v.company.priceDate)})</div>
            <div style={{ fontSize: 20 }} className={up > 0.1 ? 'pos' : up < -0.1 ? 'neg' : ''}>{v.blend.verdict.text}</div>
            <div className="muted">{v.blend.verdict.band}</div>
          </div>
          <div><div className="label">DCF value per share</div><div style={{ fontSize: 20 }}><Fig v={d.perShare} kind="pershare" audit={auditPerShare(v)} testId="dcf-per-share" /></div></div>
          <div><div className="label">DDM value per share</div><div style={{ fontSize: 20 }}><Fig v={v.ddm.applicable ? v.ddm.twoStage : null} kind="pershare" audit={auditDdm(v)} /></div></div>
          <div><div className="label">WACC / cost of equity</div><div style={{ fontSize: 20 }}><Fig v={w.wacc} kind="pct" audit={auditWacc(v)} /> / <Fig v={w.ke} kind="pct" audit={auditKe(v)} /></div></div>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Valuation date {fmtDate(v.company.valuationDate)}. Rates snapshot {v.snapshotId}. The bridge uses the latest audited balance sheet; cash flows between the year end and the valuation date are not captured.</p>
        <Messages items={v.messages.filter((m) => m.severity !== 'info')} />
      </Section>

      <Section title="Value by method">
        <table className="tbl">
          <thead><tr><th>Method</th><th className="num">Value per share</th><th className="num">Entered weight</th><th className="num">Effective weight</th><th>Note</th></tr></thead>
          <tbody>
            {v.blend.rows.map((r) => (
              <tr key={r.id}><td>{r.label}</td><td className="num">{r.value === null ? 'n/a' : fmtPerShare(r.value)}</td><td className="num">{fmtPct(r.enteredWeight, 0)}</td><td className="num">{fmtPct(r.effectiveWeight, 1)}</td><td className="muted">{r.note}</td></tr>
            ))}
            <tr className="total"><td>Blended value per share</td><td className="num">{fmtPerShare(v.blend.blendedValue)}</td><td className="num">{fmtPct(v.blend.enteredSum, 0)}</td><td className="num">100.0%</td><td /></tr>
          </tbody>
        </table>
      </Section>

      <Section title="Football field (value per share, EGP)">
        <FootballField rows={footballField(v)} price={v.company.price} />
        <p className="muted" style={{ fontSize: 12 }}>Filled bars enter the valuation range; outlined bars are references only (broker targets).</p>
      </Section>

      <Section title="Discounted cash flow (EGP)">
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th></th>{f.years.map((y) => <th key={y.label} className="num">{y.label}</th>)}<th className="num">Terminal</th></tr></thead>
            <tbody>
              {FORECAST_ROWS.map((row) => (
                <tr key={row.key} className={row.key === 'fcff' ? 'total' : ''}>
                  <td>{row.label}</td>
                  {[...f.years, f.terminal].map((y) => (
                    <td key={y.label} className="num">
                      <span className="fig" role="button" tabIndex={0} onClick={() => open({ title: `${row.label}, ${y.label}`, value: fmtAmount(y[row.key] as number), formula: row.formula, inputs: row.inputs(y).map(([label, value]) => ({ label, value })) })}>
                        {fmtAmount(y[row.key] as number)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
              <tr><td>Share of year included</td>{d.rows.map((r) => <td key={r.period.label} className="num">{fmtNumber(r.period.fraction, 4)}</td>)}<td /></tr>
              <tr><td>Years from valuation date</td>{d.rows.map((r) => <td key={r.period.label} className="num">{fmtNumber(r.period.years, 4)}</td>)}<td /></tr>
              <tr><td>Discount factor</td>{d.rows.map((r) => <td key={r.period.label} className="num">{fmtNumber(r.discountFactor, 4)}</td>)}<td /></tr>
              <tr className="total"><td>Present value</td>{d.rows.map((r) => (
                <td key={r.period.label} className="num"><span className="fig" role="button" tabIndex={0} onClick={() => open({ title: `Present value, ${r.period.label}`, value: fmtAmount(r.pv), formula: 'PV = FCFF × share of year included × (1 + WACC)^(−years from valuation date)', inputs: [{ label: 'FCFF', value: fmtAmount(r.fcff) }, { label: 'Share of year', value: fmtNumber(r.period.fraction, 4) }, { label: 'Discount date', value: fmtDate(r.period.discountDate) }, { label: 'Years', value: fmtNumber(r.period.years, 4) }, { label: 'WACC', value: fmtPct(w.wacc) }] })}>{fmtAmount(r.pv)}</span></td>
              ))}<td /></tr>
            </tbody>
          </table>
        </div>
      </Section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
        <Section title="Terminal value and enterprise value">
          <table className="tbl"><tbody>
            <tr><td>Sum of present values</td><td className="num">{fmtAmount(d.sumPv)}</td></tr>
            <tr><td>Gordon terminal value (g {fmtPct(v.core.growth)})</td><td className="num"><Fig v={d.terminal.gordonTv} kind="amount" audit={auditTv(v, 'gordon')} /></td></tr>
            <tr><td>Exit-multiple terminal value</td><td className="num"><Fig v={d.terminal.exitTv} kind="amount" audit={auditTv(v, 'exit')} /></td></tr>
            <tr><td>PV of terminal value used ({d.terminal.selected === 'gordon' ? 'Gordon' : 'exit multiple'})</td><td className="num">{fmtAmount(d.pvTerminal)}</td></tr>
            <tr className="total"><td>Enterprise value</td><td className="num"><Fig v={d.enterpriseValue} kind="amount" audit={auditEv(v)} testId="enterprise-value" /></td></tr>
            <tr><td>Terminal value share of EV</td><td className="num">{fmtPctFrac(d.tvShareOfEv, 1)}</td></tr>
            <tr><td>Implied exit multiple from Gordon</td><td className="num">{fmtMultiple(d.terminal.impliedExitMultipleFromGordon, 2)}</td></tr>
            <tr><td>Implied growth from exit value</td><td className="num">{fmtPctFrac(d.terminal.impliedGrowthFromExit)}</td></tr>
            <tr><td>Reinvestment: g / RONIC vs forecast</td><td className="num">{fmtPctFrac(d.terminal.impliedReinvestmentRate, 1)} vs {fmtPctFrac(d.terminal.forecastReinvestmentRate, 1)}</td></tr>
          </tbody></table>
          <Messages items={d.messages} />
        </Section>
        <Section title="Enterprise value to equity value">
          <table className="tbl"><tbody>
            <tr><td>Enterprise value</td><td className="num">{fmtAmount(d.enterpriseValue)}</td></tr>
            {d.bridge.map((l) => <tr key={l.id} className={l.memo ? 'muted' : ''}><td>{l.memo ? `Memo: ${l.label}` : l.label}</td><td className="num">{fmtAmount(l.amount)}</td></tr>)}
            <tr className="total"><td>Equity value</td><td className="num"><Fig v={d.equityValue} kind="amount" audit={auditEquity(v)} /></td></tr>
            <tr><td>Diluted shares</td><td className="num">{fmtAmount(d.dilutedShares)}</td></tr>
            <tr className="total"><td>DCF value per share</td><td className="num"><Fig v={d.perShare} kind="pershare" audit={auditPerShare(v)} /></td></tr>
            <tr><td>Implied EV / normalized EBITDA (base year)</td><td className="num">{fmtMultiple(d.impliedEvEbitdaLtm, 2)}</td></tr>
            <tr><td>Implied EV / EBITDA (year 1)</td><td className="num">{fmtMultiple(d.impliedEvEbitdaNtm, 2)}</td></tr>
            <tr><td>Implied P/E (base year / year 1)</td><td className="num">{fmtMultiple(d.impliedPeLtm, 2)} / {fmtMultiple(d.impliedPeNtm, 2)}</td></tr>
          </tbody></table>
        </Section>
      </div>
    </div>
  );
}
