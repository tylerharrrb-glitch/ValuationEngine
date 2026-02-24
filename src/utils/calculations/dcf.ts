/**
 * DCF (Discounted Cash Flow) calculation utilities.
 * All functions are pure — no React dependencies.
 * REWRITTEN: Uses proper FCFF formula (NOPAT + D&A − CapEx − ΔWC)
 */
import { FinancialData, ValuationAssumptions, DCFProjection } from '../../types/financial';

/**
 * Calculate DCF projections for each year using proper FCFF methodology.
 * Projects: Revenue → EBITDA → D&A → EBIT → NOPAT → CapEx → ΔWC → FCFF
 */
export function calculateDCFProjections(
  financialData: FinancialData,
  adjustedAssumptions: ValuationAssumptions
): DCFProjection[] {
  const projections: DCFProjection[] = [];
  let currentRevenue = financialData.incomeStatement.revenue;
  const taxRate = adjustedAssumptions.taxRate / 100;
  const wacc = adjustedAssumptions.discountRate / 100;

  for (let i = 1; i <= adjustedAssumptions.projectionYears; i++) {
    const prevRevenue = currentRevenue;
    currentRevenue = currentRevenue * (1 + adjustedAssumptions.revenueGrowthRate / 100);

    const ebitda = currentRevenue * (adjustedAssumptions.ebitdaMargin / 100);
    const dAndA = currentRevenue * (adjustedAssumptions.daPercent / 100);
    const ebit = ebitda - dAndA;
    const nopat = ebit * (1 - taxRate);
    const capex = currentRevenue * (adjustedAssumptions.capexPercent / 100);
    const deltaWC = (currentRevenue - prevRevenue) * (adjustedAssumptions.deltaWCPercent / 100);
    const fcff = nopat + dAndA - capex - deltaWC;

    // Discount factor based on convention
    const period = adjustedAssumptions.discountingConvention === 'mid_year' ? i - 0.5 : i;
    const discountFactor = Math.pow(1 + wacc, period);

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
  return projections;
}

/**
 * Calculate per-share DCF value from projections.
 * BUG FIX: No MAX(0) floor on equity value.
 */
export function calculateDCFValue(
  dcfProjections: DCFProjection[],
  adjustedAssumptions: ValuationAssumptions,
  financialData: FinancialData
): number {
  const sumPV = dcfProjections.reduce((sum, p) => sum + p.presentValue, 0);
  const lastFCF = dcfProjections[dcfProjections.length - 1]?.freeCashFlow || 0;
  const wacc = adjustedAssumptions.discountRate / 100;
  const termGrowth = adjustedAssumptions.terminalGrowthRate / 100;

  let terminalValue = 0;
  if (adjustedAssumptions.terminalMethod === 'exit_multiple') {
    const lastEBITDA = dcfProjections[dcfProjections.length - 1]?.ebitda || 0;
    terminalValue = lastEBITDA * adjustedAssumptions.exitMultiple;
  } else if (wacc > termGrowth) {
    terminalValue = (lastFCF * (1 + termGrowth)) / (wacc - termGrowth);
  }

  const lastDiscountFactor = Math.pow(1 + wacc, adjustedAssumptions.projectionYears);
  const pvTerminal = terminalValue / lastDiscountFactor;
  const enterpriseValue = sumPV + pvTerminal;
  const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const equityValue = enterpriseValue - totalDebt + financialData.balanceSheet.cash;
  // BUG FIX: No MAX(0) floor — equity can be negative for distressed companies
  return equityValue / financialData.sharesOutstanding;
}

/**
 * Calculate DCF with custom scenario adjustments.
 * Used for bull/bear/base cases, style comparison, and sensitivity analysis.
 */
export function calculateScenarioDCF(
  financialData: FinancialData,
  adjustedAssumptions: ValuationAssumptions,
  revGrowthMult: number,
  waccAdd: number,
  termGrowthMult: number,
  marginAdd: number
): number {
  const scenarioAssumptions = { ...adjustedAssumptions };
  scenarioAssumptions.revenueGrowthRate = adjustedAssumptions.revenueGrowthRate * revGrowthMult;
  scenarioAssumptions.discountRate = Math.max(adjustedAssumptions.discountRate + waccAdd, 2);
  scenarioAssumptions.terminalGrowthRate = adjustedAssumptions.terminalGrowthRate * termGrowthMult;
  scenarioAssumptions.ebitdaMargin = adjustedAssumptions.ebitdaMargin + marginAdd;

  // Ensure g < WACC
  if (scenarioAssumptions.terminalGrowthRate >= scenarioAssumptions.discountRate) {
    scenarioAssumptions.terminalGrowthRate = scenarioAssumptions.discountRate - 1;
  }

  const projections = calculateDCFProjections(financialData, scenarioAssumptions);
  return calculateDCFValue(projections, scenarioAssumptions, financialData);
}
