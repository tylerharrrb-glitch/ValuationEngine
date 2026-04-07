/**
 * FCFE (Free Cash Flow to Equity) Section — Task #8
 * JPMorgan equity models always show FCFE separately from FCFF.
 * FCFE = FCFF - Interest × (1-t) + Net Debt Change
 */
import React from 'react';
import { Tooltip } from '../../Tooltip';
import { FinancialData, ValuationAssumptions } from '../../../types/financial';
import { formatCurrencyShort, CurrencyCode } from '../../../utils/formatters';

interface Props {
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  isDarkMode: boolean;
  cardClass: string;
  textClass: string;
  textMutedClass: string;
  currency: CurrencyCode;
}

export const FCFESection: React.FC<Props> = ({
  financialData, assumptions, isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => {
  const { incomeStatement: is, balanceSheet: bs, cashFlowStatement: cf } = financialData;
  const taxRate = assumptions.taxRate / 100;

  // Base year FCFF (NOPAT route — same as FCFF Reconciliation)
  const dAndA = is.depreciation + is.amortization;
  const nopat = is.operatingIncome * (1 - taxRate);
  const capex = Math.abs(cf.capitalExpenditures);
  const deltaWC = 0; // base year
  const fcff = nopat + dAndA - capex - deltaWC;

  // After-tax interest expense
  const afterTaxInterest = is.interestExpense * (1 - taxRate);

  // Net debt change (base year — typically 0 if no prior year data)
  const netDebtChange = 0; // No prior year to diff against

  // FCFE = FCFF - Interest × (1-t) + Net Debt Change
  const fcfe = fcff - afterTaxInterest + netDebtChange;
  const fcfePerShare = financialData.sharesOutstanding > 0
    ? fcfe / financialData.sharesOutstanding : 0;
  const marketCap = financialData.currentStockPrice * financialData.sharesOutstanding;
  const fcfeYield = marketCap > 0 ? (fcfe / marketCap) * 100 : 0;

  // Payout capacity: FCFE vs dividends paid
  const divsPaid = Math.abs(cf.dividendsPaid || 0);
  const fcfeCoverage = divsPaid > 0 ? fcfe / divsPaid : 0;

  const bridgeItems = [
    { label: 'FCFF (Base Year)', value: fcff, color: 'text-green-400', bold: true },
    { label: '− After-Tax Interest [Int × (1-t)]', value: -afterTaxInterest, color: 'text-red-400', bold: false },
    { label: '+ Net Debt Change', value: netDebtChange, color: 'text-blue-400', bold: false },
    { label: '= FCFE (Free Cash Flow to Equity)', value: fcfe, color: 'text-[var(--accent-gold)]', bold: true },
  ];

  return (
    <div className={`p-6 rounded-xl border ${cardClass}`}>
      <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
        <Tooltip term="FCFE" definition="Free Cash Flow to Equity — cash available to equity holders after debt service obligations. FCFE = FCFF − Interest×(1-t) + Net Debt Change.">
          FCFE
        </Tooltip>
        {' '}— Free Cash Flow to Equity
      </h3>

      {/* FCFE Bridge */}
      <div className="space-y-1 mb-4">
        {bridgeItems.map((item) => (
          <div
            key={item.label}
            className={`flex justify-between items-center py-1.5 px-3 rounded ${
              item.bold ? (isDarkMode ? 'bg-zinc-800/50' : 'bg-gray-50') : ''
            }`}
          >
            <span className={`text-sm ${item.bold ? `font-semibold ${textClass}` : textMutedClass}`}>
              {item.label}
            </span>
            <span className={`text-sm font-mono ${item.bold ? 'font-bold' : 'font-medium'} ${item.color}`}>
              {item.value >= 0 ? '' : '−'}{formatCurrencyShort(Math.abs(item.value), currency)}
            </span>
          </div>
        ))}
      </div>

      {/* Key FCFE Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-xs ${textMutedClass}`}>FCFE / Share</div>
          <div className={`text-lg font-bold ${textClass}`}>{currency} {fcfePerShare.toFixed(2)}</div>
        </div>
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-xs ${textMutedClass}`}>FCFE Yield</div>
          <div className={`text-lg font-bold ${fcfeYield > 5 ? 'text-green-400' : fcfeYield > 0 ? 'text-yellow-400' : 'text-red-400'}`}>
            {fcfeYield.toFixed(2)}%
          </div>
        </div>
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-xs ${textMutedClass}`}>Dividend Coverage</div>
          <div className={`text-lg font-bold ${fcfeCoverage > 2 ? 'text-green-400' : fcfeCoverage > 1 ? 'text-yellow-400' : 'text-red-400'}`}>
            {divsPaid > 0 ? `${fcfeCoverage.toFixed(1)}x` : 'N/A'}
          </div>
        </div>
        <div className={`p-3 rounded-lg border ${isDarkMode ? 'bg-zinc-800 border-zinc-700' : 'bg-gray-50 border-gray-100'}`}>
          <div className={`text-xs ${textMutedClass}`}>FCFE vs FCFF Gap</div>
          <div className={`text-lg font-bold ${textMutedClass}`}>
            {fcff > 0 ? `${((afterTaxInterest / fcff) * 100).toFixed(1)}%` : 'N/A'}
          </div>
        </div>
      </div>

      <div className={`mt-3 text-xs ${textMutedClass}`}>
        FCFE represents cash available to equity holders after debt obligations.
        {fcfePerShare > 0 && fcfePerShare > (Math.abs(cf.dividendsPaid) / financialData.sharesOutstanding) &&
          ' Current dividends are comfortably covered by FCFE.'}
        {' '}Formula: FCFE = FCFF − Interest×(1-t) + ΔDebt.
      </div>
    </div>
  );
};
