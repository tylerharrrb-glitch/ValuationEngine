/**
 * B2: Historical Data Input Panel
 * Allows 2-5 years of historical IS/BS data for CAGR, trends, and full Piotroski.
 */
import React, { useState } from 'react';
import { FinancialData, HistoricalYear } from '../../types/financial';
import { formatNumber, formatPercent } from '../../utils/formatters';

interface HistoricalDataPanelProps {
    financialData: FinancialData;
    updateFinancialData: (updater: (prev: FinancialData) => FinancialData) => void;
    isDarkMode: boolean;
    textMutedClass: string;
    inputClass: string;
}

const EMPTY_YEAR = (year: number): HistoricalYear => ({
    year,
    revenue: 0,
    netIncome: 0,
    totalAssets: 0,
    totalEquity: 0,
    operatingCashFlow: 0,
    capex: 0,
    grossMargin: 0,
    longTermDebt: 0,
    currentRatio: 0,
    sharesOutstanding: 0,
});

const fields: { key: keyof HistoricalYear; label: string; isCurrency?: boolean; isPercent?: boolean; isRatio?: boolean }[] = [
    { key: 'revenue', label: 'Revenue', isCurrency: true },
    { key: 'netIncome', label: 'Net Income', isCurrency: true },
    { key: 'totalAssets', label: 'Total Assets', isCurrency: true },
    { key: 'totalEquity', label: 'Total Equity', isCurrency: true },
    { key: 'operatingCashFlow', label: 'Operating CF', isCurrency: true },
    { key: 'capex', label: 'CapEx', isCurrency: true },
    { key: 'grossMargin', label: 'Gross Margin %', isPercent: true },
    { key: 'longTermDebt', label: 'Long-Term Debt', isCurrency: true },
    { key: 'currentRatio', label: 'Current Ratio', isRatio: true },
    { key: 'sharesOutstanding', label: 'Shares Out', isCurrency: true },
];

