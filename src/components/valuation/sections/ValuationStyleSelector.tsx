import React from 'react';
import { Target } from 'lucide-react';
import { FinancialData, ValuationAssumptions } from '../../../types/financial';
import { ScenarioType, scenarioMultipliers } from '../../ScenarioToggle';
import { VALUATION_STYLES, ValuationStyleKey } from '../../../constants/valuationStyles';
import { formatPrice, CurrencyCode } from '../../../utils/formatters';
import { calculateWACC } from '../../../utils/valuation';

interface Props {
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  adjustedAssumptions: ValuationAssumptions;
  scenario: ScenarioType;
  valuationStyle: ValuationStyleKey;
  setValuationStyle: (s: ValuationStyleKey) => void;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const ValuationStyleSelector: React.FC<Props> = ({
  financialData, assumptions, adjustedAssumptions, scenario,
  valuationStyle, setValuationStyle,
  isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => {
  const styleEntries = Object.entries(VALUATION_STYLES) as [ValuationStyleKey, typeof VALUATION_STYLES[ValuationStyleKey]][];

  return (
    <div className={`p-6 rounded-xl border ${cardClass}`}>
      <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
        <Target size={20} className="inline mr-2 text-red-400" />
        Valuation Style
      </h3>
      {/* Style Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {styleEntries.map(([key, style]) => (
          <button key={key} onClick={() => setValuationStyle(key)}
            className={`p-4 rounded-xl border-2 transition-all text-left ${valuationStyle === key
                ? key === 'conservative' ? 'border-blue-500 bg-blue-500/10'
                  : key === 'moderate' ? 'border-yellow-500 bg-yellow-500/10'
                    : 'border-green-500 bg-green-500/10'
                : isDarkMode ? 'border-zinc-700 hover:border-zinc-500 bg-zinc-800/50'
                  : 'border-gray-200 hover:border-gray-400 bg-gray-50'
              }`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-3 h-3 rounded-full ${key === 'conservative' ? 'bg-blue-500' : key === 'moderate' ? 'bg-yellow-500' : 'bg-green-500'
                }`} />
              <div>
                <div className={`font-semibold ${textClass}`}>{style.label}</div>
                <div className={`text-xs ${textMutedClass}`}>{style.subtitle}</div>
              </div>
            </div>
            <div className={`text-xs mt-2 ${textMutedClass}`}>{style.description}</div>
          </button>
        ))}
      </div>

      {/* Adjusted values panel */}
      {valuationStyle !== 'moderate' ? (
        <div className={`mt-4 p-4 rounded-lg border ${valuationStyle === 'conservative' ? 'bg-blue-500/5 border-blue-500/30' : 'bg-green-500/5 border-green-500/30'
          }`}>
          <div className={`text-sm font-semibold mb-2 ${valuationStyle === 'conservative' ? 'text-blue-400' : 'text-green-400'}`}>
            {valuationStyle === 'conservative' ? 'CONSERVATIVE' : 'AGGRESSIVE'} ADJUSTMENTS APPLIED
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><span className={`text-xs ${textMutedClass}`}>Revenue Growth</span><div className={`text-sm font-bold ${textClass}`}>{adjustedAssumptions.revenueGrowthRate.toFixed(1)}%</div></div>
            <div><span className={`text-xs ${textMutedClass}`}>WACC</span><div className={`text-sm font-bold ${textClass}`}>{adjustedAssumptions.discountRate.toFixed(1)}%</div></div>
            <div><span className={`text-xs ${textMutedClass}`}>Terminal Growth</span><div className={`text-sm font-bold ${textClass}`}>{adjustedAssumptions.terminalGrowthRate.toFixed(1)}%</div></div>
            <div><span className={`text-xs ${textMutedClass}`}>Margin Imp.</span><div className={`text-sm font-bold ${textClass}`}>+{adjustedAssumptions.marginImprovement.toFixed(1)}%</div></div>
          </div>
        </div>
      ) : (
        <div className={`mt-4 p-3 rounded-lg ${'bg-[var(--bg-secondary)]'}`}>
          <span className={`text-sm ${textMutedClass}`}>
            BASE CASE — Using your original assumptions as entered. Select Conservative or Aggressive to see adjusted values.
          </span>
        </div>
      )}

      {/* Style Comparison Table */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className={textMutedClass}>
              <th className="text-left py-2 px-3 font-semibold">Style</th>
              <th className="text-right py-2 px-3 font-semibold">Rev Growth</th>
              <th className="text-right py-2 px-3 font-semibold">WACC</th>
              <th className="text-right py-2 px-3 font-semibold">Term. Growth</th>
              <th className="text-right py-2 px-3 font-semibold">DCF Value</th>
              <th className="text-right py-2 px-3 font-semibold">vs Current</th>
            </tr>
          </thead>
          <tbody>
            {styleEntries.map(([key, style]) => {
              const sRevGrowth = assumptions.revenueGrowthRate * scenarioMultipliers[scenario].revenueGrowth * style.revenueGrowthMult;
              const sWACC = Math.max(2, calculateWACC(financialData, assumptions) * scenarioMultipliers[scenario].wacc + style.waccAdd);
              const sTermGrowth = assumptions.terminalGrowthRate * scenarioMultipliers[scenario].terminalGrowth * style.terminalGrowthMult;
              // C3 Fix: Use FCFF buildup (NOPAT + D&A − CapEx − ΔWC) instead of legacy FCF margin
              const sTaxRate = assumptions.taxRate / 100;
              let rev = financialData.incomeStatement.revenue;
              let sPV = 0, sLastFCF = 0;
              for (let yr = 1; yr <= assumptions.projectionYears; yr++) {
                const prevRev = rev;
                rev *= (1 + sRevGrowth / 100);
                const ebitda = rev * (assumptions.ebitdaMargin / 100);
                const da = rev * (assumptions.daPercent / 100);
                const ebit = ebitda - da;
                const nopat = ebit * (1 - sTaxRate);
                const capex = rev * (assumptions.capexPercent / 100);
                const deltaWC = (rev - prevRev) * (assumptions.deltaWCPercent / 100);
                const fcfC = nopat + da - capex - deltaWC;
                sPV += fcfC / Math.pow(1 + sWACC / 100, yr);
                sLastFCF = fcfC;
              }
              let sTv = sWACC > sTermGrowth
                ? (sLastFCF * (1 + sTermGrowth / 100)) / ((sWACC - sTermGrowth) / 100)
                : sLastFCF * 12;
              const sEv = sPV + sTv / Math.pow(1 + sWACC / 100, assumptions.projectionYears);
              const sTotalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
              const sPrice = Math.max((sEv - sTotalDebt + financialData.balanceSheet.cash) / financialData.sharesOutstanding, 0);
              const sUpside = ((sPrice - financialData.currentStockPrice) / financialData.currentStockPrice) * 100;
              const isActive = key === valuationStyle;

              return (
                <tr key={key} className={`${'border-t border-[var(--border)]'} ${isActive ? 'bg-red-500/10' : ''}`}>
                  <td className={`py-2 px-3 font-medium ${isActive ? 'text-red-400' : textClass}`}>{isActive && '▶ '}{style.label}</td>
                  <td className={`py-2 px-3 text-right ${textClass}`}>{sRevGrowth.toFixed(1)}%</td>
                  <td className={`py-2 px-3 text-right ${textClass}`}>{sWACC.toFixed(1)}%</td>
                  <td className={`py-2 px-3 text-right ${textClass}`}>{sTermGrowth.toFixed(1)}%</td>
                  <td className={`py-2 px-3 text-right font-bold ${textClass}`}>{formatPrice(sPrice, currency)}</td>
                  <td className={`py-2 px-3 text-right font-medium ${sUpside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {sUpside >= 0 ? '+' : ''}{sUpside.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
