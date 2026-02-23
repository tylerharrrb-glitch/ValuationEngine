// ============================================
// WOLF VALUATION ENGINE
// Professional-grade financial valuation calculations
// Following industry-standard financial modeling practices
// ============================================

import { FinancialData, ValuationAssumptions, ComparableCompany, DCFProjection } from '../types/financial';

// ============================================
// MARKET REGION DEFAULTS
// ============================================
export type MarketRegion = 'USA' | 'Egypt';

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
    riskFreeRate: 4.5,              // 10-Year US Treasury Yield (2024-2025)
    marketRiskPremium: 5.5,          // Historical US equity risk premium
    terminalGrowthRate: 2.5,         // Long-term US GDP growth proxy
    maxTerminalGrowth: 3.0,          // Cap at 3% for developed markets
    defaultTaxRate: 21.0,            // US Federal Corporate Tax Rate
    currency: 'USD',
    currencySymbol: '$',
    label: '🇺🇸 USA',
    description: 'United States - Developed Market',
    riskFreeDescription: '10-Year US Treasury Bond Yield',
    countryRiskPremium: 0,           // No additional country risk for US
  },
  Egypt: {
    riskFreeRate: 27.25,             // Egyptian Central Bank Rate (Jan 2025)
    marketRiskPremium: 10.0,         // Higher premium for emerging market
    terminalGrowthRate: 5.0,         // Higher due to inflation
    maxTerminalGrowth: 8.0,          // Cap at 8% for high-inflation emerging markets
    defaultTaxRate: 22.5,            // Egyptian Corporate Tax Rate
    currency: 'EGP',
    currencySymbol: 'EGP',
    label: '🇪🇬 Egypt',
    description: 'Egypt - Emerging Market (EGX)',
    riskFreeDescription: 'Egyptian T-Bill Rate (91-Day)',
    countryRiskPremium: 4.5,         // Additional country risk premium for Egypt
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
  // Egyptian Banks
  'Banking': { peRatio: 5.5, evEbitda: 4.0, psRatio: 2.0, pbRatio: 1.2 },
  // Egyptian Telecom
  'Telecom': { peRatio: 8.0, evEbitda: 4.5, psRatio: 1.5, pbRatio: 1.8 },
  // Egyptian Consumer/Food
  'Consumer': { peRatio: 12.0, evEbitda: 7.0, psRatio: 1.2, pbRatio: 2.5 },
  // Egyptian Real Estate
  'Real Estate': { peRatio: 6.0, evEbitda: 8.0, psRatio: 2.0, pbRatio: 0.8 },
  // Egyptian Industrial
  'Industrial': { peRatio: 7.0, evEbitda: 5.0, psRatio: 0.8, pbRatio: 1.0 },
  // Egyptian Healthcare
  'Healthcare': { peRatio: 15.0, evEbitda: 9.0, psRatio: 2.5, pbRatio: 3.0 },
  // Default Egyptian multiples (market average)
  'Default': { peRatio: 7.0, evEbitda: 5.0, psRatio: 1.2, pbRatio: 1.5 },
};

// Egyptian peer groups for different sectors
export const EGYPTIAN_INDUSTRY_PEERS: Record<string, string[]> = {
  // Egyptian Banks
  'CIB': ['COMI.CA', 'QNBA.CA', 'ADIB.CA', 'FAISAL.CA'],
  'COMI.CA': ['QNBA.CA', 'ADIB.CA', 'FAISAL.CA', 'SAIB.CA'],
  // Egyptian Telecom
  'ETEL.CA': ['VODAFONE.CA', 'ORANGE.CA'],
  'Telecom Egypt': ['VODAFONE.CA', 'ORANGE.CA'],
  // Egyptian Food
  'EFID.CA': ['JUFO.CA', 'ISPH.CA', 'DOMTY.CA'],
  'Edita': ['JUFO.CA', 'ISPH.CA', 'DOMTY.CA'],
  // Egyptian Real Estate
  'TMGH.CA': ['PHDC.CA', 'EMFD.CA', 'MNHD.CA'],
  'Palm Hills': ['TMGH.CA', 'EMFD.CA', 'MNHD.CA'],
  // Default Egyptian peers (major EGX companies)
  'DEFAULT_EG': ['COMI.CA', 'ETEL.CA', 'EFID.CA', 'EAST.CA', 'TMGH.CA'],
};

