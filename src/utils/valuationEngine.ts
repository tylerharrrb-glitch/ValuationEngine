// ============================================
// WOLF VALUATION ENGINE — Core Calculations
// CFA-grade financial modeling for Egyptian market
// Every formula verified against specification Section 3-6
// ============================================

import {
  FinancialData,
  ValuationAssumptions,
  ComparableCompany,
  DCFProjection,
  WACCResult,
  FCFFVerification,
  DCFResult,
  DDMResult,
  SensitivityCell,
  SensitivityMatrix,
  ScenarioAnalysis,
  ScenarioCase,
  ReverseDCFResult,
  FinancialRatios,
  ValidationAlert,
  CAPMMethod,
  MarketRegion,
} from '../types/financial';

// ============================================
// MARKET REGION DEFAULTS (re-exported for compatibility)
// ============================================
export type { MarketRegion };

export interface MarketConfig {
  riskFreeRate: number;
  marketRiskPremium: number;
  terminalGrowthRate: number;
  maxTerminalGrowth: number;
  defaultTaxRate: number;
  currency: 'USD' | 'EGP';
  currencySymbol: string;
  label: string;
  description: string;
  riskFreeDescription: string;
  countryRiskPremium: number;
}

export const MARKET_DEFAULTS: Record<MarketRegion, MarketConfig> = {
  USA: {
    riskFreeRate: 4.5,
    marketRiskPremium: 5.5,
    terminalGrowthRate: 2.5,
    maxTerminalGrowth: 3.0,
    defaultTaxRate: 21.0,
    currency: 'USD',
    currencySymbol: '$',
    label: '🇺🇸 USA',
    description: 'United States - Developed Market',
    riskFreeDescription: '10-Year US Treasury Bond Yield',
    countryRiskPremium: 0,
  },
  Egypt: {
    riskFreeRate: 22.0,              // BUG FIX: 10-Year Egyptian Government Bond (was 27.25% CBE overnight)
    marketRiskPremium: 5.5,          // BUG FIX: Mature Market ERP only (was 10% which double-counts CRP)
    terminalGrowthRate: 8.0,
    maxTerminalGrowth: 12.0,
    defaultTaxRate: 22.5,
    currency: 'EGP',
    currencySymbol: 'EGP',
    label: '🇪🇬 Egypt',
    description: 'Egypt - Emerging Market (EGX)',
    riskFreeDescription: '10-Year Egyptian Government Bond Yield',
    countryRiskPremium: 7.5,         // Damodaran for Egypt — used ONLY in Method B
  },
};

// ============================================
// EGYPTIAN MARKET DATA & INDUSTRY MULTIPLES
// ============================================

export const EGYPTIAN_INDUSTRY_MULTIPLES: Record<string, {
  peRatio: number;
  evEbitda: number;
  psRatio: number;
  pbRatio: number;
}> = {
  'Banking': { peRatio: 5.5, evEbitda: 4.0, psRatio: 2.0, pbRatio: 1.2 },
  'Telecom': { peRatio: 8.0, evEbitda: 4.5, psRatio: 1.5, pbRatio: 1.8 },
  'Consumer': { peRatio: 12.0, evEbitda: 7.0, psRatio: 1.2, pbRatio: 2.5 },
  'Real Estate': { peRatio: 6.0, evEbitda: 8.0, psRatio: 2.0, pbRatio: 0.8 },
  'Industrial': { peRatio: 7.0, evEbitda: 5.0, psRatio: 0.8, pbRatio: 1.0 },
  'Healthcare': { peRatio: 15.0, evEbitda: 9.0, psRatio: 2.5, pbRatio: 3.0 },
  'Default': { peRatio: 7.0, evEbitda: 5.0, psRatio: 1.2, pbRatio: 1.5 },
};

export const EGYPTIAN_INDUSTRY_PEERS: Record<string, string[]> = {
  'CIB': ['COMI.CA', 'QNBA.CA', 'ADIB.CA', 'FAISAL.CA'],
  'COMI.CA': ['QNBA.CA', 'ADIB.CA', 'FAISAL.CA', 'SAIB.CA'],
  'ETEL.CA': ['VODAFONE.CA', 'ORANGE.CA'],
  'Telecom Egypt': ['VODAFONE.CA', 'ORANGE.CA'],
  'EFID.CA': ['JUFO.CA', 'ISPH.CA', 'DOMTY.CA'],
  'Edita': ['JUFO.CA', 'ISPH.CA', 'DOMTY.CA'],
  'TMGH.CA': ['PHDC.CA', 'EMFD.CA', 'MNHD.CA'],
  'Palm Hills': ['TMGH.CA', 'EMFD.CA', 'MNHD.CA'],
  'DEFAULT_EG': ['COMI.CA', 'ETEL.CA', 'EFID.CA', 'EAST.CA', 'TMGH.CA'],
};

// ============================================
// SECTION 3 — WACC CALCULATION
// WACC = (E/V) × Ke + (D/V) × Kd × (1 − t)
// BUG FIX: Uses Market Cap (NOT book equity) for weights
// BUG FIX: WACC calculated from components (NOT hard-coded)
// ============================================

export interface WACCInputs {
  marketCap: number;
  totalDebt: number;
  riskFreeRate: number;
  beta: number;
  marketRiskPremium: number;
  costOfDebt: number;         // Pre-tax cost of debt (%)
  taxRate: number;
  capmMethod: CAPMMethod;
  // Method B fields
  rfUS?: number;
  countryRiskPremium?: number;
  egyptInflation?: number;
  usInflation?: number;
  // Beta type
  betaType?: 'raw' | 'adjusted' | 'relevered';
}

