/**
 * Market region defaults and industry multiples for USA and Egypt.
 * These constants drive WACC components, tax rates, and comparable valuation defaults.
 *
 * UPDATED April 2026: Egypt Rf = 20.0% (10Y Gov Bond, Mar 2026 avg 20.4%)
 * CBE overnight deposit = 19.0%, lending = 20.0% (held April 2, 2026)
 * Inflation = 12.0% (January 2026 actual: 11.9%)
 * Kd = 22.5% (Rf 20% + 250bp corporate credit spread)
 */

/** Egyptian tax categories per Section 3.4 */
export const EGYPT_TAX_CATEGORIES = {
  standard: { rate: 22.5, label: 'Standard Corporate Tax (DEFAULT)', applies: 'Most Egyptian companies' },
  industrial_zone: { rate: 0, label: 'Industrial Zone (First 5 Years)', applies: 'Industrial free zone — reverts to 22.5% after year 5' },
  oil_gas: { rate: 40.55, label: 'Oil & Gas Companies', applies: 'Petroleum sector companies' },
  suez_canal: { rate: 40.0, label: 'Suez Canal / EGPC / CBE', applies: 'Specific state entities' },
  free_zone: { rate: 0, label: 'Free Zone (Export Income)', applies: 'Free economic zone exports' },
  custom: { rate: 22.5, label: 'Custom', applies: 'Any special case' },
} as const;

/** Market defaults — Updated for 2025/2026, bugs fixed per WOLF spec */
export const MARKET_DEFAULTS = {
  USA: {
    riskFreeRate: 4.5,            // 10-Year US Treasury Yield
    marketRiskPremium: 5.5,       // Historical US equity risk premium
    terminalGrowthRate: 2.5,      // Long-term GDP growth proxy
    maxTerminalGrowth: 4.0,       // Cap for validation
    defaultTaxRate: 21.0,         // US Federal Corporate Tax Rate
    currency: 'USD' as const,
    currencySymbol: '$',
    label: '🇺🇸 USA',
    description: '10-Year US Treasury Yield',
    marketDescription: 'United States - Developed Market (NYSE/NASDAQ)',
    riskFreeDescription: '10-Year US Treasury Bond Yield',
    countryRiskPremium: 0,
  },
  Egypt: {
    riskFreeRate: 20.0,           // 10-Year Egyptian Government Bond Yield (Apr 2026 avg: ~20.4%)
    marketRiskPremium: 5.5,       // Mature Market ERP ONLY (Damodaran — NO CRP for Method A)
    terminalGrowthRate: 8.0,      // Egyptian nominal GDP growth (~5% real + ~8-10% inflation target)
    maxTerminalGrowth: 12.0,      // Sustainable long-term rate (nominal, includes inflation)
    defaultTaxRate: 22.5,         // Egyptian Corporate Tax Rate (Law 91/2005)
    defaultCostOfDebt: 22.5,      // Rf 20% + 250bp corporate credit spread (must be > Rf)
    currency: 'EGP' as const,
    currencySymbol: 'EGP',
    label: '🇪🇬 Egypt',
    description: '10-Year Egyptian Government Bond Yield',
    marketDescription: 'Egypt - Emerging Market (EGX)',
    riskFreeDescription: '10-Year Egyptian Government Bond Yield',
    countryRiskPremium: 7.5,      // Damodaran for Egypt (Caa1/B-) — used ONLY in Method B

    // B2: Structured CAPM method guidance
    methodA: {
      riskFreeRate: 20.0,         // 10-year Egyptian Government Bond (EGP) — Apr 2026
      erp: 5.5,                   // Mature Market ERP (Damodaran)
      countryRiskPremium: 0,      // DO NOT ADD — already embedded in Rf
      rationale: 'Local Rf incorporates Egypt sovereign risk. Use mature ERP only.',
    },
    methodB: {
      riskFreeRate: 4.5,          // 10-year US Treasury
      erp: 5.5,                   // Mature Market ERP
      countryRiskPremium: 7.5,    // Egypt CRP (Damodaran Caa1/B-)
      rationale: 'USD base with explicit country risk premium.',
    },

    // CBE Policy Rates (April 2, 2026 — held unchanged)
    cbeBenchmarkRate: 19.0,       // CBE overnight deposit rate
    cbeLendingRate: 20.0,         // CBE overnight lending rate

    // Macro parameters
    egyptInflation: 12.0,         // January 2026 actual: 11.9% (was 28% — severely outdated)
    usInflation: 3.0,             // US CPI

    // Egyptian Legal
    dividendWithholdingTax: 10.0, // Article 46 bis Egyptian Tax Law — 10% on distributions
    capitalGainsTax: 10.0,        // On listed securities
    legalReserveRate: 5.0,        // Law 159/1981
    employeeProfitShare: 10.0,    // Law 159/1981

    // Metadata
    lastUpdated: '2026-04-07',    // Last calibration date
  },
};

/** Egyptian tax categories as array for UI dropdown */
export const EGYPTIAN_TAX_CATEGORIES = Object.entries(EGYPT_TAX_CATEGORIES).map(
  ([id, cat]) => ({ id, rate: cat.rate, label: cat.label, applies: cat.applies })
);

/** Default industry multiples for when no comparables are added (US market) */
export const DEFAULT_INDUSTRY_MULTIPLES = {
  TECH: { pe: 28, evEbitda: 18, ps: 6, pb: 8, label: 'Technology' },
  FINANCE: { pe: 12, evEbitda: 8, ps: 3, pb: 1.2, label: 'Financial Services' },
  CONSUMER: { pe: 22, evEbitda: 12, ps: 2, pb: 4, label: 'Consumer' },
  HEALTHCARE: { pe: 20, evEbitda: 14, ps: 4, pb: 5, label: 'Healthcare' },
  INDUSTRIAL: { pe: 18, evEbitda: 10, ps: 1.5, pb: 3, label: 'Industrial' },
  DEFAULT: { pe: 20, evEbitda: 12, ps: 3, pb: 4, label: 'Market Average' },
};

/** Egyptian industry multiples — sector-specific EGX defaults (Feature #1 V9) */
export const EGYPTIAN_INDUSTRY_MULTIPLES = {
  BANKING: { pe: 5.5, evEbitda: 0, ps: 2.0, pb: 1.0, label: 'Banking', weights: [50, 0, 25, 25] },
  REAL_ESTATE: { pe: 8.0, evEbitda: 7.0, ps: 1.5, pb: 0.8, label: 'Real Estate', weights: [40, 35, 15, 10] },
  TELECOM: { pe: 12.0, evEbitda: 6.0, ps: 1.8, pb: 2.0, label: 'Telecom', weights: [40, 35, 15, 10] },
  CONSUMER: { pe: 15.0, evEbitda: 8.0, ps: 1.0, pb: 2.5, label: 'Consumer/FMCG', weights: [40, 35, 15, 10] },
  INDUSTRIAL: { pe: 7.0, evEbitda: 5.0, ps: 0.8, pb: 1.2, label: 'Industrial', weights: [40, 35, 15, 10] },
  HEALTHCARE: { pe: 18.0, evEbitda: 10.0, ps: 2.0, pb: 3.0, label: 'Healthcare', weights: [40, 35, 15, 10] },
  ENERGY: { pe: 6.0, evEbitda: 4.5, ps: 0.6, pb: 1.0, label: 'Energy', weights: [40, 35, 15, 10] },
  DEFAULT: { pe: 7.0, evEbitda: 5.0, ps: 1.2, pb: 1.5, label: 'EGX Market Average', weights: [40, 35, 15, 10] },
};
