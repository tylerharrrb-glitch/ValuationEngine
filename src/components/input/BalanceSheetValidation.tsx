/**
 * A3: Balance Sheet Auto-Validation
 * Real-time cross-checks with visible ✓/✗ indicators
 */
import React from 'react';
import { FinancialData } from '../../types/financial';
import { formatCurrencyShort, CurrencyCode } from '../../utils/formatters';

interface Props {
    financialData: FinancialData;
    isDarkMode: boolean;
    currency: CurrencyCode;
}

interface ValidationCheck {
    label: string;
    passed: boolean;
    severity: 'error' | 'warning' | 'info';
    message: string;
}

export const BalanceSheetValidation: React.FC<Props> = ({ financialData, isDarkMode, currency }) => {
    const bs = financialData.balanceSheet;
    const cf = financialData.cashFlowStatement;
    const checks: ValidationCheck[] = [];

    // Check 1: Balance sheet equation — Assets = Liabilities + Equity
    const bsBalance = Math.abs(bs.totalAssets - (bs.totalLiabilities + bs.totalEquity));
    const bsTolerance = bs.totalAssets * 0.01;
    checks.push({
        label: 'Balance Sheet Equation',
        passed: bsBalance <= bsTolerance,
        severity: bsBalance > bsTolerance ? 'error' : 'info',
        message: bsBalance <= bsTolerance
            ? `Assets (${formatCurrencyShort(bs.totalAssets)}) = Liabilities + Equity (${formatCurrencyShort(bs.totalLiabilities + bs.totalEquity)}) ✓`
            : `Assets (${formatCurrencyShort(bs.totalAssets)}) ≠ L+E (${formatCurrencyShort(bs.totalLiabilities + bs.totalEquity)}). Diff: ${formatCurrencyShort(bsBalance)}`,
    });

    // Check 2: Cash ≤ Total Assets
    checks.push({
        label: 'Cash ≤ Assets',
        passed: bs.cash <= bs.totalAssets,
        severity: bs.cash > bs.totalAssets ? 'error' : 'info',
        message: bs.cash <= bs.totalAssets ? 'Cash within total assets' : 'Cash exceeds total assets',
    });

    // Check 3: Total Debt ≤ Total Assets
    const totalDebt = bs.shortTermDebt + bs.longTermDebt;
    checks.push({
        label: 'Debt ≤ Assets',
        passed: totalDebt <= bs.totalAssets,
        severity: totalDebt > bs.totalAssets ? 'warning' : 'info',
        message: totalDebt <= bs.totalAssets ? 'Debt within total assets' : 'Total debt exceeds total assets',
    });

    // Check 4: DPS × Shares ≈ Dividends Paid
    const dividendsPaid = Math.abs(cf.dividendsPaid);
    if (dividendsPaid > 0 && financialData.dividendsPerShare > 0) {
        const impliedDiv = financialData.dividendsPerShare * financialData.sharesOutstanding;
        const divDiff = Math.abs(impliedDiv - dividendsPaid) / dividendsPaid;
        checks.push({
            label: 'DPS Consistency',
            passed: divDiff <= 0.05,
            severity: divDiff > 0.05 ? 'warning' : 'info',
            message: divDiff <= 0.05
                ? `DPS × Shares ≈ Dividends Paid (within ${(divDiff * 100).toFixed(1)}%)`
                : `DPS × Shares (${formatCurrencyShort(impliedDiv)}) differs from Div Paid (${formatCurrencyShort(dividendsPaid)}) by ${(divDiff * 100).toFixed(1)}%`,
        });
    }

    // Check 5: Net Income reconciliation
    const is = financialData.incomeStatement;
    if (is.operatingIncome > 0) {
        const impliedNI = is.operatingIncome - is.interestExpense - is.taxExpense;
        const niDiff = Math.abs(impliedNI - is.netIncome) / Math.abs(is.netIncome || 1);
        checks.push({
            label: 'Net Income Reconciliation',
            passed: niDiff <= 0.05,
            severity: niDiff > 0.05 ? 'warning' : 'info',
            message: niDiff <= 0.05
                ? 'EBIT - Interest - Tax ≈ Net Income'
                : `EBIT - Int - Tax = ${formatCurrencyShort(impliedNI)}, but NI = ${formatCurrencyShort(is.netIncome)}`,
        });
    }

    const allPass = checks.every(c => c.passed);

    return (
        <div className={`mt-4 p-3 rounded-lg border ${allPass
                ? isDarkMode ? 'bg-green-900/20 border-green-800/50' : 'bg-green-50 border-green-200'
                : isDarkMode ? 'bg-red-900/20 border-red-800/50' : 'bg-red-50 border-red-200'
            }`}>
            <div className="flex items-center gap-2 mb-2">
                <span className={`text-sm font-semibold ${allPass ? 'text-green-400' : 'text-red-400'}`}>
                    {allPass ? '✓' : '✗'} Balance Sheet Validation
                </span>
            </div>
            <div className="space-y-1">
                {checks.map((check, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                        <span className={check.passed ? 'text-green-400' : check.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}>
                            {check.passed ? '✓' : '✗'}
                        </span>
                        <span className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
                            {check.label}: {check.message}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
