/**
 * SOTP (Sum-of-the-Parts) Panel — Phase 4, Task #20
 * Multi-segment valuation with individual multiples and holding company discount.
 */
import React, { useState, useMemo } from 'react';
import { Tooltip } from '../../Tooltip';
import { FinancialData } from '../../../types/financial';
import { calculateSOTP, SOTPSegment, DEFAULT_SOTP_SEGMENTS } from '../../../utils/calculations/sotpEngine';
import { formatCurrencyShort, CurrencyCode } from '../../../utils/formatters';

interface Props {
  financialData: FinancialData;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const SOTPPanel: React.FC<Props> = ({
  financialData, isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => {
  const [segments, setSegments] = useState<SOTPSegment[]>(DEFAULT_SOTP_SEGMENTS);
  const [holdingDiscount, setHoldingDiscount] = useState(10);

  const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const netDebt = totalDebt - financialData.balanceSheet.cash;

  const result = useMemo(() =>
    calculateSOTP(segments, netDebt, financialData.sharesOutstanding, financialData.currentStockPrice, holdingDiscount),
    [segments, netDebt, financialData.sharesOutstanding, financialData.currentStockPrice, holdingDiscount]
  );

  const inputCls = `px-2 py-1 rounded text-sm text-right font-mono ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border`;

  const updateSegment = (idx: number, key: keyof SOTPSegment, val: string | number) => {
    setSegments(prev => prev.map((s, i) => i === idx ? { ...s, [key]: val } : s));
  };

  const addSegment = () => {
    setSegments(prev => [...prev, { name: `Segment ${prev.length + 1}`, revenue: 0, ebitdaMargin: 20, evEbitdaMultiple: 8, peMultiple: 0, netIncome: 0 }]);
  };

  const removeSegment = (idx: number) => {
    if (segments.length > 1) setSegments(prev => prev.filter((_, i) => i !== idx));
  };

  const upsideColor = result.upside > 10 ? 'text-green-400' : result.upside > -10 ? 'text-yellow-400' : 'text-red-400';
  const segColors = ['text-blue-400', 'text-purple-400', 'text-emerald-400', 'text-orange-400', 'text-pink-400', 'text-cyan-400'];

  return (
    <div className={`p-6 rounded-xl border ${cardClass}`}>
      <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
        <Tooltip term="SOTP" definition="Sum-of-the-Parts: values each business segment independently with its own multiple, then aggregates to a consolidated equity value.">
          SOTP
        </Tooltip>
        {' '}— Sum-of-the-Parts Valuation
      </h3>

      {/* Segment Inputs */}
      <div className="space-y-3 mb-4">
        {segments.map((seg, idx) => (
          <div key={idx} className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
            <div className="flex items-center justify-between mb-2">
              <input
                type="text" value={seg.name}
                onChange={e => updateSegment(idx, 'name', e.target.value)}
                className={`text-sm font-semibold bg-transparent border-none outline-none ${segColors[idx % segColors.length]} w-48`}
              />
              {segments.length > 1 && (
                <button onClick={() => removeSegment(idx)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div>
                <label className={`block text-[10px] ${textMutedClass}`}>Revenue</label>
                <input type="number" value={seg.revenue} onChange={e => updateSegment(idx, 'revenue', parseFloat(e.target.value) || 0)}
                  className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label className={`block text-[10px] ${textMutedClass}`}>EBITDA Margin %</label>
                <input type="number" value={seg.ebitdaMargin} step={1} onChange={e => updateSegment(idx, 'ebitdaMargin', parseFloat(e.target.value) || 0)}
                  className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label className={`block text-[10px] ${textMutedClass}`}>EV/EBITDA Multiple</label>
                <input type="number" value={seg.evEbitdaMultiple} step={0.5} onChange={e => updateSegment(idx, 'evEbitdaMultiple', parseFloat(e.target.value) || 0)}
                  className={`w-full ${inputCls}`} />
              </div>
              <div>
                <label className={`block text-[10px] ${textMutedClass}`}>Implied EV</label>
                <div className={`text-sm font-bold font-mono py-1 ${textClass}`}>{formatCurrencyShort(result.segments[idx]?.impliedEV || 0, currency)}</div>
              </div>
            </div>
          </div>
        ))}
        <button onClick={addSegment}
          className={`w-full py-2 rounded-lg border-2 border-dashed text-sm font-medium transition-colors ${isDarkMode ? 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}>
          + Add Segment
        </button>
      </div>

      {/* Holding Discount */}
      <div className="flex items-center gap-3 mb-4">
        <label className={`text-sm ${textMutedClass}`}>Holding Company Discount:</label>
        <input type="number" value={holdingDiscount} step={5} min={0} max={50}
          onChange={e => setHoldingDiscount(parseFloat(e.target.value) || 0)}
          className={`w-20 ${inputCls}`} />
        <span className={`text-xs ${textMutedClass}`}>%</span>
      </div>

      {/* Equity Bridge */}
      <div className="space-y-1 mb-4">
        {[
          { label: 'Gross Enterprise Value', value: result.totalEV, bold: true },
          { label: `Less: Holding Discount (${holdingDiscount}%)`, value: -result.holdingDiscount, bold: false },
          { label: 'Less: Net Debt', value: -result.netDebt, bold: false },
          { label: 'Implied Equity Value', value: result.equityValue, bold: true },
        ].map(item => (
          <div key={item.label} className={`flex justify-between py-1.5 px-3 rounded ${item.bold ? (isDarkMode ? 'bg-zinc-800/50' : 'bg-gray-50') : ''}`}>
            <span className={`text-sm ${item.bold ? `font-semibold ${textClass}` : textMutedClass}`}>{item.label}</span>
            <span className={`text-sm font-mono ${item.bold ? 'font-bold text-[var(--accent-gold)]' : textClass}`}>
              {formatCurrencyShort(Math.abs(item.value), currency)}
            </span>
          </div>
        ))}
      </div>

      {/* Per-share result */}
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-xs ${textMutedClass}`}>SOTP Fair Value</div>
          <div className={`text-2xl font-bold font-mono ${textClass}`}>{currency} {result.perShareValue.toFixed(2)}</div>
        </div>
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-xs ${textMutedClass}`}>Upside / Downside</div>
          <div className={`text-2xl font-bold font-mono ${upsideColor}`}>{result.upside > 0 ? '+' : ''}{result.upside.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  );
};
