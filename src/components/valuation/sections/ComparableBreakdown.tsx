import React from 'react';
import { FinancialData } from '../../../types/financial';
import { ComparableValuations } from '../../../utils/calculations/comparables';
import { formatPrice, CurrencyCode } from '../../../utils/formatters';

interface Props {
  financialData: FinancialData;
  comparableValuations: ComparableValuations;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const ComparableBreakdown: React.FC<Props> = ({
  financialData, comparableValuations, isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => (
  <div className={`p-6 rounded-xl border ${cardClass}`}>
    <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
      Comparable Valuation Breakdown
      <span className={`ml-2 text-sm font-normal ${textMutedClass}`}>({comparableValuations.source})</span>
    </h3>
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
      {[
        { label: 'P/E Implied', value: comparableValuations.peImplied, mult: comparableValuations.multiplesUsed.pe, multLabel: 'P/E' },
        { label: 'EV/EBITDA Implied', value: comparableValuations.evEbitdaImplied, mult: comparableValuations.multiplesUsed.evEbitda, multLabel: 'EV/EBITDA' },
        { label: 'P/S Implied', value: comparableValuations.psImplied, mult: comparableValuations.multiplesUsed.ps, multLabel: 'P/S' },
        { label: 'P/B Implied', value: comparableValuations.pbImplied, mult: comparableValuations.multiplesUsed.pb, multLabel: 'P/B' },
      ].map(({ label, value, mult, multLabel }) => (
        <div key={label} className={`p-4 rounded-lg ${'bg-[var(--bg-secondary)]'}`}>
          <div className={`text-sm ${textMutedClass}`}>{label}</div>
          <div className={`text-xl font-bold ${value > financialData.currentStockPrice ? 'text-green-400' : 'text-red-400'}`}>
            {formatPrice(value, currency)}
          </div>
          <div className={`text-xs ${textMutedClass}`}>@ {mult.toFixed(1)}x {multLabel}</div>
        </div>
      ))}
      <div className="p-4 rounded-lg bg-purple-500/20 border border-purple-500/50">
        <div className="text-sm text-purple-300">Weighted Avg</div>
        <div className="text-xl font-bold text-purple-400">{formatPrice(comparableValuations.blendedComps, currency)}</div>
        <div className="text-xs text-purple-300">40% P/E, 35% EV, 15% P/S, 10% P/B</div>
      </div>
    </div>
  </div>
);
