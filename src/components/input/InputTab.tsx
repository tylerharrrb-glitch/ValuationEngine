/**
 * Input Tab — Orchestrates all input sub-tabs (Company Info, Income Statement,
 * Balance Sheet, Cash Flow, Assumptions, Comparables).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { FinancialData, ValuationAssumptions, ComparableCompany, MarketRegion, EgyptTaxCategory } from '../../types/financial';
import { CurrencyCode } from '../../utils/formatters';
import { InputField } from '../shared/InputField';
import { StockSearch } from '../StockSearch';
import { Tooltip } from '../Tooltip';
import { MARKET_DEFAULTS, EGYPTIAN_TAX_CATEGORIES, EGYPTIAN_INDUSTRY_MULTIPLES } from '../../constants/marketDefaults';
import { formatPercent, formatNumber } from '../../utils/formatters';
import { fetchAllPeerData, getSuggestedPeers } from '../../services/stockAPI';
import { calculateWACC, calculateKe } from '../../utils/valuation';
import { getEgyptMacroSnapshot } from '../../services/egyptMarketData';
import { searchEGXStocks, EGX_MAJOR_STOCKS } from '../../utils/industryMapping';
import { BalanceSheetValidation } from './BalanceSheetValidation';
import { HistoricalDataPanel } from './HistoricalDataPanel';

type InputSubTab = 'company' | 'income' | 'balance' | 'cashflow' | 'assumptions' | 'comparables' | 'historical';

export interface InputTabProps {
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  comparables: ComparableCompany[];
  updateFinancialData: (updater: (prev: FinancialData) => FinancialData) => void;
  updateAssumptions: (updater: (prev: ValuationAssumptions) => ValuationAssumptions) => void;
  updateComparables: (newComparables: ComparableCompany[]) => void;
  handleStockDataFetched: (data: FinancialData & { beta?: number }, marketRegion: MarketRegion, setMarketRegion: (r: MarketRegion) => void) => void;
  marketRegion: MarketRegion;
  setMarketRegion: (r: MarketRegion) => void;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  inputClass: string;
  currency: CurrencyCode;
}

export const InputTab: React.FC<InputTabProps> = ({
  financialData, assumptions, comparables,
  updateFinancialData, updateAssumptions, updateComparables,
  handleStockDataFetched,
  marketRegion, setMarketRegion,
  isDarkMode, cardClass, textClass, textMutedClass, inputClass, currency,
}) => {
  const [inputSubTab, setInputSubTab] = useState<InputSubTab>('company');
  const [loadingPeers, setLoadingPeers] = useState(false);
  const [selectedSector, setSelectedSector] = useState<string>('DEFAULT');
  const [egxSearch, setEgxSearch] = useState<string>('');
  const [showEgxDropdown, setShowEgxDropdown] = useState(false);
  const egyptMacro = marketRegion === 'Egypt' ? getEgyptMacroSnapshot() : null;

  // B1: Auto-populate sector defaults when sector changes (Egypt only)
  const handleSectorChange = (sector: string) => {
    setSelectedSector(sector);
    if (marketRegion === 'Egypt') {
      const multiples = EGYPTIAN_INDUSTRY_MULTIPLES[sector as keyof typeof EGYPTIAN_INDUSTRY_MULTIPLES] || EGYPTIAN_INDUSTRY_MULTIPLES.DEFAULT;
      const defaultComp: ComparableCompany = {
        name: `EGX ${multiples.label} Avg`,
        ticker: `EGX_${sector}`,
        peRatio: multiples.pe,
        evEbitda: multiples.evEbitda,
        psRatio: multiples.ps || 1.2,
        pbRatio: multiples.pb,
        marketCap: 0,
        revenue: 0,
      };
      updateComparables([defaultComp]);
    }
  };

  // Shared InputField props
  const fieldProps = { isDarkMode, textMutedClass, inputClass, currency };

  // C1: Auto-calculate WACC whenever any WACC-related input changes
  const autoWACC = useMemo(() => {
    return calculateWACC(financialData, assumptions);
  }, [
    financialData.currentStockPrice,
    financialData.sharesOutstanding,
    financialData.balanceSheet.shortTermDebt,
    financialData.balanceSheet.longTermDebt,
    financialData.incomeStatement.interestExpense,
    assumptions.riskFreeRate,
    assumptions.marketRiskPremium,
    assumptions.beta,
    assumptions.costOfDebt,
    assumptions.taxRate,
  ]);

  // C1: WACC breakdown values for inline display
  const waccBreakdown = useMemo(() => {
    const marketCap = financialData.currentStockPrice * financialData.sharesOutstanding;
    const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
    const totalCapital = marketCap + totalDebt;
    const We = totalCapital > 0 ? marketCap / totalCapital : 1;
    const Wd = totalCapital > 0 ? totalDebt / totalCapital : 0;
    const Ke = calculateKe(assumptions);
    const costOfDebt = assumptions.costOfDebt || (
      totalDebt > 0 ? (financialData.incomeStatement.interestExpense / totalDebt) * 100 : assumptions.riskFreeRate + 2
    );
    const KdAfterTax = costOfDebt * (1 - assumptions.taxRate / 100);
    return { We, Wd, Ke, KdAfterTax, marketCap, totalDebt };
  }, [financialData, assumptions]);

  // C1: Explicit manual override flag — only set when user TYPES a custom WACC
  const [isWACCManualOverride, setIsWACCManualOverride] = useState(false);

  // C1: Auto-apply WACC on input changes (always, unless manually overridden)
  useEffect(() => {
    if (!isWACCManualOverride) {
      const rounded = Math.round(autoWACC * 100) / 100;
      // Only update if different to avoid infinite loops
      if (Math.abs(assumptions.discountRate - rounded) > 0.005) {
        updateAssumptions(prev => ({ ...prev, discountRate: rounded }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoWACC, isWACCManualOverride]);

  return (
    <div className="space-y-6">
      {/* Stock Search */}
      <StockSearch
        onDataFetched={(data: any) => handleStockDataFetched(data, marketRegion, setMarketRegion)}
        isDarkMode={isDarkMode}
        market={marketRegion}
      />

      {/* Sub-tabs for input sections */}
      <div className={`flex flex-wrap gap-2 p-2 rounded-lg ${isDarkMode ? 'bg-[var(--bg-card)]' : 'bg-gray-100'}`}>
        {([
          { id: 'company', label: 'Company Info', subtitle: '' },
          { id: 'income', label: 'Income Statement', subtitle: 'Base Year (Most Recent Fiscal Year)' },
          { id: 'balance', label: 'Balance Sheet', subtitle: 'Base Year (Most Recent Fiscal Year)' },
          { id: 'cashflow', label: 'Cash Flow', subtitle: 'Base Year (Most Recent Fiscal Year)' },
          { id: 'assumptions', label: 'Assumptions', subtitle: '' },
          { id: 'comparables', label: 'Comparables', subtitle: '' },
          { id: 'historical', label: 'Historical', subtitle: 'Multi-Period Trends (2021–2025)' },
        ] as { id: InputSubTab; label: string; subtitle: string }[]).map(({ id, label, subtitle }) => (
          <button
            key={id}
            onClick={() => setInputSubTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${inputSubTab === id
              ? 'bg-[var(--accent-gold)] text-[var(--bg-primary)]'
              : isDarkMode
                ? 'text-gray-400 hover:text-white hover:bg-[var(--bg-secondary)]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
          >
            {label}
            {subtitle && (
              <span className={`block text-[10px] font-normal mt-0.5 ${inputSubTab === id ? 'opacity-70' : 'text-gray-500'}`}>
                {subtitle}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Company Info */}
      {inputSubTab === 'company' && (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
          <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Company Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <InputField label="Company Name" value={financialData.companyName}
              onChange={(val) => updateFinancialData(prev => ({ ...prev, companyName: val as string }))}
              type="text" {...fieldProps} />
            <InputField label="Ticker Symbol" value={financialData.ticker}
              onChange={(val) => updateFinancialData(prev => ({ ...prev, ticker: val as string }))}
              type="text" {...fieldProps} />
            <InputField label="Shares Outstanding" value={financialData.sharesOutstanding}
              onChange={(val) => updateFinancialData(prev => ({ ...prev, sharesOutstanding: val as number }))}
              tooltip="Shares Outstanding" showAsShares={true} min={0} {...fieldProps} />
            <InputField label="Current Stock Price" value={financialData.currentStockPrice}
              onChange={(val) => updateFinancialData(prev => ({ ...prev, currentStockPrice: val as number }))}
              prefix={marketRegion === 'Egypt' ? 'EGP' : '$'} step="0.01" min={0} {...fieldProps} />
            {/* C7: Fiscal Year End Selector */}
            <div>
              <label className={`block text-sm font-medium mb-1 ${textMutedClass}`}>Fiscal Year End</label>
              <select
                value={financialData.fiscalYearEnd || 'dec'}
                onChange={(e) => updateFinancialData(prev => ({ ...prev, fiscalYearEnd: e.target.value }))}
                className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
              >
                <option value="dec">December 31</option>
                <option value="jun">June 30 (Egyptian Banks)</option>
                <option value="mar">March 31</option>
                <option value="sep">September 30</option>
              </select>
            </div>
          </div>

          {/* B1: Sector Dropdown (Egypt only) */}
          {marketRegion === 'Egypt' && (
            <div className="mt-4">
              <label className={`block text-sm font-medium mb-1 ${textMutedClass}`}>EGX Sector</label>
              <select
                value={selectedSector}
                onChange={e => handleSectorChange(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border text-sm ${inputClass}`}
              >
                {Object.entries(EGYPTIAN_INDUSTRY_MULTIPLES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
              {selectedSector !== 'DEFAULT' && (
                <p className="text-xs text-green-400 mt-1">
                  Auto-populated {EGYPTIAN_INDUSTRY_MULTIPLES[selectedSector as keyof typeof EGYPTIAN_INDUSTRY_MULTIPLES]?.label || 'sector'} multiples
                  {selectedSector === 'BANKING' && ' (EV/EBITDA N/A — weight redistributed)'}
                </p>
              )}
            </div>
          )}

          {/* C8: EGX Ticker Auto-Complete — Phase 3 (Task #18) */}
          {marketRegion === 'Egypt' && (
            <div className="mt-4">
              <h4 className={`text-sm font-semibold mb-2 text-red-400 uppercase tracking-wide`}>EGX Ticker Search ({EGX_MAJOR_STOCKS.length} stocks)</h4>
              <div className="relative">
                <input
                  type="text"
                  value={egxSearch}
                  onChange={(e) => { setEgxSearch(e.target.value); setShowEgxDropdown(true); }}
                  onFocus={() => setShowEgxDropdown(true)}
                  placeholder="Search by ticker, name, or sector..."
                  className={`w-full px-3 py-2 rounded-lg border text-sm ${inputClass}`}
                />
                {showEgxDropdown && (
                  <div className={`absolute z-50 w-full mt-1 max-h-64 overflow-y-auto rounded-lg border shadow-xl ${isDarkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-gray-200'}`}>
                    {(() => {
                      const results = searchEGXStocks(egxSearch);
                      // Group by sector
                      const grouped = results.reduce<Record<string, typeof results>>((acc, s) => {
                        const key = s.sector.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                        (acc[key] = acc[key] || []).push(s);
                        return acc;
                      }, {});
                      return Object.entries(grouped).map(([sector, stocks]) => (
                        <div key={sector}>
                          <div className={`px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'bg-zinc-800 text-zinc-500' : 'bg-gray-100 text-gray-500'}`}>{sector}</div>
                          {stocks.map(stock => (
                            <button
                              key={stock.ticker}
                              onClick={() => {
                                updateFinancialData(prev => ({ ...prev, ticker: stock.ticker + '.CA' }));
                                setEgxSearch('');
                                setShowEgxDropdown(false);
                              }}
                              className={`w-full text-left px-3 py-2 flex items-center justify-between transition-colors ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-gray-50'} ${financialData.ticker === stock.ticker + '.CA' ? 'bg-[var(--accent-gold)]/10' : ''}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`font-mono font-bold text-sm ${isDarkMode ? 'text-[var(--accent-gold)]' : 'text-blue-600'}`}>{stock.ticker}</span>
                                <span className={`text-xs ${textMutedClass} truncate max-w-[200px]`}>{stock.name}</span>
                              </div>
                              <span className={`text-[10px] font-mono ${textMutedClass}`}>β {stock.beta.toFixed(2)}</span>
                            </button>
                          ))}
                        </div>
                      ));
                    })()}
                    {searchEGXStocks(egxSearch).length === 0 && (
                      <div className={`px-3 py-4 text-center text-sm ${textMutedClass}`}>No stocks match "{egxSearch}"</div>
                    )}
                  </div>
                )}
              </div>
              {/* Dismiss dropdown on outside click */}
              {showEgxDropdown && <div className="fixed inset-0 z-40" onClick={() => setShowEgxDropdown(false)} />}
            </div>
          )}
        </div>
      )}

      {/* Income Statement */}
      {inputSubTab === 'income' && (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
          <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Income Statement</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'revenue', label: 'Revenue', min: 0 },
              { key: 'costOfGoodsSold', label: 'Cost of Goods Sold' },
              { key: 'grossProfit', label: 'Gross Profit' },
              { key: 'operatingExpenses', label: 'Operating Expenses' },
              { key: 'operatingIncome', label: 'Operating Income' },
              { key: 'interestExpense', label: 'Interest Expense' },
              { key: 'taxExpense', label: 'Tax Expense' },
              { key: 'netIncome', label: 'Net Income' },
              { key: 'depreciation', label: 'Depreciation' },
              { key: 'amortization', label: 'Amortization' },
            ].map(({ key, label, min }) => (
              <InputField key={key} label={label}
                value={financialData.incomeStatement[key as keyof typeof financialData.incomeStatement]}
                onChange={(val) => updateFinancialData(prev => ({
                  ...prev, incomeStatement: { ...prev.incomeStatement, [key]: val as number }
                }))}
                min={min}
                {...fieldProps} />
            ))}
          </div>

          {/* NI Reconciliation Note */}
          {(() => {
            const is = financialData.incomeStatement;
            if (is.operatingIncome <= 0) return null;
            const impliedNI = is.operatingIncome - is.interestExpense - is.taxExpense;
            const niDiff = is.netIncome !== 0 ? Math.abs(impliedNI - is.netIncome) / Math.abs(is.netIncome) : 0;
            const isClose = niDiff <= 0.05;
            return (
              <div className={`mt-3 p-3 rounded-lg border text-xs ${isClose
                ? isDarkMode ? 'bg-zinc-800/50 border-zinc-700/50' : 'bg-gray-50 border-gray-200'
                : isDarkMode ? 'bg-yellow-900/20 border-yellow-700/50' : 'bg-yellow-50 border-yellow-200'
              }`}>
                <span className={isClose ? 'text-green-400' : 'text-yellow-400'}>
                  {isClose ? '✓' : 'ℹ'} Implied NI = EBIT ({formatNumber(is.operatingIncome)}) − Interest ({formatNumber(is.interestExpense)}) − Tax ({formatNumber(is.taxExpense)}) = {formatNumber(impliedNI)}
                </span>
                {!isClose && (
                  <span className="text-yellow-400/80 ml-1">
                    — differs from entered NI ({formatNumber(is.netIncome)}) by {(niDiff * 100).toFixed(1)}%. This is normal for consolidated statements with FX gains, equity income, or minority interest.
                  </span>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Balance Sheet */}
      {inputSubTab === 'balance' && (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
          <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Balance Sheet</h3>

          <h4 className="text-red-400 font-medium mb-3 mt-4">Current Assets</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { key: 'cash', label: 'Cash & Equivalents' },
              { key: 'marketableSecurities', label: 'Marketable Securities' },
              { key: 'accountsReceivable', label: 'Accounts Receivable' },
              { key: 'inventory', label: 'Inventory' },
              { key: 'otherCurrentAssets', label: 'Other Current Assets' },
              { key: 'totalCurrentAssets', label: 'Total Current Assets' },
            ].map(({ key, label }) => (
              <InputField key={key} label={label}
                value={(financialData.balanceSheet[key as keyof typeof financialData.balanceSheet] ?? 0) as number}
                onChange={(val) => updateFinancialData(prev => ({
                  ...prev, balanceSheet: { ...prev.balanceSheet, [key]: val as number }
                }))}
                min={0}
                {...fieldProps} />
            ))}
          </div>

          <h4 className="text-orange-400 font-medium mb-3">Non-Current Assets</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { key: 'propertyPlantEquipment', label: 'PP&E (Net)' },
              { key: 'longTermInvestments', label: 'Long-term Investments' },
              { key: 'goodwill', label: 'Goodwill' },
              { key: 'intangibleAssets', label: 'Intangible Assets' },
              { key: 'otherNonCurrentAssets', label: 'Other Non-Current Assets' },
              { key: 'totalAssets', label: 'Total Assets' },
            ].map(({ key, label }) => (
              <InputField key={key} label={label}
                value={(financialData.balanceSheet[key as keyof typeof financialData.balanceSheet] ?? 0) as number}
                onChange={(val) => updateFinancialData(prev => ({
                  ...prev, balanceSheet: { ...prev.balanceSheet, [key]: val as number }
                }))}
                min={0}
                {...fieldProps} />
            ))}
          </div>

          <h4 className="text-yellow-400 font-medium mb-3">Current Liabilities</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { key: 'accountsPayable', label: 'Accounts Payable' },
              { key: 'shortTermDebt', label: 'Short-Term Debt' },
              { key: 'otherCurrentLiabilities', label: 'Other Current Liabilities' },
              { key: 'totalCurrentLiabilities', label: 'Total Current Liabilities' },
            ].map(({ key, label }) => (
              <InputField key={key} label={label}
                value={(financialData.balanceSheet[key as keyof typeof financialData.balanceSheet] ?? 0) as number}
                onChange={(val) => updateFinancialData(prev => ({
                  ...prev, balanceSheet: { ...prev.balanceSheet, [key]: val as number }
                }))}
                min={0}
                {...fieldProps} />
            ))}
          </div>

          <h4 className="text-yellow-400 font-medium mb-3">Non-Current Liabilities</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {[
              { key: 'longTermDebt', label: 'Long-Term Debt' },
              { key: 'otherNonCurrentLiabilities', label: 'Other Non-Current Liabilities' },
              { key: 'totalLiabilities', label: 'Total Liabilities' },
            ].map(({ key, label }) => (
              <InputField key={key} label={label}
                value={(financialData.balanceSheet[key as keyof typeof financialData.balanceSheet] ?? 0) as number}
                onChange={(val) => updateFinancialData(prev => ({
                  ...prev, balanceSheet: { ...prev.balanceSheet, [key]: val as number }
                }))}
                min={0}
                {...fieldProps} />
            ))}
          </div>

          <h4 className="text-green-400 font-medium mb-3">Equity</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <InputField label="Total Equity" value={financialData.balanceSheet.totalEquity}
              onChange={(val) => updateFinancialData(prev => ({
                ...prev, balanceSheet: { ...prev.balanceSheet, totalEquity: val as number }
              }))}
              {...fieldProps} />
            {/* D1: Retained Earnings */}
            <InputField label="Retained Earnings" value={financialData.balanceSheet.retainedEarnings ?? 0}
              onChange={(val) => updateFinancialData(prev => ({
                ...prev, balanceSheet: { ...prev.balanceSheet, retainedEarnings: val as number }
              }))}
              tooltip="Optional — for more accurate Altman Z-Score X2. If blank, Total Equity is used as proxy."
              {...fieldProps} />
            {/* IMP3: RE info note */}
            {!(financialData.balanceSheet.retainedEarnings) && (
              <div className="text-xs text-blue-400 -mt-2 mb-2">ℹ️ RE defaults to Total Equity ({formatNumber(financialData.balanceSheet.totalEquity)}) for Z-Score when not entered.</div>
            )}
            {/* D2: Minority Interest & Preferred Equity */}
            <InputField label="Minority Interest" value={financialData.balanceSheet.minorityInterest ?? 0}
              onChange={(val) => updateFinancialData(prev => ({
                ...prev, balanceSheet: { ...prev.balanceSheet, minorityInterest: val as number }
              }))}
              tooltip="Non-controlling interest. Added to EV in the equity bridge."
              {...fieldProps} />
            <InputField label="Preferred Equity" value={financialData.balanceSheet.preferredEquity ?? 0}
              onChange={(val) => updateFinancialData(prev => ({
                ...prev, balanceSheet: { ...prev.balanceSheet, preferredEquity: val as number }
              }))}
              tooltip="Preferred shares outstanding. Deducted from equity in the bridge."
              {...fieldProps} />
          </div>

          {/* A3: Balance Sheet Auto-Validation */}
          <BalanceSheetValidation financialData={financialData} isDarkMode={isDarkMode} currency={currency} />
        </div>
      )}

      {/* Cash Flow Statement */}
      {inputSubTab === 'cashflow' && (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
          <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Cash Flow Statement</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { key: 'operatingCashFlow', label: 'Operating Cash Flow' },
              { key: 'capitalExpenditures', label: 'Capital Expenditures', tooltip: 'CapEx', min: 0 },
              { key: 'freeCashFlow', label: 'Free Cash Flow', tooltip: 'FCF' },
              { key: 'dividendsPaid', label: 'Dividends Paid', min: 0 },
              { key: 'netChangeInCash', label: 'Net Change in Cash' },
            ].map(({ key, label, tooltip, min }) => (
              <InputField key={key} label={label}
                value={(financialData.cashFlowStatement[key as keyof typeof financialData.cashFlowStatement] ?? 0) as number}
                onChange={(val) => updateFinancialData(prev => ({
                  ...prev, cashFlowStatement: { ...prev.cashFlowStatement, [key]: val as number }
                }))}
                tooltip={tooltip}
                min={min}
                {...fieldProps} />
            ))}
          </div>

          {/* C1: Cash Flow Reconciliation */}
          {(() => {
            const fcf = financialData.cashFlowStatement.freeCashFlow || 0;
            const divs = financialData.cashFlowStatement.dividendsPaid || 0;
            const net = financialData.cashFlowStatement.netChangeInCash || 0;
            const other = net - (fcf - divs);
            const hasGap = Math.abs(other) > 0 && fcf > 0;
            return hasGap ? (
              <div className={`mt-4 p-4 rounded-lg border ${isDarkMode ? 'border-zinc-700 bg-zinc-800/50' : 'border-gray-200 bg-gray-50'}`}>
                <h4 className={`text-sm font-semibold mb-2 ${textClass}`}>Cash Flow Reconciliation</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span className={textMutedClass}>Free Cash Flow</span><span className={textClass}>+{formatNumber(fcf)}</span></div>
                  <div className="flex justify-between"><span className={textMutedClass}>Dividends Paid</span><span className="text-red-400">-{formatNumber(divs)}</span></div>
                  <div className="flex justify-between"><span className={textMutedClass}>Other Financing/Investing</span><span className={other >= 0 ? 'text-green-400' : 'text-red-400'}>{other >= 0 ? '+' : ''}{formatNumber(other)}</span></div>
                  <div className={`flex justify-between border-t pt-1 ${isDarkMode ? 'border-zinc-600' : 'border-gray-300'} font-bold`}>
                    <span className={textClass}>Net Change in Cash</span>
                    <span className={textClass}>{net >= 0 ? '+' : ''}{formatNumber(net)}</span>
                  </div>
                </div>
                <div className={`mt-2 text-xs p-2 rounded ${isDarkMode ? 'bg-blue-900/30 text-blue-300' : 'bg-blue-50 text-blue-700'}`}>
                  ℹ️ Cash flow gap of {formatNumber(Math.abs(other))} detected. FCF less Dividends ({formatNumber(fcf - divs)}) ≠ Net Change in Cash ({formatNumber(net)}). This represents other financing or investing activities (e.g., debt repayment, equity issuance).
                </div>
              </div>
            ) : null;
          })()}
        </div>
      )}

      {/* Valuation Assumptions — Enhanced with CAPM, FCFF, DDM controls */}
      {inputSubTab === 'assumptions' && (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
          <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
            <Tooltip term="DCF">Valuation Assumptions</Tooltip>
          </h3>

          {/* Market Region Selector */}
          <div className={`mb-6 p-4 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <label className={`block text-sm font-medium mb-2 ${textClass}`}>
                  <Tooltip term="Risk-Free Rate">Market Region</Tooltip>
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setMarketRegion('USA');
                      updateAssumptions(prev => ({
                        ...prev,
                        riskFreeRate: MARKET_DEFAULTS.USA.riskFreeRate,
                        marketRiskPremium: MARKET_DEFAULTS.USA.marketRiskPremium,
                        terminalGrowthRate: MARKET_DEFAULTS.USA.terminalGrowthRate,
                      }));
                    }}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${marketRegion === 'USA'
                      ? 'bg-[var(--accent-gold)] text-[var(--bg-primary)] shadow-lg'
                      : isDarkMode
                        ? 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                  >
                    <span className="text-xl">🇺🇸</span>
                    <span className="ml-2">USA</span>
                  </button>
                  <button
                    onClick={() => {
                      setMarketRegion('Egypt');
                      updateAssumptions(prev => ({
                        ...prev,
                        riskFreeRate: MARKET_DEFAULTS.Egypt.riskFreeRate,
                        marketRiskPremium: MARKET_DEFAULTS.Egypt.marketRiskPremium,
                        terminalGrowthRate: MARKET_DEFAULTS.Egypt.terminalGrowthRate,
                      }));
                    }}
                    className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${marketRegion === 'Egypt'
                      ? 'bg-[var(--accent-gold)] text-[var(--bg-primary)] shadow-lg'
                      : isDarkMode
                        ? 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                  >
                    <span className="text-xl">🇪🇬</span>
                    <span className="ml-2">Egypt</span>
                  </button>
                </div>
              </div>
              <div className={`text-sm ${textMutedClass}`}>
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-3 h-3 rounded-full ${marketRegion === 'USA' ? 'bg-blue-500' : 'bg-yellow-500'}`}></span>
                  <span>{MARKET_DEFAULTS[marketRegion].marketDescription}</span>
                </div>
                <div className="mt-1">
                  <span className="font-medium">Source:</span> {MARKET_DEFAULTS[marketRegion].description}
                </div>
                <div className="mt-1">
                  Risk-Free: <span className="font-semibold text-red-400">{MARKET_DEFAULTS[marketRegion].riskFreeRate}%</span>
                  {' | '}
                  MRP: <span className="font-semibold text-red-400">{MARKET_DEFAULTS[marketRegion].marketRiskPremium}%</span>
                  {' | '}
                  Tax: <span className="font-semibold text-red-400">{MARKET_DEFAULTS[marketRegion].defaultTaxRate}%</span>
                </div>
                <div className="mt-1">
                  Currency: <span className="font-semibold text-green-400">{MARKET_DEFAULTS[marketRegion].currencySymbol} ({marketRegion === 'USA' ? 'US Dollar' : 'Egyptian Pound'})</span>
                </div>
                {marketRegion === 'Egypt' && (
                  <div className="mt-2 p-2 bg-yellow-500/10 rounded text-yellow-400 text-xs">
                    ⚠️ Egyptian market has high interest rates (~27%) and currency volatility. WACC will be significantly higher than US stocks.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CAPM Method Toggle — 4 Methods */}
          <div className="mb-6">
            <h4 className={`text-sm font-semibold mb-3 text-purple-400 uppercase tracking-wide`}>
              CAPM Method
            </h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
              {([
                { id: 'local_rf' as const, label: 'Local Rf', desc: 'Ke = Rf_local + β×ERP' },
                { id: 'A' as const, label: 'Method A', desc: 'Ke = Rf + β×ERP + CRP' },
                { id: 'B' as const, label: 'Method B', desc: 'USD Build-Up + Fisher' },
                { id: 'C' as const, label: 'Method C', desc: 'Ke = Rf + β×ERP + λ×CRP' },
              ]).map(({ id, label, desc }) => (
                <button
                  key={id}
                  onClick={() => updateAssumptions(prev => ({ ...prev, capmMethod: id }))}
                  className={`px-3 py-2.5 rounded-lg font-medium text-sm transition-all text-center ${assumptions.capmMethod === id
                    ? 'bg-[var(--accent-gold)] text-[var(--bg-primary)] shadow-lg'
                    : isDarkMode
                      ? 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                >
                  <div>{label}</div>
                  <div className={`text-[10px] mt-0.5 font-normal ${assumptions.capmMethod === id ? 'opacity-70' : textMutedClass}`}>{desc}</div>
                </button>
              ))}
            </div>
            <p className={`text-xs ${textMutedClass}`}>
              {assumptions.capmMethod === 'local_rf'
                ? 'Ke = Rf(Egypt 10Y) + β × ERP. Country risk embedded in local risk-free rate. No separate CRP.'
                : assumptions.capmMethod === 'A'
                  ? 'Ke = Rf_clean + β × ERP + CRP. Use with clean (default-spread-adjusted) Rf only.'
                  : assumptions.capmMethod === 'B'
                    ? 'Ke = Rf(US) + β × (ERP + CRP), then Fisher adjustment to EGP.'
                    : 'Ke = Rf_clean + β × ERP + λ × CRP. Lambda adjusts country risk exposure (0–1).'}
            </p>
            {/* Double-counting warnings */}
            {marketRegion === 'Egypt' && (
              <div className={`mt-2 p-2 rounded-lg text-xs ${isDarkMode ? 'bg-blue-900/20 border border-blue-800' : 'bg-blue-50 border border-blue-200'}`}>
                {assumptions.capmMethod === 'local_rf' ? (
                  <span className="text-blue-400">
                    ℹ Using local Rf ({assumptions.riskFreeRate}%) which already embeds sovereign risk. Ke = {calculateKe(assumptions).toFixed(2)}%.
                  </span>
                ) : assumptions.capmMethod === 'A' ? (
                  assumptions.riskFreeRate > 10 ? (
                    <span className="text-red-400">
                      ⚠ Double-counting risk: Rf ({assumptions.riskFreeRate}%) appears to be a local EGP rate (embeds ~6.4% CRP). Method A adds CRP ({assumptions.countryRiskPremium}%) separately. Use "Local Rf" method instead, or switch to a clean Rf (~{((assumptions.rfCleanEGP ?? 9.49)).toFixed(1)}%).
                    </span>
                  ) : (
                    <span className="text-green-400">
                      ✓ Method A with clean Rf. Ke = {calculateKe(assumptions).toFixed(2)}%.
                    </span>
                  )
                ) : assumptions.capmMethod === 'B' ? (
                  assumptions.marketRiskPremium < 8 ? (
                    <span className="text-yellow-400">
                      ⚠ For USD Build-Up, total ERP should be 8-12% for Egypt. Current: {assumptions.marketRiskPremium}%.
                    </span>
                  ) : (
                    <span className="text-green-400">
                      ✓ Method B (USD Build-Up). Ke = {calculateKe(assumptions).toFixed(2)}%.
                    </span>
                  )
                ) : (
                  <span className="text-blue-400">
                    ℹ Method C with λ={assumptions.lambda ?? 1.0}. Ke = {calculateKe(assumptions).toFixed(2)}%.
                  </span>
                )}
              </div>
            )}
          </div>

          {/* WACC Components Section */}
          <div className="mb-6">
            <h4 className={`text-sm font-semibold mb-3 text-red-400 uppercase tracking-wide`}>
              WACC Components
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <InputField label="Risk-Free Rate" value={assumptions.riskFreeRate}
                  onChange={(val) => updateAssumptions(prev => ({ ...prev, riskFreeRate: val as number }))}
                  suffix="%" tooltip="Risk-Free Rate" step="0.1" {...fieldProps} />
                {/* C6: CBE Rate Reference Display — Phase 3 Live Card */}
                {marketRegion === 'Egypt' && egyptMacro && (
                  <div className={`text-xs mt-1.5 p-2.5 rounded-lg ${isDarkMode ? 'bg-zinc-800/70 border border-zinc-700' : 'bg-amber-50 border border-amber-200'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`font-semibold ${textMutedClass}`}>CBE / Market Rates</span>
                      {egyptMacro.isStale && <span className="text-xs text-red-400 font-semibold">⚠ STALE DATA</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                      <span className={textMutedClass}>10Y Gov Bond:</span>
                      <span className="font-mono font-semibold text-[var(--accent-gold)]">{egyptMacro.bondYields.tenYear}%</span>
                      <span className={textMutedClass}>CBE Deposit:</span>
                      <span className="font-mono">{egyptMacro.cbeRates.depositRate}%</span>
                      <span className={textMutedClass}>CBE Lending:</span>
                      <span className="font-mono">{egyptMacro.cbeRates.lendingRate}%</span>
                      <span className={textMutedClass}>Damodaran CRP:</span>
                      <span className="font-mono">{egyptMacro.damodaranCRP.countryRiskPremium}%</span>
                      <span className={textMutedClass}>Inflation (CPI):</span>
                      <span className="font-mono">{egyptMacro.inflation.headlineCPI}%</span>
                      <span className={textMutedClass}>Rating:</span>
                      <span className="font-mono">{egyptMacro.damodaranCRP.moodysRating} / {egyptMacro.damodaranCRP.spRating}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-zinc-700/50">
                      <span className={`text-[10px] ${textMutedClass}`}>Updated: {egyptMacro.lastUpdated}</span>
                      <button
                        onClick={() => updateAssumptions(prev => ({ ...prev, riskFreeRate: egyptMacro!.bondYields.tenYear }))}
                        className="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--accent-gold)]/20 text-[var(--accent-gold)] hover:bg-[var(--accent-gold)]/30 transition-colors"
                      >
                        Apply {egyptMacro.bondYields.tenYear}% as Rf
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <InputField label="Equity Risk Premium" value={assumptions.marketRiskPremium}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, marketRiskPremium: val as number }))}
                suffix="%" tooltip="Equity Risk Premium" step="0.1" {...fieldProps} />
              <InputField label="Beta" value={assumptions.beta}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, beta: val as number }))}
                tooltip="Beta" step="0.01" {...fieldProps} />
              <div>
                <label className={`block text-sm font-medium mb-1 ${textMutedClass}`}>Beta Type</label>
                <select
                  value={assumptions.betaType}
                  onChange={(e) => updateAssumptions(prev => ({ ...prev, betaType: e.target.value as any }))}
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
                >
                  <option value="raw">Raw Beta</option>
                  <option value="adjusted">Adjusted (Bloomberg)</option>
                  <option value="relevered">Relevered</option>
                </select>
              </div>
              <InputField label="Cost of Debt (Pre-Tax)" value={assumptions.costOfDebt}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, costOfDebt: val as number }))}
                suffix="%" step="0.1" {...fieldProps} />
              {/* Feature #2: Implied Kd Warning */}
              {(() => {
                const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
                const interestExp = financialData.incomeStatement.interestExpense;
                if (totalDebt <= 0 || interestExp <= 0) return null;
                const impliedKd = (interestExp / totalDebt) * 100;
                const gap = Math.abs((assumptions.costOfDebt || 0) - impliedKd);
                return (
                  <div className={`text-xs rounded-lg px-3 py-2 ${gap > 5 ? 'bg-yellow-900/30 border border-yellow-700/50' : 'bg-zinc-800/50 border border-zinc-700/30'}`}>
                    <span className={textMutedClass}>Implied from P&L: </span>
                    <span className={`font-semibold ${gap > 5 ? 'text-yellow-400' : textClass}`}>{impliedKd.toFixed(2)}%</span>
                    {gap > 5 && (
                      <p className="text-yellow-400/80 mt-1">
                        ⚠ Entered Kd differs by {gap.toFixed(1)}pp from implied rate.
                        Possible: historical bonds at different rates, or rate needs verification.
                      </p>
                    )}
                  </div>
                );
              })()}
              {/* CRP — visible for Methods A, B, C (not local_rf) */}
              {assumptions.capmMethod !== 'local_rf' && (
                <InputField label="Country Risk Premium" value={assumptions.countryRiskPremium}
                  onChange={(val) => updateAssumptions(prev => ({ ...prev, countryRiskPremium: val as number }))}
                  suffix="%" step="0.1" tooltip="Damodaran CRP for Egypt. Not used in Local Rf method." {...fieldProps} />
              )}
              {/* Lambda — visible for Method C only */}
              {assumptions.capmMethod === 'C' && (
                <InputField label="Lambda (λ)" value={assumptions.lambda ?? 1.0}
                  onChange={(val) => updateAssumptions(prev => ({ ...prev, lambda: val as number }))}
                  step="0.1" min={0} max={1} tooltip="Country risk exposure factor (0–1). 1.0 = full CRP exposure." {...fieldProps} />
              )}
              {/* Egyptian Tax Category */}
              {marketRegion === 'Egypt' ? (
                <div>
                  <label className={`block text-sm font-medium mb-1 ${textMutedClass}`}>Tax Category</label>
                  <select
                    value={assumptions.taxCategory || 'standard'}
                    onChange={(e) => {
                      const cat = EGYPTIAN_TAX_CATEGORIES.find(c => c.id === e.target.value);
                      if (cat) {
                        updateAssumptions(prev => ({ ...prev, taxCategory: e.target.value as EgyptTaxCategory, taxRate: cat.rate }));
                      }
                    }}
                    className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
                  >
                    {EGYPTIAN_TAX_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label} ({cat.rate}%)</option>
                    ))}
                  </select>
                </div>
              ) : (
                <InputField label="Statutory Tax Rate (for WACC & Projections)" value={assumptions.taxRate}
                  onChange={(val) => updateAssumptions(prev => ({ ...prev, taxRate: val as number }))}
                  suffix="%" step="0.1" min={0} tooltip="Used for WACC tax shield Kd×(1-t) and NOPAT in DCF projections EBIT×(1-t). May differ from effective rate." {...fieldProps} />
              )}
            </div>

            {/* Method B: USD Build-Up extra fields (conditional) */}
            {assumptions.capmMethod === 'B' && (
              <div className={`mt-4 p-4 rounded-lg border ${isDarkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-blue-50 border-blue-200'}`}>
                <h5 className={`text-xs font-semibold mb-3 text-blue-400 uppercase`}>Method B — USD Build-Up & Fisher Parameters</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InputField label="US Risk-Free Rate" value={assumptions.rfUS}
                    onChange={(val) => updateAssumptions(prev => ({ ...prev, rfUS: val as number }))}
                    suffix="%" step="0.1" {...fieldProps} />
                  <InputField label="Egypt Inflation" value={assumptions.egyptInflation}
                    onChange={(val) => updateAssumptions(prev => ({ ...prev, egyptInflation: val as number }))}
                    suffix="%" step="0.1" {...fieldProps} />
                  <InputField label="US Inflation" value={assumptions.usInflation}
                    onChange={(val) => updateAssumptions(prev => ({ ...prev, usInflation: val as number }))}
                    suffix="%" step="0.1" {...fieldProps} />
                </div>
              </div>
            )}

            {/* Calculated WACC Display */}
            <div className={`mt-3 p-3 rounded-lg ${'bg-[var(--bg-secondary)]'}`}>
              <div className="flex items-center justify-between">
                <span className={textMutedClass}>
                  <Tooltip term="WACC">Calculated Ke (Cost of Equity)</Tooltip>
                </span>
                <span className={`text-lg font-bold ${textClass}`}>
                  {formatPercent(calculateKe(assumptions))}
                </span>
              </div>
              <div className={`text-xs ${textMutedClass} mt-1`}>
                Ke ({assumptions.capmMethod}) = {calculateKe(assumptions).toFixed(2)}%
              </div>
            </div>
          </div>

          {/* FCFF Projection Drivers */}
          <div className="mb-6">
            <h4 className={`text-sm font-semibold mb-3 text-green-400 uppercase tracking-wide`}>
              FCFF Projection Drivers
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InputField label="Revenue Growth Rate" value={assumptions.revenueGrowthRate}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, revenueGrowthRate: val as number }))}
                suffix="%" step="0.1" {...fieldProps} />
              {/* A2: EBITDA Margin with historical badge */}
              <div>
                <InputField label="EBITDA Margin (Projection)" value={assumptions.ebitdaMargin}
                  onChange={(val) => updateAssumptions(prev => ({ ...prev, ebitdaMargin: val as number }))}
                  suffix="%" step="0.1" tooltip="Forward projection assumption for DCF — does NOT need to match historical." {...fieldProps} />
                {(() => {
                  const rev = financialData.incomeStatement.revenue;
                  const ebitda = financialData.incomeStatement.operatingIncome + financialData.incomeStatement.depreciation + financialData.incomeStatement.amortization;
                  if (rev <= 0) return null;
                  const hist = (ebitda / rev) * 100;
                  const delta = assumptions.ebitdaMargin - hist;
                  const absDelta = Math.abs(delta);
                  const color = absDelta > 5 ? 'text-red-400' : absDelta > 3 ? 'text-yellow-400' : 'text-green-400';
                  return (<>
                    <div className={`text-xs mt-1 flex items-center gap-2 ${color}`}>
                      <span>Historical: {hist.toFixed(1)}% {delta > 0 ? '▲' : '▼'} {absDelta.toFixed(1)}pp</span>
                      {absDelta > 1 && (
                        <button
                          onClick={() => updateAssumptions(prev => ({ ...prev, ebitdaMargin: Math.round(hist * 10) / 10 }))}
                          className="px-1.5 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[10px] transition-colors"
                          title={`Set projected EBITDA margin to historical ${hist.toFixed(1)}%`}
                        >📋 Use {hist.toFixed(1)}%</button>
                      )}
                    </div>
                    {delta < 0 && assumptions.revenueGrowthRate > 0 && (assumptions.ebitdaMargin * (1 + assumptions.revenueGrowthRate / 100) < hist) && (
                      <div className="text-xs text-[var(--accent-gold)] mt-0.5">⚠️ Year 1 EBITDA ({(financialData.incomeStatement.revenue * (1 + assumptions.revenueGrowthRate / 100) * assumptions.ebitdaMargin / 100 / 1e9).toFixed(2)}B) may decline vs base ({(ebitda / 1e9).toFixed(2)}B) despite {assumptions.revenueGrowthRate}% revenue growth</div>
                    )}
                  </>);
                })()}
              </div>
              {/* A2: D&A% with historical badge */}
              <div>
                <InputField label="D&A (% of Revenue)" value={assumptions.daPercent}
                  onChange={(val) => updateAssumptions(prev => ({ ...prev, daPercent: val as number }))}
                  suffix="%" step="0.1" tooltip="Forward projection — historical D&A% shown below." {...fieldProps} />
                {(() => {
                  const rev = financialData.incomeStatement.revenue;
                  const da = financialData.incomeStatement.depreciation + financialData.incomeStatement.amortization;
                  if (rev <= 0) return null;
                  const hist = (da / rev) * 100;
                  const delta = assumptions.daPercent - hist;
                  const absDelta = Math.abs(delta);
                  const color = absDelta > 5 ? 'text-red-400' : absDelta > 3 ? 'text-yellow-400' : 'text-green-400';
                  return (
                    <div className={`text-xs mt-1 flex items-center gap-2 ${color}`}>
                      <span>Historical: {hist.toFixed(1)}% {delta > 0 ? '▲' : '▼'} {absDelta.toFixed(1)}pp</span>
                      {absDelta > 1 && (
                        <button
                          onClick={() => updateAssumptions(prev => ({ ...prev, daPercent: Math.round(hist * 10) / 10 }))}
                          className="px-1.5 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[10px] transition-colors"
                          title={`Set projected D&A% to historical ${hist.toFixed(1)}%`}
                        >📋 Use {hist.toFixed(1)}%</button>
                      )}
                    </div>
                  );
                })()}
              </div>
              {/* A2: CapEx% with historical badge */}
              <div>
                <InputField label="CapEx (% of Revenue)" value={assumptions.capexPercent}
                  onChange={(val) => updateAssumptions(prev => ({ ...prev, capexPercent: val as number }))}
                  suffix="%" step="0.1" tooltip="Forward projection — historical CapEx% shown below." {...fieldProps} />
                {(() => {
                  const rev = financialData.incomeStatement.revenue;
                  const capex = Math.abs(financialData.cashFlowStatement.capitalExpenditures);
                  if (rev <= 0) return null;
                  const hist = (capex / rev) * 100;
                  const delta = assumptions.capexPercent - hist;
                  const absDelta = Math.abs(delta);
                  const color = absDelta > 5 ? 'text-red-400' : absDelta > 3 ? 'text-yellow-400' : 'text-green-400';
                  return (
                    <div className={`text-xs mt-1 flex items-center gap-2 ${color}`}>
                      <span>Historical: {hist.toFixed(1)}% {delta > 0 ? '▲' : '▼'} {absDelta.toFixed(1)}pp</span>
                      {absDelta > 1 && (
                        <button
                          onClick={() => updateAssumptions(prev => ({ ...prev, capexPercent: Math.round(hist * 10) / 10 }))}
                          className="px-1.5 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[10px] transition-colors"
                          title={`Set projected CapEx% to historical ${hist.toFixed(1)}%`}
                        >📋 Use {hist.toFixed(1)}%</button>
                      )}
                    </div>
                  );
                })()}
              </div>
              <InputField label="ΔWC (% of ΔRevenue)" value={assumptions.deltaWCPercent}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, deltaWCPercent: val as number }))}
                suffix="%" step="0.1" {...fieldProps} />
              <InputField label="Margin Improvement %/yr" value={assumptions.marginImprovement}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, marginImprovement: val as number }))}
                suffix="%" step="0.1" {...fieldProps} />
            </div>
          </div>

          {/* Terminal Value & DCF Settings */}
          <div className="mb-6">
            <h4 className={`text-sm font-semibold mb-3 text-blue-400 uppercase tracking-wide`}>
              Terminal Value & DCF Settings
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InputField label="Terminal Growth Rate" value={assumptions.terminalGrowthRate}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, terminalGrowthRate: val as number }))}
                suffix="%" tooltip="Terminal Growth" step="0.1" {...fieldProps} />
              <InputField label="Projection Years" value={assumptions.projectionYears}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, projectionYears: val as number }))}
                step="1" min={1} max={50} {...fieldProps} />
              <div>
                <label className={`block text-sm font-medium mb-1 ${textMutedClass}`}>Terminal Method</label>
                <select
                  value={assumptions.terminalMethod}
                  onChange={(e) => updateAssumptions(prev => ({ ...prev, terminalMethod: e.target.value as any }))}
                  className={`w-full px-3 py-2 rounded-lg border ${inputClass}`}
                >
                  <option value="gordon_growth">Gordon Growth Model</option>
                  <option value="exit_multiple">Exit Multiple</option>
                </select>
              </div>
              {assumptions.terminalMethod === 'exit_multiple' && (
                <InputField label="Exit EBITDA Multiple" value={assumptions.exitMultiple}
                  onChange={(val) => updateAssumptions(prev => ({ ...prev, exitMultiple: val as number }))}
                  step="0.5" {...fieldProps} />
              )}
            </div>

            {/* Discounting Convention */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label className={`block text-sm font-medium mb-1 ${textMutedClass}`}>Discounting Convention</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateAssumptions(prev => ({ ...prev, discountingConvention: 'end_of_year' }))}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${assumptions.discountingConvention === 'end_of_year'
                      ? 'bg-[var(--accent-gold)] text-[var(--bg-primary)]'
                      : isDarkMode ? 'bg-zinc-700 text-gray-300 hover:bg-zinc-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                  >
                    End of Year
                  </button>
                  <button
                    onClick={() => updateAssumptions(prev => ({ ...prev, discountingConvention: 'mid_year' }))}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${assumptions.discountingConvention === 'mid_year'
                      ? 'bg-[var(--accent-gold)] text-[var(--bg-primary)]'
                      : isDarkMode ? 'bg-zinc-700 text-gray-300 hover:bg-zinc-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                  >
                    Mid-Year
                  </button>
                </div>
              </div>
              {/* WACC Override */}
              <InputField label="Discount Rate (WACC)" value={assumptions.discountRate}
                onChange={(val) => {
                  const newVal = val as number;
                  const rounded = Math.round(autoWACC * 100) / 100;
                  const isOverride = Math.abs(newVal - rounded) > 0.01;
                  setIsWACCManualOverride(isOverride);
                  updateAssumptions(prev => ({ ...prev, discountRate: newVal }));
                }}
                suffix="%" tooltip="WACC" step="0.1" min={0} {...fieldProps} />
            </div>

            {/* Quick-Set WACC */}
            <div className={`mt-3 p-3 rounded-lg ${'bg-[var(--bg-secondary)]'}`}>
              {/* C1: Inline WACC breakdown */}
              <div className={`text-xs ${textMutedClass} mb-2`}>
                WACC = {(waccBreakdown.We * 100).toFixed(2)}% × {waccBreakdown.Ke.toFixed(2)}% + {(waccBreakdown.Wd * 100).toFixed(2)}% × {waccBreakdown.KdAfterTax.toFixed(2)}% = {autoWACC.toFixed(2)}%
              </div>
              <div className={`text-xs ${textMutedClass}`}>
                E={currency === 'EGP' ? 'EGP' : '$'}{(waccBreakdown.marketCap / 1e9).toFixed(2)}B, D={currency === 'EGP' ? 'EGP' : '$'}{(waccBreakdown.totalDebt / 1e9).toFixed(2)}B — Auto-calculated from current inputs.
              </div>

              {/* C1: Manual override warning */}
              {isWACCManualOverride && (
                <div className={`mt-2 p-2 rounded-lg border ${isDarkMode ? 'bg-yellow-900/20 border-yellow-700' : 'bg-yellow-50 border-yellow-300'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-yellow-400 font-medium">
                      ⚠ Manual override: {assumptions.discountRate.toFixed(3)}% entered. Auto-calculated = {autoWACC.toFixed(2)}%
                    </span>
                    <button
                      onClick={() => {
                        setIsWACCManualOverride(false);
                        // useEffect will fire and set discountRate = autoWACC
                      }}
                      className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-xs rounded-lg transition-colors ml-3"
                    >
                      Reset to Calculated WACC
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* B1: Scenario Configuration */}
          <div className="mb-6">
            <h4 className={`text-sm font-semibold mb-3 text-purple-400 uppercase tracking-wide`}>
              Scenario Configuration
            </h4>
            <div className={`p-4 rounded-lg border ${isDarkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-purple-50 border-purple-200'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h5 className="text-red-400 font-medium text-sm mb-2">🐻 Bear Case</h5>
                  <div className="space-y-1">
                    <div className={`text-xs ${textMutedClass}`}>Growth: {(assumptions.revenueGrowthRate * 0.40).toFixed(1)}% (base × 0.40)</div>
                    <div className={`text-xs ${textMutedClass}`}>WACC: {(assumptions.discountRate + 2.5).toFixed(1)}% (base + 2.5pp)</div>
                    <div className={`text-xs text-red-400`}>Margin: −1.5%/yr compression</div>
                  </div>
                </div>
                <div>
                  <h5 className="text-green-400 font-medium text-sm mb-2">🐂 Bull Case</h5>
                  <div className="space-y-1">
                    <div className={`text-xs ${textMutedClass}`}>Growth: {(assumptions.revenueGrowthRate * 2.0).toFixed(1)}% (base × 2.00)</div>
                    <div className={`text-xs ${textMutedClass}`}>WACC: {Math.max(2, assumptions.discountRate - 2.5).toFixed(1)}% (base − 2.5pp)</div>
                    <div className={`text-xs text-green-400`}>Margin: +2.5%/yr expansion</div>
                  </div>
                </div>
              </div>
              <div className={`mt-2 text-xs ${textMutedClass}`}>
                Terminal growth: Bear × 0.75, Bull × 1.25. Params shared across Engine/PDF/Excel.
              </div>
            </div>
          </div>

          {/* DDM Parameters */}
          <div>
            <h4 className={`text-sm font-semibold mb-3 text-orange-400 uppercase tracking-wide`}>
              DDM Parameters
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* DPS Input with Sync button */}
              <div>
                <InputField label="Dividends Per Share" value={financialData.dividendsPerShare}
                  onChange={(val) => updateFinancialData(prev => ({ ...prev, dividendsPerShare: val as number }))}
                  prefix={currency === 'EGP' ? 'EGP' : '$'} step="0.01" min={0} {...fieldProps} />
                {(() => {
                  const divPaid = Math.abs(financialData.cashFlowStatement.dividendsPaid || 0);
                  const derivedDPS = financialData.sharesOutstanding > 0 ? divPaid / financialData.sharesOutstanding : 0;
                  const enteredDPS = financialData.dividendsPerShare || 0;
                  const hasCFData = divPaid > 0;
                  const isDifferent = hasCFData && Math.abs(enteredDPS - derivedDPS) > 0.01;
                  return (
                    <div className="mt-1 flex items-center gap-2">
                      {hasCFData && (
                        <button
                          onClick={() => updateFinancialData(prev => ({ ...prev, dividendsPerShare: Math.round(derivedDPS * 100) / 100 }))}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${isDifferent
                            ? 'bg-orange-600/20 text-orange-400 hover:bg-orange-600/30'
                            : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700'}`}
                        >
                          Sync from Cash Flow ({derivedDPS.toFixed(2)})
                        </button>
                      )}
                      {isDifferent && (
                        <span className="text-[10px] text-yellow-400">
                          CF-derived: {derivedDPS.toFixed(2)}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
              <InputField label="Stable Growth Rate" value={assumptions.ddmStableGrowth}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, ddmStableGrowth: val as number }))}
                suffix="%" step="0.1" {...fieldProps} />
              <InputField label="High Growth Rate" value={assumptions.ddmHighGrowth}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, ddmHighGrowth: val as number }))}
                suffix="%" step="0.1" {...fieldProps} />
              <InputField label="High Growth Years" value={assumptions.ddmHighGrowthYears}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, ddmHighGrowthYears: val as number }))}
                step="1" min={1} max={10} {...fieldProps} />
            </div>
          </div>
        </div>
      )}

      {/* Comparable Companies */}
      {inputSubTab === 'comparables' && (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className={`text-lg font-semibold ${textClass}`}>
              <Tooltip term="Comparable Company Analysis">Comparable Companies</Tooltip>
            </h3>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setLoadingPeers(true);
                  try {
                    const peers = getSuggestedPeers(financialData.ticker, marketRegion);
                    if (peers.length > 0) {
                      const apiKey = import.meta.env.VITE_FMP_API_KEY || localStorage.getItem('fmp_api_key') || '';

                      // Fetch real peer data from API
                      const peerResults = await fetchAllPeerData(peers, apiKey || null);

                      if (peerResults.length === 0) {
                        console.warn('[WOLF] No peer data returned — API key may be missing or invalid');
                      }

                      // Map PeerCompanyData -> ComparableCompany format
                      const mapped: ComparableCompany[] = peerResults.map(r => ({
                        name: r.name,
                        ticker: r.ticker,
                        peRatio: r.peRatio,
                        evEbitda: r.evEbitda,
                        psRatio: r.psRatio,
                        pbRatio: r.pbRatio,
                        marketCap: r.marketCap || 0,
                        revenue: r.revenue || 0,
                      }));
                      updateComparables(mapped);
                    }
                  } catch (e) {
                    console.error('Failed to fetch peers:', e);
                  } finally {
                    setLoadingPeers(false);
                  }
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                {loadingPeers ? 'Loading...' : '🔍 Auto-fetch Peers'}
              </button>
              <button
                onClick={() => {
                  updateComparables([...comparables, {
                    name: '', ticker: '', peRatio: 0, evEbitda: 0,
                    psRatio: 0, pbRatio: 0, marketCap: 0, revenue: 0,
                  }]);
                }}
                className="px-4 py-2 btn-gold text-white text-sm rounded-lg transition-colors"
              >
                + Add Company
              </button>
            </div>
          </div>

          {/* Comparables Table */}
          {comparables.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={textMutedClass}>
                    <th className="text-left py-2 px-3 font-semibold">Company</th>
                    <th className="text-left py-2 px-3 font-semibold">Ticker</th>
                    <th className="text-right py-2 px-3 font-semibold">P/E</th>
                    <th className="text-right py-2 px-3 font-semibold">EV/EBITDA</th>
                    <th className="text-right py-2 px-3 font-semibold">P/S</th>
                    <th className="text-right py-2 px-3 font-semibold">P/B</th>
                    <th className="text-center py-2 px-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {comparables.map((comp, index) => (
                    <tr key={index} className={'border-t border-[var(--border)]'}>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={comp.name}
                          onChange={(e) => {
                            const updated = [...comparables];
                            updated[index] = { ...updated[index], name: e.target.value };
                            updateComparables(updated);
                          }}
                          className={`w-full px-2 py-1 rounded border ${inputClass}`}
                          placeholder="Company name"
                        />
                      </td>
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={comp.ticker}
                          onChange={(e) => {
                            const updated = [...comparables];
                            updated[index] = { ...updated[index], ticker: e.target.value };
                            updateComparables(updated);
                          }}
                          className={`w-20 px-2 py-1 rounded border ${inputClass}`}
                          placeholder="TICK"
                        />
                      </td>
                      {(['peRatio', 'evEbitda', 'psRatio', 'pbRatio'] as const).map(field => (
                        <td key={field} className="py-2 px-3">
                          <input
                            type="number"
                            step="0.1"
                            value={comp[field]}
                            onChange={(e) => {
                              const updated = [...comparables];
                              updated[index] = { ...updated[index], [field]: parseFloat(e.target.value) || 0 };
                              updateComparables(updated);
                            }}
                            className={`w-20 px-2 py-1 rounded border text-right ${inputClass}`}
                          />
                        </td>
                      ))}
                      <td className="py-2 px-3 text-center">
                        <button
                          onClick={() => {
                            const updated = comparables.filter((_, i) => i !== index);
                            updateComparables(updated);
                          }}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {comparables.length === 0 && (
            <div className={`text-center py-8 ${textMutedClass}`}>
              No comparable companies added. Click "Auto-fetch Peers" or "+ Add Company" to begin.
            </div>
          )}
        </div>
      )}

      {/* B2: Historical Data */}
      {inputSubTab === 'historical' && (
        <HistoricalDataPanel
          financialData={financialData}
          updateFinancialData={updateFinancialData}
          isDarkMode={isDarkMode}
          textMutedClass={textMutedClass}
          inputClass={inputClass}
        />
      )}
    </div>
  );
};

export default InputTab;
