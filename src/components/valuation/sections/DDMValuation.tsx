/**
 * S5: DDM Valuation Display — shows Gordon Growth, Two-Stage, and H-Model values.
 */
import React, { useMemo } from 'react';
import { FinancialData, ValuationAssumptions } from '../../../types/financial';
import { calculateDDM } from '../../../utils/valuationEngine';
import { formatPrice, CurrencyCode } from '../../../utils/formatters';
import { Tooltip } from '../../Tooltip';

interface Props {
    financialData: FinancialData;
    assumptions: ValuationAssumptions;
    isDarkMode: boolean;
    cardClass: string;
    textClass: string;
    textMutedClass: string;
    currency: CurrencyCode;
}

export const DDMValuation: React.FC<Props> = ({
    financialData, assumptions, isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => {
    const ke = assumptions.riskFreeRate + assumptions.beta * assumptions.marketRiskPremium;

    const ddm = useMemo(
        () => calculateDDM(financialData, assumptions, ke),
        [financialData, assumptions, ke]
    );

    if (!ddm.applicable) {
        return (
            <div className={`p-6 rounded-xl border ${cardClass}`}>
                <h3 className={`text-lg font-semibold mb-2 ${textClass}`}>
                    <Tooltip term="DDM">DDM Valuation</Tooltip>
                </h3>
                <p className={`text-sm ${textMutedClass}`}>
                    {ddm.message || 'DDM not applicable — company does not pay dividends.'}
                </p>
            </div>
        );
    }

    const currentPrice = financialData.currentStockPrice || 1;
    // C1 Fix: Calculate DPS from actual dividends paid
    const dividendsPaid = Math.abs(financialData.cashFlowStatement.dividendsPaid || 0);
    const dps = dividendsPaid > 0
        ? dividendsPaid / financialData.sharesOutstanding
        : (financialData.dividendsPerShare || assumptions.dps || 0);

    const methods = [
        {
            name: 'Gordon Growth (Single-Stage)',
            formula: `D₁ / (Ke − g) = ${dps.toFixed(2)} × (1 + ${(assumptions.ddmStableGrowth / 100).toFixed(3)}) / (${(ke / 100).toFixed(4)} − ${(assumptions.ddmStableGrowth / 100).toFixed(3)})`,
            value: ddm.gordonGrowth,
        },
        {
            name: `Two-Stage DDM (${assumptions.ddmHighGrowth}% → ${assumptions.ddmStableGrowth}%)`,
            formula: `High growth ${assumptions.ddmHighGrowthYears}yr at ${assumptions.ddmHighGrowth}%, then stable at ${assumptions.ddmStableGrowth}%`,
            value: ddm.twoStage,
        },
        {
            name: 'H-Model',
            formula: `Linear fade from ${assumptions.ddmHighGrowth}% to ${assumptions.ddmStableGrowth}% over ${assumptions.ddmHighGrowthYears} years`,
            value: ddm.hModel,
        },
    ];

    return (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
            <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
                <Tooltip term="DDM">Dividend Discount Model (DDM)</Tooltip>
                <span className={`ml-2 text-sm font-normal ${textMutedClass}`}>
                    Ke = {ke.toFixed(2)}% | DPS = {formatPrice(dps, currency)}
                </span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {methods.map((m) => {
                    if (m.value === null) return null;
                    const upside = ((m.value - currentPrice) / currentPrice) * 100;
                    return (
                        <div
                            key={m.name}
                            className={`p-4 rounded-lg border ${'bg-[var(--bg-secondary)] border-[var(--border)]'}`}
                        >
                            <div className={`text-xs font-medium mb-1 ${textMutedClass}`}>{m.name}</div>
                            <div className={`text-2xl font-bold ${upside > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {formatPrice(m.value, currency)}
                            </div>
                            <div className={`text-xs mt-1 ${upside > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {upside > 0 ? '▲' : '▼'} {Math.abs(upside).toFixed(1)}% vs current
                            </div>
                        </div>
                    );
                })}
            </div>
            <div className={`text-xs ${textMutedClass}`}>
                {methods
                    .filter((m) => m.value !== null)
                    .map((m) => `${m.name}: ${m.formula}`)
                    .join(' | ')}
            </div>
        </div>
    );
};
