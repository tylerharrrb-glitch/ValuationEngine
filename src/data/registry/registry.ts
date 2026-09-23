/**
 * Rates registry logic (spec Part 3). Pure functions: validation, staleness,
 * applying fetched values (bounds, two-source agreement), manual merge, and
 * snapshot freeze / diff.
 */
import type { RateEntry, RatesRegistry, RatesSnapshot, RateStatus, RateChange, RateUnit } from '../../domain/rates';
import type { AdapterValue } from '../sources/types';
import { daysBetween, businessDaysBetween, toSerial } from '../../engine/dates';

const UNITS: RateUnit[] = ['pct', 'EGP_per_USD', 'ratio', 'rating', 'text', 'date_list', 'table'];
const NATURES = ['official', 'statutory', 'market_quote', 'estimate'];
const METHODS = ['auto', 'scraped', 'manual'];
const CYCLES = ['daily', 'mpc', 'monthly', 'semiannual', 'event'];
const STATUSES: RateStatus[] = ['ok', 'stale', 'fetch_failed', 'unconfirmed'];
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------- validation

export function validateEntry(e: RateEntry): string[] {
  const err: string[] = [];
  const p = `${e?.id ?? '(no id)'}`;
  if (!e || typeof e !== 'object') return [`${p}: not an object`];
  if (!/^[a-z0-9]+(\.[A-Za-z0-9]+)+$/.test(e.id)) err.push(`${p}: id must be dotted lowercase`);
  if (!e.label) err.push(`${p}: label missing`);
  if (!UNITS.includes(e.unit)) err.push(`${p}: bad unit ${e.unit}`);
  if (!NATURES.includes(e.nature)) err.push(`${p}: bad nature ${e.nature}`);
  if (!METHODS.includes(e.method)) err.push(`${p}: bad method ${e.method}`);
  if (!CYCLES.includes(e.updateCycle)) err.push(`${p}: bad updateCycle ${e.updateCycle}`);
  if (!STATUSES.includes(e.status)) err.push(`${p}: bad status ${e.status}`);
  if (!e.sourceName) err.push(`${p}: sourceName missing`);
  if (!(e.sourceUrl === 'TO_VERIFY' || /^https:\/\//.test(e.sourceUrl))) err.push(`${p}: sourceUrl must be https or TO_VERIFY`);
  if (!ISO.test(e.asOf)) err.push(`${p}: asOf must be YYYY-MM-DD`);
  if (!ISO.test(e.verifiedAt)) err.push(`${p}: verifiedAt must be YYYY-MM-DD`);
  const numericUnit = e.unit === 'pct' || e.unit === 'EGP_per_USD' || e.unit === 'ratio';
  if (numericUnit && (typeof e.value !== 'number' || !Number.isFinite(e.value))) err.push(`${p}: numeric unit requires a finite number`);
  if ((e.unit === 'text' || e.unit === 'rating') && typeof e.value !== 'string') err.push(`${p}: ${e.unit} requires a string`);
  if (e.unit === 'date_list' && !(Array.isArray(e.value) && (e.value as unknown[]).every((d) => typeof d === 'string' && ISO.test(d)))) err.push(`${p}: date_list requires ISO dates`);
  if (e.unit === 'table' && !(Array.isArray(e.value) && (e.value as unknown[]).every((r) => r && typeof r === 'object'))) err.push(`${p}: table requires row objects`);
  if (e.bounds !== null) {
    if (!Array.isArray(e.bounds) || e.bounds.length !== 2 || !(e.bounds[0] < e.bounds[1])) err.push(`${p}: bounds must be [lo, hi]`);
    else if (!numericUnit) err.push(`${p}: bounds only allowed on numeric units`);
    else if (typeof e.value === 'number' && !withinBounds(e, e.value)) err.push(`${p}: value ${e.value} outside bounds`);
  } else if (numericUnit) err.push(`${p}: numeric entries require bounds`);
  return err;
}

export function validateRegistry(r: RatesRegistry): string[] {
  const err: string[] = [];
  if (!r.snapshotId) err.push('snapshotId missing');
  const seen = new Set<string>();
  for (const e of r.entries) {
    if (seen.has(e.id)) err.push(`duplicate id ${e.id}`);
    seen.add(e.id);
    err.push(...validateEntry(e));
  }
  return err;
}

export function withinBounds(e: Pick<RateEntry, 'bounds'>, v: unknown): boolean {
  if (e.bounds === null) return true;
  return typeof v === 'number' && Number.isFinite(v) && v >= e.bounds[0] && v <= e.bounds[1];
}

// ---------------------------------------------------------------- staleness

export interface StalenessInfo {
  status: RateStatus;
  ageDays: number;
  badge: string;
}

function mpcDates(reg: { entries: RateEntry[] }): string[] {
  const cal = reg.entries.find((x) => x.id === 'cbe.mpcCalendar');
  return Array.isArray(cal?.value) ? (cal!.value as string[]) : [];
}

/** Computed status: 'fetch_failed' and 'unconfirmed' are kept; 'ok' becomes 'stale' when the policy says so. */
export function computeStatus(e: RateEntry, today: string, mpcCalendar: string[]): RateStatus {
  if (e.status === 'fetch_failed' || e.status === 'unconfirmed') return e.status;
  if (e.status === 'stale') return 'stale';
  const age = daysBetween(e.asOf, today);
  switch (e.updateCycle) {
    case 'daily':
      return businessDaysBetween(e.asOf, today) > 3 ? 'stale' : 'ok';
    case 'monthly':
      return age > 40 ? 'stale' : 'ok';
    case 'semiannual':
      return age > 200 ? 'stale' : 'ok';
    case 'mpc': {
      const t = toSerial(today);
      const a = toSerial(e.asOf);
      const missed = mpcCalendar.some((d) => toSerial(d) > a && toSerial(d) <= t);
      return missed ? 'stale' : 'ok';
    }
    case 'event':
    default:
      return 'ok';
  }
}

export function stalenessInfo(e: RateEntry, today: string, mpcCalendar: string[]): StalenessInfo {
  const status = computeStatus(e, today, mpcCalendar);
  const ageDays = daysBetween(e.asOf, today);
  const where = e.sourceUrl === 'TO_VERIFY' ? e.sourceName : e.sourceUrl;
  const badge =
    status === 'ok' ? `Current as of ${e.asOf}`
      : status === 'stale' ? `Stale — ${ageDays} days — verify at ${where}`
        : status === 'fetch_failed' ? `Fetch failed — showing last good value from ${e.asOf}`
          : 'Unconfirmed';
  return { status, ageDays, badge };
}

/** Returns a copy with every entry's status recomputed for `today`. */
export function withComputedStatus<T extends { entries: RateEntry[] }>(reg: T, today: string): T {
  const cal = mpcDates(reg);
  return { ...reg, entries: reg.entries.map((e) => ({ ...e, status: computeStatus(e, today, cal) })) };
}

// ---------------------------------------------------------------- applying fetched values

/** Registry ids whose change must be confirmed by two CBE sources (homepage + MPC page). */
export const TWO_SOURCE_IDS = ['cbe.overnightDeposit', 'cbe.overnightLending', 'cbe.mainOperation'];

export interface AdapterRun {
  adapter: string;
  /** Ids this adapter is responsible for (marked fetch_failed if the adapter throws). */
  ids: string[];
  values: AdapterValue[];
  error?: string;
}

export interface ApplyOutcome {
  registry: RatesRegistry;
  changes: RateChange[];
  rejected: { id: string; value: unknown; reason: string }[];
  log: string[];
}

export function applyAdapterRuns(prevIn: RatesRegistry, runs: AdapterRun[], nowIso: string): ApplyOutcome {
  const today = nowIso.slice(0, 10);
  let prev = prevIn;
  const byId = new Map(prev.entries.map((e) => [e.id, { ...e }]));
  const changes: RateChange[] = [];
  const rejected: ApplyOutcome['rejected'] = [];
  const log: string[] = [];

  // Failed adapters: keep last good value, flag loudly.
  for (const run of runs.filter((r) => r.error)) {
    for (const id of run.ids) {
      const e = byId.get(id);
      if (!e) continue;
      e.status = 'fetch_failed';
      e.fetchedAt = nowIso;
      e.notes = appendNote(e.notes, `${today}: ${run.adapter} failed: ${run.error}`);
    }
    log.push(`FETCH_FAILED ${run.adapter}: ${run.error}`);
  }

  // Group all fetched values by id (several sources may report one id).
  const fetched = new Map<string, AdapterValue[]>();
  for (const run of runs.filter((r) => !r.error)) {
    for (const v of run.values) {
      if (!fetched.has(v.id)) fetched.set(v.id, []);
      fetched.get(v.id)!.push(v);
    }
  }

  for (const [id, vals] of fetched) {
    let e = byId.get(id);
    if (!e && id.startsWith('eg.tbondAuction.')) {
      e = auctionEntryTemplate(id, vals[0], today);
      byId.set(id, e);
      prev = { ...prev, entries: [...prev.entries, e] };
      log.push(`ADDED ${id}: new auction tenor`);
    }
    if (!e) {
      log.push(`IGNORED ${id}: not in registry`);
      continue;
    }
    const inBounds = vals.filter((v) => withinBounds(e, v.value));
    for (const v of vals.filter((x) => !withinBounds(e, x.value))) {
      rejected.push({ id, value: v.value, reason: `outside bounds [${e.bounds?.join(', ')}]` });
      log.push(`REJECTED ${id}=${String(v.value)} from ${v.sourceUrl}: outside bounds`);
    }
    if (inBounds.length === 0) continue;

    const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
    const pick = inBounds.reduce((a, b) => (b.asOf > a.asOf ? b : a));
    const changed = !same(pick.value, e.value);

    if (TWO_SOURCE_IDS.includes(id) && changed) {
      const agree = inBounds.length >= 2 && inBounds.every((v) => same(v.value, pick.value));
      if (!agree) {
        e.status = 'unconfirmed';
        e.fetchedAt = nowIso;
        e.notes = appendNote(e.notes, `${today}: change to ${String(pick.value)} not confirmed by both CBE sources (${inBounds.map((v) => `${v.sourceUrl}=${String(v.value)}`).join(', ')})`);
        log.push(`UNCONFIRMED ${id}: ${String(e.value)} -> ${String(pick.value)} (sources disagree or only one source)`);
        continue;
      }
    }
    if (changed) changes.push({ id, old: e.value, new: pick.value, date: today, source: pick.sourceUrl });
    e.value = pick.value;
    e.asOf = pick.asOf;
    e.sourceUrl = pick.sourceUrl;
    e.fetchedAt = nowIso;
    e.verifiedAt = today;
    e.method = 'scraped';
    e.status = 'ok';
    if (pick.notes) e.notes = pick.notes;
    log.push(`${changed ? 'UPDATED' : 'CONFIRMED'} ${id}=${String(pick.value).slice(0, 40)} asOf ${pick.asOf}`);
  }

  return {
    registry: { snapshotId: `kv-${nowIso}`, generatedAt: nowIso, entries: prev.entries.map((x) => byId.get(x.id)!) },
    changes,
    rejected,
    log,
  };
}

/** Registry entry for an auction tenor first seen by the Worker. */
export function auctionEntryTemplate(id: string, v: AdapterValue, today: string): RateEntry {
  const tenor = id.split('.').pop();
  return {
    id,
    label: `EGP T-bond auction, ${tenor} fixed coupon (accepted weighted average yield)`,
    value: v.value as number,
    unit: 'pct',
    nature: 'official',
    sourceName: 'Central Bank of Egypt, T-bond auction results',
    sourceUrl: v.sourceUrl,
    asOf: v.asOf,
    verifiedAt: today,
    method: 'scraped',
    updateCycle: 'monthly',
    bounds: [0, 60],
    status: 'ok',
    notes: v.notes,
  };
}

function appendNote(prev: string | undefined, add: string): string {
  const parts = (prev ? prev.split(' | ') : []).filter((p) => !/^\d{4}-\d{2}-\d{2}: .* (failed|not confirmed)/.test(p));
  return [...parts, add].join(' | ');
}

// ---------------------------------------------------------------- manual merge

/**
 * Merge Worker output (KV latest) with the git-versioned manual file.
 * A manual entry wins only if its asOf is newer, or the auto entry is fetch_failed,
 * or the auto registry does not contain the id.
 */
export function mergeManual(auto: RatesRegistry | null, manual: RatesRegistry): RatesRegistry {
  if (!auto) return { ...manual, snapshotId: `manual-${manual.snapshotId}` };
  const autoById = new Map(auto.entries.map((e) => [e.id, e]));
  const ids = [...new Set([...manual.entries.map((e) => e.id), ...auto.entries.map((e) => e.id)])];
  const manualById = new Map(manual.entries.map((e) => [e.id, e]));
  const entries = ids.map((id) => {
    const a = autoById.get(id);
    const m = manualById.get(id);
    if (!a) return m!;
    if (!m) return a;
    if (a.status === 'fetch_failed') return m;
    return m.asOf > a.asOf ? m : a;
  });
  return { snapshotId: `${auto.snapshotId}+${manual.snapshotId}`, generatedAt: auto.generatedAt, entries };
}

// ---------------------------------------------------------------- snapshots

export function freezeSnapshot(reg: RatesRegistry, nowIso: string): RatesSnapshot {
  const computed = withComputedStatus(reg, nowIso.slice(0, 10));
  return { snapshotId: reg.snapshotId, frozenAt: nowIso, entries: computed.entries.map((e) => ({ ...e })) };
}

export interface SnapshotDiffRow {
  id: string;
  label: string;
  oldValue: RateEntry['value'] | null;
  newValue: RateEntry['value'] | null;
  oldAsOf: string | null;
  newAsOf: string | null;
}

/** Rows that differ between a saved snapshot and the current registry (shown before "Update to current rates"). */
export function diffSnapshots(saved: RatesSnapshot, current: RatesSnapshot): SnapshotDiffRow[] {
  const cur = new Map(current.entries.map((e) => [e.id, e]));
  const old = new Map(saved.entries.map((e) => [e.id, e]));
  const ids = [...new Set([...old.keys(), ...cur.keys()])];
  const rows: SnapshotDiffRow[] = [];
  for (const id of ids) {
    const o = old.get(id);
    const n = cur.get(id);
    if (o && n && JSON.stringify(o.value) === JSON.stringify(n.value) && o.asOf === n.asOf) continue;
    rows.push({ id, label: (n ?? o)!.label, oldValue: o?.value ?? null, newValue: n?.value ?? null, oldAsOf: o?.asOf ?? null, newAsOf: n?.asOf ?? null });
  }
  return rows;
}
