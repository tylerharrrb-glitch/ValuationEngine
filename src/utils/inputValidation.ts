/**
 * WOLF Valuation Engine — Input Validation Module
 * Section 8: Validation Rules & Edge Cases
 *
 * Hard Blocks: Prevent calculation if violated (user MUST fix)
 * Soft Warnings: Allow calculation but warn user
 * Edge Cases: Automatic adjustments with explanations
 */

import { FinancialData, ValuationAssumptions, DCFResult } from '../types/financial';

// ============================================
// TYPES
// ============================================

export type ValidationSeverity = 'HARD_BLOCK' | 'WARNING' | 'EDGE_CASE';

export interface ValidationRule {
    id: string;
    severity: ValidationSeverity;
    field: string;
    message: string;
    triggered: boolean;
    currentValue?: string;
    limit?: string;
}

export interface ValidationResult {
    isValid: boolean;           // No hard blocks
    hardBlocks: ValidationRule[];
    warnings: ValidationRule[];
    edgeCases: ValidationRule[];
    allRules: ValidationRule[];
}

// ============================================
// SECTION 8.1 — HARD BLOCKS
// These MUST be satisfied or calculation is meaningless
// ============================================

function checkHardBlocks(
    financialData: FinancialData,
    assumptions: ValuationAssumptions,
): ValidationRule[] {
    const rules: ValidationRule[] = [];

    // HB-1: Revenue ≥ 0
    rules.push({
        id: 'HB-1',
        severity: 'HARD_BLOCK',
        field: 'Revenue',
        message: 'Revenue must be ≥ 0',
        triggered: financialData.incomeStatement.revenue < 0,
        currentValue: `${financialData.incomeStatement.revenue.toLocaleString()}`,
        limit: '≥ 0',
    });

    // HB-2: Tax Rate 0–60%
    rules.push({
        id: 'HB-2',
        severity: 'HARD_BLOCK',
        field: 'Tax Rate',
        message: 'Tax rate must be between 0% and 60%',
        triggered: assumptions.taxRate < 0 || assumptions.taxRate > 60,
        currentValue: `${assumptions.taxRate.toFixed(1)}%`,
        limit: '0–60%',
    });

    // HB-3: Risk-Free Rate 0–40%
    rules.push({
        id: 'HB-3',
        severity: 'HARD_BLOCK',
        field: 'Risk-Free Rate',
        message: 'Rf must be between 0% and 40%',
        triggered: assumptions.riskFreeRate < 0 || assumptions.riskFreeRate > 40,
        currentValue: `${assumptions.riskFreeRate.toFixed(1)}%`,
        limit: '0–40%',
    });

    // HB-4: Equity Risk Premium 0–20%
    rules.push({
        id: 'HB-4',
        severity: 'HARD_BLOCK',
        field: 'ERP',
        message: 'Equity Risk Premium must be between 0% and 20%',
        triggered: assumptions.marketRiskPremium < 0 || assumptions.marketRiskPremium > 20,
        currentValue: `${assumptions.marketRiskPremium.toFixed(1)}%`,
        limit: '0–20%',
    });

    // HB-5: Cost of Debt 0–50%
    rules.push({
        id: 'HB-5',
        severity: 'HARD_BLOCK',
        field: 'Cost of Debt',
        message: 'Cost of Debt must be between 0% and 50%',
        triggered: assumptions.costOfDebt < 0 || assumptions.costOfDebt > 50,
        currentValue: `${assumptions.costOfDebt.toFixed(1)}%`,
        limit: '0–50%',
    });

    // HB-6: Terminal Growth < WACC
    rules.push({
        id: 'HB-6',
        severity: 'HARD_BLOCK',
        field: 'Terminal Growth',
        message: 'Terminal growth must be less than WACC (g < WACC)',
        triggered: assumptions.terminalGrowthRate >= assumptions.discountRate,
        currentValue: `g=${assumptions.terminalGrowthRate.toFixed(1)}%`,
        limit: `< WACC (${assumptions.discountRate.toFixed(1)}%)`,
    });

    // HB-7: Shares Outstanding > 0
    rules.push({
        id: 'HB-7',
        severity: 'HARD_BLOCK',
        field: 'Shares Outstanding',
        message: 'Shares outstanding must be > 0',
        triggered: financialData.sharesOutstanding <= 0,
        currentValue: `${financialData.sharesOutstanding.toLocaleString()}`,
        limit: '> 0',
    });

    // HB-8: Projection Years ∈ {3, 5, 7, 10}
    const validYears = [3, 5, 7, 10];
    rules.push({
        id: 'HB-8',
        severity: 'HARD_BLOCK',
        field: 'Projection Years',
        message: 'Projection years must be 3, 5, 7, or 10',
        triggered: !validYears.includes(assumptions.projectionYears),
        currentValue: `${assumptions.projectionYears}`,
        limit: '{3, 5, 7, 10}',
    });

    return rules;
}