// ============================================
// WACC CALCULATION (Weighted Average Cost of Capital)
// Formula: WACC = (E/V) × Re + (D/V) × Rd × (1 - Tc)
// Where:
//   E = Market value of equity
//   D = Market value of debt
//   V = E + D (total capital)
//   Re = Cost of equity (CAPM)
//   Rd = Cost of debt
//   Tc = Corporate tax rate
// ============================================

export interface WACCInputs {
  marketCap: number;           // Market value of equity
  totalDebt: number;           // Total debt (short + long term)
  riskFreeRate: number;        // Risk-free rate (%)
  beta: number;                // Company beta
  marketRiskPremium: number;   // Equity risk premium (%)
  costOfDebt: number;          // Pre-tax cost of debt (%)
  taxRate: number;             // Corporate tax rate (%)
}

export interface WACCResult {
  costOfEquity: number;        // CAPM result (%)
  afterTaxCostOfDebt: number;  // Cost of debt after tax shield (%)
  equityWeight: number;        // E/V (%)
  debtWeight: number;          // D/V (%)
  wacc: number;                // Final WACC (%)
}

export function calculateWACC(inputs: WACCInputs): WACCResult {
  const { marketCap, totalDebt, riskFreeRate, beta, marketRiskPremium, costOfDebt, taxRate } = inputs;
  
  // Step 1: Calculate Cost of Equity using CAPM
  // Re = Rf + β × (Rm - Rf)
  // Where (Rm - Rf) is the market risk premium
  const costOfEquity = riskFreeRate + (beta * marketRiskPremium);
  
  // Step 2: Calculate After-Tax Cost of Debt
  // Rd × (1 - Tc)
  const afterTaxCostOfDebt = costOfDebt * (1 - taxRate / 100);
  
  // Step 3: Calculate Capital Structure Weights
  const totalCapital = marketCap + totalDebt;
  const equityWeight = totalCapital > 0 ? (marketCap / totalCapital) * 100 : 100;
  const debtWeight = totalCapital > 0 ? (totalDebt / totalCapital) * 100 : 0;
  
  // Step 4: Calculate WACC
  // WACC = (E/V) × Re + (D/V) × Rd × (1 - Tc)
  const wacc = (equityWeight / 100) * costOfEquity + (debtWeight / 100) * afterTaxCostOfDebt;
  
  return {
    costOfEquity,
    afterTaxCostOfDebt,
    equityWeight,
    debtWeight,
    wacc,
  };
}

// ============================================
// DCF PROJECTION CALCULATION
// Projects Free Cash Flow for each year and calculates present values
// ============================================

