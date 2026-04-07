/**
 * Egyptian Market Data Service — Phase 3 (Tasks #14, #15, #17)
 *
 * Consolidates all Egyptian macroeconomic data into a single typed service.
 * Architecture: Static constants with `lastUpdated` timestamps, designed for
 * future replacement with live CBE/Damodaran API calls when available.
 *
 * Sources:
 * - CBE: https://www.cbe.org.eg/en/monetary-policy
 * - Egypt Gov Bonds: Bloomberg EGPT generic benchmark
 * - Damodaran: https://pages.stern.nyu.edu/~adamodar/
 * - CAPMAS: https://www.capmas.gov.eg/ (inflation)
 *
 * Last calibrated: April 7, 2026
 */

// ============================================
// CBE MONETARY POLICY RATES
// ============================================

export interface CBEPolicyRates {
  /** CBE overnight deposit rate (%) */
  depositRate: number;
  /** CBE overnight lending rate (%) */
  lendingRate: number;
  /** CBE main operation rate (%) — the corridor midpoint */
  mainOperationRate: number;
  /** CBE discount rate (%) */
  discountRate: number;
  /** Date of last MPC decision (ISO format) */
  lastMPCDate: string;
  /** Next scheduled MPC meeting (ISO format, approximate) */
  nextMPCDate: string;
  /** MPC decision summary */
  lastDecision: string;
  /** Source URL */
  source: string;
  /** Last data update */
  lastUpdated: string;
}

export const CBE_POLICY_RATES: CBEPolicyRates = {
  depositRate: 19.00,           // CBE cut to 19% on Feb 12, 2026 (was 27.25% at peak Mar 2024)
  lendingRate: 20.00,            // CBE lending now 20% (was 28.25%)
  mainOperationRate: 19.50,
  discountRate: 19.50,
  lastMPCDate: '2026-04-02',
  nextMPCDate: '2026-05-22',
  lastDecision: 'Rates on hold — geopolitical uncertainty and upside inflation risks',
  source: 'Central Bank of Egypt — Monetary Policy Committee',
  lastUpdated: '2026-04-02',
};

// ============================================
// EGYPT GOVERNMENT BOND YIELDS
// ============================================

export interface EgyptBondYields {
  /** 10-Year government bond yield (%) — primary Rf for Method A */
  tenYear: number;
  /** 5-Year government bond yield (%) */
  fiveYear: number;
  /** 3-Year government bond yield (%) */
  threeYear: number;
  /** 1-Year T-Bill yield (%) */
  oneYearTBill: number;
  /** 91-day T-Bill yield (%) */
  ninetyOneDay: number;
  /** Date range of the yield observation */
  observationPeriod: string;
  /** Source */
  source: string;
  /** Last data update */
  lastUpdated: string;
}

export const EGYPT_BOND_YIELDS: EgyptBondYields = {
  tenYear: 20.0,
  fiveYear: 21.5,
  threeYear: 22.8,
  oneYearTBill: 24.5,
  ninetyOneDay: 25.0,
  observationPeriod: 'March-April 2026 weighted average',
  source: 'Bloomberg EGPT benchmark / CBE primary auctions',
  lastUpdated: '2026-04-07',
};

// ============================================
// DAMODARAN COUNTRY RISK DATA (EGYPT)
// ============================================

export interface DamodaranCRP {
  /** Country name */
  country: string;
  /** Moody's sovereign credit rating */
  moodysRating: string;
  /** S&P sovereign credit rating */
  spRating: string;
  /** Country default spread (%) — over US Treasuries */
  defaultSpread: number;
  /** Equity risk premium for the country (total ERP = mature ERP + additional CRP) */
  totalEquityRiskPremium: number;
  /** Country Risk Premium (%) — added to mature market ERP for Method B */
  countryRiskPremium: number;
  /** Mature market ERP base (Damodaran implied, %) */
  matureMarketERP: number;
  /** Relative equity volatility factor (equity vol / bond vol) */
  equityVolatilityRatio: number;
  /** Dataset vintage */
  datasetYear: string;
  /** Source URL */
  source: string;
  /** Last data update */
  lastUpdated: string;
}

export const DAMODARAN_EGYPT_CRP: DamodaranCRP = {
  country: 'Egypt',
  moodysRating: 'Caa1',
  spRating: 'B-',
  defaultSpread: 5.66,
  totalEquityRiskPremium: 13.06,
  countryRiskPremium: 7.56,
  matureMarketERP: 5.5,
  equityVolatilityRatio: 1.33,
  datasetYear: 'January 2026',
  source: 'Damodaran Online — Country Risk Premiums (pages.stern.nyu.edu/~adamodar/)',
  lastUpdated: '2026-04-07',
};

// ============================================
// EGYPT INFLATION DATA
// ============================================

export interface EgyptInflation {
  /** Headline urban CPI inflation (%, year-over-year) */
  headlineCPI: number;
  /** Core CPI inflation excl. food and energy (%) */
  coreCPI: number;
  /** CBE inflation target range (%) */
  cbeTarget: string;
  /** Observation month */
  observationMonth: string;
  /** Source */
  source: string;
  /** Last data update */
  lastUpdated: string;
}

export const EGYPT_INFLATION: EgyptInflation = {
  headlineCPI: 12.5,
  coreCPI: 10.0,
  cbeTarget: '7% ± 2pp (by Q4 2026)',
  observationMonth: 'February 2026',
  source: 'CAPMAS / CBE Inflation Reports',
  lastUpdated: '2026-04-07',
};

// ============================================
// CONVENIENCE: Combined Egypt Macro Snapshot
// ============================================

export interface EgyptMacroSnapshot {
  cbeRates: CBEPolicyRates;
  bondYields: EgyptBondYields;
  damodaranCRP: DamodaranCRP;
  inflation: EgyptInflation;
  /** Is any data component stale (older than 90 days)? */
  isStale: boolean;
  /** Overall last updated */
  lastUpdated: string;
}

export function getEgyptMacroSnapshot(): EgyptMacroSnapshot {
  const dates = [
    CBE_POLICY_RATES.lastUpdated,
    EGYPT_BOND_YIELDS.lastUpdated,
    DAMODARAN_EGYPT_CRP.lastUpdated,
    EGYPT_INFLATION.lastUpdated,
  ];
  const oldestDate = dates.sort()[0];
  const daysSinceUpdate = Math.floor(
    (Date.now() - new Date(oldestDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return {
    cbeRates: CBE_POLICY_RATES,
    bondYields: EGYPT_BOND_YIELDS,
    damodaranCRP: DAMODARAN_EGYPT_CRP,
    inflation: EGYPT_INFLATION,
    isStale: daysSinceUpdate > 90,
    lastUpdated: oldestDate,
  };
}
