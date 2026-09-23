/**
 * Rates registry types (spec Part 3.1). Numbers are in percent units
 * (19.0 = 19%) unless `unit` says otherwise.
 */
import type { ISODate } from './company';

export type RateUnit = 'pct' | 'EGP_per_USD' | 'ratio' | 'rating' | 'text' | 'date_list' | 'table';
export type RateNature = 'official' | 'statutory' | 'market_quote' | 'estimate';
export type RateMethod = 'auto' | 'scraped' | 'manual';
export type UpdateCycle = 'daily' | 'mpc' | 'monthly' | 'semiannual' | 'event';
export type RateStatus = 'ok' | 'stale' | 'fetch_failed' | 'unconfirmed';

/** Row of a tabular registry value (e.g. synthetic rating table, industry betas). */
export type RateTableRow = Record<string, number | string>;

export interface RateEntry {
  id: string;
  label: string;
  value: number | string | string[] | RateTableRow[];
  unit: RateUnit;
  nature: RateNature;
  sourceName: string;
  /** Primary URL, or the literal "TO_VERIFY". */
  sourceUrl: string;
  /** Date the value refers to. */
  asOf: ISODate;
  fetchedAt?: string;
  verifiedAt: ISODate;
  method: RateMethod;
  updateCycle: UpdateCycle;
  /** Sanity range; a fetched value outside it is rejected and the last good value kept. */
  bounds: [number, number] | null;
  status: RateStatus;
  notes?: string;
}

export interface RatesRegistry {
  /** e.g. "seed-2026-09-23" or "kv-2026-09-24T06:00:03Z". */
  snapshotId: string;
  generatedAt: string;
  entries: RateEntry[];
}

/** Values frozen at the time a valuation is run (spec 3.5). */
export interface RatesSnapshot {
  snapshotId: string;
  frozenAt: string;
  entries: RateEntry[];
}

export interface RateChange {
  id: string;
  old: RateEntry['value'] | null;
  new: RateEntry['value'];
  date: ISODate;
  source: string;
}
