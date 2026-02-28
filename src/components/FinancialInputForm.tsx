import React from 'react';
import { FinancialData, IncomeStatement, BalanceSheet, CashFlowStatement } from '../types/financial';
import { formatCurrencyShort } from '../utils/formatters';

interface Props {
  data: FinancialData;
  onChange: (data: FinancialData) => void;
}

export function FinancialInputForm({ data, onChange }: Props) {
  const [activeTab, setActiveTab] = React.useState<'company' | 'income' | 'balance' | 'cashflow'>('company');

  const updateField = (path: string, value: number | string) => {
    const newData = JSON.parse(JSON.stringify(data));
    const keys = path.split('.');
    let obj = newData;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = typeof value === 'string' ? value : value;
    onChange(newData);
  };

  const getIncomeValue = (key: keyof IncomeStatement) => data.incomeStatement[key];
  const getBalanceValue = (key: keyof BalanceSheet) => data.balanceSheet[key] ?? 0;
  const getCashFlowValue = (key: keyof CashFlowStatement) => data.cashFlowStatement[key] ?? 0;

  const inputClass = "w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm";
  const labelClass = "block text-zinc-500 text-xs font-medium mb-1";

  const tabs = [
    { id: 'company', label: 'Company Info' },
    { id: 'income', label: 'Income Statement' },
    { id: 'balance', label: 'Balance Sheet' },
    { id: 'cashflow', label: 'Cash Flow' },
  ] as const;

  const incomeFields: { key: keyof IncomeStatement; label: string }[] = [
    { key: 'revenue', label: 'Revenue' },
    { key: 'costOfGoodsSold', label: 'Cost of Goods Sold' },
    { key: 'grossProfit', label: 'Gross Profit' },
    { key: 'operatingExpenses', label: 'Operating Expenses' },
    { key: 'operatingIncome', label: 'Operating Income' },
    { key: 'interestExpense', label: 'Interest Expense' },
    { key: 'taxExpense', label: 'Tax Expense' },
    { key: 'netIncome', label: 'Net Income' },
    { key: 'depreciation', label: 'Depreciation' },
    { key: 'amortization', label: 'Amortization' },
  ];

  const assetFields: { key: keyof BalanceSheet; label: string }[] = [
    { key: 'cash', label: 'Cash & Equivalents' },
    { key: 'accountsReceivable', label: 'Accounts Receivable' },
    { key: 'inventory', label: 'Inventory' },
    { key: 'totalCurrentAssets', label: 'Total Current Assets' },
    { key: 'propertyPlantEquipment', label: 'PP&E' },
    { key: 'intangibleAssets', label: 'Intangible Assets' },
    { key: 'totalAssets', label: 'Total Assets' },
  ];

  const liabilityFields: { key: keyof BalanceSheet; label: string }[] = [
    { key: 'accountsPayable', label: 'Accounts Payable' },
    { key: 'shortTermDebt', label: 'Short-term Debt' },
    { key: 'totalCurrentLiabilities', label: 'Total Current Liabilities' },
    { key: 'longTermDebt', label: 'Long-term Debt' },
    { key: 'totalLiabilities', label: 'Total Liabilities' },
  ];

  const cashFlowFields: { key: keyof CashFlowStatement; label: string }[] = [
    { key: 'operatingCashFlow', label: 'Operating Cash Flow' },
    { key: 'capitalExpenditures', label: 'Capital Expenditures' },
    { key: 'freeCashFlow', label: 'Free Cash Flow' },
    { key: 'dividendsPaid', label: 'Dividends Paid' },
    { key: 'netChangeInCash', label: 'Net Change in Cash' },
  ];

  return (
    <div className="bg-gradient-to-br from-zinc-900 to-black rounded-xl p-6 border border-zinc-800">
      <h2 className="text-xl font-bold text-white mb-4">Financial Statements</h2>

      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${activeTab === tab.id
                ? 'bg-red-600 text-white shadow-lg shadow-red-900/30'
                : 'bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-700'
              }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'company' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Company Name</label>
            <input
              type="text"
              value={data.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Ticker Symbol</label>
            <input
              type="text"
              value={data.ticker}
              onChange={(e) => updateField('ticker', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Shares Outstanding</label>
            <input
              type="number"
              value={data.sharesOutstanding}
              onChange={(e) => updateField('sharesOutstanding', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
            <p className="text-xs text-zinc-600 mt-1">{(data.sharesOutstanding / 1e6).toFixed(0)}M shares</p>
          </div>
          <div>
            <label className={labelClass}>Current Stock Price ($)</label>
            <input
              type="number"
              step="0.01"
              value={data.currentStockPrice}
              onChange={(e) => updateField('currentStockPrice', parseFloat(e.target.value) || 0)}
              className={inputClass}
            />
            <p className="text-xs text-zinc-600 mt-1">Market Cap: {formatCurrencyShort(data.currentStockPrice * data.sharesOutstanding)}</p>
          </div>
        </div>
      )}

      {activeTab === 'income' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {incomeFields.map((field) => (
            <div key={field.key}>
              <label className={labelClass}>{field.label}</label>
              <input
                type="number"
                value={getIncomeValue(field.key)}
                onChange={(e) => updateField(`incomeStatement.${field.key}`, parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
              <p className="text-xs text-zinc-600 mt-1">
                {formatCurrencyShort(getIncomeValue(field.key))}
              </p>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'balance' && (
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-red-400 mb-3">Assets</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {assetFields.map((field) => (
                <div key={field.key}>
                  <label className={labelClass}>{field.label}</label>
                  <input
                    type="number"
                    value={getBalanceValue(field.key)}
                    onChange={(e) => updateField(`balanceSheet.${field.key}`, parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                  <p className="text-xs text-zinc-600 mt-1">
                    {formatCurrencyShort(getBalanceValue(field.key))}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-yellow-400 mb-3">Liabilities</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {liabilityFields.map((field) => (
                <div key={field.key}>
                  <label className={labelClass}>{field.label}</label>
                  <input
                    type="number"
                    value={getBalanceValue(field.key)}
                    onChange={(e) => updateField(`balanceSheet.${field.key}`, parseFloat(e.target.value) || 0)}
                    className={inputClass}
                  />
                  <p className="text-xs text-zinc-600 mt-1">
                    {formatCurrencyShort(getBalanceValue(field.key))}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-green-400 mb-3">Equity</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Total Equity</label>
                <input
                  type="number"
                  value={data.balanceSheet.totalEquity}
                  onChange={(e) => updateField('balanceSheet.totalEquity', parseFloat(e.target.value) || 0)}
                  className={inputClass}
                />
                <p className="text-xs text-zinc-600 mt-1">{formatCurrencyShort(data.balanceSheet.totalEquity)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'cashflow' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {cashFlowFields.map((field) => (
            <div key={field.key}>
              <label className={labelClass}>{field.label}</label>
              <input
                type="number"
                value={getCashFlowValue(field.key)}
                onChange={(e) => updateField(`cashFlowStatement.${field.key}`, parseFloat(e.target.value) || 0)}
                className={inputClass}
              />
              <p className="text-xs text-zinc-600 mt-1">
                {formatCurrencyShort(getCashFlowValue(field.key))}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
