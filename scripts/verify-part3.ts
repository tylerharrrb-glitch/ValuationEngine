/**
 * Gate for Part 3: rates registry and live data layer.
 *   1. seed and manual files validate against the schema
 *   2. bounds reject an out-of-range fetched value and keep the last good value
 *   3. staleness returns the right status for synthetic dates (every cycle)
 *   4. two-source agreement rule for policy rates; manual-merge precedence; snapshot diff
 *   5. adapters parse the recorded responses in tests/fixtures/sources/
 *   6. live dry-run: fetches today and prints fetched vs seed values (differences printed, failures listed)
 *
 * Run: npx tsx scripts/verify-part3.ts [--offline]
 */
import { readFileSync } from 'node:fs';
import { Gate } from './lib/gate';
import type { RateEntry, RatesRegistry } from '../src/domain/rates';
import {
  validateRegistry, computeStatus, stalenessInfo, applyAdapterRuns, mergeManual, freezeSnapshot, diffSnapshots, withinBounds,
} from '../src/data/registry/registry';
import {
  parseCbeHomepage, parseCbeMpcPage, parseCbeFxPage, parseCbeTbondAuctions, auctionsToValues,
} from '../src/data/sources/cbe';
import { parseTreasuryXml } from '../src/data/sources/treasury';
import {
  parseCountryPremium, parseCurrencyRiskfree, parseIndustryBetas, parseSyntheticRatings, discoverCountryPremiumWorkbook,
} from '../src/data/sources/damodaran';
import { runAllAdapters, parseRobots, type FetchFn } from '../src/data/sources/refresh';

const g = new Gate('verify-part3');
const seed = JSON.parse(readFileSync('data/rates.seed.json', 'utf8')) as RatesRegistry;
const manual = JSON.parse(readFileSync('data/rates.manual.json', 'utf8')) as RatesRegistry;
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;
const byId = (r: RatesRegistry, id: string) => r.entries.find((e) => e.id === id)!;

// 1. schema ---------------------------------------------------------------
const seedErr = validateRegistry(seed);
g.check('seed validates against schema', seedErr.length === 0, seedErr.join('; ') || `${seed.entries.length} entries`);
const manErr = validateRegistry(manual);
g.check('manual file validates against schema', manErr.length === 0, manErr.join('; ') || `${manual.entries.length} entries`);
const required = [
  'cbe.overnightDeposit', 'cbe.overnightLending', 'cbe.mainOperation', 'cbe.discountRate', 'cbe.inflationTarget', 'cbe.mpcCalendar',
  'eg.cpiUrbanHeadline', 'eg.cpiCore', 'eg.cpiNationwide', 'eg.usdEgp', 'eg.bond10ySecondary', 'eg.tbondAuction.3y', 'us.treasury10y',
  'damodaran.matureErp', 'damodaran.volatilityScalar', 'damodaran.egypt.rating', 'damodaran.egypt.defaultSpread', 'damodaran.egypt.crp',
  'damodaran.egypt.totalErp', 'damodaran.rf.egp', 'damodaran.betas.emerging', 'damodaran.synthetic.large',
  'eg.rating.moodys', 'eg.rating.sp', 'eg.rating.fitch', 'eg.cit', 'eg.dividendWht.listed', 'eg.dividendWht.unlisted',
  'eg.participationExemption', 'eg.stampDuty.perSide', 'eg.cgt.listedShares',
];
const missing = required.filter((id) => !seed.entries.some((e) => e.id === id));
g.check('seed contains every spec 3.3 id', missing.length === 0, missing.join(', ') || `${required.length} ids`);
g.check('seed: S&P is "B (stable)" (not B-)', byId(seed, 'eg.rating.sp').value === 'B (stable)');
g.check('seed: stamp duty 0.05% per side (not 0.125)', byId(seed, 'eg.stampDuty.perSide').value === 0.05);
g.check('seed: EGP 10Y secondary marked stale', byId(seed, 'eg.bond10ySecondary').status === 'stale');
g.check('seed: Fitch marked unconfirmed', byId(seed, 'eg.rating.fitch').status === 'unconfirmed');
const noUrl = seed.entries.filter((e) => e.sourceUrl === 'TO_VERIFY').map((e) => e.id);
console.log(`      entries with sourceUrl TO_VERIFY: ${noUrl.join(', ')}`);

