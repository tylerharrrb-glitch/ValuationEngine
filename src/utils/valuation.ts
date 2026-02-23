import {
  FinancialData,
  ValuationAssumptions,
  ComparableCompany,
  ValuationResult,
  DCFProjection,
} from '../types/financial';

export function calculateEBITDA(data: FinancialData): number {
  const { operatingIncome, depreciation, amortization } = data.incomeStatement;
  return operatingIncome + depreciation + amortization;
}

export function calculateEnterpriseValue(data: FinancialData): number {
  const marketCap = data.currentStockPrice * data.sharesOutstanding;
  const totalDebt = data.balanceSheet.shortTermDebt + data.balanceSheet.longTermDebt;
  const cash = data.balanceSheet.cash;
  return marketCap + totalDebt - cash;
}

export function calculateDCF(
  data: FinancialData,
  assumptions: ValuationAssumptions
): { value: number; projections: DCFProjection[] } {
  const projections: DCFProjection[] = [];
  let currentRevenue = data.incomeStatement.revenue;
  let currentMargin = data.cashFlowStatement.freeCashFlow / data.incomeStatement.revenue;

  for (let year = 1; year <= assumptions.projectionYears; year++) {
    currentRevenue *= 1 + assumptions.revenueGrowthRate / 100;
    currentMargin = Math.min(currentMargin + assumptions.marginImprovement / 100, 0.25);

    const ebitda = currentRevenue * (calculateEBITDA(data) / data.incomeStatement.revenue);
    const fcf = currentRevenue * currentMargin;
    const discountFactor = Math.pow(1 + assumptions.discountRate / 100, year);
    const pv = fcf / discountFactor;

    projections.push({
      year,
      revenue: currentRevenue,
      ebitda,
      freeCashFlow: fcf,
      discountFactor,
      presentValue: pv,
    });
  }

  // Terminal Value
  const lastFCF = projections[projections.length - 1].freeCashFlow;
  const terminalValue =
    (lastFCF * (1 + assumptions.terminalGrowthRate / 100)) /
    (assumptions.discountRate / 100 - assumptions.terminalGrowthRate / 100);
  const terminalPV =
    terminalValue /
    Math.pow(1 + assumptions.discountRate / 100, assumptions.projectionYears);

  const sumOfPV = projections.reduce((sum, p) => sum + p.presentValue, 0);
  const enterpriseValue = sumOfPV + terminalPV;

  // Convert to Equity Value
  const totalDebt = data.balanceSheet.shortTermDebt + data.balanceSheet.longTermDebt;
  const equityValue = enterpriseValue - totalDebt + data.balanceSheet.cash;

  return { value: Math.max(equityValue, 0), projections };
}

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

  // P/E Valuation
  const peValue = netIncome * avgPE;
  const pePerShare = peValue / data.sharesOutstanding;
  results.push({
    method: 'P/E Multiple',
    value: peValue,
    perShare: pePerShare,
    upside: ((pePerShare - data.currentStockPrice) / data.currentStockPrice) * 100,
  });

  // EV/EBITDA Valuation
  const evFromEbitda = ebitda * avgEVEBITDA;
  const ebitdaEquityValue = evFromEbitda - totalDebt + cash;
  const ebitdaPerShare = ebitdaEquityValue / data.sharesOutstanding;
  results.push({
    method: 'EV/EBITDA Multiple',
    value: ebitdaEquityValue,
    perShare: ebitdaPerShare,
    upside: ((ebitdaPerShare - data.currentStockPrice) / data.currentStockPrice) * 100,
  });

  // P/S Valuation
  const psValue = revenue * avgPS;
  const psPerShare = psValue / data.sharesOutstanding;
  results.push({
    method: 'P/S Multiple',
    value: psValue,
    perShare: psPerShare,
    upside: ((psPerShare - data.currentStockPrice) / data.currentStockPrice) * 100,
  });

  // P/B Valuation
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

export function calculateWACC(
  data: FinancialData,
  assumptions: ValuationAssumptions
): number {
  const marketCap = data.currentStockPrice * data.sharesOutstanding;
  const totalDebt = data.balanceSheet.shortTermDebt + data.balanceSheet.longTermDebt;
  const totalCapital = marketCap + totalDebt;

  const costOfEquity =
    assumptions.riskFreeRate + assumptions.beta * assumptions.marketRiskPremium;

  const costOfDebt =
    totalDebt > 0
      ? (data.incomeStatement.interestExpense / totalDebt) * 100
      : assumptions.riskFreeRate + 2;

  const afterTaxCostOfDebt = costOfDebt * (1 - assumptions.taxRate / 100);

  const wacc =
    (marketCap / totalCapital) * costOfEquity +
    (totalDebt / totalCapital) * afterTaxCostOfDebt;

  return wacc;
}

export function formatCurrency(value: number): string {
  if (Math.abs(value) >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  } else if (Math.abs(value) >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  } else if (Math.abs(value) >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  } else if (Math.abs(value) >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  }
  return `$${value.toFixed(2)}`;
}

export function formatPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}