/**
 * Calculate Cost of Equity using dual CAPM methodology (Section 3.2).
 *
 * Method A — Local Currency CAPM (DEFAULT for EGP):
 *   Ke = Rf(Egypt) + β × Mature_Market_ERP
 *   NO CRP added (Egyptian Rf already embeds country risk)
 *
 * Method B — USD Build-Up:
 *   Ke(USD) = Rf(US) + β × Mature_ERP + CRP
 *   Ke(EGP) = (1 + Ke_USD) × (1 + Egypt_Inflation) / (1 + US_Inflation) − 1
 */
function calculateCostOfEquity(inputs: WACCInputs): { ke: number; keUSD?: number } {
  // Adjust beta based on type (Section 3.3)
  let effectiveBeta = inputs.beta;
  if (inputs.betaType === 'adjusted') {
    // Bloomberg adjustment: Adjusted β = (2/3 × Raw β) + (1/3 × 1.0)
    effectiveBeta = (2 / 3) * inputs.beta + (1 / 3) * 1.0;
  }
  // Note: relevered beta uses βL = βU × [1 + (1-t) × (D/E)], handled externally

  if (inputs.capmMethod === 'B') {
    // Method B — USD Build-Up
    const rfUS = inputs.rfUS ?? 4.5;
    const crp = inputs.countryRiskPremium ?? 7.5;
    const egyptInf = (inputs.egyptInflation ?? 28.0) / 100;
    const usInf = (inputs.usInflation ?? 3.0) / 100;

    const keUSD = rfUS + effectiveBeta * inputs.marketRiskPremium + crp;
    // Fisher equation: Ke(EGP) = (1 + Ke_USD) × (1 + Egypt_Inflation) / (1 + US_Inflation) − 1
    const ke = ((1 + keUSD / 100) * (1 + egyptInf) / (1 + usInf) - 1) * 100;
    return { ke, keUSD };
  }

  // Method A — Local Currency CAPM (default)
  // Ke = Rf(Egypt) + β × Mature_Market_ERP
  // NO CRP — it's embedded in the local Rf
  const ke = inputs.riskFreeRate + effectiveBeta * inputs.marketRiskPremium;
  return { ke };
}

export function calculateWACC(inputs: WACCInputs): WACCResult {
  const { marketCap, totalDebt, costOfDebt, taxRate, capmMethod } = inputs;

  // Step 1: Cost of Equity (CAPM)
  const { ke, keUSD } = calculateCostOfEquity(inputs);

  // Step 2: After-Tax Cost of Debt = Kd × (1 - t)
  const afterTaxCostOfDebt = costOfDebt * (1 - taxRate / 100);

  // Step 3: Capital Structure Weights (using MARKET CAP, not book equity)
  const totalCapital = marketCap + totalDebt;
  const equityWeight = totalCapital > 0 ? (marketCap / totalCapital) * 100 : 100;
  const debtWeight = totalCapital > 0 ? (totalDebt / totalCapital) * 100 : 0;

  // Step 4: WACC = (E/V) × Ke + (D/V) × Kd × (1-t)
  const wacc = (equityWeight / 100) * ke + (debtWeight / 100) * afterTaxCostOfDebt;

  return {
    costOfEquity: ke,
    afterTaxCostOfDebt,
    preTaxCostOfDebt: costOfDebt,
    equityWeight,
    debtWeight,
    wacc,
    marketCap,
    totalDebt,
    totalCapital,
    capmMethod,
    keUSD,
  };
}

// ============================================
// SECTION 4 — FCFF THREE-WAY CROSS-VERIFICATION
// All 3 methods must produce identical results
// BUG FIX: FCFF was calculated as Revenue × FCF margin (wrong)
// ============================================

/**
 * Calculate Free Cash Flow to Firm using all THREE methods (Section 4.1).
 *
 * Method 1 — NOPAT Route (Primary):
 *   FCFF = EBIT × (1-t) + D&A − CapEx − ΔWC
 *
 * Method 2 — EBITDA Route:
 *   FCFF = EBITDA × (1-t) + D&A × t − CapEx − ΔWC
 *
 * Method 3 — Net Income Route:
 *   FCFF = Net Income + Interest × (1-t) + D&A − CapEx − ΔWC
 *
 * ⚠️ FCFF must NEVER subtract Interest Expense directly.
 * ⚠️ ΔWC increase = cash OUTFLOW (subtracted)
 */
export function calculateFCFFVerification(
  ebit: number,
  ebitda: number,
  dAndA: number,
  netIncome: number,
  interestExpense: number,
  taxRate: number,  // decimal (e.g., 0.225 for 22.5%)
  capex: number,
  deltaWC: number,
): FCFFVerification {
  // Method 1: NOPAT Route
  const nopat = ebit * (1 - taxRate);
  const method1 = nopat + dAndA - capex - deltaWC;

  // Method 2: EBITDA Route
  const method2 = ebitda * (1 - taxRate) + dAndA * taxRate - capex - deltaWC;

  // Method 3: Net Income Route
  const method3 = netIncome + interestExpense * (1 - taxRate) + dAndA - capex - deltaWC;

  // Cross-verify
  const tolerance = 0.001;
  const allMatch = Math.abs(method1 - method2) < tolerance && Math.abs(method1 - method3) < tolerance;

  return { method1, method2, method3, allMatch, tolerance };
}

// ============================================
// SECTION 5 — DCF PROJECTIONS
// Year-by-year: Revenue → EBITDA → D&A → EBIT → NOPAT → CapEx → ΔWC → FCFF
// BUG FIX: Uses proper FCFF formula (NOT Revenue × FCF margin)
// ============================================