// 2. bounds ---------------------------------------------------------------
const now = '2026-09-23T06:00:00Z';
const bad = applyAdapterRuns(seed, [{ adapter: 'test', ids: [], values: [{ id: 'cbe.overnightDeposit', value: 190, asOf: '2026-09-23', sourceUrl: 'https://www.cbe.org.eg/en/' }] }], now);
g.check('bounds reject a test value (190% deposit rate)', bad.rejected.length === 1 && byId(bad.registry, 'cbe.overnightDeposit').value === 19, JSON.stringify(bad.rejected));
g.check('withinBounds: USD/EGP 0.5 rejected, 51.43 accepted', !withinBounds(byId(seed, 'eg.usdEgp'), 0.5) && withinBounds(byId(seed, 'eg.usdEgp'), 51.43));

// 3. staleness ------------------------------------------------------------
const mk = (cycle: RateEntry['updateCycle'], asOf: string, status: RateEntry['status'] = 'ok'): RateEntry => ({
  id: 'x.y', label: 'x', value: 1, unit: 'pct', nature: 'official', sourceName: 's', sourceUrl: 'https://example.org', asOf,
  verifiedAt: asOf, method: 'manual', updateCycle: cycle, bounds: [0, 10], status,
});
const cal = ['2026-08-20', '2026-09-24'];
const cases: [string, RateEntry, string, string][] = [
  ['daily, 3 business days old (Fri→Wed) = ok', mk('daily', '2026-09-18'), '2026-09-23', 'ok'],
  ['daily, 4 business days old (Thu→Wed) = stale', mk('daily', '2026-09-17'), '2026-09-23', 'stale'],
  ['monthly, 40 days = ok', mk('monthly', '2026-08-14'), '2026-09-23', 'ok'],
  ['monthly, 41 days = stale', mk('monthly', '2026-08-13'), '2026-09-23', 'stale'],
  ['semiannual, 200 days = ok', mk('semiannual', '2026-03-07'), '2026-09-23', 'ok'],
  ['semiannual, 201 days = stale', mk('semiannual', '2026-03-06'), '2026-09-23', 'stale'],
  ['mpc, before 24-Sep MPC = ok', mk('mpc', '2026-08-20'), '2026-09-23', 'ok'],
  ['mpc, day of 24-Sep MPC without new value = stale', mk('mpc', '2026-08-20'), '2026-09-24', 'stale'],
  ['mpc, value recorded after 24-Sep MPC = ok', mk('mpc', '2026-09-24'), '2026-09-30', 'ok'],
  ['event, 3 years old = ok (never auto-stale)', mk('event', '2023-09-23'), '2026-09-23', 'ok'],
  ['fetch_failed stays fetch_failed', mk('daily', '2026-09-22', 'fetch_failed'), '2026-09-23', 'fetch_failed'],
  ['unconfirmed stays unconfirmed', mk('monthly', '2026-09-22', 'unconfirmed'), '2026-09-23', 'unconfirmed'],
];
for (const [label, e, today, want] of cases) {
  const got = computeStatus(e, today, cal);
  g.check(`staleness: ${label}`, got === want, `got ${got}`);
}
const badge = stalenessInfo(byId(seed, 'eg.tbondAuction.3y'), '2026-09-23', cal).badge;
g.check('badge text for stale entry names days and source', /^Stale — 72 days — verify at https:\/\/www\.cbe\.org\.eg/.test(badge), badge);

