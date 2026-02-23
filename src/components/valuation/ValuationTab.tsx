/**
 * Valuation Tab – All valuation analysis sections.
 */
import React from 'react';
import { Info } from 'lucide-react';
import { FinancialData, ValuationAssumptions, ComparableCompany, DCFProjection, MarketRegion } from '../../types/financial';
import { ScenarioType } from '../ScenarioToggle';
import { AIReport } from '../AIReport';
import { ValuationStyleKey } from '../../constants/valuationStyles';
import { ComparableValuations, IndustryMultiples } from '../../utils/calculations/comparables';
import { KeyMetrics, Recommendation } from '../../utils/calculations/metrics';
import { ScenarioCases } from '../../utils/calculations/scenarios';
import { calculateReverseDCF, calculateQualityScorecard } from '../../utils/advancedAnalysis';
import { CurrencyCode } from '../../utils/formatters';
import { ValidationAlerts } from './sections/ValidationAlerts';
import { ValuationStyleSelector } from './sections/ValuationStyleSelector';
import { MarketVsFundamental } from './sections/MarketVsFundamental';
import { ScenarioAnalysis } from './sections/ScenarioAnalysis';
import { ValuationSummaryCards } from './sections/ValuationSummaryCards';
import { BlendedWeightSlider } from './sections/BlendedWeightSlider';
import { ComparableBreakdown } from './sections/ComparableBreakdown';
import { BaseYearFCF } from './sections/BaseYearFCF';
import { DCFProjectionsTable } from './sections/DCFProjectionsTable';
import { KeyMetricsGrid } from './sections/KeyMetricsGrid';
import { ReverseDCFSection } from './sections/ReverseDCFSection';

import { QualityScorecard } from './sections/QualityScorecard';
import { CalculationAuditTrail } from '../shared/CalculationAuditTrail';

export interface ValuationTabProps {
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  adjustedAssumptions: ValuationAssumptions;
  comparables: ComparableCompany[];
  dcfProjections: DCFProjection[];
  dcfValue: number;
  comparableValue: number;
  blendedValue: number;
  upside: number;
  dcfWeight: number;
  compsWeight: number;
  setDcfWeight: (w: number) => void;
  comparableValuations: ComparableValuations;
  hasValidComparables: boolean;
  industryMultiples: IndustryMultiples;
  keyMetrics: KeyMetrics;
  recommendation: Recommendation;
  scenarioCases: ScenarioCases;
  scenario: ScenarioType;
  valuationStyle: ValuationStyleKey;
  setValuationStyle: (s: ValuationStyleKey) => void;
  marketRegion: MarketRegion;
  isDarkMode: boolean;
  historyIndex: number; 
  historyLength: number;
  lastSaved: string | null;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const ValuationTab: React.FC<ValuationTabProps> = (props) => {
  const { financialData, assumptions, adjustedAssumptions,
    dcfProjections, dcfValue, comparableValue, blendedValue, upside,
    dcfWeight, compsWeight, setDcfWeight, comparableValuations,
    hasValidComparables, industryMultiples, keyMetrics, recommendation,
    scenarioCases, scenario, valuationStyle, setValuationStyle,
    marketRegion, isDarkMode, cardClass, textClass, textMutedClass, currency,
    historyIndex, historyLength, lastSaved } = props;

  const themeProps = { isDarkMode, cardClass, textClass, textMutedClass, currency };
  const reverseDCF = calculateReverseDCF(financialData, adjustedAssumptions);
  const scorecard = calculateQualityScorecard(financialData);

  return (
    <div className="space-y-6">
      <CalculationAuditTrail
        historyIndex={historyIndex}
        historyLength={historyLength}
        lastSaved={lastSaved ?? undefined}
        cardClass={cardClass}
        textClass={textClass}
        textMutedClass={textMutedClass}
      />
      <ValidationAlerts
        financialData={financialData} assumptions={assumptions}
        adjustedAssumptions={adjustedAssumptions} hasValidComparables={hasValidComparables}
        industryMultiples={industryMultiples} marketRegion={marketRegion} {...themeProps}
      />
      {/* Method Explainer */}
      <div className={`p-5 rounded-xl border ${isDarkMode ? 'bg-zinc-900/80 border-zinc-700' : 'bg-amber-50 border-amber-200'}`}>
        <div className="flex items-start gap-3">
          <Info size={22} className="text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 className={`font-semibold mb-2 ${textClass}`}>⚠️ UNDERSTANDING RECOMMENDATIONS</h4>
            <ul className={`text-sm space-y-1 ${textMutedClass}`}>
              <li className="flex items-center gap-2"><span className="text-red-400">•</span> WOLF uses <strong className={textClass}>FUNDAMENTAL ANALYSIS</strong> (cash flow-based intrinsic value)</li>
              <li className="flex items-center gap-2"><span className="text-red-400">•</span> This differs from <strong className={textClass}>MARKET SENTIMENT</strong> (momentum/growth expectations)</li>
              <li className="flex items-center gap-2"><span className="text-red-400">•</span> A stock can be <strong className="text-yellow-400">OVERVALUED</strong> by fundamentals and still <strong className="text-green-400">RISING</strong> in price</li>
              <li className="flex items-center gap-2"><span className="text-red-400">•</span> Our STRONG SELL means: <em>fundamentals don't justify the current price</em></li>
              <li className="flex items-center gap-2"><span className="text-red-400">•</span> This is a <strong className="text-blue-400">VALUE INVESTING</strong> perspective (Graham/Buffett school)</li>
            </ul>
          </div>
        </div>
      </div>
      <ValuationStyleSelector
        financialData={financialData} assumptions={assumptions}
        adjustedAssumptions={adjustedAssumptions} scenario={scenario}
        valuationStyle={valuationStyle} setValuationStyle={setValuationStyle} {...themeProps}
      />
      <MarketVsFundamental
        financialData={financialData} dcfValue={dcfValue} comparableValue={comparableValue}
        blendedValue={blendedValue} upside={upside} dcfWeight={dcfWeight} compsWeight={compsWeight}
        keyMetrics={keyMetrics} recommendation={recommendation} {...themeProps}
      />
      <ScenarioAnalysis
        financialData={financialData} adjustedAssumptions={adjustedAssumptions}
        scenarioCases={scenarioCases} upside={upside} {...themeProps}
      />
      <ValuationSummaryCards
        financialData={financialData} dcfValue={dcfValue} comparableValue={comparableValue}
        blendedValue={blendedValue} dcfWeight={dcfWeight} compsWeight={compsWeight}
        comparableValuations={comparableValuations} recommendation={recommendation} {...themeProps}
      />
      <BlendedWeightSlider
        dcfWeight={dcfWeight} compsWeight={compsWeight}
        setDcfWeight={setDcfWeight} {...themeProps}
      />
      <ComparableBreakdown
        financialData={financialData} comparableValuations={comparableValuations} {...themeProps}
      />
      <BaseYearFCF financialData={financialData} {...themeProps} />
      <DCFProjectionsTable
        dcfProjections={dcfProjections} scenario={scenario} {...themeProps}
      />
      <KeyMetricsGrid financialData={financialData} keyMetrics={keyMetrics} {...themeProps} />
      <ReverseDCFSection reverseDCF={reverseDCF} {...themeProps} />
      <QualityScorecard scorecard={scorecard} {...themeProps} />
      <AIReport
        financialData={financialData} assumptions={adjustedAssumptions}
        dcfValue={dcfValue} comparableValue={comparableValue}
        scenario={scenario} isDarkMode={isDarkMode}
      />
    </div>
  );
};

export default ValuationTab;
