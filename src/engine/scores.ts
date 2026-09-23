/**
 * Historical quality scores (METHODOLOGY section 13): Piotroski F-score, Altman Z''-EM,
 * DuPont (3-step and 5-step), credit metrics. Pure; N/A where data is insufficient.
 */
import type { BalanceSheet, CompanyData, FinancialYear } from '../domain/company';
import { latestYear, priorYear } from '../domain/company';

export function currentAssets(b: BalanceSheet): number {
  return b.inventory + b.receivables + b.amortizedCostCurrent + b.fvtplSecurities + b.otherCurrentAssets +
    b.dueFromRelatedParties + b.supplierAdvances + b.restrictedCashCurrent + b.cash;
}

export function currentLiabilities(b: BalanceSheet): number {
  return b.bankDebtCurrent + b.leaseCurrent + b.currentTaxPayable + b.tradePayables + b.otherPayables + b.customerAdvances +
    b.employeeBenefitsCurrent + b.provisions + b.dueToRelatedParties + b.otherCurrentLiabilities;
}

export function nonCurrentInterestBearing(b: BalanceSheet): number {
  return b.bankDebtNonCurrent + b.bondsNonCurrent + b.leaseNonCurrent;
}

// ------------------------------------------------------------------ Piotroski

export interface PiotroskiTest {
  id: number;
  name: string;
  current: number;
  prior: number | null;
  score: 0 | 1;
  rule: string;
}

export interface PiotroskiResult {
  available: boolean;
  reason?: string;
  tests: PiotroskiTest[];
  score: number | null;
  variant: string;
}

export function piotroski(c: CompanyData): PiotroskiResult {
  const y = latestYear(c);
  const p = priorYear(c);
  const variant = 'Piotroski (2000) nine tests; ratios on year-end total assets because the balance sheet before the first year is not available; bonus share issues are not dilution (shares restated).';
  if (!p) return { available: false, reason: 'Requires two fiscal years.', tests: [], score: null, variant };
  const roa = (x: FinancialYear) => x.income.netProfit / x.balance.totalAssets;
  const cfoTa = (x: FinancialYear) => x.cashFlow.netCashFromOperating / x.balance.totalAssets;
  const lev = (x: FinancialYear) => nonCurrentInterestBearing(x.balance) / x.balance.totalAssets;
  const cr = (x: FinancialYear) => currentAssets(x.balance) / currentLiabilities(x.balance);
  const gm = (x: FinancialYear) => x.income.grossProfit / x.income.revenue;
  const at = (x: FinancialYear) => x.income.revenue / x.balance.totalAssets;
  const b = (v: boolean): 0 | 1 => (v ? 1 : 0);
  const tests: PiotroskiTest[] = [
    { id: 1, name: 'Return on assets positive', current: roa(y), prior: null, score: b(roa(y) > 0), rule: 'Net profit / total assets > 0' },
    { id: 2, name: 'Operating cash flow positive', current: y.cashFlow.netCashFromOperating, prior: null, score: b(y.cashFlow.netCashFromOperating > 0), rule: 'Net cash from operating activities > 0' },
    { id: 3, name: 'Return on assets improved', current: roa(y), prior: roa(p), score: b(roa(y) > roa(p)), rule: 'ROA higher than prior year' },
    { id: 4, name: 'Cash flow exceeds profit (accruals)', current: cfoTa(y), prior: roa(y), score: b(cfoTa(y) > roa(y)), rule: 'Operating cash flow / total assets > ROA' },
    { id: 5, name: 'Long-term leverage lower', current: lev(y), prior: lev(p), score: b(lev(y) < lev(p)), rule: 'Non-current interest-bearing debt / total assets lower than prior year' },
    { id: 6, name: 'Current ratio higher', current: cr(y), prior: cr(p), score: b(cr(y) > cr(p)), rule: 'Current assets / current liabilities higher than prior year' },
    { id: 7, name: 'No equity issued', current: c.shares.basic, prior: c.shares.basic, score: 1, rule: 'Share count unchanged on a restated basis (bonus issues are not dilution)' },
    { id: 8, name: 'Gross margin higher', current: gm(y), prior: gm(p), score: b(gm(y) > gm(p)), rule: 'Gross profit / revenue higher than prior year' },
    { id: 9, name: 'Asset turnover higher', current: at(y), prior: at(p), score: b(at(y) > at(p)), rule: 'Revenue / total assets higher than prior year' },
  ];
  return { available: true, tests, score: tests.reduce((s, t) => s + t.score, 0), variant };
}

