/**
 * Valuation calculations hook.
 * Computes all derived valuation data from financial inputs and assumptions.
 */
import { useMemo } from 'react';
import { FinancialData, ValuationAssumptions, ComparableCompany, DCFProjection, MarketRegion } from '../types/financial';
import { ScenarioType, scenarioMultipliers } from '../components/ScenarioToggle';
import { VALUATION_STYLES, ValuationStyleKey } from '../constants/valuationStyles';
import { DEFAULT_INDUSTRY_MULTIPLES, EGYPTIAN_INDUSTRY_MULTIPLES } from '../constants/marketDefaults';
import { getIndustryForTicker, getEgyptianIndustryForTicker } from '../utils/industryMapping';
import { calculateDCFProjections, calculateDCFValue, calculateScenarioDCF } from '../utils/calculations/dcf';
import { calculateComparableValuations, ComparableValuations, IndustryMultiples } from '../utils/calculations/comparables';
import { calculateKeyMetrics, getRecommendation, KeyMetrics, Recommendation } from '../utils/calculations/metrics';
import { calculateScenarioCases, ScenarioCases } from '../utils/calculations/scenarios';
import { CurrencyCode, getCurrencyFromMarket } from '../utils/formatters';
import { calculateDDM } from '../utils/valuationEngine';

export interface UseValuationCalculationsReturn {
  adjustedAssumptions: ValuationAssumptions;
  dcfProjections: DCFProjection[];
  dcfValue: number;
  scenarioCases: ScenarioCases;
  industryMultiples: IndustryMultiples;
  currentIndustry: string;
  comparableValuations: ComparableValuations;
  hasValidComparables: boolean;
  comparableValue: number;
  blendedValue: number;
  upside: number;
  compsWeight: number;
  keyMetrics: KeyMetrics;
  recommendation: Recommendation;
  currency: CurrencyCode;
  footballFieldData: { method: string; low: number; mid: number; high: number; color: string }[];
  probabilityWeightedEV: number;
  revenueProjectionData: { year: string; Revenue: number; FCF: number; EBITDA: number }[];
  valuationComparisonData: { name: string; value: number; fill: string }[];
}

/**
 * Computes all valuation-related derived data.
 * Uses useMemo for performance — recalculates only when inputs change.
 */
