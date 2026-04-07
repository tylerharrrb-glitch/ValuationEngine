/**
 * Precedent Transactions Panel — Phase 4, Task #21
 * Allows users to input M&A comparable transactions and derives
 * implied valuation from precedent EV/EBITDA, EV/Revenue, and P/E multiples.
 */
import React, { useState, useMemo } from 'react';
import { Tooltip } from '../../Tooltip';
import { FinancialData } from '../../../types/financial';
import { formatCurrencyShort, CurrencyCode } from '../../../utils/formatters';

interface PrecedentTransaction {
  target: string;
  acquirer: string;
  date: string;
  evRevenue: number;
  evEbitda: number;
  premium: number; // % premium to pre-deal price
}

interface Props {
  financialData: FinancialData;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

const SAMPLE_TRANSACTIONS: PrecedentTransaction[] = [
  { target: 'Transaction 1', acquirer: 'Acquirer A', date: '2025', evRevenue: 2.5, evEbitda: 10.0, premium: 25 },
  { target: 'Transaction 2', acquirer: 'Acquirer B', date: '2024', evRevenue: 3.0, evEbitda: 12.0, premium: 30 },
  { target: 'Transaction 3', acquirer: 'Acquirer C', date: '2024', evRevenue: 2.0, evEbitda: 8.5, premium: 20 },
];

export const PrecedentTransactionsPanel: React.FC<Props> = ({
  financialData, isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => {
  const [transactions, setTransactions] = useState<PrecedentTransaction[]>(SAMPLE_TRANSACTIONS);

  const is = financialData.incomeStatement;
  const bs = financialData.balanceSheet;
  const ebitda = is.operatingIncome + is.depreciation + is.amortization;
  const totalDebt = bs.shortTermDebt + bs.longTermDebt;

  const inputCls = `px-2 py-1 rounded text-sm text-right font-mono ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border`;

  // Compute medians
  const medians = useMemo(() => {
    const validEvRev = transactions.map(t => t.evRevenue).filter(v => v > 0).sort((a, b) => a - b);
    const validEvEbitda = transactions.map(t => t.evEbitda).filter(v => v > 0).sort((a, b) => a - b);
    const validPremium = transactions.map(t => t.premium).filter(v => v > 0).sort((a, b) => a - b);
    const median = (arr: number[]) => arr.length === 0 ? 0 : arr.length % 2 ? arr[Math.floor(arr.length / 2)] : (arr[arr.length / 2 - 1] + arr[arr.length / 2]) / 2;
    return {
      evRevenue: median(validEvRev),
      evEbitda: median(validEvEbitda),
      premium: median(validPremium),
    };
  }, [transactions]);

  // Implied values
  const impliedFromRevenue = is.revenue > 0 ? (is.revenue * medians.evRevenue - totalDebt + bs.cash) / financialData.sharesOutstanding : 0;
  const impliedFromEbitda = ebitda > 0 ? (ebitda * medians.evEbitda - totalDebt + bs.cash) / financialData.sharesOutstanding : 0;
  const impliedFromPremium = financialData.currentStockPrice * (1 + medians.premium / 100);

  const updateTxn = (idx: number, key: keyof PrecedentTransaction, val: string | number) => {
    setTransactions(prev => prev.map((t, i) => i === idx ? { ...t, [key]: val } : t));
  };
  const addTxn = () => setTransactions(prev => [...prev, { target: `Transaction ${prev.length + 1}`, acquirer: '', date: '', evRevenue: 0, evEbitda: 0, premium: 0 }]);
  const removeTxn = (idx: number) => { if (transactions.length > 1) setTransactions(prev => prev.filter((_, i) => i !== idx)); };

  return (
    <div className={`p-6 rounded-xl border ${cardClass}`}>
      <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
        <Tooltip term="Precedent Transactions" definition="M&A comparable analysis — derives implied valuation from multiples paid in similar acquisitions.">
          Precedent Transactions
        </Tooltip>
        {' '}— M&A Comps
      </h3>

      {/* Transactions Table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-xs">
          <thead>
            <tr className={textMutedClass}>
              <th className="text-left py-1.5 px-2">Target</th>
              <th className="text-left py-1.5 px-2">Acquirer</th>
              <th className="text-left py-1.5 px-2">Date</th>
              <th className="text-right py-1.5 px-2">EV/Rev</th>
              <th className="text-right py-1.5 px-2">EV/EBITDA</th>
              <th className="text-right py-1.5 px-2">Premium %</th>
              <th className="py-1.5 px-1"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((txn, idx) => (
              <tr key={idx} className="border-t border-[var(--border)]">
                <td className="py-1 px-2"><input type="text" value={txn.target} onChange={e => updateTxn(idx, 'target', e.target.value)} className={`w-28 ${inputCls} text-left`} /></td>
                <td className="py-1 px-2"><input type="text" value={txn.acquirer} onChange={e => updateTxn(idx, 'acquirer', e.target.value)} className={`w-24 ${inputCls} text-left`} /></td>
                <td className="py-1 px-2"><input type="text" value={txn.date} onChange={e => updateTxn(idx, 'date', e.target.value)} className={`w-16 ${inputCls} text-left`} /></td>
                <td className="py-1 px-2"><input type="number" value={txn.evRevenue} step={0.1} onChange={e => updateTxn(idx, 'evRevenue', parseFloat(e.target.value) || 0)} className={`w-16 ${inputCls}`} /></td>
                <td className="py-1 px-2"><input type="number" value={txn.evEbitda} step={0.5} onChange={e => updateTxn(idx, 'evEbitda', parseFloat(e.target.value) || 0)} className={`w-16 ${inputCls}`} /></td>
                <td className="py-1 px-2"><input type="number" value={txn.premium} step={1} onChange={e => updateTxn(idx, 'premium', parseFloat(e.target.value) || 0)} className={`w-16 ${inputCls}`} /></td>
                <td className="py-1 px-1">{transactions.length > 1 && <button onClick={() => removeTxn(idx)} className="text-red-400 hover:text-red-300 text-xs">✕</button>}</td>
              </tr>
            ))}
            {/* Median row */}
            <tr className={`border-t-2 ${isDarkMode ? 'border-zinc-600' : 'border-gray-300'}`}>
              <td colSpan={3} className={`py-1.5 px-2 text-xs font-bold ${textClass}`}>MEDIAN</td>
              <td className="py-1.5 px-2 text-right font-mono font-bold text-[var(--accent-gold)]">{medians.evRevenue.toFixed(1)}x</td>
              <td className="py-1.5 px-2 text-right font-mono font-bold text-[var(--accent-gold)]">{medians.evEbitda.toFixed(1)}x</td>
              <td className="py-1.5 px-2 text-right font-mono font-bold text-[var(--accent-gold)]">{medians.premium.toFixed(0)}%</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <button onClick={addTxn}
        className={`w-full py-1.5 rounded-lg border-2 border-dashed text-xs font-medium mb-4 transition-colors ${isDarkMode ? 'border-zinc-700 text-zinc-500 hover:border-zinc-500' : 'border-gray-300 text-gray-500'}`}>
        + Add Transaction
      </button>

      {/* Implied Values */}
      <div className="grid grid-cols-3 gap-3">
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-[10px] ${textMutedClass}`}>Implied (EV/Revenue)</div>
          <div className={`text-lg font-bold font-mono ${textClass}`}>{currency} {impliedFromRevenue.toFixed(2)}</div>
        </div>
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-[10px] ${textMutedClass}`}>Implied (EV/EBITDA)</div>
          <div className={`text-lg font-bold font-mono ${textClass}`}>{currency} {impliedFromEbitda.toFixed(2)}</div>
        </div>
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-[10px] ${textMutedClass}`}>Implied (Premium)</div>
          <div className={`text-lg font-bold font-mono ${textClass}`}>{currency} {impliedFromPremium.toFixed(2)}</div>
        </div>
      </div>

      <div className={`mt-3 text-xs ${textMutedClass}`}>
        Enter precedent M&A transactions in your sector. Median multiples are applied to {financialData.ticker}'s financials to derive implied per-share values.
      </div>
    </div>
  );
};