// 4. agreement, merge, snapshot ---------------------------------------------
const one = applyAdapterRuns(seed, [{ adapter: 'cbe.homepage', ids: [], values: [{ id: 'cbe.overnightDeposit', value: 18, asOf: '2026-09-24', sourceUrl: 'https://www.cbe.org.eg/en/' }] }], '2026-09-24T06:00:00Z');
g.check('policy-rate change from one CBE source only → unconfirmed, value kept', byId(one.registry, 'cbe.overnightDeposit').status === 'unconfirmed' && byId(one.registry, 'cbe.overnightDeposit').value === 19);
const two = applyAdapterRuns(seed, [
  { adapter: 'cbe.homepage', ids: [], values: [{ id: 'cbe.overnightDeposit', value: 18, asOf: '2026-09-24', sourceUrl: 'https://www.cbe.org.eg/en/' }] },
  { adapter: 'cbe.mpcPage', ids: [], values: [{ id: 'cbe.overnightDeposit', value: 18, asOf: '2026-09-24', sourceUrl: 'https://www.cbe.org.eg/en/monetary-policy/mpc-meetings-schedule' }] },
], '2026-09-24T06:00:00Z');
g.check('policy-rate change confirmed by both CBE sources → accepted and logged', byId(two.registry, 'cbe.overnightDeposit').value === 18 && two.changes.length === 1 && byId(two.registry, 'cbe.overnightDeposit').status === 'ok');
const failed = applyAdapterRuns(seed, [{ adapter: 'cbe.fx', ids: ['eg.usdEgp'], values: [], error: 'HTTP 403' }], now);
g.check('failed adapter → fetch_failed, last good value kept', byId(failed.registry, 'eg.usdEgp').status === 'fetch_failed' && byId(failed.registry, 'eg.usdEgp').value === 51.9);
const newer = { ...seed, entries: seed.entries.map((e) => (e.id === 'eg.usdEgp' ? { ...e, value: 51.5, asOf: '2026-09-25' } : e)) };
const m1 = mergeManual(failed.registry, newer);
g.check('merge: manual wins when auto is fetch_failed', byId(m1, 'eg.usdEgp').value === 51.5);
const autoOk = applyAdapterRuns(seed, [{ adapter: 'cbe.fx', ids: ['eg.usdEgp'], values: [{ id: 'eg.usdEgp', value: 51.43, asOf: '2026-09-23', sourceUrl: 'https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates' }] }], now).registry;
g.check('merge: auto wins when manual asOf is not newer', byId(mergeManual(autoOk, manual), 'eg.usdEgp').value === 51.43);
g.check('merge: manual wins when its asOf is newer', byId(mergeManual(autoOk, newer), 'eg.usdEgp').value === 51.5);
const snapA = freezeSnapshot(seed, now);
const snapB = freezeSnapshot(autoOk, now);
const diff = diffSnapshots(snapA, snapB);
g.check('snapshot diff lists exactly the changed entry', diff.length === 1 && diff[0].id === 'eg.usdEgp', JSON.stringify(diff));

// 5. adapters on recorded fixtures -------------------------------------------
const F = (f: string) => readFileSync(`tests/fixtures/sources/${f}`);
const home = parseCbeHomepage(F('cbe-home-2026-09-23.html').toString('utf8'));
g.check('fixture CBE homepage: 19.00 / 20.00 / 19.50, core 14.9, headline 14.5, CPI asOf 2026-08-31',
  home.overnightDeposit === 19 && home.overnightLending === 20 && home.mainOperation === 19.5 && home.coreInflation === 14.9 && home.headlineInflation === 14.5 && home.cpiAsOf === '2026-08-31', JSON.stringify(home));
const mpc = parseCbeMpcPage(F('cbe-mpc-2026-09-23.html').toString('utf8'));
g.check('fixture CBE MPC page: 19.00 / 20.00 / 19.50 / discount 19.50, effective 2026-02-15',
  mpc.overnightDeposit === 19 && mpc.overnightLending === 20 && mpc.mainOperation === 19.5 && mpc.discountRate === 19.5 && mpc.effectiveFrom === '2026-02-15', JSON.stringify(mpc));
const fxp = parseCbeFxPage(F('cbe-fx-2026-09-23.html').toString('utf8'));
g.check('fixture CBE official FX: USD 51.3606 / 51.4956 on 2026-09-23', fxp.usdBuy === 51.3606 && fxp.usdSell === 51.4956 && fxp.date === '2026-09-23', JSON.stringify(fxp));
const auc = auctionsToValues(parseCbeTbondAuctions(F('cbe-tbonds-fixed-2026-09-23.html').toString('utf8')));
g.check('fixture CBE auctions: 3Y accepted weighted avg 23.697 on 2026-09-21', auc.some((v) => v.id === 'eg.tbondAuction.3y' && v.value === 23.697 && v.asOf === '2026-09-21'), JSON.stringify(auc));
const ust = parseTreasuryXml(F('treasury-par-yield-202609.xml').toString('utf8'));
g.check('fixture Treasury XML: latest 10Y 4.96 on 2026-09-22', ust[ust.length - 1].date === '2026-09-22' && ust[ust.length - 1].y10 === 4.96, JSON.stringify(ust[ust.length - 1]));
const cp = parseCountryPremium(F('damodaran-ctrypremJuly26.xlsx'));
g.check('fixture Damodaran July-2026: mature ERP 4.20, Egypt Caa1, CRP 9.2806, default spread 5.9702, scalar 1.5545',
  cp.matureErp === 4.2 && cp.moodysRating === 'Caa1' && near(cp.crp, 9.2806, 1e-4) && near(cp.defaultSpread, 5.9702, 1e-4) && near(cp.volatilityScalar, 1.5545, 1e-4), JSON.stringify(cp));
