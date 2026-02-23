/**
 * Market region defaults and industry multiples for USA and Egypt.
 * These constants drive WACC components, tax rates, and comparable valuation defaults.
 */

/** Market defaults - Updated for 2025/2026 */
export const MARKET_DEFAULTS = {
  USA: {
    riskFreeRate: 4.5,           // 10-Year US Treasury Yield
    marketRiskPremium: 5.5,       // Historical US equity risk premium
    terminalGrowthRate: 2.5,      // Long-term GDP growth proxy
    maxTerminalGrowth: 4.0,       // Cap for validation
    defaultTaxRate: 21.0,         // US Federal Corporate Tax Rate
    currency: 'USD' as const,
    currencySymbol: '$',
    label: '🇺🇸 USA',
    description: '10-Year US Treasury Yield',
    marketDescription: 'United States - Developed Market (NYSE/NASDAQ)',
  },
  Egypt: {
    riskFreeRate: 27.25,          // Egyptian Central Bank Rate (2025)
    marketRiskPremium: 10.0,      // Higher premium for emerging market (includes country risk)
    terminalGrowthRate: 5.0,      // Higher due to inflation
    maxTerminalGrowth: 5.0,       // Sustainable long-term rate (even with high inflation)
    defaultTaxRate: 22.5,         // Egyptian Corporate Tax Rate
    currency: 'EGP' as const,
    currencySymbol: 'EGP',
    label: '🇪🇬 Egypt',
    description: 'Egyptian T-Bill Rate (91-Day)',
    marketDescription: 'Egypt - Emerging Market (EGX)',
  },
};

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
