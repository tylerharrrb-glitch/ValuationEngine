import React from 'react';
import { TrendingUp, TrendingDown, BarChart3 } from 'lucide-react';
import { FinancialData, ValuationAssumptions } from '../../../types/financial';
import { ScenarioCases } from '../../../utils/calculations/scenarios';
import { formatPrice, CurrencyCode } from '../../../utils/formatters';
import { SCENARIO_PARAMS } from '../../../utils/constants/scenarioParams';

interface Props {
  financialData: FinancialData;
  adjustedAssumptions: ValuationAssumptions;
  scenarioCases: ScenarioCases;
  upside: number;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
  blendedValue?: number;
  blendedUpside?: number;
}

export const ScenarioAnalysis: React.FC<Props> = ({
  financialData, adjustedAssumptions, scenarioCases, upside,
  isDarkMode, cardClass, textClass, textMutedClass, currency,
  blendedValue, blendedUpside,
}) => {
  const bearVsCurrent = ((scenarioCases.bear - financialData.currentStockPrice) / financialData.currentStockPrice * 100);
  const bullVsCurrent = ((scenarioCases.bull - financialData.currentStockPrice) / financialData.currentStockPrice * 100);
  const bearP = SCENARIO_PARAMS.bear;
  const bullP = SCENARIO_PARAMS.bull;

  return (
    <div className={`p-6 rounded-xl border ${cardClass}`}>
      <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
        Scenario Analysis: Bull / Base / Bear Cases
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Bear */}
        <div className={`p-5 rounded-xl border-2 ${isDarkMode ? 'border-[var(--accent-gold)]/40 bg-red-500/5' : 'border-red-200 bg-red-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown size={22} className="text-red-400" />
            <div>
              <div className="text-red-400 font-bold text-lg">BEAR CASE</div>
              <div className={`text-xs ${textMutedClass}`}>Recession / Slowdown</div>
            </div>
          </div>
          <div className="text-3xl font-bold text-red-400">{formatPrice(scenarioCases.bear, currency)}</div>
          <div className={`text-sm mt-2 ${textMutedClass}`}>
            <div>• Revenue growth: {(adjustedAssumptions.revenueGrowthRate * bearP.revenueGrowthMultiplier).toFixed(1)}%</div>
            <div>• WACC: {Math.max(adjustedAssumptions.discountRate + bearP.waccAdjustmentPP, 2).toFixed(1)}%</div>
            <div>• Margin compression: {(bearP.marginAdjPerYear * 100).toFixed(1)}%/yr</div>
          </div>
          <div className={`mt-3 text-sm font-medium ${bearVsCurrent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {bearVsCurrent.toFixed(1)}% vs current
          </div>
        </div>
        {/* Base */}
        <div className={`p-5 rounded-xl border-2 ${isDarkMode ? 'border-yellow-500/40 bg-yellow-500/5' : 'border-yellow-200 bg-yellow-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={22} className="text-yellow-400" />
            <div>
              <div className="text-yellow-400 font-bold text-lg">BASE CASE</div>
              <div className={`text-xs ${textMutedClass}`}>Current Assumptions</div>
            </div>
          </div>
          <div className="text-3xl font-bold text-yellow-400">{formatPrice(scenarioCases.base, currency)}</div>
          <div className={`text-sm mt-2 ${textMutedClass}`}>
            <div>• Revenue growth: {adjustedAssumptions.revenueGrowthRate.toFixed(1)}%</div>
            <div>• WACC: {adjustedAssumptions.discountRate.toFixed(1)}%</div>
            <div>• Margin improvement: +{adjustedAssumptions.marginImprovement}%/yr</div>
          </div>
          <div className={`mt-3 text-sm font-medium ${upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {upside.toFixed(1)}% vs current
          </div>
        </div>
        {/* Bull */}
        <div className={`p-5 rounded-xl border-2 ${isDarkMode ? 'border-green-500/40 bg-green-500/5' : 'border-green-200 bg-green-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={22} className="text-green-400" />
            <div>
              <div className="text-green-400 font-bold text-lg">BULL CASE</div>
              <div className={`text-xs ${textMutedClass}`}>Strong Growth / Tailwinds</div>
            </div>
          </div>
          <div className="text-3xl font-bold text-green-400">{formatPrice(scenarioCases.bull, currency)}</div>
          <div className={`text-sm mt-2 ${textMutedClass}`}>
            <div>• Revenue growth: {(adjustedAssumptions.revenueGrowthRate * bullP.revenueGrowthMultiplier).toFixed(1)}%</div>
            <div>• WACC: {Math.max(adjustedAssumptions.discountRate + bullP.waccAdjustmentPP, 2).toFixed(1)}%</div>
            <div>• Margin expansion: +{(bullP.marginAdjPerYear * 100).toFixed(1)}%/yr</div>
          </div>
          <div className={`mt-3 text-sm font-medium ${bullVsCurrent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            +{bullVsCurrent.toFixed(1)}% vs current
          </div>
        </div>
      </div>
      {/* Scenario Range Bar */}
      <div className={`mt-5 p-4 rounded-lg ${'bg-[var(--bg-secondary)]'}`}>
        <div className={`text-sm font-medium mb-2 ${textMutedClass}`}>Price Range Spectrum</div>
        <div className="relative h-10">
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-3 rounded-full bg-gradient-to-r from-red-500/30 via-yellow-500/30 to-green-500/30" />
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-[10%]">
            <div className="w-5 h-5 rounded-full bg-red-500 border-2 border-red-300 flex items-center justify-center">
              <span className="text-[8px] text-white font-bold">B</span>
            </div>
          </div>
          {(() => {
            const range = scenarioCases.bull - scenarioCases.bear;
            const pos = range > 0
              ? Math.min(90, Math.max(10, ((financialData.currentStockPrice - scenarioCases.bear) / range) * 80 + 10))
              : 50;
            return (
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${pos}%` }}>
                <div className="w-5 h-5 rounded-full bg-zinc-400 border-2 border-white flex items-center justify-center">
                  <span className="text-[8px] text-white font-bold">C</span>
                </div>
              </div>
            );
          })()}
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-[50%]">
            <div className="w-5 h-5 rounded-full bg-yellow-500 border-2 border-yellow-300 flex items-center justify-center">
              <span className="text-[8px] text-white font-bold">M</span>
            </div>
          </div>
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-[90%]">
            <div className="w-5 h-5 rounded-full bg-green-500 border-2 border-green-300 flex items-center justify-center">
              <span className="text-[8px] text-white font-bold">U</span>
            </div>
          </div>
        </div>
        <div className="flex justify-between mt-2">
          <span className="text-xs text-red-400">{formatPrice(scenarioCases.bear, currency)}</span>
          <span className={`text-xs ${textMutedClass}`}>Current: {formatPrice(financialData.currentStockPrice, currency)}</span>
          <span className="text-xs text-green-400">{formatPrice(scenarioCases.bull, currency)}</span>
        </div>
      </div>
      {/* S3: Blended context note */}
      <div className={`mt-4 p-3 rounded-lg ${'bg-[var(--bg-secondary)]'}`}>
        <div className={`text-xs ${textMutedClass}`}>
          Scenario values reflect DCF-only analysis (varying growth, WACC, and margins).
          {blendedValue !== undefined && blendedUpside !== undefined && (
            <span className="font-medium"> WOLF Blended Target Price (60% DCF + 40% Comps): {formatPrice(blendedValue, currency)} ({blendedUpside >= 0 ? '+' : ''}{blendedUpside.toFixed(2)}% upside)</span>
          )}
        </div>
      </div>
    </div>
  );
};
