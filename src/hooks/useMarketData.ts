/**
 * useMarketData — honest hybrid market-data hook.
 *
 * AUTO (live, free public APIs, via /api/market-data):
 *   • USD/EGP FX
 *   • US 10Y Treasury (best-effort proxy)
 *
 * CONFIG (maintained, NO free official API — do NOT claim these are "live"):
 *   • CBE policy rates ....... cbe.org.eg          (8 MPC meetings/yr)
 *   • EGP 10Y bond yield ..... investing.com Egypt 10Y
 *   • CAPMAS headline CPI .... capmas.gov.eg       (monthly)
 * These come from EGYPT_MACRO (constants/marketDefaults.ts) and are surfaced with
 * an `asOfDate` + staleness badge. An analyst edits that single block after each
 * CBE MPC meeting / CAPMAS CPI release.
 */
import { useCallback, useEffect, useState } from 'react';
import { EGYPT_MACRO, macroDaysOld, isMacroStale } from '../constants/marketDefaults';

export interface LiveMarketData {
  usdEgp: number | null;
  usTreasury10Y: number | null;
  usTreasuryMeta: unknown;
}

export interface MarketDataState {
  /** Auto-fetched live values (null until loaded / on failure). */
  live: LiveMarketData;
  /** Maintained Egyptian macro config (single source of truth). */
  config: typeof EGYPT_MACRO;
  /** Config as-of date. */
  asOfDate: string;
  /** Whole days since config as-of date. */
  daysOld: number;
  /** True when config older than one CBE MPC cycle (>45 days). */
  isStale: boolean;
  /** Live-fetch status. */
  status: 'idle' | 'loading' | 'ok' | 'error';
  /** Timestamp of the last successful live fetch (ISO). */
  fetchedAt: string | null;
  /** Names of sources that failed in the last fetch. */
  errors: string[];
  /** Re-pull the live endpoint. */
  refresh: () => void;
}

const EMPTY_LIVE: LiveMarketData = { usdEgp: null, usTreasury10Y: null, usTreasuryMeta: null };

export function useMarketData(): MarketDataState {
  const [live, setLive] = useState<LiveMarketData>(EMPTY_LIVE);
  const [status, setStatus] = useState<MarketDataState['status']>('idle');
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    fetch('/api/market-data')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((j: any) => {
        if (cancelled) return;
        setLive({
          usdEgp: j?.live?.usdEgp ?? null,
          usTreasury10Y: j?.live?.usTreasury10Y ?? null,
          usTreasuryMeta: j?.live?.usTreasuryMeta ?? null,
        });
        setErrors(Array.isArray(j?.errors) ? j.errors : []);
        setFetchedAt(j?.fetchedAt ?? new Date().toISOString());
        setStatus('ok');
      })
      .catch(() => {
        if (cancelled) return;
        // The endpoint only exists on Cloudflare Pages (or `wrangler pages dev`).
        // In plain `vite dev` it 404s — that's fine; config values still drive the app.
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  return {
    live,
    config: EGYPT_MACRO,
    asOfDate: EGYPT_MACRO.asOfDate,
    daysOld: macroDaysOld(),
    isStale: isMacroStale(),
    status,
    fetchedAt,
    errors,
    refresh,
  };
}
