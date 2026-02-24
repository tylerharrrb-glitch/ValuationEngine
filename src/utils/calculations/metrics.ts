/**
 * Financial metrics calculation utilities.
 * Computes key ratios and generates buy/sell recommendations.
 * REWRITTEN: Uses verdict logic from spec (±10% bands)
 */
import { FinancialData } from '../../types/financial';

/** All computed financial metrics */
export interface KeyMetrics {
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  ebitdaMargin: number;
  roe: number;
  roa: number;
  roic: number;
  currentRatio: number;
  debtToEquity: number;
  peRatio: number;
  evEbitda: number;
  fcfYield: number;
  interestCoverage: number;
  netDebtEbitda: number;
  dividendYield: number;
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
  const investedCapital = balanceSheet.totalEquity + totalDebt - balanceSheet.cash;
  const taxRate = (incomeStatement.netIncome + incomeStatement.taxExpense) > 0
    ? incomeStatement.taxExpense / (incomeStatement.netIncome + incomeStatement.taxExpense)
    : 0.225;  // BUG FIX: was 0.21, now defaults to Egyptian 22.5%
  const nopat = incomeStatement.operatingIncome * (1 - taxRate);
  const netDebt = totalDebt - balanceSheet.cash;

  return {
    grossMargin: ((incomeStatement.revenue - incomeStatement.costOfGoodsSold) / incomeStatement.revenue) * 100,
    operatingMargin: (incomeStatement.operatingIncome / incomeStatement.revenue) * 100,
    netMargin: (incomeStatement.netIncome / incomeStatement.revenue) * 100,
    ebitdaMargin: (ebitda / incomeStatement.revenue) * 100,
    roe: balanceSheet.totalEquity > 0 ? (incomeStatement.netIncome / balanceSheet.totalEquity) * 100 : 0,
    roa: balanceSheet.totalAssets > 0 ? (incomeStatement.netIncome / balanceSheet.totalAssets) * 100 : 0,
    roic: investedCapital > 0 ? (nopat / investedCapital) * 100 : 0,
    currentRatio: balanceSheet.totalCurrentLiabilities > 0
      ? balanceSheet.totalCurrentAssets / balanceSheet.totalCurrentLiabilities : 0,
    debtToEquity: balanceSheet.totalEquity > 0 ? totalDebt / balanceSheet.totalEquity : 0,
    peRatio: incomeStatement.netIncome > 0 ? marketCap / incomeStatement.netIncome : 0,
    evEbitda: ebitda > 0 ? ev / ebitda : 0,
    fcfYield: marketCap > 0 ? (cashFlowStatement.freeCashFlow / marketCap) * 100 : 0,
    interestCoverage: incomeStatement.interestExpense > 0
      ? incomeStatement.operatingIncome / incomeStatement.interestExpense : 999,
    netDebtEbitda: ebitda > 0 ? netDebt / ebitda : 0,
    dividendYield: financialData.currentStockPrice > 0
      ? (financialData.dividendsPerShare / financialData.currentStockPrice) * 100 : 0,
  };
}

/**
 * Get recommendation based on upside percentage.
 * Uses spec Section 5.5 verdict logic (±10% bands)
 */
export function getRecommendation(upside: number): Recommendation {
  if (upside > 10) return { text: 'UNDERVALUED', color: 'text-green-400', bg: 'bg-green-500/20' };
  if (upside > -10) return { text: 'FAIRLY VALUED', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
  return { text: 'OVERVALUED', color: 'text-red-400', bg: 'bg-red-500/20' };
}
