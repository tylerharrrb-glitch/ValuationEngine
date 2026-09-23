/**
 * Runs every source adapter with an injected fetch (Worker `fetch` or Node `fetch`).
 * Shared by workers/rates-refresh and scripts/rates-dry-run.ts so both execute the same code.
 *
 * Etiquette: identifying User-Agent, robots.txt checked per host, one request per page per run.
 * A blocked request, an HTTP error, a WAF rejection page, or a layout change throws; the
 * adapter is then reported with `error` and the registry keeps the last good value.
 */
import type { AdapterRun } from '../registry/registry';
import { WOLF_USER_AGENT } from './types';
import {
  CBE_URLS, parseCbeHomepage, parseCbeMpcPage, parseCbeFxPage, parseCbeTbondAuctions,
  homepageToValues, mpcPageToValues, fxToValues, auctionsToValues,
} from './cbe';
import { treasuryXmlUrl, parseTreasuryXml, treasuryToValues, fredDgs10Url, parseFredDgs10 } from './treasury';
import {
  DAMODARAN_URLS, parseCountryPremium, parseIndustryBetas, parseSyntheticRatings, parseCurrencyRiskfree,
  countryPremiumToValues, currencyRiskfreeToValues, discoverCountryPremiumWorkbook, betasToValues, ratingsToValues,
} from './damodaran';

export type FetchFn = (url: string, init?: { headers?: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  arrayBuffer(): Promise<ArrayBuffer>;
}>;

const robotsCache = new Map<string, string[]>();

/** Disallow prefixes for `User-agent: *` and for our agent token. */
export function parseRobots(txt: string, agentToken = 'wolf-rates-refresh'): string[] {
  const out: string[] = [];
  let applies = false;
  let sawRuleSinceAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (!line) continue;
    const [k, ...rest] = line.split(':');
    const key = k.trim().toLowerCase();
    const val = rest.join(':').trim();
    if (key === 'user-agent') {
      if (sawRuleSinceAgent) {
        applies = false;
        sawRuleSinceAgent = false;
      }
      if (val === '*' || val.toLowerCase().includes(agentToken)) applies = true;
    } else if (key === 'disallow' || key === 'allow') {
      sawRuleSinceAgent = true;
      if (applies && key === 'disallow' && val) out.push(val);
    }
  }
  return out;
}

async function robotsAllows(fetchFn: FetchFn, url: string): Promise<boolean> {
  const u = new URL(url);
  if (!robotsCache.has(u.host)) {
    let rules: string[] = [];
    try {
      const r = await fetchFn(`${u.protocol}//${u.host}/robots.txt`, { headers: { 'User-Agent': WOLF_USER_AGENT } });
      const t = r.ok ? await r.text() : '';
      rules = /user-agent/i.test(t) ? parseRobots(t) : [];
    } catch {
      rules = [];
    }
    robotsCache.set(u.host, rules);
  }
  return !robotsCache.get(u.host)!.some((p) => u.pathname.startsWith(p));
}

async function get(fetchFn: FetchFn, url: string, kind: 'text' | 'bytes' = 'text'): Promise<string | ArrayBuffer> {
  if (!(await robotsAllows(fetchFn, url))) throw new Error(`disallowed by robots.txt: ${url}`);
  const r = await fetchFn(url, { headers: { 'User-Agent': WOLF_USER_AGENT } });
  if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
  if (kind === 'bytes') return r.arrayBuffer();
  const t = await r.text();
  if (/<title>\s*Request Rejected\s*<\/title>/i.test(t)) throw new Error(`request rejected by site firewall: ${url}`);
  return t;
}

