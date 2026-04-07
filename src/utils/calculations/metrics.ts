/**
 * Financial metrics calculation utilities.
 * Computes key ratios and generates buy/sell recommendations.
 * REWRITTEN: Uses verdict logic from spec (±10% bands)
 */
import { FinancialData, DCFProjection } from '../../types/financial';

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
  // NTM (Next Twelve Months) forward multiples — Task #7
  ntmPE: number;
  ntmEvEbitda: number;
  ntmPS: number;
}

/** Buy/sell recommendation result */
export interface Recommendation {
  text: string;     // Primary display text (verdict)
  action: string;   // Actionable recommendation (STRONG BUY/BUY/HOLD/SELL/STRONG SELL)
  verdict: string;  // Valuation verdict (UNDERVALUED/FAIRLY VALUED/OVERVALUED)
  color: string;
  bg: string;
}

/**
 * Calculate all key financial metrics from financial data.
 */
export function calculateKeyMetrics(financialData: FinancialData, dcfProjections?: DCFProjection[]): KeyMetrics {
  const { incomeStatement, balanceSheet, cashFlowStatement } = financialData;
  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const marketCap = financialData.currentStockPrice * financialData.sharesOutstanding;
  const ebitda = incomeStatement.operatingIncome + incomeStatement.depreciation + incomeStatement.amortization;
  const ev = marketCap + totalDebt - balanceSheet.cash;
  const investedCapital = balanceSheet.totalEquity + totalDebt - balanceSheet.cash;
  // C7 Fix: Use statutory tax rate (22.5%) for ROIC, not effective tax
  const STATUTORY_TAX_RATE = 0.225;
  const nopat = incomeStatement.operatingIncome * (1 - STATUTORY_TAX_RATE);
  const netDebt = totalDebt - balanceSheet.cash;

  // NTM (Next Twelve Months) forward multiples — Task #7
  // Use Year 1 DCF projections to compute forward-looking ratios
  const year1 = dcfProjections && dcfProjections.length > 0 ? dcfProjections[0] : null;
  const fwdNetIncome = year1 ? year1.nopat : 0; // NOPAT as proxy for forward NI (pre-interest)
  const fwdEbitda = year1 ? year1.ebitda : 0;
  const fwdRevenue = year1 ? year1.revenue : 0;

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
    // C8 Fix: Use abs(dividendsPaid) to handle negative sign convention
    dividendYield: financialData.currentStockPrice > 0 && financialData.sharesOutstanding > 0
      ? (Math.abs(financialData.cashFlowStatement.dividendsPaid) / financialData.sharesOutstanding / financialData.currentStockPrice) * 100 : 0,
    // NTM forward multiples
    ntmPE: fwdNetIncome > 0 ? marketCap / fwdNetIncome : 0,
    ntmEvEbitda: fwdEbitda > 0 ? ev / fwdEbitda : 0,
    ntmPS: fwdRevenue > 0 ? marketCap / fwdRevenue : 0,
  };
}

/**
 * C4 Fix: Get unified recommendation based on upside percentage.
 * Returns BOTH verdict and actionable recommendation.
 * Thresholds: STRONG BUY >30% | BUY >10% | HOLD ≥-10% | SELL ≥-30% | STRONG SELL <-30%
 */
export function getRecommendation(upside: number): Recommendation {
  // Verdict: valuation assessment
  let verdict: string, color: string, bg: string;
  if (upside > 10) { verdict = 'UNDERVALUED'; color = 'text-green-400'; bg = 'bg-green-500/20'; }
  else if (upside >= -10) { verdict = 'FAIRLY VALUED'; color = 'text-yellow-400'; bg = 'bg-yellow-500/20'; }
  else { verdict = 'OVERVALUED'; color = 'text-red-400'; bg = 'bg-red-500/20'; }

  // Action: investment recommendation
  let action: string;
  if (upside > 30) action = 'STRONG BUY';
  else if (upside > 10) action = 'BUY';
  else if (upside >= -10) action = 'HOLD';
  else if (upside >= -30) action = 'SELL';
  else action = 'STRONG SELL';

  return { text: verdict, action, verdict, color, bg };
}
