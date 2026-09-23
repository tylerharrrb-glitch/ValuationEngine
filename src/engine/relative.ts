/**
 * Trading comparables, precedent transactions, SOTP and broker reference band
 * (METHODOLOGY section 13). Multiples are computed from raw inputs, never typed.
 */
import type { CompanyData } from '../domain/company';
import { dilutedShares, latestYear } from '../domain/company';
import type { BrokerTarget, PeerInput, SegmentInput, TransactionInput } from '../domain/secondary';
import type { BridgeLine, ForecastResult, NormalizationResult } from '../domain/result';
import { bridgeTotal } from './dcf';
import { percentile } from './prng';
import type { MethodValue } from './blend';

export interface Stats {
  n: number;
  min: number;
  q1: number;
  median: number;
  mean: number;
  q3: number;
  max: number;
}

/** Descriptive statistics over finite values; quartiles by linear interpolation (type 7). */
export function stats(values: number[]): Stats | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  return {
    n: v.length,
    min: v[0],
    q1: percentile(v, 0.25),
    median: percentile(v, 0.5),
    mean: v.reduce((s, x) => s + x, 0) / v.length,
    q3: percentile(v, 0.75),
    max: v[v.length - 1],
  };
}

/** Ratio or NaN when the denominator is not positive (negative earnings give no meaningful multiple). */
const ratio = (num: number, den: number | null) => (den !== null && den > 0 ? num / den : NaN);

export interface PeerMultiples {
  name: string;
  ticker: string;
  marketCap: number;
  enterpriseValue: number;
  evEbitdaLtm: number;
  evEbitdaNtm: number;
  peLtm: number;
  peNtm: number;
  pb: number;
  evRevenue: number;
  source: string;
  sourceDate: string;
}

export function peerMultiples(p: PeerInput): PeerMultiples {
  const marketCap = p.price * p.shares;
  const ev = marketCap + p.debt - p.cash + p.minorityInterest;
  return {
    name: p.name,
    ticker: p.ticker,
    marketCap,
    enterpriseValue: ev,
    evEbitdaLtm: ratio(ev, p.ebitdaLtm),
    evEbitdaNtm: ratio(ev, p.ebitdaNtm),
    peLtm: ratio(marketCap, p.netIncomeLtm),
    peNtm: ratio(marketCap, p.netIncomeNtm),
    pb: ratio(marketCap, p.bookEquity),
    evRevenue: ratio(ev, p.revenueLtm),
    source: p.source,
    sourceDate: p.sourceDate,
  };
}

export interface ImpliedValue {
  multiple: string;
  statistic: number;
  metric: number;
  perShare: number;
}

export interface CompsResult {
  peers: PeerMultiples[];
  stats: Record<'evEbitdaLtm' | 'evEbitdaNtm' | 'peLtm' | 'peNtm' | 'pb' | 'evRevenue', Stats | null>;
  implied: ImpliedValue[];
  /** Headline: median EV/EBITDA (LTM) on normalized base-year EBITDA, through the bridge. */
  methodValue: MethodValue;
}

export function runComps(c: CompanyData, peers: PeerInput[], norm: NormalizationResult, f: ForecastResult, bridge: BridgeLine[]): CompsResult {
  const pm = peers.map(peerMultiples);
  const col = (k: keyof PeerMultiples) => stats(pm.map((p) => p[k] as number));
  const s = {
    evEbitdaLtm: col('evEbitdaLtm'),
    evEbitdaNtm: col('evEbitdaNtm'),
    peLtm: col('peLtm'),
    peNtm: col('peNtm'),
    pb: col('pb'),
    evRevenue: col('evRevenue'),
  };
  const shares = dilutedShares(c);
  const bt = bridgeTotal(bridge);
  const y = latestYear(c);
  const implied: ImpliedValue[] = [];
  const ev = (label: string, st: Stats | null, metric: number) => {
    if (st) implied.push({ multiple: label, statistic: st.median, metric, perShare: (st.median * metric + bt) / shares });
  };
  const eq = (label: string, st: Stats | null, metric: number) => {
    if (st && metric > 0) implied.push({ multiple: label, statistic: st.median, metric, perShare: (st.median * metric) / shares });
  };
  ev(`EV/EBITDA FY${y.fiscalYear}A (median)`, s.evEbitdaLtm, norm.normalizedEbitda);
  ev(`EV/EBITDA FY${y.fiscalYear + 1}E (median)`, s.evEbitdaNtm, f.years[0].ebitda);
  eq(`P/E FY${y.fiscalYear}A (median)`, s.peLtm, y.income.netProfit);
  eq(`P/E FY${y.fiscalYear + 1}E (median)`, s.peNtm, f.years[0].netProfit);
  eq('P/B (median)', s.pb, y.balance.totalEquity - y.balance.minorityInterest);
  ev(`EV/Revenue FY${y.fiscalYear}A (median)`, s.evRevenue, y.income.revenue);
  const head = implied[0]?.multiple.startsWith('EV/EBITDA FY' + y.fiscalYear + 'A') ? implied[0] : null;
  return {
    peers: pm,
    stats: s,
    implied,
    methodValue: head
      ? { id: 'comps', value: head.perShare }
      : { id: 'comps', value: null, reason: peers.length === 0 ? 'no peers entered' : 'no peer with positive LTM EBITDA' },
  };
}

