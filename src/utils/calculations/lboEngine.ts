/**
 * LBO (Leveraged Buyout) Module — Phase 4, Task #19
 *
 * Simplified LBO model for screening:
 * 1. Entry at current EV with assumed leverage split
 * 2. EBITDA-driven debt paydown over holding period
 * 3. Exit at terminal multiple → compute equity IRR and MoIC
 *
 * NOT a full LBO model (no debt tranches, PIK, revolver, etc.)
 * but sufficient for PE screening in an equity research context.
 */

export interface LBOAssumptions {
  /** Entry EV/EBITDA multiple */
  entryMultiple: number;
  /** Exit EV/EBITDA multiple */
  exitMultiple: number;
  /** Holding period (years) */
  holdingPeriod: number;
  /** Debt / Total Capital at entry (%) */
  leverageRatio: number;
  /** Cost of debt (%) */
  costOfDebt: number;
  /** Annual EBITDA growth (%) */
  ebitdaGrowth: number;
  /** % of excess cash flow used for mandatory debt repayment */
  debtPaydownRate: number;
  /** Tax rate (%) */
  taxRate: number;
}

export interface LBOResult {
  /** Entry Enterprise Value */
  entryEV: number;
  /** Entry equity (sponsor check) */
  entryEquity: number;
  /** Entry debt */
  entryDebt: number;
  /** Exit EV */
  exitEV: number;
  /** Exit equity */
  exitEquity: number;
  /** Remaining debt at exit */
  exitDebt: number;
  /** Equity IRR (%) */
  equityIRR: number;
  /** Multiple of Invested Capital */
  moic: number;
  /** Year-by-year projections */
  yearlyProjections: LBOYearProjection[];
  /** Total debt paid down */
  totalDebtPaidDown: number;
}

export interface LBOYearProjection {
  year: number;
  ebitda: number;
  interestExpense: number;
  taxes: number;
  freeCashFlow: number;
  debtRepayment: number;
  debtBalance: number;
}

export const DEFAULT_LBO_ASSUMPTIONS: LBOAssumptions = {
  entryMultiple: 8.0,
  exitMultiple: 8.0,
  holdingPeriod: 5,
  leverageRatio: 60,
  costOfDebt: 22.5,
  ebitdaGrowth: 8.0,
  debtPaydownRate: 75,
  taxRate: 22.5,
};

export function calculateLBO(
  baseEbitda: number,
  assumptions: LBOAssumptions
): LBOResult {
  const {
    entryMultiple, exitMultiple, holdingPeriod,
    leverageRatio, costOfDebt, ebitdaGrowth,
    debtPaydownRate, taxRate,
  } = assumptions;

  // Entry
  const entryEV = baseEbitda * entryMultiple;
  const entryDebt = entryEV * (leverageRatio / 100);
  const entryEquity = entryEV - entryDebt;

  // Year-by-year projections
  let debtBalance = entryDebt;
  let currentEbitda = baseEbitda;
  const yearlyProjections: LBOYearProjection[] = [];
  let totalDebtPaidDown = 0;

  for (let yr = 1; yr <= holdingPeriod; yr++) {
    currentEbitda *= (1 + ebitdaGrowth / 100);
    const interest = debtBalance * (costOfDebt / 100);
    const ebt = currentEbitda - interest;
    const taxes = Math.max(0, ebt * (taxRate / 100));
    const netIncome = ebt - taxes;
    // Simplified FCF = Net Income (no capex/WC in screening model)
    const fcf = Math.max(0, netIncome);
    const repayment = Math.min(debtBalance, fcf * (debtPaydownRate / 100));
    debtBalance -= repayment;
    totalDebtPaidDown += repayment;

    yearlyProjections.push({
      year: yr,
      ebitda: currentEbitda,
      interestExpense: interest,
      taxes,
      freeCashFlow: fcf,
      debtRepayment: repayment,
      debtBalance,
    });
  }

  // Exit
  const exitEbitda = currentEbitda;
  const exitEV = exitEbitda * exitMultiple;
  const exitEquity = exitEV - debtBalance;

  // IRR: (exitEquity / entryEquity)^(1/n) - 1
  const moic = entryEquity > 0 ? exitEquity / entryEquity : 0;
  const equityIRR = entryEquity > 0
    ? (Math.pow(Math.max(0, moic), 1 / holdingPeriod) - 1) * 100
    : 0;

  return {
    entryEV, entryEquity, entryDebt,
    exitEV, exitEquity, exitDebt: debtBalance,
    equityIRR, moic,
    yearlyProjections,
    totalDebtPaidDown,
  };
}
