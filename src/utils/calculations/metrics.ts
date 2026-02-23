/**
 * Financial metrics calculation utilities.
 * Computes key ratios and generates buy/sell recommendations.
 */
import { FinancialData } from '../../types/financial';

/** All computed financial metrics */
export interface KeyMetrics {
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  roe: number;
  roa: number;
  currentRatio: number;
  debtToEquity: number;
  peRatio: number;
  evEbitda: number;
  fcfYield: number;
  ebitdaMargin: number;
  interestCoverage: number;
}

/** Buy/sell recommendation result */
export interface Recommendation {
  text: string;
  color: string;
  bg: string;
}

/**
 * Calculate all key financial metrics from financial data.
 */
export function calculateKeyMetrics(financialData: FinancialData): KeyMetrics {
  const { incomeStatement, balanceSheet, cashFlowStatement } = financialData;
  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const marketCap = financialData.currentStockPrice * financialData.sharesOutstanding;
  const ebitda = incomeStatement.operatingIncome + incomeStatement.depreciation + incomeStatement.amortization;
  const ev = marketCap + totalDebt - balanceSheet.cash;
  
  return {
    grossMargin: ((incomeStatement.revenue - incomeStatement.costOfGoodsSold) / incomeStatement.revenue) * 100,
    operatingMargin: (incomeStatement.operatingIncome / incomeStatement.revenue) * 100,
    netMargin: (incomeStatement.netIncome / incomeStatement.revenue) * 100,
    roe: (incomeStatement.netIncome / balanceSheet.totalEquity) * 100,
    roa: (incomeStatement.netIncome / balanceSheet.totalAssets) * 100,
    currentRatio: balanceSheet.totalCurrentAssets / balanceSheet.totalCurrentLiabilities,
    debtToEquity: totalDebt / balanceSheet.totalEquity,
    peRatio: marketCap / incomeStatement.netIncome,
    evEbitda: ev / ebitda,
    fcfYield: (cashFlowStatement.freeCashFlow / marketCap) * 100,
    ebitdaMargin: (ebitda / incomeStatement.revenue) * 100,
    interestCoverage: incomeStatement.operatingIncome / incomeStatement.interestExpense,
  };
}

/**
 * Get buy/sell/hold recommendation based on upside percentage.
 */
export function getRecommendation(upside: number): Recommendation {
  if (upside > 20) return { text: 'STRONG BUY', color: 'text-green-400', bg: 'bg-green-500/20' };
  if (upside > 10) return { text: 'BUY', color: 'text-green-400', bg: 'bg-green-500/20' };
  if (upside > -10) return { text: 'HOLD', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
  if (upside > -20) return { text: 'SELL', color: 'text-red-400', bg: 'bg-red-500/20' };
  return { text: 'STRONG SELL', color: 'text-red-400', bg: 'bg-red-500/20' };
}
