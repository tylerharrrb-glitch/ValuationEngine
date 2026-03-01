/**
 * Charts Tab – Football Field, Revenue Projections, Valuation Comparison,
 * Sensitivity Analysis (2 tables), Monte Carlo Simulation, and Sector Benchmarking.
 */
import { useState, useEffect, useRef } from 'react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts';
import { FinancialData, ValuationAssumptions, DCFProjection } from '../../types/financial';
import { ScenarioType } from '../ScenarioToggle';
import { Tooltip } from '../Tooltip';
import { FootballFieldChart } from '../FootballFieldChart';
import { IndustryMultiples } from '../../utils/calculations/comparables';
import { getIndustryForTicker } from '../../utils/industryMapping';
import { calculateSectorBenchmarks, MonteCarloResult } from '../../utils/advancedAnalysis';
import { formatPrice, CurrencyCode } from '../../utils/formatters';

interface ChartDataPoint { year: string | number; Revenue?: number; FCF?: number; }
interface ValuationComparisonPoint { name: string; value: number; fill: string; }
interface ValuationRange { method: string; low: number; mid: number; high: number; color: string; }

export interface ChartsTabProps {
  financialData: FinancialData;
  adjustedAssumptions: ValuationAssumptions;
  dcfProjections: DCFProjection[];
  revenueProjectionData: ChartDataPoint[];
  valuationComparisonData: ValuationComparisonPoint[];
  footballFieldData: ValuationRange[];
  industryMultiples: IndustryMultiples;
  scenario: ScenarioType;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const ChartsTab: React.FC<ChartsTabProps> = ({
  financialData, adjustedAssumptions, dcfProjections,
  revenueProjectionData, valuationComparisonData, footballFieldData,
  industryMultiples, isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => {
  const gridStroke = isDarkMode ? '#27272a' : '#e5e7eb';
  const axisStroke = isDarkMode ? '#71717a' : '#9ca3af';
  const tooltipStyle = {
    backgroundColor: isDarkMode ? '#1f2937' : '#fff',
    border: isDarkMode ? '1px solid #4b5563' : '1px solid #e5e7eb',
    borderRadius: '8px',
    color: isDarkMode ? '#ffffff' : '#111827',
  };
  const labelColor = isDarkMode ? '#ffffff' : '#111827';

  // Monte Carlo State
  const [mcResult, setMcResult] = useState<MonteCarloResult | null>(null);
  const [isMCLoading, setIsMCLoading] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize Worker
    workerRef.current = new Worker(new URL('../../workers/monteCarlo.worker.ts', import.meta.url));

    workerRef.current.onmessage = (e) => {
      const { success, result, error } = e.data;
      if (success) {
        setMcResult(result);
      } else {
        console.error('Monte Carlo Simulation Failed:', error);
      }
      setIsMCLoading(false);
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  useEffect(() => {
    // Trigger Simulation when data changes
    if (workerRef.current) {
      setIsMCLoading(true);
      // Small debounce to avoid flashing or queued msg issues if user types fast
      const timer = setTimeout(() => {
        workerRef.current?.postMessage({
          financialData,
          assumptions: adjustedAssumptions
        });
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [financialData, adjustedAssumptions]);

  const sector = getIndustryForTicker(financialData.ticker);
  const benchmark = calculateSectorBenchmarks(financialData, sector);

  return (
    <div className="space-y-6">
      {/* Football Field Chart */}
      <FootballFieldChart
        valuations={footballFieldData}
        currentPrice={financialData.currentStockPrice}
        isDarkMode={isDarkMode}
        currency={currency}
      />

      {/* Revenue & FCF Projections */}
      <div className={`p-6 rounded-xl border ${cardClass}`}>
        <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Revenue & FCF Projections (in Billions)</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueProjectionData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorFCF" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="year" stroke={axisStroke} />
              <YAxis stroke={axisStroke} />
              <RechartsTooltip contentStyle={tooltipStyle} labelStyle={{ color: labelColor }} itemStyle={{ color: labelColor }} formatter={(value: number | string | undefined) => [formatPrice(Number(value || 0), currency), undefined]} />
              <Legend />
              <Area type="monotone" dataKey="Revenue" stroke="#ef4444" fillOpacity={1} fill="url(#colorRevenue)" />
              <Area type="monotone" dataKey="FCF" stroke="#22c55e" fillOpacity={1} fill="url(#colorFCF)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Valuation Comparison */}
      <div className={`p-6 rounded-xl border ${cardClass}`}>
        <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Valuation Comparison</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={valuationComparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="name" stroke={axisStroke} />
              <YAxis stroke={axisStroke} />
              <RechartsTooltip
                contentStyle={tooltipStyle} labelStyle={{ color: labelColor }} itemStyle={{ color: labelColor }}
                formatter={(value: number | string | undefined) => [formatPrice(Number(value || 0), currency), 'Price']}
              />
              <ReferenceLine y={financialData.currentStockPrice} stroke="#ef4444" strokeDasharray="5 5" />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {valuationComparisonData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sensitivity: WACC vs Terminal Growth */}
      <div className={`p-6 rounded-xl border ${cardClass}`}>
        <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
          <Tooltip term="WACC">Sensitivity: DCF Fair Value ({currency}) — WACC vs Terminal Growth</Tooltip>
        </h3>
        {/* C1 Fix: Dynamic axes centered on actual computed WACC and growth */}
        {(() => {
          const baseW = adjustedAssumptions.discountRate;
          const baseG = adjustedAssumptions.terminalGrowthRate;
          const waccAxis = [baseW - 4, baseW - 2, baseW, baseW + 2, baseW + 4];
          const growthAxis = [-3, -1.5, 0, 1.5, 3].map(d => {
            const val = baseG + d;
            return Math.max(4, Math.min(baseW - 1, val));
          });
          return (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className={textMutedClass}>
                      <th className={`py-2 px-3 text-left font-semibold sticky left-0 z-10 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>WACC \ Growth</th>
                      {growthAxis.map(g => <th key={g} className={`py-2 px-3 text-right font-semibold ${Math.abs(g - baseG) < 0.1 ? 'text-red-400' : ''}`}>{g.toFixed(1)}%{Math.abs(g - baseG) < 0.1 ? ' ★' : ''}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {waccAxis.map(wacc => (
                      <tr key={wacc} className={`${isDarkMode ? 'border-t border-zinc-800' : 'border-t border-gray-200'} ${Math.abs(wacc - baseW) < 0.1 ? (isDarkMode ? 'bg-zinc-900' : 'bg-gray-50') : ''}`}>
                        <td className={`py-2 px-3 font-medium ${textClass} sticky left-0 z-10 ${isDarkMode ? 'bg-black' : 'bg-white'} ${Math.abs(wacc - baseW) < 0.1 ? 'text-red-400 font-bold' : ''}`}>{wacc.toFixed(2)}%{Math.abs(wacc - baseW) < 0.1 ? ' ★' : ''}</td>
                        {growthAxis.map(growth => {
                          if (growth >= wacc) {
                            return <td key={growth} className="py-2 px-3 text-right text-zinc-500">N/A</td>;
                          }
                          const sumPV = dcfProjections.reduce((sum, p) => {
                            const df = Math.pow(1 + wacc / 100, dcfProjections.indexOf(p) + 1);
                            return sum + p.freeCashFlow / df;
                          }, 0);
                          const lastFCF = dcfProjections[dcfProjections.length - 1]?.freeCashFlow || 0;
                          const tv = (lastFCF * (1 + growth / 100)) / ((wacc - growth) / 100);
                          const lastDF = Math.pow(1 + wacc / 100, dcfProjections.length);
                          const ev = sumPV + tv / lastDF;
                          const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
                          const equity = ev - totalDebt + financialData.balanceSheet.cash;
                          const price = Math.max(equity / financialData.sharesOutstanding, 0);
                          const vs = ((price - financialData.currentStockPrice) / financialData.currentStockPrice) * 100;
                          const isBase = Math.abs(wacc - baseW) < 0.1 && Math.abs(growth - baseG) < 0.1;
                          return (
                            <td key={growth} className={`py-2 px-3 text-right ${isBase ? 'bg-red-500/20 font-bold ring-2 ring-red-500/50' : ''} ${vs > 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {formatPrice(price, currency)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className={`mt-3 text-xs ${textMutedClass}`}>
                ★ Base case WACC: {baseW.toFixed(2)}% | Terminal Growth: {baseG.toFixed(2)}%
              </div>
            </>
          );
        })()}
      </div>

      {/* Sensitivity: Revenue Growth vs Margin Improvement */}
      <div className={`p-6 rounded-xl border ${cardClass}`}>
        <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Sensitivity Analysis: Revenue Growth vs Margin Improvement</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={textMutedClass}>
                <th className={`py-2 px-3 text-left font-semibold sticky left-0 z-10 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>Rev Growth \ Margin Imp</th>
                {[-0.5, 0, 0.5, 1.0, 1.5].map(m => <th key={m} className="py-2 px-3 text-right font-semibold">{m >= 0 ? '+' : ''}{m}%</th>)}
              </tr>
            </thead>
            <tbody>
              {[4, 6, 8, 10, 12].map(revGrowth => (
                <tr key={revGrowth} className={isDarkMode ? 'border-t border-zinc-800' : 'border-t border-gray-200'}>
                  <td className={`py-2 px-3 font-medium ${textClass} sticky left-0 z-10 ${isDarkMode ? 'bg-black' : 'bg-white'}`}>{revGrowth}%</td>
                  {[-0.5, 0, 0.5, 1.0, 1.5].map(marginImp => {
                    let revenue = financialData.incomeStatement.revenue;
                    const baseFCFMargin = financialData.cashFlowStatement.freeCashFlow / financialData.incomeStatement.revenue;
                    let sumPV = 0, lastFCF = 0;
                    for (let yr = 1; yr <= adjustedAssumptions.projectionYears; yr++) {
                      revenue *= (1 + revGrowth / 100);
                      const margin = baseFCFMargin + (marginImp / 100) * yr;
                      const fcf = revenue * margin;
                      sumPV += fcf / Math.pow(1 + adjustedAssumptions.discountRate / 100, yr);
                      lastFCF = fcf;
                    }
                    const tv = (lastFCF * (1 + adjustedAssumptions.terminalGrowthRate / 100)) / ((adjustedAssumptions.discountRate - adjustedAssumptions.terminalGrowthRate) / 100);
                    const lastDF = Math.pow(1 + adjustedAssumptions.discountRate / 100, adjustedAssumptions.projectionYears);
                    const ev = sumPV + tv / lastDF;
                    const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
                    const equity = ev - totalDebt + financialData.balanceSheet.cash;
                    const price = Math.max(equity / financialData.sharesOutstanding, 0);
                    const vs = ((price - financialData.currentStockPrice) / financialData.currentStockPrice) * 100;
                    const isBase = Math.abs(revGrowth - adjustedAssumptions.revenueGrowthRate) < 1 && Math.abs(marginImp - adjustedAssumptions.marginImprovement) < 0.3;
                    return (
                      <td key={marginImp} className={`py-2 px-3 text-right ${isBase ? 'bg-red-500/20 font-bold' : ''} ${vs > 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {formatPrice(price, currency)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className={`mt-3 text-sm ${textMutedClass}`}>
          Shows how implied share price changes with different revenue growth rates and annual margin improvement assumptions.
        </div>
      </div>

      {/* Monte Carlo Simulation */}
      <div className={`p-6 rounded-xl border ${cardClass}`}>
        <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
          Monte Carlo Simulation (5,000 runs)
        </h3>

        {isMCLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mb-2"></div>
            <p className={textMutedClass}>Running 5,000 scenarios...</p>
          </div>
        )}

        {!isMCLoading && mcResult && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                <div className={`text-sm ${textMutedClass}`}>Mean Price</div>
                <div className={`text-xl font-bold ${textClass}`}>{formatPrice(mcResult.meanPrice, currency)}</div>
              </div>
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                <div className={`text-sm ${textMutedClass}`}>Median Price</div>
                <div className={`text-xl font-bold ${textClass}`}>{formatPrice(mcResult.medianPrice, currency)}</div>
              </div>
              <div className={`p-4 rounded-lg ${mcResult.probabilityAboveCurrentPrice > 50 ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                <div className={`text-sm ${textMutedClass}`}>P(Above Current Price)</div>
                <div className={`text-xl font-bold ${mcResult.probabilityAboveCurrentPrice > 50 ? 'text-green-400' : 'text-red-400'}`}>
                  {mcResult.probabilityAboveCurrentPrice}%
                </div>
              </div>
              {/* IMP4: P(Below Bear Case) — uses normal CDF approximation */}
              {(() => {
                // Compute Bear price from scenario params
                const bearGrowth = adjustedAssumptions.revenueGrowthRate * 0.40;
                const bearWACC = adjustedAssumptions.discountRate + 2.5;
                const bearTG = adjustedAssumptions.terminalGrowthRate * 0.75;
                const taxR = adjustedAssumptions.taxRate / 100;
                let rev = financialData.incomeStatement.revenue;
                let sumPV = 0; let lastFCF = 0;
                for (let yr = 1; yr <= adjustedAssumptions.projectionYears; yr++) {
                  const prevRev = rev;
                  rev *= (1 + bearGrowth / 100);
                  const adjMargin = adjustedAssumptions.ebitdaMargin + (-1.5 * yr);
                  const ebitda = rev * (adjMargin / 100);
                  const da = rev * (adjustedAssumptions.daPercent / 100);
                  const nopat = (ebitda - da) * (1 - taxR);
                  const capex = rev * (adjustedAssumptions.capexPercent / 100);
                  const dwc = (rev - prevRev) * (adjustedAssumptions.deltaWCPercent / 100);
                  const fcf = nopat + da - capex - dwc;
                  sumPV += fcf / Math.pow(1 + bearWACC / 100, yr);
                  lastFCF = fcf;
                }
                const tgDec = bearTG / 100; const wDec = bearWACC / 100;
                const tv = wDec > tgDec ? (lastFCF * (1 + tgDec)) / (wDec - tgDec) : lastFCF * 12;
                const ev = sumPV + tv / Math.pow(1 + wDec, adjustedAssumptions.projectionYears);
                const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
                const bearPrice = Math.max((ev - totalDebt + financialData.balanceSheet.cash) / financialData.sharesOutstanding, 0);
                // Normal CDF via Abramowitz & Stegun
                const z = mcResult.stdDev > 0 ? (bearPrice - mcResult.meanPrice) / mcResult.stdDev : 0;
                const t = 1 / (1 + 0.2316419 * Math.abs(z));
                const d = 0.3989422802 * Math.exp(-z * z / 2);
                const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
                const pBelowBear = z > 0 ? 1 - p : p;
                const pPct = pBelowBear * 100;
                const color = pPct > 5 ? 'text-red-400' : pPct > 1 ? 'text-yellow-400' : 'text-green-400';
                const bgColor = pPct > 5 ? 'bg-red-500/10 border border-red-500/30' : pPct > 1 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-green-500/10 border border-green-500/30';
                return (
                  <div className={`p-4 rounded-lg ${bgColor}`}>
                    <div className={`text-sm ${textMutedClass}`}>P(Below Bear Case)</div>
                    <div className={`text-xl font-bold ${color}`}>{pPct.toFixed(1)}%</div>
                  </div>
                );
              })()}
              <div className={`p-4 rounded-lg ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
                <div className={`text-sm ${textMutedClass}`}>Std Deviation</div>
                <div className={`text-xl font-bold ${textClass}`}>{formatPrice(mcResult.stdDev, currency)}</div>
              </div>
            </div>
            {/* Percentile range */}
            <div className={`p-4 rounded-lg mb-4 ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
              <div className={`text-sm font-medium mb-2 ${textMutedClass}`}>Confidence Intervals</div>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: '5th %ile', value: mcResult.percentile5, color: 'text-red-400' },
                  { label: '25th %ile', value: mcResult.percentile25, color: 'text-yellow-400' },
                  { label: 'Median', value: mcResult.medianPrice, color: 'text-green-400' },
                  { label: '75th %ile', value: mcResult.percentile75, color: 'text-yellow-400' },
                  { label: '95th %ile', value: mcResult.percentile95, color: 'text-red-400' },
                ].map(p => (
                  <div key={p.label}>
                    <div className={`text-xs ${p.color}`}>{p.label}</div>
                    <div className={`text-sm font-bold ${textClass}`}>{formatPrice(p.value, currency)}</div>
                  </div>
                ))}
              </div>
              {/* Visual range bar */}
              <div className="mt-3 relative h-6">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full bg-gradient-to-r from-red-500/40 via-green-500/40 to-red-500/40" />
                {(() => {
                  const range = mcResult.percentile95 - mcResult.percentile5;
                  const curPos = range > 0 ? Math.min(100, Math.max(0, ((financialData.currentStockPrice - mcResult.percentile5) / range) * 100)) : 50;
                  return (
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${curPos}%` }}>
                      <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white" title="Current Price" />
                    </div>
                  );
                })()}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-red-400">{formatPrice(mcResult.percentile5, currency)}</span>
                <span className={`text-xs ${textMutedClass}`}>Current: {formatPrice(financialData.currentStockPrice, currency)}</span>
                <span className="text-xs text-red-400">{formatPrice(mcResult.percentile95, currency)}</span>
              </div>
            </div>
            {/* Distribution histogram */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={mcResult.distribution.filter((d: any) => d.count > 0)}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
                  <XAxis dataKey="bucket" stroke={axisStroke} tick={{ fontSize: 9 }} angle={-45} textAnchor="end" height={50} />
                  <YAxis stroke={axisStroke} tick={{ fontSize: 10 }} />
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    labelStyle={{ color: labelColor }}
                    formatter={(value: number | string | undefined) => [`${value} sims`, 'Count']}
                  />
                  <Bar dataKey="count" fill="#ef4444" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className={`mt-2 text-xs ${textMutedClass}`}>
              Simulates 5,000 scenarios varying revenue growth (±4%), WACC (±1.5%), terminal growth (±0.8%), and margin (±0.5%).
            </div>
          </>
        )}
      </div>

      {/* Sector Benchmarking */}
      <div className={`p-6 rounded-xl border ${cardClass}`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className={`text-lg font-semibold ${textClass}`}>
            Sector Benchmarking — {financialData.ticker} vs {industryMultiples.label}
          </h3>
          <div className="flex items-center gap-2">
            <span className={`text-2xl font-bold ${benchmark.overallScore >= 70 ? 'text-green-400' :
              benchmark.overallScore >= 50 ? 'text-yellow-400' : 'text-red-400'
              }`}>{benchmark.overallScore}</span>
            <span className={`text-sm ${textMutedClass}`}>/100</span>
          </div>
        </div>
        <div className={`mb-4 p-3 rounded-lg ${isDarkMode ? 'bg-zinc-800/50' : 'bg-gray-50'}`}>
          <div className={`text-sm font-medium ${textClass}`}>{benchmark.overallRating}</div>
          <div className={`text-xs ${textMutedClass}`}>{benchmark.insight}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={textMutedClass}>
                <th className="text-left py-2 px-3 font-semibold">Metric</th>
                <th className="text-right py-2 px-3 font-semibold">{financialData.ticker}</th>
                <th className="text-right py-2 px-3 font-semibold">Sector Median</th>
                <th className="text-center py-2 px-3 font-semibold">Percentile</th>
                <th className="text-center py-2 px-3 font-semibold">Rating</th>
              </tr>
            </thead>
            <tbody>
              {benchmark.benchmarks.map((b) => (
                <tr key={b.metric} className={isDarkMode ? 'border-t border-zinc-800' : 'border-t border-gray-200'}>
                  <td className={`py-2 px-3 ${textClass}`}>{b.metric}</td>
                  <td className={`py-2 px-3 text-right font-medium ${textClass}`}>{b.formatted.company}</td>
                  <td className={`py-2 px-3 text-right ${textMutedClass}`}>{b.formatted.sector}</td>
                  <td className="py-2 px-3 text-center">
                    <div className="w-full bg-zinc-700 rounded-full h-1.5 mx-auto max-w-[80px]">
                      <div className={`h-1.5 rounded-full ${b.percentile >= 70 ? 'bg-green-500' : b.percentile >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        }`} style={{ width: `${b.percentile}%` }} />
                    </div>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`px-2 py-0.5 rounded text-xs font-semibold ${b.rating === 'top' ? 'text-green-400 bg-green-500/20' :
                      b.rating === 'above' ? 'text-blue-400 bg-blue-500/20' :
                        b.rating === 'average' ? 'text-yellow-400 bg-yellow-500/20' :
                          b.rating === 'below' ? 'text-orange-400 bg-orange-500/20' :
                            'text-red-400 bg-red-500/20'
                      }`}>{b.rating.toUpperCase()}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* M2: Benchmarking data source note */}
        <div className={`mt-3 text-xs ${textMutedClass}`}>
          Using EGX Market Average defaults. Add sector-specific peers for more accurate benchmarking.
        </div>
      </div>
    </div>
  );
};

export default ChartsTab;
