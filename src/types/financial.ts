// ============================================
// WOLF VALUATION ENGINE — Type Definitions
// CFA-grade financial modeling types for Egyptian market
// ============================================

export interface IncomeStatement {
  revenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingIncome: number; // EBIT
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
  /** Company sector from API profile */
  sector?: string;
  /** Dividends per share (for DDM models) */
  dividendsPerShare: number;
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  cashFlowStatement: CashFlowStatement;
}

// ============================================
// CAPM METHOD & TAX CATEGORIES
// ============================================

/** Method A = Local Currency CAPM (default for EGP), Method B = USD Build-Up */
export type CAPMMethod = 'A' | 'B';

/** Egyptian tax categories per Section 3.4 */
export type EgyptTaxCategory = 'standard' | 'oil_gas' | 'suez_canal' | 'free_zone' | 'custom';

/** Beta calculation method */
export type BetaType = 'raw' | 'adjusted' | 'relevered';

/** Discounting convention */
export type DiscountingConvention = 'end_of_year' | 'mid_year';

/** Terminal value method */
export type TerminalValueMethod = 'gordon_growth' | 'exit_multiple';

// ============================================
// VALUATION ASSUMPTIONS (Extended)
// ============================================

export interface ValuationAssumptions {
  // Core DCF parameters
  discountRate: number;         // WACC (calculated, not hard-coded)
  terminalGrowthRate: number;   // Terminal growth rate (%)
  projectionYears: number;      // 3, 5, 7, or 10
  revenueGrowthRate: number;    // Revenue growth rate (%)
  marginImprovement: number;    // Legacy field — retained for compatibility
  taxRate: number;              // Corporate tax rate (%)

  // CAPM parameters
  riskFreeRate: number;         // Risk-free rate (%)
  marketRiskPremium: number;    // Equity risk premium (%)
  beta: number;                 // Company beta (vs EGX 30 or S&P 500)
  capmMethod: CAPMMethod;       // Method A (Local) or B (USD Build-Up)
  betaType: BetaType;           // Raw, Adjusted, or Relevered
  taxCategory: EgyptTaxCategory;

  // Method B (USD Build-Up) specific fields
  rfUS: number;                 // US 10Y Treasury yield (%)
  countryRiskPremium: number;   // CRP for Egypt (%)
  egyptInflation: number;       // Egypt CPI inflation (%)
  usInflation: number;          // US CPI inflation (%)

  // Cost of Debt
  costOfDebt: number;           // Pre-tax cost of debt (%)

  // Risk-free rate metadata
  rfDate: string;               // Date stamp of the Rf rate

  // Projection drivers (FCFF-based)
  ebitdaMargin: number;         // EBITDA / Revenue (%)
  daPercent: number;            // D&A / Revenue (%)
  capexPercent: number;         // CapEx / Revenue (%)
  deltaWCPercent: number;       // ΔWC / ΔRevenue (%)
  useConstantDrivers: boolean;  // true = constant, false = year-by-year

  // Terminal Value
  terminalMethod: TerminalValueMethod;
  exitMultiple: number;         // Exit EV/EBITDA multiple (for exit multiple method)

  // Discounting
  discountingConvention: DiscountingConvention;

  // DDM parameters
  dps: number;                  // Dividends per share
  ddmHighGrowth: number;        // High-growth phase dividend growth rate (%)
  ddmStableGrowth: number;      // Stable/terminal dividend growth rate (%)
  ddmHighGrowthYears: number;   // Number of high-growth years

  // Scenario probabilities
  bearProbability: number;      // Bear case probability (%)
  baseProbability: number;      // Base case probability (%)
  bullProbability: number;      // Bull case probability (%)
}

// ============================================
// DCF PROJECTION (Extended with FCFF components)
// ============================================

export interface DCFProjection {
  year: number;
  revenue: number;
  ebitda: number;
  dAndA: number;             // Depreciation & Amortization
  ebit: number;              // EBIT = EBITDA - D&A
  nopat: number;             // NOPAT = EBIT × (1-t)
  capex: number;             // Capital Expenditure
  deltaWC: number;           // Change in Working Capital
  freeCashFlow: number;      // FCFF = NOPAT + D&A - CapEx - ΔWC
  discountFactor: number;    // (1 + WACC)^t
  presentValue: number;      // FCFF / discountFactor
}

// ============================================
// WACC RESULT (with full intermediate steps)
// ============================================

export interface WACCResult {
  costOfEquity: number;         // Ke (%)
  afterTaxCostOfDebt: number;   // Kd × (1-t) (%)
  preTaxCostOfDebt: number;     // Kd (%)
  equityWeight: number;         // E/V (%)
  debtWeight: number;           // D/V (%)
  wacc: number;                 // Final WACC (%)
  marketCap: number;            // E
  totalDebt: number;            // D
  totalCapital: number;         // V = E + D
  capmMethod: CAPMMethod;       // Which method was used
  keUSD?: number;               // Ke in USD (Method B only)
}

// ============================================
// FCFF THREE-WAY VERIFICATION
// ============================================

