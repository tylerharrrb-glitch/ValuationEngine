/**
 * WOLF Valuation Engine — Confidence Score Module
 * Section 7.1: Model Confidence Score (0–100)
 *
 * Three pillars:
 * 1. Data Quality (30 pts): D&A>0, CapEx>0, interest consistency, EBITDA>0, fields filled
 * 2. Assumption Reasonableness (40 pts): Rev growth ≤25%, margin ≤50%, g<GDP, WACC range, FCFF reconciles
 * 3. Model Robustness (30 pts): TV<80% EV, value within ±50%, DCF/DDM agree, IC>1.5x
 */

import { FinancialData, ValuationAssumptions, DCFResult, DDMResult, FCFFVerification } from '../types/financial';

export interface ConfidenceBreakdown {
    category: string;
    label: string;
    score: number;
    maxScore: number;
    detail: string;
}

export interface ConfidenceScoreResult {
    totalScore: number;
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    dataQuality: number;
    assumptionReasonableness: number;
    modelRobustness: number;
    breakdown: ConfidenceBreakdown[];
    narrative: string;
}

export function calculateConfidenceScore(
    financialData: FinancialData,
    assumptions: ValuationAssumptions,
    dcfResult: DCFResult,
    ddmResult: DDMResult | null,
    fcffVerification: FCFFVerification,
): ConfidenceScoreResult {
    const breakdown: ConfidenceBreakdown[] = [];
    const is = financialData.incomeStatement;
    const bs = financialData.balanceSheet;
    const cf = financialData.cashFlowStatement;

    // ============================================
    // PILLAR 1: DATA QUALITY (30 pts)
    // ============================================
    let dataQuality = 0;

    // 1a. D&A > 0 (5 pts)
    const dna = is.depreciation + is.amortization;
    const dnaPts = dna > 0 ? 5 : 0;
    dataQuality += dnaPts;
    breakdown.push({ category: 'Data Quality', label: 'D&A > 0', score: dnaPts, maxScore: 5, detail: dna > 0 ? 'Present' : 'Missing — projections may understate reinvestment' });

    // 1b. CapEx > 0 (5 pts)
    const capexPts = cf.capitalExpenditures > 0 ? 5 : 0;
    dataQuality += capexPts;
    breakdown.push({ category: 'Data Quality', label: 'CapEx > 0', score: capexPts, maxScore: 5, detail: cf.capitalExpenditures > 0 ? 'Present' : 'Zero — FCFF may be overstated' });

    // 1c. Interest expense consistency (5 pts)
    const totalDebt = bs.shortTermDebt + bs.longTermDebt;
    const impliedRate = totalDebt > 0 ? (is.interestExpense / totalDebt) * 100 : 0;
    const interestOk = totalDebt === 0 || (impliedRate > 0 && impliedRate < 30);
    const interestPts = interestOk ? 5 : 2;
    dataQuality += interestPts;
    breakdown.push({ category: 'Data Quality', label: 'Interest consistency', score: interestPts, maxScore: 5, detail: interestOk ? `Implied rate: ${impliedRate.toFixed(1)}%` : 'Interest/Debt ratio looks unusual' });

    // 1d. EBITDA > 0 (5 pts)
    const ebitda = is.operatingIncome + dna;
    const ebitdaPts = ebitda > 0 ? 5 : 0;
    dataQuality += ebitdaPts;
    breakdown.push({ category: 'Data Quality', label: 'EBITDA > 0', score: ebitdaPts, maxScore: 5, detail: ebitda > 0 ? 'Positive' : 'Negative — company may be distressed' });

    // 1e. Revenue > 0 (5 pts)
    const revPts = is.revenue > 0 ? 5 : 0;
    dataQuality += revPts;
    breakdown.push({ category: 'Data Quality', label: 'Revenue > 0', score: revPts, maxScore: 5, detail: is.revenue > 0 ? 'Present' : 'Zero or missing' });

    // 1f. Shares outstanding > 0 (5 pts)
    const sharesPts = financialData.sharesOutstanding > 0 ? 5 : 0;
    dataQuality += sharesPts;
    breakdown.push({ category: 'Data Quality', label: 'Shares > 0', score: sharesPts, maxScore: 5, detail: financialData.sharesOutstanding > 0 ? `${(financialData.sharesOutstanding / 1e6).toFixed(1)}M` : 'Missing' });

    // ============================================
    // PILLAR 2: ASSUMPTION REASONABLENESS (40 pts)
    // ============================================
    let assumptionReasonableness = 0;

    // 2a. Revenue growth ≤ 25% (8 pts)
    const revGrowthOk = assumptions.revenueGrowthRate <= 25;
    const revGrowthPts = revGrowthOk ? 8 : Math.max(0, 8 - Math.floor((assumptions.revenueGrowthRate - 25) / 5));
    assumptionReasonableness += revGrowthPts;
    breakdown.push({ category: 'Assumptions', label: 'Revenue growth ≤ 25%', score: revGrowthPts, maxScore: 8, detail: `${assumptions.revenueGrowthRate.toFixed(1)}%` });

    // 2b. EBITDA margin ≤ 50% (8 pts)
    const marginOk = assumptions.ebitdaMargin <= 50;
    const marginPts = marginOk ? 8 : Math.max(0, 8 - Math.floor((assumptions.ebitdaMargin - 50) / 5));
    assumptionReasonableness += marginPts;
    breakdown.push({ category: 'Assumptions', label: 'EBITDA margin ≤ 50%', score: marginPts, maxScore: 8, detail: `${assumptions.ebitdaMargin.toFixed(1)}%` });

    // 2c. Terminal growth < GDP proxy (8 pts) — Egypt GDP growth ~4-5%
    const maxG = 6; // generous cap for Egyptian market
    const gOk = assumptions.terminalGrowthRate <= maxG;
    const gPts = gOk ? 8 : Math.max(0, 8 - Math.floor((assumptions.terminalGrowthRate - maxG)));
    assumptionReasonableness += gPts;
    breakdown.push({ category: 'Assumptions', label: 'Terminal g < GDP', score: gPts, maxScore: 8, detail: `g=${assumptions.terminalGrowthRate.toFixed(1)}% vs GDP~${maxG}%` });

    // 2d. WACC in reasonable range for Egypt: 15-35% (8 pts)
    const waccOk = assumptions.discountRate >= 15 && assumptions.discountRate <= 35;
    const waccPts = waccOk ? 8 : 4;
    assumptionReasonableness += waccPts;
    breakdown.push({ category: 'Assumptions', label: 'WACC 15-35% (Egypt)', score: waccPts, maxScore: 8, detail: `${assumptions.discountRate.toFixed(1)}%` });

    // 2e. FCFF 3-way reconciles (8 pts)
    const fcffPts = fcffVerification.allMatch ? 8 : 3;
    assumptionReasonableness += fcffPts;
    breakdown.push({ category: 'Assumptions', label: 'FCFF reconciliation', score: fcffPts, maxScore: 8, detail: fcffVerification.allMatch ? '✓ All 3 methods match' : '⚠ Methods diverge' });

    // ============================================
    // PILLAR 3: MODEL ROBUSTNESS (30 pts)
    // ============================================
    let modelRobustness = 0;

    // 3a. TV < 80% of EV (10 pts)
    const tvPct = dcfResult.terminalValuePercent;
    const tvOk = tvPct < 80;
    const tvPts = tvOk ? 10 : Math.max(0, 10 - Math.floor((tvPct - 80) / 2));
    modelRobustness += tvPts;
    breakdown.push({ category: 'Robustness', label: 'TV < 80% of EV', score: tvPts, maxScore: 10, detail: `TV = ${tvPct.toFixed(1)}% of EV` });

    // 3b. Value within ±50% of market price (10 pts)
    const priceDeviation = Math.abs(dcfResult.upside);
    const withinRange = priceDeviation <= 50;
    const rangePts = withinRange ? 10 : Math.max(0, 10 - Math.floor((priceDeviation - 50) / 10));
    modelRobustness += rangePts;
    breakdown.push({ category: 'Robustness', label: 'Value within ±50% of market', score: rangePts, maxScore: 10, detail: `${dcfResult.upside >= 0 ? '+' : ''}${dcfResult.upside.toFixed(1)}% vs market` });

    // 3c. DCF/DDM directional agreement (5 pts)
    let directionPts = 3; // default if DDM not available
    if (ddmResult && ddmResult.gordonGrowth !== null) {
        const dcfAbove = dcfResult.impliedSharePrice > financialData.currentStockPrice;
        const ddmAbove = ddmResult.gordonGrowth > financialData.currentStockPrice;
        directionPts = dcfAbove === ddmAbove ? 5 : 1;
    }
    modelRobustness += directionPts;
    breakdown.push({ category: 'Robustness', label: 'DCF/DDM agreement', score: directionPts, maxScore: 5, detail: ddmResult?.gordonGrowth ? 'Both models available' : 'DDM N/A (no dividends)' });

    // 3d. Interest coverage > 1.5x (5 pts)
    const ic = is.interestExpense > 0 ? is.operatingIncome / is.interestExpense : 999;
    const icOk = ic > 1.5;
    const icPts = icOk ? 5 : 2;
    modelRobustness += icPts;
    breakdown.push({ category: 'Robustness', label: 'Interest coverage > 1.5x', score: icPts, maxScore: 5, detail: `${ic.toFixed(1)}x` });

    // ============================================
    // TOTAL & GRADE
    // ============================================
    const totalScore = dataQuality + assumptionReasonableness + modelRobustness;

    let grade: ConfidenceScoreResult['grade'];
    if (totalScore >= 85) grade = 'A';
    else if (totalScore >= 70) grade = 'B';
    else if (totalScore >= 55) grade = 'C';
    else if (totalScore >= 40) grade = 'D';
    else grade = 'F';

    // Narrative
    const narrativeParts: string[] = [];
    if (dataQuality < 20) narrativeParts.push('Data quality concerns — some financial fields may be incomplete');
    if (assumptionReasonableness < 25) narrativeParts.push('Assumptions may be aggressive for Egyptian market conditions');
    if (tvPct > 80) narrativeParts.push(`Terminal value dominates at ${tvPct.toFixed(0)}% — consider shorter projection period`);
    if (priceDeviation > 50) narrativeParts.push('Large deviation from market price — review key assumptions');
    if (narrativeParts.length === 0) narrativeParts.push('Model inputs and outputs are within reasonable ranges');

    const narrative = narrativeParts.join('. ') + '.';

    return {
        totalScore,
        grade,
        dataQuality,
        assumptionReasonableness,
        modelRobustness,
        breakdown,
        narrative,
    };
}