export interface PrecedentsResult {
  deals: (TransactionInput & { evEbitda: number; evRevenue: number })[];
  stats: { evEbitda: Stats | null; evRevenue: Stats | null };
  implied: ImpliedValue[];
  methodValue: MethodValue;
}

export function runPrecedents(c: CompanyData, deals: TransactionInput[], norm: NormalizationResult, bridge: BridgeLine[]): PrecedentsResult {
  const rows = deals.map((d) => ({ ...d, evEbitda: ratio(d.enterpriseValue, d.ebitda), evRevenue: ratio(d.enterpriseValue, d.revenue) }));
  const st = { evEbitda: stats(rows.map((r) => r.evEbitda)), evRevenue: stats(rows.map((r) => r.evRevenue)) };
  const shares = dilutedShares(c);
  const bt = bridgeTotal(bridge);
  const y = latestYear(c);
  const implied: ImpliedValue[] = [];
  if (st.evEbitda) implied.push({ multiple: 'EV/EBITDA (median)', statistic: st.evEbitda.median, metric: norm.normalizedEbitda, perShare: (st.evEbitda.median * norm.normalizedEbitda + bt) / shares });
  if (st.evRevenue) implied.push({ multiple: 'EV/Revenue (median)', statistic: st.evRevenue.median, metric: y.income.revenue, perShare: (st.evRevenue.median * y.income.revenue + bt) / shares });
  const head = st.evEbitda ? implied[0] : null;
  return {
    deals: rows,
    stats: st,
    implied,
    methodValue: head ? { id: 'precedents', value: head.perShare } : { id: 'precedents', value: null, reason: deals.length === 0 ? 'no transactions entered' : 'no transaction with positive EBITDA' },
  };
}

export interface SotpResult {
  segments: { name: string; method: string; ebitda: number; multiple: number; enterpriseValue: number; share: number; source: string }[];
  enterpriseValue: number;
  bridgeTotal: number;
  equityValue: number;
  perShare: number;
  methodValue: MethodValue;
}

export function runSotp(c: CompanyData, segs: SegmentInput[], bridge: BridgeLine[]): SotpResult {
  const rows = segs.map((s) => {
    const ev = s.method === 'multiple' ? s.ebitda * s.multiple : s.value;
    return { name: s.name, method: s.method === 'multiple' ? `${s.multiple.toFixed(1)}x EV/EBITDA` : 'Segment value', ebitda: s.ebitda, multiple: s.multiple, enterpriseValue: ev, share: 0, source: s.source };
  });
  const ev = rows.reduce((s, r) => s + r.enterpriseValue, 0);
  rows.forEach((r) => (r.share = ev !== 0 ? r.enterpriseValue / ev : 0));
  const bt = bridgeTotal(bridge);
  const equity = ev + bt;
  const perShare = equity / dilutedShares(c);
  const valid = segs.length > 0 && Number.isFinite(perShare);
  return {
    segments: rows,
    enterpriseValue: ev,
    bridgeTotal: bt,
    equityValue: equity,
    perShare,
    methodValue: valid ? { id: 'sotp', value: perShare } : { id: 'sotp', value: null, reason: 'no segments entered' },
  };
}

export interface BrokerBand {
  count: number;
  low: number;
  high: number;
  median: number;
  targets: BrokerTarget[];
}

/** Reference band only; never used in the blend. */
export function brokerBand(targets: BrokerTarget[]): BrokerBand | null {
  const s = stats(targets.map((t) => t.target));
  return s ? { count: s.n, low: s.min, high: s.max, median: s.median, targets } : null;
}
