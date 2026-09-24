/** Audit-panel entries (formula, inputs, rate provenance) built from an engine result. */
import type { ValuationResult } from '../engine/valuation';
import type { ForecastYear } from '../domain/result';
import type { AuditEntry, AuditRate } from './components/common';
import { fmtAmount, fmtPerShare, fmtPct, fmtPctFrac, fmtNumber, fmtMultiple } from '../export/format';

type A = Omit<AuditEntry, 'value'>;

export function rateAudit(v: ValuationResult, ids: string[]): AuditRate[] {
  const used = v.ratesUsed;
  return ids
    .map((id) => used.find((u) => u.id === id))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => ({ id: u.id, label: u.label, sourceName: u.sourceName, sourceUrl: u.sourceUrl, asOf: u.asOf, status: u.status, overridden: u.overridden, reason: u.overrideReason }));
}

export function auditWacc(v: ValuationResult): A {
  const w = v.core.wacc;
  return {
    title: 'WACC',
    formula: 'WACC = E/V × Ke + D/V × Kd × (1 − t)',
    inputs: [
      { label: 'E/V', value: fmtPctFrac(w.equityWeight) },
      { label: 'Cost of equity (Ke)', value: fmtPct(w.ke) },
      { label: 'D/V', value: fmtPctFrac(w.debtWeight) },
      { label: 'Pre-tax cost of debt (Kd)', value: fmtPct(w.kdPreTax) },
      { label: 'Tax rate (t)', value: fmtPct(w.kdTaxRate) },
    ],
    rates: rateAudit(v, [w.rfId.replace(' (Fisher)', ''), 'eg.cit']),
  };
}

export function auditKe(v: ValuationResult): A {
  const w = v.core.wacc;
  const f: Record<string, string> = {
    local_rf: 'Ke = Rf + βL × ERP + size premium (country risk is inside the local Rf)',
    A: 'Ke = Rf + βL × ERP + CRP + size premium',
    B: 'Ke = Rf + βL × (ERP + CRP) + size premium',
    C: 'Ke = Rf + βL × ERP + λ × CRP + size premium',
  };
  return {
    title: 'Cost of equity',
    formula: f[w.capmMethod],
    inputs: [
      { label: 'Risk-free rate (Rf)', value: fmtPct(w.rf) },
      { label: 'Levered beta (βL)', value: fmtNumber(w.leveredBeta, 4) },
      { label: 'Mature-market ERP', value: fmtPct(w.matureErp) },
      { label: 'Country risk premium (CRP)', value: fmtPct(w.crp) },
      { label: 'λ', value: fmtNumber(w.lambda, 2) },
      { label: 'Size premium', value: fmtPct(w.sizePremium) },
    ],
    rates: rateAudit(v, [w.rfId.replace(' (Fisher)', ''), 'damodaran.matureErp', 'damodaran.egypt.crp']),
  };
}

export function auditBeta(v: ValuationResult): A {
  const w = v.core.wacc;
  return {
    title: 'Levered beta',
    formula: 'βL = βU × (1 + (1 − t) × D/E)',
    inputs: [
      { label: `Unlevered beta, corrected for cash (${w.betaIndustry})`, value: fmtNumber(w.unleveredBeta, 4) },
      { label: 'Tax rate (t)', value: fmtPct(w.releverTaxRate) },
      { label: 'Interest-bearing debt (D)', value: fmtAmount(w.debtValue) },
      { label: 'Market value of equity (E)', value: fmtAmount(w.equityValue) },
      { label: 'D/E', value: fmtNumber(w.debtToEquity, 6) },
    ],
    rates: rateAudit(v, ['damodaran.betas.emerging']),
    note: `Dataset date ${w.betaDatasetDate}. Blume-adjusted cross-check ${fmtNumber(w.blumeBeta, 4)} (not used).`,
  };
}

export function auditRf(v: ValuationResult): A {
  const w = v.core.wacc;
  return { title: 'Risk-free rate', formula: `Selected source: ${w.rfSource}`, inputs: [{ label: w.rfId, value: fmtPct(w.rf) }], rates: rateAudit(v, [w.rfId.replace(' (Fisher)', ''), 'damodaran.expectedInflation.egp', 'damodaran.expectedInflation.usd']) };
}

