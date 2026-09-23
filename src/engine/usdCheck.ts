/** Parallel USD valuation as a consistency check (METHODOLOGY section 6). Pure. */
import type { Assumptions } from '../domain/assumptions';
import type { DcfResult, ForecastResult, WaccResult } from '../domain/result';
import type { RateReader } from './rates';
import type { Timeline } from './timeline';
import { discountFactor } from './timeline';
import { bridgeTotal } from './dcf';

export interface UsdCheckResult {
  spot: number;
  egpInflation: number[];
  usdInflation: number[];
  forwards: number[];
  forwardTerminal: number;
  us10y: number;
  keUsd: number;
  kdUsd: number;
  waccUsd: number;
  growthUsd: number;
  rows: { label: string; fcffUsd: number; discountFactor: number; pv: number }[];
  sumPv: number;
  tvUsd: number;
  pvTvUsd: number;
  evUsd: number;
  bridgeUsd: number;
  equityUsd: number;
  equityEgpEquivalent: number;
  equityEgp: number;
  gap: number;
  rfDifferential: number;
  avgInflationDifferential: number;
  explanation: string;
}

export function runUsdCheck(a: Assumptions, f: ForecastResult, tl: Timeline, w: WaccResult, dcf: DcfResult, r: RateReader, growthPct: number): UsdCheckResult {
  const n = f.years.length;
  const spot = r.num('eg.usdEgp');
  const piE = a.usd.egpInflation.slice(0, n).map((x) => x / 100);
  const piU = a.usd.usdInflation.slice(0, n).map((x) => x / 100);
  if (piE.length < n || piU.length < n) throw new Error('USD check needs one inflation value per projection year');
  const forwards: number[] = [];
  let fx = spot;
  for (let k = 0; k < n; k++) {
    fx = fx * (1 + piE[k]) / (1 + piU[k]);
    forwards.push(fx);
  }
  const forwardTerminal = forwards[n - 1] * (1 + piE[n - 1]) / (1 + piU[n - 1]);

  const us10y = r.num('us.treasury10y');
  const keUsd = us10y + w.leveredBeta * w.matureErp + w.crp + w.sizePremium;
  const spread = w.companySpread ?? 0;
  const kdUsd = us10y + spread + w.countryDefaultSpread;
  const waccUsd = w.equityWeight * keUsd + w.debtWeight * kdUsd * (1 - w.kdTaxRate / 100);
  const ww = waccUsd / 100;
  const g = growthPct / 100;
  const growthUsd = (1 + g) * (1 + piU[n - 1]) / (1 + piE[n - 1]) - 1;

  const rows = f.years.map((y, k) => {
    const p = tl.periods[k];
    const fcffUsd = (y.fcff * p.fraction) / forwards[k];
    const df = discountFactor(ww, p.years);
    return { label: p.label, fcffUsd, discountFactor: df, pv: fcffUsd * df };
  });
  const sumPv = rows.reduce((s, x) => s + x.pv, 0);
  const tvUsd = dcf.terminal.selected === 'gordon'
    ? (f.terminal.fcff / forwardTerminal) / (ww - growthUsd)
    : (f.years[n - 1].ebitda / forwards[n - 1]) * (dcf.terminal.exitTv / dcf.terminal.exitEbitda);
  const pvTvUsd = tvUsd * discountFactor(ww, tl.tvYears);
  const evUsd = sumPv + pvTvUsd;
  const bridgeUsd = bridgeTotal(dcf.bridge) / spot;
  const equityUsd = evUsd + bridgeUsd;
  const equityEgpEquivalent = equityUsd * spot;
  const gap = equityEgpEquivalent / dcf.equityValue - 1;

  const rfDifferential = w.rf - us10y;
  const avgInflationDifferential = (piE.reduce((s, x, k) => s + ((1 + x) / (1 + piU[k]) - 1), 0) / n) * 100;
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const pp = (x: number) => `${x.toFixed(2)}pp`;
  let explanation: string;
  if (Math.abs(gap) <= 0.1) {
    explanation = `The USD valuation converted at spot is within ${pct(Math.abs(gap))} of the EGP valuation. The EGP discount rate and the inflation path used for forward FX rates are broadly consistent.`;
  } else if (gap > 0) {
    explanation = `The USD valuation converted at spot is ${pct(gap)} above the EGP valuation. The EGP risk-free rate exceeds the US 10Y by ${pp(rfDifferential)}, while the forward FX rates assume an average inflation differential of ${pp(avgInflationDifferential)}; the EGP discount rate implies more depreciation than the inflation path.`;
  } else {
    explanation = `The USD valuation converted at spot is ${pct(-gap)} below the EGP valuation. The EGP risk-free rate exceeds the US 10Y by ${pp(rfDifferential)}, while the forward FX rates assume an average inflation differential of ${pp(avgInflationDifferential)}; the EGP discount rate implies less depreciation than the inflation path.`;
  }
  return {
    spot, egpInflation: piE.map((x) => x * 100), usdInflation: piU.map((x) => x * 100), forwards, forwardTerminal, us10y,
    keUsd, kdUsd, waccUsd, growthUsd: growthUsd * 100, rows, sumPv, tvUsd, pvTvUsd, evUsd, bridgeUsd, equityUsd,
    equityEgpEquivalent, equityEgp: dcf.equityValue, gap, rfDifferential, avgInflationDifferential, explanation,
  };
}
