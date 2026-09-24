/** Statement line lists with display labels (company-data form, Excel Inputs sheet). */
import type { BalanceSheet, CashFlowStatement, IncomeStatement } from './company';
import type { YearDrivers } from './assumptions';

export type DriverFmt = 'pct' | 'amount' | 'days';

export type Line<T> = [keyof T & string, string];

export const IS_LINES: Line<IncomeStatement>[] = [
  ['revenue', 'Net sales'], ['exportRevenue', '  of which export sales'], ['costOfSales', 'Cost of sales'], ['grossProfit', 'Gross profit'],
  ['otherIncome', 'Other income'], ['provisionsReleased', '  of which provisions no longer required'], ['sellingMarketing', 'Selling and marketing'],
  ['generalAdmin', 'General and administrative'], ['capitalGains', 'Capital gains'], ['otherExpenses', 'Other expenses'],
  ['impairmentReversal', 'Impairment reversal'], ['eclReversal', 'ECL reversal / (charge)'], ['otherOperating', 'Other operating items'],
  ['operatingProfit', 'Operating profit'], ['financeIncome', 'Finance income'], ['financeCostDebt', 'Finance cost: bank debt and bonds'],
  ['financeCostLease', 'Finance cost: lease interest'], ['financeCostEmployeeBenefit', 'Finance cost: employee benefit interest'],
  ['financeCostOther', 'Finance cost: other'], ['fxGainLoss', 'FX translation gain / (loss)'], ['shareOfAssociates', 'Share of associates'],
  ['otherNonOperating', 'Other non-operating items'], ['profitBeforeTax', 'Profit before tax'], ['currentTax', 'Current tax'],
  ['deferredTax', 'Deferred tax'], ['totalTax', 'Total tax'], ['netProfit', 'Net profit'], ['minorityShareOfProfit', 'Profit attributable to minority interest'],
  ['depreciation', 'Depreciation (notes)'], ['amortization', 'Amortization (notes)'], ['epsReported', 'EPS as reported'],
];

export const BS_LINES: Line<BalanceSheet>[] = [
  ['ppe', 'Fixed assets and projects under construction'], ['intangibleAndOtherAssets', 'Other assets and projects'], ['rightOfUseAssets', 'Right-of-use assets'],
  ['goodwill', 'Goodwill'], ['associates', 'Associates (equity method)'], ['amortizedCostNonCurrent', 'Amortized-cost investments (non-current)'],
  ['restrictedCashNonCurrent', 'Restricted / pledged deposits (non-current)'], ['deferredTaxAsset', 'Deferred tax asset'], ['otherNonCurrentAssets', 'Other non-current assets'],
  ['inventory', 'Inventory'], ['receivables', 'Accounts receivable'], ['amortizedCostCurrent', 'Amortized-cost investments (current)'],
  ['fvtplSecurities', 'FVTPL financial assets'], ['otherCurrentAssets', 'Debtors and other debit balances'], ['dueFromRelatedParties', 'Due from related parties'],
  ['supplierAdvances', 'Supplier advance payments'], ['restrictedCashCurrent', 'Restricted cash (current)'], ['cash', 'Cash at banks and on hand'],
  ['totalAssets', 'Total assets'],
  ['shareCapital', 'Issued capital'], ['legalReserve', 'Legal reserve'], ['otherReserves', 'Other reserves'], ['retainedEarnings', 'Retained earnings'],
  ['otherEquity', 'Other equity items'], ['minorityInterest', 'Minority interest'], ['preferredEquity', 'Preferred equity'], ['totalEquity', 'Total equity'],
  ['bankDebtNonCurrent', 'Bank debt (non-current)'], ['bondsNonCurrent', 'Bonds (non-current)'], ['leaseNonCurrent', 'Lease liabilities (non-current)'],
  ['deferredTaxLiability', 'Deferred tax liabilities'], ['employeeBenefitsNonCurrent', 'Employee benefits (non-current)'], ['otherNonCurrentLiabilities', 'Other non-current liabilities'],
  ['bankDebtCurrent', 'Bank debt (current)'], ['leaseCurrent', 'Lease liabilities (current)'], ['currentTaxPayable', 'Current income tax'],
  ['tradePayables', 'Trade payables'], ['otherPayables', 'Creditors and other credit balances'], ['customerAdvances', 'Customer advances'],
  ['employeeBenefitsCurrent', 'Employee benefits (current)'], ['provisions', 'Provisions'], ['dueToRelatedParties', 'Due to related parties'],
  ['otherCurrentLiabilities', 'Other current liabilities'], ['totalLiabilities', 'Total liabilities'],
];

export const CF_LINES: Line<CashFlowStatement>[] = [
  ['cashGeneratedFromOperations', 'Cash from operations before distributions and taxes'], ['employeeBoardDistributions', 'Dividends paid to employees and board'],
  ['taxesPaid', 'Income taxes paid'], ['employeeBenefitsPaid', 'Employee benefits paid'], ['otherOperatingCashFlows', 'Other operating cash flows'],
  ['netCashFromOperating', 'Net cash from operating activities'], ['interestReceived', 'Interest received'], ['capex', 'Capex'],
  ['dividendsToShareholders', 'Dividends paid to shareholders'], ['leasePayments', 'Lease payments'], ['netChangeInCash', 'Net change in cash'],
];

/** Lines that are totals or subtotals (recomputed checks). */
export const TOTAL_FIELDS = new Set(['grossProfit', 'operatingProfit', 'profitBeforeTax', 'totalTax', 'netProfit', 'totalAssets', 'totalEquity', 'totalLiabilities', 'netCashFromOperating']);

export type DriverSpec = [keyof YearDrivers, string, string, DriverFmt, boolean];
/** [field, label, unit, format, stored in percent units] */
export const DRIVERS: DriverSpec[] = [
  ['revenueGrowth', 'Revenue growth', '%', 'pct', true],
  ['grossMarginExDA', 'Gross margin before D&A', '%', 'pct', true],
  ['sgaPctRevenue', 'SG&A', '% revenue', 'pct', true],
  ['otherOpPctRevenue', 'Other operating (net)', '% revenue', 'pct', true],
  ['daPctRevenue', 'D&A (% revenue mode)', '% revenue', 'pct', true],
  ['depreciationRate', 'Depreciation rate on opening PP&E', '%', 'pct', true],
  ['amortizationPctRevenue', 'Amortization', '% revenue', 'pct', true],
  ['capexPctRevenue', 'Capex', '% revenue', 'pct', true],
  ['capexAbsolute', 'Capex (absolute mode)', 'EGP', 'amount', false],
  ['dso', 'Receivable days (on revenue)', 'days', 'days', false],
  ['dio', 'Inventory days (on cash cost of sales)', 'days', 'days', false],
  ['dpo', 'Payable days (on cash cost of sales)', 'days', 'days', false],
  ['otherCurrentAssetsPctRevenue', 'Other operating current assets', '% revenue', 'pct', true],
  ['otherCurrentLiabilitiesPctRevenue', 'Other operating current liabilities', '% revenue', 'pct', true],
  ['taxRate', 'Tax rate on EBIT', '%', 'pct', true],
];

