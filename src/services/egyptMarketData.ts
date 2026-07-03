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
 * Last calibrated: July 3, 2026
 *
 * NOTE: Numeric values mirror EGYPT_MACRO in constants/marketDefaults.ts, which
 * is the single maintained source of truth and drives the staleness badge.
 */
import { EGYPT_MACRO, isMacroStale } from '../constants/marketDefaults';

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
  depositRate: EGYPT_MACRO.cbeOvernightDeposit,   // 19% — held since Feb 2026, confirmed 21 May 2026
  lendingRate: EGYPT_MACRO.cbeOvernightLending,    // 20%
  mainOperationRate: EGYPT_MACRO.cbeMainOperation, // 19.5%
  discountRate: EGYPT_MACRO.cbeDiscountRate,       // 19.5%
  lastMPCDate: '2026-05-21',
  nextMPCDate: '2026-07-10',
  lastDecision: 'Rates held at 19%/20% — disinflation on track, upside risks monitored',
  source: 'Central Bank of Egypt — Monetary Policy Committee (cbe.org.eg)',
  lastUpdated: EGYPT_MACRO.asOfDate,
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
  tenYear: EGYPT_MACRO.egypt10YBondYield, // 20.0% — EGP 10Y proxy (investing.com)
  fiveYear: 21.0,
  threeYear: 22.3,
  oneYearTBill: 24.0,
  ninetyOneDay: 24.5,
  observationPeriod: 'May–June 2026 weighted average',
  source: 'investing.com Egypt 10Y / CBE primary auctions',
  lastUpdated: EGYPT_MACRO.asOfDate,
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
  defaultSpread: 6.37,
  totalEquityRiskPremium: EGYPT_MACRO.damodaranCRP + EGYPT_MACRO.matureERP, // 13.94
  countryRiskPremium: EGYPT_MACRO.damodaranCRP,  // 9.71
  matureMarketERP: EGYPT_MACRO.matureERP,        // 4.23
  equityVolatilityRatio: 1.524,
  datasetYear: 'January 2026 (Damodaran)',
  source: 'Damodaran Online — Country Risk Premiums (pages.stern.nyu.edu/~adamodar/)',
  lastUpdated: EGYPT_MACRO.asOfDate,
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
  headlineCPI: EGYPT_MACRO.headlineInflation, // 14.0% (~13–15% YoY; Feb 13.4%, Apr 14.9%)
  coreCPI: 11.5,
  cbeTarget: `${EGYPT_MACRO.cbeInflationTarget}% ± 2pp (by Q4 2026)`,
  observationMonth: 'May 2026',
  source: 'CAPMAS / CBE Inflation Reports (capmas.gov.eg)',
  lastUpdated: EGYPT_MACRO.asOfDate,
};

// ============================================
// CONVENIENCE: Combined Egypt Macro Snapshot
// ============================================

export interface EgyptMacroSnapshot {
  cbeRates: CBEPolicyRates;
  bondYields: EgyptBondYields;
  damodaranCRP: DamodaranCRP;
  inflation: EgyptInflation;
  /** Is the maintained config older than one CBE MPC cycle (>45 days)? */
  isStale: boolean;
  /** Whole days since the config as-of date. */
  daysOld: number;
  /** Config as-of date (EGYPT_MACRO.asOfDate). */
  asOfDate: string;
  /** Overall last updated (== asOfDate). */
  lastUpdated: string;
}

export function getEgyptMacroSnapshot(): EgyptMacroSnapshot {
  const asOfDate = EGYPT_MACRO.asOfDate;
  const daysOld = Math.max(
    0,
    Math.floor((Date.now() - new Date(asOfDate).getTime()) / 86400000)
  );

  return {
    cbeRates: CBE_POLICY_RATES,
    bondYields: EGYPT_BOND_YIELDS,
    damodaranCRP: DAMODARAN_EGYPT_CRP,
    inflation: EGYPT_INFLATION,
    isStale: isMacroStale(asOfDate),
    daysOld,
    asOfDate,
    lastUpdated: asOfDate,
  };
}