export function calculateDCFProjections(
  financialData: FinancialData,
  assumptions: ValuationAssumptions
): DCFProjection[] {
  const projections: DCFProjection[] = [];
  
  // Starting values
  let currentRevenue = financialData.incomeStatement.revenue;
  
  // Calculate base FCF margin = FCF / Revenue
  const baseFCFMargin = financialData.incomeStatement.revenue > 0 
    ? financialData.cashFlowStatement.freeCashFlow / financialData.incomeStatement.revenue 
    : 0.15; // Default 15% if no data
  
  // Calculate base EBITDA margin
  const baseEBITDA = financialData.incomeStatement.operatingIncome + 
    financialData.incomeStatement.depreciation + 
    financialData.incomeStatement.amortization;
  const baseEBITDAMargin = financialData.incomeStatement.revenue > 0
    ? baseEBITDA / financialData.incomeStatement.revenue
    : 0.20; // Default 20% if no data
  
  for (let year = 1; year <= assumptions.projectionYears; year++) {
    // Project Revenue with growth rate
    // Revenue(t) = Revenue(t-1) × (1 + g)
    currentRevenue = currentRevenue * (1 + assumptions.revenueGrowthRate / 100);
    
    // Apply margin improvement (additive, not multiplicative)
    const currentFCFMargin = baseFCFMargin + (assumptions.marginImprovement / 100) * year;
    const currentEBITDAMargin = baseEBITDAMargin + (assumptions.marginImprovement / 100) * year;
    
    // Calculate EBITDA and FCF
    const ebitda = currentRevenue * currentEBITDAMargin;
    const freeCashFlow = currentRevenue * currentFCFMargin;
    
    // Calculate Discount Factor
    // DF = 1 / (1 + WACC)^t
    // Using mid-year convention for more accurate DCF
    const midYearPeriod = year - 0.5; // Mid-year convention
    const discountFactor = Math.pow(1 + assumptions.discountRate / 100, midYearPeriod);
    
    // Calculate Present Value
    // PV = FCF / DF
    const presentValue = freeCashFlow / discountFactor;
    
    projections.push({
      year: new Date().getFullYear() + year,
      revenue: currentRevenue,
      ebitda: ebitda,
      freeCashFlow: freeCashFlow,
      discountFactor: discountFactor,
      presentValue: presentValue,
    });
  }
  
  return projections;
}

// ============================================
// DCF VALUATION CALCULATION
// Calculates Enterprise Value and Implied Share Price
// ============================================

export interface DCFResult {
  sumOfPresentValues: number;      // Sum of projected FCF present values
  terminalValue: number;           // Terminal Value (Gordon Growth Model)
  presentValueOfTerminal: number;  // PV of Terminal Value
  enterpriseValue: number;         // Total Enterprise Value
  equityValue: number;             // Equity Value = EV - Debt + Cash
  impliedSharePrice: number;       // Equity Value / Shares Outstanding
  upside: number;                  // Upside/Downside percentage
}

export function calculateDCFValue(
  financialData: FinancialData,
  assumptions: ValuationAssumptions,
  projections: DCFProjection[]
): DCFResult {
  // Validate inputs
  if (projections.length === 0) {
    return {
      sumOfPresentValues: 0,
      terminalValue: 0,
      presentValueOfTerminal: 0,
      enterpriseValue: 0,
      equityValue: 0,
      impliedSharePrice: 0,
      upside: 0,
    };
  }
  
  // Step 1: Sum of Present Values of projected FCFs
  const sumOfPresentValues = projections.reduce((sum, p) => sum + p.presentValue, 0);
  
  // Step 2: Terminal Value using Gordon Growth Model
  // TV = FCF(n) × (1 + g) / (WACC - g)
  // Where:
  //   FCF(n) = Free Cash Flow in final projection year
  //   g = Terminal (perpetual) growth rate
  //   WACC = Weighted Average Cost of Capital
  
  const lastYearFCF = projections[projections.length - 1].freeCashFlow;
  const wacc = assumptions.discountRate / 100;
  const terminalGrowth = assumptions.terminalGrowthRate / 100;
  
  // Validate: WACC must be greater than terminal growth rate
  // Otherwise, Gordon Growth Model gives infinite/negative value
  let terminalValue = 0;
  if (wacc > terminalGrowth && wacc - terminalGrowth > 0.001) {
    terminalValue = (lastYearFCF * (1 + terminalGrowth)) / (wacc - terminalGrowth);
  } else {
    // Fallback: Use exit multiple method (15x FCF)
    terminalValue = lastYearFCF * 15;
    console.warn('[WOLF Valuation] Warning: WACC <= Terminal Growth. Using exit multiple method.');
  }
  
  // Step 3: Present Value of Terminal Value
  // Using end-of-period discounting for terminal value
  const lastDiscountFactor = Math.pow(1 + wacc, assumptions.projectionYears);
  const presentValueOfTerminal = terminalValue / lastDiscountFactor;
  
  // Step 4: Enterprise Value
  // EV = Sum of PV(FCFs) + PV(Terminal Value)
  const enterpriseValue = sumOfPresentValues + presentValueOfTerminal;
  
  // Step 5: Equity Value
  // Equity Value = Enterprise Value - Total Debt + Cash
  const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const cash = financialData.balanceSheet.cash;
  const equityValue = Math.max(enterpriseValue - totalDebt + cash, 0);
  
  // Step 6: Implied Share Price
  // Share Price = Equity Value / Shares Outstanding
  const sharesOutstanding = financialData.sharesOutstanding || 1;
  const impliedSharePrice = equityValue / sharesOutstanding;
  
  // Step 7: Calculate Upside/Downside
  // Upside = (Implied Price - Current Price) / Current Price × 100
  const currentPrice = financialData.currentStockPrice || 0;
  const upside = currentPrice > 0 
    ? ((impliedSharePrice - currentPrice) / currentPrice) * 100 
    : 0;
  
  return {
    sumOfPresentValues,
    terminalValue,
    presentValueOfTerminal,
    enterpriseValue,
    equityValue,
    impliedSharePrice,
    upside,
  };
}