// ============================================
// SECTION 8.1 — SOFT WARNINGS
// Calculations proceed but user should review
// ============================================

function checkWarnings(
    financialData: FinancialData,
    assumptions: ValuationAssumptions,
    dcfResult?: DCFResult,
): ValidationRule[] {
    const rules: ValidationRule[] = [];
    const is = financialData.incomeStatement;
    const bs = financialData.balanceSheet;

    // W-1: Negative EBITDA
    const ebitda = is.operatingIncome + is.depreciation + is.amortization;
    rules.push({
        id: 'W-1',
        severity: 'WARNING',
        field: 'EBITDA',
        message: 'Negative EBITDA — company may be in financial distress',
        triggered: ebitda < 0,
        currentValue: `${ebitda.toLocaleString()}`,
    });

    // W-2: Beta < 0 or > 2.5
    rules.push({
        id: 'W-2',
        severity: 'WARNING',
        field: 'Beta',
        message: 'Beta outside typical range (0–2.5)',
        triggered: assumptions.beta < 0 || assumptions.beta > 2.5,
        currentValue: `${assumptions.beta.toFixed(2)}`,
        limit: '0.0–2.5',
    });

    // W-3: Terminal growth > 10%
    rules.push({
        id: 'W-3',
        severity: 'WARNING',
        field: 'Terminal Growth',
        message: 'Terminal growth > 10% is aggressive — typically < GDP growth',
        triggered: assumptions.terminalGrowthRate > 10,
        currentValue: `${assumptions.terminalGrowthRate.toFixed(1)}%`,
        limit: '≤ 10%',
    });

    // W-4: CapEx < D&A
    const totalDA = is.depreciation + is.amortization;
    rules.push({
        id: 'W-4',
        severity: 'WARNING',
        field: 'CapEx vs D&A',
        message: 'CapEx < D&A — company may not be reinvesting enough to maintain assets',
        triggered: financialData.cashFlowStatement.capitalExpenditures < totalDA && totalDA > 0,
        currentValue: `CapEx: ${financialData.cashFlowStatement.capitalExpenditures.toLocaleString()}, D&A: ${totalDA.toLocaleString()}`,
    });

    // W-5: Interest Coverage < 1.5x
    const ic = is.interestExpense > 0 ? is.operatingIncome / is.interestExpense : 999;
    rules.push({
        id: 'W-5',
        severity: 'WARNING',
        field: 'Interest Coverage',
        message: 'Interest coverage < 1.5x — company may struggle to service debt',
        triggered: ic < 1.5 && is.interestExpense > 0,
        currentValue: `${ic.toFixed(1)}x`,
        limit: '> 1.5x',
    });

    // W-6: Dividend payout > 100%
    const payoutRatio = is.netIncome > 0 ? (financialData.cashFlowStatement.dividendsPaid / is.netIncome) * 100 : 0;
    rules.push({
        id: 'W-6',
        severity: 'WARNING',
        field: 'Payout Ratio',
        message: 'Dividend payout > 100% — unsustainable without external funding',
        triggered: payoutRatio > 100,
        currentValue: `${payoutRatio.toFixed(0)}%`,
        limit: '≤ 100%',
    });

    // W-7: Revenue growth > 25%
    rules.push({
        id: 'W-7',
        severity: 'WARNING',
        field: 'Revenue Growth',
        message: 'Revenue growth > 25% — very aggressive assumption',
        triggered: assumptions.revenueGrowthRate > 25,
        currentValue: `${assumptions.revenueGrowthRate.toFixed(1)}%`,
        limit: '≤ 25%',
    });

    // W-8: TV% > 85% of EV
    if (dcfResult) {
        rules.push({
            id: 'W-8',
            severity: 'WARNING',
            field: 'Terminal Value %',
            message: 'Terminal value > 85% of EV — model is heavily dependent on terminal assumptions',
            triggered: dcfResult.terminalValuePercent > 85,
            currentValue: `${dcfResult.terminalValuePercent.toFixed(1)}%`,
            limit: '< 85%',
        });
    }

    // W-16: Terminal growth > risk-free rate (Damodaran rule of thumb)
    rules.push({
        id: 'W-16',
        severity: 'WARNING',
        field: 'Terminal Growth vs Rf',
        message: `Terminal g (${assumptions.terminalGrowthRate.toFixed(1)}%) > Rf (${assumptions.riskFreeRate.toFixed(1)}%) — firm grows faster than economy implied by risk-free rate`,
        triggered: assumptions.terminalGrowthRate > assumptions.riskFreeRate,
        currentValue: `g=${assumptions.terminalGrowthRate.toFixed(1)}%, Rf=${assumptions.riskFreeRate.toFixed(1)}%`,
    });

    // W-17: Terminal growth > nominal GDP (~11-13% for Egypt)
    const nominalGDPCap = 13;
    rules.push({
        id: 'W-17',
        severity: 'WARNING',
        field: 'Terminal Growth vs GDP',
        message: `Terminal g (${assumptions.terminalGrowthRate.toFixed(1)}%) exceeds Egypt nominal GDP growth (~${nominalGDPCap}%)`,
        triggered: assumptions.terminalGrowthRate > nominalGDPCap,
        currentValue: `${assumptions.terminalGrowthRate.toFixed(1)}%`,
        limit: `≤ ${nominalGDPCap}%`,
    });

    // W-9: Negative equity
    rules.push({
        id: 'W-9',
        severity: 'WARNING',
        field: 'Total Equity',
        message: 'Negative book equity — company may be technically insolvent',
        triggered: bs.totalEquity < 0,
        currentValue: `${bs.totalEquity.toLocaleString()}`,
        limit: '> 0',
    });

    // W-10: Cost of Debt ≤ Risk-Free Rate
    rules.push({
        id: 'W-10',
        severity: 'WARNING',
        field: 'Cost of Debt',
        message: `Cost of Debt (${assumptions.costOfDebt.toFixed(1)}%) must exceed Risk-Free Rate (${assumptions.riskFreeRate.toFixed(1)}%). Corporate borrowers always pay a credit spread above sovereign yield. Suggested Kd = ${(assumptions.riskFreeRate + 2.5).toFixed(1)}% (Rf + 250 bps).`,
        triggered: assumptions.costOfDebt > 0 && assumptions.costOfDebt <= assumptions.riskFreeRate,
        currentValue: `Kd=${assumptions.costOfDebt.toFixed(1)}%, Rf=${assumptions.riskFreeRate.toFixed(1)}%`,
        limit: `> ${assumptions.riskFreeRate.toFixed(1)}%`,
    });

    // W-11: Thin capitalization — Law 30/2023
    const totalDebtW = bs.shortTermDebt + bs.longTermDebt;
    const deRatio = bs.totalEquity > 0 ? totalDebtW / bs.totalEquity : 0;
    rules.push({
        id: 'W-11',
        severity: 'WARNING',
        field: 'D/E Ratio',
        message: `Thin capitalization warning (Law 30/2023): D/E ratio (${deRatio.toFixed(2)}x) exceeds 3:1. Interest deductions above this threshold may be disallowed for Egyptian tax purposes, increasing the effective tax burden.`,
        triggered: deRatio > 3.0,
        currentValue: `${deRatio.toFixed(2)}x`,
        limit: '≤ 3.0x',
    });

    // W-18: Scenario probabilities don't sum to 100%
    const totalProb = assumptions.bearProbability + assumptions.baseProbability + assumptions.bullProbability;
    rules.push({
        id: 'W-18',
        severity: 'WARNING',
        field: 'Scenario Probabilities',
        message: `Scenario probabilities sum to ${totalProb.toFixed(1)}% instead of 100%. Weighted value may be skewed.`,
        triggered: Math.abs(totalProb - 100) > 0.01,
        currentValue: `Bear ${assumptions.bearProbability}% + Base ${assumptions.baseProbability}% + Bull ${assumptions.bullProbability}% = ${totalProb}%`,
        limit: '= 100%',
    });

    return rules;
}

