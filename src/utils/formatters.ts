// Formatting utilities for consistent number display across the app
// All formatting is UI-only - raw data stays as numbers

export type CurrencyCode = 'USD' | 'EGP';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  position: 'before' | 'after';
  name: string;
}

export const CURRENCIES: Record<CurrencyCode, CurrencyConfig> = {
  USD: { code: 'USD', symbol: '$', position: 'before', name: 'US Dollar' },
  EGP: { code: 'EGP', symbol: 'EGP', position: 'after', name: 'Egyptian Pound' }
};

/**
 * Get currency config from market region
 */
export function getCurrencyFromMarket(market: 'USA' | 'Egypt'): CurrencyConfig {
  return market === 'Egypt' ? CURRENCIES.EGP : CURRENCIES.USD;
}

/**
 * Format a number with US-style thousands separators
 * Example: 1000000 → 1,000,000
 */
export function formatNumber(value: number, decimals: number = 0): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format a number as currency with thousands separators
 * Supports both USD ($100) and EGP (100 EGP) formatting
 * Example (USD): 1000000 → $1,000,000
 * Example (EGP): 1000000 → 1,000,000 EGP
 */
export function formatCurrency(value: number, decimals: number = 0, currency: CurrencyCode = 'USD'): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  const config = CURRENCIES[currency];
  const formattedNumber = formatNumber(value, decimals);
  
  if (config.position === 'before') {
    return `${config.symbol}${formattedNumber}`;
  } else {
    return `${formattedNumber} ${config.symbol}`;
  }
}

/**
 * Format large currency values with abbreviations
 * Example (USD): 1500000000 → $1.50B
 * Example (EGP): 1500000000 → 1.50B EGP
 */
export function formatCurrencyShort(value: number, currency: CurrencyCode = 'USD'): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  const config = CURRENCIES[currency];
  const absValue = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  
  let shortValue: string;
  if (absValue >= 1e12) {
    shortValue = `${sign}${formatNumber(absValue / 1e12, 2)}T`;
  } else if (absValue >= 1e9) {
    shortValue = `${sign}${formatNumber(absValue / 1e9, 2)}B`;
  } else if (absValue >= 1e6) {
    shortValue = `${sign}${formatNumber(absValue / 1e6, 2)}M`;
  } else if (absValue >= 1e3) {
    shortValue = `${sign}${formatNumber(absValue / 1e3, 2)}K`;
  } else {
    shortValue = `${sign}${formatNumber(absValue, 2)}`;
  }
  
  if (config.position === 'before') {
    return `${config.symbol}${shortValue}`;
  } else {
    return `${shortValue} ${config.symbol}`;
  }
}

/**
 * Format as percentage (input is already a percentage number, not decimal)
 * Example: 7 → 7% or 7.5 → 7.5%
 */
export function formatPercent(value: number, decimals: number = 2, showSign: boolean = false): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  const sign = showSign && value > 0 ? '+' : '';
  return `${sign}${formatNumber(value, decimals)}%`;
}

/**
 * Format as percentage from decimal (input is decimal like 0.07)
 * Example: 0.07 → 7%
 */
export function formatPercentFromDecimal(value: number, decimals: number = 2): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  return formatPercent(value * 100, decimals);
}

/**
 * Format as ratio/multiple
 * Example: 15.5 → 15.5x
 */
export function formatMultiple(value: number, decimals: number = 1): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  return `${formatNumber(value, decimals)}x`;
}

/**
 * Format value for display in tables (millions with 2 decimals)
 * Example (USD): 1500000000 → $1,500.00M
 * Example (EGP): 1500000000 → 1,500.00M EGP
 */
export function formatMillions(value: number, currency: CurrencyCode = 'USD'): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  const config = CURRENCIES[currency];
  const formatted = `${formatNumber(value / 1e6, 2)}M`;
  
  if (config.position === 'before') {
    return `${config.symbol}${formatted}`;
  } else {
    return `${formatted} ${config.symbol}`;
  }
}

/**
 * Format stock price with currency
 * Example (USD): 45.5 → $45.50
 * Example (EGP): 45.5 → 45.50 EGP
 */
export function formatPrice(value: number, currency: CurrencyCode = 'USD'): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  return formatCurrency(value, 2, currency);
}

/**
 * Format shares count (no currency symbol - just a count)
 * Example: 500000000 → 500M shares
 */
export function formatShares(value: number): string {
  if (value === null || value === undefined || isNaN(value) || !isFinite(value)) {
    return 'N/A';
  }
  
  if (value >= 1e9) {
    return `${formatNumber(value / 1e9, 2)}B`;
  } else if (value >= 1e6) {
    return `${formatNumber(value / 1e6, 2)}M`;
  } else if (value >= 1e3) {
    return `${formatNumber(value / 1e3, 2)}K`;
  }
  return formatNumber(value, 0);
}

/**
 * Get currency label for charts (e.g., "Billions of USD" or "Billions of EGP")
 */
export function getCurrencyLabel(currency: CurrencyCode, scale: 'millions' | 'billions' = 'billions'): string {
  const scaleLabel = scale === 'billions' ? 'Billions' : 'Millions';
  return `${scaleLabel} of ${currency}`;
}

/**
 * Format chart axis values with currency
 */
export function formatChartValue(value: number, currency: CurrencyCode = 'USD'): string {
  if (value >= 1e9) {
    return formatCurrencyShort(value, currency);
  } else if (value >= 1e6) {
    return formatCurrencyShort(value, currency);
  }
  return formatCurrency(value, 0, currency);
}
