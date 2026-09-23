/**
 * Valuation assumptions. Every analyst-set value carries a tag so the UI,
 * PDF and Excel can show whether it is a sourced fact, an analyst assumption
 * or an estimate. Percent inputs are in percent units (10 = 10%).
 */
import type { ISODate } from './company';

export type AssumptionTag = 'Sourced fact' | 'Analyst assumption' | 'Estimate';

export interface Tagged<T> {
  value: T;
  tag: AssumptionTag;
  note: string;
}

export interface NormalizationAdjustment {
  id: string;
  label: string;
  /**
   * Amount as it appears in the reported income statement (signed). Normalized
   * EBIT = reported operating profit − Σ amount over included adjustments.
   */
  amount: number;
  include: boolean;
  tag: AssumptionTag;
  note: string;
}

/** Drivers for one projection year. */
export interface YearDrivers {
  revenueGrowth: number;
  /** Gross margin before D&A (D&A is modelled separately). */
  grossMarginExDA: number;
  sgaPctRevenue: number;
  /** Other operating income less other operating expenses, % revenue (normalized). */
  otherOpPctRevenue: number;
  /** Used when daMethod = 'pct_revenue'. */
  daPctRevenue: number;
  /** Used when daMethod = 'ppe_rollforward': depreciation as % of opening net PP&E. */
  depreciationRate: number;
  /** Amortization % revenue (roll-forward mode only; % revenue mode includes it in daPctRevenue). */
  amortizationPctRevenue: number;
  /** Used when capexMode = 'pct_revenue'. */
  capexPctRevenue: number;
  /** Used when capexMode = 'absolute' (EGP). */
  capexAbsolute: number;
  dso: number;
  dio: number;
  dpo: number;
  otherCurrentAssetsPctRevenue: number;
  otherCurrentLiabilitiesPctRevenue: number;
  /** Tax rate applied to EBIT for NOPAT. */
  taxRate: number;
}

export type RiskFreeSource = 'eg_10y_secondary' | 'cbe_auction' | 'damodaran_egp' | 'fisher_us10y';
export type CapmMethod = 'local_rf' | 'A' | 'B' | 'C';
export type KdMethod = 'synthetic' | 'cbe_plus_spread' | 'actual';
export type WeightMethod = 'market' | 'target';
export type TerminalMethod = 'gordon' | 'exit_multiple';

export interface CostOfCapitalAssumptions {
  rfSource: RiskFreeSource;
  /** Registry id of the auction tenor when rfSource = 'cbe_auction'. */
  auctionTenorId: string;
  capmMethod: CapmMethod;
  /** Method C country-risk exposure. */
  lambda: number;
  /** Damodaran EM industry name (unlevered beta corrected for cash). */
  betaIndustry: string;
  /** Optional analyst override of the unlevered beta; null = use dataset. */
  unleveredBetaOverride: number | null;
  /** Marginal tax rate used to relever beta. */
  releverTaxRate: number;
  sizePremium: Tagged<number>;
  kdMethod: KdMethod;
  /** Spread over CBE lending rate for kdMethod = 'cbe_plus_spread'. */
  kdSpreadOverCbe: number;
  /** Spread table size class for the synthetic rating. */
  syntheticTable: 'large' | 'small';
  weightMethod: WeightMethod;
  /** Target D/V in percent, when weightMethod = 'target'. */
  targetDebtWeight: number;
  /** Rate overrides: registry id → { value, reason }. Reason is mandatory. */
  rateOverrides: Record<string, { value: number; reason: string }>;
}

export interface TerminalAssumptions {
  method: TerminalMethod;
  growth: Tagged<number>;
  exitMultiple: Tagged<number>;
  /** Return on new invested capital for the value-driver check; null = WACC. */
  ronic: number | null;
  /** Long-run nominal GDP proxy for the growth warning. */
  nominalGdpProxy: number;
  /** Terminal-year drivers (normalized). */
  drivers: YearDrivers;
}

export interface EgyptAdjustments {
  /** Deduct employee & board profit distributions from FCFF. */
  distributionsOn: boolean;
  /** % of prior-year net profit. */
  distributionsPct: Tagged<number>;
  /** Forecast net finance income (annual, pre-tax), used only for the forecast net profit line. */
  netFinanceIncome: Tagged<number>;
}

export interface BridgeOptions {
  /** Deduct unfunded employee benefit obligations. */
  deductEmployeeBenefits: boolean;
  /** Tax-effect the employee benefit deduction at CIT. */
  taxEffectEmployeeBenefits: boolean;
  /** Associates at user fair value instead of carrying value; null = carrying value. */
  associatesFairValue: number | null;
}

export interface ScenarioDriverSet {
  name: 'Bear' | 'Base' | 'Bull';
  probability: number;
  /** Added to every year's revenue growth, pp. */
  revenueGrowthDelta: number;
  /** Added to every year's gross margin before D&A, pp. */
  marginDelta: number;
  waccDelta: number;
  growthDelta: number;
}

export interface DdmAssumptions {
  /** Shareholder DPS; null = derive from cash-flow dividends to shareholders ÷ shares. */
  dpsOverride: number | null;
  highGrowth: Tagged<number>;
  highGrowthYears: number;
  stableGrowth: Tagged<number>;
}

export interface MonteCarloAssumptions {
  seed: number;
  runs: number;
  revenueGrowthSd: number;
  marginSd: number;
  waccSd: number;
  growthHalfRange: number;
  minSpread: number;
}

export interface UsdCheckAssumptions {
  /** EGP inflation path per projection year (percent). */
  egpInflation: number[];
  /** USD inflation path per projection year (percent). */
  usdInflation: number[];
}

export interface SensitivitySteps {
  wacc: number;
  growth: number;
  exitMultiple: number;
  revenueGrowth: number;
  margin: number;
  rf: number;
  beta: number;
}

export interface BlendWeights {
  dcf: number;
  ddm: number;
  comps: number;
  precedents: number;
  sotp: number;
}

export interface Assumptions {
  valuationDate: ISODate;
  midYear: boolean;
  projectionYears: number;
  normalization: NormalizationAdjustment[];
  daMethod: 'pct_revenue' | 'ppe_rollforward';
  capexMode: 'pct_revenue' | 'absolute';
  /** Linear fade from year-1 drivers to terminal drivers. */
  fadeToTerminal: boolean;
  years: YearDrivers[];
  terminal: TerminalAssumptions;
  costOfCapital: CostOfCapitalAssumptions;
  egypt: EgyptAdjustments;
  bridge: BridgeOptions;
  scenarios: ScenarioDriverSet[];
  ddm: DdmAssumptions;
  monteCarlo: MonteCarloAssumptions;
  usd: UsdCheckAssumptions;
  sensitivity: SensitivitySteps;
  blend: BlendWeights;
  /** Revenue share in USD and cost share in USD for the FX sensitivity (percent; null = not entered). */
  fx: { usdRevenueShare: number | null; usdCostShare: number | null };
}
