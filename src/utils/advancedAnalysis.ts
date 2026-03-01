// ============================================
// WOLF ADVANCED ANALYSIS MODULE
// Reverse DCF, Monte Carlo, Sector Benchmarking, Quality Scorecard
// ============================================

import { FinancialData, ValuationAssumptions } from '../types/financial';

// ============================================
// 1. REVERSE DCF
// What growth rate does the current price imply?
// ============================================

export interface ReverseDCFResult {
  impliedGrowthRate: number;       // Revenue growth the market is pricing in
  baseGrowthRate: number;          // Our base case growth rate
  growthGap: number;               // Difference between implied and base
  impliedFCFMargin: number;        // Implied FCF margin at terminal year
  marketExpectation: 'aggressive' | 'reasonable' | 'conservative';
  narrative: string;
}

export function calculateReverseDCF(
  financialData: FinancialData,
  assumptions: ValuationAssumptions
): ReverseDCFResult {
  const currentPrice = financialData.currentStockPrice;
  const shares = financialData.sharesOutstanding;
  const targetMarketCap = currentPrice * shares;
  const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const cash = financialData.balanceSheet.cash;
  const targetEV = targetMarketCap + totalDebt - cash;

  const baseFCFMargin = financialData.incomeStatement.revenue > 0
    ? financialData.cashFlowStatement.freeCashFlow / financialData.incomeStatement.revenue
    : 0.15;

  const wacc = assumptions.discountRate / 100;
  const terminalGrowth = assumptions.terminalGrowthRate / 100;
  const years = assumptions.projectionYears;

  // Binary search for implied growth rate using proper FCFF
  let low = -10;
  let high = 50;
  let impliedGrowth = 0;

  for (let iter = 0; iter < 100; iter++) {
    const mid = (low + high) / 2;
    const growth = mid / 100;

    let revenue = financialData.incomeStatement.revenue;
    let sumPV = 0;
    let lastFCFF = 0;

    for (let yr = 1; yr <= years; yr++) {
      const prevRev = revenue;
      revenue = revenue * (1 + growth);
      // Proper FCFF: NOPAT + D&A − CapEx − ΔWC
      const ebitdaMarginDec = assumptions.ebitdaMargin / 100;
      const ebitda = revenue * ebitdaMarginDec;
      const dAndA = revenue * (assumptions.daPercent / 100);
      const ebit = ebitda - dAndA;
      const nopat = ebit * (1 - assumptions.taxRate / 100);
      const capex = revenue * (assumptions.capexPercent / 100);
      const deltaWC = (revenue - prevRev) * (assumptions.deltaWCPercent / 100);
      const fcff = nopat + dAndA - capex - deltaWC;
      const period = assumptions.discountingConvention === 'mid_year' ? yr - 0.5 : yr;
      const df = Math.pow(1 + wacc, period);
      sumPV += fcff / df;
      lastFCFF = fcff;
    }

    let tv = 0;
    if (wacc > terminalGrowth) {
      tv = (lastFCFF * (1 + terminalGrowth)) / (wacc - terminalGrowth);
    } else {
      tv = lastFCFF * 15;
    }
    const lastDF = Math.pow(1 + wacc, years);
    const ev = sumPV + tv / lastDF;

    if (ev < targetEV) {
      low = mid;
    } else {
      high = mid;
    }
    impliedGrowth = mid;
  }

  const growthGap = impliedGrowth - assumptions.revenueGrowthRate;
  const impliedFCFMargin = baseFCFMargin + (assumptions.marginImprovement / 100) * years;

  // FIX ENH-6: Proper gap-based interpretation thresholds
  let marketExpectation: 'aggressive' | 'reasonable' | 'conservative' = 'reasonable';
  let narrative = '';
  const absGap = Math.abs(growthGap);
  let gapDesc = '';
  if (absGap < 2) gapDesc = 'closely in line with';
  else if (absGap < 5) gapDesc = 'moderately ' + (impliedGrowth > assumptions.revenueGrowthRate ? 'higher than' : 'lower than');
  else if (absGap < 10) gapDesc = 'significantly ' + (impliedGrowth > assumptions.revenueGrowthRate ? 'higher than' : 'lower than');
  else gapDesc = 'substantially ' + (impliedGrowth > assumptions.revenueGrowthRate ? 'higher than' : 'lower than');

  if (absGap >= 5 && impliedGrowth > assumptions.revenueGrowthRate) {
    marketExpectation = 'aggressive';
    narrative = `The market is pricing in ${impliedGrowth.toFixed(1)}% annual revenue growth — ${gapDesc} our ${assumptions.revenueGrowthRate.toFixed(1)}% base case (gap: ${growthGap.toFixed(1)}pp). This suggests the stock could be overvalued if growth disappoints.`;
  } else if (absGap >= 5 && impliedGrowth < assumptions.revenueGrowthRate) {
    marketExpectation = 'conservative';
    narrative = `The market is only pricing in ${impliedGrowth.toFixed(1)}% annual revenue growth — ${gapDesc} our ${assumptions.revenueGrowthRate.toFixed(1)}% base case (gap: ${growthGap.toFixed(1)}pp). If the company delivers, there is significant upside.`;
  } else {
    marketExpectation = 'reasonable';
    narrative = `The market is pricing in ${impliedGrowth.toFixed(1)}% annual revenue growth — ${gapDesc} our ${assumptions.revenueGrowthRate.toFixed(1)}% base case (gap: ${growthGap.toFixed(1)}pp). The stock appears to be fairly valued.`;
  }

  return {
    impliedGrowthRate: Math.round(impliedGrowth * 10) / 10,
    baseGrowthRate: assumptions.revenueGrowthRate,
    growthGap: Math.round(growthGap * 10) / 10,
    impliedFCFMargin: Math.round(impliedFCFMargin * 1000) / 10,
    marketExpectation,
    narrative,
  };
}

