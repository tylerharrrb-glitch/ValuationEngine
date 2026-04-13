/**
 * Valuation Tab – All valuation analysis sections.
 */
import React, { useState } from 'react';
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
import { FCFESection } from './sections/FCFESection';
import { KeyMetricsGrid } from './sections/KeyMetricsGrid';
import { DDMValuation } from './sections/DDMValuation';
import { ReverseDCFSection } from './sections/ReverseDCFSection';

import { QualityScorecard } from './sections/QualityScorecard';
import { EASComplianceSection } from './sections/EASComplianceSection';
import { PiotroskiFScore } from './sections/PiotroskiFScore';
import { EVBridgeChart } from './sections/EVBridgeChart';
import { CalculationAuditTrail } from '../shared/CalculationAuditTrail';
import { calculateWACC, calculateKe } from '../../utils/valuation';
import { FXSensitivity } from './sections/FXSensitivity';
import { WorkingCapitalDetail } from './sections/WorkingCapitalDetail';
import { ConfidenceScore } from './sections/ConfidenceScore';
import { CreditMetricsPanel } from './sections/CreditMetricsPanel';
import { LBOPanel } from './sections/LBOPanel';
import { SOTPPanel } from './sections/SOTPPanel';
import { PrecedentTransactionsPanel } from './sections/PrecedentTransactionsPanel';
import { RelativeValuationPanel } from './sections/RelativeValuationPanel';
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
  probabilityWeightedEV?: number;
  handleLoadValuation: (data: { financialData: FinancialData; assumptions: ValuationAssumptions; comparables: ComparableCompany[] }) => void;
}

