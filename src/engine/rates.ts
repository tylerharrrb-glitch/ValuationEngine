/**
 * Read values from a frozen rates snapshot by id, applying analyst overrides.
 * The engine never contains macro literals; everything comes through here.
 */
import type { RateEntry, RatesSnapshot, RateTableRow } from '../domain/rates';

export interface RateUse {
  id: string;
  label: string;
  value: number;
  registryValue: number;
  overridden: boolean;
  overrideReason: string | null;
  asOf: string;
  status: RateEntry['status'];
  sourceUrl: string;
  sourceName: string;
}

export type RateOverrides = Record<string, { value: number; reason: string }>;

export class RateReader {
  private readonly byId: Map<string, RateEntry>;
  readonly used = new Map<string, RateUse>();

  constructor(readonly snapshot: RatesSnapshot, private readonly overrides: RateOverrides = {}) {
    this.byId = new Map(snapshot.entries.map((e) => [e.id, e]));
  }

  entry(id: string): RateEntry {
    const e = this.byId.get(id);
    if (!e) throw new Error(`Rate "${id}" missing from snapshot ${this.snapshot.snapshotId}`);
    return e;
  }

  has(id: string): boolean {
    return this.byId.has(id);
  }

  /** Numeric value in the registry's own units (percent units for 'pct'). */
  num(id: string): number {
    const e = this.entry(id);
    if (typeof e.value !== 'number') throw new Error(`Rate "${id}" is not numeric`);
    const o = this.overrides[id];
    if (o && !o.reason?.trim()) throw new Error(`Override of "${id}" requires a reason`);
    const value = o ? o.value : e.value;
    this.used.set(id, {
      id, label: e.label, value, registryValue: e.value, overridden: !!o, overrideReason: o?.reason ?? null,
      asOf: e.asOf, status: e.status, sourceUrl: e.sourceUrl, sourceName: e.sourceName,
    });
    return value;
  }

  /** Decimal form of a percent-unit rate. */
  pct(id: string): number {
    return this.num(id) / 100;
  }

  table<T = RateTableRow>(id: string): T[] {
    const e = this.entry(id);
    if (!Array.isArray(e.value)) throw new Error(`Rate "${id}" is not a table`);
    this.used.set(id, {
      id, label: e.label, value: NaN, registryValue: NaN, overridden: false, overrideReason: null,
      asOf: e.asOf, status: e.status, sourceUrl: e.sourceUrl, sourceName: e.sourceName,
    });
    return e.value as unknown as T[];
  }

  text(id: string): string {
    return String(this.entry(id).value);
  }
}