async function run(adapter: string, ids: string[], fn: () => Promise<AdapterRun['values']>): Promise<AdapterRun> {
  try {
    return { adapter, ids, values: await fn() };
  } catch (e) {
    return { adapter, ids, values: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export interface RefreshOptions {
  now: Date;
  fredApiKey?: string;
  /** Include the semiannual Damodaran workbooks. */
  includeDamodaran: boolean;
}

export async function runAllAdapters(fetchFn: FetchFn, opts: RefreshOptions): Promise<AdapterRun[]> {
  const today = opts.now.toISOString().slice(0, 10);
  const yyyymm = today.slice(0, 7).replace('-', '');
  const runs: Promise<AdapterRun>[] = [
    run('cbe.homepage', ['cbe.overnightDeposit', 'cbe.overnightLending', 'cbe.mainOperation', 'eg.cpiUrbanHeadline', 'eg.cpiCore'], async () =>
      homepageToValues(parseCbeHomepage((await get(fetchFn, CBE_URLS.home)) as string), today)),
    run('cbe.mpcPage', ['cbe.discountRate'], async () =>
      mpcPageToValues(parseCbeMpcPage((await get(fetchFn, CBE_URLS.mpc)) as string), today)),
    run('cbe.fx', ['eg.usdEgp'], async () => fxToValues(parseCbeFxPage((await get(fetchFn, CBE_URLS.fx)) as string))),
    run('cbe.auctions', ['eg.tbondAuction.3y'], async () =>
      auctionsToValues(parseCbeTbondAuctions((await get(fetchFn, CBE_URLS.tbondsFixed)) as string))),
    run('us.treasury', ['us.treasury10y'], async () => {
      try {
        let pts = parseTreasuryXmlSafe((await get(fetchFn, treasuryXmlUrl(yyyymm))) as string);
        if (pts.length === 0) {
          const prev = new Date(Date.UTC(opts.now.getUTCFullYear(), opts.now.getUTCMonth() - 1, 1)).toISOString().slice(0, 7).replace('-', '');
          pts = parseTreasuryXml((await get(fetchFn, treasuryXmlUrl(prev))) as string);
        }
        return treasuryToValues(pts[pts.length - 1], treasuryXmlUrl(yyyymm));
      } catch (e) {
        if (!opts.fredApiKey) throw e;
        const p = parseFredDgs10((await get(fetchFn, fredDgs10Url(opts.fredApiKey))) as string);
        return treasuryToValues(p, 'https://fred.stlouisfed.org/series/DGS10');
      }
    }),
  ];
  if (opts.includeDamodaran) {
    runs.push(
      run('damodaran.countryPremium', ['damodaran.matureErp', 'damodaran.volatilityScalar', 'damodaran.egypt.rating', 'damodaran.egypt.defaultSpread', 'damodaran.egypt.crp', 'damodaran.egypt.totalErp'], async () =>
      {
        const wbk = discoverCountryPremiumWorkbook((await get(fetchFn, DAMODARAN_URLS.dataCurrent)) as string);
        return countryPremiumToValues(parseCountryPremium((await get(fetchFn, wbk.url, 'bytes')) as ArrayBuffer), wbk.url, wbk.asOf);
      }),
      run('damodaran.currencyRiskfree', ['damodaran.rf.egp', 'damodaran.rf.usd', 'damodaran.expectedInflation.egp', 'damodaran.expectedInflation.usd'], async () =>
        currencyRiskfreeToValues(parseCurrencyRiskfree((await get(fetchFn, DAMODARAN_URLS.currencyRiskfreeJuly26, 'bytes')) as ArrayBuffer), DAMODARAN_URLS.currencyRiskfreeJuly26)),
      run('damodaran.betas', ['damodaran.betas.emerging'], async () =>
        betasToValues(parseIndustryBetas((await get(fetchFn, DAMODARAN_URLS.betasEmerging, 'bytes')) as ArrayBuffer), DAMODARAN_URLS.betasEmerging)),
      run('damodaran.ratings', ['damodaran.synthetic.large', 'damodaran.synthetic.small'], async () =>
        ratingsToValues(parseSyntheticRatings((await get(fetchFn, DAMODARAN_URLS.ratings, 'bytes')) as ArrayBuffer), DAMODARAN_URLS.ratings, '2026-01-01')),
    );
  }
  return Promise.all(runs);
}

/** Early in a month the current-month feed can be empty; returns [] instead of throwing. */
function parseTreasuryXmlSafe(xml: string) {
  try {
    return parseTreasuryXml(xml);
  } catch {
    return [];
  }
}
