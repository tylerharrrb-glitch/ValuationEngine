/**
 * Scenario analysis utilities.
 * V2.3: Uses shared SCENARIO_PARAMS for consistency across all outputs.
 */
import { FinancialData, ValuationAssumptions } from '../../types/financial';
import { calculateDCFProjections, calculateDCFValue } from './dcf';
import { SCENARIO_PARAMS } from '../constants/scenarioParams';

/** Bull/Bear/Base case results with detail */
export interface ScenarioCases {
  bear: number;
  base: number;
  bull: number;
  bearDetail: { growth: number; wacc: number; termG: number };
  bullDetail: { growth: number; wacc: number; termG: number };
}

/**
 * Calculate a single scenario DCF price using SCENARIO_PARAMS.
 * Uses per-year margin adjustment (not flat) for accuracy.
 */
export function calcScenarioPrice(
  financialData: FinancialData,
  baseAssumptions: ValuationAssumptions,
  scenario: 'bear' | 'base' | 'bull'
): { price: number; growth: number; wacc: number; termG: number } {
  const p = SCENARIO_PARAMS[scenario];
  const growth = baseAssumptions.revenueGrowthRate * p.revenueGrowthMultiplier;
  const wacc = Math.max(2, baseAssumptions.discountRate + p.waccAdjustmentPP);
  const termG = baseAssumptions.terminalGrowthRate * p.terminalGrowthMultiplier;

  // Clamp terminal growth < WACC
  const clampedTermG = Math.min(termG, wacc - 1);

  // Build scenario assumptions with per-year margin adjustment
  const scenarioAssumptions: ValuationAssumptions = {
    ...baseAssumptions,
    revenueGrowthRate: growth,
    discountRate: wacc,
    terminalGrowthRate: clampedTermG,
  };

  // If there's per-year margin adjustment, we need custom projections
  if (p.marginAdjPerYear !== 0) {
    const projections = [];
    let currentRevenue = financialData.incomeStatement.revenue;
    const taxRate = scenarioAssumptions.taxRate / 100;
    const waccDec = wacc / 100;

    for (let i = 1; i <= scenarioAssumptions.projectionYears; i++) {
      const prevRevenue = currentRevenue;
      currentRevenue = currentRevenue * (1 + growth / 100);

      // Per-year margin adjustment
      const adjMargin = scenarioAssumptions.ebitdaMargin + (p.marginAdjPerYear * 100 * i);
      const ebitda = currentRevenue * (adjMargin / 100);
      const dAndA = currentRevenue * (scenarioAssumptions.daPercent / 100);
      const ebit = ebitda - dAndA;
      const nopat = ebit * (1 - taxRate);
      const capex = currentRevenue * (scenarioAssumptions.capexPercent / 100);
      const deltaWC = (currentRevenue - prevRevenue) * (scenarioAssumptions.deltaWCPercent / 100);
      const fcff = nopat + dAndA - capex - deltaWC;

      const period = scenarioAssumptions.discountingConvention === 'mid_year' ? i - 0.5 : i;
      const discountFactor = Math.pow(1 + waccDec, period);

      projections.push({
        year: new Date().getFullYear() + i,
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

    const price = calculateDCFValue(projections, scenarioAssumptions, financialData);
    return { price, growth, wacc, termG: clampedTermG };
  }

  // No margin adjustment (base case) — use standard projection
  const projections = calculateDCFProjections(financialData, scenarioAssumptions);
  const price = calculateDCFValue(projections, scenarioAssumptions, financialData);
  return { price, growth, wacc, termG: clampedTermG };
}

/**
 * Calculate Bull/Bear/Base case valuations.
 * C1 Fix: Single source of truth via SCENARIO_PARAMS.
 */
export function calculateScenarioCases(
  financialData: FinancialData,
  adjustedAssumptions: ValuationAssumptions,
  dcfValue: number
): ScenarioCases {
  const bearResult = calcScenarioPrice(financialData, adjustedAssumptions, 'bear');
  const bullResult = calcScenarioPrice(financialData, adjustedAssumptions, 'bull');

  return {
    bear: bearResult.price,
    base: dcfValue,
    bull: bullResult.price,
    bearDetail: { growth: bearResult.growth, wacc: bearResult.wacc, termG: bearResult.termG },
    bullDetail: { growth: bullResult.growth, wacc: bullResult.wacc, termG: bullResult.termG },
  };
}