// ============================================
// COMPARABLE COMPANY VALUATION
// Uses peer multiples to derive implied share prices
// ============================================

export interface ComparableResult {
  peImpliedPrice: number;        // Implied price from P/E multiple
  evEbitdaImpliedPrice: number;  // Implied price from EV/EBITDA
  psImpliedPrice: number;        // Implied price from P/S
  pbImpliedPrice: number;        // Implied price from P/B
  averageImpliedPrice: number;   // Average of all methods
  medianMultiples: {
    pe: number;
    evEbitda: number;
    ps: number;
    pb: number;
  };
}

export function calculateComparableValue(
  financialData: FinancialData,
  comparables: ComparableCompany[]
): ComparableResult {
  const defaultResult: ComparableResult = {
    peImpliedPrice: 0,
    evEbitdaImpliedPrice: 0,
    psImpliedPrice: 0,
    pbImpliedPrice: 0,
    averageImpliedPrice: 0,
    medianMultiples: { pe: 0, evEbitda: 0, ps: 0, pb: 0 },
  };
  
  if (comparables.length === 0) return defaultResult;
  
  // Helper to calculate median
  const median = (arr: number[]): number => {
    const filtered = arr.filter(x => x > 0);
    if (filtered.length === 0) return 0;
    const sorted = [...filtered].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };
  
  // Calculate median multiples (more robust than average)
  const medianMultiples = {
    pe: median(comparables.map(c => c.peRatio)),
    evEbitda: median(comparables.map(c => c.evEbitda)),
    ps: median(comparables.map(c => c.psRatio)),
    pb: median(comparables.map(c => c.pbRatio)),
  };
  
  const { incomeStatement, balanceSheet, sharesOutstanding } = financialData;
  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const cash = balanceSheet.cash;
  
  // 1. P/E Implied Price
  // Implied Market Cap = EPS × Peer P/E
  // Implied Price = Implied Market Cap / Shares
  const eps = incomeStatement.netIncome / sharesOutstanding;
  const peImpliedPrice = eps > 0 ? eps * medianMultiples.pe : 0;
  
  // 2. EV/EBITDA Implied Price
  // Implied EV = EBITDA × Peer EV/EBITDA
  // Implied Equity = Implied EV - Debt + Cash
  // Implied Price = Implied Equity / Shares
  const ebitda = incomeStatement.operatingIncome + incomeStatement.depreciation + incomeStatement.amortization;
  let evEbitdaImpliedPrice = 0;
  if (ebitda > 0 && medianMultiples.evEbitda > 0) {
    const impliedEV = ebitda * medianMultiples.evEbitda;
    const impliedEquity = Math.max(impliedEV - totalDebt + cash, 0);
    evEbitdaImpliedPrice = impliedEquity / sharesOutstanding;
  }
  
  // 3. P/S Implied Price
  // Implied Market Cap = Revenue / Shares × Peer P/S
  const revenuePerShare = incomeStatement.revenue / sharesOutstanding;
  const psImpliedPrice = revenuePerShare > 0 ? revenuePerShare * medianMultiples.ps : 0;
  
  // 4. P/B Implied Price
  // Implied Price = Book Value per Share × Peer P/B
  const bookValuePerShare = balanceSheet.totalEquity / sharesOutstanding;
  const pbImpliedPrice = bookValuePerShare > 0 ? bookValuePerShare * medianMultiples.pb : 0;
  
  // Calculate average (only including positive values)
  const validPrices = [peImpliedPrice, evEbitdaImpliedPrice, psImpliedPrice, pbImpliedPrice].filter(p => p > 0);
  const averageImpliedPrice = validPrices.length > 0 
    ? validPrices.reduce((a, b) => a + b, 0) / validPrices.length 
    : 0;
  
  return {
    peImpliedPrice,
    evEbitdaImpliedPrice,
    psImpliedPrice,
    pbImpliedPrice,
    averageImpliedPrice,
    medianMultiples,
  };
}

