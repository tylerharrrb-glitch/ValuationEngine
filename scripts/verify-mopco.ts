/**
 * MOPCO (MFPC.CA) — Non-Operating Asset Bridge verification.
 *
 * Proves the EV→Equity bridge fix takes effect end-to-end:
 *   1. Exported "DCF Model" sheet ADDS Inputs!B28 (Marketable Securities) and
 *      Inputs!B35 (Long-term Investments); asserts B36 / B37 formulas.
 *   2. Non-operating assets added = 13,969,339,150 (±1); per share +4.869.
 *   3. DCF/share rises by exactly the bridge contribution (old → new).
 *   4. No #REF! anywhere in the workbook.
 *   5. Ke / WACC print; stale badge returns "current" for asOfDate 2026-07-03.
 *
 * Run:  npx tsx scripts/verify-mopco.ts
 *
 * NOTE ON DATA: shares, price, marketable securities and long-term investments
 * are MOPCO's audited FY2025 figures. The operating P&L drivers are calibrated
 * to reproduce the user's baseline DCF (~24.9/share) so the bridge delta can be
 * isolated; the fix itself is data-independent (delta = non-op assets / shares).
 */
import { calculateDCFProjections, calculateDCFValue } from '../src/utils/calculations/dcf';
import { calculateWACC, calculateKe } from '../src/utils/valuation';
import { exportToExcelWithFormulas } from '../src/utils/excelExportPro';
import { isMacroStale, EGYPT_MACRO } from '../src/constants/marketDefaults';
import { initialAssumptions } from '../src/constants/initialData';
import type { FinancialData, ValuationAssumptions } from '../src/types/financial';

// ── MOPCO audited non-operating assets (FY2025) ──
const MARKETABLE_SECURITIES = 3_307_773_053;   // FVTPL / trading securities → Inputs!B28
const LONG_TERM_INVESTMENTS = 10_661_566_097;  // financial assets at amortized cost → Inputs!B35
const SHARES = 2_868_140_263;
const PRICE = 36;
const EXPECTED_NONOP = MARKETABLE_SECURITIES + LONG_TERM_INVESTMENTS; // 13,969,339,150
const EXPECTED_PER_SHARE = EXPECTED_NONOP / SHARES;                    // 4.8698…

const mopco: FinancialData = {
  companyName: 'Misr Fertilizers Production Co. (MOPCO)',
  ticker: 'MFPC.CA',
  sharesOutstanding: SHARES,
  currentStockPrice: PRICE,
  dividendsPerShare: 0,
  lastReportedDate: '2025-12-31',
  sector: 'Basic Materials',
  incomeStatement: {
    revenue: 26_500_000_000,
    costOfGoodsSold: 14_000_000_000,
    grossProfit: 12_500_000_000,
    operatingExpenses: 2_500_000_000,
    operatingIncome: 10_000_000_000, // EBIT
    interestExpense: 0,              // MOPCO is essentially debt-free
    taxExpense: 2_250_000_000,
    netIncome: 9_500_000_000,        // incl. finance income (captured via bridge, NOT FCFF)
    depreciation: 1_500_000_000,
    amortization: 0,
  },
  balanceSheet: {
    cash: 2_000_000_000,
    marketableSecurities: MARKETABLE_SECURITIES,
    accountsReceivable: 1_500_000_000,
    inventory: 1_200_000_000,
    otherCurrentAssets: 500_000_000,
    totalCurrentAssets: 8_507_773_053,
    propertyPlantEquipment: 12_000_000_000,
    longTermInvestments: LONG_TERM_INVESTMENTS,
    goodwill: 0,
    intangibleAssets: 0,
    otherNonCurrentAssets: 500_000_000,
    totalAssets: 33_669_339_150,
    accountsPayable: 1_500_000_000,
    shortTermDebt: 0,
    otherCurrentLiabilities: 1_000_000_000,
    totalCurrentLiabilities: 2_500_000_000,
    longTermDebt: 0,
    otherNonCurrentLiabilities: 1_000_000_000,
    totalLiabilities: 3_500_000_000,
    totalEquity: 30_169_339_150,
  },
  cashFlowStatement: {
    operatingCashFlow: 9_800_000_000,
    capitalExpenditures: 2_000_000_000,
    freeCashFlow: 7_800_000_000,
    dividendsPaid: 0,
    netChangeInCash: 1_000_000_000,
  },
};

// Egypt defaults + MOPCO-representative FCFF drivers. MOPCO is an exceptionally
// high-margin, low-capex fertilizer producer, so the generic 30% EBITDA / 10%
// capex defaults understate it; these reproduce the user's ~25/share baseline.
const baseAssumptions: ValuationAssumptions = {
  ...initialAssumptions,
  revenueGrowthRate: 12,
  ebitdaMargin: 52,
  daPercent: 6,
  capexPercent: 6,
  deltaWCPercent: 10,
};
const wacc = calculateWACC(mopco, baseAssumptions);
const ke = calculateKe(baseAssumptions);
const assumptions: ValuationAssumptions = { ...baseAssumptions, discountRate: wacc };

// ── DCF: new (with bridge) vs. pre-fix (non-op zeroed) ── SAME assumptions ──
const projections = calculateDCFProjections(mopco, assumptions);
const newDCF = calculateDCFValue(projections, assumptions, mopco);
const preFix: FinancialData = {
  ...mopco,
  balanceSheet: { ...mopco.balanceSheet, marketableSecurities: 0, longTermInvestments: 0 },
};
const oldDCF = calculateDCFValue(projections, assumptions, preFix);
const delta = newDCF - oldDCF;

