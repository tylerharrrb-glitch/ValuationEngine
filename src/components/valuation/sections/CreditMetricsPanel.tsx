/**
 * Credit Metrics Panel — Task #12
 * Consolidated credit/leverage analytics with investment-grade assessment.
 * Shows DSCR, Net Debt/EBITDA, Interest Coverage, Debt/Capital, FFO/Debt.
 */
import React from 'react';
import { Tooltip } from '../../Tooltip';
import { FinancialData } from '../../../types/financial';
import { formatMultiple, CurrencyCode } from '../../../utils/formatters';

interface Props {
  financialData: FinancialData;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

interface CreditMetric {
  label: string;
  value: string;
  rawValue: number;
  tooltip: string;
  zone: 'safe' | 'watch' | 'danger';
}

export const CreditMetricsPanel: React.FC<Props> = ({
  financialData, isDarkMode, cardClass, textClass, textMutedClass,
}) => {
  const { incomeStatement: is, balanceSheet: bs } = financialData;
  const totalDebt = bs.shortTermDebt + bs.longTermDebt;
  const ebitda = is.operatingIncome + is.depreciation + is.amortization;
  const dAndA = is.depreciation + is.amortization;
  const netDebt = totalDebt - bs.cash;

  // DSCR: EBITDA / (Interest Expense + Short-term Debt as proxy for principal repayments)
  const debtService = is.interestExpense + (bs.shortTermDebt * 0.2); // 20% of ST debt as annual principal proxy
  const dscr = debtService > 0 ? ebitda / debtService : 999;

  // Interest Coverage: EBIT / Interest
  const interestCoverage = is.interestExpense > 0
    ? is.operatingIncome / is.interestExpense : 999;

  // Net Debt / EBITDA
  const netDebtEbitda = ebitda > 0 ? netDebt / ebitda : 0;

  // Debt / Total Capital
  const totalCapital = totalDebt + bs.totalEquity;
  const debtToCapital = totalCapital > 0 ? (totalDebt / totalCapital) * 100 : 0;

  // FFO / Total Debt (Funds From Operations)
  const ffo = is.netIncome + dAndA; // Simplified FFO
  const ffoToDebt = totalDebt > 0 ? (ffo / totalDebt) * 100 : 999;

  // Current Ratio
  const currentRatio = bs.totalCurrentLiabilities > 0
    ? bs.totalCurrentAssets / bs.totalCurrentLiabilities : 0;

  // Classify zones
  const getZone = (metric: string, value: number): 'safe' | 'watch' | 'danger' => {
    switch (metric) {
      case 'dscr': return value > 2.0 ? 'safe' : value > 1.2 ? 'watch' : 'danger';
      case 'coverage': return value > 4.0 ? 'safe' : value > 2.0 ? 'watch' : 'danger';
      case 'ndEbitda': return value < 2.0 ? 'safe' : value < 4.0 ? 'watch' : 'danger';
      case 'debtCap': return value < 40 ? 'safe' : value < 60 ? 'watch' : 'danger';
      case 'ffoDebt': return value > 30 ? 'safe' : value > 15 ? 'watch' : 'danger';
      case 'current': return value > 1.5 ? 'safe' : value > 1.0 ? 'watch' : 'danger';
      default: return 'watch';
    }
  };

  const zoneColor = (z: 'safe' | 'watch' | 'danger') =>
    z === 'safe' ? 'text-green-400' : z === 'watch' ? 'text-yellow-400' : 'text-red-400';
  const zoneBg = (z: 'safe' | 'watch' | 'danger') =>
    z === 'safe' ? (isDarkMode ? 'bg-green-950/20 border-green-600/30' : 'bg-green-50 border-green-200')
    : z === 'watch' ? (isDarkMode ? 'bg-yellow-950/20 border-yellow-600/30' : 'bg-yellow-50 border-yellow-200')
    : (isDarkMode ? 'bg-red-950/20 border-red-600/30' : 'bg-red-50 border-red-200');

  const metrics: CreditMetric[] = [
    { label: 'DSCR', value: dscr < 100 ? `${dscr.toFixed(2)}x` : '>99x', rawValue: dscr, tooltip: 'Debt Service Coverage Ratio = EBITDA / (Interest + Principal). >2.0x = safe, <1.2x = distress.', zone: getZone('dscr', dscr) },
    { label: 'Interest Coverage', value: interestCoverage < 100 ? `${interestCoverage.toFixed(1)}x` : '>99x', rawValue: interestCoverage, tooltip: 'EBIT / Interest Expense. >4x = investment-grade, <2x = speculative.', zone: getZone('coverage', interestCoverage) },
    { label: 'Net Debt/EBITDA', value: `${netDebtEbitda.toFixed(1)}x`, rawValue: netDebtEbitda, tooltip: 'Net Debt / EBITDA. <2x = low leverage, >4x = high leverage.', zone: getZone('ndEbitda', netDebtEbitda) },
    { label: 'Debt/Capital', value: `${debtToCapital.toFixed(1)}%`, rawValue: debtToCapital, tooltip: 'Total Debt / (Debt + Equity). <40% = conservative, >60% = aggressive.', zone: getZone('debtCap', debtToCapital) },
    { label: 'FFO/Debt', value: ffoToDebt < 999 ? `${ffoToDebt.toFixed(1)}%` : 'N/A', rawValue: ffoToDebt, tooltip: 'Funds From Operations / Total Debt. >30% = investment-grade.', zone: getZone('ffoDebt', ffoToDebt) },
    { label: 'Current Ratio', value: formatMultiple(currentRatio), rawValue: currentRatio, tooltip: 'Current Assets / Current Liabilities. >1.5x = comfortable, <1.0x = liquidity risk.', zone: getZone('current', currentRatio) },
  ];

  // Composite credit quality score
  const safeCount = metrics.filter(m => m.zone === 'safe').length;
  const dangerCount = metrics.filter(m => m.zone === 'danger').length;
  const creditQuality = dangerCount >= 3 ? { label: 'DISTRESSED', color: 'text-red-400', bg: isDarkMode ? 'bg-red-950/30 border-red-600/40' : 'bg-red-50 border-red-200' }
    : dangerCount >= 1 ? { label: 'SPECULATIVE', color: 'text-yellow-400', bg: isDarkMode ? 'bg-yellow-950/30 border-yellow-600/40' : 'bg-yellow-50 border-yellow-200' }
    : safeCount >= 5 ? { label: 'INVESTMENT GRADE', color: 'text-green-400', bg: isDarkMode ? 'bg-green-950/30 border-green-600/40' : 'bg-green-50 border-green-200' }
    : { label: 'MODERATE', color: 'text-blue-400', bg: isDarkMode ? 'bg-blue-950/30 border-blue-600/40' : 'bg-blue-50 border-blue-200' };

  return (
    <div className={`p-6 rounded-xl border ${cardClass}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${textClass}`}>
          <Tooltip term="Credit Metrics" definition="Consolidated credit analysis panel showing leverage, coverage, and liquidity metrics. Used by rating agencies (S&P, Moody's) to assess creditworthiness.">
            Credit Metrics
          </Tooltip>
          {' '}& Leverage Analysis
        </h3>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${creditQuality.bg} ${creditQuality.color}`}>
          {creditQuality.label}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        {metrics.map((m) => (
          <div key={m.label} className={`p-3 rounded-lg border-2 ${zoneBg(m.zone)} transition-colors`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-xs font-medium ${textMutedClass}`}>{m.label}</span>
              <Tooltip term={m.label} definition={m.tooltip} size={12} />
            </div>
            <div className={`text-xl font-bold font-mono ${zoneColor(m.zone)}`}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className={`text-xs ${textMutedClass} flex items-center gap-4`}>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Safe</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Watch</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> Danger</span>
        <span className="ml-auto">Thresholds based on S&P / Moody's corporate rating criteria</span>
      </div>
    </div>
  );
};
