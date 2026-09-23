/**
 * Part 6: unit tests of every kept secondary module on MOPCO.
 * Expected values were computed independently from the audited figures (not by the engine).
 * Peers, deals and segments below are TEST INPUTS for arithmetic checks, not market data.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadMopco } from '../lib/fixtures';
import type { RatesSnapshot } from '../../src/domain/rates';
import type { PeerInput, TransactionInput } from '../../src/domain/secondary';
import { buildDefaultAssumptions } from '../../src/engine/defaults';
import { runCore } from '../../src/engine/core';
import { runComps, runPrecedents, runSotp, brokerBand, stats, peerMultiples } from '../../src/engine/relative';
import { piotroski, altmanZem, dupont, creditMetrics, ZEM } from '../../src/engine/scores';
import { runFxSensitivity } from '../../src/engine/fx';
import { easReferences } from '../../src/engine/eas';
import { blend } from '../../src/engine/blend';

const snap = JSON.parse(readFileSync('tests/fixtures/rates-snapshot-2026-09-23.json', 'utf8')) as RatesSnapshot;
const c = loadMopco();
const a = buildDefaultAssumptions(c, snap, { betaIndustry: 'Chemical (Basic)' });
const core = runCore(c, a, snap);
const SHARES = 2_868_140_263;
const BRIDGE = 2_971_664_846 + 2_573_762_308 + 734_010_745 + 10_659_141_927 + 2_424_170 - 149_970_052 - (75_958_208 + 616_126_433);

const peer = (name: string, price: number, ebitda: number, ni: number): PeerInput => ({
  name, ticker: name, currency: 'EGP', price, priceDate: '2026-07-01', shares: 1_000_000_000, debt: 2_000_000_000, cash: 1_000_000_000,
  minorityInterest: 0, revenueLtm: 20_000_000_000, ebitdaLtm: ebitda, ebitdaNtm: null, netIncomeLtm: ni, netIncomeNtm: null,
  bookEquity: 10_000_000_000, source: 'test input', sourceDate: '2026-07-01',
});

describe('stats', () => {
  it('median, quartiles (type 7), mean', () => {
    const s = stats([4, 1, 3, 2, NaN])!;
    expect(s).toMatchObject({ n: 4, min: 1, max: 4, median: 2.5, mean: 2.5 });
    expect(s.q1).toBeCloseTo(1.75, 12);
    expect(s.q3).toBeCloseTo(3.25, 12);
    expect(stats([])).toBeNull();
  });
});

describe('comparables', () => {
  it('computes peer multiples from raw inputs', () => {
    const m = peerMultiples(peer('P1', 20, 5_000_000_000, 2_000_000_000));
    expect(m.enterpriseValue).toBe(20_000_000_000 + 2_000_000_000 - 1_000_000_000);
    expect(m.evEbitdaLtm).toBeCloseTo(4.2, 12);
    expect(m.peLtm).toBeCloseTo(10, 12);
    expect(m.pb).toBeCloseTo(2, 12);
  });
  it('negative earnings give no multiple', () => {
    expect(Number.isNaN(peerMultiples(peer('P2', 20, -1, -1)).evEbitdaLtm)).toBe(true);
  });
  it('implied MOPCO value uses median EV/EBITDA on normalized EBITDA through the bridge', () => {
    const peers = [peer('A', 20, 5e9, 2e9), peer('B', 30, 5e9, 2e9), peer('C', 40, 5e9, 2e9)];
    const r = runComps(c, peers, core.norm, core.forecast, core.dcf.bridge);
    const median = (30e9 + 1e9) / 5e9; // peer B EV / EBITDA = 6.2x
    expect(r.stats.evEbitdaLtm!.median).toBeCloseTo(median, 12);
    expect(r.methodValue.value!).toBeCloseTo((median * 14_748_649_049 + BRIDGE) / SHARES, 9);
  });
  it('no peers: excluded and flagged, never replaced by a default peer set', () => {
    const r = runComps(c, [], core.norm, core.forecast, core.dcf.bridge);
    expect(r.methodValue.value).toBeNull();
    expect(r.methodValue.reason).toBe('no peers entered');
    const b = blend({ dcf: 60, ddm: 20, comps: 20, precedents: 0, sotp: 0 }, [{ id: 'dcf', value: 30 }, { id: 'ddm', value: 20 }, r.methodValue], 36);
    expect(b.rows.find((x) => x.id === 'comps')!.included).toBe(false);
    expect(b.blendedValue).toBeCloseTo(0.75 * 30 + 0.25 * 20, 12);
    expect(b.messages.some((m) => m.code === 'blend_excluded_comps')).toBe(true);
  });
});

describe('precedent transactions', () => {
  it('median EV/EBITDA on normalized EBITDA through the bridge', () => {
    const deal = (ev: number, ebitda: number): TransactionInput => ({ target: 't', acquirer: 'a', date: '2025-01-01', enterpriseValue: ev, revenue: ev / 2, ebitda, currency: 'EGP', source: 'test input' });
    const r = runPrecedents(c, [deal(80, 10), deal(60, 10), deal(100, 10)], core.norm, core.dcf.bridge);
    expect(r.stats.evEbitda!.median).toBe(8);
    expect(r.methodValue.value!).toBeCloseTo((8 * 14_748_649_049 + BRIDGE) / SHARES, 9);
  });
});

describe('SOTP', () => {
  it('sums segment EVs and applies the corporate bridge once', () => {
    const r = runSotp(c, [
      { name: 'Urea', method: 'multiple', ebitda: 10e9, multiple: 5, value: 0, source: 'test input' },
      { name: 'Ammonia', method: 'value', ebitda: 0, multiple: 0, value: 20e9, source: 'test input' },
    ], core.dcf.bridge);
    expect(r.enterpriseValue).toBe(70e9);
    expect(r.perShare).toBeCloseTo((70e9 + BRIDGE) / SHARES, 9);
    expect(runSotp(c, [], core.dcf.bridge).methodValue.value).toBeNull();
  });
});

describe('broker reference band', () => {
  it('range only; not part of the blend inputs', () => {
    const b = brokerBand([{ broker: 'X', target: 43, date: '2026-07-01', rating: 'n/a', sourceUrl: 'TO_VERIFY' }, { broker: 'Y', target: 40, date: '2026-06-01', rating: 'n/a', sourceUrl: 'TO_VERIFY' }])!;
    expect([b.low, b.high, b.median]).toEqual([40, 43, 41.5]);
    expect(brokerBand([])).toBeNull();
  });
});

describe('Piotroski F-score (MOPCO FY2025 vs FY2024)', () => {
  const p = piotroski(c);
  it('is available with two years and scores 6', () => {
    expect(p.available).toBe(true);
    expect(p.tests.map((t) => t.score)).toEqual([1, 1, 0, 0, 1, 0, 1, 1, 1]);
    expect(p.score).toBe(6);
  });
  it('current ratios 2.0389 and 3.9701', () => {
    expect(p.tests[5].current).toBeCloseTo(2.038893634292686, 12);
    expect(p.tests[5].prior).toBeCloseTo(3.9701369230263883, 12);
  });
  it('N/A with one year', () => {
    expect(piotroski({ ...c, years: [c.years[1]] }).available).toBe(false);
  });
});

describe("Altman Z''-EM", () => {
  it('MOPCO FY2025 = 9.9286 (safe), FY2024 = 10.1515', () => {
    const z = altmanZem(c.years[1]);
    expect(z.score).toBeCloseTo(9.928642001333351, 10);
    expect(z.zone).toBe('Safe');
    expect(altmanZem(c.years[0]).score).toBeCloseTo(10.151482052633831, 10);
  });
  it('uses the published coefficients and zones', () => {
    expect(ZEM).toEqual({ constant: 3.25, c1: 6.56, c2: 3.26, c3: 6.72, c4: 1.05, safe: 5.85, distress: 4.35 });
  });
});

describe('DuPont', () => {
  it('3-step and 5-step both equal ROE on average equity (24.25%)', () => {
    const d = dupont(c);
    expect(d.roe3).toBeCloseTo(0.24245422575981831, 12);
    expect(d.roe5).toBeCloseTo(0.24245422575981837, 12);
    expect(d.averageBalances).toBe(true);
  });
});

describe('credit metrics', () => {
  it('net cash, interest cover on debt and lease interest only, FFO / debt', () => {
    const m = creditMetrics(c);
    expect(m.netDebtToEbitda).toBeCloseTo(-1.0987986347628313, 12);
    expect(m.interestCover).toBeCloseTo(1832.5199405181459, 9);
    expect(m.ffo).toBe(14_207_492_181);
    expect(m.ffoToDebt).toBeCloseTo(94.73552880411084, 9);
  });
});

describe('FX sensitivity', () => {
  it('requires a USD cost share (no default); export share pre-filled 79.97%', () => {
    expect(a.fx.usdRevenueShare!.toFixed(2)).toBe('79.97');
    expect(a.fx.usdCostShare).toBeNull();
    expect(runFxSensitivity(c, a, snap, core.dcf.perShare).available).toBe(false);
  });
  it('EGP weaker raises value when USD revenue share exceeds USD cost share; base row unchanged', () => {
    const r = runFxSensitivity(c, { ...a, fx: { usdRevenueShare: 79.97, usdCostShare: 40 } }, snap, core.dcf.perShare);
    expect(r.rows.map((x) => x.move)).toEqual([-0.2, -0.1, 0, 0.1, 0.2]);
    expect(r.rows[2].perShare).toBe(core.dcf.perShare);
    expect(r.rows[3].perShare).toBeGreaterThan(r.rows[2].perShare);
    expect(r.rows[1].perShare).toBeLessThan(r.rows[2].perShare);
  });
  it('zero shares: no effect', () => {
    const r = runFxSensitivity(c, { ...a, fx: { usdRevenueShare: 0, usdCostShare: 0 } }, snap, core.dcf.perShare);
    for (const row of r.rows) expect(row.perShare).toBeCloseTo(core.dcf.perShare, 9);
  });
});

describe('EAS panel', () => {
  it('lists only standards evidenced by statement lines', () => {
    const refs = easReferences(c);
    expect(refs.map((r) => r.standard)).toEqual(['EAS 47', 'EAS 48', 'EAS 49']);
    expect(refs[2].text).toContain('EGP 149,970,052');
  });
});
