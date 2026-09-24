/**
 * Assumptions, in the order of spec Part 9: market data (registry, read-only with override +
 * reason) → cost of capital → operating drivers → terminal value → scenarios →
 * distributions and DDM → Egypt-specific adjustments.
 */
import { useState } from 'react';
import type { Assumptions, CapmMethod, KdMethod, RiskFreeSource, YearDrivers } from '../../domain/assumptions';
import type { CompanyData } from '../../domain/company';
import type { RatesSnapshot, RateStatus } from '../../domain/rates';
import type { ValuationResult } from '../../engine/valuation';
import { DRIVERS } from '../../domain/lines';
import { fadeDrivers } from '../../engine/forecast';
import { shareholderDps } from '../../engine/ddm';
import { fmtNumber, fmtPct, fmtPerShare } from '../../export/format';
import { Section, Field, NumInput, Select, Toggle, TextInput, StatusBadge, Messages, TagNote, Fig } from '../components/common';
import { auditBeta, auditKd, auditKe, auditRf, auditWacc } from '../audit';

interface Props {
  company: CompanyData;
  a: Assumptions;
  snapshot: RatesSnapshot;
  result: ValuationResult | null;
  set: (fn: (a: Assumptions) => Assumptions) => void;
  rebuildDefaults: () => void;
}

const MARKET_IDS = [
  'eg.bond10ySecondary', 'damodaran.rf.egp', 'us.treasury10y', 'damodaran.expectedInflation.egp', 'damodaran.expectedInflation.usd',
  'damodaran.matureErp', 'damodaran.egypt.crp', 'damodaran.egypt.defaultSpread', 'eg.cit', 'eg.usdEgp', 'cbe.overnightLending',
  'eg.cpiUrbanHeadline', 'cbe.inflationTargetPoint',
];

function OverrideRow({ id, snapshot, a, set }: { id: string; snapshot: RatesSnapshot; a: Assumptions; set: Props['set'] }) {
  const e = snapshot.entries.find((x) => x.id === id);
  const ov = a.costOfCapital.rateOverrides[id];
  const [val, setVal] = useState<number | null>(ov?.value ?? null);
  const [reason, setReason] = useState(ov?.reason ?? '');
  if (!e || typeof e.value !== 'number') return null;
  const apply = () => {
    if (val === null || !reason.trim()) return;
    set((x) => ({ ...x, costOfCapital: { ...x.costOfCapital, rateOverrides: { ...x.costOfCapital.rateOverrides, [id]: { value: val, reason: reason.trim() } } } }));
  };
  const remove = () => {
    set((x) => {
      const r = { ...x.costOfCapital.rateOverrides };
      delete r[id];
      return { ...x, costOfCapital: { ...x.costOfCapital, rateOverrides: r } };
    });
    setVal(null);
    setReason('');
  };
  return (
    <tr>
      <td>{e.label}<div className="muted" style={{ fontSize: 11 }}>{e.id}</div></td>
      <td className="num">{e.unit === 'pct' ? fmtPct(e.value, 3) : fmtNumber(e.value, 4)}</td>
      <td>{e.asOf}</td>
      <td><StatusBadge status={e.status as RateStatus} /></td>
      <td style={{ width: 110 }}><NumInput value={val} nullable onChange={setVal} ariaLabel={`Override ${id}`} /></td>
      <td><TextInput value={reason} onChange={setReason} ariaLabel={`Override reason ${id}`} /></td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <button className="btn" onClick={apply} disabled={val === null || !reason.trim()}>Apply</button>{' '}
        {ov && <button className="btn" onClick={remove}>Remove</button>}
        {ov && <div className="warn" style={{ fontSize: 12 }}>Override active: {ov.value}</div>}
      </td>
    </tr>
  );
}