// ============================================
// BLENDED VALUATION
// Combines DCF and Comparable methods with weights
// ============================================

export interface BlendedValuationResult {
  dcfValue: number;
  dcfWeight: number;
  comparableValue: number;
  comparableWeight: number;
  blendedValue: number;
  upside: number;
  recommendation: {
    text: string;
    color: string;
    bg: string;
  };
}

export function calculateBlendedValuation(
  dcfValue: number,
  comparableValue: number,
  currentPrice: number,
  dcfWeight: number = 0.6,  // Default 60% DCF
  comparableWeight: number = 0.4  // Default 40% Comps
): BlendedValuationResult {
  // Check if comparables have valid data
  // If comparableValue is 0 or invalid, use 100% DCF
  const hasValidComps = comparableValue > 0 && isFinite(comparableValue);
  
  let effectiveDCFWeight: number;
  let effectiveCompsWeight: number;
  let blendedValue: number;
  
  if (!hasValidComps) {
    // No valid comps - use 100% DCF
    effectiveDCFWeight = 100;
    effectiveCompsWeight = 0;
    blendedValue = dcfValue;
  } else {
    // Normalize weights
    const totalWeight = dcfWeight + comparableWeight;
    effectiveDCFWeight = (dcfWeight / totalWeight) * 100;
    effectiveCompsWeight = (comparableWeight / totalWeight) * 100;
    
    // Calculate blended value
    blendedValue = (dcfValue * (effectiveDCFWeight / 100)) + (comparableValue * (effectiveCompsWeight / 100));
  }
  
  // Calculate upside/downside
  // Upside = (Blended Value - Current Price) / Current Price × 100
  const upside = currentPrice > 0 
    ? ((blendedValue - currentPrice) / currentPrice) * 100 
    : 0;
  
  // Generate recommendation based on upside
  let recommendation: { text: string; color: string; bg: string };
  if (upside > 25) {
    recommendation = { text: 'STRONG BUY', color: 'text-green-400', bg: 'bg-green-500/20' };
  } else if (upside > 10) {
    recommendation = { text: 'BUY', color: 'text-green-400', bg: 'bg-green-500/20' };
  } else if (upside > -10) {
    recommendation = { text: 'HOLD', color: 'text-yellow-400', bg: 'bg-yellow-500/20' };
  } else if (upside > -25) {
    recommendation = { text: 'SELL', color: 'text-red-400', bg: 'bg-red-500/20' };
  } else {
    recommendation = { text: 'STRONG SELL', color: 'text-red-400', bg: 'bg-red-500/20' };
  }
  
  return {
    dcfValue,
    dcfWeight: effectiveDCFWeight,
    comparableValue: hasValidComps ? comparableValue : 0,
    comparableWeight: effectiveCompsWeight,
    blendedValue,
    upside,
    recommendation,
  };
}

// ============================================
// KEY FINANCIAL METRICS
// Calculates all important financial ratios
// ============================================

export interface FinancialMetrics {
  // Profitability
  grossMargin: number;
  operatingMargin: number;
  netMargin: number;
  ebitdaMargin: number;
  
  // Returns
  roe: number;                // Return on Equity
  roa: number;                // Return on Assets
  roic: number;               // Return on Invested Capital
  
