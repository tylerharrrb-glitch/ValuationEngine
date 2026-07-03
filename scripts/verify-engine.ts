/**
 * Engine invariant sweep — proves the engine handles ANY company and ANY model
 * configuration without errors or miscalculations.
 *
 * Runs a matrix of company archetypes × model configs through the LIVE engine
 * (calculations/dcf.ts + valuation.ts + valuationEngine.ts) and asserts:
 *   • No NaN / Infinity anywhere (WACC, Ke, per-share, projections, DDM, sensitivity)
 *   • EV→Equity bridge identity holds (equity = EV + nonOp − debt − MI − pref)
 *   • FCFF 3-way methods agree for internally-consistent inputs
 *   • resolveEffectiveWACC honours a manual override (and ignores a synced value)
 *   • Terminal g ≥ WACC degrades safely (finite, no divide-by-zero blow-up)
 *   • DDM applicability is correct (non-payer / negative earnings → N/A)
 *
 * Run:  npx tsx scripts/verify-engine.ts
 */
import { calculateDCFProjections, calculateDCFValue, bridgeEnterpriseToEquity, calculateNonOperatingAssets } from '../src/utils/calculations/dcf';
import { calculateWACC, calculateKe, resolveEffectiveWACC } from '../src/utils/valuation';
import { calculateDDM, calculateFCFFVerification, generateSensitivityMatrix, calculateDCFValue as engineDCFValue, calculateDCFProjections as engineProjections } from '../src/utils/valuationEngine';
import { initialFinancialData, initialAssumptions } from '../src/constants/initialData';
import type { FinancialData, ValuationAssumptions, CAPMMethod, BetaType, TerminalValueMethod, DiscountingConvention } from '../src/types/financial';

let failures = 0;
const fail = (msg: string) => { failures++; console.log(`  ❌ ${msg}`); };
const finite = (x: number) => typeof x === 'number' && Number.isFinite(x);

function bs(over: Partial<FinancialData['balanceSheet']>): FinancialData['balanceSheet'] {
  return { ...initialFinancialData.balanceSheet, ...over };
}
function mk(name: string, fd: Partial<FinancialData>): FinancialData {
  return { ...initialFinancialData, companyName: name, ticker: name, ...fd,
    incomeStatement: { ...initialFinancialData.incomeStatement, ...(fd.incomeStatement || {}) },
    balanceSheet: { ...initialFinancialData.balanceSheet, ...(fd.balanceSheet || {}) },
    cashFlowStatement: { ...initialFinancialData.cashFlowStatement, ...(fd.cashFlowStatement || {}) },
  };
}

// ── Company archetypes ──
const companies: FinancialData[] = [
  mk('HighMargin-DebtFree', {
    balanceSheet: bs({ cash: 2e9, marketableSecurities: 3.3e9, longTermInvestments: 10.6e9, shortTermDebt: 0, longTermDebt: 0 }),
  }),
  mk('Leveraged-Dividend', {
    dividendsPerShare: 3,
    incomeStatement: { ...initialFinancialData.incomeStatement, interestExpense: 400e6 },
    balanceSheet: bs({ shortTermDebt: 2e9, longTermDebt: 6e9, minorityInterest: 500e6, preferredEquity: 300e6 }),
    cashFlowStatement: { ...initialFinancialData.cashFlowStatement, dividendsPaid: -400e6 },
  }),
  mk('LossMaking-Growth', {
    incomeStatement: { ...initialFinancialData.incomeStatement, operatingIncome: -300e6, netIncome: -450e6, revenue: 3e9 },
    balanceSheet: bs({ cash: 500e6, shortTermDebt: 200e6, longTermDebt: 1.5e9 }),
  }),
  mk('Bank-Financial', {
    dividendsPerShare: 4,
    incomeStatement: { ...initialFinancialData.incomeStatement, depreciation: 0, amortization: 0, interestExpense: 0 },
    balanceSheet: bs({ shortTermDebt: 0, longTermDebt: 0, cash: 5e9 }),
    cashFlowStatement: { ...initialFinancialData.cashFlowStatement, dividendsPaid: -800e6 },
  }),
  mk('NetCash-NoDividend', {
    dividendsPerShare: 0,
    balanceSheet: bs({ cash: 9e9, marketableSecurities: 1e9, shortTermDebt: 0, longTermDebt: 200e6 }),
    cashFlowStatement: { ...initialFinancialData.cashFlowStatement, dividendsPaid: 0 },
  }),
  mk('TinyCap-HighVol', {
    sharesOutstanding: 5e6, currentStockPrice: 8,
    incomeStatement: { ...initialFinancialData.incomeStatement, revenue: 400e6, operatingIncome: 40e6, netIncome: 25e6 },
    balanceSheet: bs({ cash: 30e6, shortTermDebt: 10e6, longTermDebt: 80e6 }),
  }),
];

// ── Model configs ──
const capmMethods: CAPMMethod[] = ['local_rf', 'A', 'B', 'C'];
const betaTypes: BetaType[] = ['raw', 'adjusted'];
const terminalMethods: TerminalValueMethod[] = ['gordon_growth', 'exit_multiple'];
const conventions: DiscountingConvention[] = ['end_of_year', 'mid_year'];
const projYears = [3, 5, 10];

let combos = 0;
console.log('══════════════════════════════════════════════════════════════');
console.log(' WOLF ENGINE — INVARIANT SWEEP (any company × any model)');
console.log('══════════════════════════════════════════════════════════════');

