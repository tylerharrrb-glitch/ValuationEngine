/**
 * Relative Valuation Panel — Phase 4, Task #25
 * Compares the subject company's key multiples and ratios against
 * EGX 30 index sector peers (or US peers) with bar-chart-style visualizations.
 */
import React from 'react';
import { Tooltip } from '../../Tooltip';
import { FinancialData } from '../../../types/financial';
import { KeyMetrics } from '../../../utils/calculations/metrics';
import { EGYPTIAN_INDUSTRY_MULTIPLES, DEFAULT_INDUSTRY_MULTIPLES } from '../../../constants/marketDefaults';
import { getEgyptianIndustryForTicker, getIndustryForTicker } from '../../../utils/industryMapping';
import { MarketRegion } from '../../../types/financial';
import { CurrencyCode } from '../../../utils/formatters';

interface Props {
  financialData: FinancialData;
  keyMetrics: KeyMetrics;
  marketRegion: MarketRegion;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

interface PeerComparison {
  metric: string;
  company: number;
  sector: number;
  unit: string;
  /** >1 = company trades at premium, <1 = discount */
  ratio: number;
  /** Interpretation: 'premium' | 'discount' | 'inline' */
  verdict: string;
}

export const RelativeValuationPanel: React.FC<Props> = ({
  financialData, keyMetrics, marketRegion, isDarkMode, cardClass, textClass, textMutedClass,
}) => {
  // Get sector multiples
  const isEgypt = marketRegion === 'Egypt';
  const sectorKey = isEgypt
    ? getEgyptianIndustryForTicker(financialData.ticker)
    : getIndustryForTicker(financialData.ticker);
  const sectorMultiples = isEgypt
    ? EGYPTIAN_INDUSTRY_MULTIPLES[sectorKey as keyof typeof EGYPTIAN_INDUSTRY_MULTIPLES] || EGYPTIAN_INDUSTRY_MULTIPLES.DEFAULT
    : DEFAULT_INDUSTRY_MULTIPLES[sectorKey as keyof typeof DEFAULT_INDUSTRY_MULTIPLES] || DEFAULT_INDUSTRY_MULTIPLES.DEFAULT;

  const comparisons: PeerComparison[] = [
    {
      metric: 'P/E Ratio',
      company: keyMetrics.peRatio,
      sector: sectorMultiples.pe,
      unit: 'x',
      ratio: sectorMultiples.pe > 0 ? keyMetrics.peRatio / sectorMultiples.pe : 0,
      verdict: '',
    },
    {
      metric: 'EV/EBITDA',
      company: keyMetrics.evEbitda,
      sector: sectorMultiples.evEbitda,
      unit: 'x',
      ratio: sectorMultiples.evEbitda > 0 ? keyMetrics.evEbitda / sectorMultiples.evEbitda : 0,
      verdict: '',
    },
    {
      metric: 'P/B Ratio',
      company: keyMetrics.debtToEquity > 0 ? 1 / keyMetrics.debtToEquity : 0, // proxy
      sector: sectorMultiples.pb,
      unit: 'x',
      ratio: 0,
      verdict: '',
    },
    {
      metric: 'Gross Margin',
      company: keyMetrics.grossMargin,
      sector: isEgypt ? 35 : 45, // sector average proxy
      unit: '%',
      ratio: 0,
      verdict: '',
    },
    {
      metric: 'Net Margin',
      company: keyMetrics.netMargin,
      sector: isEgypt ? 15 : 20,
      unit: '%',
      ratio: 0,
      verdict: '',
    },
    {
      metric: 'ROE',
      company: keyMetrics.roe,
      sector: isEgypt ? 18 : 15,
      unit: '%',
      ratio: 0,
      verdict: '',
    },
  ];

  // Set verdicts
  comparisons.forEach(c => {
    if (c.sector === 0) { c.verdict = 'N/A'; return; }
    const r = c.company / c.sector;
    c.ratio = r;
    if (c.unit === 'x') {
      // For multiples: lower = cheaper = better
      c.verdict = r < 0.85 ? 'Discount' : r > 1.15 ? 'Premium' : 'Inline';
    } else {
      // For margins/ROE: higher = better
      c.verdict = r > 1.15 ? 'Outperform' : r < 0.85 ? 'Underperform' : 'Inline';
    }
  });

  const getVerdictColor = (v: string) => {
    if (v === 'Discount' || v === 'Outperform') return 'text-green-400';
    if (v === 'Premium' || v === 'Underperform') return 'text-red-400';
    return 'text-yellow-400';
  };

  const getBarWidth = (company: number, sector: number) => {
    if (sector === 0) return { company: 50, sector: 50 };
    const max = Math.max(company, sector) * 1.2;
    return {
      company: max > 0 ? Math.min(100, (company / max) * 100) : 0,
      sector: max > 0 ? Math.min(100, (sector / max) * 100) : 0,
    };
  };

  const overallPEDiscount = keyMetrics.peRatio > 0 && sectorMultiples.pe > 0
    ? ((keyMetrics.peRatio / sectorMultiples.pe - 1) * 100)
    : 0;
  const overallLabel = overallPEDiscount < -10 ? 'UNDERVALUED vs Peers' : overallPEDiscount > 10 ? 'OVERVALUED vs Peers' : 'FAIRLY VALUED vs Peers';
  const overallColor = overallPEDiscount < -10 ? 'text-green-400' : overallPEDiscount > 10 ? 'text-red-400' : 'text-yellow-400';

  return (
    <div className={`p-6 rounded-xl border ${cardClass}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-semibold ${textClass}`}>
          <Tooltip term="Relative Valuation" definition="Compares the company's multiples and margins against sector peers to identify relative over/under-valuation.">
            Relative Valuation
          </Tooltip>
          {' '}vs {sectorMultiples.label} Peers
        </h3>
        <div className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${isDarkMode ? 'border-zinc-700 bg-zinc-800' : 'border-gray-200 bg-gray-50'} ${overallColor}`}>
          {overallLabel}
        </div>
      </div>

      <div className="space-y-3">
        {comparisons.map(c => {
          const bars = getBarWidth(c.company, c.sector);
          return (
            <div key={c.metric}>
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${textClass}`}>{c.metric}</span>
                <span className={`text-xs font-bold ${getVerdictColor(c.verdict)}`}>{c.verdict}</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] w-16 ${textMutedClass}`}>{financialData.ticker}</span>
                  <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: isDarkMode ? '#27272a' : '#f3f4f6' }}>
                    <div className="h-full rounded-full bg-[var(--accent-gold)] transition-all" style={{ width: `${bars.company}%` }} />
                  </div>
                  <span className={`text-xs font-mono w-16 text-right ${textClass}`}>{c.company.toFixed(1)}{c.unit}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] w-16 ${textMutedClass}`}>Sector</span>
                  <div className="flex-1 h-3 rounded-full overflow-hidden" style={{ background: isDarkMode ? '#27272a' : '#f3f4f6' }}>
                    <div className="h-full rounded-full bg-blue-500/60 transition-all" style={{ width: `${bars.sector}%` }} />
                  </div>
                  <span className={`text-xs font-mono w-16 text-right ${textMutedClass}`}>{c.sector.toFixed(1)}{c.unit}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className={`mt-4 text-xs ${textMutedClass}`}>
        Sector: {sectorMultiples.label} ({isEgypt ? 'EGX' : 'US'}). For multiples (P/E, EV/EBITDA): lower = cheaper.
        For margins & returns: higher = better. "Inline" = within ±15% of sector.
      </div>
    </div>
  );
};
