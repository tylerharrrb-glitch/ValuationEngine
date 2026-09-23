/** Reverse DCF by bisection (METHODOLOGY section 10). */
import type { CompanyData } from '../domain/company';
import type { Assumptions } from '../domain/assumptions';
import type { RatesSnapshot } from '../domain/rates';
import { perShare, type CoreRun } from './core';

export interface SolveResult {
  attainable: boolean;
  /** Solved rate in percent. */
  value: number;
  iterations: number;
  bracket: [number, number];
}

export function bisect(f: (x: number) => number, lo: number, hi: number, tol = 0.0001, maxIter = 200): SolveResult {
  let flo = f(lo);
  const fhi = f(hi);
  if (!Number.isFinite(flo) || !Number.isFinite(fhi) || flo * fhi > 0) {
    return { attainable: false, value: NaN, iterations: 0, bracket: [lo * 100, hi * 100] };
  }
  let a = lo;
  let b = hi;
  let it = 0;
  while (b - a > tol && it < maxIter) {
    const m = (a + b) / 2;
    const fm = f(m);
    if (flo * fm <= 0) b = m;
    else {
      a = m;
      flo = fm;
    }
    it++;
  }
  return { attainable: true, value: ((a + b) / 2) * 100, iterations: it, bracket: [lo * 100, hi * 100] };
}

export interface ReverseDcfResult {
  price: number;
  impliedTerminalGrowth: SolveResult;
  impliedRevenueGrowth: SolveResult;
}

export function runReverseDcf(c: CompanyData, a: Assumptions, snapshot: RatesSnapshot, base: CoreRun): ReverseDcfResult {
  const w = base.wacc.wacc / 100;
  const price = c.price;
  const g = bisect((x) => perShare(c, a, snapshot, { growth: x * 100, terminalMethod: 'gordon' }) - price, -0.05, w - 0.0001);
  const rev = bisect((x) => perShare(c, a, snapshot, { uniformRevenueGrowth: x * 100 }) - price, -0.5, 2.0);
  return { price, impliedTerminalGrowth: g, impliedRevenueGrowth: rev };
}
