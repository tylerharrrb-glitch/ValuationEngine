/**
 * Scenario analysis utilities.
 * Bull/Bear/Base case calculations.
 */
import { FinancialData, ValuationAssumptions } from '../../types/financial';
import { calculateScenarioDCF } from './dcf';

/** Bull/Bear/Base case results */
export interface ScenarioCases {
  bear: number;
  base: number;
  bull: number;
}

/**
 * Calculate Bull/Bear/Base case valuations.
 * Bear = recession scenario, Bull = strong growth scenario.
 */
export function calculateScenarioCases(
  financialData: FinancialData,
  adjustedAssumptions: ValuationAssumptions,
  dcfValue: number
): ScenarioCases {
  const bear = calculateScenarioDCF(financialData, adjustedAssumptions, 0.4, 2.5, 0.6, -1.5);
  const base = dcfValue; // Already calculated
  // More aggressive bull case: 2x growth, -2.5% WACC, 1.4x terminal growth, +2.5% margin
  const bull = calculateScenarioDCF(financialData, adjustedAssumptions, 2.0, -2.5, 1.5, 2.5);
  
  return { bear, base, bull };
}
