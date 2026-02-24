/**
 * Simplified valuation utility functions.
 * These are convenience wrappers around the full engine in valuationEngine.ts.
 * REWRITTEN: Uses proper FCFF formula, EGP currency, no MAX(0) floor.
 */
import {
  FinancialData,
  ValuationAssumptions,
  ComparableCompany,
  ValuationResult,
  DCFProjection,
} from '../types/financial';

/** Calculate EBITDA = Operating Income + D&A */
export function calculateEBITDA(data: FinancialData): number {
  const { operatingIncome, depreciation, amortization } = data.incomeStatement;
  return operatingIncome + depreciation + amortization;
}

/** Calculate Enterprise Value = Market Cap + Total Debt − Cash */
export function calculateEnterpriseValue(data: FinancialData): number {
  const marketCap = data.currentStockPrice * data.sharesOutstanding;
  const totalDebt = data.balanceSheet.shortTermDebt + data.balanceSheet.longTermDebt;
  const cash = data.balanceSheet.cash;
  return marketCap + totalDebt - cash;
}

/**
 * Calculate DCF using proper FCFF methodology.
 * FCFF = NOPAT + D&A − CapEx − ΔWC
 * BUG FIX: Was using Revenue × FCF margin. Now uses component-based FCFF.
 * BUG FIX: Equity value can be negative (no MAX(0) floor).
 */
export function calculateDCF(
  data: FinancialData,
  assumptions: ValuationAssumptions
): { value: number; projections: DCFProjection[] } {
  const projections: DCFProjection[] = [];
  let currentRevenue = data.incomeStatement.revenue;
  const taxRate = assumptions.taxRate / 100;
  const wacc = assumptions.discountRate / 100;

  for (let year = 1; year <= assumptions.projectionYears; year++) {
    const prevRevenue = currentRevenue;
    currentRevenue *= 1 + assumptions.revenueGrowthRate / 100;

    const ebitda = currentRevenue * (assumptions.ebitdaMargin / 100);
    const dAndA = currentRevenue * (assumptions.daPercent / 100);
    const ebit = ebitda - dAndA;
    const nopat = ebit * (1 - taxRate);
    const capex = currentRevenue * (assumptions.capexPercent / 100);
    const deltaWC = (currentRevenue - prevRevenue) * (assumptions.deltaWCPercent / 100);
    const fcff = nopat + dAndA - capex - deltaWC;

    const period = assumptions.discountingConvention === 'mid_year' ? year - 0.5 : year;
    const discountFactor = Math.pow(1 + wacc, period);

    projections.push({
      year,
      revenue: currentRevenue,
      ebitda,
      dAndA,
      ebit,
      nopat,
      capex,
      deltaWC,
      freeCashFlow: fcff,
      discountFactor,
      presentValue: fcff / discountFactor,
    });
  }

  // Terminal Value (Gordon Growth)
  const lastFCF = projections[projections.length - 1].freeCashFlow;
  const termGrowth = assumptions.terminalGrowthRate / 100;
  let terminalValue = 0;
  if (wacc > termGrowth) {
    terminalValue = (lastFCF * (1 + termGrowth)) / (wacc - termGrowth);
  }
  const terminalPV = terminalValue / Math.pow(1 + wacc, assumptions.projectionYears);

  const sumOfPV = projections.reduce((sum, p) => sum + p.presentValue, 0);
  const enterpriseValue = sumOfPV + terminalPV;

  // EV to Equity Bridge — NO MAX(0) floor
  const totalDebt = data.balanceSheet.shortTermDebt + data.balanceSheet.longTermDebt;
  const equityValue = enterpriseValue - totalDebt + data.balanceSheet.cash;

  return { value: equityValue, projections };
}

