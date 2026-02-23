import { FinancialData, ValuationAssumptions, ComparableCompany } from '../types/financial';

export const sampleFinancialData: FinancialData = {
  companyName: 'TechCorp Industries',
  ticker: 'TECH',
  sharesOutstanding: 500000000,
  currentStockPrice: 45.00,
  incomeStatement: {
    revenue: 12500000000,
    costOfGoodsSold: 7500000000,
    grossProfit: 5000000000,
    operatingExpenses: 2500000000,
    operatingIncome: 2500000000,
    interestExpense: 200000000,
    taxExpense: 460000000,
    netIncome: 1840000000,
    depreciation: 400000000,
    amortization: 100000000,
  },
  balanceSheet: {
    cash: 2500000000,
    marketableSecurities: 200000000,
    accountsReceivable: 1500000000,
    inventory: 800000000,
    otherCurrentAssets: 0,
    totalCurrentAssets: 5000000000,
    propertyPlantEquipment: 4000000000,
    longTermInvestments: 500000000,
    goodwill: 400000000,
    intangibleAssets: 2000000000,
    otherNonCurrentAssets: 100000000,
    totalAssets: 12000000000,
    accountsPayable: 1000000000,
    shortTermDebt: 500000000,
    otherCurrentLiabilities: 500000000,
    totalCurrentLiabilities: 2000000000,
    longTermDebt: 3000000000,
    otherNonCurrentLiabilities: 500000000,
    totalLiabilities: 5500000000,
    totalEquity: 6500000000,
  },
  cashFlowStatement: {
    operatingCashFlow: 2200000000,
    capitalExpenditures: 800000000,
    freeCashFlow: 1400000000,
    dividendsPaid: 300000000,
    netChangeInCash: 500000000,
  },
};

export const sampleAssumptions: ValuationAssumptions = {
  discountRate: 10,
  terminalGrowthRate: 2.5,
  projectionYears: 5,
  revenueGrowthRate: 8,
  marginImprovement: 0.5,
  taxRate: 25,
  riskFreeRate: 4.5,
  marketRiskPremium: 5.5,
  beta: 1.2,
};

// Start with empty comparables - user adds their own peer companies
export const sampleComparables: ComparableCompany[] = [];