// ------------------------------------------------------------------ Altman Z''-EM

export interface ZScoreResult {
  fiscalYear: number;
  x1: number;
  x2: number;
  x3: number;
  x4: number;
  score: number;
  zone: 'Safe' | 'Grey' | 'Distress';
  variant: string;
}

export const ZEM = { constant: 3.25, c1: 6.56, c2: 3.26, c3: 6.72, c4: 1.05, safe: 5.85, distress: 4.35 } as const;

export function altmanZem(y: FinancialYear): ZScoreResult {
  const b = y.balance;
  const ta = b.totalAssets;
  const x1 = (currentAssets(b) - currentLiabilities(b)) / ta;
  const x2 = b.retainedEarnings / ta;
  const x3 = y.income.operatingProfit / ta;
  const x4 = b.totalEquity / b.totalLiabilities;
  const score = ZEM.constant + ZEM.c1 * x1 + ZEM.c2 * x2 + ZEM.c3 * x3 + ZEM.c4 * x4;
  const zone = score > ZEM.safe ? 'Safe' : score >= ZEM.distress ? 'Grey' : 'Distress';
  return { fiscalYear: y.fiscalYear, x1, x2, x3, x4, score, zone, variant: "Altman Z''-EM (Altman 2005, emerging markets), constant 3.25" };
}

// ------------------------------------------------------------------ DuPont

export interface DupontResult {
  fiscalYear: number;
  averageBalances: boolean;
  netMargin: number;
  assetTurnover: number;
  equityMultiplier: number;
  roe3: number;
  taxBurden: number;
  interestBurden: number;
  ebitMargin: number;
  roe5: number;
}

export function dupont(c: CompanyData): DupontResult {
  const y = latestYear(c);
  const p = priorYear(c);
  const i = y.income;
  const ta = p ? (p.balance.totalAssets + y.balance.totalAssets) / 2 : y.balance.totalAssets;
  const eq = p ? (p.balance.totalEquity + y.balance.totalEquity) / 2 : y.balance.totalEquity;
  const netMargin = i.netProfit / i.revenue;
  const assetTurnover = i.revenue / ta;
  const equityMultiplier = ta / eq;
  const taxBurden = i.netProfit / i.profitBeforeTax;
  const interestBurden = i.profitBeforeTax / i.operatingProfit;
  const ebitMargin = i.operatingProfit / i.revenue;
  return {
    fiscalYear: y.fiscalYear,
    averageBalances: !!p,
    netMargin,
    assetTurnover,
    equityMultiplier,
    roe3: netMargin * assetTurnover * equityMultiplier,
    taxBurden,
    interestBurden,
    ebitMargin,
    roe5: taxBurden * interestBurden * ebitMargin * assetTurnover * equityMultiplier,
  };
}

// ------------------------------------------------------------------ Credit metrics

export interface CreditMetrics {
  fiscalYear: number;
  interestBearingDebt: number;
  cashAndInvestments: number;
  netDebt: number;
  ebitda: number;
  netDebtToEbitda: number;
  debtInterest: number;
  interestCover: number;
  ffo: number;
  ffoToDebt: number;
  notes: string[];
}

export function creditMetrics(c: CompanyData): CreditMetrics {
  const y = latestYear(c);
  const b = y.balance;
  const i = y.income;
  const debt = b.bankDebtCurrent + b.bankDebtNonCurrent + b.bondsNonCurrent + b.leaseCurrent + b.leaseNonCurrent;
  const cash = b.cash + b.fvtplSecurities + b.amortizedCostCurrent + b.amortizedCostNonCurrent;
  const ebitda = i.operatingProfit + i.depreciation + i.amortization;
  const debtInterest = -(i.financeCostDebt + i.financeCostLease);
  const ffo = ebitda + i.financeIncome - debtInterest + i.currentTax;
  const notes: string[] = [];
  if (debt - cash < 0) notes.push('Net cash position: net debt / EBITDA is negative.');
  if (debtInterest === 0) notes.push('No debt or lease interest: interest cover is not meaningful.');
  return {
    fiscalYear: y.fiscalYear,
    interestBearingDebt: debt,
    cashAndInvestments: cash,
    netDebt: debt - cash,
    ebitda,
    netDebtToEbitda: (debt - cash) / ebitda,
    debtInterest,
    interestCover: debtInterest > 0 ? i.operatingProfit / debtInterest : Infinity,
    ffo,
    ffoToDebt: debt > 0 ? ffo / debt : Infinity,
    notes,
  };
}
