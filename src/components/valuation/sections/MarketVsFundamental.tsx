import React from 'react';
import { TrendingUp, Shield } from 'lucide-react';
import { FinancialData } from '../../../types/financial';
import { KeyMetrics, Recommendation } from '../../../utils/calculations/metrics';
import { formatPrice, formatPercent, formatCurrencyShort, formatMultiple, CurrencyCode } from '../../../utils/formatters';

interface Props {
  financialData: FinancialData;
  dcfValue: number;
  comparableValue: number;
  blendedValue: number;
  upside: number;
  dcfWeight: number;
  compsWeight: number;
  keyMetrics: KeyMetrics;
  recommendation: Recommendation;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const MarketVsFundamental: React.FC<Props> = ({
  financialData, dcfValue, comparableValue, blendedValue, upside,
  dcfWeight, compsWeight, keyMetrics, recommendation,
  isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => (
  <div className={`p-6 rounded-xl border ${cardClass}`}>
    <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
      <span className="inline mr-2 text-yellow-400">⚡</span>
      Market vs. Fundamental Comparison
    </h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
      <div className={`p-5 rounded-xl border-2 ${isDarkMode ? 'border-blue-500/50 bg-blue-500/5' : 'border-blue-500/30 bg-blue-50'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Shield size={20} className="text-blue-400" />
          <span className={`font-semibold ${textClass}`}>FUNDAMENTAL VALUE</span>
          <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400">What it's worth</span>
        </div>
        <div className={`text-3xl font-bold ${textClass}`}>{formatPrice(blendedValue, currency)}</div>
        <div className={`text-sm mt-2 ${textMutedClass}`}>Based on DCF ({dcfWeight}%) + Comps ({compsWeight}%)</div>
        <div className={`text-sm mt-1 ${textMutedClass}`}>DCF: {formatPrice(dcfValue, currency)} | Comps: {formatPrice(comparableValue, currency)}</div>
      </div>
      <div className={`p-5 rounded-xl border-2 ${isDarkMode ? 'border-purple-500/50 bg-purple-500/5' : 'border-purple-500/30 bg-purple-50'}`}>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={20} className="text-purple-400" />
          <span className={`font-semibold ${textClass}`}>MARKET VALUE</span>
          <span className="text-xs px-2 py-0.5 rounded bg-purple-500/20 text-purple-400">What people pay</span>
        </div>
        <div className={`text-3xl font-bold ${textClass}`}>{formatPrice(financialData.currentStockPrice, currency)}</div>
        <div className={`text-sm mt-2 ${textMutedClass}`}>Market Cap: {formatCurrencyShort(financialData.currentStockPrice * financialData.sharesOutstanding, currency)}</div>
        <div className="flex items-center gap-3 mt-1">
          <span className={`text-sm ${textMutedClass}`}>P/E: {formatMultiple(keyMetrics.peRatio)}</span>
          <span className={`text-sm ${textMutedClass}`}>EV/EBITDA: {formatMultiple(keyMetrics.evEbitda)}</span>
        </div>
      </div>
    </div>
    <div className={`p-4 rounded-xl ${upside > 10 ? 'bg-green-500/10 border border-green-500/30' : upside < -10 ? 'bg-red-500/10 border border-red-500/30' : 'bg-yellow-500/10 border border-yellow-500/30'}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <span className={`text-sm font-medium ${textMutedClass}`}>VALUATION GAP</span>
          <div className={`text-2xl font-bold ${upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {upside >= 0 ? '▲' : '▼'} {formatPercent(Math.abs(upside))} {upside >= 0 ? 'Undervalued' : 'Overvalued'}
          </div>
          <div className={`text-sm mt-1 ${textMutedClass}`}>
            {upside >= 0
              ? `Market is pricing ${formatPercent(Math.abs(upside))} below fundamental value — potential buying opportunity.`
              : `Market is pricing ${formatPercent(Math.abs(upside))} above fundamental value — fundamentals don't justify the premium.`}
          </div>
        </div>
        <div className={`px-5 py-3 rounded-xl text-center ${recommendation.bg}`}>
          <div className={`text-2xl font-bold ${recommendation.color}`}>{recommendation.text}</div>
          <div className={`text-xs ${textMutedClass} mt-1`}>WOLF Rating</div>
        </div>
      </div>
    </div>
  </div>
);