export function useValuationCalculations(
  financialData: FinancialData,
  assumptions: ValuationAssumptions,
  comparables: ComparableCompany[],
  scenario: ScenarioType,
  valuationStyle: ValuationStyleKey,
  dcfWeight: number,
  marketRegion: MarketRegion
): UseValuationCalculationsReturn {
  // Get currency based on market region
  const currency: CurrencyCode = getCurrencyFromMarket(marketRegion).code;

  // Calculate adjusted assumptions based on scenario AND valuation style
  const adjustedAssumptions = useMemo(() => {
    const multipliers = scenarioMultipliers[scenario];
    const style = VALUATION_STYLES[valuationStyle];

    // Apply both scenario AND style adjustments
    const baseRevGrowth = assumptions.revenueGrowthRate * multipliers.revenueGrowth;
    const baseWACC = assumptions.discountRate * multipliers.wacc;
    const baseTermGrowth = assumptions.terminalGrowthRate * multipliers.terminalGrowth;
    const baseMargin = assumptions.marginImprovement + multipliers.marginChange * 100;

    const adjusted = {
      ...assumptions,
      revenueGrowthRate: baseRevGrowth * style.revenueGrowthMult,
      discountRate: Math.max(2, baseWACC + style.waccAdd),
      terminalGrowthRate: baseTermGrowth * style.terminalGrowthMult,
      marginImprovement: baseMargin + style.marginChange,
    };

    // Terminal growth must be < WACC (hard requirement for Gordon Growth Model).
    // No artificial cap — user's input is the single source of truth (Fix C5).
    // The engine, PDF, Excel, and JSON all use this same value.
    if (adjusted.terminalGrowthRate >= adjusted.discountRate) {
      console.warn(`[WOLF] Terminal growth (${adjusted.terminalGrowthRate.toFixed(1)}%) ≥ WACC (${adjusted.discountRate.toFixed(1)}%) — clamping to WACC-1%`);
      adjusted.terminalGrowthRate = adjusted.discountRate - 1;
    }

    return adjusted;
  }, [assumptions, scenario, valuationStyle, marketRegion]);

  // DCF Calculations
  const dcfProjections = useMemo(
    () => calculateDCFProjections(financialData, adjustedAssumptions),
    [financialData, adjustedAssumptions]
  );

  // DCF Value calculation
  const dcfValue = useMemo(
    () => calculateDCFValue(dcfProjections, adjustedAssumptions, financialData),
    [dcfProjections, adjustedAssumptions, financialData]
  );

  // Bull/Bear/Base Case Valuations
  const scenarioCases = useMemo(
    () => calculateScenarioCases(financialData, adjustedAssumptions, dcfValue),
    [financialData, adjustedAssumptions, dcfValue]
  );

  // Get industry for current ticker - uses Egyptian multiples when Egypt is selected
  const currentIndustry = getIndustryForTicker(financialData.ticker);
  const industryMultiples = useMemo((): IndustryMultiples => {
    if (marketRegion === 'Egypt' || financialData.ticker.toUpperCase().endsWith('.CA')) {
      const egIndustry = getEgyptianIndustryForTicker(financialData.ticker);
      return EGYPTIAN_INDUSTRY_MULTIPLES[egIndustry];
    }
    return DEFAULT_INDUSTRY_MULTIPLES[currentIndustry];
  }, [financialData.ticker, marketRegion, currentIndustry]);

  // Comparable valuation
  const comparableValuations = useMemo(
    () => calculateComparableValuations(
      comparables,
      financialData,
      industryMultiples,
      VALUATION_STYLES[valuationStyle].multipleMult,
      financialData.sector
    ),
    [comparables, financialData, industryMultiples, valuationStyle]
  );

  // Check if we have valid comparables for blending
  const hasValidComparables = comparableValuations.hasUserComps;

  // Use the blended comps value
  const comparableValue = comparableValuations.blendedComps;

  // Blended value - uses adjustable weight slider
  const compsWeight = 100 - dcfWeight;
  const blendedValue = (dcfValue * (dcfWeight / 100)) + (comparableValue * (compsWeight / 100));
  const upside = ((blendedValue - financialData.currentStockPrice) / financialData.currentStockPrice) * 100;

  // Key metrics (NTM multiples use Year 1 DCF projections)
  const keyMetrics = useMemo(
    () => calculateKeyMetrics(financialData, dcfProjections),
    [financialData, dcfProjections]
  );

  // Get recommendation
  const recommendation = getRecommendation(upside);

  // Detect financial sector for chart filtering
  const isFinancialSector = (financialData.sector || '').toLowerCase().includes('financial') ||
    (financialData.sector || '').toLowerCase().includes('bank');

  // M1: Football field data — DCF range from sensitivity bounds (WACC ±4pp), M3: DDM bar
  const dcfLow = useMemo(() => calculateScenarioDCF(financialData, adjustedAssumptions, 1, 4, 1, 0), [financialData, adjustedAssumptions]);
  const dcfHigh = useMemo(() => calculateScenarioDCF(financialData, adjustedAssumptions, 1, -4, 1, 0), [financialData, adjustedAssumptions]);

  // M3: DDM values for football field
  const ke = adjustedAssumptions.riskFreeRate + adjustedAssumptions.beta * adjustedAssumptions.marketRiskPremium;
  const ddmResult = useMemo(() => calculateDDM(financialData, adjustedAssumptions, ke), [financialData, adjustedAssumptions, ke]);
  const ddmLow = ddmResult.applicable ? Math.min(ddmResult.gordonGrowth || Infinity, ddmResult.twoStage || Infinity, ddmResult.hModel || Infinity) : 0;
  const ddmHigh = ddmResult.applicable ? Math.max(ddmResult.gordonGrowth || 0, ddmResult.twoStage || 0, ddmResult.hModel || 0) : 0;
  const ddmMid = ddmResult.applicable && ddmResult.twoStage ? ddmResult.twoStage : 0;

  const footballFieldData = [
    { method: 'DCF', low: Math.min(dcfLow, dcfValue), mid: dcfValue, high: Math.max(dcfHigh, dcfValue), color: 'bg-blue-500' },
    { method: 'P/E', low: comparableValuations.peImplied * 0.9, mid: comparableValuations.peImplied, high: comparableValuations.peImplied * 1.1, color: 'bg-purple-500' },
    ...(isFinancialSector ? [] : [
      { method: 'EV/EBITDA', low: comparableValuations.evEbitdaImplied * 0.9, mid: comparableValuations.evEbitdaImplied, high: comparableValuations.evEbitdaImplied * 1.1, color: 'bg-green-500' },
    ]),
    ...(ddmMid > 0 ? [
      { method: 'DDM', low: ddmLow, mid: ddmMid, high: ddmHigh, color: 'bg-cyan-500' },
    ] : []),
    { method: 'P/B', low: comparableValuations.pbImplied * 0.9, mid: comparableValuations.pbImplied, high: comparableValuations.pbImplied * 1.1, color: 'bg-yellow-500' },
    // Football Field Fix: Blended bounds use weighted calculation, not simplistic ±10%
    { method: 'Blended',
      low:  (dcfWeight / 100) * Math.min(dcfLow, dcfValue) + (compsWeight / 100) * (comparableValue * 0.9),
      mid:  blendedValue,
      high: (dcfWeight / 100) * Math.max(dcfHigh, dcfValue) + (compsWeight / 100) * (comparableValue * 1.1),
      color: 'bg-red-500'
    },
  ];

  // Probability-Weighted Expected Value (institutional standard)
  const bearProb = adjustedAssumptions.bearProbability || 25;
  const baseProb = adjustedAssumptions.baseProbability || 50;
  const bullProb = adjustedAssumptions.bullProbability || 25;
  const totalProb = bearProb + baseProb + bullProb;
  const probabilityWeightedEV = totalProb > 0
    ? (bearProb * scenarioCases.bear + baseProb * scenarioCases.base + bullProb * scenarioCases.bull) / totalProb
    : dcfValue;

  // Chart data
  const revenueProjectionData = dcfProjections.map(p => ({
    year: p.year.toString(),
    Revenue: p.revenue / 1000000000,
    FCF: p.freeCashFlow / 1000000000,
    EBITDA: p.ebitda / 1000000000,
  }));

  const valuationComparisonData = [
    { name: 'Current', value: financialData.currentStockPrice, fill: '#71717a' },
    { name: 'DCF', value: dcfValue, fill: '#3b82f6' },
    { name: 'Comps', value: comparableValue, fill: '#8b5cf6' },
    { name: 'Blended', value: blendedValue, fill: '#ef4444' },
  ];

  return {
    adjustedAssumptions,
    dcfProjections,
    dcfValue,
    scenarioCases,
    industryMultiples,
    currentIndustry,
    comparableValuations,
    hasValidComparables,
    comparableValue,
    blendedValue,
    upside,
    compsWeight,
    keyMetrics,
    recommendation,
    currency,
    footballFieldData,
    probabilityWeightedEV,
    revenueProjectionData,
    valuationComparisonData,
  };
}