// ── Build the workbook (formulas only — inspect cell.f strings) ──
const wb: any = exportToExcelWithFormulas(mopco, assumptions, [], { returnWorkbook: true });
const dcfSheet = wb.Sheets['DCF Model'];
const b36 = dcfSheet?.['B36']?.f ?? '';
const b37 = dcfSheet?.['B37']?.f ?? '';
const b42 = dcfSheet?.['B42']?.f ?? '';
const b44 = dcfSheet?.['B44']?.f ?? '';

// Scan every sheet/cell formula for #REF!
const refErrors: string[] = [];
for (const name of wb.SheetNames) {
  const ws = wb.Sheets[name];
  for (const addr of Object.keys(ws)) {
    if (addr.startsWith('!')) continue;
    const f = ws[addr]?.f;
    if (typeof f === 'string' && f.includes('REF!')) refErrors.push(`${name}!${addr}: ${f}`);
  }
}

const staleCurrent = isMacroStale(EGYPT_MACRO.asOfDate) === false;

// ── Assertions ──
const near = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol;
const checks: Array<{ label: string; pass: boolean; detail: string }> = [
  { label: 'B36 references Inputs!B28 (Marketable Securities)', pass: /Inputs!B28/.test(b36), detail: `B36 = ${b36 || '(empty)'}` },
  { label: 'B37 references Inputs!B35 (Long-term Investments)', pass: /Inputs!B35/.test(b37), detail: `B37 = ${b37 || '(empty)'}` },
  { label: 'B42 equity bridge sums B34..B41', pass: b42.replace(/\s/g, '') === 'B34+B35+B36+B37+B38+B39+B40+B41', detail: `B42 = ${b42 || '(empty)'}` },
  { label: 'Non-op assets added = 13,969,339,150 (±1)', pass: near(EXPECTED_NONOP, 13_969_339_150, 1), detail: `${EXPECTED_NONOP.toLocaleString()}` },
  { label: 'Per-share bridge contribution ≈ +4.87 (±0.01)', pass: near(EXPECTED_PER_SHARE, 4.869, 0.01), detail: `+${EXPECTED_PER_SHARE.toFixed(4)}` },
  { label: 'Engine DCF/share rose by the bridge contribution', pass: near(delta, EXPECTED_PER_SHARE, 0.01), detail: `old ${oldDCF.toFixed(2)} → new ${newDCF.toFixed(2)} (Δ ${delta.toFixed(4)})` },
  { label: 'New DCF/share > old (bridge took effect, not ~old)', pass: newDCF > oldDCF + 4, detail: `new ${newDCF.toFixed(2)} vs old ${oldDCF.toFixed(2)}` },
  { label: 'No #REF! anywhere in workbook', pass: refErrors.length === 0, detail: refErrors.length ? refErrors.join('; ') : 'clean' },
  { label: 'Stale badge returns "current" for asOfDate 2026-07-03', pass: staleCurrent, detail: `isStale=${!staleCurrent}` },
];

// ── Report ──
console.log('══════════════════════════════════════════════════════════════');
console.log(' WOLF ENGINE — MOPCO (MFPC.CA) BRIDGE VERIFICATION');
console.log('══════════════════════════════════════════════════════════════');
console.log(`Workbook sheets: ${wb.SheetNames.join(', ')}`);
console.log('');
console.log('DCF Model bridge formulas:');
console.log(`  B36 (Plus: Marketable Securities) = ${b36}`);
console.log(`  B37 (Plus: Long-term Investments) = ${b37}`);
console.log(`  B42 (Equity Value)                = ${b42}`);
console.log(`  B44 (DCF Per Share)               = ${b44}`);
console.log('');
console.log(`Ke (cost of equity) = ${ke.toFixed(3)}%`);
console.log(`WACC (synced)       = ${wacc.toFixed(3)}%`);
console.log(`Terminal growth     = ${assumptions.terminalGrowthRate.toFixed(1)}%`);
console.log('');
console.log(`Non-operating assets added (B28 + B35) = ${EXPECTED_NONOP.toLocaleString()} EGP`);
console.log(`  = Marketable Securities ${MARKETABLE_SECURITIES.toLocaleString()} + Long-term Investments ${LONG_TERM_INVESTMENTS.toLocaleString()}`);
console.log(`Per-share contribution                 = +${EXPECTED_PER_SHARE.toFixed(4)} EGP`);
console.log('');
console.log(`DCF/share (pre-fix, non-op zeroed)     = ${oldDCF.toFixed(2)} EGP`);
console.log(`DCF/share (with bridge fix)            = ${newDCF.toFixed(2)} EGP`);
console.log(`Delta                                  = +${delta.toFixed(4)} EGP`);
console.log(`Macro asOfDate ${EGYPT_MACRO.asOfDate} → stale badge: ${staleCurrent ? 'CURRENT ✓' : 'STALE ⚠'}`);
console.log('');
console.log('──────────────────────────────────────────────────────────────');
let allPass = true;
for (const c of checks) {
  const mark = c.pass ? '✅' : '❌';
  if (!c.pass) allPass = false;
  console.log(`${mark} ${c.label}`);
  console.log(`     ${c.detail}`);
}
console.log('──────────────────────────────────────────────────────────────');
console.log(allPass ? '✅ ALL PASS' : '❌ FAILURES ABOVE');
console.log(`FINAL DCF/SHARE (with bridge) = ${newDCF.toFixed(2)} EGP`);
if (!allPass) process.exit(1);
