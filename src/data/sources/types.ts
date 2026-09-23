/** A value produced by a source adapter, before validation against the registry. */
export interface AdapterValue {
  id: string;
  value: number | string | string[] | Record<string, number | string>[];
  asOf: string;
  sourceUrl: string;
  notes?: string;
}

/** Identifying User-Agent used by every automated fetch (spec 3.4). */
export const WOLF_USER_AGENT =
  'Mozilla/5.0 (compatible; WOLF-rates-refresh/1.0; +https://github.com/tylerharrrb-glitch/ValuationEngine)';
