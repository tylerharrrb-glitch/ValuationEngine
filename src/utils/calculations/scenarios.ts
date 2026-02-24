/**
 * Scenario analysis utilities.
 * Bull/Bear/Base case calculations with probability weighting.
 * REWRITTEN: Uses spec Section 8.2 parameter deltas
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
 * Spec Section 8.2:
 *   Bear: Rev Growth -5%, EBITDA Margin -3%, Terminal Growth -1%, WACC +1%
 *   Base: As entered
 *   Bull: Rev Growth +5%, EBITDA Margin +3%, Terminal Growth +1%, WACC -1%
 */
export function calculateScenarioCases(
  financialData: FinancialData,
  adjustedAssumptions: ValuationAssumptions,
  dcfValue: number
): ScenarioCases {
  // Bear: reduced growth, reduced margins, higher discount rate
  const bear = calculateScenarioDCF(financialData, adjustedAssumptions, 0.667, 1.0, 0.875, -3.0);
  const base = dcfValue;
  // Bull: more growth, better margins, lower discount rate
  const bull = calculateScenarioDCF(financialData, adjustedAssumptions, 1.333, -1.0, 1.125, 3.0);

  return { bear, base, bull };
}
