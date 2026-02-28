/**
 * C3: EV-to-Equity Bridge (Waterfall)
 * Shows the step-by-step bridge from Enterprise Value to per-share price.
 */
import React from 'react';
import { formatCurrencyShort, CurrencyCode } from '../../../utils/formatters';

interface Props {
    enterpriseValue: number;
    totalDebt: number;
    cash: number;
    equityValue: number;
    sharesOutstanding: number;
    perSharePrice: number;
    isDarkMode: boolean;
    cardClass: string;
    textClass: string;
    textMutedClass: string;
    currency: CurrencyCode;
}

export const EVBridgeChart: React.FC<Props> = ({
    enterpriseValue, totalDebt, cash, equityValue, sharesOutstanding, perSharePrice,
    isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => {
    const items: Array<{ label: string; value: number; type: 'positive' | 'negative' | 'total' }> = [
        { label: 'Enterprise Value', value: enterpriseValue, type: 'positive' },
        { label: 'Less: Total Debt', value: -totalDebt, type: 'negative' },
        { label: 'Plus: Cash', value: cash, type: 'positive' },
        { label: '= Equity Value', value: equityValue, type: 'total' },
    ];

    const maxVal = Math.max(...items.map(i => Math.abs(i.value)));

    return (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
            <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
                EV-to-Equity Bridge
            </h3>

            <div className="space-y-3">
                {items.map((item, i) => {
                    const barWidth = maxVal > 0 ? Math.abs(item.value) / maxVal * 100 : 0;
                    const barColor = item.type === 'total'
                        ? 'bg-gradient-to-r from-emerald-500 to-green-400'
                        : item.type === 'negative'
                            ? 'bg-gradient-to-r from-red-500 to-red-400'
                            : 'bg-gradient-to-r from-blue-500 to-blue-400';

                    return (
                        <div key={i}>
                            <div className="flex justify-between items-center mb-1">
                                <span className={`text-sm font-medium ${item.type === 'total' ? 'text-green-400 font-bold' : textMutedClass}`}>
                                    {item.label}
                                </span>
                                <span className={`text-sm font-bold ${item.type === 'total' ? 'text-green-400' : item.value < 0 ? 'text-red-400' : textClass
                                    }`}>
                                    {item.value < 0 ? '−' : '+'}{formatCurrencyShort(Math.abs(item.value), currency)}
                                </span>
                            </div>
                            <div className={`h-6 rounded-full ${isDarkMode ? 'bg-zinc-800' : 'bg-gray-100'} overflow-hidden`}>
                                <div
                                    className={`h-full rounded-full ${barColor} transition-all duration-500`}
                                    style={{ width: `${barWidth}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Per-share callout */}
            <div className={`mt-4 p-3 rounded-lg border-2 border-amber-500/40 ${isDarkMode ? 'bg-amber-500/5' : 'bg-amber-50'}`}>
                <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${textMutedClass}`}>
                        ÷ {(sharesOutstanding / 1e6).toFixed(0)}M shares
                    </span>
                    <span className="text-xl font-bold text-amber-400">
                        = {formatCurrencyShort(perSharePrice, currency)}/share
                    </span>
                </div>
            </div>
        </div>
    );
};
