/** Seeded Monte Carlo on the full DCF (METHODOLOGY section 11). */
import type { CompanyData } from '../domain/company';
import type { Assumptions } from '../domain/assumptions';
import type { RatesSnapshot } from '../domain/rates';
import { perShare, type CoreRun } from './core';
import { mulberry32, normalSampler, percentile } from './prng';

export interface MonteCarloResult {
  seed: number;
  runs: number;
  valid: number;
  mean: number;
  median: number;
  p5: number;
  p25: number;
  p75: number;
  p95: number;
  probAbovePrice: number;
  redraws: number;
  /** Histogram of values (20 equal bins between P1 and P99). */
  histogram: { from: number; to: number; count: number }[];
}

export function runMonteCarlo(c: CompanyData, a: Assumptions, snapshot: RatesSnapshot, base: CoreRun, runsOverride?: number): MonteCarloResult {
  const m = a.monteCarlo;
  const runs = runsOverride ?? m.runs;
  const u = mulberry32(m.seed);
  const z = normalSampler(u);
  const w0 = base.wacc.wacc;
  const g0 = base.growth;
  const values: number[] = [];
  let redraws = 0;
  for (let k = 0; k < runs; k++) {
    const dg = z() * m.revenueGrowthSd;
    const dm = z() * m.marginSd;
    let w = w0 + z() * m.waccSd;
    let g = g0 - m.growthHalfRange + 2 * m.growthHalfRange * u();
    let tries = 0;
    while (w - g < m.minSpread && tries < 100) {
      w = w0 + z() * m.waccSd;
      g = g0 - m.growthHalfRange + 2 * m.growthHalfRange * u();
      tries++;
      redraws++;
    }
    const v = perShare(c, a, snapshot, { revenueGrowthDelta: dg, marginDelta: dm, wacc: w / 100, growth: g, terminalMethod: 'gordon' });
    if (Number.isFinite(v)) values.push(v);
  }
  const sorted = [...values].sort((x, y) => x - y);
  const mean = sorted.reduce((s, x) => s + x, 0) / sorted.length;
  const lo = percentile(sorted, 0.01);
  const hi = percentile(sorted, 0.99);
  const bins = 20;
  const width = (hi - lo) / bins;
  const histogram = Array.from({ length: bins }, (_, i) => ({ from: lo + i * width, to: lo + (i + 1) * width, count: 0 }));
  for (const v of sorted) {
    if (v < lo || v > hi || width <= 0) continue;
    histogram[Math.min(bins - 1, Math.floor((v - lo) / width))].count++;
  }
  return {
    seed: m.seed,
    runs,
    valid: sorted.length,
    mean,
    median: percentile(sorted, 0.5),
    p5: percentile(sorted, 0.05),
    p25: percentile(sorted, 0.25),
    p75: percentile(sorted, 0.75),
    p95: percentile(sorted, 0.95),
    probAbovePrice: sorted.filter((v) => v > c.price).length / sorted.length,
    redraws,
    histogram,
  };
}