  // Valuation
  peRatio: number;
  evEbitda: number;
  evSales: number;
  pbRatio: number;
  priceToSales: number;
  
  // Liquidity
  currentRatio: number;
  quickRatio: number;
  
  // Leverage
  debtToEquity: number;
  debtToAssets: number;
  interestCoverage: number;
  
  // Cash Flow
  fcfYield: number;
  fcfMargin: number;
  operatingCFToDebt: number;
}

export function calculateFinancialMetrics(financialData: FinancialData): FinancialMetrics {
  const { incomeStatement, balanceSheet, cashFlowStatement, currentStockPrice, sharesOutstanding } = financialData;
  
  const revenue = incomeStatement.revenue || 1;
  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const marketCap = currentStockPrice * sharesOutstanding;
  const ebitda = incomeStatement.operatingIncome + incomeStatement.depreciation + incomeStatement.amortization;
  const ev = marketCap + totalDebt - balanceSheet.cash;
  const investedCapital = balanceSheet.totalEquity + totalDebt - balanceSheet.cash;
  
  // Calculate NOPAT (Net Operating Profit After Tax)
  // Assuming 21% tax rate if not calculable
  const taxRate = incomeStatement.netIncome > 0 && incomeStatement.taxExpense > 0
    ? incomeStatement.taxExpense / (incomeStatement.netIncome + incomeStatement.taxExpense)
    : 0.21;
  const nopat = incomeStatement.operatingIncome * (1 - taxRate);
  
  return {
    // Profitability
    grossMargin: ((revenue - incomeStatement.costOfGoodsSold) / revenue) * 100,
    operatingMargin: (incomeStatement.operatingIncome / revenue) * 100,
    netMargin: (incomeStatement.netIncome / revenue) * 100,
    ebitdaMargin: (ebitda / revenue) * 100,
    
    // Returns
    roe: balanceSheet.totalEquity > 0 ? (incomeStatement.netIncome / balanceSheet.totalEquity) * 100 : 0,
    roa: balanceSheet.totalAssets > 0 ? (incomeStatement.netIncome / balanceSheet.totalAssets) * 100 : 0,
    roic: investedCapital > 0 ? (nopat / investedCapital) * 100 : 0,
    
    // Valuation
    peRatio: incomeStatement.netIncome > 0 ? marketCap / incomeStatement.netIncome : 0,
    evEbitda: ebitda > 0 ? ev / ebitda : 0,
    evSales: revenue > 0 ? ev / revenue : 0,
    pbRatio: balanceSheet.totalEquity > 0 ? marketCap / balanceSheet.totalEquity : 0,
    priceToSales: revenue > 0 ? marketCap / revenue : 0,
    
    // Liquidity
    currentRatio: balanceSheet.totalCurrentLiabilities > 0 
      ? balanceSheet.totalCurrentAssets / balanceSheet.totalCurrentLiabilities 
      : 0,
    quickRatio: balanceSheet.totalCurrentLiabilities > 0
      ? (balanceSheet.cash + balanceSheet.accountsReceivable) / balanceSheet.totalCurrentLiabilities
      : 0,
    
    // Leverage
    debtToEquity: balanceSheet.totalEquity > 0 ? totalDebt / balanceSheet.totalEquity : 0,
    debtToAssets: balanceSheet.totalAssets > 0 ? totalDebt / balanceSheet.totalAssets : 0,
    interestCoverage: incomeStatement.interestExpense > 0 
      ? incomeStatement.operatingIncome / incomeStatement.interestExpense 
      : 999,
    
    // Cash Flow
    fcfYield: marketCap > 0 ? (cashFlowStatement.freeCashFlow / marketCap) * 100 : 0,
    fcfMargin: (cashFlowStatement.freeCashFlow / revenue) * 100,
    operatingCFToDebt: totalDebt > 0 ? cashFlowStatement.operatingCashFlow / totalDebt : 999,
  };
}

