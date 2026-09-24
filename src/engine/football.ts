/**
 * Football-field ranges (one definition for UI, PDF and Excel).
 *  - DCF: min / max of the WACC × g grid over ±1 step around the base; mid = DCF value
 *  - DDM: min / max of two-stage and H-model; mid = two-stage
 *  - Scenarios: Bear to Bull; mid = probability-weighted
 *  - Monte Carlo: P5 to P95; mid = median
 *  - Comparables / precedents: implied value at the first and third quartile of EV/EBITDA; mid = median
 *  - Broker targets: lowest to highest (reference only, not in the blend)
 */
import type { ValuationResult } from './valuation';

export interface FootballRow {
  id: string;
  label: string;
  low: number;
  mid: number;
  high: number;
  reference: boolean;
}

export function footballField(v: ValuationResult): FootballRow[] {
  const rows: FootballRow[] = [];
  const g = v.sensitivity.find((x) => x.id === 'wacc_g')!;
  const inner = g.values.slice(1, 4).flatMap((r) => r.slice(1, 4)).filter(Number.isFinite);
  rows.push({ id: 'dcf', label: 'DCF (FCFF)', low: Math.min(...inner), mid: v.core.dcf.perShare, high: Math.max(...inner), reference: false });
  if (v.ddm.applicable) {
    rows.push({ id: 'ddm', label: 'Dividend discount model', low: Math.min(v.ddm.twoStage, v.ddm.hModel), mid: v.ddm.twoStage, high: Math.max(v.ddm.twoStage, v.ddm.hModel), reference: false });
  }
  const sc = v.scenarios.rows;
  const bear = sc.find((s) => s.name === 'Bear');
  const bull = sc.find((s) => s.name === 'Bull');
  if (bear && bull) rows.push({ id: 'scenarios', label: 'Scenarios (Bear to Bull)', low: bear.perShare, mid: v.scenarios.weightedPerShare, high: bull.perShare, reference: false });
  if (v.monteCarlo) rows.push({ id: 'montecarlo', label: 'Monte Carlo (P5 to P95)', low: v.monteCarlo.p5, mid: v.monteCarlo.median, high: v.monteCarlo.p95, reference: false });
  const shares = v.core.dcf.dilutedShares;
  const bt = v.core.dcf.bridge.filter((l) => !l.memo).reduce((s, l) => s + l.amount, 0);
  const ebitda = v.core.norm.normalizedEbitda;
  const ev = (m: number) => (m * ebitda + bt) / shares;
  const cs = v.comps.stats.evEbitdaLtm;
  if (cs) rows.push({ id: 'comps', label: 'Trading comparables (EV/EBITDA Q1 to Q3)', low: ev(cs.q1), mid: ev(cs.median), high: ev(cs.q3), reference: false });
  const ps = v.precedents.stats.evEbitda;
  if (ps) rows.push({ id: 'precedents', label: 'Precedent transactions (EV/EBITDA Q1 to Q3)', low: ev(ps.q1), mid: ev(ps.median), high: ev(ps.q3), reference: false });
  if (v.brokers) rows.push({ id: 'brokers', label: 'Broker targets (reference only)', low: v.brokers.low, mid: v.brokers.median, high: v.brokers.high, reference: true });
  return rows;
}
