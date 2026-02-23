/**
 * DCF (Discounted Cash Flow) calculation utilities.
 * All functions are pure — no React dependencies.
 */
import { FinancialData, ValuationAssumptions, DCFProjection } from '../../types/financial';

/**
 * Calculate DCF projections for each year.
 * Projects revenue, EBITDA, FCF, discount factors, and present values.
 */
export function calculateDCFProjections(
  financialData: FinancialData,
  adjustedAssumptions: ValuationAssumptions
): DCFProjection[] {
  const projections: DCFProjection[] = [];
  let currentRevenue = financialData.incomeStatement.revenue;
  const baseMargin = financialData.cashFlowStatement.freeCashFlow / financialData.incomeStatement.revenue;
  
  for (let i = 1; i <= adjustedAssumptions.projectionYears; i++) {
    currentRevenue = currentRevenue * (1 + adjustedAssumptions.revenueGrowthRate / 100);
    const margin = baseMargin + (adjustedAssumptions.marginImprovement / 100) * i;
    const ebitda = currentRevenue * (financialData.incomeStatement.operatingIncome + 
      financialData.incomeStatement.depreciation + financialData.incomeStatement.amortization) / 
      financialData.incomeStatement.revenue;
    const fcf = currentRevenue * margin;
    const discountFactor = Math.pow(1 + adjustedAssumptions.discountRate / 100, i);
    
    projections.push({
      year: new Date().getFullYear() + i,
      revenue: currentRevenue,
      ebitda: ebitda,
      freeCashFlow: fcf,
      discountFactor: discountFactor,
      presentValue: fcf / discountFactor,
    });
  }
  return projections;
}

/**
 * Calculate per-share DCF value from projections.
 * Computes terminal value, enterprise value, then equity value per share.
 */
export function calculateDCFValue(
  dcfProjections: DCFProjection[],
  adjustedAssumptions: ValuationAssumptions,
  financialData: FinancialData
): number {
  const sumPV = dcfProjections.reduce((sum, p) => sum + p.presentValue, 0);
  const lastFCF = dcfProjections[dcfProjections.length - 1]?.freeCashFlow || 0;
  const terminalValue = (lastFCF * (1 + adjustedAssumptions.terminalGrowthRate / 100)) / 
    ((adjustedAssumptions.discountRate - adjustedAssumptions.terminalGrowthRate) / 100);
  const lastDiscountFactor = dcfProjections[dcfProjections.length - 1]?.discountFactor || 1;
  const pvTerminal = terminalValue / lastDiscountFactor;
  const enterpriseValue = sumPV + pvTerminal;
  const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const equityValue = enterpriseValue - totalDebt + financialData.balanceSheet.cash;
  return Math.max(equityValue / financialData.sharesOutstanding, 0);
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
  const scenarioRevGrowth = adjustedAssumptions.revenueGrowthRate * revGrowthMult;
  const scenarioWACC = Math.max(adjustedAssumptions.discountRate + waccAdd, 2);
  const scenarioTermGrowth = adjustedAssumptions.terminalGrowthRate * termGrowthMult;
  const baseMargin = financialData.cashFlowStatement.freeCashFlow / financialData.incomeStatement.revenue;
  
  let revenue = financialData.incomeStatement.revenue;
  let sumPV = 0;
  let lastFCF = 0;
  
  for (let yr = 1; yr <= adjustedAssumptions.projectionYears; yr++) {
    revenue = revenue * (1 + scenarioRevGrowth / 100);
    const margin = baseMargin + ((adjustedAssumptions.marginImprovement + marginAdd) / 100) * yr;
    const fcf = revenue * margin;
    const df = Math.pow(1 + scenarioWACC / 100, yr);
    sumPV += fcf / df;
    lastFCF = fcf;
  }
  
  let tv = 0;
  if (scenarioWACC > scenarioTermGrowth) {
    tv = (lastFCF * (1 + scenarioTermGrowth / 100)) / ((scenarioWACC - scenarioTermGrowth) / 100);
  } else {
    tv = lastFCF * 12;
  }
  const lastDF = Math.pow(1 + scenarioWACC / 100, adjustedAssumptions.projectionYears);
  const ev = sumPV + tv / lastDF;
  const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const equity = Math.max(ev - totalDebt + financialData.balanceSheet.cash, 0);
  return Math.max(equity / financialData.sharesOutstanding, 0);
}
