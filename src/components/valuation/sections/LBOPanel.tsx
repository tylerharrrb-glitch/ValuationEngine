/**
 * LBO Screening Panel — Phase 4, Task #19
 * PE-style LBO returns analysis with entry/exit multiples and debt paydown.
 */
import React, { useState, useMemo } from 'react';
import { Tooltip } from '../../Tooltip';
import { FinancialData } from '../../../types/financial';
import { calculateLBO, DEFAULT_LBO_ASSUMPTIONS, LBOAssumptions } from '../../../utils/calculations/lboEngine';
import { formatCurrencyShort, CurrencyCode } from '../../../utils/formatters';

interface Props {
  financialData: FinancialData;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const LBOPanel: React.FC<Props> = ({
  financialData, isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => {
  const [assumptions, setAssumptions] = useState<LBOAssumptions>(DEFAULT_LBO_ASSUMPTIONS);
  const is = financialData.incomeStatement;
  const baseEbitda = is.operatingIncome + is.depreciation + is.amortization;

  const result = useMemo(() => calculateLBO(baseEbitda, assumptions), [baseEbitda, assumptions]);

  const update = (key: keyof LBOAssumptions, val: number) =>
    setAssumptions(prev => ({ ...prev, [key]: val }));

  const inputCls = `w-full px-2 py-1 rounded text-sm text-right font-mono ${isDarkMode ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-white border-gray-300 text-gray-900'} border`;

  const irrColor = result.equityIRR >= 25 ? 'text-green-400' : result.equityIRR >= 15 ? 'text-yellow-400' : 'text-red-400';
  const moicColor = result.moic >= 3 ? 'text-green-400' : result.moic >= 2 ? 'text-yellow-400' : 'text-red-400';

  return (
    <div className={`p-6 rounded-xl border ${cardClass}`}>
      <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
        <Tooltip term="LBO" definition="Leveraged Buyout screening model. Estimates sponsor equity returns (IRR, MoIC) for a hypothetical PE acquisition.">
          LBO
        </Tooltip>
        {' '}— Leveraged Buyout Screening
      </h3>

      {/* Assumptions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {([
          { key: 'entryMultiple', label: 'Entry EV/EBITDA', suffix: 'x', step: 0.5 },
          { key: 'exitMultiple', label: 'Exit EV/EBITDA', suffix: 'x', step: 0.5 },
          { key: 'holdingPeriod', label: 'Holding Period', suffix: ' yr', step: 1 },
          { key: 'leverageRatio', label: 'Debt / Capital', suffix: '%', step: 5 },
          { key: 'costOfDebt', label: 'Cost of Debt', suffix: '%', step: 0.5 },
          { key: 'ebitdaGrowth', label: 'EBITDA Growth', suffix: '%', step: 1 },
          { key: 'debtPaydownRate', label: 'Paydown Rate', suffix: '%', step: 5 },
          { key: 'taxRate', label: 'Tax Rate', suffix: '%', step: 0.5 },
        ] as { key: keyof LBOAssumptions; label: string; suffix: string; step: number }[]).map(({ key, label, suffix, step }) => (
          <div key={key}>
            <label className={`block text-xs mb-0.5 ${textMutedClass}`}>{label}</label>
            <div className="flex items-center gap-1">
              <input type="number" value={assumptions[key]} step={step}
                onChange={e => update(key, parseFloat(e.target.value) || 0)}
                className={inputCls} />
              <span className={`text-xs ${textMutedClass}`}>{suffix}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Results Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-xs ${textMutedClass}`}>Equity IRR</div>
          <div className={`text-2xl font-bold font-mono ${irrColor}`}>{result.equityIRR.toFixed(1)}%</div>
        </div>
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-xs ${textMutedClass}`}>MoIC</div>
          <div className={`text-2xl font-bold font-mono ${moicColor}`}>{result.moic.toFixed(2)}x</div>
        </div>
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-xs ${textMutedClass}`}>Entry Equity</div>
          <div className={`text-lg font-bold ${textClass}`}>{formatCurrencyShort(result.entryEquity, currency)}</div>
        </div>
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-xs ${textMutedClass}`}>Exit Equity</div>
          <div className={`text-lg font-bold text-green-400`}>{formatCurrencyShort(result.exitEquity, currency)}</div>
        </div>
      </div>

      {/* Debt Paydown Schedule */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className={textMutedClass}>
              <th className="text-left py-1.5 px-2">Year</th>
              <th className="text-right py-1.5 px-2">EBITDA</th>
              <th className="text-right py-1.5 px-2">Interest</th>
              <th className="text-right py-1.5 px-2">FCF</th>
              <th className="text-right py-1.5 px-2">Debt Repaid</th>
              <th className="text-right py-1.5 px-2">Debt Balance</th>
            </tr>
          </thead>
          <tbody>
            {result.yearlyProjections.map(p => (
              <tr key={p.year} className="border-t border-[var(--border)]">
                <td className={`py-1.5 px-2 font-medium ${textClass}`}>Y{p.year}</td>
                <td className={`py-1.5 px-2 text-right font-mono ${textClass}`}>{formatCurrencyShort(p.ebitda, currency)}</td>
                <td className="py-1.5 px-2 text-right font-mono text-red-400">{formatCurrencyShort(p.interestExpense, currency)}</td>
                <td className="py-1.5 px-2 text-right font-mono text-green-400">{formatCurrencyShort(p.freeCashFlow, currency)}</td>
                <td className="py-1.5 px-2 text-right font-mono text-blue-400">{formatCurrencyShort(p.debtRepayment, currency)}</td>
                <td className={`py-1.5 px-2 text-right font-mono ${textMutedClass}`}>{formatCurrencyShort(p.debtBalance, currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`mt-3 text-xs ${textMutedClass}`}>
        Based on trailing EBITDA of {formatCurrencyShort(baseEbitda, currency)}.
        Total debt paid down: {formatCurrencyShort(result.totalDebtPaidDown, currency)}.
        PE target: IRR ≥ 25%, MoIC ≥ 2.5x.
      </div>
    </div>
  );
};
