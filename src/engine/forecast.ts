/** Per-year operating model and FCFF (METHODOLOGY section 3). Pure. */
import type { CompanyData } from '../domain/company';
import { latestYear, priorYear } from '../domain/company';
import type { Assumptions, YearDrivers } from '../domain/assumptions';
import type { ForecastBase, ForecastResult, ForecastYear, NormalizationResult } from '../domain/result';

/** Overrides used by scenarios, sensitivities, reverse DCF and Monte Carlo (full re-runs). */
export interface CoreOverrides {
  /** Replaces the computed WACC (decimal). */
  wacc?: number;
  /** Added to the computed WACC (percentage points). */
  waccDelta?: number;
  /** Replaces terminal growth (percent). */
  growth?: number;
  /** Added to terminal growth (percentage points). */
  growthDelta?: number;
  terminalMethod?: 'gordon' | 'exit_multiple';
  exitMultiple?: number;
  /** Added to every projection year's revenue growth (pp). */
  revenueGrowthDelta?: number;
  /** Added to gross margin before D&A in every year including terminal (pp). */
  marginDelta?: number;
  /** Replaces every projection year's revenue growth (percent). */
  uniformRevenueGrowth?: number;
  /** Replaces the risk-free rate (percent). */
  rf?: number;
  /** Replaces the levered beta. */
  leveredBeta?: number;
}

export interface SeedResult {
  drivers: YearDrivers;
  base: ForecastBase;
  /** Operating NWC / revenue at seed drivers. */
  nwcPct: number;
  daPct: number;
}

const otherCurrentAssetsOf = (b: CompanyData['years'][number]['balance']) => b.otherCurrentAssets + b.supplierAdvances + b.dueFromRelatedParties;
const otherCurrentLiabilitiesOf = (b: CompanyData['years'][number]['balance']) =>
  b.otherPayables + b.customerAdvances + b.provisions + b.dueToRelatedParties + b.otherCurrentLiabilities;

/** Base-year ratios (METHODOLOGY 3.1). `taxRate` in percent. */
export function seedDrivers(c: CompanyData, norm: NormalizationResult, taxRate: number): SeedResult {
  const y = latestYear(c);
  const p = priorYear(c);
  const i = y.income;
  const b = y.balance;
  const R = i.revenue;
  const da = i.depreciation + i.amortization;
  const gmx = (i.grossProfit + da) / R;
  const sga = -(i.sellingMarketing + i.generalAdmin) / R;
  const oth = (norm.normalizedEbit - i.grossProfit - i.sellingMarketing - i.generalAdmin) / R;
  const cashCogs = R * (1 - gmx);
  const oca = otherCurrentAssetsOf(b);
  const ocl = otherCurrentLiabilitiesOf(b);
  const openingPpe = p ? p.balance.ppe : b.ppe;
  const drivers: YearDrivers = {
    revenueGrowth: p ? (R / p.income.revenue - 1) * 100 : 0,
    grossMarginExDA: gmx * 100,
    sgaPctRevenue: sga * 100,
    otherOpPctRevenue: oth * 100,
    daPctRevenue: (da / R) * 100,
    depreciationRate: (i.depreciation / openingPpe) * 100,
    amortizationPctRevenue: (i.amortization / R) * 100,
    capexPctRevenue: (-y.cashFlow.capex / R) * 100,
    capexAbsolute: -y.cashFlow.capex,
    dso: (b.receivables / R) * 365,
    dio: (b.inventory / cashCogs) * 365,
    dpo: (b.tradePayables / cashCogs) * 365,
    otherCurrentAssetsPctRevenue: (oca / R) * 100,
    otherCurrentLiabilitiesPctRevenue: (ocl / R) * 100,
    taxRate,
  };
  const nwc = b.receivables + b.inventory + oca - b.tradePayables - ocl;
  const base: ForecastBase = {
    fiscalYear: y.fiscalYear,
    revenue: R,
    cashCogs,
    normalizedEbitda: norm.normalizedEbitda,
    normalizedEbit: norm.normalizedEbit,
    closingPpe: b.ppe,
    receivables: b.receivables,
    inventory: b.inventory,
    payables: b.tradePayables,
    otherCurrentAssets: oca,
    otherCurrentLiabilities: ocl,
    nwc,
    netProfit: i.netProfit,
  };
  const nwcPct = drivers.dso / 365 + (1 - gmx) * (drivers.dio - drivers.dpo) / 365 + (oca - ocl) / R;
  return { drivers, base, nwcPct, daPct: da / R };
}

/** Value-driver-consistent terminal capex % revenue (METHODOLOGY 3.4). Inputs in percent; returns percent. */
export function valueDriverCapexPct(seed: SeedResult, terminal: YearDrivers, g: number, ronic: number): number {
  const gd = g / 100;
  const rr = gd / (ronic / 100);
  const gmx = terminal.grossMarginExDA / 100;
  const nwcPct = terminal.dso / 365 + (1 - gmx) * (terminal.dio - terminal.dpo) / 365 +
    (terminal.otherCurrentAssetsPctRevenue - terminal.otherCurrentLiabilitiesPctRevenue) / 100;
  const ebitdaM = gmx - terminal.sgaPctRevenue / 100 + terminal.otherOpPctRevenue / 100;
  const tau = terminal.taxRate / 100;
  return (seed.daPct - nwcPct * gd / (1 + gd) + rr * (ebitdaM - seed.daPct) * (1 - tau)) * 100;
}

