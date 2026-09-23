/**
 * WOLF rates-refresh Worker.
 *  - Cron Trigger (wrangler.toml): daily 06:00 UTC.
 *  - POST /refresh with header "Authorization: Bearer <REFRESH_SECRET>" runs a manual refresh
 *    (?damodaran=1 also re-reads the semiannual Damodaran workbooks).
 * KV namespace RATES keys:
 *   rates:latest          current registry (RatesRegistry JSON)
 *   rates:YYYY-MM-DD      daily snapshot
 *   rates:changelog       JSON array of { id, old, new, date, source }
 */
import seed from '../../../data/rates.seed.json';
import type { RatesRegistry, RateChange } from '../../../src/domain/rates';
import { applyAdapterRuns } from '../../../src/data/registry/registry';
import { runAllAdapters, type FetchFn } from '../../../src/data/sources/refresh';

interface KV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

export interface Env {
  RATES: KV;
  REFRESH_SECRET?: string;
  FRED_API_KEY?: string;
}

async function refresh(env: Env, includeDamodaran: boolean) {
  const now = new Date();
  const nowIso = now.toISOString();
  const prevRaw = await env.RATES.get('rates:latest');
  const prev: RatesRegistry = prevRaw ? JSON.parse(prevRaw) : (seed as unknown as RatesRegistry);
  const runs = await runAllAdapters(fetch as unknown as FetchFn, { now, fredApiKey: env.FRED_API_KEY, includeDamodaran });
  const out = applyAdapterRuns(prev, runs, nowIso);
  await env.RATES.put('rates:latest', JSON.stringify(out.registry));
  await env.RATES.put(`rates:${nowIso.slice(0, 10)}`, JSON.stringify(out.registry));
  if (out.changes.length) {
    const log: RateChange[] = JSON.parse((await env.RATES.get('rates:changelog')) ?? '[]');
    await env.RATES.put('rates:changelog', JSON.stringify([...log, ...out.changes]));
  }
  return { snapshotId: out.registry.snapshotId, log: out.log, changes: out.changes, rejected: out.rejected };
}

export default {
  async scheduled(_event: unknown, env: Env, ctx: { waitUntil(p: Promise<unknown>): void }) {
    // Damodaran workbooks are semiannual: read them on the 1st and 15th of each month.
    const d = new Date().getUTCDate();
    ctx.waitUntil(refresh(env, d === 1 || d === 15));
  },

  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (req.method !== 'POST' || url.pathname !== '/refresh') return new Response('Not found', { status: 404 });
    const auth = req.headers.get('authorization') ?? '';
    if (!env.REFRESH_SECRET || auth !== `Bearer ${env.REFRESH_SECRET}`) return new Response('Unauthorized', { status: 401 });
    const result = await refresh(env, url.searchParams.get('damodaran') === '1');
    return new Response(JSON.stringify(result, null, 2), { headers: { 'content-type': 'application/json' } });
  },
};
