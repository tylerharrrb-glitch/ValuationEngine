/**
 * Input Tab — Orchestrates all input sub-tabs (Company Info, Income Statement,
 * Balance Sheet, Cash Flow, Assumptions, Comparables).
 */
import React, { useState } from 'react';
import { FinancialData, ValuationAssumptions, ComparableCompany, MarketRegion, EgyptTaxCategory } from '../../types/financial';
import { CurrencyCode } from '../../utils/formatters';
import { InputField } from '../shared/InputField';
import { StockSearch } from '../StockSearch';
import { Tooltip } from '../Tooltip';
import { MARKET_DEFAULTS, EGYPTIAN_TAX_CATEGORIES } from '../../constants/marketDefaults';
import { formatPercent } from '../../utils/formatters';
import { fetchAllPeerData, getSuggestedPeers } from '../../services/stockAPI';
import { calculateWACC } from '../../utils/valuation';

type InputSubTab = 'company' | 'income' | 'balance' | 'cashflow' | 'assumptions' | 'comparables';

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

  // Shared InputField props
  const fieldProps = { isDarkMode, textMutedClass, inputClass, currency };

  return (
    <div className="space-y-6">
      {/* Stock Search */}
      <StockSearch
        onDataFetched={(data: any) => handleStockDataFetched(data, marketRegion, setMarketRegion)}
        isDarkMode={isDarkMode}
        market={marketRegion}
      />

      {/* Sub-tabs for input sections */}
      <div className={`flex flex-wrap gap-2 p-2 rounded-lg ${isDarkMode ? 'bg-zinc-900' : 'bg-gray-100'}`}>
        {([
          { id: 'company', label: 'Company Info' },
          { id: 'income', label: 'Income Statement' },
          { id: 'balance', label: 'Balance Sheet' },
          { id: 'cashflow', label: 'Cash Flow' },
          { id: 'assumptions', label: 'Assumptions' },
          { id: 'comparables', label: 'Comparables' },
        ] as { id: InputSubTab; label: string }[]).map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setInputSubTab(id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${inputSubTab === id
              ? 'bg-red-600 text-white'
              : isDarkMode
                ? 'text-gray-400 hover:text-white hover:bg-zinc-800'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
              }`}
          >
            {label}
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
              prefix="$" step="0.01" min={0} {...fieldProps} />
          </div>
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
                value={financialData.balanceSheet[key as keyof typeof financialData.balanceSheet]}
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
                value={financialData.balanceSheet[key as keyof typeof financialData.balanceSheet]}
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
                value={financialData.balanceSheet[key as keyof typeof financialData.balanceSheet]}
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
                value={financialData.balanceSheet[key as keyof typeof financialData.balanceSheet]}
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
          </div>
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
                value={financialData.cashFlowStatement[key as keyof typeof financialData.cashFlowStatement]}
                onChange={(val) => updateFinancialData(prev => ({
                  ...prev, cashFlowStatement: { ...prev.cashFlowStatement, [key]: val as number }
                }))}
                tooltip={tooltip}
                min={min}
                {...fieldProps} />
            ))}
          </div>
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
                      ? 'bg-red-600 text-white shadow-lg'
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
                      ? 'bg-red-600 text-white shadow-lg'
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

          {/* CAPM Method Toggle */}
          <div className="mb-6">
            <h4 className={`text-sm font-semibold mb-3 text-purple-400 uppercase tracking-wide`}>
              CAPM Method
            </h4>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => updateAssumptions(prev => ({ ...prev, capmMethod: 'A' }))}
                className={`flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-all ${assumptions.capmMethod === 'A'
                  ? 'bg-red-600 text-white shadow-lg'
                  : isDarkMode
                    ? 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                A — Local Currency CAPM
              </button>
              <button
                onClick={() => updateAssumptions(prev => ({ ...prev, capmMethod: 'B' }))}
                className={`flex-1 px-4 py-3 rounded-lg font-medium text-sm transition-all ${assumptions.capmMethod === 'B'
                  ? 'bg-red-600 text-white shadow-lg'
                  : isDarkMode
                    ? 'bg-zinc-700 text-gray-300 hover:bg-zinc-600'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
              >
                B — USD Build-Up
              </button>
            </div>
            <p className={`text-xs ${textMutedClass}`}>
              {assumptions.capmMethod === 'A'
                ? 'Ke = Rf(Egypt 10Y) + β × ERP. Country risk embedded in local risk-free rate.'
                : 'Ke = Rf(US 10Y) + β × ERP + CRP, then Fisher adjustment to EGP.'}
            </p>
          </div>

          {/* WACC Components Section */}
          <div className="mb-6">
            <h4 className={`text-sm font-semibold mb-3 text-red-400 uppercase tracking-wide`}>
              WACC Components
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <InputField label="Risk-Free Rate" value={assumptions.riskFreeRate}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, riskFreeRate: val as number }))}
                suffix="%" tooltip="Risk-Free Rate" step="0.1" {...fieldProps} />
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
                <InputField label="Tax Rate" value={assumptions.taxRate}
                  onChange={(val) => updateAssumptions(prev => ({ ...prev, taxRate: val as number }))}
                  suffix="%" step="0.1" min={0} {...fieldProps} />
              )}
            </div>

            {/* Method B: CRP fields (conditional) */}
            {assumptions.capmMethod === 'B' && (
              <div className={`mt-4 p-4 rounded-lg border ${isDarkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-blue-50 border-blue-200'}`}>
                <h5 className={`text-xs font-semibold mb-3 text-blue-400 uppercase`}>Method B — USD Build-Up Parameters</h5>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <InputField label="US Risk-Free Rate" value={assumptions.rfUS}
                    onChange={(val) => updateAssumptions(prev => ({ ...prev, rfUS: val as number }))}
                    suffix="%" step="0.1" {...fieldProps} />
                  <InputField label="Country Risk Premium" value={assumptions.countryRiskPremium}
                    onChange={(val) => updateAssumptions(prev => ({ ...prev, countryRiskPremium: val as number }))}
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
            <div className={`mt-3 p-3 rounded-lg ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
              <div className="flex items-center justify-between">
                <span className={textMutedClass}>
                  <Tooltip term="WACC">Calculated Ke (Cost of Equity)</Tooltip>
                </span>
                <span className={`text-lg font-bold ${textClass}`}>
                  {formatPercent(assumptions.riskFreeRate + (assumptions.beta * assumptions.marketRiskPremium))}
                </span>
              </div>
              <div className={`text-xs ${textMutedClass} mt-1`}>
                Ke = {assumptions.riskFreeRate}% + ({assumptions.beta} × {assumptions.marketRiskPremium}%) = {formatPercent(assumptions.riskFreeRate + (assumptions.beta * assumptions.marketRiskPremium))}
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
              <InputField label="EBITDA Margin" value={assumptions.ebitdaMargin}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, ebitdaMargin: val as number }))}
                suffix="%" step="0.1" {...fieldProps} />
              <InputField label="D&A (% of Revenue)" value={assumptions.daPercent}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, daPercent: val as number }))}
                suffix="%" step="0.1" {...fieldProps} />
              <InputField label="CapEx (% of Revenue)" value={assumptions.capexPercent}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, capexPercent: val as number }))}
                suffix="%" step="0.1" {...fieldProps} />
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
                        ? 'bg-red-600 text-white'
                        : isDarkMode ? 'bg-zinc-700 text-gray-300 hover:bg-zinc-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                  >
                    End of Year
                  </button>
                  <button
                    onClick={() => updateAssumptions(prev => ({ ...prev, discountingConvention: 'mid_year' }))}
                    className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-all ${assumptions.discountingConvention === 'mid_year'
                        ? 'bg-red-600 text-white'
                        : isDarkMode ? 'bg-zinc-700 text-gray-300 hover:bg-zinc-600' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                  >
                    Mid-Year
                  </button>
                </div>
              </div>
              {/* WACC Override */}
              <InputField label="Discount Rate (WACC)" value={assumptions.discountRate}
                onChange={(val) => updateAssumptions(prev => ({ ...prev, discountRate: val as number }))}
                suffix="%" tooltip="WACC" step="0.1" min={0} {...fieldProps} />
            </div>

            {/* Quick-Set WACC */}
            <div className={`mt-3 p-3 rounded-lg ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-100'}`}>
              <div className="flex items-center gap-3">
                <span className={`text-sm ${textMutedClass}`}>Quick Set:</span>
                <button
                  onClick={() => {
                    const wacc = calculateWACC(financialData, assumptions);
                    updateAssumptions(prev => ({ ...prev, discountRate: Math.round(wacc * 100) / 100 }));
                  }}
                  className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
                >
                  Auto-Calculate WACC
                </button>
              </div>
            </div>
          </div>

          {/* DDM Parameters */}
          <div>
            <h4 className={`text-sm font-semibold mb-3 text-orange-400 uppercase tracking-wide`}>
              DDM Parameters
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors"
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
                    <tr key={index} className={isDarkMode ? 'border-t border-zinc-800' : 'border-t border-gray-200'}>
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
    </div>
  );
};

export default InputTab;
