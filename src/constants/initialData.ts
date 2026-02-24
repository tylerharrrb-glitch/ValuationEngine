/**
 * Default/sample financial data used when no stock is loaded.
 * Configured for Egyptian market defaults per WOLF specification.
 */
import { FinancialData, ValuationAssumptions, ComparableCompany } from '../types/financial';

/** Sample company data for initial state */
export const initialFinancialData: FinancialData = {
  companyName: 'TechCorp Industries',
  ticker: 'TECH',
  sharesOutstanding: 100000000,
  currentStockPrice: 45.00,
  dividendsPerShare: 0,
  incomeStatement: {
    revenue: 5000000000,
    costOfGoodsSold: 2000000000,
    grossProfit: 3000000000,
    operatingExpenses: 1500000000,
    operatingIncome: 1500000000,
    interestExpense: 100000000,
    taxExpense: 294000000,
    netIncome: 1106000000,
    depreciation: 200000000,
    amortization: 50000000,
  },
  balanceSheet: {
    cash: 800000000,
    marketableSecurities: 0,
    accountsReceivable: 600000000,
    inventory: 400000000,
    otherCurrentAssets: 0,
    totalCurrentAssets: 1800000000,
    propertyPlantEquipment: 2000000000,
    longTermInvestments: 0,
    goodwill: 0,
    intangibleAssets: 500000000,
    otherNonCurrentAssets: 0,
    totalAssets: 4300000000,
    accountsPayable: 300000000,
    shortTermDebt: 200000000,
    otherCurrentLiabilities: 0,
    totalCurrentLiabilities: 500000000,
    longTermDebt: 1000000000,
    otherNonCurrentLiabilities: 0,
    totalLiabilities: 1500000000,
    totalEquity: 2800000000,
  },
  cashFlowStatement: {
    operatingCashFlow: 1400000000,
    capitalExpenditures: 300000000,
    freeCashFlow: 1100000000,
    dividendsPaid: 200000000,
    netChangeInCash: 600000000,
  },
};

/** Default valuation assumptions — Egyptian market defaults */
export const initialAssumptions: ValuationAssumptions = {
  // Core DCF
  discountRate: 23.562,           // WACC — will be recalculated from components
  terminalGrowthRate: 8.0,        // Egyptian nominal GDP growth
  projectionYears: 5,
  revenueGrowthRate: 15,
  marginImprovement: 0,           // Legacy — retained for compatibility
  taxRate: 22.5,                  // Egyptian standard corporate tax

  // CAPM
  riskFreeRate: 22.0,             // 10-Year Egyptian Government Bond Yield (NOT CBE overnight)
  marketRiskPremium: 5.5,         // Mature Market ERP (Damodaran) — NOT 10%
  beta: 1.2,                      // Default beta vs EGX 30
  capmMethod: 'A',                // Method A = Local Currency CAPM (default)
  betaType: 'raw',
  taxCategory: 'standard',

  // Method B defaults (hidden when Method A is active)
  rfUS: 4.5,                      // 10-Year US Treasury yield
  countryRiskPremium: 7.5,        // Damodaran for Egypt (Caa1/B-)
  egyptInflation: 28.0,
  usInflation: 3.0,

  // Cost of Debt
  costOfDebt: 20.0,               // Pre-tax cost of debt (EGP)

  // Risk-free rate date
  rfDate: '2026-02-01',

  // Projection drivers (FCFF-based)
  ebitdaMargin: 30.0,
  daPercent: 8.0,
  capexPercent: 10.0,
  deltaWCPercent: 20.0,
  useConstantDrivers: true,

  // Terminal Value
  terminalMethod: 'gordon_growth',
  exitMultiple: 8.0,

  // Discounting
  discountingConvention: 'end_of_year',

  // DDM
  dps: 0.50,
  ddmHighGrowth: 15.0,
  ddmStableGrowth: 8.0,
  ddmHighGrowthYears: 5,

  // Scenario probabilities
  bearProbability: 25,
  baseProbability: 50,
  bullProbability: 25,
};

/** Empty by default - user adds their own peer companies */
export const initialComparables: ComparableCompany[] = [];