export function AssumptionsPage({ company, a, snapshot, result, set, rebuildDefaults }: Props) {
  const cc = a.costOfCapital;
  const setCc = (patch: Partial<typeof cc>) => set((x) => ({ ...x, costOfCapital: { ...x.costOfCapital, ...patch } }));
  const betas = (snapshot.entries.find((e) => e.id === 'damodaran.betas.emerging')?.value ?? []) as unknown as { industry: string; unleveredBetaCorrectedForCash: number }[];
  const auctions = snapshot.entries.filter((e) => e.id.startsWith('eg.tbondAuction.'));
  const n = a.projectionYears;
  const base = company.years[company.years.length - 1]?.fiscalYear ?? 0;
  const setYear = (k: number, field: keyof YearDrivers, v: number) =>
    set((x) => (k === n ? { ...x, terminal: { ...x.terminal, drivers: { ...x.terminal.drivers, [field]: v } } } : { ...x, years: x.years.map((y, i) => (i === k ? { ...y, [field]: v } : y)) }));
  const refade = () => set((x) => ({ ...x, fadeToTerminal: true, years: fadeDrivers(x.years[0], { ...x.terminal.drivers, revenueGrowth: x.terminal.growth.value }, x.projectionYears) }));
  const setN = (m: number) => set((x) => {
    const nn = Math.max(1, Math.min(10, Math.round(m)));
    return { ...x, projectionYears: nn, years: fadeDrivers(x.years[0], { ...x.terminal.drivers, revenueGrowth: x.terminal.growth.value }, nn),
      usd: { egpInflation: resize(x.usd.egpInflation, nn), usdInflation: resize(x.usd.usdInflation, nn) } };
  });
  const w = result?.core.wacc;
  const probSum = a.scenarios.reduce((s, x) => s + x.probability, 0);
  const blendSum = a.blend.dcf + a.blend.ddm + a.blend.comps + a.blend.precedents + a.blend.sotp;

  return (
    <div>
      <Section title="1. Market data (rates registry)" right={<span className="muted" style={{ fontSize: 12 }}>Snapshot {snapshot.snapshotId}, frozen {snapshot.frozenAt.slice(0, 10)}</span>}>
        <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>Read-only registry values. An override needs a reason and is shown on every output.</p>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Rate</th><th className="num">Value</th><th>As of</th><th>Status</th><th>Override</th><th>Reason</th><th></th></tr></thead>
            <tbody>
              {MARKET_IDS.concat(auctions.map((x) => x.id)).map((id) => <OverrideRow key={id} id={id} snapshot={snapshot} a={a} set={set} />)}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="2. Cost of capital">
        <Field label="Risk-free rate source">
          <Select<RiskFreeSource> value={cc.rfSource} ariaLabel="Risk-free source" onChange={(v) => setCc({ rfSource: v })} options={[
            { value: 'eg_10y_secondary', label: '(a) EGP 10Y secondary-market YTM' },
            { value: 'cbe_auction', label: '(b) Latest CBE auction yield' },
            { value: 'damodaran_egp', label: '(c) Damodaran inflation-based EGP riskfree' },
            { value: 'fisher_us10y', label: '(d) US 10Y converted with expected inflation' },
          ]} />
        </Field>
        {cc.rfSource === 'cbe_auction' && (
          <Field label="Auction tenor"><Select value={cc.auctionTenorId} onChange={(v) => setCc({ auctionTenorId: v })} options={auctions.map((x) => ({ value: x.id, label: `${x.label} (${x.asOf})` }))} /></Field>
        )}
        <Field label="CAPM method">
          <Select<CapmMethod> value={cc.capmMethod} ariaLabel="CAPM method" onChange={(v) => setCc({ capmMethod: v })} options={[
            { value: 'local_rf', label: 'local_rf: Rf + βL × ERP (country risk inside local Rf)' },
            { value: 'A', label: 'A: Rf + βL × ERP + CRP' },
            { value: 'B', label: 'B: Rf + βL × (ERP + CRP)' },
            { value: 'C', label: 'C: Rf + βL × ERP + λ × CRP' },
          ]} />
        </Field>
        {cc.capmMethod === 'C' && <Field label="Lambda (λ)"><NumInput value={cc.lambda} onChange={(v) => setCc({ lambda: v ?? 1 })} /></Field>}
        <Field label="Industry (Damodaran emerging markets)" hint="Unlevered beta corrected for cash">
          <Select value={cc.betaIndustry} ariaLabel="Beta industry" onChange={(v) => setCc({ betaIndustry: v })} options={betas.map((b) => ({ value: b.industry, label: `${b.industry} (${fmtNumber(b.unleveredBetaCorrectedForCash, 4)})` }))} />
        </Field>
        <Field label="Unlevered beta override" hint="Blank = dataset value"><NumInput value={cc.unleveredBetaOverride} nullable onChange={(v) => setCc({ unleveredBetaOverride: v })} /></Field>
        <Field label="Relevering tax rate (%)"><NumInput value={cc.releverTaxRate} onChange={(v) => setCc({ releverTaxRate: v ?? 0 })} /></Field>
        <Field label="Size / illiquidity premium (%)" hint="Analyst assumption"><NumInput value={cc.sizePremium.value} onChange={(v) => setCc({ sizePremium: { ...cc.sizePremium, value: v ?? 0 } })} /></Field>
        <Field label="Cost of debt method">
          <Select<KdMethod> value={cc.kdMethod} onChange={(v) => setCc({ kdMethod: v })} options={[
            { value: 'synthetic', label: 'Synthetic rating (interest coverage)' },
            { value: 'cbe_plus_spread', label: 'CBE lending rate + spread' },
            { value: 'actual', label: 'Actual: debt interest ÷ average debt' },
          ]} />
        </Field>
        {cc.kdMethod === 'cbe_plus_spread' && <Field label="Spread over CBE lending (%)"><NumInput value={cc.kdSpreadOverCbe} onChange={(v) => setCc({ kdSpreadOverCbe: v ?? 0 })} /></Field>}
        {cc.kdMethod === 'synthetic' && <Field label="Synthetic rating table"><Select value={cc.syntheticTable} onChange={(v) => setCc({ syntheticTable: v })} options={[{ value: 'small', label: 'Smaller and riskier firms (market cap below USD 5bn)' }, { value: 'large', label: 'Large non-financial firms' }]} /></Field>}
        <Field label="Capital weights"><Select value={cc.weightMethod} onChange={(v) => setCc({ weightMethod: v })} options={[{ value: 'market', label: 'Market values' }, { value: 'target', label: 'Target structure' }]} /></Field>
        {cc.weightMethod === 'target' && <Field label="Target D/V (%)"><NumInput value={cc.targetDebtWeight} onChange={(v) => setCc({ targetDebtWeight: v ?? 0 })} /></Field>}
        {w && result && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginTop: 12 }}>
            <div><div className="label">Risk-free rate</div><Fig v={w.rf} kind="pct" audit={auditRf(result)} /></div>
            <div><div className="label">Levered beta</div><Fig v={w.leveredBeta} kind="ratio4" audit={auditBeta(result)} /></div>
            <div><div className="label">Cost of equity</div><Fig v={w.ke} kind="pct" audit={auditKe(result)} /></div>
            <div><div className="label">Pre-tax cost of debt</div><Fig v={w.kdPreTax} kind="pct" audit={auditKd(result)} /></div>
            <div><div className="label">WACC</div><Fig v={w.wacc} kind="pct" audit={auditWacc(result)} testId="wacc-figure" /></div>
          </div>
        )}
        {w && <Messages items={w.messages} />}
      </Section>

      <Section title="3. Operating drivers" right={<div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={refade}>Re-apply linear fade</button><button className="btn" onClick={rebuildDefaults}>Rebuild defaults from data</button></div>}>
        <Field label="D&A method"><Select value={a.daMethod} onChange={(v) => set((x) => ({ ...x, daMethod: v }))} options={[{ value: 'ppe_rollforward', label: 'PP&E roll-forward' }, { value: 'pct_revenue', label: '% of revenue' }]} /></Field>
        <Field label="Capex mode"><Select value={a.capexMode} onChange={(v) => set((x) => ({ ...x, capexMode: v }))} options={[{ value: 'pct_revenue', label: '% of revenue' }, { value: 'absolute', label: 'Absolute amount per year' }]} /></Field>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead><tr><th>Driver</th><th>Unit</th>{Array.from({ length: n }, (_, k) => <th key={k} className="num">{base + k + 1}E</th>)}<th className="num">Terminal</th></tr></thead>
            <tbody>
              {DRIVERS.map(([field, label, unit]) => (
                <tr key={field}>
                  <td>{label}</td><td className="muted">{unit}</td>
                  {Array.from({ length: n + 1 }, (_, k) => (
                    <td key={k} style={{ minWidth: 96 }}>
                      {k === n && field === 'revenueGrowth'
                        ? <span className="num muted" style={{ display: 'block' }}>= g</span>
                        : <NumInput value={(k === n ? a.terminal.drivers : a.years[k])[field]} onChange={(v) => setYear(k, field, v ?? 0)} ariaLabel={`${label} ${k === n ? 'terminal' : base + k + 1}`} />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>Analyst assumptions. Default: FY{base} actual ratios fading linearly to the terminal drivers; terminal capex set so that net reinvestment = g / RONIC × NOPAT.</p>
      </Section>

      <Section title="4. Terminal value and timeline">
        <Field label="Valuation date" hint="Set on Company data">{a.valuationDate}</Field>
        <Field label="Mid-year discounting"><Toggle checked={a.midYear} onChange={(v) => set((x) => ({ ...x, midYear: v }))} label="On" /></Field>
        <Field label="Projection years (1 to 10)"><NumInput value={n} onChange={(v) => v !== null && setN(v)} /></Field>
        <Field label="Terminal method"><Select value={a.terminal.method} onChange={(v) => set((x) => ({ ...x, terminal: { ...x.terminal, method: v } }))} options={[{ value: 'gordon', label: 'Gordon growth' }, { value: 'exit_multiple', label: 'Exit multiple' }]} /></Field>
        <Field label="Terminal growth (%)"><NumInput value={a.terminal.growth.value} onChange={(v) => set((x) => ({ ...x, terminal: { ...x.terminal, growth: { ...x.terminal.growth, value: v ?? 0 }, drivers: { ...x.terminal.drivers, revenueGrowth: v ?? 0 } } }))} ariaLabel="Terminal growth" /><TagNote tag={a.terminal.growth.tag} note={a.terminal.growth.note} /></Field>
        <Field label="Exit multiple (EV/EBITDA)"><NumInput value={a.terminal.exitMultiple.value} onChange={(v) => set((x) => ({ ...x, terminal: { ...x.terminal, exitMultiple: { ...x.terminal.exitMultiple, value: v ?? 0 } } }))} /><TagNote tag={a.terminal.exitMultiple.tag} note={a.terminal.exitMultiple.note} /></Field>
        <Field label="RONIC (%)" hint="Blank = WACC"><NumInput value={a.terminal.ronic} nullable onChange={(v) => set((x) => ({ ...x, terminal: { ...x.terminal, ronic: v } }))} /></Field>
        <Field label="Long-run nominal GDP proxy (%)" hint="Growth warning level"><NumInput value={a.terminal.nominalGdpProxy} onChange={(v) => set((x) => ({ ...x, terminal: { ...x.terminal, nominalGdpProxy: v ?? 0 } }))} /></Field>
      </Section>

      <Section title="5. Scenarios">
        <table className="tbl">
          <thead><tr><th></th>{a.scenarios.map((s) => <th key={s.name} className="num">{s.name}</th>)}</tr></thead>
          <tbody>
            {([['probability', 'Probability (%)'], ['revenueGrowthDelta', 'Revenue growth delta (pp, every year)'], ['marginDelta', 'Gross margin delta (pp)'], ['waccDelta', 'WACC delta (pp)'], ['growthDelta', 'Terminal growth delta (pp)']] as const).map(([k, label]) => (
              <tr key={k}><td>{label}</td>{a.scenarios.map((s, i) => <td key={s.name}><NumInput value={s[k]} onChange={(v) => set((x) => ({ ...x, scenarios: x.scenarios.map((y, j) => (j === i ? { ...y, [k]: v ?? 0 } : y)) }))} /></td>)}</tr>
            ))}
          </tbody>
        </table>
        {Math.abs(probSum - 100) > 1e-9 && <div className="msg error"><span className="neg">Error</span>: probabilities sum to {probSum}%, not 100%.</div>}
      </Section>

      <Section title="6. Distributions, DDM and blend">
        <Field label="DPS for the DDM" hint="Shareholder dividends only; employee and board distributions excluded">
          <div>Derived from the cash flow statement: EGP {fmtPerShare(shareholderDps(company))}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span className="muted">Override</span><NumInput value={a.ddm.dpsOverride} nullable onChange={(v) => set((x) => ({ ...x, ddm: { ...x.ddm, dpsOverride: v } }))} width={120} /></div>
        </Field>
        <Field label="High-growth rate (%)"><NumInput value={a.ddm.highGrowth.value} onChange={(v) => set((x) => ({ ...x, ddm: { ...x.ddm, highGrowth: { ...x.ddm.highGrowth, value: v ?? 0 } } }))} /><TagNote tag={a.ddm.highGrowth.tag} note={a.ddm.highGrowth.note} /></Field>
        <Field label="High-growth years"><NumInput value={a.ddm.highGrowthYears} onChange={(v) => set((x) => ({ ...x, ddm: { ...x.ddm, highGrowthYears: Math.max(1, Math.round(v ?? 1)) } }))} /></Field>
        <Field label="Stable growth (%)"><NumInput value={a.ddm.stableGrowth.value} onChange={(v) => set((x) => ({ ...x, ddm: { ...x.ddm, stableGrowth: { ...x.ddm.stableGrowth, value: v ?? 0 } } }))} /></Field>
        <h3 className="label" style={{ marginTop: 12 }}>Blend weights (%), must sum to 100</h3>
        {(['dcf', 'ddm', 'comps', 'precedents', 'sotp'] as const).map((k) => (
          <Field key={k} label={{ dcf: 'DCF (FCFF)', ddm: 'Dividend discount model', comps: 'Trading comparables', precedents: 'Precedent transactions', sotp: 'Sum of the parts' }[k]}>
            <NumInput value={a.blend[k]} onChange={(v) => set((x) => ({ ...x, blend: { ...x.blend, [k]: v ?? 0 } }))} width={120} />
          </Field>
        ))}
        {Math.abs(blendSum - 100) > 1e-9 && <div className="msg error"><span className="neg">Error</span>: blend weights sum to {blendSum}%, not 100%.</div>}
        <h3 className="label" style={{ marginTop: 12 }}>Monte Carlo</h3>
        <Field label="Seed / runs"><div style={{ display: 'flex', gap: 8 }}><NumInput value={a.monteCarlo.seed} onChange={(v) => set((x) => ({ ...x, monteCarlo: { ...x.monteCarlo, seed: Math.round(v ?? 1) } }))} width={140} /><NumInput value={a.monteCarlo.runs} onChange={(v) => set((x) => ({ ...x, monteCarlo: { ...x.monteCarlo, runs: Math.max(100, Math.round(v ?? 10000)) } }))} width={120} /></div></Field>
        <Field label="Std dev: growth / margin / WACC (pp)"><div style={{ display: 'flex', gap: 8 }}>
          <NumInput value={a.monteCarlo.revenueGrowthSd} onChange={(v) => set((x) => ({ ...x, monteCarlo: { ...x.monteCarlo, revenueGrowthSd: v ?? 0 } }))} width={90} />
          <NumInput value={a.monteCarlo.marginSd} onChange={(v) => set((x) => ({ ...x, monteCarlo: { ...x.monteCarlo, marginSd: v ?? 0 } }))} width={90} />
          <NumInput value={a.monteCarlo.waccSd} onChange={(v) => set((x) => ({ ...x, monteCarlo: { ...x.monteCarlo, waccSd: v ?? 0 } }))} width={90} />
        </div></Field>
        <h3 className="label" style={{ marginTop: 12 }}>USD check inflation paths (%)</h3>
        <table className="tbl"><thead><tr><th></th>{Array.from({ length: n }, (_, k) => <th key={k} className="num">{base + k + 1}E</th>)}</tr></thead>
          <tbody>
            {(['egpInflation', 'usdInflation'] as const).map((key) => (
              <tr key={key}><td>{key === 'egpInflation' ? 'EGP' : 'USD'}</td>{Array.from({ length: n }, (_, k) => <td key={k}><NumInput value={a.usd[key][k] ?? 0} onChange={(v) => set((x) => ({ ...x, usd: { ...x.usd, [key]: x.usd[key].map((q, j) => (j === k ? v ?? 0 : q)) } }))} /></td>)}</tr>
            ))}
          </tbody>
        </table>
      </Section>

      <Section title="7. Egypt-specific adjustments">
        <Field label="Employee and board distributions" hint="Deducted from FCFF; under EAS they go through equity but are a recurring cash payment to non-shareholders">
          <Toggle checked={a.egypt.distributionsOn} onChange={(v) => set((x) => ({ ...x, egypt: { ...x.egypt, distributionsOn: v } }))} label="Deduct" />
        </Field>
        <Field label="Distributions, % of prior-year net profit"><NumInput value={a.egypt.distributionsPct.value} onChange={(v) => set((x) => ({ ...x, egypt: { ...x.egypt, distributionsPct: { ...x.egypt.distributionsPct, value: v ?? 0 } } }))} /><TagNote tag={a.egypt.distributionsPct.tag} note={a.egypt.distributionsPct.note} /></Field>
        <Field label="Net finance income (EGP per year)" hint="Forecast net profit only"><NumInput value={a.egypt.netFinanceIncome.value} onChange={(v) => set((x) => ({ ...x, egypt: { ...x.egypt, netFinanceIncome: { ...x.egypt.netFinanceIncome, value: v ?? 0 } } }))} /></Field>
        <Field label="Employee benefit obligations in the bridge"><div style={{ display: 'flex', gap: 16 }}>
          <Toggle checked={a.bridge.deductEmployeeBenefits} onChange={(v) => set((x) => ({ ...x, bridge: { ...x.bridge, deductEmployeeBenefits: v } }))} label="Deduct" />
          <Toggle checked={a.bridge.taxEffectEmployeeBenefits} onChange={(v) => set((x) => ({ ...x, bridge: { ...x.bridge, taxEffectEmployeeBenefits: v } }))} label="Tax-effect at CIT" />
        </div></Field>
        <Field label="Associates at fair value (EGP)" hint="Blank = carrying value"><NumInput value={a.bridge.associatesFairValue} nullable onChange={(v) => set((x) => ({ ...x, bridge: { ...x.bridge, associatesFairValue: v } }))} /></Field>
        <Field label="USD-linked share of revenue (%)" hint="Export share pre-filled"><NumInput value={a.fx.usdRevenueShare} nullable onChange={(v) => set((x) => ({ ...x, fx: { ...x.fx, usdRevenueShare: v } }))} /></Field>
        <Field label="USD-linked share of costs (%)" hint="No default"><NumInput value={a.fx.usdCostShare} nullable onChange={(v) => set((x) => ({ ...x, fx: { ...x.fx, usdCostShare: v } }))} /></Field>
        <h3 className="label" style={{ marginTop: 12 }}>Normalization (removed from reported operating profit)</h3>
        <table className="tbl">
          <thead><tr><th>Item</th><th className="num">Amount (EGP)</th><th>Remove</th><th>Basis</th></tr></thead>
          <tbody>
            {a.normalization.map((adj, i) => (
              <tr key={adj.id}>
                <td>{adj.label}</td>
                <td style={{ width: 170 }}><NumInput value={adj.amount} onChange={(v) => set((x) => ({ ...x, normalization: x.normalization.map((q, j) => (j === i ? { ...q, amount: v ?? 0 } : q)) }))} /></td>
                <td><Toggle checked={adj.include} onChange={(v) => set((x) => ({ ...x, normalization: x.normalization.map((q, j) => (j === i ? { ...q, include: v } : q)) }))} label="" /></td>
                <td className="muted" style={{ fontSize: 12 }}>{adj.tag}. {adj.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>
    </div>
  );
}

function resize(xs: number[], n: number): number[] {
  const last = xs[xs.length - 1] ?? 0;
  return Array.from({ length: n }, (_, k) => xs[k] ?? last);
}