export function calculateDCFProjections(
  financialData: FinancialData,
  assumptions: ValuationAssumptions
): DCFProjection[] {
  const projections: DCFProjection[] = [];
  let currentRevenue = financialData.incomeStatement.revenue;
  const taxRate = assumptions.taxRate / 100;
  const wacc = assumptions.discountRate / 100;

  for (let year = 1; year <= assumptions.projectionYears; year++) {
    const prevRevenue = currentRevenue;

    // Section 5.1: Revenue(t) = Revenue(t-1) × (1 + Revenue_Growth_t)
    currentRevenue = currentRevenue * (1 + assumptions.revenueGrowthRate / 100);

    // EBITDA(t) = Revenue(t) × EBITDA_Margin
    const ebitda = currentRevenue * (assumptions.ebitdaMargin / 100);

    // D&A(t) = Revenue(t) × DA_Pct
    const dAndA = currentRevenue * (assumptions.daPercent / 100);

    // EBIT(t) = EBITDA(t) − D&A(t)
    const ebit = ebitda - dAndA;

    // NOPAT(t) = EBIT(t) × (1 − Tax_Rate)
    const nopat = ebit * (1 - taxRate);

    // CapEx(t) = Revenue(t) × CapEx_Pct
    const capex = currentRevenue * (assumptions.capexPercent / 100);

    // ΔWC(t) = (Revenue(t) − Revenue(t-1)) × DeltaWC_Pct
    const deltaWC = (currentRevenue - prevRevenue) * (assumptions.deltaWCPercent / 100);

    // FCFF(t) = NOPAT + D&A − CapEx − ΔWC
    const fcff = nopat + dAndA - capex - deltaWC;

    // Discount factor based on convention (Section 5.3)
    let period: number;
    if (assumptions.discountingConvention === 'mid_year') {
      period = year - 0.5;
    } else {
      period = year;  // End-of-year (default)
    }
    const discountFactor = Math.pow(1 + wacc, period);

    // Present Value
    const presentValue = fcff / discountFactor;

    projections.push({
      year: new Date().getFullYear() + year,
      revenue: currentRevenue,
      ebitda,
      dAndA,
      ebit,
      nopat,
      capex,
      deltaWC,
      freeCashFlow: fcff,
      discountFactor,
      presentValue,
    });
  }

  return projections;
}

// ============================================
// SECTION 5.2-5.4 — DCF VALUATION (Terminal Value + EV-to-Equity Bridge)
// BUG FIX: Equity Value can be NEGATIVE (removed MAX(0) floor)
// BUG FIX: Proper Gordon Growth with g < WACC hard block
// ============================================

export function calculateDCFValue(
  financialData: FinancialData,
  assumptions: ValuationAssumptions,
  projections: DCFProjection[]
): DCFResult {
  if (projections.length === 0) {
    return {
      sumOfPresentValues: 0, terminalValue: 0, presentValueOfTerminal: 0,
      terminalValuePercent: 0, enterpriseValue: 0, netDebt: 0, equityValue: 0,
      impliedSharePrice: 0, upside: 0, marginOfSafety: 0,
      verdict: 'FAIRLY VALUED', discountingConvention: assumptions.discountingConvention,
    };
  }

  const wacc = assumptions.discountRate / 100;
  const terminalGrowth = assumptions.terminalGrowthRate / 100;

  // Step 1: Sum of PV(FCFF)
  const sumOfPresentValues = projections.reduce((sum, p) => sum + p.presentValue, 0);

  // Step 2: Terminal Value
  const lastFCFF = projections[projections.length - 1].freeCashFlow;
  let terminalValue = 0;

  if (assumptions.terminalMethod === 'exit_multiple') {
    // Exit Multiple Method: TV = EBITDA_N × Exit Multiple
    const lastEBITDA = projections[projections.length - 1].ebitda;
    terminalValue = lastEBITDA * assumptions.exitMultiple;
  } else {
    // Gordon Growth Method (default): TV = FCFF_N × (1+g) / (WACC-g)
    if (wacc > terminalGrowth && (wacc - terminalGrowth) > 0.0001) {
      terminalValue = (lastFCFF * (1 + terminalGrowth)) / (wacc - terminalGrowth);
    } else {
      // Hard block: g >= WACC makes no mathematical sense
      console.error('[WOLF] ERROR: Terminal growth ≥ WACC. Cannot calculate terminal value.');
      terminalValue = 0;
    }
  }

  // Step 3: PV of Terminal Value
  const lastDiscountFactor = Math.pow(1 + wacc, assumptions.projectionYears);
  const presentValueOfTerminal = terminalValue / lastDiscountFactor;

  // Step 4: Enterprise Value
  const enterpriseValue = sumOfPresentValues + presentValueOfTerminal;

  // Step 5: EV-to-Equity Bridge (Section 5.4)
  // Equity Value = EV − Total Debt + Cash & Equivalents
  // BUG FIX: NO MAX(0) floor — equity can be negative for distressed companies
  const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const cash = financialData.balanceSheet.cash;
  const netDebt = totalDebt - cash;
  const equityValue = enterpriseValue - netDebt;

  // Step 6: Intrinsic Value per Share
  const sharesOutstanding = financialData.sharesOutstanding || 1;
  const impliedSharePrice = equityValue / sharesOutstanding;

  // Step 7: Verdict (Section 5.5)
  const currentPrice = financialData.currentStockPrice || 0;
  const upside = currentPrice > 0
    ? ((impliedSharePrice - currentPrice) / currentPrice) * 100
    : 0;
  const marginOfSafety = currentPrice > 0
    ? ((impliedSharePrice - currentPrice) / impliedSharePrice) * 100
    : 0;

  // Verdict logic (Section 5.5):
  // UNDERVALUED:   Intrinsic > Market Price × 1.10 (>10% upside)
  // FAIRLY VALUED: Market Price × 0.90 ≤ Intrinsic ≤ Market Price × 1.10
  // OVERVALUED:    Intrinsic < Market Price × 0.90 (>10% downside)
  let verdict: DCFResult['verdict'] = 'FAIRLY VALUED';
  if (impliedSharePrice > currentPrice * 1.10) {
    verdict = 'UNDERVALUED';
  } else if (impliedSharePrice < currentPrice * 0.90) {
    verdict = 'OVERVALUED';
  }

  // TV as % of EV
  const terminalValuePercent = enterpriseValue > 0
    ? (presentValueOfTerminal / enterpriseValue) * 100
    : 0;

  return {
    sumOfPresentValues,
    terminalValue,
    presentValueOfTerminal,
    terminalValuePercent,
    enterpriseValue,
    netDebt,
    equityValue,
    impliedSharePrice,
    upside,
    marginOfSafety,
    verdict,
    discountingConvention: assumptions.discountingConvention,
  };
}

