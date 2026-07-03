/**
 * C3: EV-to-Equity Bridge (Waterfall)
 * Shows the step-by-step bridge from Enterprise Value to per-share price,
 * including non-operating financial assets (marketable securities, long-term
 * investments) that are added back because their finance income is excluded
 * from unlevered FCFF.
 */
import React from 'react';
import { formatCurrencyShort, CurrencyCode } from '../../../utils/formatters';

interface Props {
    enterpriseValue: number;
    cash: number;
    marketableSecurities?: number;
    longTermInvestments?: number;
    otherNonOpAssets?: number;
    totalDebt: number;
    minorityInterest?: number;
    preferredEquity?: number;
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
    enterpriseValue, cash, marketableSecurities = 0, longTermInvestments = 0,
    otherNonOpAssets = 0, totalDebt, minorityInterest = 0, preferredEquity = 0,
    equityValue, sharesOutstanding, perSharePrice,
    isDarkMode, cardClass, textClass, textMutedClass, currency,
}) => {
    // Build the bridge dynamically — only show lines that carry a value.
    const items: Array<{ label: string; value: number; type: 'positive' | 'negative' | 'total' }> = [
        { label: 'Enterprise Value', value: enterpriseValue, type: 'positive' },
        { label: 'Plus: Cash & Equivalents', value: cash, type: 'positive' },
    ];
    if (marketableSecurities > 0) items.push({ label: 'Plus: Marketable Securities', value: marketableSecurities, type: 'positive' });
    if (longTermInvestments > 0) items.push({ label: 'Plus: Long-term Investments', value: longTermInvestments, type: 'positive' });
    if (otherNonOpAssets > 0) items.push({ label: 'Plus: Other Non-Op Assets', value: otherNonOpAssets, type: 'positive' });
    items.push({ label: 'Less: Total Debt', value: -totalDebt, type: 'negative' });
    if (minorityInterest > 0) items.push({ label: 'Less: Minority Interest', value: -minorityInterest, type: 'negative' });
    if (preferredEquity > 0) items.push({ label: 'Less: Preferred Equity', value: -preferredEquity, type: 'negative' });
    items.push({ label: '= Equity Value', value: equityValue, type: 'total' });

    const maxVal = Math.max(...items.map(i => Math.abs(i.value)));

    // Non-operating financial assets (excl. cash) — the amount the bridge fix adds back.
    const nonOpFinancialAssets = marketableSecurities + longTermInvestments + otherNonOpAssets;
    const showNonOpNote = enterpriseValue > 0 && nonOpFinancialAssets > 0.10 * enterpriseValue;
    const nonOpPerShare = sharesOutstanding > 0 ? nonOpFinancialAssets / sharesOutstanding : 0;

    return (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
            <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
                EV → Equity Bridge
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
                            <div className={`h-6 rounded-full ${'bg-[var(--bg-secondary)]'} overflow-hidden`}>
                                <div
                                    className={`h-full rounded-full ${barColor} transition-all duration-500`}
                                    style={{ width: `${barWidth}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Non-operating asset callout — appears when material (>10% of EV) */}
            {showNonOpNote && (
                <div className={`mt-4 p-3 rounded-lg border ${isDarkMode ? 'bg-blue-500/5 border-blue-500/30' : 'bg-blue-50 border-blue-200'}`}>
                    <p className={`text-xs leading-relaxed ${textMutedClass}`}>
                        Non-operating financial assets of{' '}
                        <span className="font-semibold text-[var(--accent-gold)]">{formatCurrencyShort(nonOpFinancialAssets, currency)}</span>
                        {' '}(~{formatCurrencyShort(nonOpPerShare, currency)}/share) added to equity value — common for Egyptian
                        firms holding T-bill/bond portfolios whose finance income is excluded from unlevered FCFF.
                    </p>
                </div>
            )}

            {/* Per-share callout */}
            <div className={`mt-4 p-3 rounded-lg border-2 border-amber-500/40 ${isDarkMode ? 'bg-amber-500/5' : 'bg-amber-50'}`}>
                <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${textMutedClass}`}>
                        ÷ {(sharesOutstanding / 1e6).toFixed(0)}M shares
                    </span>
                    <span className="text-xl font-bold text-[var(--accent-gold)]">
                        = {formatCurrencyShort(perSharePrice, currency)}/share
                    </span>
                </div>
            </div>
        </div>
    );
};
