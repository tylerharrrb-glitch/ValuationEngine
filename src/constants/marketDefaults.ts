/**
 * Market region defaults and industry multiples for USA and Egypt.
 * These constants drive WACC components, tax rates, and comparable valuation defaults.
 *
 * Last verified: April 12, 2026
 * Sources: CBE (cbe.org.eg), CAPMAS, Damodaran (pages.stern.nyu.edu/~adamodar),
 * Investing.com, BLS, PwC Egypt Tax Summaries, Moody's, S&P, Fitch
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
    riskFreeRate: 4.25,           // 10-Year US Treasury midpoint Jan-Apr 2026
    marketRiskPremium: 4.23,      // Mature Market ERP (Damodaran, Jan 5 2026 update)
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
    riskFreeRate: 20.40,          // 10-Year Egyptian Government Bond Yield (Mar 2026 avg)
    marketRiskPremium: 4.23,      // Mature Market ERP (Damodaran, Jan 5 2026 update)
    terminalGrowthRate: 8.0,      // Egyptian nominal GDP growth (~5% real + ~8-10% inflation target)
    maxTerminalGrowth: 12.0,      // Sustainable long-term rate (nominal, includes inflation)
    defaultTaxRate: 22.5,         // Egyptian Corporate Tax Rate (Law 91/2005)
    defaultCostOfDebt: 22.9,      // Rf 20.4% + 250bp corporate credit spread (must be > Rf)
    currency: 'EGP' as const,
    currencySymbol: 'EGP',
    label: '🇪🇬 Egypt',
    description: '10-Year Egyptian Government Bond Yield',
    marketDescription: 'Egypt - Emerging Market (EGX)',
    riskFreeDescription: '10-Year Egyptian Government Bond Yield',
    countryRiskPremium: 9.71,     // Damodaran for Egypt (Moody's Caa1), Jan 5 2026 update

    // ── Damodaran data — January 5, 2026 update ──
    totalEquityRiskPremium: 13.94, // = MRP 4.23 + CRP 9.71
    egyptDefaultSpread: 6.37,      // Sovereign default spread for Caa1
    equityBondVolatilityScalar: 1.524, // CRP/default spread ratio

    // ── Damodaran clean risk-free rates ──
    rfCleanUSD: 3.95,              // US T.Bond 4.18% - US default spread 0.23%
    rfCleanEGP: 9.49,              // Fisher: 3.95 + (7.78 - 2.24), using IMF expected inflation

    // ── CAPM method guidance ──
    // ⚠️ DOUBLE-COUNTING WARNING (Damodaran, "What is the riskfree rate?"):
    // If Rf = local government bond yield (e.g., 20.4% for Egypt), it ALREADY
    // embeds sovereign default risk (~6.37% for Caa1). Adding CRP separately
    // will DOUBLE-COUNT country risk. Either:
    // (a) Use clean Rf (Damodaran/Fisher) + CRP  → Methods A/B/C
    // (b) Use local bond yield Rf + mature market ERP only (no CRP) → local_rf
    methodA: {
      riskFreeRate: 9.49,           // Damodaran clean EGP Rf (Fisher-adjusted)
      erp: 4.23,                    // Mature Market ERP (Damodaran)
      countryRiskPremium: 9.71,     // Added explicitly — clean Rf does NOT embed it
      rationale: 'Damodaran Method A: Clean Rf + β×ERP + CRP. Ke ≈ 9.49 + β×4.23 + 9.71',
    },
    methodB: {
      riskFreeRate: 4.25,           // 10-year US Treasury
      erp: 4.23,                    // Mature Market ERP
      countryRiskPremium: 9.71,     // Egypt CRP (Damodaran, Moody's Caa1)
      rationale: 'Damodaran Method B: Ke = Rf + β×(ERP + CRP). CRP loaded into beta.',
    },
    methodLocalRf: {
      riskFreeRate: 20.40,          // Local 10Y EGB — already embeds country risk
      erp: 4.23,                    // Mature Market ERP ONLY — NO CRP
      countryRiskPremium: 0,        // DO NOT ADD — already embedded in Rf
      rationale: 'Local Rf + mature ERP only. Rf already embeds ~6.37% sovereign spread.',
    },

    // ── CBE Policy Rates (effective Feb 12, 2026; held Apr 2, 2026) ──
    cbeBenchmarkRate: 19.0,        // CBE overnight deposit rate
    cbeLendingRate: 20.0,          // CBE overnight lending rate
    cbeMainOperation: 19.5,        // CBE main operation rate

    // ── Inflation ──
    egyptInflation: 13.5,           // CAPMAS nationwide CPI, March 2026
    egyptExpectedInflation: 7.78,   // IMF medium-term forecast (used by Damodaran)
    usInflation: 3.3,               // BLS CPI, March 2026

    // ── Egyptian Legal & Tax ──
    dividendWHTListed: 5.0,         // 5% for EGX-listed (was 10% for all — split)
    dividendWHTUnlisted: 10.0,      // 10% for unlisted
    cgtListedShares: 0,             // ABOLISHED June 2025; replaced by stamp duty
    stampDutyRate: 0.125,           // 0.125% per transaction (buy and sell)
    legalReserveRate: 5.0,          // Law 159/1981
    employeeProfitShare: 10.0,      // Law 159/1981

    // ── Egypt sovereign ratings (for display/reporting) ──
    moodysRating: 'Caa1' as const,  // Positive outlook, affirmed Apr 3 2026
    spRating: 'B' as const,         // Stable, upgraded from B- late 2025
    fitchRating: 'B' as const,      // Stable

    // ── EGX Market Conventions (Section 15) ──
    tradingHours: '10:00–14:30 EET (Sun–Thu)',  // Continuous trading session
    settlementCycle: 'T+2',                      // Misr for Central Clearing (MCDR)
    priceLimitDaily: 10,                         // ±10% daily limit
    priceLimitExpanded: 20,                      // Expandable to ±20% if hit
    circuitBreaker: 5,                           // 5% threshold triggers 30-min halt
    primaryIndex: 'EGX30',                       // Main benchmark
    broadIndex: 'EGX70 EWI',                     // Broader equal-weight index
    depository: 'MCDR',                          // Misr for Central Depository & Registration
    regulator: 'FRA',                            // Financial Regulatory Authority
    freeFloatMin: 10,                            // Minimum free float % for listing
    boardLotSize: 1,                             // No minimum lot; fractional not allowed

    // ── Metadata ──
    lastUpdated: '2026-04-12',      // Last calibration date
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
