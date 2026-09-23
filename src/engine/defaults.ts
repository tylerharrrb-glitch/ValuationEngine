/**
 * Default assumptions (METHODOLOGY sections 3.2, 3.4, 4-12). Every default is tagged.
 * Macro inputs come from the rates snapshot; analyst defaults are labelled as such.
 */
import type { CompanyData } from '../domain/company';
import { latestYear } from '../domain/company';
import type { Assumptions, CostOfCapitalAssumptions, YearDrivers } from '../domain/assumptions';
import type { RatesSnapshot } from '../domain/rates';
import { RateReader } from './rates';
import { defaultNormalization, normalize } from './normalize';
import { seedDrivers, valueDriverCapexPct, fadeDrivers, runForecast } from './forecast';
import { computeWacc, interestBearingDebt } from './wacc';
import { companyFacts } from './company';

export interface DefaultOptions {
  /** Damodaran emerging-markets industry name. */
  betaIndustry: string;
  projectionYears?: number;
  /** Terminal growth, percent. Egypt default 10. */
  terminalGrowth?: number;
}

export const EG_TERMINAL_GROWTH = 10;
export const NOMINAL_GDP_PROXY = 11;
export const USD_INFLATION_DEFAULT = 2.5;
export const SMALL_FIRM_USD_THRESHOLD = 5e9;

export function buildDefaultAssumptions(c: CompanyData, snapshot: RatesSnapshot, opt: DefaultOptions): Assumptions {
  const r = new RateReader(snapshot);
  const n = opt.projectionYears ?? 5;
  const isEg = c.country === 'EG';
  const cit = r.num('eg.cit');
  const g = opt.terminalGrowth ?? EG_TERMINAL_GROWTH;
  const facts = companyFacts(c);
  const y = latestYear(c);

  const normalization = defaultNormalization(c);
  const norm = normalize(c, normalization);
  const seed = seedDrivers(c, norm, cit);

  const usdMarketCap = facts.marketCap / r.num('eg.usdEgp');
  const costOfCapital: CostOfCapitalAssumptions = {
    rfSource: 'eg_10y_secondary',
    auctionTenorId: 'eg.tbondAuction.3y',
    capmMethod: 'local_rf',
    lambda: 1,
    betaIndustry: opt.betaIndustry,
    unleveredBetaOverride: null,
    releverTaxRate: cit,
    sizePremium: { value: 0, tag: 'Analyst assumption', note: 'No size or illiquidity premium applied.' },
    kdMethod: 'synthetic',
    kdSpreadOverCbe: 0,
    syntheticTable: usdMarketCap < SMALL_FIRM_USD_THRESHOLD ? 'small' : 'large',
    weightMethod: 'market',
    targetDebtWeight: 0,
    rateOverrides: {},
  };
  const wacc = computeWacc(c, costOfCapital, r, norm.normalizedEbit);

  const terminalDrivers: YearDrivers = { ...seed.drivers, revenueGrowth: g };
  terminalDrivers.capexPctRevenue = valueDriverCapexPct(seed, terminalDrivers, g, wacc.wacc);
  terminalDrivers.capexAbsolute = 0;
  const years = fadeDrivers(seed.drivers, terminalDrivers, n);

  const exitMultiple =
    (facts.marketCap + interestBearingDebt(c) - facts.unrestrictedCashAndInvestments) / facts.reportedEbitda;

  const cpi = r.num('eg.cpiUrbanHeadline');
  const target = r.num('cbe.inflationTargetPoint');
  const egpInflation = Array.from({ length: n }, (_, k) => (k === 0 ? cpi : k === 1 ? (cpi + target) / 2 : target));

  const i = y.income;
  const a: Assumptions = {
    valuationDate: c.valuationDate,
    midYear: true,
    projectionYears: n,
    normalization,
    daMethod: 'ppe_rollforward',
    capexMode: 'pct_revenue',
    fadeToTerminal: true,
    years,
    terminal: {
      method: 'gordon',
      growth: {
        value: g,
        tag: 'Analyst assumption',
        note: isEg ? 'Near Egypt long-run nominal GDP; test sensitivity.' : 'Set by the analyst; test sensitivity.',
      },
      exitMultiple: {
        value: exitMultiple,
        tag: 'Estimate',
        note: `Company EV/EBITDA at the price date: (market capitalisation + interest-bearing debt − unrestricted cash and investments) / FY${y.fiscalYear} reported EBITDA.`,
      },
      ronic: null,
      nominalGdpProxy: NOMINAL_GDP_PROXY,
      drivers: terminalDrivers,
    },
    costOfCapital,
    egypt: {
      distributionsOn: isEg,
      distributionsPct: {
        value: (facts.distributionsToPriorYearProfit ?? 0) * 100,
        tag: 'Analyst assumption',
        note: `Based on FY${y.fiscalYear} actual: employee and board distributions paid ÷ FY${y.fiscalYear - 1} net profit.`,
      },
      netFinanceIncome: {
        value: i.financeIncome + i.financeCostDebt + i.financeCostLease + i.financeCostEmployeeBenefit + i.financeCostOther,
        tag: 'Analyst assumption',
        note: `FY${y.fiscalYear} finance income less finance costs, held flat. Used only for forecast net profit (distribution base, forward P/E).`,
      },
    },
    bridge: { deductEmployeeBenefits: true, taxEffectEmployeeBenefits: false, associatesFairValue: null },
    scenarios: [
      { name: 'Bear', probability: 25, revenueGrowthDelta: -5, marginDelta: -3, waccDelta: 1, growthDelta: -1 },
      { name: 'Base', probability: 50, revenueGrowthDelta: 0, marginDelta: 0, waccDelta: 0, growthDelta: 0 },
      { name: 'Bull', probability: 25, revenueGrowthDelta: 5, marginDelta: 3, waccDelta: -1, growthDelta: 1 },
    ],
    ddm: {
      dpsOverride: null,
      highGrowth: { value: 0, tag: 'Analyst assumption', note: 'Forecast revenue CAGR over the projection period.' },
      highGrowthYears: n,
      stableGrowth: { value: g, tag: 'Analyst assumption', note: 'Equal to the DCF terminal growth.' },
    },
    monteCarlo: { seed: 20260923, runs: 10000, revenueGrowthSd: 3, marginSd: 2, waccSd: 1, growthHalfRange: 1, minSpread: 1 },
    usd: { egpInflation, usdInflation: Array.from({ length: n }, () => USD_INFLATION_DEFAULT) },
    sensitivity: { wacc: 1, growth: 1, exitMultiple: 1, revenueGrowth: 2, margin: 2, rf: 1, beta: 0.1 },
    blend: { dcf: 75, ddm: 25, comps: 0, precedents: 0, sotp: 0 },
    fx: { usdRevenueShare: facts.exportShare === null ? null : facts.exportShare * 100, usdCostShare: null },
  };

  const f = runForecast(c, norm, a);
  a.ddm.highGrowth.value = (Math.pow(f.years[n - 1].revenue / f.base.revenue, 1 / n) - 1) * 100;
  return a;
}
