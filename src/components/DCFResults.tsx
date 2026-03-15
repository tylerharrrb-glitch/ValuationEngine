import { FinancialData, ValuationAssumptions, DCFProjection } from '../types/financial';
import { calculateDCF, calculateEBITDA, calculateEnterpriseValue } from '../utils/valuation';
import { formatCurrencyShort, formatPercent, formatPrice, formatNumber } from '../utils/formatters';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Legend } from 'recharts';
import { TrendingUp, DollarSign, Calculator } from 'lucide-react';

interface Props {
  data: FinancialData;
  assumptions: ValuationAssumptions;
}

export function DCFResults({ data, assumptions }: Props) {
  const { value: dcfValue, projections } = calculateDCF(data, assumptions);
  const perShare = dcfValue / data.sharesOutstanding;
  const upside = ((perShare - data.currentStockPrice) / data.currentStockPrice) * 100;

  const ebitda = calculateEBITDA(data);
  const ev = calculateEnterpriseValue(data);
  const marketCap = data.currentStockPrice * data.sharesOutstanding;

  const chartData = projections.map((p: DCFProjection) => ({
    year: `Year ${p.year}`,
    Revenue: p.revenue / 1e9,
    'Free Cash Flow': p.freeCashFlow / 1e9,
    'Present Value': p.presentValue / 1e9,
  }));

  const evEbitda = ebitda > 0 ? ev / ebitda : 0;

  const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
          <p className="text-zinc-300 font-medium mb-2">{label}</p>
          {payload.map((entry, index) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: ${formatNumber(entry.value, 2)}B
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-black rounded-xl p-6 border border-zinc-800">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent-gold)]/20 flex items-center justify-center">
          <Calculator className="w-4 h-4 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white">DCF Valuation Results</h2>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-950/50 to-green-900/20 rounded-xl p-4 border border-green-800/50">
          <p className="text-green-400 text-xs font-medium mb-1">Intrinsic Value</p>
          <p className="text-2xl font-bold text-white">{formatCurrencyShort(dcfValue)}</p>
          <p className="text-green-300 text-sm">{formatPrice(perShare)} / share</p>
        </div>

        <div className="bg-gradient-to-br from-zinc-900 to-zinc-800/50 rounded-xl p-4 border border-zinc-700/50">
          <p className="text-zinc-400 text-xs font-medium mb-1">Current Price</p>
          <p className="text-2xl font-bold text-white">{formatPrice(data.currentStockPrice)}</p>
          <p className="text-zinc-400 text-sm">Mkt Cap: {formatCurrencyShort(marketCap)}</p>
        </div>

        <div className={`bg-gradient-to-br rounded-xl p-4 border ${upside >= 0 ? 'from-green-950/50 to-green-900/20 border-green-800/50' : 'from-red-950/50 to-red-900/20 border-red-800/50'}`}>
          <p className={`text-xs font-medium mb-1 ${upside >= 0 ? 'text-green-400' : 'text-red-400'}`}>Upside/Downside</p>
          <p className="text-2xl font-bold text-white">{formatPercent(upside, 2, true)}</p>
          <p className={`text-sm ${upside >= 0 ? 'text-green-300' : 'text-red-300'}`}>
            {upside >= 0 ? 'Undervalued' : 'Overvalued'}
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-950/50 to-red-900/20 rounded-xl p-4 border border-red-800/50">
          <p className="text-red-400 text-xs font-medium mb-1">Current EV/EBITDA</p>
          <p className="text-2xl font-bold text-white">{formatNumber(evEbitda, 1)}x</p>
          <p className="text-red-300 text-sm">EV: {formatCurrencyShort(ev)}</p>
        </div>
      </div>

      {/* Projections Table */}
      <div className="mb-6 overflow-x-auto">
        <h3 className="text-sm font-semibold text-zinc-400 mb-3">Cash Flow Projections</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-zinc-500 border-b border-zinc-800">
              <th className="text-left py-2 px-3">Year</th>
              <th className="text-right py-2 px-3">Revenue</th>
              <th className="text-right py-2 px-3">EBITDA</th>
              <th className="text-right py-2 px-3">FCF</th>
              <th className="text-right py-2 px-3">Discount Factor</th>
              <th className="text-right py-2 px-3">Present Value</th>
            </tr>
          </thead>
          <tbody>
            {projections.map((p: DCFProjection) => (
              <tr key={p.year} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                <td className="py-2 px-3 text-white font-medium">Year {p.year}</td>
                <td className="py-2 px-3 text-right text-zinc-400">{formatCurrencyShort(p.revenue)}</td>
                <td className="py-2 px-3 text-right text-zinc-400">{formatCurrencyShort(p.ebitda)}</td>
                <td className="py-2 px-3 text-right text-green-400">{formatCurrencyShort(p.freeCashFlow)}</td>
                <td className="py-2 px-3 text-right text-zinc-500">{formatNumber(p.discountFactor, 3)}</td>
                <td className="py-2 px-3 text-right text-red-400">{formatCurrencyShort(p.presentValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-zinc-300">Revenue & FCF Projection</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="year" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `$${v}B`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#71717a' }} />
              <Bar dataKey="Revenue" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Free Cash Flow" fill="#22c55e" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-800">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-semibold text-zinc-300">Present Value Over Time</h3>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis dataKey="year" stroke="#71717a" fontSize={12} />
              <YAxis stroke="#71717a" fontSize={12} tickFormatter={(v) => `$${v}B`} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ color: '#71717a' }} />
              <Line type="monotone" dataKey="Present Value" stroke="#ef4444" strokeWidth={2} dot={{ fill: '#ef4444' }} />
              <Line type="monotone" dataKey="Free Cash Flow" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