export function auditKd(v: ValuationResult): A {
  const w = v.core.wacc;
  const f = w.kdMethod === 'synthetic'
    ? 'Kd = Rf + company spread (synthetic rating on normalized EBIT ÷ debt and lease interest), plus country default spread only when Rf is clean'
    : w.kdMethod === 'cbe_plus_spread' ? 'Kd = CBE overnight lending rate + spread' : 'Kd = debt and lease interest ÷ average interest-bearing debt';
  return {
    title: 'Pre-tax cost of debt',
    formula: f,
    inputs: [
      { label: 'Interest coverage', value: w.interestCoverage === null ? 'n/a' : Number.isFinite(w.interestCoverage) ? `${fmtNumber(w.interestCoverage, 1)}x` : 'no interest' },
      { label: 'Synthetic rating', value: w.syntheticRating ?? 'n/a' },
      { label: 'Company spread', value: w.companySpread === null ? 'n/a' : fmtPct(w.companySpread) },
      { label: 'Risk-free rate', value: fmtPct(w.rf) },
    ],
    rates: rateAudit(v, ['damodaran.synthetic.small', 'damodaran.synthetic.large', 'cbe.overnightLending']),
  };
}

export function auditEv(v: ValuationResult): A {
  const d = v.core.dcf;
  return {
    title: 'Enterprise value',
    formula: 'EV = Σ PV(FCFF included) + PV(terminal value)',
    inputs: [
      { label: 'Sum of present values', value: fmtAmount(d.sumPv) },
      { label: `PV of terminal value (${d.terminal.selected === 'gordon' ? 'Gordon' : 'exit multiple'})`, value: fmtAmount(d.pvTerminal) },
      { label: 'Terminal value share of EV', value: fmtPctFrac(d.tvShareOfEv, 1) },
    ],
  };
}

export function auditEquity(v: ValuationResult): A {
  const d = v.core.dcf;
  return {
    title: 'Equity value',
    formula: 'Equity value = EV + Σ bridge lines (balance sheet of the base year); restricted deposits excluded',
    inputs: [{ label: 'Enterprise value', value: fmtAmount(d.enterpriseValue) }, ...d.bridge.map((l) => ({ label: l.memo ? `${l.label} (not added)` : l.label, value: fmtAmount(l.amount) }))],
  };
}

export function auditPerShare(v: ValuationResult): A {
  const d = v.core.dcf;
  return {
    title: 'DCF value per share',
    formula: 'Value per share = equity value ÷ diluted shares',
    inputs: [{ label: 'Equity value', value: fmtAmount(d.equityValue) }, { label: 'Diluted shares', value: fmtAmount(d.dilutedShares) }],
  };
}

export function auditBlend(v: ValuationResult): A {
  return {
    title: 'Blended value per share',
    formula: 'Σ effective weight × method value; methods without inputs are excluded and weights rescaled',
    inputs: v.blend.rows.map((r) => ({ label: `${r.label} (entered ${fmtPct(r.enteredWeight, 0)}, effective ${fmtPct(r.effectiveWeight, 1)})`, value: r.value === null ? 'n/a' : fmtPerShare(r.value) })),
  };
}

export function auditDdm(v: ValuationResult): A {
  const d = v.ddm;
  return {
    title: 'DDM value per share (two-stage)',
    formula: 'Σ D0(1+gH)^t/(1+Ke)^t for t = 1..n + [Dn(1+gS)/(Ke − gS)]/(1+Ke)^n',
    inputs: [
      { label: 'D0 (shareholder dividends ÷ basic shares)', value: fmtPerShare(d.dps0) },
      { label: 'Ke', value: fmtPct(d.ke) },
      { label: 'High growth gH', value: fmtPct(d.highGrowth) },
      { label: 'Years n', value: String(d.highGrowthYears) },
      { label: 'Stable growth gS', value: fmtPct(d.stableGrowth) },
      { label: 'PV of high-growth dividends', value: fmtPerShare(d.pvHighGrowth) },
      { label: 'PV of terminal value', value: fmtPerShare(d.pvTerminal) },
    ],
    note: d.dpsSource,
  };
}

