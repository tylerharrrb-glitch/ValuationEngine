/**
 * Default/sample financial data used when no stock is loaded.
 * These values initialize the valuation engine on first load.
 */
import { FinancialData, ValuationAssumptions, ComparableCompany } from '../types/financial';

/** Sample company data for initial state */
export const initialFinancialData: FinancialData = {
  companyName: 'TechCorp Industries',
  ticker: 'TECH',
  sharesOutstanding: 100000000,
  currentStockPrice: 45.00,
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

/** Default valuation assumptions */
export const initialAssumptions: ValuationAssumptions = {
  discountRate: 10,
  terminalGrowthRate: 2.5,
  projectionYears: 5,
  revenueGrowthRate: 8,
  marginImprovement: 0.5,
  taxRate: 21,
  riskFreeRate: 4.5,
  marketRiskPremium: 5.5,
  beta: 1.1,
};

/** Empty by default - user adds their own peer companies */
export const initialComparables: ComparableCompany[] = [];