// ============================================
// SECTION 6 — DIVIDEND DISCOUNT MODELS
// ⚠️ ALL DDM models discount at Ke (cost of equity), NOT WACC
// ============================================

export function calculateDDM(
  financialData: FinancialData,
  assumptions: ValuationAssumptions,
  costOfEquity: number,  // Ke in percent
): DDMResult {
  // C1 Fix: Calculate DPS from actual dividends paid, not manual input
  const dividendsPaid = Math.abs(financialData.cashFlowStatement.dividendsPaid || 0);
  const dps = dividendsPaid > 0
    ? dividendsPaid / financialData.sharesOutstanding
    : (financialData.dividendsPerShare || assumptions.dps || 0);
  const ke = costOfEquity / 100;

  // Check if company pays dividends
  if (dps <= 0) {
    return {
      gordonGrowth: null,
      twoStage: null,
      hModel: null,
      applicable: false,
      message: 'DDM Not Applicable — Company does not pay dividends.',
    };
  }

  // Check if earnings are negative
  if (financialData.incomeStatement.netIncome < 0) {
    return {
      gordonGrowth: null,
      twoStage: null,
      hModel: null,
      applicable: false,
      message: 'N/A — Dividend not sustainable at negative earnings.',
    };
  }

  const gStable = assumptions.ddmStableGrowth / 100;
  const gHigh = assumptions.ddmHighGrowth / 100;
  const n = assumptions.ddmHighGrowthYears;

  // 6.1 — Gordon Growth (Single-Stage)
  // P = D₀ × (1 + g) / (Ke − g) = D₁ / (Ke − g)
  let gordonGrowth: number | null = null;
  if (ke > gStable) {
    gordonGrowth = (dps * (1 + gStable)) / (ke - gStable);
  }

  // 6.2 — Two-Stage DDM
  // P = Σ[D₀(1+g₁)^t / (1+Ke)^t] for t=1..n + [Dₙ(1+g₂)/(Ke−g₂)] / (1+Ke)^n
  let twoStage: number | null = null;
  if (ke > gStable) {
    let pvHighGrowth = 0;
    let lastDiv = dps;
    for (let t = 1; t <= n; t++) {
      lastDiv = dps * Math.pow(1 + gHigh, t);
      pvHighGrowth += lastDiv / Math.pow(1 + ke, t);
    }
    const terminalDiv = lastDiv * (1 + gStable);
    const terminalValue = terminalDiv / (ke - gStable);
    const pvTerminal = terminalValue / Math.pow(1 + ke, n);
    twoStage = pvHighGrowth + pvTerminal;
  }

  // 6.3 — H-Model
  // P = D₀ × (1 + g_L) / (Ke − g_L) + D₀ × H × (g_S − g_L) / (Ke − g_L)
  // Where H = half-life of high-growth period
  let hModel: number | null = null;
  if (ke > gStable) {
    const H = n / 2; // Half-life
    hModel = (dps * (1 + gStable)) / (ke - gStable) +
      (dps * H * (gHigh - gStable)) / (ke - gStable);
  }

  return {
    gordonGrowth,
    twoStage,
    hModel,
    applicable: true,
  };
}

// ============================================
// COMPARABLE COMPANY VALUATION
// ============================================

export interface ComparableResult {
  peImpliedPrice: number;
  evEbitdaImpliedPrice: number;
  psImpliedPrice: number;
  pbImpliedPrice: number;
  averageImpliedPrice: number;
  medianMultiples: { pe: number; evEbitda: number; ps: number; pb: number; };
}

