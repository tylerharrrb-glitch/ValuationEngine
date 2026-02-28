/**
 * FCFF Three-Way Reconciliation Panel (Fix S2)
 * Shows three methods of calculating FCFF and verifies they match.
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

export const FCFFReconciliation: React.FC<Props> = ({
    financialData, assumptions, isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => {
    const { incomeStatement: is, cashFlowStatement: cf } = financialData;
    const revenue = is.revenue;
    const ebitda = is.operatingIncome + is.depreciation + is.amortization;
    const dAndA = is.depreciation + is.amortization;
    const taxRate = assumptions.taxRate / 100; // statutory 22.5%
    // S1 Fix: Use ACTUAL CapEx from CFS, not projected assumption
    const capex = Math.abs(cf.capitalExpenditures);
    // Base year ΔWC is 0 (no prior year delta)
    const deltaWC = 0;

    // Method 1: NOPAT Route (uses statutory tax)
    const nopat = is.operatingIncome * (1 - taxRate);
    const method1 = nopat + dAndA - capex - deltaWC;

    // Method 2: EBITDA Route (uses statutory tax)
    const method2 = ebitda * (1 - taxRate) + dAndA * taxRate - capex - deltaWC;

    // Method 3: Net Income Route (uses actual NI = effective tax)
    const method3 = is.netIncome + is.interestExpense * (1 - taxRate) + dAndA - capex - deltaWC;

    // S2 Fix: Check reconciliation — M1 vs M2 (same tax), M1 vs M3 (tax rate diff)
    const m12Match = Math.abs(method1 - method2) < 1;
    const m13Match = Math.abs(method1 - method3) < 1;
    const allMatch = m12Match && m13Match;

    // S2: Explain tax rate mismatch between M1/M2 (statutory) and M3 (effective)
    const effectiveTax = (is.netIncome + is.taxExpense) > 0
        ? is.taxExpense / (is.netIncome + is.taxExpense) : taxRate;
    const taxGap = Math.abs(effectiveTax - taxRate);
    const diff = method3 - method1;

    let mismatchExplanation = '';
    if (!m13Match && taxGap > 0.005) {
        const ebt = is.operatingIncome - is.interestExpense;
        mismatchExplanation = `Methods 1 & 2 compute NOPAT using the statutory tax rate (${(taxRate * 100).toFixed(1)}%). ` +
            `Method 3 starts from reported Net Income, which reflects the effective tax rate (${(effectiveTax * 100).toFixed(1)}%). ` +
            `The reconciling difference = EBT × (statutory − effective) = ${formatCurrencyShort(Math.abs(ebt), currency)} × ` +
            `(${(taxRate * 100).toFixed(1)}% − ${(effectiveTax * 100).toFixed(1)}%) = ${formatCurrencyShort(Math.abs(diff), currency)}. ` +
            `This is normal. All DCF projections use the statutory rate.`;
    }

    const rows = [
        { method: 'Method 1 — NOPAT Route', formula: 'EBIT×(1-t) + D&A − CapEx − ΔWC', value: method1 },
        { method: 'Method 2 — EBITDA Route', formula: 'EBITDA×(1-t) + D&A×t − CapEx − ΔWC', value: method2 },
        { method: 'Method 3 — Net Income Route', formula: 'NI + Int×(1-t) + D&A − CapEx − ΔWC', value: method3 },
    ];

    return (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
            <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
                <Tooltip term="FCFF" definition="Free Cash Flow to Firm — cash available to all capital providers (debt + equity).">FCFF</Tooltip>
                {' '}Three-Way Reconciliation
                <span className={`ml-2 text-sm font-normal ${allMatch ? 'text-green-400' : 'text-yellow-400'}`}>
                    {allMatch ? '✓ All methods match' : m12Match ? '~ M1=M2 ✓ M3 differs (see note)' : '✗ Methods do not match — check inputs'}
                </span>
            </h3>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className={textMutedClass}>
                            <th className="text-left py-2 px-3">Method</th>
                            <th className="text-left py-2 px-3">Formula</th>
                            <th className="text-right py-2 px-3">Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.method} className={isDarkMode ? 'border-t border-zinc-800' : 'border-t border-gray-200'}>
                                <td className={`py-2 px-3 font-medium ${textClass}`}>{row.method}</td>
                                <td className={`py-2 px-3 ${textMutedClass} font-mono text-xs`}>{row.formula}</td>
                                <td className="py-2 px-3 text-right text-green-400 font-bold">{formatCurrencyShort(row.value, currency)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className={`mt-3 text-xs ${textMutedClass}`}>
                Components: NOPAT = {formatCurrencyShort(nopat, currency)} | D&A = {formatCurrencyShort(dAndA, currency)} | CapEx = {formatCurrencyShort(capex, currency)} | ΔWC = {formatCurrencyShort(deltaWC, currency)}
            </div>
            {mismatchExplanation && (
                <div className={`mt-2 text-xs p-2 rounded ${isDarkMode ? 'bg-zinc-800 text-yellow-300' : 'bg-yellow-50 text-yellow-700'}`}>
                    ℹ️ {mismatchExplanation}
                </div>
            )}
        </div>
    );
};
