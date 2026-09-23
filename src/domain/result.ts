/**
 * Engine outputs. Every intermediate value is returned so the UI audit panel,
 * the PDF and the Excel parity check can show and compare it.
 */
import type { ISODate } from './company';

export type Severity = 'error' | 'warning' | 'info';

export interface EngineMessage {
  severity: Severity;
  code: string;
  text: string;
}

export interface TimelinePeriod {
  index: number; // 1-based
  label: string; // "2026E"
  fiscalYear: number;
  periodStart: ISODate;
  periodEnd: ISODate;
  /** Fraction of the period's cash flow included (stub for year 1, 1 otherwise). */
  fraction: number;
  discountDate: ISODate;
  /** Discount date as a day serial relative to the valuation date (may be fractional). */
  discountDays: number;
  years: number;
  endYears: number;
}

export interface NormalizationLine {
  id: string;
  label: string;
  amount: number;
  include: boolean;
  tag: string;
  note: string;
}

export interface NormalizationResult {
  reportedOperatingProfit: number;
  lines: NormalizationLine[];
  totalRemoved: number;
  normalizedEbit: number;
  depreciation: number;
  amortization: number;
  normalizedEbitda: number;
  reportedEbitda: number;
}

export interface ForecastYear {
  index: number;
  label: string;
  fiscalYear: number;
  revenue: number;
  revenueGrowth: number;
  grossProfitExDA: number;
  sga: number;
  otherOp: number;
  ebitda: number;
  depreciation: number;
  amortization: number;
  da: number;
  ebit: number;
  taxRate: number;
  taxOnEbit: number;
  nopat: number;
  capex: number;
  openingPpe: number;
  closingPpe: number;
  cashCogs: number;
  receivables: number;
  inventory: number;
  payables: number;
  otherCurrentAssets: number;
  otherCurrentLiabilities: number;
  nwc: number;
  deltaNwc: number;
  priorYearNetProfit: number;
  distributions: number;
  netProfit: number;
  fcff: number;
}

export interface ForecastBase {
  fiscalYear: number;
  revenue: number;
  cashCogs: number;
  normalizedEbitda: number;
  normalizedEbit: number;
  closingPpe: number;
  receivables: number;
  inventory: number;
  payables: number;
  otherCurrentAssets: number;
  otherCurrentLiabilities: number;
  nwc: number;
  netProfit: number;
}

export interface ForecastResult {
  base: ForecastBase;
  years: ForecastYear[];
  terminal: ForecastYear;
}

export interface WaccResult {
  rfSource: string;
  rfId: string;
  rf: number;
  rfAsOf: ISODate;
  rfStatus: string;
  capmMethod: string;
  matureErp: number;
  crp: number;
  countryDefaultSpread: number;
  lambda: number;
  betaIndustry: string;
  unleveredBeta: number;
  betaDatasetDate: string;
  releverTaxRate: number;
  debtToEquity: number;
  leveredBeta: number;
  blumeBeta: number;
  sizePremium: number;
  ke: number;
  kdMethod: string;
  interestCoverage: number | null;
  syntheticRating: string | null;
  companySpread: number | null;
  kdPreTax: number;
  kdTaxRate: number;
  kdAfterTax: number;
  equityValue: number;
  debtValue: number;
  equityWeight: number;
  debtWeight: number;
  wacc: number;
  messages: EngineMessage[];
}

export interface BridgeLine {
  id: string;
  label: string;
  /** Signed contribution to equity value. */
  amount: number;
  source: string;
  memo?: boolean;
}

export interface TerminalValueResult {
  gordonFcffNext: number;
  gordonTv: number;
  gordonPv: number;
  exitEbitda: number;
  exitTv: number;
  exitPv: number;
  impliedExitMultipleFromGordon: number;
  impliedGrowthFromExit: number;
  ronic: number;
  impliedReinvestmentRate: number;
  forecastReinvestmentRate: number;
  discountYears: number;
  discountFactor: number;
  selected: 'gordon' | 'exit_multiple';
}

export interface DcfPeriodRow {
  period: TimelinePeriod;
  fcff: number;
  fcffIncluded: number;
  discountFactor: number;
  pv: number;
}

export interface DcfResult {
  wacc: number;
  rows: DcfPeriodRow[];
  sumPv: number;
  terminal: TerminalValueResult;
  pvTerminal: number;
  enterpriseValue: number;
  tvShareOfEv: number;
  bridge: BridgeLine[];
  equityValue: number;
  dilutedShares: number;
  perShare: number;
  upside: number;
  impliedEvEbitdaLtm: number;
  impliedEvEbitdaNtm: number;
  impliedPeLtm: number;
  impliedPeNtm: number;
  messages: EngineMessage[];
}

export interface VerdictBand {
  upside: number;
  band: 'In line with market price' | 'Above market price' | 'Below market price';
  text: string;
}
