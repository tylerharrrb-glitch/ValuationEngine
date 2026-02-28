import React from 'react';
import { Tooltip } from '../../Tooltip';
import { FinancialData } from '../../../types/financial';
import { KeyMetrics } from '../../../utils/calculations/metrics';
import { formatPercent, formatCurrencyShort, formatMultiple, CurrencyCode } from '../../../utils/formatters';

interface Props {
  financialData: FinancialData;
  keyMetrics: KeyMetrics;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
  /** B5: Needed to show post-tax dividend yield for Egypt */
  marketRegion?: string;
}

export const KeyMetricsGrid: React.FC<Props> = ({
  financialData, keyMetrics, isDarkMode, cardClass, textClass, textMutedClass, currency, marketRegion,
}) => {
  const { incomeStatement: is, balanceSheet: bs, cashFlowStatement: cf } = financialData;
  const totalDebt = bs.shortTermDebt + bs.longTermDebt;
  const cogs = is.costOfGoodsSold || 1;
  const revenue = is.revenue || 1;
  const ebitda = is.operatingIncome + is.depreciation + is.amortization;
  const investedCapital = bs.totalEquity + totalDebt - bs.cash;
  const effectiveTax = (is.netIncome + is.taxExpense) > 0
    ? (is.taxExpense / (is.netIncome + is.taxExpense)) * 100 : 0;
  // C7 Fix: Use statutory tax rate (22.5%) for ROIC NOPAT, not effective tax
  const nopatForROIC = is.operatingIncome * (1 - 0.225);
  const netDebt = totalDebt - bs.cash;

  // ENH-1: Altman Z-Score
  const wc = bs.totalCurrentAssets - bs.totalCurrentLiabilities;
  const marketCap = financialData.currentStockPrice * financialData.sharesOutstanding;
  const altmanZ = bs.totalAssets > 0
    ? 1.2 * (wc / bs.totalAssets) +
    1.4 * (bs.totalEquity / bs.totalAssets) +
    3.3 * (is.operatingIncome / bs.totalAssets) +
    0.6 * (marketCap / (bs.totalLiabilities || 1)) +
    revenue / bs.totalAssets
    : 0;
  const altmanZone = altmanZ > 2.99 ? 'Safe' : altmanZ > 1.81 ? 'Grey Zone' : 'Distress';
  const altmanColor = altmanZ > 2.99 ? 'text-green-400' : altmanZ > 1.81 ? 'text-yellow-400' : 'text-red-400';

  // ENH-2: DuPont Decomposition
  const npm = is.netIncome / revenue;
  const assetTurnover = revenue / (bs.totalAssets || 1);
  const equityMultiplier = (bs.totalAssets || 1) / (bs.totalEquity || 1);
  const dupontROE = npm * assetTurnover * equityMultiplier * 100;

  // ENH-3: Cash Conversion Cycle
  const dso = bs.accountsReceivable > 0 ? 365 / (revenue / bs.accountsReceivable) : 0;
  const dio = bs.inventory > 0 ? 365 / (cogs / bs.inventory) : 0;
  const dpo = bs.accountsPayable > 0 ? 365 / (cogs / bs.accountsPayable) : 0;
  const ccc = dso + dio - dpo;

  // ENH-4: Tax rate discrepancy flag
  const statutoryRate = 22.5; // Egypt statutory
  const taxGap = Math.abs(effectiveTax - statutoryRate);
  const taxFlag = taxGap > 2;

  // ROIC — uses statutory tax NOPAT
  const roic = investedCapital > 0 ? (nopatForROIC / investedCapital) * 100 : 0;

  return (
    <div className={`p-6 rounded-xl border ${cardClass}`}>
      <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Key Financial Metrics</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Revenue', value: formatCurrencyShort(is.revenue, currency), tooltip: 'Total money generated from business operations before expenses.' },
          { label: 'Net Income', value: formatCurrencyShort(is.netIncome, currency), tooltip: 'Total profit after all expenses, taxes, and interest.' },
          { label: 'Gross Margin', value: formatPercent(keyMetrics.grossMargin), tooltip: 'Percentage of revenue left after subtracting COGS.' },
          { label: 'Net Margin', value: formatPercent(keyMetrics.netMargin), tooltip: 'Percentage of revenue that remains as profit after all expenses.' },
          { label: 'Operating Margin', value: formatPercent(keyMetrics.operatingMargin), tooltip: 'Profitability from core operations before interest and taxes.' },
          { label: 'EBITDA Margin', value: formatPercent(keyMetrics.ebitdaMargin), tooltip: 'Earnings Before Interest, Taxes, Depreciation, and Amortization as % of Revenue.' },
          { label: 'ROE', value: formatPercent(keyMetrics.roe), tooltip: 'Return on Equity: Net Income / Shareholders Equity.' },
          { label: 'ROA', value: formatPercent(keyMetrics.roa), tooltip: 'Return on Assets: Net Income / Total Assets.' },
          { label: 'ROIC', value: formatPercent(roic), tooltip: 'Return on Invested Capital: NOPAT / (Equity + Debt − Cash). Measures value creation.', colorClass: roic > 15 ? 'text-green-400' : roic > 8 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'P/E Ratio', value: formatMultiple(keyMetrics.peRatio), tooltip: 'Price-to-Earnings Ratio: Current Stock Price / Earnings Per Share.' },
          { label: 'EV/EBITDA', value: formatMultiple(keyMetrics.evEbitda), tooltip: 'Enterprise Value / EBITDA. A valuation multiple independent of capital structure.' },
          { label: 'Current Ratio', value: formatMultiple(keyMetrics.currentRatio), tooltip: 'Current Assets / Current Liabilities. Measures short-term liquidity.' },
          { label: 'Debt/Equity', value: formatMultiple(keyMetrics.debtToEquity), tooltip: 'Total Debt / Total Equity. Measures financial leverage.' },
          { label: 'Net Debt/EBITDA', value: ebitda > 0 ? `${(netDebt / ebitda).toFixed(1)}x` : 'N/A', tooltip: 'Net Debt / EBITDA. Leverage relative to earnings capacity.' },
          { label: 'FCF Yield', value: formatPercent(keyMetrics.fcfYield), tooltip: 'Free Cash Flow / Market Cap. Yield available to shareholders.' },
          { label: 'Inter. Coverage', value: formatMultiple(keyMetrics.interestCoverage), tooltip: 'EBIT / Interest Expense. Ability to pay interest on debt.' },
          { label: 'Dividend Yield', value: formatPercent(keyMetrics.dividendYield), tooltip: 'Dividends Per Share / Stock Price (Pre-Tax).' },
          // B5: Post-tax dividend yield for Egypt (10% withholding)
          ...(marketRegion === 'Egypt' && keyMetrics.dividendYield > 0 ? [{
            label: 'Div Yield (Post-Tax)',
            value: formatPercent(keyMetrics.dividendYield * 0.90),
            tooltip: 'Post-tax yield = Pre-tax × (1 − 10% withholding). Egypt applies 10% withholding tax on dividends per Article 46 bis of Egyptian Income Tax Law No. 91/2005.',
            colorClass: 'text-green-400' as string | undefined,
          }] : []),
          { label: 'Free Cash Flow', value: formatCurrencyShort(cf.freeCashFlow, currency), tooltip: 'Cash generated after accounting for capital expenditures.' },
          { label: 'Total Debt', value: formatCurrencyShort(totalDebt, currency), tooltip: 'Sum of short-term and long-term debt obligations.' },
          { label: `Altman Z-Score`, value: `${altmanZ.toFixed(2)} (${altmanZone})`, tooltip: 'Bankruptcy risk indicator: >2.99 Safe, 1.81–2.99 Grey Zone, <1.81 Distress.', colorClass: altmanColor },
          { label: 'Cash Conv. Cycle', value: `${ccc.toFixed(0)} days`, tooltip: `Cash Conversion Cycle = DSO (${dso.toFixed(0)}) + DIO (${dio.toFixed(0)}) − DPO (${dpo.toFixed(0)}). Lower is better.`, colorClass: ccc < 30 ? 'text-green-400' : ccc < 90 ? 'text-yellow-400' : 'text-red-400' },
          { label: 'DuPont ROE', value: formatPercent(dupontROE), tooltip: `DuPont: NPM (${(npm * 100).toFixed(1)}%) × Asset Turnover (${assetTurnover.toFixed(2)}x) × Equity Multiplier (${equityMultiplier.toFixed(2)}x) = ROE.` },
          { label: `Eff. Tax Rate${taxFlag ? ' ⚠️' : ''}`, value: formatPercent(effectiveTax), tooltip: `Effective tax: Tax Expense / EBT = ${formatCurrencyShort(is.taxExpense)} / ${formatCurrencyShort(is.netIncome + is.taxExpense)}. ${taxFlag ? `⚠️ Differs from statutory (${statutoryRate}%) by ${taxGap.toFixed(1)}pp.` : `Close to statutory (${statutoryRate}%).`}`, colorClass: taxFlag ? 'text-orange-400' : undefined },
          { label: 'Statutory Tax Rate', value: formatPercent(statutoryRate), tooltip: 'User input — drives WACC tax shield [Kd×(1-t)] and NOPAT in DCF projections [EBIT×(1-t)]. May differ from effective rate due to tax incentives or timing.', colorClass: 'text-blue-400' },
        ].map(({ label, value, tooltip, colorClass }) => (
          <div key={label} className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'} hover:border-gray-300 dark:hover:border-zinc-500 transition-colors`}>
            <div className="flex items-center gap-1.5 mb-1">
              <span className={`text-xs font-medium ${textMutedClass}`}>{label}</span>
              {tooltip && <Tooltip term={label} definition={tooltip} size={12} />}
            </div>
            <div className={`text-lg font-bold ${colorClass || textClass}`}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
};