export function calculateComparableValue(
  financialData: FinancialData,
  comparables: ComparableCompany[]
): ComparableResult {
  const defaultResult: ComparableResult = {
    peImpliedPrice: 0, evEbitdaImpliedPrice: 0, psImpliedPrice: 0, pbImpliedPrice: 0,
    averageImpliedPrice: 0, medianMultiples: { pe: 0, evEbitda: 0, ps: 0, pb: 0 },
  };

  if (comparables.length === 0) return defaultResult;

  const median = (arr: number[]): number => {
    const filtered = arr.filter(x => x > 0);
    if (filtered.length === 0) return 0;
    const sorted = [...filtered].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const medianMultiples = {
    pe: median(comparables.map(c => c.peRatio)),
    evEbitda: median(comparables.map(c => c.evEbitda)),
    ps: median(comparables.map(c => c.psRatio)),
    pb: median(comparables.map(c => c.pbRatio)),
  };

  const { incomeStatement, balanceSheet, sharesOutstanding } = financialData;
  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const cash = balanceSheet.cash;

  // P/E
  const eps = incomeStatement.netIncome / sharesOutstanding;
  const peImpliedPrice = eps > 0 ? eps * medianMultiples.pe : 0;

  // EV/EBITDA
  const ebitda = incomeStatement.operatingIncome + incomeStatement.depreciation + incomeStatement.amortization;
  let evEbitdaImpliedPrice = 0;
  if (ebitda > 0 && medianMultiples.evEbitda > 0) {
    const impliedEV = ebitda * medianMultiples.evEbitda;
    // BUG FIX: No MAX(0) floor
    const impliedEquity = impliedEV - totalDebt + cash;
    evEbitdaImpliedPrice = impliedEquity / sharesOutstanding;
  }

  // P/S
  const revenuePerShare = incomeStatement.revenue / sharesOutstanding;
  const psImpliedPrice = revenuePerShare > 0 ? revenuePerShare * medianMultiples.ps : 0;

  // P/B
  const bookValuePerShare = balanceSheet.totalEquity / sharesOutstanding;
  const pbImpliedPrice = bookValuePerShare > 0 ? bookValuePerShare * medianMultiples.pb : 0;

  const validPrices = [peImpliedPrice, evEbitdaImpliedPrice, psImpliedPrice, pbImpliedPrice].filter(p => p > 0);
  const averageImpliedPrice = validPrices.length > 0
    ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length
    : 0;

  return { peImpliedPrice, evEbitdaImpliedPrice, psImpliedPrice, pbImpliedPrice, averageImpliedPrice, medianMultiples };
}

// ============================================
// BLENDED VALUATION
// ============================================

export interface BlendedValuationResult {
  dcfValue: number;
  dcfWeight: number;
  comparableValue: number;
  comparableWeight: number;
  blendedValue: number;
  upside: number;
  recommendation: { text: string; color: string; bg: string; };
}

export function calculateBlendedValuation(
  dcfValue: number,
  comparableValue: number,
  currentPrice: number,
  dcfWeight: number = 0.6,
  comparableWeight: number = 0.4
): BlendedValuationResult {
  const hasValidComps = comparableValue > 0 && isFinite(comparableValue);

  let effectiveDCFWeight: number;
  let effectiveCompsWeight: number;
  let blendedValue: number;

  if (!hasValidComps) {
    effectiveDCFWeight = 100;
    effectiveCompsWeight = 0;
    blendedValue = dcfValue;
  } else {
    const totalWeight = dcfWeight + comparableWeight;
    effectiveDCFWeight = (dcfWeight / totalWeight) * 100;
    effectiveCompsWeight = (comparableWeight / totalWeight) * 100;
    blendedValue = (dcfValue * (effectiveDCFWeight / 100)) + (comparableValue * (effectiveCompsWeight / 100));
  }

  const upside = currentPrice > 0
    ? ((blendedValue - currentPrice) / currentPrice) * 100
    : 0;

  // Verdict-based recommendation (Section 5.5 bands)
  let recommendation: { text: string; color: string; bg: string };
  if (upside > 10) {
    recommendation = { text: 'UNDERVALUED', color: 'text-green-400', bg: 'bg-green-500/20' };
  } else if (upside > -10) {
    recommendation = { text: 'FAIRLY VALUED', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
  } else {
    recommendation = { text: 'OVERVALUED', color: 'text-red-400', bg: 'bg-red-500/20' };
  }

  return {
    dcfValue, dcfWeight: effectiveDCFWeight,
    comparableValue: hasValidComps ? comparableValue : 0,
    comparableWeight: effectiveCompsWeight,
    blendedValue, upside, recommendation,
  };
}

// ============================================
// SECTION 7 — FULL FINANCIAL RATIOS
// ============================================

export function calculateFinancialRatios(
  financialData: FinancialData,
  wacc: number = 0,  // Required for EVA and ROIC-WACC spread
): FinancialRatios {
  const { incomeStatement: is, balanceSheet: bs, cashFlowStatement: cf,
    currentStockPrice: price, sharesOutstanding: shares } = financialData;

  const revenue = is.revenue || 1;
  const totalDebt = bs.shortTermDebt + bs.longTermDebt;
  const marketCap = price * shares;
  const ebitda = is.operatingIncome + is.depreciation + is.amortization;
  const ev = marketCap + totalDebt - bs.cash;
  const investedCapital = bs.totalEquity + totalDebt - bs.cash;
  const taxRate = (is.netIncome + is.taxExpense) > 0
    ? is.taxExpense / (is.netIncome + is.taxExpense)
    : 0.225;
  const nopat = is.operatingIncome * (1 - taxRate);
  const netDebt = totalDebt - bs.cash;

  // Efficiency ratios
  const cogs = is.costOfGoodsSold || 1;
  const dso = bs.accountsReceivable > 0 ? 365 / (revenue / bs.accountsReceivable) : 0;
  const dio = bs.inventory > 0 ? 365 / (cogs / bs.inventory) : 0;
  const dpo = bs.accountsPayable > 0 ? 365 / (cogs / bs.accountsPayable) : 0;

  // ROIC
  const roic = investedCapital > 0 ? (nopat / investedCapital) * 100 : 0;

  // Altman Z-Score = 1.2×WC/TA + 1.4×RE/TA + 3.3×EBIT/TA + 0.6×MCap/TL + Rev/TA
  const wc = bs.totalCurrentAssets - bs.totalCurrentLiabilities;
  const retainedEarnings = bs.totalEquity; // Approximation
  const altmanZ = bs.totalAssets > 0
    ? 1.2 * (wc / bs.totalAssets) +
    1.4 * (retainedEarnings / bs.totalAssets) +
    3.3 * (is.operatingIncome / bs.totalAssets) +
    0.6 * (marketCap / (bs.totalLiabilities || 1)) +
    revenue / bs.totalAssets
    : 0;

  // Forward P/E (using Year 1 projected earnings as proxy)
  const eps = is.netIncome / (shares || 1);
  const forwardEPS = eps * (1 + 0.15); // Simple proxy using 15% growth

  return {
    // Profitability
    grossMargin: ((revenue - is.costOfGoodsSold) / revenue) * 100,
    ebitdaMargin: (ebitda / revenue) * 100,
    ebitMargin: (is.operatingIncome / revenue) * 100,
    netMargin: (is.netIncome / revenue) * 100,
    roe: bs.totalEquity > 0 ? (is.netIncome / bs.totalEquity) * 100 : 0,
    roa: bs.totalAssets > 0 ? (is.netIncome / bs.totalAssets) * 100 : 0,
    roic,

    // Leverage
    debtToEquity: bs.totalEquity > 0 ? totalDebt / bs.totalEquity : 0,
    netDebtToEBITDA: ebitda > 0 ? netDebt / ebitda : 0,
    interestCoverage: is.interestExpense > 0 ? is.operatingIncome / is.interestExpense : 999,

    // Liquidity
    currentRatio: bs.totalCurrentLiabilities > 0 ? bs.totalCurrentAssets / bs.totalCurrentLiabilities : 0,
    quickRatio: bs.totalCurrentLiabilities > 0
      ? (bs.cash + bs.accountsReceivable) / bs.totalCurrentLiabilities : 0,

    // Efficiency
    dso, dio, dpo,
    cashConversionCycle: dso + dio - dpo,

    // Value Creation
    eva: nopat - (investedCapital * (wacc / 100)),
    roicWACCSpread: roic - wacc,

    // Quality
    altmanZScore: altmanZ,
    piotroskiFScore: 0, // TODO: Implement 9-point scoring

    // Valuation Multiples
    trailingPE: is.netIncome > 0 ? marketCap / is.netIncome : 0,
    forwardPE: forwardEPS > 0 ? price / forwardEPS : 0,
    evEbitda: ebitda > 0 ? ev / ebitda : 0,
    evEbit: is.operatingIncome > 0 ? ev / is.operatingIncome : 0,
    evRevenue: revenue > 0 ? ev / revenue : 0,
    priceToBook: bs.totalEquity > 0 ? marketCap / bs.totalEquity : 0,
    priceToSales: revenue > 0 ? marketCap / revenue : 0,
    priceToCashFlow: cf.operatingCashFlow > 0 ? marketCap / cf.operatingCashFlow : 0,
    pegRatio: eps > 0 ? (marketCap / is.netIncome) / (15) : 0, // Growth rate proxy
    dividendYield: price > 0 ? (financialData.dividendsPerShare / price) * 100 : 0,
    earningsYield: price > 0 ? (eps / price) * 100 : 0,
    fcfYield: marketCap > 0 ? (cf.freeCashFlow / marketCap) * 100 : 0,
  };
}

// Legacy alias for compatibility
export const calculateFinancialMetrics = calculateFinancialRatios;
export type FinancialMetrics = FinancialRatios;

// ============================================
// SECTION 8 — SENSITIVITY ANALYSIS
// 5×5 WACC × Terminal Growth matrix
// ============================================

export function generateSensitivityMatrix(
  financialData: FinancialData,
  assumptions: ValuationAssumptions,
  projections: DCFProjection[],
  baseWACC: number,
  baseTerminalGrowth: number
): SensitivityMatrix {
  // C1 Fix: Dynamic axes centered on actual WACC and terminal growth
  // WACC: ±4%, ±2% steps → e.g. 21.84% to 29.84% for TechCorp (WACC=25.84%)
  const waccAxis = [baseWACC - 4, baseWACC - 2, baseWACC, baseWACC + 2, baseWACC + 4];
  // Growth: ±3%, ±1.5% steps → e.g. 5.0% to 11.0% for TechCorp (g=8%)
  // Floor at 4% (Egypt minimum), cap below WACC-1%
  const growthAxis = [-3, -1.5, 0, 1.5, 3].map(d => {
    const val = baseTerminalGrowth + d;
    return Math.max(4, Math.min(baseWACC - 1, val));
  });

  const matrix: SensitivityCell[][] = [];
  const currentPrice = financialData.currentStockPrice || 1;

  for (const waccVal of waccAxis) {
    const row: SensitivityCell[] = [];
    for (const growthVal of growthAxis) {
      if (waccVal <= growthVal) {
        row.push({
          wacc: waccVal, terminalGrowth: growthVal, impliedPrice: 0,
          upside: -100, color: 'red', isBaseCase: false,
        });
        continue;
      }

      // Recalculate with these parameters
      const waccDec = waccVal / 100;
      const growthDec = growthVal / 100;

      let sumPV = 0;
      for (let i = 0; i < projections.length; i++) {
        const df = Math.pow(1 + waccDec, i + 1); // End-of-year
        sumPV += projections[i].freeCashFlow / df;
      }

      const lastFCFF = projections[projections.length - 1]?.freeCashFlow || 0;
      const tv = (lastFCFF * (1 + growthDec)) / (waccDec - growthDec);
      const lastDF = Math.pow(1 + waccDec, projections.length);
      const pvTV = tv / lastDF;
      const ev = sumPV + pvTV;
      const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
      const equityValue = ev - totalDebt + financialData.balanceSheet.cash;
      const impliedPrice = equityValue / (financialData.sharesOutstanding || 1);

      const upside = ((impliedPrice - currentPrice) / currentPrice) * 100;
      const isBaseCase = Math.abs(waccVal - baseWACC) < 0.01 && Math.abs(growthVal - baseTerminalGrowth) < 0.01;

      let color: 'green' | 'yellow' | 'red' = 'yellow';
      if (impliedPrice > currentPrice * 1.10) color = 'green';
      else if (impliedPrice < currentPrice * 0.90) color = 'red';

      row.push({ wacc: waccVal, terminalGrowth: growthVal, impliedPrice, upside, color, isBaseCase });
    }
    matrix.push(row);
  }

  return { waccAxis, growthAxis, cells: matrix };
}

// ============================================
// SECTION 8.2 — SCENARIO ANALYSIS
// Bear/Base/Bull with probability weighting
// ============================================

export function calculateScenarioAnalysis(
  financialData: FinancialData,
  assumptions: ValuationAssumptions,
  baseIntrinsicValue: number,
): ScenarioAnalysis {
  const calculateOneScenario = (
    revGrowthDelta: number, marginDelta: number, termGrowthDelta: number, waccDelta: number, prob: number
  ): ScenarioCase => {
    const scenarioAssumptions = { ...assumptions };
    scenarioAssumptions.revenueGrowthRate = assumptions.revenueGrowthRate + revGrowthDelta;
    scenarioAssumptions.ebitdaMargin = assumptions.ebitdaMargin + marginDelta;
    scenarioAssumptions.terminalGrowthRate = assumptions.terminalGrowthRate + termGrowthDelta;
    scenarioAssumptions.discountRate = assumptions.discountRate + waccDelta;

    // Ensure g < WACC
    if (scenarioAssumptions.terminalGrowthRate >= scenarioAssumptions.discountRate) {
      scenarioAssumptions.terminalGrowthRate = scenarioAssumptions.discountRate - 1;
    }

    const projections = calculateDCFProjections(financialData, scenarioAssumptions);
    const dcfResult = calculateDCFValue(financialData, scenarioAssumptions, projections);

    return {
      revenueGrowth: scenarioAssumptions.revenueGrowthRate,
      ebitdaMargin: scenarioAssumptions.ebitdaMargin,
      terminalGrowth: scenarioAssumptions.terminalGrowthRate,
      wacc: scenarioAssumptions.discountRate,
      probability: prob,
      intrinsicValue: dcfResult.impliedSharePrice,
    };
  };

  // Section 8.2 spec: Bear (-5% rev, -3% margin, -1% g, +1% WACC)
  const bear = calculateOneScenario(-5, -3, -1, 1, assumptions.bearProbability);
  const base: ScenarioCase = {
    revenueGrowth: assumptions.revenueGrowthRate,
    ebitdaMargin: assumptions.ebitdaMargin,
    terminalGrowth: assumptions.terminalGrowthRate,
    wacc: assumptions.discountRate,
    probability: assumptions.baseProbability,
    intrinsicValue: baseIntrinsicValue,
  };
  const bull = calculateOneScenario(5, 3, 1, -1, assumptions.bullProbability);

  // Weighted Value = P(Bear)×V(Bear) + P(Base)×V(Base) + P(Bull)×V(Bull)
  const totalProb = bear.probability + base.probability + bull.probability;
  const weightedValue = totalProb > 0
    ? (bear.probability * bear.intrinsicValue +
      base.probability * base.intrinsicValue +
      bull.probability * bull.intrinsicValue) / totalProb
    : baseIntrinsicValue;

  return { bear, base, bull, weightedValue };
}

// ============================================
// SECTION 8.3 — REVERSE DCF
// Solve for implied terminal growth from market price
// ============================================

export function calculateReverseDCF(
  financialData: FinancialData,
  assumptions: ValuationAssumptions,
): ReverseDCFResult {
  const wacc = assumptions.discountRate / 100;
  const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const cash = financialData.balanceSheet.cash;
  const marketCap = financialData.currentStockPrice * financialData.sharesOutstanding;
  const observedEV = marketCap + totalDebt - cash;

  // Calculate projected FCFFs (without terminal)
  const projections = calculateDCFProjections(financialData, assumptions);
  const sumPV = projections.reduce((s, p) => s + p.presentValue, 0);

  // Required PV of TV = Observed EV - Sum PV(FCFF)
  const requiredPVTV = observedEV - sumPV;
  const lastFCFF = projections[projections.length - 1]?.freeCashFlow || 0;
  const lastDF = Math.pow(1 + wacc, assumptions.projectionYears);

  // TV = PV_TV × lastDF
  const impliedTV = requiredPVTV * lastDF;

  // TV = FCFF_N × (1+g) / (WACC-g)
  // Solve for g: g = (TV × WACC - FCFF_N) / (TV + FCFF_N)
  let impliedGrowthRate = 0;
  if (impliedTV + lastFCFF !== 0) {
    impliedGrowthRate = ((impliedTV * wacc - lastFCFF) / (impliedTV + lastFCFF)) * 100;
  }

  const baseGrowthRate = assumptions.terminalGrowthRate;
  const growthGap = impliedGrowthRate - baseGrowthRate;

  let marketExpectation: ReverseDCFResult['marketExpectation'] = 'reasonable';
  if (growthGap > 2) marketExpectation = 'aggressive';
  else if (growthGap < -2) marketExpectation = 'conservative';

  const narrative = `The market is pricing in ${impliedGrowthRate.toFixed(2)}% terminal growth. ` +
    `Your base case assumes ${baseGrowthRate.toFixed(2)}%. ` +
    `The market expectation is ${marketExpectation}.`;

  return { impliedGrowthRate, baseGrowthRate, growthGap, marketExpectation, narrative };
}

// ============================================
// AUTO-CALCULATE ASSUMPTIONS FROM FINANCIAL DATA
// ============================================

export interface AutoCalculatedAssumptions {
  beta: number;
  taxRate: number;
  revenueGrowth: number;
  fcfMargin: number;
  costOfDebt: number;
  calculatedWACC: number;
}

export function calculateAssumptionsFromData(
  financialData: FinancialData,
  marketRegion: MarketRegion,
  apiBeta?: number
): AutoCalculatedAssumptions {
  const { incomeStatement, balanceSheet, cashFlowStatement, currentStockPrice, sharesOutstanding } = financialData;

  const defaultBeta = marketRegion === 'Egypt' ? 1.2 : 1.0;
  const beta = apiBeta || defaultBeta;

  const marketDefaults = MARKET_DEFAULTS[marketRegion];
  const incomeBeforeTax = incomeStatement.netIncome + incomeStatement.taxExpense;
  let taxRate = marketDefaults.defaultTaxRate;

  if (incomeBeforeTax > 0 && incomeStatement.taxExpense > 0) {
    const calculatedRate = (incomeStatement.taxExpense / incomeBeforeTax) * 100;
    taxRate = Math.min(45, Math.max(0, calculatedRate));
  }

  const fcfMargin = incomeStatement.revenue > 0
    ? (cashFlowStatement.freeCashFlow / incomeStatement.revenue) * 100
    : 15;

  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const minCostOfDebt = marketRegion === 'Egypt' ? 20 : 4;
  const maxCostOfDebt = marketRegion === 'Egypt' ? 35 : 15;
  let costOfDebt = marketRegion === 'Egypt' ? 25 : 6;

  if (totalDebt > 0 && incomeStatement.interestExpense > 0) {
    costOfDebt = (incomeStatement.interestExpense / totalDebt) * 100;
    costOfDebt = Math.min(maxCostOfDebt, Math.max(minCostOfDebt, costOfDebt));
  }

  const marketCap = currentStockPrice * sharesOutstanding;

  const waccResult = calculateWACC({
    marketCap, totalDebt,
    riskFreeRate: marketDefaults.riskFreeRate,
    beta,
    marketRiskPremium: marketDefaults.marketRiskPremium,
    costOfDebt, taxRate,
    capmMethod: 'A',
  });

  return {
    beta, taxRate: Math.round(taxRate * 10) / 10,
    revenueGrowth: marketRegion === 'Egypt' ? 15 : 8,
    fcfMargin: Math.round(fcfMargin * 10) / 10,
    costOfDebt: Math.round(costOfDebt * 10) / 10,
    calculatedWACC: Math.round(waccResult.wacc * 10) / 10,
  };
}

// ============================================
// SECTION 10 — INPUT VALIDATION
// ============================================

export function validateInputs(
  financialData: FinancialData,
  assumptions: ValuationAssumptions,
  marketRegion: MarketRegion
): ValidationAlert[] {
  const alerts: ValidationAlert[] = [];

  // Revenue must be > 0
  if (financialData.incomeStatement.revenue <= 0) {
    alerts.push({ type: 'error', message: 'Revenue must be positive', field: 'revenue', blocking: true });
  }

  // EBITDA can be negative (warning only)
  const ebitda = financialData.incomeStatement.operatingIncome + financialData.incomeStatement.depreciation + financialData.incomeStatement.amortization;
  if (ebitda < 0) {
    alerts.push({ type: 'warning', message: 'Negative EBITDA — company is operationally unprofitable', field: 'ebitda' });
  }

  // Tax rate 0-60%
  if (assumptions.taxRate < 0 || assumptions.taxRate > 60) {
    alerts.push({ type: 'error', message: 'Tax rate outside valid range (0%–60%)', field: 'taxRate', blocking: true });
  }

  // Beta -1 to 5
  if (assumptions.beta < -1 || assumptions.beta > 5) {
    alerts.push({ type: 'warning', message: 'Beta outside normal range (-1 to 5). Verify input.', field: 'beta' });
  }

  // Terminal growth < WACC (HARD BLOCK)
  if (assumptions.terminalGrowthRate >= assumptions.discountRate) {
    alerts.push({
      type: 'error', blocking: true,
      message: `Terminal growth rate (${assumptions.terminalGrowthRate}%) must be less than WACC (${assumptions.discountRate}%). Reduce terminal growth or increase WACC.`,
      field: 'terminalGrowthRate',
    });
  }

  // Terminal growth > 10% (soft warning)
  if (assumptions.terminalGrowthRate > 10) {
    alerts.push({
      type: 'warning',
      message: `Terminal growth exceeds 10%. For Egypt, long-term nominal GDP growth is typically 8-12%.`,
      field: 'terminalGrowthRate',
    });
  }

  // Shares outstanding > 0
  if (financialData.sharesOutstanding <= 0) {
    alerts.push({ type: 'error', message: 'Shares outstanding must be positive', field: 'sharesOutstanding', blocking: true });
  }

  // Share price >= 0
  if (financialData.currentStockPrice < 0) {
    alerts.push({ type: 'error', message: 'Price cannot be negative', field: 'currentStockPrice', blocking: true });
  }

  // ERP 0-20%
  if (assumptions.marketRiskPremium < 0 || assumptions.marketRiskPremium > 20) {
    alerts.push({ type: 'warning', message: 'Equity risk premium outside expected range (0%–20%)', field: 'marketRiskPremium' });
  }

  // Risk-free rate 0-40%
  if (assumptions.riskFreeRate < 0 || assumptions.riskFreeRate > 40) {
    alerts.push({ type: 'warning', message: 'Risk-free rate outside expected Egypt range (0%–40%)', field: 'riskFreeRate' });
  }

  // Cost of debt 0-50%
  if (assumptions.costOfDebt <= 0 || assumptions.costOfDebt > 50) {
    alerts.push({ type: 'warning', message: 'Cost of debt outside expected Egypt range (0%–50%)', field: 'costOfDebt' });
  }

  // CapEx < D&A
  if (assumptions.capexPercent < assumptions.daPercent) {
    alerts.push({ type: 'warning', message: 'CapEx below D&A — potential underinvestment signal', field: 'capexPercent' });
  }

  // Interest > EBIT
  if (financialData.incomeStatement.interestExpense > financialData.incomeStatement.operatingIncome) {
    alerts.push({ type: 'warning', message: 'Company cannot cover interest — financial distress risk', field: 'interestExpense' });
  }

  // Market Cap < Debt
  const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const marketCap = financialData.currentStockPrice * financialData.sharesOutstanding;
  if (marketCap < totalDebt) {
    alerts.push({ type: 'warning', message: 'Company is technically overleveraged at market values.' });
  }

  // Cash > Debt (net cash position)
  if (financialData.balanceSheet.cash > totalDebt) {
    alerts.push({ type: 'info', message: 'Net cash position — Equity Value > Enterprise Value.' });
  }

  // Egypt currency risk
  if (marketRegion === 'Egypt') {
    alerts.push({
      type: 'info',
      message: 'EGP Currency Risk: Consider exchange rate volatility.',
    });
  }

  return alerts;
}

// Legacy alias
export const validateAssumptions = validateInputs;
