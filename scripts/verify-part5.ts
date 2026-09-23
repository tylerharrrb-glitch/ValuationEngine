/**
 * Gate for Part 5 (the core gate): the TypeScript engine and the independent Python
 * reference (scripts/reference/wolf_reference.py, written from docs/METHODOLOGY.md)
 * run on identical inputs (MOPCO fixture + frozen snapshot tests/fixtures/rates-snapshot-2026-09-23.json).
 * PASS only if per-share values agree within 0.01 EGP and all amounts within 1 EGP.
 */
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { Gate } from './lib/gate';
import { loadMopco } from '../tests/lib/fixtures';
import { buildDefaultAssumptions } from '../src/engine/defaults';
import { runValuation } from '../src/engine/valuation';
import type { RatesSnapshot } from '../src/domain/rates';

const SNAP = 'tests/fixtures/rates-snapshot-2026-09-23.json';
const INDUSTRY = 'Chemical (Basic)';
const g = new Gate('verify-part5');

const snap = JSON.parse(readFileSync(SNAP, 'utf8')) as RatesSnapshot;
const c = loadMopco();
const a = buildDefaultAssumptions(c, snap, { betaIndustry: INDUSTRY });
const v = runValuation(c, a, snap, { monteCarloRuns: 2000 });
const core = v.core;

const out = join(mkdtempSync(join(tmpdir(), 'wolf-ref-')), 'ref.json');
const py = process.platform === 'win32' ? 'python' : 'python3';
execFileSync(py, ['scripts/reference/wolf_reference.py', 'tests/fixtures/mopco-fy2025.json', SNAP, '--industry', INDUSTRY, '--out', out]);
const ref = JSON.parse(readFileSync(out, 'utf8'));

type Kind = 'amount' | 'pershare' | 'rate' | 'ratio';
const rows: { name: string; engine: number; ref: number; kind: Kind }[] = [];
const add = (name: string, engine: number, r: number, kind: Kind) => rows.push({ name, engine, ref: r, kind });

add('Normalized EBIT', core.norm.normalizedEbit, ref.normalizedEbit, 'amount');
add('Normalized EBITDA', core.norm.normalizedEbitda, ref.normalizedEbitda, 'amount');
add('Reported EBITDA', core.norm.reportedEbitda, ref.reportedEbitda, 'amount');
add('Risk-free rate (%)', core.wacc.rf, ref.rf, 'rate');
add('Unlevered beta', core.wacc.unleveredBeta, ref.betaU, 'ratio');
add('D/E', core.wacc.debtToEquity, ref.debtToEquity, 'ratio');
add('Levered beta', core.wacc.leveredBeta, ref.betaL, 'ratio');
add('Ke (%)', core.wacc.ke, ref.ke, 'rate');
add('Kd pre-tax (%)', core.wacc.kdPreTax, ref.kd, 'rate');
add('E/V', core.wacc.equityWeight, ref.equityWeight, 'ratio');
add('D/V', core.wacc.debtWeight, ref.debtWeight, 'ratio');
add('WACC (%)', core.wacc.wacc, ref.wacc, 'rate');
add('Terminal capex % revenue', a.terminal.drivers.capexPctRevenue / 100, ref.terminalCapexPct, 'ratio');
core.forecast.years.forEach((y, k) => {
  const r = ref.forecast[k];
  add(`${y.label} revenue`, y.revenue, r.revenue, 'amount');
  add(`${y.label} EBITDA`, y.ebitda, r.ebitda, 'amount');
  add(`${y.label} D&A`, y.da, r.da, 'amount');
  add(`${y.label} NOPAT`, y.nopat, r.nopat, 'amount');
  add(`${y.label} capex`, y.capex, r.capex, 'amount');
  add(`${y.label} change in NWC`, y.deltaNwc, r.deltaNwc, 'amount');
  add(`${y.label} distributions`, y.distributions, r.distributions, 'amount');
  add(`${y.label} FCFF`, y.fcff, r.fcff, 'amount');
  add(`${y.label} stub fraction`, core.dcf.rows[k].period.fraction, ref.periods[k].fraction, 'ratio');
  add(`${y.label} years from valuation date`, core.dcf.rows[k].period.years, ref.periods[k].years, 'ratio');
  add(`${y.label} discount factor`, core.dcf.rows[k].discountFactor, ref.periods[k].df, 'ratio');
  add(`${y.label} PV`, core.dcf.rows[k].pv, ref.periods[k].pv, 'amount');
});
add('Terminal-year FCFF', core.forecast.terminal.fcff, ref.terminal.fcff, 'amount');
add('Sum of PV', core.dcf.sumPv, ref.sumPv, 'amount');
add('TV discount factor', core.dcf.terminal.discountFactor, ref.dfTv, 'ratio');
add('Gordon TV', core.dcf.terminal.gordonTv, ref.gordonTv, 'amount');
add('PV Gordon TV', core.dcf.terminal.gordonPv, ref.gordonPv, 'amount');
add('Exit multiple (x)', a.terminal.exitMultiple.value, ref.exitMultiple, 'ratio');
add('Exit TV', core.dcf.terminal.exitTv, ref.exitTv, 'amount');
add('PV exit TV', core.dcf.terminal.exitPv, ref.exitPv, 'amount');
add('Enterprise value', core.dcf.enterpriseValue, ref.enterpriseValue, 'amount');
for (const l of core.dcf.bridge.filter((x) => !x.memo)) add(`Bridge: ${l.label}`, l.amount, ref.bridge[l.id], 'amount');
add('Memo: restricted deposits (excluded)', core.dcf.bridge.find((x) => x.memo)!.amount, ref.restrictedMemo, 'amount');
add('Equity value', core.dcf.equityValue, ref.equityValue, 'amount');
add('DCF value per share', core.dcf.perShare, ref.perShare, 'pershare');
add('DDM DPS', v.ddm.dps0, ref.ddm.dps0, 'pershare');
add('DDM high growth', v.ddm.highGrowth / 100, ref.ddm.gH, 'ratio');
add('DDM two-stage per share', v.ddm.twoStage, ref.ddm.twoStage, 'pershare');
add('DDM H-model per share', v.ddm.hModel, ref.ddm.hModel, 'pershare');
add('Blended value per share', v.blend.blendedValue, ref.blended, 'pershare');

