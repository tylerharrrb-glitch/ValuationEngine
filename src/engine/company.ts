/**
 * Company-data integrity checks and derived facts. Pure.
 * Every check compares exact integers (tolerance 0.5 EGP) because fixtures
 * reproduce audited statements to the pound.
 */
import type { BalanceSheet, CashFlowStatement, CompanyData, FinancialYear, IncomeStatement } from '../domain/company';
import { dilutedShares, latestYear, priorYear } from '../domain/company';

export interface TieCheck {
  id: string;
  label: string;
  expected: number;
  computed: number;
  pass: boolean;
}

const TOL = 0.5;
/**
 * Component sums of a balance-sheet section may differ from the printed total by 1 EGP
 * because the statements round each line. The difference is reported, never hidden.
 */
export const COMPONENT_SUM_TOLERANCE = 1;
const tie = (id: string, label: string, expected: number, computed: number, tol = TOL): TieCheck => ({
  id, label, expected, computed, pass: Math.abs(expected - computed) <= tol,
});

export function sumAssets(b: BalanceSheet): number {
  return b.ppe + b.intangibleAndOtherAssets + b.rightOfUseAssets + b.goodwill + b.associates + b.amortizedCostNonCurrent +
    b.restrictedCashNonCurrent + b.deferredTaxAsset + b.otherNonCurrentAssets + b.inventory + b.receivables +
    b.amortizedCostCurrent + b.fvtplSecurities + b.otherCurrentAssets + b.dueFromRelatedParties + b.supplierAdvances +
    b.restrictedCashCurrent + b.cash;
}

export function sumEquity(b: BalanceSheet): number {
  return b.shareCapital + b.legalReserve + b.otherReserves + b.retainedEarnings + b.otherEquity + b.minorityInterest + b.preferredEquity;
}

export function sumLiabilities(b: BalanceSheet): number {
  return b.bankDebtNonCurrent + b.bondsNonCurrent + b.leaseNonCurrent + b.deferredTaxLiability + b.employeeBenefitsNonCurrent +
    b.otherNonCurrentLiabilities + b.bankDebtCurrent + b.leaseCurrent + b.currentTaxPayable + b.tradePayables + b.otherPayables +
    b.customerAdvances + b.employeeBenefitsCurrent + b.provisions + b.dueToRelatedParties + b.otherCurrentLiabilities;
}

export function recomputeGrossProfit(i: IncomeStatement): number {
  return i.revenue + i.costOfSales;
}

/** Operating profit from its components. `provisionsReleased` is a memo inside otherIncome, not added again. */
export function recomputeOperatingProfit(i: IncomeStatement): number {
  return i.grossProfit + i.otherIncome + i.sellingMarketing + i.generalAdmin + i.capitalGains + i.otherExpenses +
    i.impairmentReversal + i.eclReversal + i.otherOperating;
}

export function totalFinanceCosts(i: IncomeStatement): number {
  return i.financeCostDebt + i.financeCostLease + i.financeCostEmployeeBenefit + i.financeCostOther;
}

export function recomputeProfitBeforeTax(i: IncomeStatement): number {
  return i.operatingProfit + i.financeIncome + totalFinanceCosts(i) + i.fxGainLoss + i.shareOfAssociates + i.otherNonOperating;
}

export function recomputeNetProfit(i: IncomeStatement): number {
  return i.profitBeforeTax + i.totalTax;
}

export function recomputeOperatingCashFlow(c: CashFlowStatement): number {
  return c.cashGeneratedFromOperations + c.employeeBoardDistributions + c.taxesPaid + c.employeeBenefitsPaid + c.otherOperatingCashFlows;
}

