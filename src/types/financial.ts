export interface IncomeStatement {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingIncome: number;
  interestExpense: number;
  taxExpense: number;
  netIncome: number;
  depreciation: number;
  amortization: number;
}

export interface BalanceSheet {
  // Current Assets
  cash: number;
  marketableSecurities: number;
  accountsReceivable: number;
  inventory: number;
  otherCurrentAssets: number;
  totalCurrentAssets: number;
  // Non-Current Assets
  propertyPlantEquipment: number;
  longTermInvestments: number;
  goodwill: number;
  intangibleAssets: number;
  otherNonCurrentAssets: number;
  totalAssets: number;
  // Current Liabilities
  accountsPayable: number;
  shortTermDebt: number;
  otherCurrentLiabilities: number;
  totalCurrentLiabilities: number;
  // Non-Current Liabilities
  longTermDebt: number;
  otherNonCurrentLiabilities: number;
  totalLiabilities: number;
  // Equity
  totalEquity: number;
}

export interface CashFlowStatement {
  operatingCashFlow: number;
  capitalExpenditures: number;
  freeCashFlow: number;
  dividendsPaid: number;
  netChangeInCash: number;
}

export interface FinancialData {
  companyName: string;
  ticker: string;
  sharesOutstanding: number;
  currentStockPrice: number;
  /** Last reported fiscal year date (e.g., "2024-09-28") from the API */
  lastReportedDate?: string;
  /** Company sector from API profile (e.g., "Financial Services", "Technology") */
  sector?: string;
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  cashFlowStatement: CashFlowStatement;
}

export interface ValuationAssumptions {
  discountRate: number; // WACC
  terminalGrowthRate: number;
  projectionYears: number;
  revenueGrowthRate: number;
  marginImprovement: number;
  taxRate: number;
  riskFreeRate: number;
  marketRiskPremium: number;
  beta: number;
}

export interface ComparableCompany {
  name: string;
  ticker: string;
  peRatio: number;
  evEbitda: number;
  psRatio: number;
  pbRatio: number;
  marketCap: number;
  revenue: number;
}

export interface ValuationResult {
  method: string;
  value: number;
  perShare: number;
  upside: number;
}

export interface DCFProjection {
  year: number;
  revenue: number;
  ebitda: number;
  freeCashFlow: number;
  discountFactor: number;
  presentValue: number;
}

/** Market region type for USA/Egypt market selection */
export type MarketRegion = 'USA' | 'Egypt';

/** History state type for undo/redo */
export interface HistoryState {
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  comparables: ComparableCompany[];
}

/** Theme CSS classes passed to components */
export interface ThemeClasses {
  bgClass: string;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  inputClass: string;
}
