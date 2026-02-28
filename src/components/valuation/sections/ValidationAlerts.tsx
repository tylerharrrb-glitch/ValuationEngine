import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { FinancialData, ValuationAssumptions, MarketRegion } from '../../../types/financial';
import { MARKET_DEFAULTS, EGYPTIAN_INDUSTRY_MULTIPLES } from '../../../constants/marketDefaults';
import { getEgyptianIndustryForTicker } from '../../../utils/industryMapping';
import { IndustryMultiples } from '../../../utils/calculations/comparables';
import { CurrencyCode } from '../../../utils/formatters';

interface Props {
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  adjustedAssumptions: ValuationAssumptions;
  hasValidComparables: boolean;
  industryMultiples: IndustryMultiples;
  marketRegion: MarketRegion;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const ValidationAlerts: React.FC<Props> = ({
  financialData, assumptions, adjustedAssumptions, hasValidComparables,
  industryMultiples, marketRegion,
}) => {
  const alerts: { type: 'error' | 'warning' | 'info'; message: string }[] = [];

  if (adjustedAssumptions.discountRate < assumptions.riskFreeRate)
    alerts.push({ type: 'error', message: `WACC (${adjustedAssumptions.discountRate}%) is less than Risk-Free Rate (${assumptions.riskFreeRate}%). This is mathematically impossible.` });
  if (adjustedAssumptions.terminalGrowthRate >= adjustedAssumptions.discountRate)
    alerts.push({ type: 'error', message: `Terminal Growth (${adjustedAssumptions.terminalGrowthRate}%) is >= WACC (${adjustedAssumptions.discountRate}%). This creates infinite value.` });

  const maxTG = MARKET_DEFAULTS[marketRegion].maxTerminalGrowth;
  if (adjustedAssumptions.terminalGrowthRate > maxTG) {
    alerts.push({
      type: 'warning', message: marketRegion === 'Egypt'
        ? `Terminal growth of ${adjustedAssumptions.terminalGrowthRate}% is very high. For Egypt (high inflation), consider 4-7% as sustainable long-term growth.`
        : `Terminal growth of ${adjustedAssumptions.terminalGrowthRate}% exceeds typical long-term GDP growth (~2-3%). Consider a rate ≤ ${maxTG}% for perpetuity.`
    });
  }
  if (marketRegion === 'Egypt' && adjustedAssumptions.revenueGrowthRate > 30)
    alerts.push({ type: 'warning', message: `Revenue growth of ${adjustedAssumptions.revenueGrowthRate}% is very aggressive even for Egypt's high-inflation environment.` });
  else if (marketRegion === 'USA' && adjustedAssumptions.revenueGrowthRate > 15 && financialData.incomeStatement.revenue > 50000000000)
    alerts.push({ type: 'warning', message: `Revenue growth of ${adjustedAssumptions.revenueGrowthRate}% is aggressive for a $${(financialData.incomeStatement.revenue / 1e9).toFixed(0)}B revenue company.` });
  if (marketRegion === 'Egypt' && assumptions.capmMethod !== 'A' && assumptions.marketRiskPremium < 8)
    alerts.push({ type: 'warning', message: `Market risk premium of ${assumptions.marketRiskPremium}% may be too low for Egypt. For USD Build-Up (Method B), emerging markets typically require 8-12% MRP.` });

  const baseFcfMargin = (financialData.cashFlowStatement.freeCashFlow / financialData.incomeStatement.revenue) * 100;
  if (adjustedAssumptions.marginImprovement < 0 && baseFcfMargin < 15)
    alerts.push({ type: 'warning', message: `Negative margin improvement (${adjustedAssumptions.marginImprovement}%) combined with low FCF margin (${baseFcfMargin.toFixed(1)}%) may undervalue the company.` });

  if (!hasValidComparables) {
    if (marketRegion === 'Egypt') {
      const eg = EGYPTIAN_INDUSTRY_MULTIPLES[getEgyptianIndustryForTicker(financialData.ticker)];
      alerts.push({ type: 'warning', message: `Using ${eg.label} default multiples (P/E: ${eg.pe}x, EV/EBITDA: ${eg.evEbitda}x). Add Egyptian peer companies for more accurate valuation.` });
    } else {
      alerts.push({ type: 'warning', message: `Using ${industryMultiples.label} default multiples (P/E: ${industryMultiples.pe}x, EV/EBITDA: ${industryMultiples.evEbitda}x). Add peer companies for more accurate comparable valuation.` });
    }
  }
  if (marketRegion === 'Egypt')
    alerts.push({ type: 'info', message: `⚠️ EGP Currency Risk: The Egyptian Pound has experienced significant devaluation. Consider exchange rate volatility when comparing to USD-based valuations.` });

  // High WACC warning — DCF becomes unreliable
  if (adjustedAssumptions.discountRate > 30) {
    alerts.push({ type: 'warning', message: `WACC of ${adjustedAssumptions.discountRate.toFixed(1)}% heavily discounts future cash flows. Consider using relative valuation methods (P/E, P/B) instead of DCF for more reliable results.` });
  }

  // Bank-specific valuation note
  const sector = (financialData.sector || '').toLowerCase();
  if (sector.includes('financial') || sector.includes('bank')) {
    alerts.push({ type: 'info', message: `🏦 Bank Valuation: Using P/E (60%) and P/B (40%) weighting. EV/EBITDA is excluded as it is not meaningful for financial institutions. Consider ROE and Net Interest Margin for additional analysis.` });
  }

  // === SECTION D EDGE CASES ===

  // D1: Revenue = 0 → hard block
  if (financialData.incomeStatement.revenue === 0) {
    alerts.push({ type: 'error', message: 'Revenue cannot be zero. Enter income statement data to proceed with valuation calculations.' });
  }

  // D3: Negative equity → warn
  if (financialData.balanceSheet.totalEquity < 0) {
    alerts.push({ type: 'warning', message: 'Negative equity detected. P/B ratio and book value metrics may be misleading. Ensure this reflects actual financial distress.' });
  }

  // D4: DPS = 0 → DDM not applicable (Bug #2 fix: also derive DPS from dividendsPaid)
  const derivedDPS = (financialData.cashFlowStatement.dividendsPaid > 0 && financialData.sharesOutstanding > 0)
    ? financialData.cashFlowStatement.dividendsPaid / financialData.sharesOutstanding
    : 0;
  const effectiveDPS = financialData.dividendsPerShare > 0 ? financialData.dividendsPerShare : derivedDPS;
  if (effectiveDPS === 0) {
    alerts.push({ type: 'info', message: 'DDM: Not Applicable — Company pays no dividends. Dividend Discount Models require positive DPS.' });
  }

  // D6: Beta ≤ 0 → unusual
  if (assumptions.beta <= 0) {
    alerts.push({ type: 'warning', message: `Beta ≤ 0 is unusual. β < 0 implies negative market correlation (rare). β = 0 implies risk-free, which is incorrect for equity. Typical range: 0.3 to 3.0.` });
  }

  // D7: Projection growth > 50%
  if (adjustedAssumptions.revenueGrowthRate > 50) {
    alerts.push({ type: 'warning', message: `Revenue growth > 50% is very aggressive. Verify this assumption — hypergrowth is difficult to sustain.` });
  }

  // Investment disclaimer — always present
  alerts.push({ type: 'info', message: `Past performance does not guarantee future results. Verify all data independently before making investment decisions.` });

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${alert.type === 'error' ? 'bg-red-500/20 border border-red-500/50'
          : alert.type === 'info' ? 'bg-blue-500/20 border border-blue-500/50'
            : 'bg-yellow-500/20 border border-yellow-500/50'
          }`}>
          <AlertTriangle size={20} className={
            alert.type === 'error' ? 'text-red-400' : alert.type === 'info' ? 'text-blue-400' : 'text-yellow-400'
          } />
          <span className={
            alert.type === 'error' ? 'text-red-300' : alert.type === 'info' ? 'text-blue-300' : 'text-yellow-300'
          }>{alert.message}</span>
        </div>
      ))}
    </div>
  );
};
