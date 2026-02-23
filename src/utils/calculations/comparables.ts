/**
 * Comparable company valuation utilities.
 * Calculates implied values from peer multiples (P/E, EV/EBITDA, P/S, P/B).
 */
import { FinancialData, ComparableCompany } from '../../types/financial';

/** Calculate median of a numeric array */
export function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** Industry multiples shape */
export interface IndustryMultiples {
  pe: number;
  evEbitda: number;
  ps: number;
  pb: number;
  label: string;
}

/** Result of comparable valuation calculations */
export interface ComparableValuations {
  peImplied: number;
  evEbitdaImplied: number;
  psImplied: number;
  pbImplied: number;
  blendedComps: number;
  hasUserComps: boolean;
  multiplesUsed: {
    pe: number;
    evEbitda: number;
    ps: number;
    pb: number;
  };
  source: string;
}

/**
 * Calculate comparable valuations using peer data or industry defaults.
 * Returns implied per-share values from each method and a blended average.
 */
export function calculateComparableValuations(
  comparables: ComparableCompany[],
  financialData: FinancialData,
  industryMultiples: IndustryMultiples,
  styleMultipleMult: number,
  sector?: string
): ComparableValuations {
  const { incomeStatement, balanceSheet } = financialData;
  const shares = financialData.sharesOutstanding;
  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const ebitda = incomeStatement.operatingIncome + incomeStatement.depreciation + incomeStatement.amortization;
  const eps = incomeStatement.netIncome / shares;
  const revenuePerShare = incomeStatement.revenue / shares;
  const bookValuePerShare = balanceSheet.totalEquity / shares;
  
  // Check if we have valid user-added comparables
  const validComps = comparables.filter(c => c.name && (c.peRatio > 0 || c.evEbitda > 0 || c.psRatio > 0 || c.pbRatio > 0));
  const hasUserComps = validComps.length > 0;
  
  // Calculate median/average multiples from user comps or use industry defaults
  let peMultiple = industryMultiples.pe;
  let evEbitdaMultiple = industryMultiples.evEbitda;
  let psMultiple = industryMultiples.ps;
  let pbMultiple = industryMultiples.pb;
  
  if (hasUserComps) {
    const peValues = validComps.filter(c => c.peRatio > 0).map(c => c.peRatio);
    const evValues = validComps.filter(c => c.evEbitda > 0).map(c => c.evEbitda);
    const psValues = validComps.filter(c => c.psRatio > 0).map(c => c.psRatio);
    const pbValues = validComps.filter(c => c.pbRatio > 0).map(c => c.pbRatio);
    
    peMultiple = peValues.length > 0 ? median(peValues) : industryMultiples.pe;
    evEbitdaMultiple = evValues.length > 0 ? median(evValues) : industryMultiples.evEbitda;
    psMultiple = psValues.length > 0 ? median(psValues) : industryMultiples.ps;
    pbMultiple = pbValues.length > 0 ? median(pbValues) : industryMultiples.pb;
  }
  
  // Apply valuation style multiplier to multiples
  peMultiple = peMultiple * styleMultipleMult;
  evEbitdaMultiple = evEbitdaMultiple * styleMultipleMult;
  psMultiple = psMultiple * styleMultipleMult;
  pbMultiple = pbMultiple * styleMultipleMult;
  
  // Calculate implied values using each method
  // P/E: Implied Price = EPS × P/E Multiple
  const peImplied = eps > 0 ? eps * peMultiple : 0;
  
  // EV/EBITDA: Implied EV = EBITDA × Multiple, then subtract debt, add cash, divide by shares
  const evImplied = ebitda > 0 ? ((ebitda * evEbitdaMultiple) - totalDebt + balanceSheet.cash) / shares : 0;
  
  // P/S: Implied Price = Revenue per Share × P/S Multiple
  const psImplied = revenuePerShare > 0 ? revenuePerShare * psMultiple : 0;
  
  // P/B: Implied Price = Book Value per Share × P/B Multiple
  const pbImplied = bookValuePerShare > 0 ? bookValuePerShare * pbMultiple : 0;
  
  // Weighted average of comparable methods
  // Banks: EV/EBITDA is not meaningful — redistribute to P/E and P/B
  const isFinancial = (sector || '').toLowerCase().includes('financial') ||
                      (sector || '').toLowerCase().includes('bank');
  
  const weights = isFinancial
    ? { pe: 0.60, evEbitda: 0.00, ps: 0.00, pb: 0.40 }  // Banks: P/E + P/B only
    : { pe: 0.40, evEbitda: 0.35, ps: 0.15, pb: 0.10 };  // Standard weights
  
  const finalEvImplied = isFinancial ? 0 : evImplied; // Hide EV/EBITDA for banks
  
  const blendedComps = (peImplied * weights.pe) + (finalEvImplied * weights.evEbitda) + 
                       (psImplied * weights.ps) + (pbImplied * weights.pb);
  
  return {
    peImplied,
    evEbitdaImplied: finalEvImplied,
    psImplied,
    pbImplied,
    blendedComps,
    hasUserComps,
    multiplesUsed: {
      pe: peMultiple,
      evEbitda: evEbitdaMultiple,
      ps: psMultiple,
      pb: pbMultiple,
    },
    source: hasUserComps ? 'User Comparables' : `${industryMultiples.label} Defaults`,
  };
}