/** Linear fade from year-1 drivers to terminal drivers (METHODOLOGY 3.2). */
export function fadeDrivers(first: YearDrivers, terminal: YearDrivers, n: number): YearDrivers[] {
  const keys = Object.keys(first) as (keyof YearDrivers)[];
  return Array.from({ length: n }, (_, k) => {
    const w = n > 1 ? k / (n - 1) : 0;
    const d = {} as YearDrivers;
    for (const key of keys) d[key] = first[key] + (terminal[key] - first[key]) * w;
    return d;
  });
}

function applyYearOverrides(d: YearDrivers, ov: CoreOverrides, isTerminal: boolean): YearDrivers {
  const out = { ...d };
  if (!isTerminal) {
    if (ov.uniformRevenueGrowth !== undefined) out.revenueGrowth = ov.uniformRevenueGrowth;
    if (ov.revenueGrowthDelta) out.revenueGrowth += ov.revenueGrowthDelta;
  }
  if (ov.marginDelta) out.grossMarginExDA += ov.marginDelta;
  return out;
}

export function terminalGrowth(a: Assumptions, ov: CoreOverrides): number {
  return (ov.growth ?? a.terminal.growth.value) + (ov.growthDelta ?? 0);
}

export function runForecast(c: CompanyData, norm: NormalizationResult, a: Assumptions, ov: CoreOverrides = {}): ForecastResult {
  const seed = seedDrivers(c, norm, a.years[0]?.taxRate ?? a.terminal.drivers.taxRate);
  const base = seed.base;
  const n = a.projectionYears;
  if (a.years.length < n) throw new Error(`Assumptions have ${a.years.length} year driver sets; ${n} required`);
  const distOn = a.egypt.distributionsOn;
  const distPct = a.egypt.distributionsPct.value / 100;
  const nfi = a.egypt.netFinanceIncome.value;
  const g = terminalGrowth(a, ov);

  const years: ForecastYear[] = [];
  let prevRevenue = base.revenue;
  let prevPpe = base.closingPpe;
  let prevNwc = base.nwc;
  let prevNp = base.netProfit;

  const step = (index: number, label: string, fiscalYear: number, d: YearDrivers, growth: number, capexAbsolute: number | null): ForecastYear => {
    const revenue = prevRevenue * (1 + growth / 100);
    const gmx = d.grossMarginExDA / 100;
    const grossProfitExDA = revenue * gmx;
    const sga = revenue * d.sgaPctRevenue / 100;
    const otherOp = revenue * d.otherOpPctRevenue / 100;
    const ebitda = grossProfitExDA - sga + otherOp;
    const capex = capexAbsolute ?? revenue * d.capexPctRevenue / 100;
    const openingPpe = prevPpe;
    let depreciation: number;
    let amortization: number;
    if (a.daMethod === 'ppe_rollforward') {
      depreciation = openingPpe * d.depreciationRate / 100;
      amortization = revenue * d.amortizationPctRevenue / 100;
    } else {
      depreciation = revenue * d.daPctRevenue / 100;
      amortization = 0;
    }
    const da = depreciation + amortization;
    const closingPpe = openingPpe + capex - depreciation;
    const ebit = ebitda - da;
    const taxRate = d.taxRate;
    const taxOnEbit = ebit * taxRate / 100;
    const nopat = ebit - taxOnEbit;
    const cashCogs = revenue * (1 - gmx);
    const receivables = revenue * d.dso / 365;
    const inventory = cashCogs * d.dio / 365;
    const payables = cashCogs * d.dpo / 365;
    const otherCurrentAssets = revenue * d.otherCurrentAssetsPctRevenue / 100;
    const otherCurrentLiabilities = revenue * d.otherCurrentLiabilitiesPctRevenue / 100;
    const nwc = receivables + inventory + otherCurrentAssets - payables - otherCurrentLiabilities;
    const deltaNwc = nwc - prevNwc;
    const netProfit = nopat + nfi * (1 - taxRate / 100);
    const distributions = distOn ? distPct * prevNp : 0;
    const fcff = nopat + da - capex - deltaNwc - distributions;
    const row: ForecastYear = {
      index, label, fiscalYear, revenue, revenueGrowth: growth, grossProfitExDA, sga, otherOp, ebitda,
      depreciation, amortization, da, ebit, taxRate, taxOnEbit, nopat, capex, openingPpe, closingPpe, cashCogs,
      receivables, inventory, payables, otherCurrentAssets, otherCurrentLiabilities, nwc, deltaNwc,
      priorYearNetProfit: prevNp, distributions, netProfit, fcff,
    };
    prevRevenue = revenue;
    prevPpe = closingPpe;
    prevNwc = nwc;
    prevNp = netProfit;
    return row;
  };

  for (let t = 1; t <= n; t++) {
    const d = applyYearOverrides(a.years[t - 1], ov, false);
    const cap = a.capexMode === 'absolute' ? d.capexAbsolute : null;
    years.push(step(t, `${base.fiscalYear + t}E`, base.fiscalYear + t, d, d.revenueGrowth, cap));
  }
  const td = applyYearOverrides(a.terminal.drivers, ov, true);
  const terminal = step(n + 1, 'Terminal', base.fiscalYear + n + 1, td, g, null);
  return { base, years, terminal };
}