const cr = parseCurrencyRiskfree(F('damodaran-DiffInflationRiskfree26.xlsx'));
g.check('fixture Damodaran currency riskfree: EGP 10.2044, USD 4.23', near(cr.riskfree, 10.2044, 1e-4) && cr.usdRiskfree === 4.23, JSON.stringify(cr));
const bt = parseIndustryBetas(F('damodaran-betaemerg.xls'));
const chem = bt.rows.find((r) => r.industry === 'Chemical (Basic)');
g.check('fixture Damodaran EM betas: "Chemical (Basic)" unlevered corrected for cash 1.0605, updated 2026-01-05', !!chem && near(chem.unleveredBetaCorrectedForCash, 1.0605, 1e-4) && bt.updated === '2026-01-05', `${chem?.unleveredBetaCorrectedForCash} ${bt.updated} (${bt.rows.length} industries)`);
const syn = parseSyntheticRatings(F('damodaran-ratings.xls'));
g.check('fixture Damodaran synthetic table: large 15 rows, top Aaa/AAA 0.40%, small 15 rows', syn.large.length === 15 && syn.large[14].rating === 'Aaa/AAA' && syn.large[14].spread === 0.4 && syn.small.length === 15);
const disc = discoverCountryPremiumWorkbook(F('damodaran-datacurrent-2026-09-23.html').toString('utf8'));
g.check('fixture Damodaran datacurrent: newest country-risk workbook discovered', disc.url.endsWith('ctrypremJuly26.xlsx') && disc.asOf === '2026-07-01', JSON.stringify(disc));
g.check('robots.txt parser applies User-agent * rules', JSON.stringify(parseRobots('User-agent: *\nDisallow: /private\n\nUser-agent: other\nDisallow: /')) === '["/private"]');

// 6. live dry-run -----------------------------------------------------------------
async function dryRun() {
  console.log('');
  console.log('--- live dry-run (fetched today vs seed) ---');
  const runs = await runAllAdapters(fetch as unknown as FetchFn, { now: new Date(), fredApiKey: process.env.FRED_API_KEY, includeDamodaran: true });
  const pad = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n));
  console.log(`${pad('adapter', 26)} ${pad('id', 32)} ${pad('seed value', 14)} ${pad('seed asOf', 11)} ${pad('fetched value', 14)} ${pad('fetched asOf', 12)} diff`);
  let okAdapters = 0;
  const failures: string[] = [];
  for (const r of runs) {
    if (r.error) {
      failures.push(`${r.adapter}: ${r.error}`);
      console.log(`${pad(r.adapter, 26)} FETCH_FAILED: ${r.error}`);
      continue;
    }
    okAdapters++;
    for (const v of r.values) {
      const s = seed.entries.find((e) => e.id === v.id);
      const sv = s ? (Array.isArray(s.value) ? `[${s.value.length} rows]` : String(s.value)) : '(new id)';
      const fv = Array.isArray(v.value) ? `[${v.value.length} rows]` : String(v.value);
      const same = s && JSON.stringify(s.value) === JSON.stringify(v.value);
      console.log(`${pad(r.adapter, 26)} ${pad(v.id, 32)} ${pad(sv, 14)} ${pad(s?.asOf ?? '', 11)} ${pad(fv, 14)} ${pad(v.asOf, 12)} ${same ? 'same' : 'DIFFERENT'}`);
    }
  }
  g.check('live dry-run executed and printed every adapter', runs.length === 9, `${okAdapters} adapters returned values, ${failures.length} fetch_failed${failures.length ? ': ' + failures.join(' | ') : ''}`);
}

(async () => {
  if (process.argv.includes('--offline')) console.log('(live dry-run skipped: --offline)');
  else await dryRun();
  g.finish();
})();