export const ValuationTab: React.FC<ValuationTabProps> = (props) => {
  const { financialData, assumptions, adjustedAssumptions,
    dcfProjections, dcfValue, comparableValue, blendedValue, upside,
    dcfWeight, compsWeight, setDcfWeight, comparableValuations,
    hasValidComparables, industryMultiples, keyMetrics, recommendation,
    scenarioCases, scenario, valuationStyle, setValuationStyle,
    marketRegion, isDarkMode, cardClass, textClass, textMutedClass, currency,
    historyIndex, historyLength, lastSaved, handleLoadValuation, probabilityWeightedEV } = props;

  const themeProps = { isDarkMode, cardClass, textClass, textMutedClass, currency };
  const reverseDCF = calculateReverseDCF(financialData, adjustedAssumptions);
  const scorecard = calculateQualityScorecard(financialData);

  // Feature #3: Real Return Calculator state
  const [inflationRate, setInflationRate] = useState(25.0);

  // D1: Confidence Score — compute TV% for scoring (use live WACC from dispatcher)
  const waccDec = calculateWACC(financialData, assumptions);
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
      <div className={`p-5 rounded-xl border ${'bg-[var(--bg-card)] border-[var(--border)]'}`}>
        <div className="flex items-start gap-3">
          <Info size={22} className="text-[var(--accent-gold)] mt-0.5 flex-shrink-0" />
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
        probabilityWeightedEV={probabilityWeightedEV}
        {...themeProps}
      />
      {/* Feature #3: Real Return Calculator (Egypt) */}
      {marketRegion === 'Egypt' && (() => {
        const nominalUpside = financialData.currentStockPrice > 0
          ? (blendedValue - financialData.currentStockPrice) / financialData.currentStockPrice
          : 0;
        const realReturn = (1 + nominalUpside) / (1 + inflationRate / 100) - 1;
        const realPct = realReturn * 100;
        return (
          <div className={`p-5 rounded-xl border ${cardClass}`}>
            <h3 className={`text-lg font-semibold mb-3 ${textClass}`}>Inflation-Adjusted Return (Egypt)</h3>
            <div className="flex items-center gap-3 mb-3">
              <label className={`text-sm ${textMutedClass}`}>Expected Inflation:</label>
              <input
                type="number" value={inflationRate} step={0.5} min={0} max={100}
                onChange={(e) => setInflationRate(parseFloat(e.target.value) || 0)}
                className={`w-24 px-2 py-1 rounded border text-sm ${'wolf-input'}`}
              />
              <span className={`text-sm ${textMutedClass}`}>%</span>
              <span className={`text-xs ${textMutedClass}`}>(CBE target: 7±2% | Recent actual: 25-35%)</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className={`p-3 rounded-lg border ${'bg-[var(--bg-secondary)] border-[var(--border)]'}`}>
                <p className={`text-xs ${textMutedClass}`}>Nominal Upside</p>
                <p className={`text-lg font-bold ${nominalUpside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {nominalUpside >= 0 ? '+' : ''}{(nominalUpside * 100).toFixed(2)}%
                </p>
              </div>
              <div className={`p-3 rounded-lg border ${'bg-[var(--bg-secondary)] border-[var(--border)]'}`}>
                <p className={`text-xs ${textMutedClass}`}>Inflation Drag</p>
                <p className="text-lg font-bold text-orange-400">−{inflationRate.toFixed(1)}%</p>
              </div>
              <div className={`p-3 rounded-lg border-2 ${realPct >= 0 ? 'border-green-600/40 bg-green-950/20' : 'border-[var(--accent-gold)]/40 bg-red-950/20'}`}>
                <p className={`text-xs ${textMutedClass}`}>Real Return</p>
                <p className={`text-lg font-bold ${realPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {realPct >= 0 ? '+' : ''}{realPct.toFixed(2)}%
                </p>
              </div>
            </div>
            {nominalUpside > 0 && realPct < 0 && (
              <p className={`mt-3 text-xs px-3 py-2 rounded-lg bg-yellow-900/30 border border-yellow-700/50 text-yellow-400/90`}>
                ⚠ At {inflationRate}% inflation, this investment delivers a negative real return despite positive nominal upside.
                Compare against EGP deposit rates (~20-25%) as your opportunity cost.
              </p>
            )}
          </div>
        );
      })()}
      {/* Feature #4: Dividend Sustainability */}
      {(() => {
        // V12: Derive DPS from dividendsPaid when dividendsPerShare is not set (matches DDM section)
        const dividendsPaidAbs = Math.abs(financialData.cashFlowStatement.dividendsPaid || 0);
        const dps = financialData.dividendsPerShare || (dividendsPaidAbs > 0 ? dividendsPaidAbs / financialData.sharesOutstanding : 0);
        const eps = financialData.sharesOutstanding > 0 ? financialData.incomeStatement.netIncome / financialData.sharesOutstanding : 0;
        const fcf = financialData.cashFlowStatement.freeCashFlow;
        const divsPaid = financialData.cashFlowStatement.dividendsPaid;
        if (dps <= 0 || eps <= 0) return null;
        const payoutRatio = (dps / eps) * 100;
        const fcfPayout = fcf > 0 ? (divsPaid / fcf) * 100 : 0;
        const fcfCoverage = divsPaid > 0 ? fcf / divsPaid : 0;
        const roe = financialData.balanceSheet.totalEquity > 0
          ? (financialData.incomeStatement.netIncome / financialData.balanceSheet.totalEquity) * 100 : 0;
        const sustainableGrowth = roe * (1 - payoutRatio / 100);
        const assessment = payoutRatio < 40 && fcfCoverage > 2
          ? { label: 'CONSERVATIVE — Highly Sustainable', color: 'text-green-400', bg: 'bg-green-950/20 border-green-600/40' }
          : payoutRatio <= 75 && fcfCoverage > 1
            ? { label: 'MODERATE — Sustainable', color: 'text-yellow-400', bg: 'bg-yellow-950/20 border-yellow-600/40' }
            : { label: 'AGGRESSIVE — At Risk', color: 'text-red-400', bg: 'bg-red-950/20 border-[var(--accent-gold)]/40' };

        return (
          <div className={`p-5 rounded-xl border ${cardClass}`}>
            <h3 className={`text-lg font-semibold mb-3 ${textClass}`}>Dividend Sustainability</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              {[
                { label: 'Payout Ratio', value: `${payoutRatio.toFixed(1)}%` },
                { label: 'FCF Coverage', value: `${fcfCoverage.toFixed(1)}x` },
                { label: 'Sustainable Growth', value: `${sustainableGrowth.toFixed(1)}%` },
                { label: 'DPS', value: `${currency} ${dps.toFixed(2)}` },
              ].map(m => (
                <div key={m.label} className={`p-3 rounded-lg border ${'bg-[var(--bg-secondary)] border-[var(--border)]'}`}>
                  <p className={`text-xs ${textMutedClass}`}>{m.label}</p>
                  <p className={`text-lg font-bold ${textClass}`}>{m.value}</p>
                </div>
              ))}
            </div>
            <div className={`px-3 py-2 rounded-lg border-2 ${assessment.bg}`}>
              <span className={`text-sm font-semibold ${assessment.color}`}>{assessment.label}</span>
            </div>
            {dcfValue > 0 && dps > 0 && (() => {
              const gordonKe = calculateKe(adjustedAssumptions) / 100;
              const gordonG = adjustedAssumptions.terminalGrowthRate / 100;
              const gordonDDM = gordonKe > gordonG ? (dps * (1 + gordonG)) / (gordonKe - gordonG) : 0;
              const ddmGap = Math.abs(gordonDDM - dcfValue);
              if (gordonDDM > 0 && ddmGap / dcfValue > 0.50) {
                return (
                  <p className={`mt-3 text-xs px-3 py-2 rounded-lg ${isDarkMode ? 'bg-zinc-800/50 border border-zinc-700' : 'bg-gray-50 border border-gray-200'} ${textMutedClass}`}>
                    ℹ DDM values ({currency} {gordonDDM.toFixed(2)}) are below DCF ({currency} {dcfValue.toFixed(2)}) because only {payoutRatio.toFixed(1)}% of earnings are distributed.
                    The remaining {(100 - payoutRatio).toFixed(1)}% is reinvested. DDM captures distributed value; DCF captures total firm value.
                  </p>
                );
              }
              return null;
            })()}
          </div>
        );
      })()}
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
        dcfProjections={dcfProjections} scenario={scenario}
        financialData={financialData} assumptions={adjustedAssumptions}
        {...themeProps}
      />
      <FCFFReconciliation
        financialData={financialData} assumptions={adjustedAssumptions} {...themeProps}
      />
      <FCFESection
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
      <KeyMetricsGrid financialData={financialData} keyMetrics={keyMetrics} assumptions={adjustedAssumptions} marketRegion={marketRegion} {...themeProps} />
      <CreditMetricsPanel financialData={financialData} {...themeProps} />
      <WorkingCapitalDetail financialData={financialData} {...themeProps} />
      <DDMValuation financialData={financialData} assumptions={adjustedAssumptions} {...themeProps} />
      <ReverseDCFSection reverseDCF={reverseDCF} {...themeProps} />
      <QualityScorecard scorecard={scorecard} {...themeProps} />
      <PiotroskiFScore financialData={financialData} {...themeProps} />
      <EASComplianceSection financialData={financialData} assumptions={adjustedAssumptions} {...themeProps} />
      <LBOPanel financialData={financialData} {...themeProps} />
      <SOTPPanel financialData={financialData} {...themeProps} />
      <PrecedentTransactionsPanel financialData={financialData} {...themeProps} />
      <RelativeValuationPanel financialData={financialData} keyMetrics={keyMetrics} marketRegion={marketRegion} {...themeProps} />
      <AIReport
        financialData={financialData} assumptions={adjustedAssumptions}
        dcfValue={dcfValue} comparableValue={comparableValue}
        scenario={scenario} isDarkMode={isDarkMode} currency={currency}
      />
    </div>
  );
};

export default ValuationTab;