// ============================================
// AUTO-CALCULATE ASSUMPTIONS FROM FINANCIAL DATA
// Used when fetching stock data to set intelligent defaults
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
  
  // Beta: Use API value or default based on region
  // Egyptian stocks typically have higher beta due to emerging market volatility
  const defaultBeta = marketRegion === 'Egypt' ? 1.2 : 1.0;
  const beta = apiBeta || defaultBeta;
  
  // Tax Rate: Calculate from Income Statement or use regional default
  // Tax Rate = Tax Expense / (Net Income + Tax Expense)
  const marketDefaults = MARKET_DEFAULTS[marketRegion];
  const incomeBeforeTax = incomeStatement.netIncome + incomeStatement.taxExpense;
  let taxRate = marketDefaults.defaultTaxRate;
  
  if (incomeBeforeTax > 0 && incomeStatement.taxExpense > 0) {
    const calculatedRate = (incomeStatement.taxExpense / incomeBeforeTax) * 100;
    // Cap between 0% and 45%
    taxRate = Math.min(45, Math.max(0, calculatedRate));
  }
  
  // FCF Margin
  const fcfMargin = incomeStatement.revenue > 0
    ? (cashFlowStatement.freeCashFlow / incomeStatement.revenue) * 100
    : 15;
  
  // Cost of Debt: Interest Expense / Total Debt
  // For Egypt, minimum cost of debt should be higher due to high interest rates
  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const minCostOfDebt = marketRegion === 'Egypt' ? 20 : 4;
  const maxCostOfDebt = marketRegion === 'Egypt' ? 35 : 15;
  let costOfDebt = marketRegion === 'Egypt' ? 25 : 6; // Default based on region
  
  if (totalDebt > 0 && incomeStatement.interestExpense > 0) {
    costOfDebt = (incomeStatement.interestExpense / totalDebt) * 100;
    // Cap based on region
    costOfDebt = Math.min(maxCostOfDebt, Math.max(minCostOfDebt, costOfDebt));
  }
  
  // Calculate WACC with regional parameters
  const marketCap = currentStockPrice * sharesOutstanding;
  
  const waccResult = calculateWACC({
    marketCap,
    totalDebt,
    riskFreeRate: marketDefaults.riskFreeRate,
    beta,
    marketRiskPremium: marketDefaults.marketRiskPremium,
    costOfDebt,
    taxRate,
  });
  
  return {
    beta,
    taxRate: Math.round(taxRate * 10) / 10,
    revenueGrowth: marketRegion === 'Egypt' ? 15 : 8, // Higher default growth for Egypt (nominal, includes inflation)
    fcfMargin: Math.round(fcfMargin * 10) / 10,
    costOfDebt: Math.round(costOfDebt * 10) / 10,
    calculatedWACC: Math.round(waccResult.wacc * 10) / 10,
  };
}

// ============================================
// VALIDATION ALERTS FOR DIFFERENT MARKETS
// ============================================

export interface ValidationAlert {
  type: 'error' | 'warning' | 'info';
  message: string;
  field?: string;
}

