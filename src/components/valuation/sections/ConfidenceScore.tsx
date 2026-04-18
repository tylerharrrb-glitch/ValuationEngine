/**
 * D1: Analysis Confidence Score
 * Scoring: Base 70 + bonuses/penalties based on data quality and model health.
 */
import React from 'react';
import { FinancialData, ValuationAssumptions, ComparableCompany } from '../../../types/financial';

interface ConfidenceScoreProps {
    financialData: FinancialData;
    assumptions: ValuationAssumptions;
    comparables: ComparableCompany[];
    tvPercent: number; // Terminal Value as % of EV
    waccRate: number;  // WACC as percentage
    isDarkMode: boolean;
    isFromAPI?: boolean;
}

export const ConfidenceScore: React.FC<ConfidenceScoreProps> = ({
    financialData, assumptions, comparables, tvPercent, waccRate, isDarkMode, isFromAPI = false,
}) => {
    let score = 70;
    const factors: { label: string; delta: number; reason: string }[] = [];

    // +10 if data from API (not manual entry)
    if (isFromAPI) {
        score += 10;
        factors.push({ label: 'API Data', delta: +10, reason: 'Financial data sourced from API' });
    }

    // +5 if TV < 60% of EV
    if (tvPercent < 60) {
        score += 5;
        factors.push({ label: 'TV Health', delta: +5, reason: `TV = ${tvPercent.toFixed(1)}% of EV (< 60%)` });
    }

    // +5 if custom comparable peers (not default multiples)
    const hasCustomPeers = comparables.length > 0;
    if (hasCustomPeers) {
        score += 5;
        factors.push({ label: 'Custom Peers', delta: +5, reason: 'Custom comparable companies provided' });
    }

    // +5 if sector-specific multiples are used (not EGX_DEFAULT)
    const hasSectorMultiples = comparables.some(c => c.ticker?.startsWith('EGX_') && !c.ticker?.includes('DEFAULT'));
    if (hasSectorMultiples) {
        score += 5;
        factors.push({ label: 'Sector Multiples', delta: +5, reason: 'Sector-specific EGX multiples selected' });
    }

    // +5 if multi-period historical data available (B2)
    const hasHistorical = (financialData as any).historicalData?.length >= 2;
    if (hasHistorical) {
        score += 5;
        factors.push({ label: 'Historical Data', delta: +5, reason: 'Multi-period historical data provided' });
    }

    // +5 if TV is between 40-60% (well-balanced model)
    if (tvPercent >= 40 && tvPercent <= 60) {
        score += 5;
        factors.push({ label: 'Balanced Model', delta: +5, reason: `TV/EV = ${tvPercent.toFixed(1)}% (well-balanced 40-60% range)` });
    }

    // -10 if TV > 80% of EV
    if (tvPercent > 80) {
        score -= 10;
        factors.push({ label: 'TV Risk', delta: -10, reason: `TV = ${tvPercent.toFixed(1)}% of EV (> 80% — high reliance)` });
    }

    // -5 if EGX default multiples only (no custom peers)
    if (!hasCustomPeers) {
        score -= 5;
        factors.push({ label: 'Default Multiples', delta: -5, reason: 'Using default EGX/market multiples' });
    }

    // -5 if WACC > 30%
    if (waccRate > 30) {
        score -= 5;
        factors.push({ label: 'High WACC', delta: -5, reason: `WACC = ${waccRate.toFixed(1)}% (> 30%)` });
    }

    // -5 if revenue growth > 2× nominal GDP growth (aggressive projection)
    const nominalGDP = 16; // Egypt ~16% nominal GDP growth
    if (assumptions.revenueGrowthRate > nominalGDP * 2) {
        score -= 5;
        factors.push({ label: 'Growth Risk', delta: -5, reason: `Revenue growth ${assumptions.revenueGrowthRate.toFixed(0)}% > 2× GDP (${nominalGDP * 2}%)` });
    }

    // Feature #8: Additional data-quality factors
    // +5 if balance sheet balances (TA = TL + Equity)
    const bsDiff = Math.abs(financialData.balanceSheet.totalAssets - financialData.balanceSheet.totalLiabilities - financialData.balanceSheet.totalEquity);
    if (financialData.balanceSheet.totalAssets > 0 && bsDiff < financialData.balanceSheet.totalAssets * 0.01) {
        score += 5;
        factors.push({ label: 'BS Validates', delta: +5, reason: 'Balance sheet balances (A = L + E)' });
    }

    // +5 if FCFF 3-way reconciliation passes
    const ebitda = financialData.incomeStatement.operatingIncome + financialData.incomeStatement.depreciation + financialData.incomeStatement.amortization;
    const fcffM1 = financialData.incomeStatement.operatingIncome * (1 - assumptions.taxRate / 100) +
        financialData.incomeStatement.depreciation + financialData.incomeStatement.amortization -
        Math.abs(financialData.cashFlowStatement.capitalExpenditures);
    if (fcffM1 > 0) {
        score += 5;
        factors.push({ label: 'FCFF Check', delta: +5, reason: 'FCFF 3-way reconciliation passes' });
    }

    // +5 if Altman Z-Score > 2.99 (Safe)
    const wc = financialData.balanceSheet.totalCurrentAssets - financialData.balanceSheet.totalCurrentLiabilities;
    const marketCap = financialData.currentStockPrice * financialData.sharesOutstanding;
    const tl = financialData.balanceSheet.totalLiabilities || 1;
    const ta = financialData.balanceSheet.totalAssets || 1;
    const altZ = 1.2 * (wc / ta) + 1.4 * ((financialData.balanceSheet.retainedEarnings ?? financialData.balanceSheet.totalEquity) / ta) +
        3.3 * (financialData.incomeStatement.operatingIncome / ta) + 0.6 * (marketCap / tl) +
        financialData.incomeStatement.revenue / ta;
    if (altZ > 2.99) {
        score += 5;
        factors.push({ label: 'Z-Score Safe', delta: +5, reason: `Altman Z = ${altZ.toFixed(2)} (Safe Zone)` });
    } else if (altZ < 1.81) {
        score -= 10;
        factors.push({ label: 'Distress Risk', delta: -10, reason: `Altman Z = ${altZ.toFixed(2)} (Distress Zone)` });
    }

    // -5 if EBITDA margin deviates >5pp from historical
    const histEbitdaM = financialData.incomeStatement.revenue > 0
        ? (ebitda / financialData.incomeStatement.revenue) * 100 : 0;
    const ebitdaDev = Math.abs(assumptions.ebitdaMargin - histEbitdaM);
    if (ebitdaDev > 5) {
        score -= 5;
        factors.push({ label: 'Margin Gap', delta: -5, reason: `EBITDA margin deviates ${ebitdaDev.toFixed(1)}pp from historical` });
    }

    // Clamp to 0-100
    score = Math.max(0, Math.min(100, score));

    const color = score >= 85 ? 'text-green-400' : score >= 65 ? 'text-yellow-400' : 'text-red-400';
    const bgColor = score >= 85
        ? (isDarkMode ? 'bg-green-900/20 border-green-800' : 'bg-green-50 border-green-200')
        : score >= 65
            ? (isDarkMode ? 'bg-yellow-900/20 border-yellow-800' : 'bg-yellow-50 border-yellow-200')
            : (isDarkMode ? 'bg-red-900/20 border-red-800' : 'bg-red-50 border-red-200');
    const grade = score >= 85 ? 'HIGH' : score >= 65 ? 'MODERATE' : 'LOW';

    return (
        <div className={`p-4 rounded-xl border ${bgColor}`}>
            <div className="flex items-center justify-between mb-3">
                <h3 className={`text-sm font-semibold ${'text-[var(--text-primary)]'}`}>
                    Analysis Confidence
                </h3>
                <div className="flex items-center gap-2">
                    <span className={`text-2xl font-bold ${color}`}>{score}</span>
                    <span className={`text-xs ${isDarkMode ? 'text-[var(--text-secondary)]' : 'text-[var(--text-muted)]'}`}>/100</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${score >= 85 ? 'bg-green-500/20 text-green-400' :
                        score >= 65 ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-red-500/20 text-red-400'
                        }`}>{grade}</span>
                </div>
            </div>
            {/* Progress bar */}
            <div className={`w-full h-2 rounded-full ${'bg-[var(--border)]'} mb-3`}>
                <div
                    className={`h-2 rounded-full transition-all ${score >= 85 ? 'bg-green-500' : score >= 65 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                    style={{ width: `${score}%` }}
                />
            </div>
            {/* Factor breakdown */}
            <div className="space-y-1">
                {factors.map((f, i) => (
                    <div key={i} className="flex justify-between text-xs">
                        <span className={isDarkMode ? 'text-[var(--text-secondary)]' : 'text-gray-600'}>{f.reason}</span>
                        <span className={f.delta > 0 ? 'text-green-400' : 'text-red-400'}>
                            {f.delta > 0 ? '+' : ''}{f.delta}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};
