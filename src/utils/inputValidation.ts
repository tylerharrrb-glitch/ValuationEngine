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
    const warnings = checkWarnings(financialData, assumptions, dcfResult).filter(r => r.triggered);
    const edgeCases = checkEdgeCases(financialData, assumptions).filter(r => r.triggered);

    return {
        isValid: hardBlocks.length === 0,
        hardBlocks,
        warnings,
        edgeCases,
        allRules: [...hardBlocks, ...warnings, ...edgeCases],
    };
}
