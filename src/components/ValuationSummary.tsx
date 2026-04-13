import { useState } from 'react';
import { FinancialData, ValuationAssumptions, ComparableCompany, ValuationResult } from '../types/financial';
import { calculateDCF, calculateComparableValuation, calculateWACC } from '../utils/valuation';
import { formatCurrencyShort, formatPercent, formatPrice } from '../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { Target, Award, TrendingUp, TrendingDown, Scale, ChevronDown, ChevronUp, Gauge } from 'lucide-react';

interface Props {
  data: FinancialData;
  assumptions: ValuationAssumptions;
  comparables: ComparableCompany[];
}

export function ValuationSummary({ data, assumptions, comparables }: Props) {
  const [showSensitivity, setShowSensitivity] = useState(false);

  const { value: dcfValue } = calculateDCF(data, assumptions);
  const dcfPerShare = dcfValue / data.sharesOutstanding;
  const dcfUpside = ((dcfPerShare - data.currentStockPrice) / data.currentStockPrice) * 100;

  const compResults = calculateComparableValuation(data, comparables);

  const allResults: ValuationResult[] = [
    {
      method: 'DCF Valuation',
      value: dcfValue,
      perShare: dcfPerShare,
      upside: dcfUpside,
    },
    ...compResults,
  ];

  // Calculate weighted average
  const avgPerShare = allResults.reduce((sum, r) => sum + r.perShare, 0) / allResults.length;
  const avgUpside = ((avgPerShare - data.currentStockPrice) / data.currentStockPrice) * 100;

  // Calculate range
  const minValue = Math.min(...allResults.map(r => r.perShare));
  const maxValue = Math.max(...allResults.map(r => r.perShare));

  const chartData = allResults.map(r => ({
    name: r.method.replace(' Multiple', '').replace(' Valuation', ''),
    value: r.perShare,
    upside: r.upside,
  }));

  // WACC Sensitivity Analysis: compute DCF at different WACC levels
  const liveWACC = calculateWACC(data, assumptions);
  const sensitivityLevels = [-2, -1, 0, +1, +2];
  const sensitivityData = sensitivityLevels.map(delta => {
    const adjAssumptions = { ...assumptions, discountRate: Math.max(1, liveWACC + delta) };
    const { value } = calculateDCF(data, adjAssumptions);
    const perShare = value / data.sharesOutstanding;
    const upside = ((perShare - data.currentStockPrice) / data.currentStockPrice) * 100;
    return {
      label: delta === 0 ? `${liveWACC.toFixed(1)}% (Current)` : `${(liveWACC + delta).toFixed(1)}% (${delta > 0 ? '+' : ''}${delta}%)`,
      wacc: liveWACC + delta,
      perShare,
      upside,
      isCurrent: delta === 0,
    };
  });

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: { payload: { name: string; value: number; upside: number } }[] }) => {
    if (active && payload && payload.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
          <p className="text-white font-medium">{d.name}</p>
          <p className="text-red-400 text-sm">{formatPrice(d.value)} per share</p>
          <p className={`text-sm ${d.upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(d.upside, 2, true)} upside
          </p>
        </div>
      );
    }
    return null;
  };

  const getRecommendation = () => {
    if (avgUpside > 10) return { text: 'Buy', color: 'text-green-400', bg: 'bg-green-950/50', border: 'border-green-600' };
    if (avgUpside >= -10) return { text: 'Hold', color: 'text-yellow-400', bg: 'bg-yellow-950/30', border: 'border-yellow-700' };
    return { text: 'Sell', color: 'text-red-400', bg: 'bg-red-950/50', border: 'border-[var(--accent-gold)]' };
  };

  const recommendation = getRecommendation();

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-black rounded-xl p-6 border border-zinc-800">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent-gold)]/20 flex items-center justify-center">
          <Target className="w-4 h-4 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white">Valuation Summary</h2>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className={`rounded-xl p-5 border-2 ${recommendation.bg} ${recommendation.border}`}>
          <div className="flex items-center gap-2 mb-2">
            <Award className="w-5 h-5 text-yellow-500" />
            <p className="text-zinc-400 text-sm font-medium">Recommendation</p>
          </div>
          <p className={`text-3xl font-bold ${recommendation.color}`}>{recommendation.text}</p>
          <p className="text-zinc-500 text-sm mt-1">Based on all methods</p>
        </div>

        <div className="bg-zinc-900/70 rounded-xl p-5 border border-zinc-700">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-5 h-5 text-red-500" />
            <p className="text-zinc-400 text-sm font-medium">Fair Value Range</p>
          </div>
          <p className="text-2xl font-bold text-white">
            {formatPrice(minValue)} - {formatPrice(maxValue)}
          </p>
          <p className="text-red-400 text-sm mt-1">Avg: {formatPrice(avgPerShare)}</p>
        </div>

        <div className="bg-zinc-900/70 rounded-xl p-5 border border-zinc-700">
          <div className="flex items-center gap-2 mb-2">
            {avgUpside >= 0 ? (
              <TrendingUp className="w-5 h-5 text-green-500" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-500" />
            )}
            <p className="text-zinc-400 text-sm font-medium">Average Upside</p>
          </div>
          <p className={`text-2xl font-bold ${avgUpside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {formatPercent(avgUpside, 2, true)}
          </p>
          <p className="text-zinc-500 text-sm mt-1">vs Current: {formatPrice(data.currentStockPrice)}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-zinc-900/50 rounded-xl p-4 mb-6 border border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-400 mb-4">Valuation by Method (Price per Share)</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 30 }}>
            <XAxis type="number" stroke="#52525b" fontSize={12} tickFormatter={(v) => `$${v}`} />
            <YAxis type="category" dataKey="name" stroke="#52525b" fontSize={12} width={100} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={data.currentStockPrice} stroke="#ef4444" strokeWidth={2} strokeDasharray="5 5" label={{ value: 'Current', fill: '#ef4444', fontSize: 12 }} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <Cell
                  key={index}
                  fill={entry.upside >= 0 ? '#22c55e' : '#ef4444'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* WACC Sensitivity Toggle */}
      <div className="mb-6">
        <button
          onClick={() => setShowSensitivity(!showSensitivity)}
          className="flex items-center gap-2 w-full px-4 py-3 rounded-xl bg-zinc-900/70 border border-zinc-700 hover:border-[var(--accent-gold)]/50 transition-colors group"
        >
          <div className="w-7 h-7 rounded-lg bg-orange-600/20 flex items-center justify-center">
            <Gauge className="w-4 h-4 text-orange-500" />
          </div>
          <span className="text-sm font-semibold text-zinc-300 group-hover:text-white transition-colors">
            WACC Sensitivity Analysis
          </span>
          <span className="text-xs text-zinc-500 ml-1">
            ({liveWACC.toFixed(1)}% base)
          </span>
          <div className="ml-auto">
            {showSensitivity ? (
              <ChevronUp className="w-4 h-4 text-zinc-500" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-500" />
            )}
          </div>
        </button>

        {showSensitivity && (
          <div className="mt-3 bg-zinc-900/50 rounded-xl p-4 border border-zinc-800 animate-in fade-in duration-200">
            <p className="text-xs text-zinc-500 mb-3">
              How does the DCF fair value change with different discount rates?
            </p>
            <div className="grid grid-cols-5 gap-2">
              {sensitivityData.map((s, i) => (
                <div
                  key={i}
                  className={`rounded-lg p-3 text-center border transition-all ${s.isCurrent
                      ? 'bg-[var(--accent-gold)]/10 border-[var(--accent-gold)]/40'
                      : 'bg-zinc-800/50 border-zinc-700/50 hover:border-zinc-600'
                    }`}
                >
                  <p className={`text-xs font-medium mb-1 ${s.isCurrent ? 'text-red-400' : 'text-[var(--text-secondary)]'}`}>
                    WACC {s.wacc.toFixed(1)}%
                  </p>
                  <p className={`text-lg font-bold ${s.isCurrent ? 'text-white' : 'text-zinc-200'}`}>
                    {formatPrice(s.perShare)}
                  </p>
                  <p className={`text-xs font-medium mt-1 ${s.upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {formatPercent(s.upside, 1, true)}
                  </p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-600 mt-2 text-center">
              Lower WACC → higher fair value. A 1% decrease in WACC can significantly increase valuation for long-duration assets.
            </p>
          </div>
        )}
      </div>

      {/* Detailed Results Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-800">
              <th className="text-left py-3 px-4">Valuation Method</th>
              <th className="text-right py-3 px-4">Equity Value</th>
              <th className="text-right py-3 px-4">Per Share</th>
              <th className="text-right py-3 px-4">Upside/Downside</th>
            </tr>
          </thead>
          <tbody>
            {allResults.map((result, index) => (
              <tr key={index} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                <td className="py-3 px-4 text-white font-medium">{result.method}</td>
                <td className="py-3 px-4 text-right text-zinc-400">{formatCurrencyShort(result.value)}</td>
                <td className="py-3 px-4 text-right text-red-400 font-medium">{formatPrice(result.perShare)}</td>
                <td className={`py-3 px-4 text-right font-medium ${result.upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatPercent(result.upside, 2, true)}
                </td>
              </tr>
            ))}
            <tr className="bg-zinc-900/70 font-semibold">
              <td className="py-3 px-4 text-red-500">Average</td>
              <td className="py-3 px-4 text-right text-zinc-300">{formatCurrencyShort(avgPerShare * data.sharesOutstanding)}</td>
              <td className="py-3 px-4 text-right text-red-400">{formatPrice(avgPerShare)}</td>
              <td className={`py-3 px-4 text-right ${avgUpside >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatPercent(avgUpside, 2, true)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