export interface FCFFVerification {
  method1: number;   // NOPAT route: EBIT×(1-t) + D&A - CapEx - ΔWC
  method2: number;   // EBITDA route: EBITDA×(1-t) + D&A×t - CapEx - ΔWC
  method3: number;   // Net Income route: NI + Interest×(1-t) + D&A - CapEx - ΔWC
  allMatch: boolean; // True if all within tolerance (±0.001)
  tolerance: number; // 0.001
}

// ============================================
// DCF VALUATION RESULT
// ============================================

export interface DCFResult {
  sumOfPresentValues: number;
  terminalValue: number;
  presentValueOfTerminal: number;
  terminalValuePercent: number;  // TV as % of EV
  enterpriseValue: number;
  netDebt: number;
  equityValue: number;           // Can be NEGATIVE (no MAX floor)
  impliedSharePrice: number;
  upside: number;
  marginOfSafety: number;
  verdict: 'UNDERVALUED' | 'OVERVALUED' | 'FAIRLY VALUED';
  discountingConvention: DiscountingConvention;
}

// ============================================
// DDM RESULTS
// ============================================

export interface DDMResult {
  gordonGrowth: number | null;   // null if company doesn't pay dividends
  twoStage: number | null;
  hModel: number | null;
  applicable: boolean;           // false if no dividends
  message?: string;              // "N/A — Company does not pay dividends" etc.
}

// ============================================
// SENSITIVITY ANALYSIS
// ============================================

export interface SensitivityCell {
  wacc: number;
  terminalGrowth: number;
  impliedPrice: number;
  upside: number;
  color: 'green' | 'yellow' | 'red';
  isBaseCase: boolean;
}

export interface SensitivityMatrix {
  waccAxis: number[];            // Y-axis values
  growthAxis: number[];          // X-axis values
  cells: SensitivityCell[][];    // 5×5 matrix
}

// ============================================
// SCENARIO ANALYSIS
// ============================================

export interface ScenarioCase {
  revenueGrowth: number;
  ebitdaMargin: number;
  terminalGrowth: number;
  wacc: number;
  probability: number;       // %
  intrinsicValue: number;    // per share
}

export interface ScenarioAnalysis {
  bear: ScenarioCase;
  base: ScenarioCase;
  bull: ScenarioCase;
  weightedValue: number;     // Probability-weighted average
}

// ============================================
// REVERSE DCF
// ============================================

export interface ReverseDCFResult {
  impliedGrowthRate: number;
  baseGrowthRate: number;
  growthGap: number;
  marketExpectation: 'aggressive' | 'reasonable' | 'conservative';
  narrative: string;
}

// ============================================
// INPUT VALIDATION
// ============================================

export interface ValidationAlert {
  type: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
  blocking?: boolean;        // true = hard block (user CANNOT proceed)
}

// ============================================
// FINANCIAL RATIOS (complete set per Section 7)
// ============================================

export interface FinancialRatios {
  // Profitability
  grossMargin: number;
  ebitdaMargin: number;
  ebitMargin: number;
  netMargin: number;
  roe: number;
  roa: number;
  roic: number;

  // Leverage
  debtToEquity: number;
  netDebtToEBITDA: number;
  interestCoverage: number;

  // Liquidity
  currentRatio: number;
  quickRatio: number;

  // Efficiency
  dso: number;               // Days Sales Outstanding
  dio: number;               // Days Inventory Outstanding
  dpo: number;               // Days Payables Outstanding
  cashConversionCycle: number;

  // Value Creation
  eva: number;               // Economic Value Added
  roicWACCSpread: number;    // ROIC - WACC

  // Quality
  altmanZScore: number;
  piotroskiFScore: number;

  // Valuation Multiples
  trailingPE: number;
  forwardPE: number;
  evEbitda: number;
  evEbit: number;
  evRevenue: number;
  priceToBook: number;
  priceToSales: number;
  priceToCashFlow: number;
  pegRatio: number;
  dividendYield: number;
  earningsYield: number;
  fcfYield: number;
}

// ============================================
// JSON EXPORT SCHEMA (Section 8.4)
// ============================================

export interface ValuationJSON {
  metadata: {
    engine_version: string;
    generation_date: string;
    currency: 'EGP' | 'USD';
    company_name: string;
    capm_method: 'LOCAL_CAPM' | 'USD_BUILDUP';
    rf_instrument: string;
    rf_date: string;
    discounting_convention: 'END_OF_YEAR' | 'MID_YEAR';
  };
  inputs: Record<string, unknown>;
  calculated: {
    wacc: WACCResult;
    dcf: DCFResult & { projected_fcff: number[]; pv_fcff: number[] };
    ddm: DDMResult;
    multiples: Record<string, number>;
    sensitivity: SensitivityMatrix;
    ratios: FinancialRatios;
    fcff_verification: FCFFVerification;
    scenarios: ScenarioAnalysis;
  };
}

// ============================================
// EXISTING TYPES (preserved for compatibility)
// ============================================

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
