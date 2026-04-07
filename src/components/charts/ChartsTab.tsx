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
import { HistoricalTrendsChart } from './HistoricalTrendsChart';

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
  const gridStroke = '#1E2D45';
  const axisStroke = '#8892A4';
  const tooltipStyle = {
    backgroundColor: '#141B2D',
    border: '1px solid #1E2D45',
    borderRadius: '8px',
    color: '#F0F4FF',
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: '.78rem',
  };
  const labelColor = '#F0F4FF';

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

      {/* Historical Trends (Phase 4, Task #24) */}
      {financialData.historicalData && financialData.historicalData.length >= 2 && (
        <HistoricalTrendsChart
          historicalData={financialData.historicalData}
          ticker={financialData.ticker}
          isDarkMode={isDarkMode}
          currency={currency}
        />
      )}

      {/* Revenue & FCF Projections */}
      <div className="wolf-card">
        <span className="section-label" style={{ marginBottom: '16px' }}>REVENUE & FCF PROJECTIONS</span>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueProjectionData}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#C9A84C" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#C9A84C" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorFCF" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="year" stroke={axisStroke} tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }} />
              <YAxis stroke={axisStroke} tick={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }} />
              <RechartsTooltip contentStyle={tooltipStyle} labelStyle={{ color: labelColor }} itemStyle={{ color: labelColor }} formatter={(value: number | string | undefined) => [formatPrice(Number(value || 0), currency), undefined]} />
              <Legend />
              <Area type="monotone" dataKey="Revenue" stroke="#C9A84C" fillOpacity={1} fill="url(#colorRevenue)" />
              <Area type="monotone" dataKey="FCF" stroke="#3B82F6" fillOpacity={1} fill="url(#colorFCF)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Valuation Comparison */}
      <div className="wolf-card">
        <span className="section-label" style={{ marginBottom: '16px' }}>VALUATION COMPARISON</span>
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
              <ReferenceLine y={financialData.currentStockPrice} stroke="#C9A84C" strokeDasharray="5 5" />
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
      <div className="wolf-card">
        <span className="section-label" style={{ marginBottom: '16px' }}>SENSITIVITY: WACC VS TERMINAL GROWTH</span>
        <h3 style={{ fontFamily: 'var(--ff-body)', fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '16px' }}>
          <Tooltip term="WACC">DCF Fair Value ({currency})</Tooltip>
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
                    <tr style={{ color: 'var(--text-secondary)' }}>
                      <th className="py-2 px-3 text-left font-semibold sticky left-0 z-10" style={{ background: 'var(--bg-card)', fontFamily: 'var(--ff-mono)', fontSize: '.78rem' }}>WACC \ Growth</th>
                      {growthAxis.map(g => <th key={g} className="py-2 px-3 text-right font-semibold" style={{ fontFamily: 'var(--ff-mono)', fontSize: '.78rem', color: Math.abs(g - baseG) < 0.1 ? 'var(--accent-gold)' : 'var(--text-secondary)' }}>{g.toFixed(1)}%{Math.abs(g - baseG) < 0.1 ? ' ★' : ''}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {waccAxis.map(wacc => (
                      <tr key={wacc} style={{ borderTop: '1px solid var(--border)', background: Math.abs(wacc - baseW) < 0.1 ? 'var(--bg-secondary)' : 'transparent' }}>
                        <td className="py-2 px-3 font-medium sticky left-0 z-10" style={{ background: 'var(--bg-card)', fontFamily: 'var(--ff-mono)', fontSize: '.78rem', color: Math.abs(wacc - baseW) < 0.1 ? 'var(--accent-gold)' : 'var(--text-primary)', fontWeight: Math.abs(wacc - baseW) < 0.1 ? 700 : 500 }}>{wacc.toFixed(2)}%{Math.abs(wacc - baseW) < 0.1 ? ' ★' : ''}</td>
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
                            <td key={growth} className="py-2 px-3 text-right" style={{ fontFamily: 'var(--ff-mono)', fontSize: '.78rem', background: isBase ? 'rgba(201,168,76,.15)' : 'transparent', fontWeight: isBase ? 700 : 400, boxShadow: isBase ? 'inset 0 0 0 2px rgba(201,168,76,.4)' : 'none', color: vs > 0 ? '#4ade80' : '#f87171' }}>
                              {formatPrice(price, currency)}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--ff-mono)' }}>
                ★ Base case WACC: {baseW.toFixed(2)}% | Terminal Growth: {baseG.toFixed(2)}%
              </div>
            </>
          );
        })()}
      </div>

      {/* Sensitivity: Revenue Growth vs Margin Improvement */}
      <div className="wolf-card">
        <span className="section-label" style={{ marginBottom: '16px' }}>SENSITIVITY: REVENUE GROWTH VS MARGIN</span>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-secondary)' }}>
                <th className="py-2 px-3 text-left font-semibold sticky left-0 z-10" style={{ background: 'var(--bg-card)', fontFamily: 'var(--ff-mono)', fontSize: '.78rem' }}>Rev Growth \ Margin Imp</th>
                {[-0.5, 0, 0.5, 1.0, 1.5].map(m => <th key={m} className="py-2 px-3 text-right font-semibold">{m >= 0 ? '+' : ''}{m}%</th>)}
              </tr>
            </thead>
            <tbody>
              {[4, 6, 8, 10, 12].map(revGrowth => (
                <tr key={revGrowth} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-2 px-3 font-medium sticky left-0 z-10" style={{ background: 'var(--bg-card)', fontFamily: 'var(--ff-mono)', fontSize: '.78rem', color: 'var(--text-primary)' }}>{revGrowth}%</td>
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
                      <td key={marginImp} className="py-2 px-3 text-right" style={{ fontFamily: 'var(--ff-mono)', fontSize: '.78rem', background: isBase ? 'rgba(201,168,76,.15)' : 'transparent', fontWeight: isBase ? 700 : 400, color: vs > 0 ? '#4ade80' : '#f87171' }}>
                        {formatPrice(price, currency)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-3 text-sm" style={{ color: 'var(--text-muted)', fontFamily: 'var(--ff-mono)', fontSize: '.72rem' }}>
          Shows how implied share price changes with different revenue growth rates and annual margin improvement assumptions.
        </div>
      </div>

      {/* Monte Carlo Simulation */}
      <div className="wolf-card">
        <span className="section-label" style={{ marginBottom: '16px' }}>MONTE CARLO SIMULATION</span>
        <h3 style={{ fontFamily: 'var(--ff-body)', fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '16px' }}>
          5,000 Scenarios
        </h3>

        {isMCLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 mb-2" style={{ borderBottom: '2px solid var(--accent-gold)' }}></div>
            <p style={{ color: 'var(--text-secondary)', fontFamily: 'var(--ff-mono)' }}>Running 5,000 scenarios...</p>
          </div>
        )}

        {!isMCLoading && mcResult && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="wolf-stat-card">
                <div className="wolf-stat-label">Mean Price</div>
                <div className="wolf-stat-value" style={{ fontSize: '1.2rem' }}>{formatPrice(mcResult.meanPrice, currency)}</div>
              </div>
              <div className="wolf-stat-card">
                <div className="wolf-stat-label">Median Price</div>
                <div className="wolf-stat-value" style={{ fontSize: '1.2rem' }}>{formatPrice(mcResult.medianPrice, currency)}</div>
              </div>
              <div className={`p-4 rounded-lg border ${mcResult.probabilityAboveCurrentPrice > 50 ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-[var(--accent-gold)]/30'}`}>
                <div className="wolf-stat-label">P(Above Current Price)</div>
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
                const bgColor = pPct > 5 ? 'bg-red-500/10 border border-[var(--accent-gold)]/30' : pPct > 1 ? 'bg-yellow-500/10 border border-yellow-500/30' : 'bg-green-500/10 border border-green-500/30';
                return (
                  <div className={`p-4 rounded-lg ${bgColor}`}>
                    <div className={`text-sm ${textMutedClass}`}>P(Below Bear Case)</div>
                    <div className={`text-xl font-bold ${color}`}>{pPct.toFixed(1)}%</div>
                  </div>
                );
              })()}
              <div className="wolf-stat-card">
                <div className="wolf-stat-label">Std Deviation</div>
                <div className="wolf-stat-value" style={{ fontSize: '1.2rem' }}>{formatPrice(mcResult.stdDev, currency)}</div>
              </div>
            </div>
            {/* Percentile range */}
            <div className="wolf-stat-card" style={{ marginBottom: '16px', textAlign: 'left' }}>
              <div className="wolf-stat-label" style={{ marginBottom: '8px' }}>Confidence Intervals</div>
              <div className="grid grid-cols-5 gap-2 text-center">
                {[
                  { label: '5th %ile', value: mcResult.percentile5, color: 'text-red-400' },
                  { label: '25th %ile', value: mcResult.percentile25, color: 'text-yellow-400' },
                  { label: 'Median', value: mcResult.medianPrice, color: 'text-green-400' },
                  { label: '75th %ile', value: mcResult.percentile75, color: 'text-yellow-400' },
                  { label: '95th %ile', value: mcResult.percentile95, color: 'text-red-400' },
                ].map(p => (
                  <div key={p.label}>
                    <div className={`text-xs ${p.color}`} style={{ fontFamily: 'var(--ff-mono)' }}>{p.label}</div>
                    <div className="text-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--ff-mono)' }}>{formatPrice(p.value, currency)}</div>
                  </div>
                ))}
              </div>
              {/* Visual range bar */}
              <div className="mt-3 relative h-6">
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-2 rounded-full" style={{ background: 'linear-gradient(to right, rgba(201,168,76,.4), rgba(59,130,246,.4), rgba(201,168,76,.4))' }} />
                {(() => {
                  const range = mcResult.percentile95 - mcResult.percentile5;
                  const curPos = range > 0 ? Math.min(100, Math.max(0, ((financialData.currentStockPrice - mcResult.percentile5) / range) * 100)) : 50;
                  return (
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2" style={{ left: `${curPos}%` }}>
                      <div className="w-4 h-4 rounded-full border-2 border-white" style={{ background: 'var(--accent-gold)' }} title="Current Price" />
                    </div>
                  );
                })()}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs" style={{ color: 'var(--accent-gold)', fontFamily: 'var(--ff-mono)' }}>{formatPrice(mcResult.percentile5, currency)}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--ff-mono)' }}>Current: {formatPrice(financialData.currentStockPrice, currency)}</span>
                <span className="text-xs" style={{ color: 'var(--accent-gold)', fontFamily: 'var(--ff-mono)' }}>{formatPrice(mcResult.percentile95, currency)}</span>
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
                  <Bar dataKey="count" fill="#C9A84C" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-2 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--ff-mono)' }}>
              Simulates 5,000 scenarios varying revenue growth (±4%), WACC (±1.5%), terminal growth (±0.8%), and margin (±0.5%).
            </div>
          </>
        )}
      </div>

      {/* Sector Benchmarking */}
      <div className="wolf-card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="section-label">SECTOR BENCHMARKING</span>
            <h3 style={{ fontFamily: 'var(--ff-body)', fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
              {financialData.ticker} vs {industryMultiples.label}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="wolf-stat-value" style={{ fontSize: '1.8rem', color: benchmark.overallScore >= 70 ? '#4ade80' : benchmark.overallScore >= 50 ? '#facc15' : '#f87171' }}>{benchmark.overallScore}</span>
            <span className="wolf-stat-label">/100</span>
          </div>
        </div>
        <div className="mb-4 p-3 rounded-lg" style={{ background: 'var(--bg-secondary)' }}>
          <div className="text-sm font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--ff-body)' }}>{benchmark.overallRating}</div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--ff-mono)' }}>{benchmark.insight}</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ color: 'var(--text-secondary)', fontFamily: 'var(--ff-mono)', fontSize: '.75rem' }}>
                <th className="text-left py-2 px-3 font-semibold">Metric</th>
                <th className="text-right py-2 px-3 font-semibold">{financialData.ticker}</th>
                <th className="text-right py-2 px-3 font-semibold">Sector Median</th>
                <th className="text-center py-2 px-3 font-semibold">Percentile</th>
                <th className="text-center py-2 px-3 font-semibold">Rating</th>
              </tr>
            </thead>
            <tbody>
              {benchmark.benchmarks.map((b) => (
                <tr key={b.metric} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-2 px-3" style={{ color: 'var(--text-primary)', fontFamily: 'var(--ff-mono)', fontSize: '.78rem' }}>{b.metric}</td>
                  <td className="py-2 px-3 text-right font-medium" style={{ color: 'var(--text-primary)', fontFamily: 'var(--ff-mono)', fontSize: '.78rem' }}>{b.formatted.company}</td>
                  <td className="py-2 px-3 text-right" style={{ color: 'var(--text-secondary)', fontFamily: 'var(--ff-mono)', fontSize: '.78rem' }}>{b.formatted.sector}</td>
                  <td className="py-2 px-3 text-center">
                    <div className="w-full rounded-full h-1.5 mx-auto max-w-[80px]" style={{ background: 'var(--border)' }}>
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
        <div className="mt-3 text-xs" style={{ color: 'var(--text-muted)', fontFamily: 'var(--ff-mono)' }}>
          Using EGX Market Average defaults. Add sector-specific peers for more accurate benchmarking.
        </div>
      </div>
    </div>
  );
};

export default ChartsTab;
