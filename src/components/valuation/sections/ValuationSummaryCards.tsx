import React from 'react';
import { Tooltip } from '../../Tooltip';
import { ComparableValuations } from '../../../utils/calculations/comparables';
import { Recommendation } from '../../../utils/calculations/metrics';
import { formatPrice, CurrencyCode } from '../../../utils/formatters';
import { FinancialData } from '../../../types/financial';

interface Props {
  financialData: FinancialData;
  dcfValue: number;
  comparableValue: number;
  blendedValue: number;
  dcfWeight: number;
  compsWeight: number;
  comparableValuations: ComparableValuations;
  recommendation: Recommendation;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const ValuationSummaryCards: React.FC<Props> = ({
  financialData, dcfValue, comparableValue, blendedValue,
  dcfWeight, compsWeight, comparableValuations, recommendation,
  cardClass, textClass, textMutedClass, currency,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
    {[
      { label: 'Current Price', value: formatPrice(financialData.currentStockPrice, currency), sublabel: 'Market', color: 'border-gray-500' },
      { label: 'DCF Value', value: formatPrice(dcfValue, currency), sublabel: `${dcfWeight}% Weight`, color: 'border-blue-500', tooltip: 'DCF' },
      { label: 'Comps Value', value: formatPrice(comparableValue, currency), sublabel: `${compsWeight}% Weight (${comparableValuations.source})`, color: 'border-purple-500' },
      { label: 'Blended Value', value: formatPrice(blendedValue, currency), sublabel: recommendation.text, color: 'border-red-500' },
    ].map(({ label, value, sublabel, color, tooltip }) => (
      <div key={label} className={`p-4 rounded-xl border-l-4 ${color} ${cardClass}`}>
        <div className={`text-sm ${textMutedClass}`}>
          {tooltip ? <Tooltip term={tooltip}>{label}</Tooltip> : label}
        </div>
        <div className={`text-2xl font-bold mt-1 ${textClass}`}>{value}</div>
        <div className={`text-xs mt-1 ${textMutedClass}`}>{sublabel}</div>
      </div>
    ))}
  </div>
);
