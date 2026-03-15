import { FinancialData } from '../types/financial';
import { calculateEBITDA, calculateEnterpriseValue } from '../utils/valuation';
import { formatCurrencyShort, formatPercent, formatMultiple, formatPrice } from '../utils/formatters';
import { PieChart, Activity, TrendingUp, DollarSign } from 'lucide-react';

interface Props {
  data: FinancialData;
}

export function KeyMetrics({ data }: Props) {
  const { incomeStatement, balanceSheet, cashFlowStatement } = data;
  const marketCap = data.currentStockPrice * data.sharesOutstanding;
  const ebitda = calculateEBITDA(data);
  const ev = calculateEnterpriseValue(data);

  // Profitability Ratios
  const grossMargin = incomeStatement.revenue > 0 ? (incomeStatement.grossProfit / incomeStatement.revenue) * 100 : 0;
  const operatingMargin = incomeStatement.revenue > 0 ? (incomeStatement.operatingIncome / incomeStatement.revenue) * 100 : 0;
  const netMargin = incomeStatement.revenue > 0 ? (incomeStatement.netIncome / incomeStatement.revenue) * 100 : 0;
  const ebitdaMargin = incomeStatement.revenue > 0 ? (ebitda / incomeStatement.revenue) * 100 : 0;
  const roe = balanceSheet.totalEquity > 0 ? (incomeStatement.netIncome / balanceSheet.totalEquity) * 100 : 0;
  const roa = balanceSheet.totalAssets > 0 ? (incomeStatement.netIncome / balanceSheet.totalAssets) * 100 : 0;

  // Valuation Ratios
  const peRatio = incomeStatement.netIncome > 0 ? marketCap / incomeStatement.netIncome : 0;
  const evEbitda = ebitda > 0 ? ev / ebitda : 0;
  const psRatio = incomeStatement.revenue > 0 ? marketCap / incomeStatement.revenue : 0;
  const pbRatio = balanceSheet.totalEquity > 0 ? marketCap / balanceSheet.totalEquity : 0;
  const eps = data.sharesOutstanding > 0 ? incomeStatement.netIncome / data.sharesOutstanding : 0;

  // Liquidity Ratios
  const currentRatio = balanceSheet.totalCurrentLiabilities > 0 ? balanceSheet.totalCurrentAssets / balanceSheet.totalCurrentLiabilities : 0;
  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const debtToEquity = balanceSheet.totalEquity > 0 ? totalDebt / balanceSheet.totalEquity : 0;
  const debtToEbitda = ebitda > 0 ? totalDebt / ebitda : 0;

  // Efficiency Ratios
  const fcfYield = marketCap > 0 ? (cashFlowStatement.freeCashFlow / marketCap) * 100 : 0;
  const fcfConversion = incomeStatement.netIncome > 0 ? (cashFlowStatement.freeCashFlow / incomeStatement.netIncome) * 100 : 0;
  const investedCapital = balanceSheet.totalEquity + totalDebt - balanceSheet.cash;
  const roic = investedCapital > 0 ? (incomeStatement.operatingIncome * (1 - 0.25)) / investedCapital * 100 : 0;

  const MetricCard = ({ label, value, unit = '', description = '' }: { label: string; value: string; unit?: string; description?: string }) => (
    <div className="bg-zinc-900/50 rounded-lg p-3 hover:bg-[var(--bg-secondary)] transition-colors border border-zinc-800/50">
      <p className="text-zinc-500 text-xs mb-1">{label}</p>
      <p className="text-lg font-bold text-white">
        {value}{unit}
      </p>
      {description && <p className="text-zinc-600 text-xs mt-1">{description}</p>}
    </div>
  );

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-black rounded-xl p-6 border border-zinc-800">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-[var(--accent-gold)]/20 flex items-center justify-center">
          <PieChart className="w-4 h-4 text-red-500" />
        </div>
        <h2 className="text-xl font-bold text-white">Key Financial Metrics</h2>
      </div>

      <div className="space-y-6">
        {/* Valuation Metrics */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-semibold text-red-400">Valuation Metrics</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="P/E Ratio" value={formatMultiple(peRatio)} />
            <MetricCard label="EV/EBITDA" value={formatMultiple(evEbitda)} />
            <MetricCard label="P/S Ratio" value={formatMultiple(psRatio)} />
            <MetricCard label="P/B Ratio" value={formatMultiple(pbRatio)} />
            <MetricCard label="EPS" value={formatPrice(eps)} description="Earnings per share" />
            <MetricCard label="Market Cap" value={formatCurrencyShort(marketCap)} />
            <MetricCard label="Enterprise Value" value={formatCurrencyShort(ev)} />
            <MetricCard label="EBITDA" value={formatCurrencyShort(ebitda)} />
          </div>
        </div>

        {/* Profitability Metrics */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-green-500" />
            <h3 className="text-sm font-semibold text-green-400">Profitability Metrics</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Gross Margin" value={formatPercent(grossMargin)} />
            <MetricCard label="Operating Margin" value={formatPercent(operatingMargin)} />
            <MetricCard label="Net Margin" value={formatPercent(netMargin)} />
            <MetricCard label="EBITDA Margin" value={formatPercent(ebitdaMargin)} />
            <MetricCard label="Return on Equity" value={formatPercent(roe)} description="ROE" />
            <MetricCard label="Return on Assets" value={formatPercent(roa)} description="ROA" />
            <MetricCard label="ROIC" value={formatPercent(roic)} description="Return on invested capital" />
            <MetricCard label="FCF Conversion" value={formatPercent(fcfConversion)} description="FCF / Net Income" />
          </div>
        </div>

        {/* Financial Health */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-yellow-500" />
            <h3 className="text-sm font-semibold text-yellow-400">Financial Health</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetricCard label="Current Ratio" value={formatMultiple(currentRatio)} />
            <MetricCard label="Debt to Equity" value={formatMultiple(debtToEquity)} />
            <MetricCard label="Debt to EBITDA" value={formatMultiple(debtToEbitda)} />
            <MetricCard label="FCF Yield" value={formatPercent(fcfYield)} />
            <MetricCard label="Total Debt" value={formatCurrencyShort(totalDebt)} />
            <MetricCard label="Net Debt" value={formatCurrencyShort(totalDebt - balanceSheet.cash)} />
            <MetricCard label="Cash Position" value={formatCurrencyShort(balanceSheet.cash)} />
            <MetricCard label="Free Cash Flow" value={formatCurrencyShort(cashFlowStatement.freeCashFlow)} />
          </div>
        </div>
      </div>
    </div>
  );
}
