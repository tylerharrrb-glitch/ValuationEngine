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
}

export const KeyMetricsGrid: React.FC<Props> = ({
  financialData, keyMetrics, isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => (
  <div className={`p-6 rounded-xl border ${cardClass}`}>
    <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Key Financial Metrics</h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { 
          label: 'Revenue', 
          value: formatCurrencyShort(financialData.incomeStatement.revenue, currency),
          tooltip: 'Total money generated from business operations before expenses.'
        },
        { 
          label: 'Net Income', 
          value: formatCurrencyShort(financialData.incomeStatement.netIncome, currency),
          tooltip: 'Total profit after all expenses, taxes, and interest.'
        },
        { 
          label: 'Gross Margin', 
          value: formatPercent(keyMetrics.grossMargin), 
          tooltip: 'Percentage of revenue left after subtracting cost of goods sold (COGS).' 
        },
        { 
          label: 'Net Margin', 
          value: formatPercent(keyMetrics.netMargin), 
          tooltip: 'Percentage of revenue that remains as profit after all expenses.' 
        },
        { 
          label: 'Operating Margin', 
          value: formatPercent(keyMetrics.operatingMargin), 
          tooltip: 'Profitability from core operations before interest and taxes.' 
        },
        { 
          label: 'EBITDA Margin', 
          value: formatPercent(keyMetrics.ebitdaMargin), 
          tooltip: 'Earnings Before Interest, Taxes, Depreciation, and Amortization as % of Revenue.' 
        },
        { 
          label: 'ROE', 
          value: formatPercent(keyMetrics.roe), 
          tooltip: 'Return on Equity: Net Income / Shareholders Equity. Measures efficiency.' 
        },
        { 
          label: 'ROA', 
          value: formatPercent(keyMetrics.roa), 
          tooltip: 'Return on Assets: Net Income / Total Assets. Measures asset efficiency.' 
        },
        { 
          label: 'P/E Ratio', 
          value: formatMultiple(keyMetrics.peRatio), 
          tooltip: 'Price-to-Earnings Ratio: Current Stock Price / Earnings Per Share.' 
        },
        { 
          label: 'EV/EBITDA', 
          value: formatMultiple(keyMetrics.evEbitda), 
          tooltip: 'Enterprise Value / EBITDA. A valuation multiple independent of capital structure.' 
        },
        { 
          label: 'Current Ratio', 
          value: formatMultiple(keyMetrics.currentRatio), 
          tooltip: 'Current Assets / Current Liabilities. Measures short-term liquidity.' 
        },
        { 
          label: 'Debt/Equity', 
          value: formatMultiple(keyMetrics.debtToEquity), 
          tooltip: 'Total Debt / Total Equity. Measures financial leverage.' 
        },
        { 
          label: 'FCF Yield', 
          value: formatPercent(keyMetrics.fcfYield), 
          tooltip: 'Free Cash Flow / Market Cap. Yield available to shareholders.' 
        },
        { 
          label: 'Inter. Coverage', // Shortened label
          value: formatMultiple(keyMetrics.interestCoverage), 
          tooltip: 'EBIT / Interest Expense. Ability to pay interest on debt.' 
        },
        { 
          label: 'Free Cash Flow', 
          value: formatCurrencyShort(financialData.cashFlowStatement.freeCashFlow, currency),
          tooltip: 'Cash generated after accounting for capital expenditures.'
        },
        { 
          label: 'Total Debt', 
          value: formatCurrencyShort(financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt, currency),
          tooltip: 'Sum of short-term and long-term debt obligations.'
        },
      ].map(({ label, value, tooltip }) => (
        <div key={label} className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'} hover:border-gray-300 dark:hover:border-zinc-500 transition-colors`}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-xs font-medium ${textMutedClass}`}>{label}</span>
            {tooltip && <Tooltip term={label} definition={tooltip} size={12} />}
          </div>
          <div className={`text-lg font-bold ${textClass}`}>{value}</div>
        </div>
      ))}
    </div>
  </div>
);