export function yearChecks(y: FinancialYear): TieCheck[] {
  const { income: i, balance: b, cashFlow: c } = y;
  const fy = y.fiscalYear;
  return [
    tie(`${fy}.assets`, `${fy} total assets = sum of asset lines (±1 EGP line rounding)`, b.totalAssets, sumAssets(b), COMPONENT_SUM_TOLERANCE),
    tie(`${fy}.equity`, `${fy} total equity = sum of equity lines (±1 EGP line rounding)`, b.totalEquity, sumEquity(b), COMPONENT_SUM_TOLERANCE),
    tie(`${fy}.liabilities`, `${fy} total liabilities = sum of liability lines (±1 EGP line rounding)`, b.totalLiabilities, sumLiabilities(b), COMPONENT_SUM_TOLERANCE),
    tie(`${fy}.balance`, `${fy} balance sheet balances (assets = equity + liabilities)`, b.totalAssets, b.totalEquity + b.totalLiabilities),
    tie(`${fy}.gp`, `${fy} gross profit = revenue + cost of sales`, i.grossProfit, recomputeGrossProfit(i)),
    tie(`${fy}.op`, `${fy} operating profit recomputes from components`, i.operatingProfit, recomputeOperatingProfit(i)),
    tie(`${fy}.pbt`, `${fy} profit before tax recomputes`, i.profitBeforeTax, recomputeProfitBeforeTax(i)),
    tie(`${fy}.tax`, `${fy} total tax = current + deferred`, i.totalTax, i.currentTax + i.deferredTax),
    tie(`${fy}.np`, `${fy} net profit recomputes`, i.netProfit, recomputeNetProfit(i)),
    tie(`${fy}.cfo`, `${fy} net cash from operating activities recomputes`, c.netCashFromOperating, recomputeOperatingCashFlow(c)),
  ];
}

export function companyChecks(c: CompanyData): TieCheck[] {
  return c.years.flatMap(yearChecks);
}

export interface CompanyValidationIssue {
  field: string;
  text: string;
}

/** Mandatory fields (spec 4.1 and Part 9). */
export function validateCompany(c: CompanyData): CompanyValidationIssue[] {
  const out: CompanyValidationIssue[] = [];
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!iso.test(c.valuationDate ?? '')) out.push({ field: 'valuationDate', text: 'Valuation date is required.' });
  if (!iso.test(c.priceDate ?? '')) out.push({ field: 'priceDate', text: 'Price date is required.' });
  if (!(c.price > 0)) out.push({ field: 'price', text: 'Price must be positive.' });
  if (!(c.shares.basic > 0)) out.push({ field: 'shares', text: 'Basic shares must be positive.' });
  if (c.years.length === 0) out.push({ field: 'years', text: 'At least one financial year is required.' });
  if (c.years.length > 5) out.push({ field: 'years', text: 'At most five historical years are supported.' });
  for (let k = 1; k < c.years.length; k++) {
    if (c.years[k].fiscalYear <= c.years[k - 1].fiscalYear) out.push({ field: 'years', text: 'Years must be in ascending order.' });
  }
  return out;
}

/** Derived facts used across the engine, UI, PDF and Excel. */
export interface CompanyFacts {
  marketCap: number;
  dilutedShares: number;
  shareholderDps: number;
  distributionsToPriorYearProfit: number | null;
  unrestrictedCashAndInvestments: number;
  restrictedCash: number;
  interestBearingDebt: number;
  leaseLiabilities: number;
  bankDebtAndBonds: number;
  reportedEbitda: number;
  exportShare: number | null;
  effectiveTaxRate: number;
}

export function companyFacts(c: CompanyData): CompanyFacts {
  const y = latestYear(c);
  const p = priorYear(c);
  const b = y.balance;
  const i = y.income;
  const leases = b.leaseCurrent + b.leaseNonCurrent;
  const bank = b.bankDebtCurrent + b.bankDebtNonCurrent + b.bondsNonCurrent;
  return {
    marketCap: c.price * c.shares.basic,
    dilutedShares: dilutedShares(c),
    shareholderDps: -y.cashFlow.dividendsToShareholders / c.shares.basic,
    distributionsToPriorYearProfit: p && p.income.netProfit !== 0 ? -y.cashFlow.employeeBoardDistributions / p.income.netProfit : null,
    unrestrictedCashAndInvestments: b.cash + b.fvtplSecurities + b.amortizedCostCurrent + b.amortizedCostNonCurrent,
    restrictedCash: b.restrictedCashCurrent + b.restrictedCashNonCurrent,
    interestBearingDebt: bank + leases,
    leaseLiabilities: leases,
    bankDebtAndBonds: bank,
    reportedEbitda: i.operatingProfit + i.depreciation + i.amortization,
    exportShare: i.exportRevenue == null || i.revenue === 0 ? null : i.exportRevenue / i.revenue,
    effectiveTaxRate: i.profitBeforeTax === 0 ? 0 : -i.totalTax / i.profitBeforeTax,
  };
}