// ============================================
// SECTION 8.1b — PROJECTION DRIVER WARNINGS
// Flag when assumptions deviate >5pp from actuals
// ============================================

function checkProjectionDrivers(
    financialData: FinancialData,
    assumptions: ValuationAssumptions,
): ValidationRule[] {
    const rules: ValidationRule[] = [];
    const is = financialData.incomeStatement;
    const cf = financialData.cashFlowStatement;
    const rev = is.revenue;
    if (rev <= 0) return rules;

    const actualEBITDA = is.operatingIncome + is.depreciation + is.amortization;
    const actualEBITDAMargin = (actualEBITDA / rev) * 100;
    const actualDAPercent = ((is.depreciation + is.amortization) / rev) * 100;
    const actualCapExPercent = (cf.capitalExpenditures / rev) * 100;

    // W-12: EBITDA margin deviation
    const ebitdaGap = Math.abs(actualEBITDAMargin - assumptions.ebitdaMargin);
    if (ebitdaGap > 5) {
        rules.push({
            id: 'W-12',
            severity: 'WARNING',
            field: 'EBITDA Margin',
            message: `EBITDA margin assumption (${assumptions.ebitdaMargin.toFixed(1)}%) deviates from base year actual (${actualEBITDAMargin.toFixed(1)}%) by ${ebitdaGap.toFixed(1)}pp. Verify projection drivers match the company's actual operating profile.`,
            triggered: true,
            currentValue: `Assumed: ${assumptions.ebitdaMargin.toFixed(1)}%, Actual: ${actualEBITDAMargin.toFixed(1)}%`,
            limit: 'Within 5pp of actual',
        });
    }

    // W-13: D&A % deviation
    const daGap = Math.abs(actualDAPercent - assumptions.daPercent);
    if (daGap > 5) {
        rules.push({
            id: 'W-13',
            severity: 'WARNING',
            field: 'D&A %',
            message: `D&A assumption (${assumptions.daPercent.toFixed(1)}%) deviates from base year actual (${actualDAPercent.toFixed(1)}%) by ${daGap.toFixed(1)}pp.`,
            triggered: true,
            currentValue: `Assumed: ${assumptions.daPercent.toFixed(1)}%, Actual: ${actualDAPercent.toFixed(1)}%`,
            limit: 'Within 5pp of actual',
        });
    }

    // W-14: CapEx % deviation
    const capexGap = Math.abs(actualCapExPercent - assumptions.capexPercent);
    if (capexGap > 5) {
        rules.push({
            id: 'W-14',
            severity: 'WARNING',
            field: 'CapEx %',
            message: `CapEx assumption (${assumptions.capexPercent.toFixed(1)}%) deviates from base year actual (${actualCapExPercent.toFixed(1)}%) by ${capexGap.toFixed(1)}pp.`,
            triggered: true,
            currentValue: `Assumed: ${assumptions.capexPercent.toFixed(1)}%, Actual: ${actualCapExPercent.toFixed(1)}%`,
            limit: 'Within 5pp of actual',
        });
    }

    // W-15: DPS conflict — dividendsPerShare vs dps field
    const derivedDPS = financialData.cashFlowStatement.dividendsPaid > 0
        ? Math.abs(financialData.cashFlowStatement.dividendsPaid) / financialData.sharesOutstanding
        : 0;
    const statedDPS = financialData.dividendsPerShare || 0;
    const assumedDPS = assumptions.dps || 0;
    if (statedDPS > 0 && assumedDPS > 0 && Math.abs(statedDPS - assumedDPS) > 0.01) {
        rules.push({
            id: 'W-15',
            severity: 'WARNING',
            field: 'DPS',
            message: `Dividend conflict: dividendsPerShare (${statedDPS.toFixed(2)}) differs from assumptions.dps (${assumedDPS.toFixed(2)}). Engine uses: dividendsPaid/shares = ${derivedDPS.toFixed(2)}, then dividendsPerShare, then dps.`,
            triggered: true,
            currentValue: `dividendsPerShare: ${statedDPS}, dps: ${assumedDPS}, derived: ${derivedDPS.toFixed(2)}`,
        });
    }

    return rules;
}

