/**
 * Cloudflare Pages Function: GET /api/rates
 * Serves the merged registry: KV `rates:latest` (Worker output) merged with the
 * git-versioned data/rates.manual.json. A manual entry wins only if its asOf is newer
 * or the Worker entry is fetch_failed. Statuses are recomputed for today.
 * Only public macro data is served; no request body is read.
 */
import manual from '../../data/rates.manual.json';
import type { RatesRegistry } from '../../src/domain/rates';
import { mergeManual, withComputedStatus } from '../../src/data/registry/registry';

interface Env {
  RATES?: { get(key: string): Promise<string | null> };
}

export async function onRequestGet(context: { env: Env }): Promise<Response> {
  let auto: RatesRegistry | null = null;
  let kvError: string | null = null;
  try {
    const raw = context.env.RATES ? await context.env.RATES.get('rates:latest') : null;
    auto = raw ? (JSON.parse(raw) as RatesRegistry) : null;
    if (!context.env.RATES) kvError = 'RATES KV binding not configured';
  } catch (e) {
    kvError = e instanceof Error ? e.message : String(e);
  }
  const merged = mergeManual(auto, manual as unknown as RatesRegistry);
  const body = {
    ...withComputedStatus(merged, new Date().toISOString().slice(0, 10)),
    source: auto ? 'kv+manual' : 'manual',
    kvError,
  };
  return new Response(JSON.stringify(body), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=300' },
  });
}
