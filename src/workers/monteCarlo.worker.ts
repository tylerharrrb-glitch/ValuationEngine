/* eslint-disable no-restricted-globals */
import { FinancialData, ValuationAssumptions } from '../types/financial';

// Gaussian random helper (Box-Muller transform)
function gaussianRandom(): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

// Monte Carlo Logic
// Copied and adapted from advancedAnalysis.ts to run in isolated thread
function runSimulation(
  financialData: FinancialData,
  assumptions: ValuationAssumptions,
  numSimulations: number = 5000
) {
  const results: number[] = [];
  const baseFCFMargin = financialData.incomeStatement.revenue > 0
    ? financialData.cashFlowStatement.freeCashFlow / financialData.incomeStatement.revenue
    : 0.15;

  for (let sim = 0; sim < numSimulations; sim++) {
    // Add random variation to key parameters
    const revGrowthVar = assumptions.revenueGrowthRate + gaussianRandom() * 4;  // ±4% std dev
    const waccVar = Math.max(2, assumptions.discountRate + gaussianRandom() * 1.5); // ±1.5% std dev
    const termGrowthVar = Math.max(0, Math.min(waccVar - 0.5, assumptions.terminalGrowthRate + gaussianRandom() * 0.8)); // ±0.8% std dev
    const marginVar = assumptions.marginImprovement + gaussianRandom() * 0.5; // ±0.5% std dev

    let revenue = financialData.incomeStatement.revenue;
    let sumPV = 0;
    let lastFCF = 0;

    for (let yr = 1; yr <= assumptions.projectionYears; yr++) {
      revenue = revenue * (1 + revGrowthVar / 100);
      const margin = baseFCFMargin + (marginVar / 100) * yr;
      const fcf = revenue * Math.max(margin, 0.01);
      const df = Math.pow(1 + waccVar / 100, yr);
      sumPV += fcf / df;
      lastFCF = fcf;
    }

    let tv = 0;
    if (waccVar > termGrowthVar && waccVar - termGrowthVar > 0.1) {
      tv = (lastFCF * (1 + termGrowthVar / 100)) / ((waccVar - termGrowthVar) / 100);
    } else {
      tv = lastFCF * 12; // Fallback multiple
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

  // Calculate Statistics
  results.sort((a, b) => a - b);
  const n = results.length;

  if (n === 0) {
    return {
      simulations: numSimulations,
      meanPrice: 0, medianPrice: 0, stdDev: 0,
      percentile5: 0, percentile25: 0, percentile75: 0, percentile95: 0,
      probabilityAboveCurrentPrice: 0, probabilityAboveBaseCase: 0,
      distribution: [],
    };
  }

  const mean = results.reduce((a, b) => a + b, 0) / n;
  const variance = results.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);
  const median = n % 2 === 0 ? (results[n/2 - 1] + results[n/2]) / 2 : results[Math.floor(n/2)];
  const p5 = results[Math.floor(n * 0.05)];
  const p25 = results[Math.floor(n * 0.25)];
  const p75 = results[Math.floor(n * 0.75)];
  const p95 = results[Math.floor(n * 0.95)];

  const aboveCurrentPrice = results.filter(p => p > financialData.currentStockPrice).length;
  const probabilityAboveCurrentPrice = (aboveCurrentPrice / n) * 100;

  // Bucket distribution
  const minPrice = results[0];
  const maxPrice = results[n - 1];
  const range = maxPrice - minPrice;
  const bucketCount = 20;
  const bucketWidth = range / bucketCount;
  const distribution: { bucket: string; count: number; percentage: number }[] = [];

  for (let i = 0; i < bucketCount; i++) {
    const low = minPrice + i * bucketWidth;
    const high = low + bucketWidth;
    // Fast count
    let count = 0;
    // Since results are sorted, we could optimize this, but filter is okay for 5000 items in a worker
    count = results.filter(p => p >= low && p < high).length;
    
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
    probabilityAboveBaseCase: 0, // Simplified, skipping base case recalc in worker for now to save payload size
    distribution, 
  };
}

// Event Listener
self.onmessage = (e: MessageEvent) => {
  const { financialData, assumptions } = e.data;
  if (!financialData || !assumptions) return;

  try {
    const result = runSimulation(financialData, assumptions);
    self.postMessage({ success: true, result });
  } catch (err) {
    self.postMessage({ success: false, error: (err as Error).message });
  }
};
