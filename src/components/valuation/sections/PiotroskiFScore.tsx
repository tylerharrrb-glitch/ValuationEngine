/**
 * C1: Piotroski F-Score
 * 9-point scoring system for financial strength assessment.
 * Single-period mode: scores requiring prior-year data are marked as N/A.
 */
import React from 'react';
import { FinancialData } from '../../../types/financial';

interface Props {
    financialData: FinancialData;
    isDarkMode: boolean;
    cardClass: string;
    textClass: string;
    textMutedClass: string;
}

interface ScoreItem {
    id: string;
    label: string;
    category: 'Profitability' | 'Leverage' | 'Efficiency';
    score: number | null;
    description: string;
}

function calculatePiotroski(data: FinancialData): { items: ScoreItem[]; total: number; calculable: number } {
    const { incomeStatement: is, balanceSheet: bs, cashFlowStatement: cf } = data;
    const totalAssets = bs.totalAssets || 1;
    const items: ScoreItem[] = [];

    // PROFITABILITY (4 points)
    items.push({
        id: 'P1', label: 'ROA > 0', category: 'Profitability',
        score: is.netIncome > 0 ? 1 : 0,
        description: `Net Income: ${is.netIncome > 0 ? 'Positive' : 'Negative'}`,
    });
    items.push({
        id: 'P2', label: 'OCF > 0', category: 'Profitability',
        score: cf.operatingCashFlow > 0 ? 1 : 0,
        description: `Operating Cash Flow: ${cf.operatingCashFlow > 0 ? 'Positive' : 'Negative'}`,
    });
    items.push({
        id: 'P3', label: 'ROA Improving', category: 'Profitability',
        score: null,
        description: 'Requires prior-year data',
    });
    items.push({
        id: 'P4', label: 'Accruals Quality', category: 'Profitability',
        score: cf.operatingCashFlow > is.netIncome ? 1 : 0,
        description: `OCF (${(cf.operatingCashFlow / 1e6).toFixed(0)}M) ${cf.operatingCashFlow > is.netIncome ? '>' : '≤'} NI (${(is.netIncome / 1e6).toFixed(0)}M)`,
    });

    // LEVERAGE / LIQUIDITY (3 points)
    items.push({
        id: 'L5', label: 'Debt Ratio Decreasing', category: 'Leverage',
        score: null,
        description: 'Requires prior-year data',
    });
    items.push({
        id: 'L6', label: 'Current Ratio Improving', category: 'Leverage',
        score: null,
        description: 'Requires prior-year data',
    });
    items.push({
        id: 'L7', label: 'No Share Dilution', category: 'Leverage',
        score: 1, // Conservative: assume no dilution in single period
        description: 'Assumed — no dilution data available',
    });

    // OPERATING EFFICIENCY (2 points)
    items.push({
        id: 'E8', label: 'Gross Margin Improving', category: 'Efficiency',
        score: null,
        description: 'Requires prior-year data',
    });
    items.push({
        id: 'E9', label: 'Asset Turnover Improving', category: 'Efficiency',
        score: null,
        description: 'Requires prior-year data',
    });

    const calculable = items.filter(i => i.score !== null);
    const total = calculable.reduce((sum, i) => sum + (i.score || 0), 0);
    return { items, total, calculable: calculable.length };
}

export const PiotroskiFScore: React.FC<Props> = ({
    financialData, isDarkMode, cardClass, textClass, textMutedClass,
}) => {
    const { items, total, calculable } = calculatePiotroski(financialData);
    const rating = total >= 7 ? 'STRONG' : total >= 4 ? 'MODERATE' : 'WEAK';
    const ratingColor = total >= 7 ? 'text-green-400' : total >= 4 ? 'text-yellow-400' : 'text-red-400';

    const categories: Array<{ name: string; items: ScoreItem[] }> = [
        { name: 'Profitability', items: items.filter(i => i.category === 'Profitability') },
        { name: 'Leverage', items: items.filter(i => i.category === 'Leverage') },
        { name: 'Efficiency', items: items.filter(i => i.category === 'Efficiency') },
    ];

    return (
        <div className={`p-6 rounded-xl border ${cardClass}`}>
            <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>
                Piotroski F-Score
            </h3>

            {/* Score summary */}
            <div className="flex items-center gap-4 mb-4">
                <div className={`text-4xl font-bold ${ratingColor}`}>{total}/9</div>
                <div>
                    <div className={`text-sm font-semibold ${ratingColor}`}>{rating}</div>
                    <div className={`text-xs ${textMutedClass}`}>
                        {calculable}/{items.length} criteria calculable from single-period data
                    </div>
                </div>
            </div>

            {/* Category breakdown */}
            <div className="space-y-3">
                {categories.map(cat => {
                    const catTotal = cat.items.filter(i => i.score !== null).reduce((s, i) => s + (i.score || 0), 0);
                    const catCalc = cat.items.filter(i => i.score !== null).length;
                    return (
                        <div key={cat.name}>
                            <div className={`text-xs font-semibold uppercase tracking-wide mb-1 ${textMutedClass}`}>
                                {cat.name}
                                <span className="ml-2">{cat.items.map(i => i.score === 1 ? '●' : i.score === 0 ? '○' : '◌').join('')}</span>
                                <span className="ml-1">{catTotal}/{cat.items.length}</span>
                                {catCalc < cat.items.length && <span className="ml-1">({catCalc} available)</span>}
                            </div>
                            <div className="space-y-1">
                                {cat.items.map(item => (
                                    <div key={item.id} className="flex items-center gap-2 text-xs">
                                        <span className={item.score === 1 ? 'text-green-400' : item.score === 0 ? 'text-red-400' : 'text-[var(--text-muted)]'}>
                                            {item.score === 1 ? '✓' : item.score === 0 ? '✗' : '—'}
                                        </span>
                                        <span className={textMutedClass}>{item.id}: {item.label}</span>
                                        <span className={`ml-auto text-xs ${isDarkMode ? 'text-gray-600' : 'text-[var(--text-secondary)]'}`}>{item.description}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className={`mt-3 text-xs ${textMutedClass}`}>
                Note: 5 criteria require prior-year data. Add Year 2 data for full 9-point score.
            </div>
        </div>
    );
};