// ============================================
// 2. MONTE CARLO SIMULATION
// Run N simulations with random parameter variations
// ============================================

export interface MonteCarloResult {
  simulations: number;
  meanPrice: number;
  medianPrice: number;
  stdDev: number;
  percentile5: number;
  percentile25: number;
  percentile75: number;
  percentile95: number;
  probabilityAboveCurrentPrice: number;
  probabilityAboveBaseCase: number;
  distribution: { bucket: string; count: number; percentage: number }[];
}

function gaussianRandom(): number {
  // Box-Muller transform
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

export function runMonteCarloSimulation(
  financialData: FinancialData,
  assumptions: ValuationAssumptions,
  numSimulations: number = 5000
): MonteCarloResult {
  const results: number[] = [];
  // C3 Fix: Use FCFF buildup (NOPAT + D&A − CapEx − ΔWC) instead of legacy FCF margin
  const taxRate = assumptions.taxRate / 100;

  for (let sim = 0; sim < numSimulations; sim++) {
    // Add random variation to key parameters
    const revGrowthVar = assumptions.revenueGrowthRate + gaussianRandom() * 4;  // ±4% std dev
    const waccVar = Math.max(2, assumptions.discountRate + gaussianRandom() * 1.5); // ±1.5% std dev
    const termGrowthVar = Math.max(0, Math.min(waccVar - 0.5, assumptions.terminalGrowthRate + gaussianRandom() * 0.8)); // ±0.8% std dev
    const marginVar = gaussianRandom() * 1.5; // ±1.5% std dev on EBITDA margin

    let revenue = financialData.incomeStatement.revenue;
    let sumPV = 0;
    let lastFCF = 0;

    for (let yr = 1; yr <= assumptions.projectionYears; yr++) {
      const prevRevenue = revenue;
      revenue = revenue * (1 + revGrowthVar / 100);
      const ebitdaMargin = (assumptions.ebitdaMargin + marginVar) / 100;
      const ebitda = revenue * ebitdaMargin;
      const da = revenue * (assumptions.daPercent / 100);
      const ebit = ebitda - da;
      const nopat = ebit * (1 - taxRate);
      const capex = revenue * (assumptions.capexPercent / 100);
      const deltaWC = (revenue - prevRevenue) * (assumptions.deltaWCPercent / 100);
      const fcf = nopat + da - capex - deltaWC;
      const df = Math.pow(1 + waccVar / 100, yr);
      sumPV += fcf / df;
      lastFCF = fcf;
    }

    let tv = 0;
    if (waccVar > termGrowthVar && waccVar - termGrowthVar > 0.1) {
      tv = (lastFCF * (1 + termGrowthVar / 100)) / ((waccVar - termGrowthVar) / 100);
    } else {
      tv = lastFCF * 12;
    }
    const lastDF = Math.pow(1 + waccVar / 100, assumptions.projectionYears);
    const ev = sumPV + tv / lastDF;
    const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
    const equity = Math.max(ev - totalDebt + financialData.balanceSheet.cash, 0);
    const price = equity / financialData.sharesOutstanding;

    if (isFinite(price) && price > 0 && price < financialData.currentStockPrice * 10) {
      results.push(price);
    }
  }

  // Sort results
  results.sort((a, b) => a - b);
  const n = results.length;

  if (n === 0) {
    return {
      simulations: numSimulations,
      meanPrice: 0,
      medianPrice: 0,
      stdDev: 0,
      percentile5: 0,
      percentile25: 0,
      percentile75: 0,
      percentile95: 0,
      probabilityAboveCurrentPrice: 0,
      probabilityAboveBaseCase: 0,
      distribution: [],
    };
  }

  // Statistics
  const mean = results.reduce((a, b) => a + b, 0) / n;
  const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const median = n % 2 === 0 ? (results[n / 2 - 1] + results[n / 2]) / 2 : results[Math.floor(n / 2)];
  const p5 = results[Math.floor(n * 0.05)];
  const p25 = results[Math.floor(n * 0.25)];
  const p75 = results[Math.floor(n * 0.75)];
  const p95 = results[Math.floor(n * 0.95)];

  const aboveCurrentPrice = results.filter(p => p > financialData.currentStockPrice).length;
  const probabilityAboveCurrentPrice = (aboveCurrentPrice / n) * 100;

  // Calculate base case DCF for comparison (using FCFF buildup)
  let baseRevenue = financialData.incomeStatement.revenue;
  let baseSumPV = 0;
  let baseLastFCF = 0;
  for (let yr = 1; yr <= assumptions.projectionYears; yr++) {
    const prevBaseRev = baseRevenue;
    baseRevenue *= (1 + assumptions.revenueGrowthRate / 100);
    const ebitda = baseRevenue * (assumptions.ebitdaMargin / 100);
    const da = baseRevenue * (assumptions.daPercent / 100);
    const ebit = ebitda - da;
    const nopat = ebit * (1 - taxRate);
    const capex = baseRevenue * (assumptions.capexPercent / 100);
    const dwc = (baseRevenue - prevBaseRev) * (assumptions.deltaWCPercent / 100);
    const fcf = nopat + da - capex - dwc;
    const df = Math.pow(1 + assumptions.discountRate / 100, yr);
    baseSumPV += fcf / df;
    baseLastFCF = fcf;
  }
  const baseTv = (baseLastFCF * (1 + assumptions.terminalGrowthRate / 100)) / ((assumptions.discountRate - assumptions.terminalGrowthRate) / 100);
  const baseDF = Math.pow(1 + assumptions.discountRate / 100, assumptions.projectionYears);
  const baseEV = baseSumPV + baseTv / baseDF;
  const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const baseEquity = Math.max(baseEV - totalDebt + financialData.balanceSheet.cash, 0);
  const basePrice = baseEquity / financialData.sharesOutstanding;

  const aboveBaseCase = results.filter(p => p > basePrice).length;
  const probabilityAboveBaseCase = (aboveBaseCase / n) * 100;

  // Create distribution histogram
  const minPrice = results[0];
  const maxPrice = results[n - 1];
  const range = maxPrice - minPrice;
  const bucketCount = 20;
  const bucketWidth = range / bucketCount;
  const distribution: { bucket: string; count: number; percentage: number }[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const low = minPrice + i * bucketWidth;
    const high = low + bucketWidth;
    const count = results.filter(p => p >= low && p < high).length;
    distribution.push({
      bucket: `${low.toFixed(0)}-${high.toFixed(0)}`,
      count,
      percentage: (count / n) * 100,
    });
  }

  return {
    simulations: n,
    meanPrice: Math.round(mean * 100) / 100,
    medianPrice: Math.round(median * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    percentile5: Math.round(p5 * 100) / 100,
    percentile25: Math.round(p25 * 100) / 100,
    percentile75: Math.round(p75 * 100) / 100,
    percentile95: Math.round(p95 * 100) / 100,
    probabilityAboveCurrentPrice: Math.round(probabilityAboveCurrentPrice * 10) / 10,
    probabilityAboveBaseCase: Math.round(probabilityAboveBaseCase * 10) / 10,
    distribution,
  };
}

// ============================================
// 3. SECTOR BENCHMARKING
// Compare company to sector averages
// ============================================

export interface SectorBenchmark {
  metric: string;
  companyValue: number;
  sectorMedian: number;
  percentile: number; // Where the company ranks (0-100)
  rating: 'top' | 'above' | 'average' | 'below' | 'bottom';
  formatted: { company: string; sector: string };
}

export interface SectorBenchmarkResult {
  benchmarks: SectorBenchmark[];
  overallRating: string;
  overallScore: number; // 0-100
  insight: string;
}

// Sector average data for US tech companies
export const SECTOR_AVERAGES: Record<string, Record<string, { median: number; p25: number; p75: number }>> = {
  TECH: {
    grossMargin: { median: 60, p25: 50, p75: 70 },
    operatingMargin: { median: 22, p25: 12, p75: 35 },
    netMargin: { median: 18, p25: 8, p75: 28 },
    roe: { median: 25, p25: 12, p75: 45 },
    roa: { median: 10, p25: 5, p75: 18 },
    revenueGrowth: { median: 12, p25: 5, p75: 25 },
    fcfMargin: { median: 18, p25: 8, p75: 30 },
    debtToEquity: { median: 0.6, p25: 0.2, p75: 1.2 },
    currentRatio: { median: 2.0, p25: 1.3, p75: 3.5 },
    peRatio: { median: 28, p25: 18, p75: 45 },
    evEbitda: { median: 18, p25: 12, p75: 28 },
  },
  FINANCE: {
    grossMargin: { median: 100, p25: 95, p75: 100 },
    operatingMargin: { median: 35, p25: 25, p75: 45 },
    netMargin: { median: 25, p25: 18, p75: 35 },
    roe: { median: 12, p25: 8, p75: 18 },
    roa: { median: 1.2, p25: 0.8, p75: 1.5 },
    revenueGrowth: { median: 8, p25: 3, p75: 15 },
    fcfMargin: { median: 20, p25: 10, p75: 35 },
    debtToEquity: { median: 2.5, p25: 1.5, p75: 5.0 },
    currentRatio: { median: 1.1, p25: 0.8, p75: 1.5 },
    peRatio: { median: 12, p25: 8, p75: 18 },
    evEbitda: { median: 8, p25: 5, p75: 12 },
  },
  // Feature #7: EGX-calibrated defaults (P/E ~7-12x trailing on EGX30)
  DEFAULT: {
    grossMargin: { median: 45, p25: 30, p75: 60 },
    operatingMargin: { median: 15, p25: 8, p75: 25 },
    netMargin: { median: 10, p25: 5, p75: 18 },
    roe: { median: 15, p25: 8, p75: 25 },
    roa: { median: 6, p25: 3, p75: 12 },
    revenueGrowth: { median: 8, p25: 3, p75: 15 },
    fcfMargin: { median: 12, p25: 5, p75: 22 },
    debtToEquity: { median: 0.8, p25: 0.3, p75: 1.5 },
    currentRatio: { median: 1.5, p25: 1.0, p75: 2.5 },
    peRatio: { median: 9, p25: 5, p75: 15 },
    evEbitda: { median: 7, p25: 4, p75: 12 },
  },
};

export function getPercentile(value: number, p25: number, median: number, p75: number, lowerIsBetter: boolean = false): number {
  if (lowerIsBetter) {
    if (value <= p25) return 85;
    if (value <= median) return 65;
    if (value <= p75) return 35;
    return 15;
  }
  if (value >= p75) return 85;
  if (value >= median) return 65;
  if (value >= p25) return 35;
  return 15;
}

export function getRating(percentile: number): 'top' | 'above' | 'average' | 'below' | 'bottom' {
  if (percentile >= 80) return 'top';
  if (percentile >= 60) return 'above';
  if (percentile >= 40) return 'average';
  if (percentile >= 20) return 'below';
  return 'bottom';
}

export function calculateSectorBenchmarks(
  financialData: FinancialData,
  sector: string = 'TECH'
): SectorBenchmarkResult {
  const sectorData = SECTOR_AVERAGES[sector] || SECTOR_AVERAGES.DEFAULT;
  const { incomeStatement, balanceSheet, cashFlowStatement, currentStockPrice, sharesOutstanding } = financialData;

  const revenue = incomeStatement.revenue || 1;
  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const marketCap = currentStockPrice * sharesOutstanding;
  const ebitda = incomeStatement.operatingIncome + incomeStatement.depreciation + incomeStatement.amortization;
  const ev = marketCap + totalDebt - balanceSheet.cash;

  const metrics = {
    grossMargin: ((revenue - incomeStatement.costOfGoodsSold) / revenue) * 100,
    operatingMargin: (incomeStatement.operatingIncome / revenue) * 100,
    netMargin: (incomeStatement.netIncome / revenue) * 100,
    roe: balanceSheet.totalEquity > 0 ? (incomeStatement.netIncome / balanceSheet.totalEquity) * 100 : 0,
    roa: balanceSheet.totalAssets > 0 ? (incomeStatement.netIncome / balanceSheet.totalAssets) * 100 : 0,
    fcfMargin: (cashFlowStatement.freeCashFlow / revenue) * 100,
    debtToEquity: balanceSheet.totalEquity > 0 ? totalDebt / balanceSheet.totalEquity : 0,
    currentRatio: balanceSheet.totalCurrentLiabilities > 0 ? balanceSheet.totalCurrentAssets / balanceSheet.totalCurrentLiabilities : 0,
    peRatio: incomeStatement.netIncome > 0 ? marketCap / incomeStatement.netIncome : 0,
    evEbitda: ebitda > 0 ? ev / ebitda : 0,
  };

  const metricLabels: Record<string, { name: string; format: (v: number) => string; lowerIsBetter?: boolean }> = {
    grossMargin: { name: 'Gross Margin', format: (v) => `${v.toFixed(1)}%` },
    operatingMargin: { name: 'Operating Margin', format: (v) => `${v.toFixed(1)}%` },
    netMargin: { name: 'Net Margin', format: (v) => `${v.toFixed(1)}%` },
    roe: { name: 'Return on Equity', format: (v) => `${v.toFixed(1)}%` },
    roa: { name: 'Return on Assets', format: (v) => `${v.toFixed(1)}%` },
    fcfMargin: { name: 'FCF Margin', format: (v) => `${v.toFixed(1)}%` },
    debtToEquity: { name: 'Debt / Equity', format: (v) => `${v.toFixed(2)}x`, lowerIsBetter: true },
    currentRatio: { name: 'Current Ratio', format: (v) => `${v.toFixed(2)}x` },
    peRatio: { name: 'P/E Ratio', format: (v) => `${v.toFixed(1)}x`, lowerIsBetter: true },
    evEbitda: { name: 'EV/EBITDA', format: (v) => `${v.toFixed(1)}x`, lowerIsBetter: true },
  };

  const benchmarks: SectorBenchmark[] = [];

  for (const [key, config] of Object.entries(metricLabels)) {
    const companyVal = metrics[key as keyof typeof metrics];
    const sectorMetric = sectorData[key];
    if (!sectorMetric) continue;

    const pct = getPercentile(companyVal, sectorMetric.p25, sectorMetric.median, sectorMetric.p75, config.lowerIsBetter);
    benchmarks.push({
      metric: config.name,
      companyValue: companyVal,
      sectorMedian: sectorMetric.median,
      percentile: pct,
      rating: getRating(pct),
      formatted: { company: config.format(companyVal), sector: config.format(sectorMetric.median) },
    });
  }

  const overallScore = Math.round(benchmarks.reduce((sum, b) => sum + b.percentile, 0) / benchmarks.length);
  let overallRating = 'Average';
  let insight = '';

  if (overallScore >= 75) {
    overallRating = 'Excellent — Quality at Premium';
    insight = 'This company outperforms the sector on most metrics. Premium valuation may be justified by superior fundamentals.';
  } else if (overallScore >= 55) {
    overallRating = 'Above Average';
    insight = 'The company performs better than most peers across key metrics. Moderate premium may be warranted.';
  } else if (overallScore >= 40) {
    overallRating = 'Average';
    insight = 'The company performs in line with sector averages. Valuation should be close to sector multiples.';
  } else {
    overallRating = 'Below Average';
    insight = 'The company underperforms sector peers on several metrics. A discount to sector multiples may be appropriate.';
  }

  return { benchmarks, overallRating, overallScore, insight };
}

// ============================================
// 4. QUALITY / ESG SCORECARD
// Economic moat, management quality, financial health
// ============================================

export interface QualityScore {
  category: string;
  score: number; // 0-10
  maxScore: number;
  factors: { name: string; score: number; maxScore: number; detail: string }[];
}

export interface QualityScorecard {
  economicMoat: QualityScore;
  financialHealth: QualityScore;
  growthProfile: QualityScore;
  capitalAllocation: QualityScore;
  totalScore: number;
  maxTotalScore: number;
  grade: string; // A, B, C, D, F
  qualityPremium: number; // % adjustment to valuation
}

export function calculateQualityScorecard(financialData: FinancialData, sector: string = 'TECH'): QualityScorecard {
  const { incomeStatement, balanceSheet, cashFlowStatement } = financialData;
  const revenue = incomeStatement.revenue || 1;
  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;

  // ECONOMIC MOAT (out of 10)
  const grossMargin = ((revenue - incomeStatement.costOfGoodsSold) / revenue) * 100;
  const operatingMargin = (incomeStatement.operatingIncome / revenue) * 100;
  const roe = balanceSheet.totalEquity > 0 ? (incomeStatement.netIncome / balanceSheet.totalEquity) * 100 : 0;

  const moatFactors = [
    {
      name: 'Gross Margin',
      score: grossMargin > 60 ? 3 : grossMargin > 40 ? 2 : grossMargin > 20 ? 1 : 0,
      maxScore: 3,
      detail: `${grossMargin.toFixed(1)}% — ${grossMargin > 60 ? 'Wide moat pricing power' : grossMargin > 40 ? 'Moderate pricing power' : 'Limited moat'}`,
    },
    {
      name: 'Operating Margin',
      score: operatingMargin > 30 ? 3 : operatingMargin > 15 ? 2 : operatingMargin > 5 ? 1 : 0,
      maxScore: 3,
      detail: `${operatingMargin.toFixed(1)}% — ${operatingMargin > 30 ? 'Strong operational efficiency' : 'Average efficiency'}`,
    },
    {
      name: 'Return on Equity',
      score: roe > 25 ? 2 : roe > 15 ? 1.5 : roe > 8 ? 1 : 0,
      maxScore: 2,
      detail: `${roe.toFixed(1)}% — ${roe > 25 ? 'Excellent capital returns' : roe > 15 ? 'Good returns' : 'Weak returns'}`,
    },
    {
      name: 'Market Position',
      score: revenue > 100e9 ? 2 : revenue > 10e9 ? 1.5 : revenue > 1e9 ? 1 : 0.5,
      maxScore: 2,
      detail: `$${(revenue / 1e9).toFixed(1)}B revenue — ${revenue > 100e9 ? 'Market leader' : revenue > 10e9 ? 'Major player' : 'Small cap'}`,
    },
  ];

  // FINANCIAL HEALTH (out of 10)
  const currentRatio = balanceSheet.totalCurrentLiabilities > 0 ? balanceSheet.totalCurrentAssets / balanceSheet.totalCurrentLiabilities : 0;
  const debtToEquity = balanceSheet.totalEquity > 0 ? totalDebt / balanceSheet.totalEquity : 99;
  const interestCoverage = incomeStatement.interestExpense > 0 ? incomeStatement.operatingIncome / incomeStatement.interestExpense : 999;
  const cashRatio = totalDebt > 0 ? balanceSheet.cash / totalDebt : 99;

  // SECTOR SPECIFIC LOGIC: Tech companies run leaner current ratios
  let crScore = 0;
  let crDetail = '';
  if (sector === 'TECH') {
    crScore = currentRatio > 1.1 ? 2.5 : currentRatio > 1.0 ? 2 : currentRatio > 0.8 ? 1 : 0;
    crDetail = `${currentRatio.toFixed(2)}x — ${currentRatio > 1.1 ? 'Strong liquidity (Tech)' : currentRatio > 1.0 ? 'Adequate (Tech)' : 'Liquidity risk'}`;
  } else {
    crScore = currentRatio > 2 ? 2.5 : currentRatio > 1.5 ? 2 : currentRatio > 1 ? 1 : 0;
    crDetail = `${currentRatio.toFixed(2)}x — ${currentRatio > 2 ? 'Strong liquidity' : currentRatio > 1 ? 'Adequate' : 'Liquidity risk'}`;
  }

  const healthFactors = [
    {
      name: 'Current Ratio',
      score: crScore,
      maxScore: 2.5,
      detail: crDetail,
    },
    {
      name: 'Debt / Equity',
      score: debtToEquity < 0.3 ? 2.5 : debtToEquity < 0.8 ? 2 : debtToEquity < 1.5 ? 1 : 0,
      maxScore: 2.5,
      detail: `${debtToEquity.toFixed(2)}x — ${debtToEquity < 0.3 ? 'Conservative leverage' : debtToEquity < 1 ? 'Moderate' : 'High leverage'}`,
    },
    {
      name: 'Interest Coverage',
      score: interestCoverage > 10 ? 2.5 : interestCoverage > 5 ? 2 : interestCoverage > 2 ? 1 : 0,
      maxScore: 2.5,
      detail: `${interestCoverage > 100 ? '99+' : interestCoverage.toFixed(1)}x — ${interestCoverage > 10 ? 'Easily covers obligations' : 'Watch carefully'}`,
    },
    {
      name: 'Cash / Debt',
      score: cashRatio > 1 ? 2.5 : cashRatio > 0.5 ? 2 : cashRatio > 0.2 ? 1 : 0,
      maxScore: 2.5,
      detail: `${cashRatio > 10 ? '10+' : cashRatio.toFixed(2)}x — ${cashRatio > 1 ? 'Net cash position' : cashRatio > 0.5 ? 'Good cash reserves' : 'Limited cash buffer'}`,
    },
  ];

  // GROWTH PROFILE (out of 10)
  const fcfMargin = (cashFlowStatement.freeCashFlow / revenue) * 100;
  const netMargin = (incomeStatement.netIncome / revenue) * 100;

  const growthFactors = [
    {
      name: 'Net Margin',
      score: netMargin > 25 ? 3 : netMargin > 15 ? 2 : netMargin > 5 ? 1 : 0,
      maxScore: 3,
      detail: `${netMargin.toFixed(1)}% — ${netMargin > 25 ? 'Highly profitable' : netMargin > 15 ? 'Solid profitability' : 'Low margins'}`,
    },
    {
      name: 'FCF Generation',
      score: fcfMargin > 25 ? 3.5 : fcfMargin > 15 ? 2.5 : fcfMargin > 5 ? 1.5 : 0,
      maxScore: 3.5,
      detail: `${fcfMargin.toFixed(1)}% margin — ${fcfMargin > 25 ? 'Cash machine' : fcfMargin > 15 ? 'Strong FCF' : 'Needs improvement'}`,
    },
    {
      name: 'Earnings Quality',
      score: cashFlowStatement.operatingCashFlow > incomeStatement.netIncome ? 3.5 : 1.5,
      maxScore: 3.5,
      detail: cashFlowStatement.operatingCashFlow > incomeStatement.netIncome
        ? 'Operating CF exceeds Net Income — high quality'
        : 'Operating CF below Net Income — watch accruals',
    },
  ];

  // CAPITAL ALLOCATION (out of 10)
  const reinvestmentRate = revenue > 0 ? (cashFlowStatement.capitalExpenditures / revenue) * 100 : 0;
  const payoutRatio = cashFlowStatement.freeCashFlow > 0 ? (cashFlowStatement.dividendsPaid / cashFlowStatement.freeCashFlow) * 100 : 0;
  const fcfConversion = incomeStatement.netIncome > 0 ? (cashFlowStatement.freeCashFlow / incomeStatement.netIncome) * 100 : 0;

  const capitalFactors = [
    {
      name: 'CapEx / Revenue',
      score: reinvestmentRate < 5 ? 2 : reinvestmentRate < 15 ? 2.5 : reinvestmentRate < 25 ? 1.5 : 1,
      maxScore: 2.5,
      detail: `${reinvestmentRate.toFixed(1)}% — ${reinvestmentRate < 5 ? 'Asset-light model' : reinvestmentRate < 15 ? 'Balanced investment' : 'Capital intensive'}`,
    },
    {
      name: 'Dividend Payout',
      score: payoutRatio > 20 && payoutRatio < 60 ? 2.5 : payoutRatio < 20 ? 2 : payoutRatio < 80 ? 1.5 : 1,
      maxScore: 2.5,
      detail: `${payoutRatio.toFixed(0)}% of FCF — ${payoutRatio > 20 && payoutRatio < 60 ? 'Balanced payout' : payoutRatio > 80 ? 'High payout risk' : 'Retaining for growth'}`,
    },
    {
      name: 'FCF Conversion',
      score: fcfConversion > 100 ? 2.5 : fcfConversion > 70 ? 2 : fcfConversion > 40 ? 1 : 0,
      maxScore: 2.5,
      detail: `${fcfConversion.toFixed(0)}% of Net Income — ${fcfConversion > 100 ? 'Excellent conversion' : fcfConversion > 70 ? 'Good' : 'Poor conversion'}`,
    },
    {
      name: 'Cash Accumulation',
      score: balanceSheet.cash > totalDebt ? 2.5 : balanceSheet.cash > totalDebt * 0.5 ? 1.5 : 0.5,
      maxScore: 2.5,
      detail: balanceSheet.cash > totalDebt ? 'Net cash — strong balance sheet' : 'Net debt position',
    },
  ];

  const economicMoat: QualityScore = {
    category: 'Economic Moat',
    score: moatFactors.reduce((s, f) => s + f.score, 0),
    maxScore: moatFactors.reduce((s, f) => s + f.maxScore, 0),
    factors: moatFactors,
  };

  const financialHealth: QualityScore = {
    category: 'Financial Health',
    score: healthFactors.reduce((s, f) => s + f.score, 0),
    maxScore: healthFactors.reduce((s, f) => s + f.maxScore, 0),
    factors: healthFactors,
  };

  const growthProfile: QualityScore = {
    category: 'Growth & Profitability',
    score: growthFactors.reduce((s, f) => s + f.score, 0),
    maxScore: growthFactors.reduce((s, f) => s + f.maxScore, 0),
    factors: growthFactors,
  };

  const capitalAllocation: QualityScore = {
    category: 'Capital Allocation',
    score: capitalFactors.reduce((s, f) => s + f.score, 0),
    maxScore: capitalFactors.reduce((s, f) => s + f.maxScore, 0),
    factors: capitalFactors,
  };

  const totalScore = economicMoat.score + financialHealth.score + growthProfile.score + capitalAllocation.score;
  const maxTotalScore = economicMoat.maxScore + financialHealth.maxScore + growthProfile.maxScore + capitalAllocation.maxScore;
  const percentage = (totalScore / maxTotalScore) * 100;

  let grade: string;
  let qualityPremium: number;

  if (percentage >= 85) { grade = 'A+'; qualityPremium = 15; }
  else if (percentage >= 75) { grade = 'A'; qualityPremium = 10; }
  else if (percentage >= 65) { grade = 'B+'; qualityPremium = 5; }
  else if (percentage >= 55) { grade = 'B'; qualityPremium = 0; }
  else if (percentage >= 45) { grade = 'C'; qualityPremium = -5; }
  else if (percentage >= 35) { grade = 'D'; qualityPremium = -10; }
  else { grade = 'F'; qualityPremium = -15; }

  return {
    economicMoat,
    financialHealth,
    growthProfile,
    capitalAllocation,
    totalScore: Math.round(totalScore * 10) / 10,
    maxTotalScore,
    grade,
    qualityPremium,
  };
}
