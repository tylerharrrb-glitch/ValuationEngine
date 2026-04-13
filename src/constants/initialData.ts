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
  dividendsPerShare: 2.0,          // = abs(dividendsPaid 200M) / shares 100M = $2.00
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

/**
 * Default valuation assumptions — Egyptian market defaults
 *
 * Last verified: April 12, 2026
 * Sources: CBE (cbe.org.eg), CAPMAS, Damodaran (pages.stern.nyu.edu/~adamodar),
 * Investing.com, BLS, PwC Egypt Tax Summaries, Moody's, S&P, Fitch
 */
export const initialAssumptions: ValuationAssumptions = {
  // Core DCF
  discountRate: 0,                // SENTINEL — always overridden by live calculateWACC()
  terminalGrowthRate: 8.0,        // Egyptian nominal GDP growth
  projectionYears: 5,
  revenueGrowthRate: 15,
  marginImprovement: 0,           // Legacy — retained for compatibility
  taxRate: 22.5,                  // Egyptian standard corporate tax

  // CAPM
  riskFreeRate: 20.40,            // 10-Year Egyptian Government Bond Yield, March 2026 avg
  marketRiskPremium: 4.23,        // Mature Market ERP (Damodaran, Jan 5 2026 update)
  beta: 1.2,                      // Default beta vs EGX 30
  capmMethod: 'local_rf',         // local_rf — avoids CRP double-count with local Rf (20.40%)
  betaType: 'raw',
  taxCategory: 'standard',

  // Method B defaults (hidden when Method A is active)
  rfUS: 4.25,                     // 10-Year US Treasury midpoint Jan-Apr 2026
  countryRiskPremium: 9.71,       // Damodaran for Egypt (Moody's Caa1), Jan 5 2026
  egyptInflation: 13.5,           // CAPMAS nationwide CPI, March 2026
  usInflation: 3.3,               // BLS CPI, March 2026

  // Damodaran clean risk-free rates
  rfCleanUSD: 3.95,               // US T.Bond 4.18% - US default spread 0.23%
  rfCleanEGP: 9.49,               // Fisher: 3.95 + (7.78 - 2.24), using IMF expected inflation
  egyptExpectedInflation: 7.78,   // IMF medium-term forecast (used by Damodaran)

  // Cost of Debt
  costOfDebt: 22.9,               // Rf 20.4% + 250bp corporate credit spread (EGP)

  // Risk-free rate date
  rfDate: '2026-04-12',

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

  // DDM (dps removed — engine uses financialData.dividendsPerShare)
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
