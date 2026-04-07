/**
 * Historical Trends Chart — Phase 4, Task #24
 * Visualizes 3-5 years of historical IS/BS/CF data using Recharts.
 * Auto-populated from the FMP API fetch or manual HistoricalDataPanel.
 */
import React, { useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { HistoricalYear } from '../../types/financial';
import { formatCurrencyShort, CurrencyCode } from '../../utils/formatters';

interface Props {
  historicalData: HistoricalYear[];
  ticker: string;
  isDarkMode: boolean;
  currency: CurrencyCode;
}

type ChartView = 'revenue' | 'profitability' | 'balance_sheet' | 'cash_flow';

export const HistoricalTrendsChart: React.FC<Props> = ({
  historicalData, ticker, isDarkMode, currency,
}) => {
  const [activeView, setActiveView] = useState<ChartView>('revenue');

  // Sort oldest → newest for charts
  const sorted = [...historicalData]
    .filter(y => y.year > 0 && y.revenue > 0)
    .sort((a, b) => a.year - b.year);

  if (sorted.length < 2) return null;

  const gridStroke = isDarkMode ? '#1E2D45' : '#e5e7eb';
  const axisStroke = isDarkMode ? '#8892A4' : '#6b7280';
  const tooltipStyle = {
    backgroundColor: isDarkMode ? '#141B2D' : '#fff',
    border: `1px solid ${isDarkMode ? '#1E2D45' : '#e5e7eb'}`,
    borderRadius: '8px',
    color: isDarkMode ? '#F0F4FF' : '#111',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '.78rem',
  };

  const views: { key: ChartView; label: string }[] = [
    { key: 'revenue', label: 'Revenue & Income' },
    { key: 'profitability', label: 'Margins' },
    { key: 'balance_sheet', label: 'Balance Sheet' },
    { key: 'cash_flow', label: 'Cash Flow' },
  ];

  // Revenue & Income chart data
  const revenueData = sorted.map(y => ({
    year: y.year.toString(),
    Revenue: y.revenue,
    'Net Income': y.netIncome,
    'Gross Margin': y.grossMargin,
  }));

  // Margin data
  const marginData = sorted.map(y => ({
    year: y.year.toString(),
    'Gross Margin': y.grossMargin,
    'Net Margin': y.revenue > 0 ? (y.netIncome / y.revenue) * 100 : 0,
    'ROE': y.totalEquity > 0 ? (y.netIncome / y.totalEquity) * 100 : 0,
    'ROA': y.totalAssets > 0 ? (y.netIncome / y.totalAssets) * 100 : 0,
  }));

  // Balance Sheet data
  const bsData = sorted.map(y => ({
    year: y.year.toString(),
    'Total Assets': y.totalAssets,
    'Total Equity': y.totalEquity,
    'Long-term Debt': y.longTermDebt,
    'D/E Ratio': y.totalEquity > 0 ? (y.longTermDebt / y.totalEquity * 100) : 0,
  }));

  // Cash Flow data
  const cfData = sorted.map(y => ({
    year: y.year.toString(),
    'Operating CF': y.operatingCashFlow,
    'CapEx': y.capex,
    'Free CF': y.operatingCashFlow - y.capex,
  }));

  // Compute CAGRs
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  const yrs = sorted.length - 1;
  const revCAGR = oldest.revenue > 0 ? (Math.pow(newest.revenue / oldest.revenue, 1 / yrs) - 1) * 100 : 0;
  const niCAGR = oldest.netIncome > 0 && newest.netIncome > 0 ? (Math.pow(newest.netIncome / oldest.netIncome, 1 / yrs) - 1) * 100 : 0;

  const cgrColor = (v: number) => v > 0 ? 'text-green-400' : 'text-red-400';

  const tabCls = (key: ChartView) =>
    `px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${activeView === key
      ? 'bg-[var(--accent-gold)] text-[var(--bg-primary)] font-semibold'
      : isDarkMode ? 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200' : 'text-gray-500 hover:bg-gray-100'}`;

  const formatAxis = (value: number) => {
    if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
    if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(0)}K`;
    return value.toFixed(1);
  };

  return (
    <div className="wolf-card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <span className="section-label">HISTORICAL TRENDS</span>
          <h3 style={{ fontFamily: 'var(--ff-body)', fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
            {ticker} — {sorted.length}-Year Financial History ({oldest.year}–{newest.year})
          </h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`text-xs ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>Rev CAGR:</span>
            <span className={`text-xs font-bold font-mono ${cgrColor(revCAGR)}`}>{revCAGR.toFixed(1)}%</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`text-xs ${isDarkMode ? 'text-zinc-500' : 'text-gray-500'}`}>NI CAGR:</span>
            <span className={`text-xs font-bold font-mono ${cgrColor(niCAGR)}`}>{niCAGR.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      {/* View tabs */}
      <div className="flex gap-1 mb-4">
        {views.map(v => (
          <button key={v.key} onClick={() => setActiveView(v.key)} className={tabCls(v.key)}>{v.label}</button>
        ))}
      </div>

      {/* Charts */}
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          {activeView === 'revenue' ? (
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="year" stroke={axisStroke} />
              <YAxis stroke={axisStroke} tickFormatter={formatAxis} />
              <RechartsTooltip contentStyle={tooltipStyle} formatter={(v: number | string | undefined) => [formatCurrencyShort(Number(v || 0), currency), undefined]} />
              <Legend />
              <Bar dataKey="Revenue" fill="#C9A84C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Net Income" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : activeView === 'profitability' ? (
            <LineChart data={marginData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="year" stroke={axisStroke} />
              <YAxis stroke={axisStroke} unit="%" />
              <RechartsTooltip contentStyle={tooltipStyle} formatter={(v: number | string | undefined) => [`${Number(v || 0).toFixed(1)}%`, undefined]} />
              <Legend />
              <Line type="monotone" dataKey="Gross Margin" stroke="#C9A84C" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="Net Margin" stroke="#3B82F6" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="ROE" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="ROA" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          ) : activeView === 'balance_sheet' ? (
            <BarChart data={bsData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="year" stroke={axisStroke} />
              <YAxis stroke={axisStroke} tickFormatter={formatAxis} />
              <RechartsTooltip contentStyle={tooltipStyle} formatter={(v: number | string | undefined) => [formatCurrencyShort(Number(v || 0), currency), undefined]} />
              <Legend />
              <Bar dataKey="Total Assets" fill="#C9A84C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Total Equity" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Long-term Debt" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          ) : (
            <BarChart data={cfData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="year" stroke={axisStroke} />
              <YAxis stroke={axisStroke} tickFormatter={formatAxis} />
              <RechartsTooltip contentStyle={tooltipStyle} formatter={(v: number | string | undefined) => [formatCurrencyShort(Number(v || 0), currency), undefined]} />
              <Legend />
              <Bar dataKey="Operating CF" fill="#C9A84C" radius={[4, 4, 0, 0]} />
              <Bar dataKey="CapEx" fill="#ef4444" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Free CF" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Data table */}
      <div className="overflow-x-auto mt-4">
        <table className="w-full text-xs">
          <thead>
            <tr style={{ color: 'var(--text-secondary)', fontFamily: 'var(--ff-mono)', fontSize: '.72rem' }}>
              <th className="text-left py-1 px-2">Year</th>
              <th className="text-right py-1 px-2">Revenue</th>
              <th className="text-right py-1 px-2">Net Income</th>
              <th className="text-right py-1 px-2">Gross Margin</th>
              <th className="text-right py-1 px-2">Net Margin</th>
              <th className="text-right py-1 px-2">Total Assets</th>
              <th className="text-right py-1 px-2">Debt</th>
              <th className="text-right py-1 px-2">OCF</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((y, idx) => {
              const netMargin = y.revenue > 0 ? (y.netIncome / y.revenue * 100) : 0;
              const prevRev = idx > 0 ? sorted[idx - 1].revenue : 0;
              const revGrowth = prevRev > 0 ? ((y.revenue - prevRev) / prevRev * 100) : 0;
              return (
                <tr key={y.year} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-1.5 px-2 font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--ff-mono)' }}>{y.year}</td>
                  <td className="py-1.5 px-2 text-right font-mono" style={{ color: 'var(--text-primary)' }}>
                    {formatCurrencyShort(y.revenue, currency)}
                    {idx > 0 && <span className={`ml-1 text-[10px] ${revGrowth > 0 ? 'text-green-400' : 'text-red-400'}`}>{revGrowth > 0 ? '+' : ''}{revGrowth.toFixed(0)}%</span>}
                  </td>
                  <td className={`py-1.5 px-2 text-right font-mono ${y.netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrencyShort(y.netIncome, currency)}</td>
                  <td className="py-1.5 px-2 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{y.grossMargin.toFixed(1)}%</td>
                  <td className="py-1.5 px-2 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{netMargin.toFixed(1)}%</td>
                  <td className="py-1.5 px-2 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{formatCurrencyShort(y.totalAssets, currency)}</td>
                  <td className="py-1.5 px-2 text-right font-mono" style={{ color: 'var(--text-secondary)' }}>{formatCurrencyShort(y.longTermDebt, currency)}</td>
                  <td className={`py-1.5 px-2 text-right font-mono ${y.operatingCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrencyShort(y.operatingCashFlow, currency)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--ff-mono)' }}>
        {sorted.length}-year history auto-populated from FMP API. Manual overrides available in Input → Historical Data panel.
      </div>
    </div>
  );
};