/** Calculate comparable company valuations */
export function calculateComparableValuation(
  data: FinancialData,
  comparables: ComparableCompany[]
): ValuationResult[] {
  if (comparables.length === 0) return [];

  const avgPE = comparables.reduce((sum, c) => sum + c.peRatio, 0) / comparables.length;
  const avgEVEBITDA = comparables.reduce((sum, c) => sum + c.evEbitda, 0) / comparables.length;
  const avgPS = comparables.reduce((sum, c) => sum + c.psRatio, 0) / comparables.length;
  const avgPB = comparables.reduce((sum, c) => sum + c.pbRatio, 0) / comparables.length;

  const netIncome = data.incomeStatement.netIncome;
  const ebitda = calculateEBITDA(data);
  const revenue = data.incomeStatement.revenue;
  const bookValue = data.balanceSheet.totalEquity;
  const totalDebt = data.balanceSheet.shortTermDebt + data.balanceSheet.longTermDebt;
  const cash = data.balanceSheet.cash;
  const results: ValuationResult[] = [];

  // P/E
  const peValue = netIncome * avgPE;
  const pePerShare = peValue / data.sharesOutstanding;
  results.push({
    method: 'P/E Multiple',
    value: peValue,
    perShare: pePerShare,
    upside: ((pePerShare - data.currentStockPrice) / data.currentStockPrice) * 100,
  });

  // EV/EBITDA
  const evFromEbitda = ebitda * avgEVEBITDA;
  const ebitdaEquityValue = evFromEbitda - totalDebt + cash; // No MAX(0) floor
  const ebitdaPerShare = ebitdaEquityValue / data.sharesOutstanding;
  results.push({
    method: 'EV/EBITDA Multiple',
    value: ebitdaEquityValue,
    perShare: ebitdaPerShare,
    upside: ((ebitdaPerShare - data.currentStockPrice) / data.currentStockPrice) * 100,
  });

  // P/S
  const psValue = revenue * avgPS;
  const psPerShare = psValue / data.sharesOutstanding;
  results.push({
    method: 'P/S Multiple',
    value: psValue,
    perShare: psPerShare,
    upside: ((psPerShare - data.currentStockPrice) / data.currentStockPrice) * 100,
  });

  // P/B
  const pbValue = bookValue * avgPB;
  const pbPerShare = pbValue / data.sharesOutstanding;
  results.push({
    method: 'P/B Multiple',
    value: pbValue,
    perShare: pbPerShare,
    upside: ((pbPerShare - data.currentStockPrice) / data.currentStockPrice) * 100,
  });

  return results;
}

/**
 * Calculate WACC using Market Cap for equity weight.
 * BUG FIX: Was not using market cap consistently.
 */
export function calculateWACC(
  data: FinancialData,
  assumptions: ValuationAssumptions
): number {
  const marketCap = data.currentStockPrice * data.sharesOutstanding;
  const totalDebt = data.balanceSheet.shortTermDebt + data.balanceSheet.longTermDebt;
  const totalCapital = marketCap + totalDebt;

  // Cost of Equity (CAPM Method A by default)
  const costOfEquity = assumptions.riskFreeRate + assumptions.beta * assumptions.marketRiskPremium;

  // After-tax Cost of Debt
  const costOfDebt = assumptions.costOfDebt || (
    totalDebt > 0
      ? (data.incomeStatement.interestExpense / totalDebt) * 100
      : assumptions.riskFreeRate + 2
  );
  const afterTaxCostOfDebt = costOfDebt * (1 - assumptions.taxRate / 100);

  const wacc = totalCapital > 0
    ? (marketCap / totalCapital) * costOfEquity + (totalDebt / totalCapital) * afterTaxCostOfDebt
    : costOfEquity;

  return wacc;
}

/**
 * Format currency with EGP/USD support.
 * BUG FIX: Was always using '$'. Now defaults to 'EGP'.
 */
export function formatCurrency(value: number, currency: string = 'EGP'): string {
  const symbol = currency === 'USD' ? '$' : 'EGP ';
  if (Math.abs(value) >= 1e12) {
    return `${symbol}${(value / 1e12).toFixed(2)}T`;
  } else if (Math.abs(value) >= 1e9) {
    return `${symbol}${(value / 1e9).toFixed(2)}B`;
  } else if (Math.abs(value) >= 1e6) {
    return `${symbol}${(value / 1e6).toFixed(2)}M`;
  } else if (Math.abs(value) >= 1e3) {
    return `${symbol}${(value / 1e3).toFixed(2)}K`;
  }
  return `${symbol}${value.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
