/**
 * One full DCF run: rates → normalization → timeline → WACC → forecast → DCF.
 * Scenarios, sensitivities, reverse DCF and Monte Carlo all call this with overrides.
 */
import type { CompanyData } from '../domain/company';
import { latestYear } from '../domain/company';
import type { Assumptions } from '../domain/assumptions';
import type { RatesSnapshot } from '../domain/rates';
import type { DcfResult, ForecastResult, NormalizationResult, WaccResult } from '../domain/result';
import { RateReader } from './rates';
import { normalize } from './normalize';
import { buildTimeline, type Timeline } from './timeline';
import { computeWacc } from './wacc';
import { runForecast, terminalGrowth, type CoreOverrides } from './forecast';
import { runDcf } from './dcf';

export interface CoreRun {
  rates: RateReader;
  cit: number;
  norm: NormalizationResult;
  timeline: Timeline;
  wacc: WaccResult;
  forecast: ForecastResult;
  dcf: DcfResult;
  /** Terminal growth used (percent). */
  growth: number;
}

export function runCore(c: CompanyData, a: Assumptions, snapshot: RatesSnapshot, ov: CoreOverrides = {}): CoreRun {
  const rates = new RateReader(snapshot, a.costOfCapital.rateOverrides);
  const cit = rates.num('eg.cit');
  const norm = normalize(c, a.normalization);
  const timeline = buildTimeline(a.valuationDate, latestYear(c).periodEnd, a.projectionYears, a.midYear);
  const wacc = computeWacc(c, a.costOfCapital, rates, norm.normalizedEbit, ov);
  const forecast = runForecast(c, norm, a, ov);
  const dcf = runDcf(c, a, norm, forecast, timeline, wacc.wacc, cit, ov);
  return { rates, cit, norm, timeline, wacc, forecast, dcf, growth: terminalGrowth(a, ov) };
}

/** Value per share for a set of overrides (used by grids and solvers). */
export function perShare(c: CompanyData, a: Assumptions, snapshot: RatesSnapshot, ov: CoreOverrides): number {
  return runCore(c, a, snapshot, ov).dcf.perShare;
}
