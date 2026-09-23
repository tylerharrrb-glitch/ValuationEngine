/**
 * useRates: fetches the merged registry from /api/rates. If the endpoint is
 * unavailable, falls back to the bundled seed and says so ("Offline snapshot as of <date>").
 */
import { useCallback, useEffect, useState } from 'react';
import seed from '../../../data/rates.seed.json';
import type { RatesRegistry } from '../../domain/rates';
import { withComputedStatus } from '../../data/registry/registry';

export interface RatesState {
  registry: RatesRegistry;
  origin: 'live' | 'offline';
  /** Human-readable origin line for the UI. */
  originText: string;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

const today = () => new Date().toISOString().slice(0, 10);
const SEED = seed as unknown as RatesRegistry;

export function useRates(): RatesState {
  const [registry, setRegistry] = useState<RatesRegistry>(() => withComputedStatus(SEED, today()));
  const [origin, setOrigin] = useState<'live' | 'offline'>('offline');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch('/api/rates', { headers: { accept: 'application/json' } })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const ct = r.headers.get('content-type') ?? '';
        if (!ct.includes('json')) throw new Error('rates endpoint not available');
        return r.json();
      })
      .then((j: RatesRegistry) => {
        if (cancelled) return;
        setRegistry(withComputedStatus(j, today()));
        setOrigin('live');
        setError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setRegistry(withComputedStatus(SEED, today()));
        setOrigin('offline');
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const originText = origin === 'live' ? `Rates snapshot ${registry.snapshotId}` : `Offline snapshot as of ${SEED.generatedAt.slice(0, 10)}`;
  return { registry, origin, originText, loading, error, refresh };
}