// ============================================
// SECTION 8.2 — EDGE CASES
// Automatic adjustments with explanations
// ============================================

function checkEdgeCases(
    financialData: FinancialData,
    assumptions: ValuationAssumptions,
): ValidationRule[] {
    const rules: ValidationRule[] = [];
    const bs = financialData.balanceSheet;
    const totalDebt = bs.shortTermDebt + bs.longTermDebt;

    // EC-1: All-equity firm (no debt)
    rules.push({
        id: 'EC-1',
        severity: 'EDGE_CASE',
        field: 'Capital Structure',
        message: 'All-equity firm — WACC = Ke (cost of equity)',
        triggered: totalDebt === 0,
        currentValue: `Debt: ${totalDebt.toLocaleString()}`,
    });

    // EC-2: Net cash position (cash > debt)
    const netDebt = totalDebt - bs.cash;
    rules.push({
        id: 'EC-2',
        severity: 'EDGE_CASE',
        field: 'Net Debt',
        message: 'Net cash position — firm has more cash than debt, increasing equity value',
        triggered: netDebt < 0,
        currentValue: `Net debt: ${netDebt.toLocaleString()} (net cash of ${Math.abs(netDebt).toLocaleString()})`,
    });

    // EC-3: Zero dividends → DDM not applicable
    rules.push({
        id: 'EC-3',
        severity: 'EDGE_CASE',
        field: 'Dividends',
        message: 'Zero dividends per share — DDM models will return N/A',
        triggered: (financialData.dividendsPerShare || 0) === 0,
        currentValue: `DPS: ${financialData.dividendsPerShare || 0}`,
    });

    // EC-4: Very high WACC (>30%) — typical for frontier markets
    rules.push({
        id: 'EC-4',
        severity: 'EDGE_CASE',
        field: 'WACC',
        message: 'WACC > 30% — common in Egyptian market but produces aggressive discounting',
        triggered: assumptions.discountRate > 30,
        currentValue: `${assumptions.discountRate.toFixed(1)}%`,
    });

    // EC-5: Exit multiple method selected
    rules.push({
        id: 'EC-5',
        severity: 'EDGE_CASE',
        field: 'Terminal Method',
        message: 'Exit multiple method selected — terminal value uses EBITDA × multiple instead of Gordon Growth',
        triggered: assumptions.terminalMethod === 'exit_multiple',
        currentValue: `${assumptions.exitMultiple}x`,
    });

    return rules;
}

// ============================================
// MAIN VALIDATION FUNCTION
// ============================================

/**
 * Run all validation checks against financial data and assumptions.
 * Returns validation result with hard blocks, warnings, and edge cases.
 *
 * isValid = true only if there are zero hard blocks.
 */
export function validateInputs(
    financialData: FinancialData,
    assumptions: ValuationAssumptions,
    dcfResult?: DCFResult,
): ValidationResult {
    const hardBlocks = checkHardBlocks(financialData, assumptions).filter(r => r.triggered);
    const projectionWarnings = checkProjectionDrivers(financialData, assumptions);
    const warnings = [
        ...checkWarnings(financialData, assumptions, dcfResult).filter(r => r.triggered),
        ...projectionWarnings,
    ];
    const edgeCases = checkEdgeCases(financialData, assumptions).filter(r => r.triggered);

    return {
        isValid: hardBlocks.length === 0,
        hardBlocks,
        warnings,
        edgeCases,
        allRules: [...hardBlocks, ...warnings, ...edgeCases],
    };
}
