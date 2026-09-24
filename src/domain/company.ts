/**
 * Company data model (one source of truth for reported financial statements).
 *
 * Sign convention: every statement line is stored with the sign it carries in
 * the audited statements. Costs, expenses, charges, taxes and cash outflows are
 * NEGATIVE; income, gains, reversals and cash inflows are POSITIVE. Depreciation
 * and amortization (taken from the notes) are POSITIVE magnitudes.
 * Balance-sheet amounts are positive carrying values.
 */

export type ISODate = string; // YYYY-MM-DD

export interface IncomeStatement {
  revenue: number;
  /** "Of which export sales" memo line. null when not disclosed. */
  exportRevenue: number | null;
  costOfSales: number;
  grossProfit: number;
  otherIncome: number;
  /** "Of which provisions no longer required" memo inside other income. */
  provisionsReleased: number;
  sellingMarketing: number;
  generalAdmin: number;
  capitalGains: number;
  otherExpenses: number;
  impairmentReversal: number;
  /** Expected credit loss reversal (+) or charge (−). */
  eclReversal: number;
  /** Any other operating line not listed above. */
  otherOperating: number;
  operatingProfit: number;
  financeIncome: number;
  /** Interest on bank borrowings and bonds. */
  financeCostDebt: number;
  /** Interest on lease liabilities (EAS 49). */
  financeCostLease: number;
  /** Interest cost on employee benefit obligations. */
  financeCostEmployeeBenefit: number;
  financeCostOther: number;
  /** Foreign-exchange translation gain (+) or loss (−). */
  fxGainLoss: number;
  shareOfAssociates: number;
  otherNonOperating: number;
  profitBeforeTax: number;
  currentTax: number;
  deferredTax: number;
  totalTax: number;
  netProfit: number;
  /** Profit attributable to non-controlling interests (0 if none). */
  minorityShareOfProfit: number;
  depreciation: number;
  amortization: number;
  /** EPS as printed in the statements. */
  epsReported: number | null;
}

export interface BalanceSheet {
  // Non-current assets
  ppe: number;
  intangibleAndOtherAssets: number;
  rightOfUseAssets: number;
  goodwill: number;
  associates: number;
  amortizedCostNonCurrent: number;
  /** Pledged / restricted deposits. Excluded from the equity bridge. */
  restrictedCashNonCurrent: number;
  deferredTaxAsset: number;
  otherNonCurrentAssets: number;
  // Current assets
  inventory: number;
  receivables: number;
  amortizedCostCurrent: number;
  fvtplSecurities: number;
  otherCurrentAssets: number;
  dueFromRelatedParties: number;
  supplierAdvances: number;
  restrictedCashCurrent: number;
  cash: number;
  totalAssets: number;
  // Equity
  shareCapital: number;
  legalReserve: number;
  otherReserves: number;
  retainedEarnings: number;
  otherEquity: number;
  minorityInterest: number;
  preferredEquity: number;
  totalEquity: number;
  // Non-current liabilities
  bankDebtNonCurrent: number;
  bondsNonCurrent: number;
  leaseNonCurrent: number;
  deferredTaxLiability: number;
  employeeBenefitsNonCurrent: number;
  otherNonCurrentLiabilities: number;
  // Current liabilities
  bankDebtCurrent: number;
  leaseCurrent: number;
  currentTaxPayable: number;
  tradePayables: number;
  otherPayables: number;
  customerAdvances: number;
  employeeBenefitsCurrent: number;
  provisions: number;
  dueToRelatedParties: number;
  otherCurrentLiabilities: number;
  totalLiabilities: number;
}

export interface CashFlowStatement {
  /** Cash generated from operations before distributions, taxes and benefits paid. */
  cashGeneratedFromOperations: number;
  /** Profit distributions to employees and board (EAS: through equity). */
  employeeBoardDistributions: number;
  taxesPaid: number;
  employeeBenefitsPaid: number;
  otherOperatingCashFlows: number;
  netCashFromOperating: number;
  interestReceived: number;
  capex: number;
  /** Dividends paid to shareholders only. */
  dividendsToShareholders: number;
  leasePayments: number;
  netChangeInCash: number;
}

export interface FinancialYear {
  fiscalYear: number;
  periodEnd: ISODate;
  audited: boolean;
  income: IncomeStatement;
  balance: BalanceSheet;
  cashFlow: CashFlowStatement;
}

export interface DilutiveItem {
  label: string;
  shares: number;
}

export interface SegmentData {
  name: string;
  revenue: number | null;
  ebitda: number | null;
  source: string;
}

export interface SourcedFact {
  label: string;
  text: string;
  source: string;
}

export interface CompanyData {
  schemaVersion: 1;
  name: string;
  shortName: string;
  ticker: string;
  exchange: string;
  /** ISO 3166 alpha-2. Drives Egypt-specific defaults when 'EG'. */
  country: string;
  currency: string;
  /** Fiscal year end as MM-DD. */
  fiscalYearEnd: string;
  /** Mandatory. */
  valuationDate: ISODate;
  /** Mandatory. User input; EGX has no free official price feed. */
  price: number;
  /** Mandatory. */
  priceDate: ISODate;
  priceSource: string;
  shares: {
    basic: number;
    dilutiveItems: DilutiveItem[];
    note: string;
  };
  /** Ascending by fiscal year; at most five years. Missing years are absent, never filled. */
  years: FinancialYear[];
  segments: SegmentData[];
  facts: SourcedFact[];
  /** Default Damodaran emerging-markets industry for the bottom-up beta (user-editable). */
  damodaranIndustry?: string;
  statementsSource: {
    description: string;
    auditor: string;
    reportDate: ISODate;
  };
}

export const MAX_HISTORICAL_YEARS = 5;

export function dilutedShares(c: CompanyData): number {
  return c.shares.basic + c.shares.dilutiveItems.reduce((s, d) => s + d.shares, 0);
}

export function latestYear(c: CompanyData): FinancialYear {
  if (c.years.length === 0) throw new Error('CompanyData has no financial years');
  return c.years[c.years.length - 1];
}

export function priorYear(c: CompanyData): FinancialYear | null {
  return c.years.length >= 2 ? c.years[c.years.length - 2] : null;
}
