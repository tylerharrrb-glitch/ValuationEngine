/** The MOPCO outputs frozen in tests/golden/mopco.json (spec Part 11). */
import { readFileSync } from 'node:fs';
import type { RatesSnapshot } from '../../src/domain/rates';
import { buildDefaultAssumptions } from '../../src/engine/defaults';
import { runValuation } from '../../src/engine/valuation';
import { loadMopco } from './fixtures';

export function goldenOutputs(): Record<string, number> {
  const snap = JSON.parse(readFileSync('tests/fixtures/rates-snapshot-2026-09-23.json', 'utf8')) as RatesSnapshot;
  const c = loadMopco();
  const a = buildDefaultAssumptions(c, snap, { betaIndustry: c.damodaranIndustry ?? 'Chemical (Basic)' });
  const v = runValuation(c, a, snap);
  const d = v.core.dcf;
  const out: Record<string, number> = {
    normalizedEbit: v.core.norm.normalizedEbit,
    ke: v.core.wacc.ke,
    wacc: v.core.wacc.wacc,
    enterpriseValue: d.enterpriseValue,
    equityValue: d.equityValue,
    dcfPerShare: d.perShare,
    gordonTv: d.terminal.gordonTv,
    exitTv: d.terminal.exitTv,
    ddmTwoStage: v.ddm.twoStage,
    ddmHModel: v.ddm.hModel,
    blended: v.blend.blendedValue,
    scenarioWeighted: v.scenarios.weightedPerShare,
    usdGap: v.usd.gap,
    reverseTerminalGrowth: v.reverse.impliedTerminalGrowth.value,
    reverseRevenueGrowth: v.reverse.impliedRevenueGrowth.value,
    mcMean: v.monteCarlo!.mean,
    mcP5: v.monteCarlo!.p5,
    mcP95: v.monteCarlo!.p95,
    piotroski: v.piotroski.score ?? NaN,
    zScore2025: v.zScores[v.zScores.length - 1].score,
  };
  v.core.forecast.years.forEach((y, k) => (out[`fcff.${y.label}`] = y.fcff));
  d.bridge.forEach((l) => (out[`bridge.${l.id}`] = l.amount));
  v.sensitivity.forEach((g) => g.values.forEach((r, i) => r.forEach((x, j) => (out[`grid.${g.id}.${i}.${j}`] = x))));
  return out;
}
