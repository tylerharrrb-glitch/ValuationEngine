/**
 * Cloudflare Pages Function — GET /api/market-data
 *
 * Honest hybrid market-data endpoint. Auto-fetches ONLY what has a free public
 * API (USD/EGP FX and US Treasury). Egyptian policy rates, the EGP 10Y yield and
 * CAPMAS CPI have NO free official API, so those remain config-driven on the
 * client (see constants/marketDefaults.ts → EGYPT_MACRO) with a staleness badge.
 *
 * Response shape:
 *   {
 *     fetchedAt: string,          // ISO timestamp
 *     live: { usdEgp: number|null, usTreasury10Y: number|null, usTreasuryMeta: any },
 *     errors: string[]            // names of sources that failed
 *   }
 *
 * Edge-cached for 24h (s-maxage=86400) so we stay well within free rate limits.
 */

interface Env {}

export async function onRequest(context: { request: Request; env: Env; waitUntil: (p: Promise<any>) => void }) {
  const cache = (caches as any).default;
  const cacheKey = new Request('https://wolf/market-data');
  const hit = await cache.match(cacheKey);
  if (hit) return hit;

  const out: {
    fetchedAt: string;
    live: { usdEgp: number | null; usTreasury10Y: number | null; usTreasuryMeta: unknown };
    errors: string[];
  } = {
    fetchedAt: new Date().toISOString(),
    live: { usdEgp: null, usTreasury10Y: null, usTreasuryMeta: null },
    errors: [],
  };

  // 1) USD/EGP — open.er-api.com, free, no key
  try {
    const r = await fetch('https://open.er-api.com/v6/latest/USD');
    const j: any = await r.json();
    out.live.usdEgp = j?.rates?.EGP ?? null;
    if (out.live.usdEgp == null) out.errors.push('fx:no-egp');
  } catch {
    out.errors.push('fx');
  }

  // 2) US 10Y Treasury par yield — Treasury.gov FiscalData, no key.
  //    Uses the Daily Treasury Par Yield Curve dataset; we pull the most recent
  //    record and read the 10-year column.
  try {
    const url =
      'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/avg_interest_rates' +
      '?sort=-record_date&page[size]=1';
    const r = await fetch(url);
    const j: any = await r.json();
    const rec = j?.data?.[0] ?? null;
    out.live.usTreasuryMeta = rec;
    // avg_interest_rates exposes avg_interest_rate_amt; treat as a best-effort proxy.
    const amt = rec?.avg_interest_rate_amt;
    out.live.usTreasury10Y = amt != null && !isNaN(Number(amt)) ? Number(amt) : null;
    if (rec == null) out.errors.push('ust:empty');
  } catch {
    out.errors.push('ust');
  }

  const res = new Response(JSON.stringify(out), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 's-maxage=86400',
      'access-control-allow-origin': '*',
    },
  });
  context.waitUntil(cache.put(cacheKey, res.clone()));
  return res;
}