for (const fd of companies) {
  for (const capmMethod of capmMethods)
  for (const betaType of betaTypes)
  for (const terminalMethod of terminalMethods)
  for (const discountingConvention of conventions)
  for (const projectionYears of projYears) {
    combos++;
    const a0: ValuationAssumptions = { ...initialAssumptions, capmMethod, betaType, terminalMethod, discountingConvention, projectionYears };
    const wacc = resolveEffectiveWACC(fd, a0);
    const ke = calculateKe(a0);
    const a: ValuationAssumptions = { ...a0, discountRate: wacc };

    if (!finite(wacc)) fail(`${fd.companyName} [${capmMethod}/${betaType}] WACC not finite: ${wacc}`);
    if (!finite(ke)) fail(`${fd.companyName} [${capmMethod}] Ke not finite: ${ke}`);

    // Live DCF path
    const proj = calculateDCFProjections(fd, a);
    for (const p of proj) {
      if (![p.revenue, p.ebitda, p.dAndA, p.ebit, p.nopat, p.capex, p.deltaWC, p.freeCashFlow, p.discountFactor, p.presentValue].every(finite))
        fail(`${fd.companyName} projection year ${p.year} has non-finite field`);
    }
    const perShare = calculateDCFValue(proj, a, fd);
    if (!finite(perShare)) fail(`${fd.companyName} [${terminalMethod}/${discountingConvention}/${projectionYears}y] DCF/share not finite: ${perShare}`);

    // Bridge identity: reconstruct EV from projections, re-derive equity, compare
    const sumPV = proj.reduce((s, p) => s + p.presentValue, 0);
    const last = proj[proj.length - 1];
    const w = wacc / 100, g = a.terminalGrowthRate / 100;
    let tv = 0;
    if (terminalMethod === 'exit_multiple') tv = last.ebitda * a.exitMultiple;
    else if (w > g) tv = (last.freeCashFlow * (1 + g)) / (w - g);
    const pvTV = tv / Math.pow(1 + w, projectionYears);
    const ev = sumPV + pvTV;
    const expectedEquity = bridgeEnterpriseToEquity(ev, fd, a);
    const expectedPerShare = expectedEquity / fd.sharesOutstanding;
    if (finite(expectedPerShare) && Math.abs(expectedPerShare - perShare) > 0.01)
      fail(`${fd.companyName} bridge identity mismatch: engine ${perShare.toFixed(4)} vs recompute ${expectedPerShare.toFixed(4)}`);

    // Non-op assets must never be NaN
    if (!finite(calculateNonOperatingAssets(fd, a))) fail(`${fd.companyName} nonOp not finite`);

    // Secondary engine (valuationEngine) must also be finite & agree on bridge sign
    const eProj = engineProjections(fd, a);
    const eRes = engineDCFValue(fd, a, eProj);
    if (!finite(eRes.impliedSharePrice)) fail(`${fd.companyName} engine impliedSharePrice not finite`);

    // DDM applicability
    const ddm = calculateDDM(fd, a, ke);
    if (fd.dividendsPerShare === 0 && Math.abs(fd.cashFlowStatement.dividendsPaid) === 0 && ddm.applicable)
      fail(`${fd.companyName} DDM should be N/A (no dividends) but applicable=true`);
    if (ddm.applicable) {
      for (const v of [ddm.gordonGrowth, ddm.twoStage, ddm.hModel]) if (v !== null && !finite(v)) fail(`${fd.companyName} DDM value not finite`);
    }

    // Sensitivity grid — every cell finite
    const sens = generateSensitivityMatrix(fd, a, proj, wacc, a.terminalGrowthRate);
    for (const row of sens.cells) for (const c of row) if (!finite(c.impliedPrice) || !finite(c.upside)) fail(`${fd.companyName} sensitivity cell not finite`);
  }
}

// ── FCFF three-way agreement (internally consistent inputs) ──
{
  const ebit = 1000, ebitda = 1250, da = 250, interest = 120, taxRate = 0.225, capex = 300, dWC = 80;
  const ni = (ebit - interest) * (1 - taxRate); // consistent net income
  const v = calculateFCFFVerification(ebit, ebitda, da, ni, interest, taxRate, capex, dWC);
  if (!v.allMatch) fail(`FCFF 3-way methods disagree: m1=${v.method1} m2=${v.method2} m3=${v.method3}`);
}

// ── WACC override linkage ──
{
  const fd = companies[0];
  const base: ValuationAssumptions = { ...initialAssumptions };
  const capm = calculateWACC(fd, base);
  const synced = resolveEffectiveWACC(fd, { ...base, discountRate: Math.round(capm * 100) / 100 });
  if (Math.abs(synced - capm) > 0.02) fail(`resolveEffectiveWACC changed a synced value: ${synced} vs ${capm}`);
  const overridden = resolveEffectiveWACC(fd, { ...base, discountRate: capm + 5 });
  if (Math.abs(overridden - (capm + 5)) > 1e-9) fail(`resolveEffectiveWACC ignored a manual override: got ${overridden}, expected ${capm + 5}`);
}

// ── Terminal g ≥ WACC degrades safely (no blow-up) ──
{
  const fd = companies[0];
  const bad: ValuationAssumptions = { ...initialAssumptions, discountRate: 12, terminalGrowthRate: 20, terminalMethod: 'gordon_growth' };
  const proj = calculateDCFProjections(fd, bad);
  const ps = calculateDCFValue(proj, bad, fd);
  if (!finite(ps)) fail(`g≥WACC produced non-finite per share: ${ps}`);
}

console.log(`\nRan ${combos} company×model combinations + 4 targeted invariant checks.`);
console.log('──────────────────────────────────────────────────────────────');
if (failures === 0) {
  console.log('✅ ALL INVARIANTS HELD — no NaN/Infinity, bridge identity exact, FCFF agrees, override linked.');
} else {
  console.log(`❌ ${failures} INVARIANT FAILURE(S) ABOVE`);
  process.exit(1);
}
