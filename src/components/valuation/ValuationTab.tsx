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
import { FCFFReconciliation } from './sections/FCFFReconciliation';
import { KeyMetricsGrid } from './sections/KeyMetricsGrid';
import { DDMValuation } from './sections/DDMValuation';
import { ReverseDCFSection } from './sections/ReverseDCFSection';

import { QualityScorecard } from './sections/QualityScorecard';
import { EASComplianceSection } from './sections/EASComplianceSection';
import { PiotroskiFScore } from './sections/PiotroskiFScore';
import { EVBridgeChart } from './sections/EVBridgeChart';
import { CalculationAuditTrail } from '../shared/CalculationAuditTrail';
import { FXSensitivity } from './sections/FXSensitivity';
import { WorkingCapitalDetail } from './sections/WorkingCapitalDetail';
import { ConfidenceScore } from './sections/ConfidenceScore';
import { SaveLoadPanel } from './sections/SaveLoadPanel';

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
  handleLoadValuation: (data: { financialData: FinancialData; assumptions: ValuationAssumptions; comparables: ComparableCompany[] }) => void;
}

export const ValuationTab: React.FC<ValuationTabProps> = (props) => {
  const { financialData, assumptions, adjustedAssumptions,
    dcfProjections, dcfValue, comparableValue, blendedValue, upside,
    dcfWeight, compsWeight, setDcfWeight, comparableValuations,
    hasValidComparables, industryMultiples, keyMetrics, recommendation,
    scenarioCases, scenario, valuationStyle, setValuationStyle,
    marketRegion, isDarkMode, cardClass, textClass, textMutedClass, currency,
    historyIndex, historyLength, lastSaved, handleLoadValuation } = props;

  const themeProps = { isDarkMode, cardClass, textClass, textMutedClass, currency };
  const reverseDCF = calculateReverseDCF(financialData, adjustedAssumptions);
  const scorecard = calculateQualityScorecard(financialData);

  // D1: Confidence Score — compute TV% for scoring
  const waccDec = (assumptions.riskFreeRate + assumptions.beta * assumptions.marketRiskPremium) * (financialData.currentStockPrice * financialData.sharesOutstanding) / ((financialData.currentStockPrice * financialData.sharesOutstanding) + financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt) + (assumptions.costOfDebt * (1 - assumptions.taxRate / 100)) * ((financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt) / ((financialData.currentStockPrice * financialData.sharesOutstanding) + financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt));
  const waccDecFraction = waccDec / 100;
  const lastFCFF = dcfProjections.length > 0 ? dcfProjections[dcfProjections.length - 1].freeCashFlow : 0;
  const tgDec = adjustedAssumptions.terminalGrowthRate / 100;
  const tvCalc = waccDecFraction > tgDec ? (lastFCFF * (1 + tgDec)) / (waccDecFraction - tgDec) : 0;
  const pvTV = dcfProjections.length > 0 ? tvCalc / Math.pow(1 + waccDecFraction, dcfProjections.length) : 0;
  const sumPV = dcfProjections.reduce((s, p) => s + p.presentValue, 0);
  const totalEV = sumPV + pvTV;
  const tvPercent = totalEV > 0 ? (pvTV / totalEV) * 100 : 0;

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
      {/* D1: Confidence Score */}
      <ConfidenceScore
        financialData={financialData}
        assumptions={assumptions}
        comparables={props.comparables}
        tvPercent={tvPercent}
        waccRate={waccDec}
        isDarkMode={isDarkMode}
      />
      {/* B4: Save/Load */}
      <SaveLoadPanel
        financialData={financialData}
        assumptions={assumptions}
        comparables={props.comparables}
        onLoad={handleLoadValuation}
        isDarkMode={isDarkMode}
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
        scenarioCases={scenarioCases} upside={upside}
        blendedValue={blendedValue}
        blendedUpside={financialData.currentStockPrice > 0 ? (blendedValue - financialData.currentStockPrice) / financialData.currentStockPrice * 100 : 0}
        {...themeProps}
      />
      {/* C9: FX Sensitivity (Egypt only) */}
      {marketRegion === 'Egypt' && (
        <FXSensitivity dcfPrice={dcfValue} {...themeProps} />
      )}
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
      <FCFFReconciliation
        financialData={financialData} assumptions={adjustedAssumptions} {...themeProps}
      />
      {/* C3: EV-to-Equity Bridge */}
      {(() => {
        const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
        const cash = financialData.balanceSheet.cash;
        const equityVal = dcfValue * financialData.sharesOutstanding;
        const ev = equityVal + totalDebt - cash;
        return (
          <EVBridgeChart
            enterpriseValue={ev}
            totalDebt={totalDebt}
            cash={cash}
            equityValue={equityVal}
            sharesOutstanding={financialData.sharesOutstanding}
            perSharePrice={dcfValue}
            {...themeProps}
          />
        );
      })()}
      <KeyMetricsGrid financialData={financialData} keyMetrics={keyMetrics} marketRegion={marketRegion} {...themeProps} />
      <WorkingCapitalDetail financialData={financialData} {...themeProps} />
      <DDMValuation financialData={financialData} assumptions={adjustedAssumptions} {...themeProps} />
      <ReverseDCFSection reverseDCF={reverseDCF} {...themeProps} />
      <QualityScorecard scorecard={scorecard} {...themeProps} />
      <PiotroskiFScore financialData={financialData} {...themeProps} />
      <EASComplianceSection financialData={financialData} assumptions={adjustedAssumptions} {...themeProps} />
      <AIReport
        financialData={financialData} assumptions={adjustedAssumptions}
        dcfValue={dcfValue} comparableValue={comparableValue}
        scenario={scenario} isDarkMode={isDarkMode} currency={currency}
      />
    </div>
  );
};

export default ValuationTab;