export const HistoricalDataPanel: React.FC<HistoricalDataPanelProps> = ({
    financialData, updateFinancialData, isDarkMode, textMutedClass, inputClass,
}) => {
    const [numYears, setNumYears] = useState(financialData.historicalData?.length || 2);
    const currentYear = new Date().getFullYear();

    const historical = financialData.historicalData || [];

    const ensureYears = (count: number) => {
        const years: HistoricalYear[] = [];
        for (let i = 0; i < count; i++) {
            const yr = currentYear - i - 1;
            years.push(historical.find(h => h.year === yr) || EMPTY_YEAR(yr));
        }
        return years;
    };

    const handleYearCountChange = (count: number) => {
        setNumYears(count);
        const years = ensureYears(count);
        updateFinancialData(prev => ({ ...prev, historicalData: years }));
    };

    const updateYear = (yearIdx: number, key: keyof HistoricalYear, value: number) => {
        const years = ensureYears(numYears);
        years[yearIdx] = { ...years[yearIdx], [key]: value };
        updateFinancialData(prev => ({ ...prev, historicalData: years }));
    };

    const activeYears = ensureYears(numYears);

    // CAGR calculation
    const cagr = (first: number, last: number, years: number): number | null => {
        if (first <= 0 || last <= 0 || years <= 0) return null;
        return (Math.pow(last / first, 1 / years) - 1) * 100;
    };

    const revCAGR = activeYears.length >= 2
        ? cagr(activeYears[activeYears.length - 1].revenue, activeYears[0].revenue, activeYears.length - 1)
        : null;
    const niCAGR = activeYears.length >= 2
        ? cagr(Math.abs(activeYears[activeYears.length - 1].netIncome), Math.abs(activeYears[0].netIncome), activeYears.length - 1)
        : null;

    const hasData = activeYears.some(y => y.revenue > 0);

    const cardBg = isDarkMode ? 'bg-zinc-800/50 border-zinc-700' : 'bg-white border-gray-200';

    return (
        <div className={`p-4 rounded-xl border ${cardBg}`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                    Historical Data (Multi-Period)
                </h3>
                <div className="flex items-center gap-2">
                    <span className={`text-xs ${textMutedClass}`}>Years:</span>
                    {[2, 3, 5].map(n => (
                        <button
                            key={n}
                            onClick={() => handleYearCountChange(n)}
                            className={`px-2 py-1 text-xs rounded font-mono transition-all ${numYears === n
                                ? 'bg-red-600 text-white'
                                : isDarkMode ? 'bg-zinc-700 text-gray-400 hover:bg-zinc-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                        >
                            {n}Y
                        </button>
                    ))}
                </div>
            </div>

            {/* Data grid */}
            <div className="overflow-x-auto">
                <table className="w-full text-xs">
                    <thead>
                        <tr>
                            <th className={`text-left px-2 py-1 ${textMutedClass}`}>Metric</th>
                            {activeYears.map(y => (
                                <th key={y.year} className={`text-right px-2 py-1 ${textMutedClass}`}>{y.year}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {fields.map(f => (
                            <tr key={f.key} className={isDarkMode ? 'border-zinc-800' : 'border-gray-100'}>
                                <td className={`px-2 py-1 font-medium ${textMutedClass}`}>{f.label}</td>
                                {activeYears.map((y, yi) => (
                                    <td key={y.year} className="px-1 py-1">
                                        <input
                                            type="number"
                                            value={y[f.key] || ''}
                                            onChange={e => updateYear(yi, f.key, parseFloat(e.target.value) || 0)}
                                            className={`w-full px-2 py-1 rounded text-right text-xs ${inputClass}`}
                                            placeholder="0"
                                        />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* CAGR Summary */}
            {hasData && (
                <div className={`mt-3 p-3 rounded-lg ${isDarkMode ? 'bg-zinc-900' : 'bg-gray-50'}`}>
                    <h4 className={`text-xs font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Trend Analysis</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                            <span className={textMutedClass}>Revenue CAGR:</span>
                            <span className={revCAGR !== null && revCAGR > 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                                {revCAGR !== null ? formatPercent(revCAGR) : 'N/A'}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className={textMutedClass}>NI CAGR:</span>
                            <span className={niCAGR !== null && niCAGR > 0 ? 'text-green-400 font-medium' : 'text-red-400 font-medium'}>
                                {niCAGR !== null ? formatPercent(niCAGR) : 'N/A'}
                            </span>
                        </div>
                        {/* Margin trend */}
                        {activeYears.length >= 2 && activeYears[0].grossMargin > 0 && (
                            <div className="flex justify-between col-span-2">
                                <span className={textMutedClass}>Margin Trend:</span>
                                <span className={
                                    activeYears[0].grossMargin > activeYears[activeYears.length - 1].grossMargin
                                        ? 'text-green-400 font-medium' : 'text-yellow-400 font-medium'
                                }>
                                    {activeYears[activeYears.length - 1].grossMargin.toFixed(1)}% → {activeYears[0].grossMargin.toFixed(1)}%
                                    {activeYears[0].grossMargin > activeYears[activeYears.length - 1].grossMargin ? ' ↑' : ' ↓'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* IMP4: Full Piotroski F-Score */}
                    {activeYears.length >= 2 && activeYears[0].revenue > 0 && activeYears[1].revenue > 0 && (() => {
                        const curr = activeYears[0]; // most recent
                        const prev = activeYears[1]; // prior year
                        const currROA = curr.totalAssets > 0 ? curr.netIncome / curr.totalAssets : 0;
                        const prevROA = prev.totalAssets > 0 ? prev.netIncome / prev.totalAssets : 0;
                        const currLeverage = curr.totalAssets > 0 ? curr.longTermDebt / curr.totalAssets : 0;
                        const prevLeverage = prev.totalAssets > 0 ? prev.longTermDebt / prev.totalAssets : 0;
                        const currAT = curr.totalAssets > 0 ? curr.revenue / curr.totalAssets : 0;
                        const prevAT = prev.totalAssets > 0 ? prev.revenue / prev.totalAssets : 0;

                        const criteria = [
                            { label: 'P1: Net Income > 0', pass: curr.netIncome > 0 },
                            { label: 'P2: OCF > 0', pass: curr.operatingCashFlow > 0 },
                            { label: 'P3: ROA Improving', pass: currROA > prevROA },
                            { label: 'P4: OCF > NI', pass: curr.operatingCashFlow > curr.netIncome },
                            { label: 'L5: Leverage ↓', pass: currLeverage < prevLeverage || (currLeverage === 0 && prevLeverage === 0) },
                            { label: 'L6: Liquidity ↑', pass: curr.currentRatio > prev.currentRatio || (curr.currentRatio === 0 && prev.currentRatio === 0) },
                            { label: 'L7: No Dilution', pass: curr.sharesOutstanding <= prev.sharesOutstanding || prev.sharesOutstanding === 0 },
                            { label: 'E8: Gross Margin ↑', pass: curr.grossMargin > prev.grossMargin },
                            { label: 'E9: Asset Turnover ↑', pass: currAT > prevAT },
                        ];
                        const score = criteria.filter(c => c.pass).length;
                        const color = score >= 7 ? 'text-green-400' : score >= 4 ? 'text-yellow-400' : 'text-red-400';
                        const grade = score >= 7 ? 'STRONG' : score >= 4 ? 'MODERATE' : 'WEAK';

                        return (
                            <div className="mt-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className={`text-xs font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                                        Piotroski F-Score (Full 9/9)
                                    </span>
                                    <span className={`text-sm font-bold ${color}`}>{score}/9 — {grade}</span>
                                </div>
                                <div className="grid grid-cols-3 gap-1 text-xs">
                                    {criteria.map(c => (
                                        <div key={c.label} className={`flex items-center gap-1 ${c.pass ? 'text-green-400' : 'text-red-400'}`}>
                                            <span>{c.pass ? '✓' : '✗'}</span>
                                            <span className="truncate">{c.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}
        </div>
    );
};
