/**
 * Market region defaults and industry multiples for USA and Egypt.
 * These constants drive WACC components, tax rates, and comparable valuation defaults.
 *
 * BUG FIX: Egypt Rf changed from 27.25% (CBE overnight) to 22.0% (10Y bond)
 * BUG FIX: Egypt ERP changed from 10.0% to 5.5% (mature ERP only for Method A)
 */

/** Egyptian tax categories per Section 3.4 */
export const EGYPT_TAX_CATEGORIES = {
  standard: { rate: 22.5, label: 'Standard Corporate Tax (DEFAULT)', applies: 'Most Egyptian companies' },
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
    riskFreeRate: 22.0,           // 10-Year Egyptian Government Bond Yield (BUG FIX: was 27.25% CBE overnight)
    marketRiskPremium: 5.5,       // Mature Market ERP ONLY (BUG FIX: was 10.0% which double-counts country risk)
    terminalGrowthRate: 8.0,      // Egyptian nominal GDP growth
    maxTerminalGrowth: 12.0,      // Sustainable long-term rate (nominal, includes inflation)
    defaultTaxRate: 22.5,         // Egyptian Corporate Tax Rate
    currency: 'EGP' as const,
    currencySymbol: 'EGP',
    label: '🇪🇬 Egypt',
    description: '10-Year Egyptian Government Bond Yield',  // BUG FIX: was "Egyptian T-Bill Rate (91-Day)"
    marketDescription: 'Egypt - Emerging Market (EGX)',
    riskFreeDescription: '10-Year Egyptian Government Bond Yield',  // BUG FIX
    countryRiskPremium: 7.5,      // Damodaran for Egypt (Caa1/B-) — used ONLY in Method B
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

/** Egyptian industry multiples (different from US tech multiples) */
export const EGYPTIAN_INDUSTRY_MULTIPLES = {
  BANKING: { pe: 5.5, evEbitda: 4.0, ps: 2.0, pb: 1.2, label: 'Egyptian Banks' },
  TELECOM: { pe: 8.0, evEbitda: 4.5, ps: 1.5, pb: 1.8, label: 'Egyptian Telecom' },
  CONSUMER: { pe: 12.0, evEbitda: 7.0, ps: 1.2, pb: 2.5, label: 'Egyptian Consumer/Food' },
  REAL_ESTATE: { pe: 6.0, evEbitda: 8.0, ps: 2.0, pb: 0.8, label: 'Egyptian Real Estate' },
  DEFAULT: { pe: 7.0, evEbitda: 5.0, ps: 1.2, pb: 1.5, label: 'EGX Market Average' },
};
