import React from 'react';
import { FinancialData } from '../../../types/financial';
import { formatPercent, formatCurrencyShort, CurrencyCode } from '../../../utils/formatters';

interface Props {
  financialData: FinancialData;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const BaseYearFCF: React.FC<Props> = ({ financialData, isDarkMode, cardClass, textClass, textMutedClass, currency }) => (
  <div className={`p-6 rounded-xl border ${cardClass}`}>
    <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Base Year Free Cash Flow Calculation</h3>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className={`p-4 rounded-lg ${'bg-[var(--bg-secondary)]'}`}>
        <div className={`text-sm ${textMutedClass}`}>Operating Cash Flow</div>
        <div className={`text-xl font-bold ${textClass}`}>{formatCurrencyShort(financialData.cashFlowStatement.operatingCashFlow, currency)}</div>
      </div>
      <div className={`p-4 rounded-lg ${'bg-[var(--bg-secondary)]'} flex items-center justify-center`}>
        <span className={`text-2xl ${textMutedClass}`}>−</span>
      </div>
      <div className={`p-4 rounded-lg ${'bg-[var(--bg-secondary)]'}`}>
        <div className={`text-sm ${textMutedClass}`}>Capital Expenditures</div>
        <div className={`text-xl font-bold ${textClass}`}>{formatCurrencyShort(financialData.cashFlowStatement.capitalExpenditures, currency)}</div>
      </div>
      <div className="p-4 rounded-lg bg-green-500/20 border border-green-500/50">
        <div className="text-sm text-green-400">= Free Cash Flow (Base)</div>
        <div className="text-xl font-bold text-green-400">
          {formatCurrencyShort(financialData.cashFlowStatement.operatingCashFlow - financialData.cashFlowStatement.capitalExpenditures, currency)}
        </div>
      </div>
    </div>
    <div className={`mt-3 text-sm ${textMutedClass}`}>
      <strong>FCF Margin:</strong> {formatPercent((financialData.cashFlowStatement.freeCashFlow / financialData.incomeStatement.revenue) * 100)} of Revenue
      {' | '}
      <strong>Stored FCF:</strong> {formatCurrencyShort(financialData.cashFlowStatement.freeCashFlow, currency)}
      {Math.abs((financialData.cashFlowStatement.operatingCashFlow - financialData.cashFlowStatement.capitalExpenditures) - financialData.cashFlowStatement.freeCashFlow) > 1000000 && (
        <span className="text-yellow-400 ml-2">⚠ Note: Stored FCF differs from OCF - CapEx calculation</span>
      )}
    </div>
  </div>
);