export function validateAssumptions(
  assumptions: ValuationAssumptions,
  marketRegion: MarketRegion
): ValidationAlert[] {
  const alerts: ValidationAlert[] = [];
  const config = MARKET_DEFAULTS[marketRegion];
  
  // WACC < Risk-Free Rate (impossible)
  if (assumptions.discountRate < config.riskFreeRate) {
    alerts.push({
      type: 'error',
      message: `WACC (${assumptions.discountRate}%) is below the risk-free rate (${config.riskFreeRate}%). This is mathematically impossible.`,
      field: 'discountRate'
    });
  }
  
  // Terminal Growth >= WACC (infinite value)
  if (assumptions.terminalGrowthRate >= assumptions.discountRate) {
    alerts.push({
      type: 'error',
      message: `Terminal growth rate (${assumptions.terminalGrowthRate}%) must be less than WACC (${assumptions.discountRate}%). Current settings create infinite value.`,
      field: 'terminalGrowthRate'
    });
  }
  
  // Terminal Growth too high for market
  if (assumptions.terminalGrowthRate > config.maxTerminalGrowth) {
    const message = marketRegion === 'Egypt'
      ? `Terminal growth of ${assumptions.terminalGrowthRate}% is very high. For Egypt (high inflation), consider 4-7% as sustainable.`
      : `Terminal growth of ${assumptions.terminalGrowthRate}% exceeds sustainable long-term GDP growth (~3%). Consider lowering.`;
    alerts.push({
      type: 'warning',
      message,
      field: 'terminalGrowthRate'
    });
  }
  
  // Revenue Growth warnings
  if (marketRegion === 'Egypt' && assumptions.revenueGrowthRate > 30) {
    alerts.push({
      type: 'warning',
      message: `Revenue growth of ${assumptions.revenueGrowthRate}% is very aggressive even for Egypt's high-inflation environment.`,
      field: 'revenueGrowthRate'
    });
  } else if (marketRegion === 'USA' && assumptions.revenueGrowthRate > 15) {
    alerts.push({
      type: 'warning',
      message: `Revenue growth of ${assumptions.revenueGrowthRate}% is very aggressive for a mature US company.`,
      field: 'revenueGrowthRate'
    });
  }
  
  // Market Risk Premium validation for Egypt
  if (marketRegion === 'Egypt' && assumptions.marketRiskPremium < 8) {
    alerts.push({
      type: 'warning',
      message: `Market risk premium of ${assumptions.marketRiskPremium}% may be too low for Egypt. Emerging markets typically require 8-12% MRP.`,
      field: 'marketRiskPremium'
    });
  }
  
  // Egypt currency risk warning
  if (marketRegion === 'Egypt') {
    alerts.push({
      type: 'info',
      message: `⚠️ EGP Currency Risk: Consider exchange rate volatility when comparing to USD-based valuations. The EGP has experienced significant devaluation.`
    });
  }
  
  return alerts;
}

// ============================================
// SENSITIVITY ANALYSIS
// Generates a matrix of share prices for different WACC and growth combinations
// ============================================

export interface SensitivityCell {
  wacc: number;
  terminalGrowth: number;
  impliedPrice: number;
  upside: number;
}

export function generateSensitivityMatrix(
  financialData: FinancialData,
  projections: DCFProjection[],
  baseWACC: number,
  baseTerminalGrowth: number
): SensitivityCell[][] {
  // Generate range around base values
  const waccRange = [baseWACC - 2, baseWACC - 1, baseWACC, baseWACC + 1, baseWACC + 2];
  const growthRange = [baseTerminalGrowth - 1, baseTerminalGrowth - 0.5, baseTerminalGrowth, baseTerminalGrowth + 0.5, baseTerminalGrowth + 1];
  
  const matrix: SensitivityCell[][] = [];
  
  for (const wacc of waccRange) {
    const row: SensitivityCell[] = [];
    for (const growth of growthRange) {
      // Skip invalid combinations (WACC must be > terminal growth)
      if (wacc <= growth) {
        row.push({ wacc, terminalGrowth: growth, impliedPrice: 0, upside: -100 });
        continue;
      }
      
      // Recalculate DCF with these parameters
      const sumPV = projections.reduce((sum, p, idx) => {
        const df = Math.pow(1 + wacc / 100, idx + 0.5);
        return sum + p.freeCashFlow / df;
      }, 0);
      
      const lastFCF = projections[projections.length - 1]?.freeCashFlow || 0;
      const tv = (lastFCF * (1 + growth / 100)) / ((wacc - growth) / 100);
      const lastDF = Math.pow(1 + wacc / 100, projections.length);
      const ev = sumPV + tv / lastDF;
      
      const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
      const equity = Math.max(ev - totalDebt + financialData.balanceSheet.cash, 0);
      const impliedPrice = equity / financialData.sharesOutstanding;
      const upside = ((impliedPrice - financialData.currentStockPrice) / financialData.currentStockPrice) * 100;
      
      row.push({ wacc, terminalGrowth: growth, impliedPrice, upside });
    }
    matrix.push(row);
  }
  
  return matrix;
}
