/**
 * Valuation style presets: Conservative, Moderate, and Aggressive.
 * These multipliers adjust DCF and comparable valuation parameters.
 */

export const VALUATION_STYLES = {
  conservative: {
    label: 'Conservative',
    icon: '',
    subtitle: 'Value Investor',
    description: 'Lower growth, higher WACC, strict multiples',
    revenueGrowthMult: 0.7,
    waccAdd: 1.5,
    terminalGrowthMult: 0.8,
    multipleMult: 0.8,
    marginChange: -0.5,
  },
  moderate: {
    label: 'Moderate',
    icon: '',
    subtitle: 'GARP Investor',
    description: 'Balanced assumptions, market consensus',
    revenueGrowthMult: 1.0,
    waccAdd: 0,
    terminalGrowthMult: 1.0,
    multipleMult: 1.0,
    marginChange: 0,
  },
  aggressive: {
    label: 'Aggressive',
    icon: '',
    subtitle: 'Growth Investor',
    description: 'Higher growth, lower WACC, premium multiples',
    revenueGrowthMult: 1.4,
    waccAdd: -1.0,
    terminalGrowthMult: 1.2,
    multipleMult: 1.3,
    marginChange: 1.0,
  },
};

/** Type for valuation style keys */
export type ValuationStyleKey = keyof typeof VALUATION_STYLES;
