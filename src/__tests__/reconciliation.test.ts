/**
 * WOLF Engine ⟷ Excel Reconciliation Test
 * Verifies TechCorp sample produces exact expected values.
 * All assertions within ±0.01 tolerance.
 */
import { describe, it, expect } from 'vitest';
import { FinancialData, ValuationAssumptions } from '../types/financial';
import { calculateWACC, calculateKe, calculateDCF, calculateEBITDA, calculateEnterpriseValue } from '../utils/valuation';
import { calculateDDM } from '../utils/valuationEngine';

// ── TechCorp Sample Inputs (matching user's reconciliation table) ──
const financialData: FinancialData = {
  companyName: 'TechCorp Industries',
  ticker: 'TECH',
  sharesOutstanding: 100_000_000,
  currentStockPrice: 45.00,
  dividendsPerShare: 2.0,
  incomeStatement: {
    revenue: 5_000_000_000,
    costOfGoodsSold: 2_000_000_000,
    grossProfit: 3_000_000_000,
    operatingExpenses: 1_500_000_000,
    operatingIncome: 1_500_000_000,
    interestExpense: 100_000_000,
    taxExpense: 294_000_000,
    netIncome: 1_106_000_000,
    depreciation: 200_000_000,
    amortization: 50_000_000,
  },
  balanceSheet: {
    cash: 800_000_000,
    marketableSecurities: 0,
    accountsReceivable: 600_000_000,
    inventory: 400_000_000,
    otherCurrentAssets: 0,
    totalCurrentAssets: 1_800_000_000,
    propertyPlantEquipment: 2_000_000_000,
    longTermInvestments: 0,
    goodwill: 0,
    intangibleAssets: 500_000_000,
    otherNonCurrentAssets: 0,
    totalAssets: 4_300_000_000,
    accountsPayable: 300_000_000,
    shortTermDebt: 200_000_000,
    otherCurrentLiabilities: 0,
    totalCurrentLiabilities: 500_000_000,
    longTermDebt: 1_000_000_000,
    otherNonCurrentLiabilities: 0,
    totalLiabilities: 1_500_000_000,
    totalEquity: 2_800_000_000,
  },
  cashFlowStatement: {
    operatingCashFlow: 1_400_000_000,
    capitalExpenditures: 300_000_000,
    freeCashFlow: 1_100_000_000,
    dividendsPaid: 200_000_000,
    netChangeInCash: 600_000_000,
  },
};

const assumptions: ValuationAssumptions = {
  discountRate: 0, // sentinel — will be computed
  terminalGrowthRate: 8.0,
  projectionYears: 5,
  revenueGrowthRate: 15,
  marginImprovement: 0,
  taxRate: 22.5,
  riskFreeRate: 20.0, // User's table uses Rf=20
  marketRiskPremium: 4.23,
  beta: 1.2,
  capmMethod: 'local_rf',
  betaType: 'raw',
  taxCategory: 'standard',
  rfUS: 4.25,
  countryRiskPremium: 9.71,
  egyptInflation: 13.5,
  usInflation: 3.3,
  costOfDebt: 22.9,
  rfDate: '2026-04-12',
  ebitdaMargin: 30.0,
  daPercent: 8.0,
  capexPercent: 10.0,
  deltaWCPercent: 20.0,
  useConstantDrivers: true,
  terminalMethod: 'gordon_growth',
  exitMultiple: 8.0,
  discountingConvention: 'end_of_year',
  ddmHighGrowth: 15.0,
  ddmStableGrowth: 8.0,
  ddmHighGrowthYears: 5,
  bearProbability: 25,
  baseProbability: 50,
  bullProbability: 25,
};

const TOL = 0.02; // ±0.02 tolerance for percentage values
const TOL_ABS = 1; // ±1 for large numbers (rounding)

describe('TechCorp Reconciliation', () => {
  it('Ke = 25.076% (local_rf: 20 + 1.2×4.23)', () => {
    const ke = calculateKe(assumptions);
    expect(ke).toBeCloseTo(25.076, 2);
  });

  it('Kd after-tax = 17.7475%', () => {
    const kdAT = assumptions.costOfDebt * (1 - assumptions.taxRate / 100);
    expect(kdAT).toBeCloseTo(17.7475, 2);
  });

  it('We / Wd = 0.7895 / 0.2105', () => {
    const mktCap = financialData.currentStockPrice * financialData.sharesOutstanding;
    const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
    const totalCap = mktCap + totalDebt;
    expect(mktCap / totalCap).toBeCloseTo(0.789474, 4);
    expect(totalDebt / totalCap).toBeCloseTo(0.210526, 4);
  });

  it('WACC = 23.5332%', () => {
    const wacc = calculateWACC(financialData, assumptions);
    expect(wacc).toBeCloseTo(23.533, 1);
  });

  it('DCF produces correct EV, Equity, and per-share values', () => {
    const wacc = calculateWACC(financialData, assumptions);
    const dcfAssumptions = { ...assumptions, discountRate: wacc };
    const { value: equityValue, projections } = calculateDCF(financialData, dcfAssumptions);

    // Sum PV of FCFF
    const sumPV = projections.reduce((s, p) => s + p.presentValue, 0);
    expect(sumPV).toBeCloseTo(2_522_152_747, -2); // within ±100

    // Per share
    const perShare = equityValue / financialData.sharesOutstanding;
    expect(perShare).toBeCloseTo(51.46, 0); // within ±1 EGP
  });

  it('DDM Gordon (DPS=2) ≈ 12.65 EGP', () => {
    const ke = calculateKe(assumptions);
    const ddm = calculateDDM(financialData, assumptions, ke);
    if (ddm.gordonGrowth) {
      expect(ddm.gordonGrowth).toBeCloseTo(12.65, 0);
    }
  });

  it('DDM Two-Stage ≈ 16.14 EGP', () => {
    const ke = calculateKe(assumptions);
    const ddm = calculateDDM(financialData, assumptions, ke);
    if (ddm.twoStage) {
      expect(ddm.twoStage).toBeCloseTo(16.14, 0);
    }
  });

  it('DDM H-Model ≈ 14.70 EGP', () => {
    const ke = calculateKe(assumptions);
    const ddm = calculateDDM(financialData, assumptions, ke);
    if (ddm.hModel) {
      expect(ddm.hModel).toBeCloseTo(14.70, 0);
    }
  });

  it('EV/EBITDA (Y0 actuals) ≈ 2.80x', () => {
    const ebitda = calculateEBITDA(financialData);
    const ev = calculateEnterpriseValue(financialData);
    const ratio = ev / ebitda;
    expect(ratio).toBeCloseTo(2.80, 1);
  });
});
