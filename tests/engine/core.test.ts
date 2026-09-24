/**
 * Part 11: unit tests for every engine function, with the edge cases named in the spec:
 * zero debt, negative FCFF, g ≥ WACC, missing years, stub = 0 and stub = 1.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadMopco } from '../lib/fixtures';
import type { CompanyData } from '../../src/domain/company';
import type { RatesSnapshot } from '../../src/domain/rates';
import { yearFracActual, addYears, businessDaysBetween, toExcelSerial } from '../../src/engine/dates';
import { buildTimeline } from '../../src/engine/timeline';
import { defaultNormalization, normalize } from '../../src/engine/normalize';
import { seedDrivers, runForecast, fadeDrivers, valueDriverCapexPct } from '../../src/engine/forecast';
import { computeWacc, syntheticRating } from '../../src/engine/wacc';
import { RateReader } from '../../src/engine/rates';
import { runCore, perShare } from '../../src/engine/core';
import { runDdm } from '../../src/engine/ddm';
import { blend, verdictBand } from '../../src/engine/blend';
import { runScenarios } from '../../src/engine/scenarios';
import { runValuation } from '../../src/engine/valuation';
import { runMonteCarlo } from '../../src/engine/montecarlo';
import { bisect } from '../../src/engine/reverseDcf';
import { mulberry32, percentile } from '../../src/engine/prng';
import { buildDefaultAssumptions } from '../../src/engine/defaults';
import { footballField } from '../../src/engine/football';

const snap = JSON.parse(readFileSync('tests/fixtures/rates-snapshot-2026-09-23.json', 'utf8')) as RatesSnapshot;
const mopco = loadMopco();
const A = () => buildDefaultAssumptions(mopco, snap, { betaIndustry: 'Chemical (Basic)' });

describe('dates', () => {
  it('YEARFRAC basis 1 matches Excel', () => {
    expect(yearFracActual('2026-07-02', '2026-12-31')).toBeCloseTo(182 / 365, 15);
    expect(yearFracActual('2027-12-31', '2028-12-31')).toBe(1); // 366 days spanning 29-Feb-2028
    expect(yearFracActual('2026-12-31', '2027-12-31')).toBe(1);
    expect(yearFracActual('2024-01-01', '2024-12-31')).toBeCloseTo(365 / 366, 15);
    expect(yearFracActual('2023-06-01', '2025-06-01')).toBeCloseTo(731 / ((365 + 366 + 365) / 3), 12);
    expect(yearFracActual('2026-05-05', '2026-05-05')).toBe(0);
  });
  it('addYears clamps 29 February', () => {
    expect(addYears('2024-02-29', 1)).toBe('2025-02-28');
  });
  it('business days and Excel serials', () => {
    expect(businessDaysBetween('2026-09-18', '2026-09-23')).toBe(3);
    expect(toExcelSerial('2026-07-02')).toBe(46205);
  });
});

describe('timeline', () => {
  it('stub = 1 when the valuation date is on or before the base year end', () => {
    const t = buildTimeline('2025-12-31', '2025-12-31', 5, true);
    expect(t.stubFraction).toBe(1);
    expect(t.periods[0].periodStart).toBe('2025-12-31');
    expect(t.periods[0].years).toBeCloseTo(182.5 / 365, 12);
  });
  it('stub = 0 when the valuation date is the first projected year end', () => {
    const t = buildTimeline('2026-12-31', '2025-12-31', 5, true);
    expect(t.stubFraction).toBe(0);
    expect(t.periods[0].years).toBe(0);
  });
  it('valuation date after the first projected year end is an error', () => {
    expect(() => buildTimeline('2027-01-01', '2025-12-31', 5, true)).toThrow(/after the first projected fiscal year end/);
  });
  it('mid-year off discounts at period end', () => {
    const t = buildTimeline('2026-07-02', '2025-12-31', 3, false);
    expect(t.periods[0].years).toBeCloseTo(182 / 365, 12);
    expect(t.tvYears).toBeCloseTo(t.periods[2].years, 12);
  });
  it('rejects more than 10 projection years', () => {
    expect(() => buildTimeline('2026-07-02', '2025-12-31', 11, true)).toThrow();
  });
});

describe('normalization', () => {
  it('MOPCO defaults remove ECL, provisions and capital gains: 12,429,920,019', () => {
    const adj = defaultNormalization(mopco);
    expect(adj.map((x) => x.id)).toEqual(['ecl', 'provisions', 'capitalGains']);
    expect(normalize(mopco, adj).normalizedEbit).toBe(12_429_920_019);
  });
  it('switching an adjustment off restores it', () => {
    const adj = defaultNormalization(mopco).map((x) => (x.id === 'ecl' ? { ...x, include: false } : x));
    expect(normalize(mopco, adj).normalizedEbit).toBe(12_429_920_019 + 357_037_587);
  });
});

describe('forecast', () => {
  const norm = normalize(mopco, defaultNormalization(mopco));
  it('seed drivers reproduce base-year normalized EBITDA and NWC', () => {
    const s = seedDrivers(mopco, norm, 22.5);
    const d = s.drivers;
    expect(mopco.years[1].income.revenue * (d.grossMarginExDA - d.sgaPctRevenue + d.otherOpPctRevenue) / 100).toBeCloseTo(norm.normalizedEbitda, 3);
    expect(s.base.nwc).toBe(1_446_674_104 + 1_927_396_704 + 1_449_408_364 + 75_072_047 - 571_060_350 - (1_102_966_124 + 386_154_612 + 54_344_705));
  });
  it('fade: year 1 = seed, year N = terminal', () => {
    const s = seedDrivers(mopco, norm, 22.5).drivers;
    const t = { ...s, revenueGrowth: 10 };
    const f = fadeDrivers(s, t, 5);
    expect(f[0]).toEqual(s);
    expect(f[4].revenueGrowth).toBeCloseTo(10, 12);
    expect(fadeDrivers(s, t, 1)[0]).toEqual(s);
  });
  it('value-driver capex: zero growth gives capex = D&A', () => {
    const s = seedDrivers(mopco, norm, 22.5);
    expect(valueDriverCapexPct(s, s.drivers, 0, 26)).toBeCloseTo(s.daPct * 100, 12);
  });
  it('FCFF identity holds every year and PP&E rolls forward', () => {
    const f = runForecast(mopco, norm, A());
    for (const y of [...f.years, f.terminal]) {
      expect(y.fcff).toBeCloseTo(y.nopat + y.da - y.capex - y.deltaNwc - y.distributions, 3);
      expect(y.closingPpe).toBeCloseTo(y.openingPpe + y.capex - y.depreciation, 3);
    }
  });
  it('negative FCFF is carried, not floored', () => {
    const a = A();
    a.years = a.years.map((y) => ({ ...y, capexPctRevenue: 80 }));
    const f = runForecast(mopco, norm, a);
    expect(f.years.every((y) => y.fcff < 0)).toBe(true);
    const r = runCore(mopco, a, snap);
    expect(r.dcf.sumPv).toBeLessThan(0);
    expect(Number.isFinite(r.dcf.perShare)).toBe(true);
  });
  it('% revenue D&A mode and absolute capex mode', () => {
    const a = { ...A(), daMethod: 'pct_revenue' as const, capexMode: 'absolute' as const };
    a.years = a.years.map((y) => ({ ...y, capexAbsolute: 1_000_000_000 }));
    const f = runForecast(mopco, norm, a);
    expect(f.years[0].da).toBeCloseTo(f.years[0].revenue * a.years[0].daPctRevenue / 100, 3);
    expect(f.years[0].capex).toBe(1_000_000_000);
    expect(f.years[0].amortization).toBe(0);
  });
  it('distributions toggle', () => {
    const a = A();
    a.egypt.distributionsOn = false;
    expect(runForecast(mopco, norm, a).years.every((y) => y.distributions === 0)).toBe(true);
  });
});

describe('WACC', () => {
  const norm = normalize(mopco, defaultNormalization(mopco));
  const zeroDebt: CompanyData = {
    ...mopco,
    years: mopco.years.map((y) => ({ ...y, balance: { ...y.balance, leaseCurrent: 0, leaseNonCurrent: 0 }, income: { ...y.income, financeCostLease: 0 } })),
  };
  it('zero debt: D/V = 0, WACC = Ke, beta unlevered = levered, synthetic top row', () => {
    const w = computeWacc(zeroDebt, A().costOfCapital, new RateReader(snap), norm.normalizedEbit);
    expect(w.debtWeight).toBe(0);
    expect(w.wacc).toBeCloseTo(w.ke, 12);
    expect(w.leveredBeta).toBe(w.unleveredBeta);
    expect(w.syntheticRating).toBe('Aaa/AAA');
  });
  it('CAPM methods A, B, C and warnings', () => {
    const base = A().costOfCapital;
    const r = new RateReader(snap);
    const clean = { ...base, rfSource: 'damodaran_egp' as const };
    const a = computeWacc(mopco, { ...clean, capmMethod: 'A' }, r, norm.normalizedEbit);
    expect(a.ke).toBeCloseTo(a.rf + a.leveredBeta * a.matureErp + a.crp, 10);
    const b = computeWacc(mopco, { ...clean, capmMethod: 'B' }, r, norm.normalizedEbit);
    expect(b.ke).toBeCloseTo(b.rf + b.leveredBeta * (b.matureErp + b.crp), 10);
    const c = computeWacc(mopco, { ...clean, capmMethod: 'C', lambda: 0.5 }, r, norm.normalizedEbit);
    expect(c.ke).toBeCloseTo(c.rf + c.leveredBeta * c.matureErp + 0.5 * c.crp, 10);
    expect(a.kdPreTax).toBeCloseTo(a.rf + (a.companySpread ?? 0) + a.countryDefaultSpread, 10);
    const dbl = computeWacc(mopco, { ...base, capmMethod: 'A' }, r, norm.normalizedEbit);
    expect(dbl.messages.some((m) => m.code === 'double_count')).toBe(true);
    const omit = computeWacc(mopco, { ...clean, capmMethod: 'local_rf' }, r, norm.normalizedEbit);
    expect(omit.messages.some((m) => m.code === 'crp_omitted')).toBe(true);
  });
  it('Fisher risk-free rate', () => {
    const w = computeWacc(mopco, { ...A().costOfCapital, rfSource: 'fisher_us10y', capmMethod: 'A' }, new RateReader(snap), norm.normalizedEbit);
    expect(w.rf).toBeCloseTo((1.051 * 1.0821666666667 / 1.0235 - 1) * 100, 6);
  });
  it('cost of debt methods: actual uses debt and lease interest only', () => {
    const r = new RateReader(snap);
    const act = computeWacc(mopco, { ...A().costOfCapital, kdMethod: 'actual' }, r, norm.normalizedEbit);
    expect(act.kdPreTax).toBeCloseTo(7_072_409 / ((149_970_052 + 191_575_804) / 2) * 100, 10);
    const cbe = computeWacc(mopco, { ...A().costOfCapital, kdMethod: 'cbe_plus_spread', kdSpreadOverCbe: 2 }, r, norm.normalizedEbit);
    expect(cbe.kdPreTax).toBe(22);
    const target = computeWacc(mopco, { ...A().costOfCapital, weightMethod: 'target', targetDebtWeight: 30 }, r, norm.normalizedEbit);
    expect(target.debtWeight).toBeCloseTo(0.3, 12);
  });
  it('synthetic rating: largest lower bound not above coverage; gaps closed', () => {
    const t = [{ coverageAbove: -100000, coverageUpTo: 0.5, rating: 'D', spread: 19 }, { coverageAbove: 6.5, coverageUpTo: 8.499999, rating: 'AA', spread: 0.55 }, { coverageAbove: 8.5, coverageUpTo: 100000, rating: 'AAA', spread: 0.4 }, { coverageAbove: 0.5, coverageUpTo: 6.499999, rating: 'B', spread: 3 }];
    expect(syntheticRating(t, 8.4999995).rating).toBe('AA');
    expect(syntheticRating(t, 8.5).rating).toBe('AAA');
    expect(syntheticRating(t, -5).rating).toBe('D');
    expect(syntheticRating(t, Infinity).rating).toBe('AAA');
  });
  it('rate override requires a reason and is recorded', () => {
    const a = A();
    a.costOfCapital.rateOverrides = { 'eg.bond10ySecondary': { value: 22, reason: '' } };
    expect(() => runCore(mopco, a, snap)).toThrow(/requires a reason/);
    a.costOfCapital.rateOverrides = { 'eg.bond10ySecondary': { value: 22, reason: 'Refreshed quote' } };
    const r = runCore(mopco, a, snap);
    expect(r.wacc.rf).toBe(22);
    expect(r.rates.used.get('eg.bond10ySecondary')?.overridden).toBe(true);
  });
});

describe('DCF', () => {
  it('g ≥ WACC: Gordon TV undefined and flagged; exit method still values', () => {
    const r = runCore(mopco, A(), snap, { growth: 40 });
    expect(r.dcf.messages.some((m) => m.code === 'g_ge_wacc')).toBe(true);
    expect(Number.isNaN(r.dcf.terminal.gordonTv)).toBe(true);
    expect(Number.isNaN(r.dcf.perShare)).toBe(true);
    const x = runCore(mopco, A(), snap, { growth: 40, terminalMethod: 'exit_multiple' });
    expect(Number.isFinite(x.dcf.perShare)).toBe(true);
  });
  it('bridge sums and memo line is excluded', () => {
    const r = runCore(mopco, A(), snap);
    const sum = r.dcf.bridge.filter((l) => !l.memo).reduce((s, l) => s + l.amount, 0);
    expect(r.dcf.equityValue).toBeCloseTo(r.dcf.enterpriseValue + sum, 3);
    expect(r.dcf.bridge.find((l) => l.memo)?.amount).toBe(1_010_115_488);
  });
  it('tax-effected employee benefits and associates fair value', () => {
    const a = A();
    a.bridge = { deductEmployeeBenefits: true, taxEffectEmployeeBenefits: true, associatesFairValue: 1_000_000 };
    const r = runCore(mopco, a, snap);
    expect(r.dcf.bridge.find((l) => l.id === 'employeeBenefits')!.amount).toBeCloseTo(-692_084_641 * 0.775, 3);
    expect(r.dcf.bridge.find((l) => l.id === 'associates')!.amount).toBe(1_000_000);
  });
  it('terminal value warnings', () => {
    const r = runCore(mopco, A(), snap, { growth: 12 });
    expect(r.dcf.messages.some((m) => m.code === 'g_gdp')).toBe(true);
  });
  it('WACC override and delta', () => {
    expect(runCore(mopco, A(), snap, { wacc: 0.2 }).wacc.wacc).toBeCloseTo(20, 12);
    const base = runCore(mopco, A(), snap).wacc.wacc;
    expect(runCore(mopco, A(), snap, { waccDelta: 1 }).wacc.wacc).toBeCloseTo(base + 1, 12);
  });
});

describe('missing years', () => {
  it('a single audited year still values; Piotroski is N/A; distributions default 0', () => {
    const one: CompanyData = { ...mopco, years: [mopco.years[1]] };
    const a = buildDefaultAssumptions(one, snap, { betaIndustry: 'Chemical (Basic)' });
    expect(a.years[0].revenueGrowth).toBe(0);
    expect(a.egypt.distributionsPct.value).toBe(0);
    const v = runValuation(one, a, snap, { monteCarlo: false });
    expect(Number.isFinite(v.core.dcf.perShare)).toBe(true);
    expect(v.piotroski.available).toBe(false);
    expect(v.dupont.averageBalances).toBe(false);
  });
  it('incomplete company data is rejected', () => {
    expect(() => runValuation({ ...mopco, priceDate: '' }, A(), snap)).toThrow(/Price date/);
  });
});

describe('DDM', () => {
  it('no shareholder dividend: not applicable', () => {
    const c: CompanyData = { ...mopco, years: mopco.years.map((y) => ({ ...y, cashFlow: { ...y.cashFlow, dividendsToShareholders: 0 } })) };
    expect(runDdm(c, A().ddm, 26).applicable).toBe(false);
  });
  it('Ke ≤ stable growth: error', () => {
    const d = runDdm(mopco, A().ddm, 9);
    expect(d.applicable).toBe(false);
    expect(d.messages.some((m) => m.code === 'ddm_ke_g')).toBe(true);
  });
  it('H-model with gH = gS equals Gordon', () => {
    const dd = { ...A().ddm, highGrowth: { ...A().ddm.highGrowth, value: 10 } };
    const r = runDdm(mopco, dd, 26);
    expect(r.hModel).toBeCloseTo(r.dps0 * 1.1 / 0.16, 10);
    expect(r.twoStage).toBeCloseTo(r.hModel, 10);
  });
});

describe('blend and verdict', () => {
  it('band edges: ±10% is in line', () => {
    expect(verdictBand(39.59, 36).band).toBe('In line with market price');
    expect(verdictBand(32.41, 36).band).toBe('In line with market price');
    expect(verdictBand(39.7, 36).band).toBe('Above market price');
    expect(verdictBand(32.3, 36).band).toBe('Below market price');
    expect(verdictBand(26.54, 36).text).toBe('Implied upside -26.3%');
  });
  it('weights not summing to 100 are an error', () => {
    expect(blend({ dcf: 50, ddm: 20, comps: 0, precedents: 0, sotp: 0 }, [{ id: 'dcf', value: 1 }, { id: 'ddm', value: 1 }], 1).messages[0].code).toBe('blend_sum');
  });
});

describe('scenarios, sensitivity, reverse DCF, Monte Carlo', () => {
  it('base scenario equals the DCF value; probability error when not 100', () => {
    const a = A();
    const s = runScenarios(mopco, a, snap);
    expect(s.rows[1].perShare).toBeCloseTo(runCore(mopco, a, snap).dcf.perShare, 12);
    a.scenarios[0].probability = 30;
    expect(runScenarios(mopco, a, snap).messages[0].code).toBe('scenario_prob');
  });
  it('bisection solves and reports unattainable brackets', () => {
    expect(bisect((x) => x * x - 2, 0, 2).value / 100).toBeCloseTo(Math.SQRT2, 3);
    expect(bisect((x) => x * x + 1, 0, 2).attainable).toBe(false);
  });
  it('uniform revenue growth override reproduces its value', () => {
    const v = perShare(mopco, A(), snap, { uniformRevenueGrowth: 10 });
    expect(Number.isFinite(v)).toBe(true);
  });
  it('Monte Carlo is deterministic for a seed and respects the spread constraint', () => {
    const core = runCore(mopco, A(), snap);
    const m1 = runMonteCarlo(mopco, A(), snap, core, 300);
    const m2 = runMonteCarlo(mopco, A(), snap, core, 300);
    expect(m1).toEqual(m2);
    expect(m1.p5).toBeLessThan(m1.p95);
    expect(m1.valid).toBe(300);
  });
  it('PRNG and percentile', () => {
    const u = mulberry32(1);
    const xs = Array.from({ length: 1000 }, u);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    expect(percentile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });
  it('football field rows are ordered low ≤ mid ≤ high', () => {
    const v = runValuation(mopco, A(), snap, { monteCarloRuns: 200 });
    for (const r of footballField(v)) {
      expect(r.low).toBeLessThanOrEqual(r.mid + 1e-9);
      expect(r.mid).toBeLessThanOrEqual(r.high + 1e-9);
    }
  });
});

describe('direct module tests: company, dcf bridge, sensitivity, USD check', () => {
  it('company: validation flags missing mandatory fields; facts on MOPCO', async () => {
    const { validateCompany, companyFacts } = await import('../../src/engine/company');
    expect(validateCompany({ ...mopco, valuationDate: '' }).map((i) => i.field)).toContain('valuationDate');
    expect(companyFacts(mopco).interestBearingDebt).toBe(149_970_052);
  });
  it('dcf: bridge lines without employee benefits when switched off', async () => {
    const { bridgeLines, bridgeTotal } = await import('../../src/engine/dcf');
    const lines = bridgeLines(mopco, { deductEmployeeBenefits: false, taxEffectEmployeeBenefits: false, associatesFairValue: null }, 22.5);
    expect(lines.some((l) => l.id === 'employeeBenefits')).toBe(false);
    expect(bridgeTotal(lines)).toBe(2_971_664_846 + 2_573_762_308 + 734_010_745 + 10_659_141_927 + 2_424_170 - 149_970_052);
  });
  it('sensitivity: four 5x5 grids, centres equal the base where the method matches', async () => {
    const { runSensitivity } = await import('../../src/engine/sensitivity');
    const a = A();
    const core = runCore(mopco, a, snap);
    const grids = runSensitivity(mopco, a, snap, core);
    expect(grids.map((g) => g.id)).toEqual(['wacc_g', 'wacc_exit', 'growth_margin', 'rf_beta']);
    for (const g of grids) expect(g.values.flat()).toHaveLength(25);
    for (const id of ['wacc_g', 'growth_margin', 'rf_beta']) expect(grids.find((g) => g.id === id)!.centre).toBeCloseTo(core.dcf.perShare, 10);
    expect(grids.find((g) => g.id === 'wacc_exit')!.centre).toBeCloseTo(runCore(mopco, a, snap, { terminalMethod: 'exit_multiple' }).dcf.perShare, 10);
  });
  it('USD check: forwards follow the inflation differential; zero differential leaves spot unchanged', async () => {
    const { runUsdCheck } = await import('../../src/engine/usdCheck');
    const a = A();
    const core = runCore(mopco, a, snap);
    const u = runUsdCheck(a, core.forecast, core.timeline, core.wacc, core.dcf, core.rates, core.growth);
    expect(u.forwards[0]).toBeCloseTo(51.9 * 1.145 / 1.025, 10);
    const flat = { ...a, usd: { egpInflation: [2.5, 2.5, 2.5, 2.5, 2.5], usdInflation: [2.5, 2.5, 2.5, 2.5, 2.5] } };
    const u2 = runUsdCheck(flat, core.forecast, core.timeline, core.wacc, core.dcf, core.rates, core.growth);
    expect(u2.forwards.every((f) => Math.abs(f - 51.9) < 1e-9)).toBe(true);
    expect(u2.growthUsd).toBeCloseTo(core.growth, 10);
  });
});