export function auditTv(v: ValuationResult, which: 'gordon' | 'exit'): A {
  const t = v.core.dcf.terminal;
  return which === 'gordon'
    ? { title: 'Gordon terminal value', formula: 'TV = FCFF(n+1) / (WACC − g)', inputs: [{ label: 'FCFF(n+1)', value: fmtAmount(t.gordonFcffNext) }, { label: 'WACC', value: fmtPct(v.core.wacc.wacc) }, { label: 'g', value: fmtPct(v.core.growth) }, { label: 'Discount factor (final period end)', value: fmtNumber(t.discountFactor, 4) }] }
    : { title: 'Exit-multiple terminal value', formula: 'TV = EBITDA(n) × exit multiple', inputs: [{ label: 'EBITDA(n)', value: fmtAmount(t.exitEbitda) }, { label: 'Exit multiple', value: fmtMultiple(t.exitTv / t.exitEbitda, 2) }] };
}

/** Forecast rows: formula text and the inputs for one year. */
export const FORECAST_ROWS: { key: keyof ForecastYear; label: string; formula: string; inputs: (y: ForecastYear) => [string, string][] }[] = [
  { key: 'revenue', label: 'Revenue', formula: 'Revenue(t) = Revenue(t−1) × (1 + growth)', inputs: (y) => [['Growth', fmtPct(y.revenueGrowth)]] },
  { key: 'ebitda', label: 'EBITDA', formula: 'EBITDA = revenue × (gross margin before D&A − SG&A % + other operating %)', inputs: (y) => [['Revenue', fmtAmount(y.revenue)], ['Gross profit before D&A', fmtAmount(y.grossProfitExDA)], ['SG&A', fmtAmount(y.sga)], ['Other operating', fmtAmount(y.otherOp)]] },
  { key: 'da', label: 'D&A', formula: 'Roll-forward: depreciation rate × opening PP&E + amortization % × revenue', inputs: (y) => [['Opening PP&E', fmtAmount(y.openingPpe)], ['Depreciation', fmtAmount(y.depreciation)], ['Amortization', fmtAmount(y.amortization)]] },
  { key: 'ebit', label: 'EBIT', formula: 'EBIT = EBITDA − D&A', inputs: (y) => [['EBITDA', fmtAmount(y.ebitda)], ['D&A', fmtAmount(y.da)]] },
  { key: 'nopat', label: 'NOPAT', formula: 'NOPAT = EBIT × (1 − tax rate)', inputs: (y) => [['EBIT', fmtAmount(y.ebit)], ['Tax rate', fmtPct(y.taxRate)]] },
  { key: 'capex', label: 'Capex', formula: 'Capex = revenue × capex % (or absolute amount)', inputs: (y) => [['Revenue', fmtAmount(y.revenue)]] },
  { key: 'deltaNwc', label: 'Change in NWC', formula: 'NWC = receivables + inventory + other current assets − payables − other current liabilities; change vs prior year', inputs: (y) => [['Receivables', fmtAmount(y.receivables)], ['Inventory', fmtAmount(y.inventory)], ['Payables', fmtAmount(y.payables)], ['Other current assets', fmtAmount(y.otherCurrentAssets)], ['Other current liabilities', fmtAmount(y.otherCurrentLiabilities)], ['NWC', fmtAmount(y.nwc)]] },
  { key: 'distributions', label: 'Employee and board distributions', formula: 'Distributions = % × prior-year net profit', inputs: (y) => [['Prior-year net profit', fmtAmount(y.priorYearNetProfit)]] },
  { key: 'fcff', label: 'FCFF', formula: 'FCFF = NOPAT + D&A − capex − change in NWC − distributions', inputs: (y) => [['NOPAT', fmtAmount(y.nopat)], ['D&A', fmtAmount(y.da)], ['Capex', fmtAmount(y.capex)], ['Change in NWC', fmtAmount(y.deltaNwc)], ['Distributions', fmtAmount(y.distributions)]] },
];
