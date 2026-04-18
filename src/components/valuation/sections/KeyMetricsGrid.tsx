import React from 'react';
import { Tooltip } from '../../Tooltip';
import { FinancialData, ValuationAssumptions } from '../../../types/financial';
import { KeyMetrics } from '../../../utils/calculations/metrics';
import { calculateWACC } from '../../../utils/valuation';
import { formatPercent, formatCurrencyShort, formatMultiple, CurrencyCode } from '../../../utils/formatters';

interface Props {
  financialData: FinancialData;
  keyMetrics: KeyMetrics;
  assumptions: ValuationAssumptions;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
  /** B5: Needed to show post-tax dividend yield for Egypt */
  marketRegion?: string;
}

export const KeyMetricsGrid: React.FC<Props> = ({
  financialData, keyMetrics, assumptions, isDarkMode, cardClass, textClass, textMutedClass, currency, marketRegion,
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

  // ENH-1: Altman Z-Score — raw ratios and weighted contributions
  const wc = bs.totalCurrentAssets - bs.totalCurrentLiabilities;
  const marketCap = financialData.currentStockPrice * financialData.sharesOutstanding;

  // Raw ratios (display these)
  const x1Raw = bs.totalAssets > 0 ? wc / bs.totalAssets : 0;
  const x2Raw = bs.totalAssets > 0 ? (bs.retainedEarnings ?? bs.totalEquity) / bs.totalAssets : 0;
  const x3Raw = bs.totalAssets > 0 ? is.operatingIncome / bs.totalAssets : 0;
  const x4Raw = (bs.totalLiabilities || 1) > 0 ? marketCap / (bs.totalLiabilities || 1) : 0;
  const x5Raw = bs.totalAssets > 0 ? revenue / bs.totalAssets : 0;

  // Weighted contributions (use for Z total)
  const x1Weighted = x1Raw * 1.2;
  const x2Weighted = x2Raw * 1.4;
  const x3Weighted = x3Raw * 3.3;
  const x4Weighted = x4Raw * 0.6;
  const x5Weighted = x5Raw * 1.0;

  const altmanZ = x1Weighted + x2Weighted + x3Weighted + x4Weighted + x5Weighted;
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

  // EVA (Economic Value Added)
  const waccPct = calculateWACC(financialData, assumptions);
  const roicWaccSpread = roic - waccPct;
  const eva = (roicWaccSpread / 100) * investedCapital;
  const spreadColor = roicWaccSpread > 2 ? 'text-green-400' : roicWaccSpread > 0 ? 'text-yellow-400' : 'text-red-400';
  const spreadLabel = roicWaccSpread > 2 ? '▲ Value Creating' : roicWaccSpread > 0 ? '≈ Neutral' : '▼ Value Destroying';

  // Z-Score component data for expanded display
  const zScoreComponents = [
    { name: 'X1', formula: 'WC/TA', raw: x1Raw, coeff: 1.2, weighted: x1Weighted },
    { name: 'X2', formula: 'RE/TA', raw: x2Raw, coeff: 1.4, weighted: x2Weighted },
    { name: 'X3', formula: 'EBIT/TA', raw: x3Raw, coeff: 3.3, weighted: x3Weighted },
    { name: 'X4', formula: 'MCap/TL', raw: x4Raw, coeff: 0.6, weighted: x4Weighted },
    { name: 'X5', formula: 'Rev/TA', raw: x5Raw, coeff: 1.0, weighted: x5Weighted },
  ];

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
          { label: 'ROIC−WACC Spread', value: `${roicWaccSpread > 0 ? '+' : ''}${roicWaccSpread.toFixed(2)}%`, tooltip: `ROIC (${roic.toFixed(2)}%) minus WACC (${waccPct.toFixed(2)}%). Positive = company creates value above its cost of capital. ${spreadLabel}.`, colorClass: spreadColor },
          { label: 'EVA', value: formatCurrencyShort(eva, currency), tooltip: `Economic Value Added = (ROIC−WACC) × Invested Capital = ${roicWaccSpread.toFixed(2)}% × ${formatCurrencyShort(investedCapital, currency)}. ${eva > 0 ? 'Company creates' : 'Company destroys'} shareholder value.`, colorClass: eva > 0 ? 'text-green-400' : 'text-red-400' },
          { label: 'P/E Ratio', value: formatMultiple(keyMetrics.peRatio), tooltip: 'Price-to-Earnings Ratio (LTM): Market Cap / Trailing Net Income.' },
          { label: 'P/E (NTM)', value: keyMetrics.ntmPE > 0 ? formatMultiple(keyMetrics.ntmPE) : 'N/A', tooltip: 'Forward P/E (Next Twelve Months): Market Cap / Year 1 projected NOPAT. Lower than LTM = earnings growth expected.', colorClass: keyMetrics.ntmPE > 0 && keyMetrics.ntmPE < keyMetrics.peRatio ? 'text-green-400' : keyMetrics.ntmPE > keyMetrics.peRatio ? 'text-red-400' : undefined },
          { label: 'EV/EBITDA', value: formatMultiple(keyMetrics.evEbitda), tooltip: 'Enterprise Value / EBITDA (LTM). A valuation multiple independent of capital structure.' },
          { label: 'EV/EBITDA (NTM)', value: keyMetrics.ntmEvEbitda > 0 ? formatMultiple(keyMetrics.ntmEvEbitda) : 'N/A', tooltip: 'Forward EV/EBITDA (Next Twelve Months): EV / Year 1 projected EBITDA. Lower = growing into valuation.', colorClass: keyMetrics.ntmEvEbitda > 0 && keyMetrics.ntmEvEbitda < keyMetrics.evEbitda ? 'text-green-400' : keyMetrics.ntmEvEbitda > keyMetrics.evEbitda ? 'text-red-400' : undefined },
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

      {/* Altman Z-Score Detailed Breakdown */}
      <div className={`mt-6 p-4 rounded-xl border ${isDarkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h4 className={`text-sm font-semibold ${textClass}`}>Altman Z-Score Breakdown</h4>
            <Tooltip term="Altman Z-Score" definition="Bankruptcy risk indicator developed by Edward Altman. Shows both raw ratios and their weighted contributions to the total score." size={12} />
          </div>
          <span className={`text-lg font-bold ${altmanColor}`}>{altmanZ.toFixed(2)} — {altmanZone}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className={textMutedClass}>
                <th className="text-left py-1 pr-3 font-medium">Component</th>
                <th className="text-left py-1 pr-3 font-medium">Formula</th>
                <th className="text-right py-1 pr-3 font-medium">Raw Ratio</th>
                <th className="text-center py-1 pr-3 font-medium">× Coeff</th>
                <th className="text-right py-1 font-medium">Weighted</th>
              </tr>
            </thead>
            <tbody>
              {zScoreComponents.map((c) => (
                <tr key={c.name} className={`border-t ${isDarkMode ? 'border-zinc-700/50' : 'border-gray-200/50'}`}>
                  <td className={`py-1.5 pr-3 font-medium ${textClass}`}>{c.name}</td>
                  <td className={`py-1.5 pr-3 ${textMutedClass}`}>{c.formula}</td>
                  <td className={`py-1.5 pr-3 text-right font-mono ${textClass}`}>{c.raw.toFixed(3)}</td>
                  <td className={`py-1.5 pr-3 text-center ${textMutedClass}`}>× {c.coeff.toFixed(1)}</td>
                  <td className={`py-1.5 text-right font-mono font-semibold ${textClass}`}>{c.weighted.toFixed(3)}</td>
                </tr>
              ))}
              <tr className={`border-t-2 ${isDarkMode ? 'border-zinc-600' : 'border-gray-300'}`}>
                <td colSpan={4} className={`py-1.5 pr-3 font-bold ${textClass}`}>Z-Score Total</td>
                <td className={`py-1.5 text-right font-mono font-bold ${altmanColor}`}>{altmanZ.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className={`mt-2 text-xs ${textMutedClass}`}>
          {'> 2.99 = Safe Zone  •  1.81–2.99 = Grey Zone  •  < 1.81 = Distress Zone'}
        </div>
      </div>
    </div>
  );
};