const tol: Record<Kind, number> = { amount: 1, pershare: 0.01, rate: 1e-6, ratio: 1e-9 };
const fmt = (x: number, k: Kind) =>
  k === 'amount' ? x.toLocaleString('en-US', { maximumFractionDigits: 2 }) : k === 'pershare' ? x.toFixed(4) : k === 'rate' ? x.toFixed(6) : x.toPrecision(10);
const w1 = Math.max(...rows.map((r) => r.name.length));
console.log(`${'Item'.padEnd(w1)}  ${'Engine (TS)'.padStart(22)}  ${'Reference (Python)'.padStart(22)}  ${'Difference'.padStart(14)}  Tol`);
let worstAmount = 0;
let worstShare = 0;
let failures = 0;
for (const r of rows) {
  const diff = r.engine - r.ref;
  const ok = Math.abs(diff) <= tol[r.kind];
  if (!ok) failures++;
  if (r.kind === 'amount') worstAmount = Math.max(worstAmount, Math.abs(diff));
  if (r.kind === 'pershare') worstShare = Math.max(worstShare, Math.abs(diff));
  console.log(`${r.name.padEnd(w1)}  ${fmt(r.engine, r.kind).padStart(22)}  ${fmt(r.ref, r.kind).padStart(22)}  ${diff.toExponential(2).padStart(14)}  ${ok ? 'ok' : 'OUT'}`);
}
console.log('');
g.check('every intermediate agrees within tolerance', failures === 0, `${rows.length} items, ${failures} outside tolerance`);
g.check('all amounts within 1 EGP', worstAmount <= 1, `largest amount difference ${worstAmount.toExponential(2)} EGP`);
g.check('per-share values within 0.01 EGP', worstShare <= 0.01, `largest per-share difference ${worstShare.toExponential(2)} EGP`);

// Engine properties from METHODOLOGY (independent of the reference)
g.check('stub fraction = YEARFRAC(2026-07-02, 2026-12-31) = 182/365', Math.abs(core.timeline.stubFraction - 182 / 365) < 1e-12, core.timeline.stubFraction.toFixed(8));
g.check('scenario probabilities sum to 100%', v.scenarios.probabilitySum === 100);
g.check('sensitivity centres (WACC×g, growth×margin, Rf×beta) equal the DCF value', ['wacc_g', 'growth_margin', 'rf_beta'].every((id) => Math.abs(v.sensitivity.find((x) => x.id === id)!.centre - core.dcf.perShare) < 1e-9));
g.check('DDM DPS excludes employee/board distributions (2.5373, not 3.08)', v.ddm.dps0.toFixed(4) === '2.5373');
g.check('Kd uses debt and lease interest only (coverage on 7,072,409 EGP)', Math.abs((core.wacc.interestCoverage ?? 0) - core.norm.normalizedEbit / 7_072_409) < 1e-6);
g.check('restricted deposits excluded from the bridge', core.dcf.bridge.find((l) => l.id === 'restricted')?.memo === true);
g.check('verdict uses band language only', /^Implied upside -?\d+\.\d%$/.test(v.blend.verdict.text) && ['In line with market price', 'Above market price', 'Below market price'].includes(v.blend.verdict.band));
const rev = v.reverse.impliedTerminalGrowth;
g.check('reverse DCF: solved g reproduces the price within 0.01 EGP', rev.attainable && Math.abs(runValuation(c, { ...a, terminal: { ...a.terminal, growth: { ...a.terminal.growth, value: rev.value } } }, snap, { monteCarlo: false }).core.dcf.perShare - c.price) < 0.01);

console.log('');
console.log('MOPCO results (frozen snapshot seed-2026-09-23, default assumptions, no tuning):');
console.log(`  WACC ${core.wacc.wacc.toFixed(4)}%  Ke ${core.wacc.ke.toFixed(4)}%  terminal growth ${core.growth.toFixed(2)}%`);
console.log(`  Enterprise value        ${core.dcf.enterpriseValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
for (const l of core.dcf.bridge) console.log(`  ${l.memo ? '(memo, excluded) ' : ''}${l.label.padEnd(48)} ${l.amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
console.log(`  Equity value            ${core.dcf.equityValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`);
console.log(`  DCF value per share     ${core.dcf.perShare.toFixed(2)} EGP`);
console.log(`  DDM value per share     ${v.ddm.twoStage.toFixed(2)} EGP (two-stage)`);
console.log(`  Blended value per share ${v.blend.blendedValue.toFixed(2)} EGP (DCF ${v.blend.rows[0].effectiveWeight}% / DDM ${v.blend.rows[1].effectiveWeight}%)`);
console.log(`  Price 36.00 (01-Jul-2026): ${v.blend.verdict.text}, ${v.blend.verdict.band}`);
g.finish();
