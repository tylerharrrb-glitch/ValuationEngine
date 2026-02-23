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
import { calculateDCFProjections, calculateDCFValue } from '../utils/calculations/dcf';
import { calculateComparableValuations, ComparableValuations, IndustryMultiples } from '../utils/calculations/comparables';
import { calculateKeyMetrics, getRecommendation, KeyMetrics, Recommendation } from '../utils/calculations/metrics';
import { calculateScenarioCases, ScenarioCases } from '../utils/calculations/scenarios';
import { CurrencyCode, getCurrencyFromMarket } from '../utils/formatters';

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
    
    // Cap terminal growth at sustainable long-term rates
    // Terminal growth cannot exceed long-term GDP growth — even in high-inflation markets
    const maxTermGrowth = marketRegion === 'Egypt' ? 5.0 : 2.5;
    if (adjusted.terminalGrowthRate > maxTermGrowth) {
      console.log(`[WOLF] Terminal growth capped: ${adjusted.terminalGrowthRate.toFixed(1)}% → ${maxTermGrowth}% (sustainable long-term rate for ${marketRegion})`);
      adjusted.terminalGrowthRate = maxTermGrowth;
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

  // Key metrics
  const keyMetrics = useMemo(
    () => calculateKeyMetrics(financialData),
    [financialData]
  );

  // Get recommendation
  const recommendation = getRecommendation(upside);

  // Detect financial sector for chart filtering
  const isFinancialSector = (financialData.sector || '').toLowerCase().includes('financial') ||
                            (financialData.sector || '').toLowerCase().includes('bank');

  // Football field data — skip EV/EBITDA for banks
  const footballFieldData = [
    { method: 'DCF', low: dcfValue * 0.85, mid: dcfValue, high: dcfValue * 1.15, color: 'bg-blue-500' },
    { method: 'P/E', low: comparableValuations.peImplied * 0.9, mid: comparableValuations.peImplied, high: comparableValuations.peImplied * 1.1, color: 'bg-purple-500' },
    ...(isFinancialSector ? [] : [
      { method: 'EV/EBITDA', low: comparableValuations.evEbitdaImplied * 0.9, mid: comparableValuations.evEbitdaImplied, high: comparableValuations.evEbitdaImplied * 1.1, color: 'bg-green-500' },
    ]),
    { method: 'P/B', low: comparableValuations.pbImplied * 0.9, mid: comparableValuations.pbImplied, high: comparableValuations.pbImplied * 1.1, color: 'bg-yellow-500' },
    { method: 'Blended', low: blendedValue * 0.9, mid: blendedValue, high: blendedValue * 1.1, color: 'bg-red-500' },
  ];

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
    revenueProjectionData,
    valuationComparisonData,
  };
}
