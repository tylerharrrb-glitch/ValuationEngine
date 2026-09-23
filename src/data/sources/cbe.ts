/**
 * Central Bank of Egypt adapters. Pure parsers take page text; the fetch
 * wrappers are used only by the Worker and scripts.
 *
 * Pages (all https://www.cbe.org.eg):
 *   /en/                                             key statistics (policy rates, core and headline CPI)
 *   /en/monetary-policy/mpc-meetings-schedule        policy-rate cards (second source for agreement check)
 *   /en/economic-research/statistics/cbe-exchange-rates   CBE official exchange rates
 *   /en/auctions/egp-t-bonds-fixed-coupon            latest fixed-coupon T-bond auction results
 */
import { htmlToLines, parseNumber, valueAfter, dmyToIso } from './html';
import type { AdapterValue } from './types';

export const CBE_BASE = 'https://www.cbe.org.eg';
export const CBE_URLS = {
  home: `${CBE_BASE}/en/`,
  mpc: `${CBE_BASE}/en/monetary-policy/mpc-meetings-schedule`,
  fx: `${CBE_BASE}/en/economic-research/statistics/cbe-exchange-rates`,
  tbondsFixed: `${CBE_BASE}/en/auctions/egp-t-bonds-fixed-coupon`,
  inflation: `${CBE_BASE}/en/monetary-policy/inflation`,
} as const;

function need(n: number, what: string): number {
  if (!Number.isFinite(n)) throw new Error(`CBE layout changed: could not read ${what}`);
  return n;
}

const MONTH_INDEX: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function monthEnd(year: number, month: number): string {
  const d = new Date(Date.UTC(year, month, 0));
  return d.toISOString().slice(0, 10);
}

export interface CbeHomepage {
  overnightDeposit: number;
  overnightLending: number;
  mainOperation: number;
  coreInflation: number;
  headlineInflation: number;
  /** Month-end the CPI figures refer to, from the latest "CPI Press Release <Month> <Year>" item; null if absent. */
  cpiAsOf: string | null;
}

export function parseCbeHomepage(html: string): CbeHomepage {
  const lines = htmlToLines(html);
  const ks = lines.findIndex((l) => l.toLowerCase() === 'key statistics');
  if (ks < 0) throw new Error('CBE layout changed: "Key Statistics" block not found');
  const get = (label: string) => need(parseNumber(valueAfter(lines, label, ks)?.value), label);
  let cpiAsOf: string | null = null;
  for (const l of lines) {
    const m = /^CPI Press Release\s+([A-Za-z]+)\s+(\d{4})$/i.exec(l);
    if (m && MONTH_INDEX[m[1].toLowerCase()]) {
      cpiAsOf = monthEnd(Number(m[2]), MONTH_INDEX[m[1].toLowerCase()]);
      break;
    }
  }
  return {
    overnightDeposit: get('Overnight Deposit Rate'),
    overnightLending: get('Overnight Lending Rate'),
    mainOperation: get('MAIN OPERATION'),
    coreInflation: get('CORE INFLATION RATE'),
    headlineInflation: get('HEADLINE INFLATION RATE'),
    cpiAsOf,
  };
}

export interface CbeMpcPage {
  overnightDeposit: number;
  overnightLending: number;
  mainOperation: number;
  discountRate: number;
  /** "Effective from 15th of February 2026" → 2026-02-15. */
  effectiveFrom: string | null;
}

export function parseCbeMpcPage(html: string): CbeMpcPage {
  const lines = htmlToLines(html);
  const get = (label: string) => need(parseNumber(valueAfter(lines, label)?.value), label);
  let effectiveFrom: string | null = null;
  for (const l of lines) {
    const m = /^Effective from\s+(\d{1,2})(?:st|nd|rd|th)?\s+of\s+([A-Za-z]+)\s+(\d{4})/i.exec(l);
    if (m && MONTH_INDEX[m[2].toLowerCase()]) {
      effectiveFrom = `${m[3]}-${String(MONTH_INDEX[m[2].toLowerCase()]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
      break;
    }
  }
  return {
    overnightDeposit: get('Overnight Deposit Rate'),
    overnightLending: get('Overnight Lending Rate'),
    mainOperation: get('MAIN OPERATION'),
    discountRate: get('Discount Rates'),
    effectiveFrom,
  };
}

export interface CbeFx {
  date: string;
  usdBuy: number;
  usdSell: number;
  usdMid: number;
}

export function parseCbeFxPage(html: string): CbeFx {
  const lines = htmlToLines(html);
  const dateLine = lines.find((l) => /^Rates for Date:/i.test(l));
  if (!dateLine) throw new Error('CBE layout changed: "Rates for Date" not found');
  const date = dmyToIso(dateLine);
  const i = lines.findIndex((l) => l === 'US Dollar');
  if (i < 0) throw new Error('CBE layout changed: "US Dollar" row not found');
  const usdBuy = need(parseNumber(lines[i + 1]), 'USD buy');
  const usdSell = need(parseNumber(lines[i + 2]), 'USD sell');
  return { date, usdBuy, usdSell, usdMid: (usdBuy + usdSell) / 2 };
}

export interface CbeAuctionResult {
  tenorYears: number;
  auctionDate: string;
  issueDate: string;
  maturityDate: string;
  isin: string;
  acceptedWeightedAvgYield: number;
  acceptedMinYield: number;
  acceptedMaxYield: number;
  couponRate: number;
}

/** Parses every "Results" block on the fixed-coupon T-bond auction page. */
export function parseCbeTbondAuctions(html: string): CbeAuctionResult[] {
  const lines = htmlToLines(html);
  const out: CbeAuctionResult[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== 'Results') continue;
    const block = lines.slice(i, i + 60);
    const after = (label: string, from = 0) => valueAfter(block, label, from);
    const accepted = block.findIndex((l) => l === 'Accepted Bids');
    if (accepted < 0) continue;
    const tenor = parseNumber(after('Tenor (Years)')?.value);
    const auctionDate = after('Auction Date')?.value;
    const issueDate = after('Issue Date')?.value;
    const maturityDate = after('Maturity Date')?.value;
    const isin = after('ISIN')?.value ?? '';
    const wavg = parseNumber(after('Weighted Avg. Yield (%)', accepted)?.value);
    const minY = parseNumber(after('Min. Yield (%)', accepted)?.value);
    const maxY = parseNumber(after('Max. Yield (%)', accepted)?.value);
    const coupon = parseNumber(after('Coupon Rate (%)', accepted)?.value);
    if (!auctionDate || !issueDate || !maturityDate) throw new Error('CBE layout changed: auction dates missing');
    out.push({
      tenorYears: need(tenor, 'auction tenor'),
      auctionDate: dmyToIso(auctionDate),
      issueDate: dmyToIso(issueDate),
      maturityDate: dmyToIso(maturityDate),
      isin,
      acceptedWeightedAvgYield: need(wavg, 'weighted average yield'),
      acceptedMinYield: minY,
      acceptedMaxYield: maxY,
      couponRate: coupon,
    });
  }
  if (out.length === 0) throw new Error('CBE layout changed: no auction results block found');
  return out;
}

/** Registry values produced from the homepage. Policy rates refer to the fetch date. */
export function homepageToValues(p: CbeHomepage, fetchDate: string): AdapterValue[] {
  const v: AdapterValue[] = [
    { id: 'cbe.overnightDeposit', value: p.overnightDeposit, asOf: fetchDate, sourceUrl: CBE_URLS.home },
    { id: 'cbe.overnightLending', value: p.overnightLending, asOf: fetchDate, sourceUrl: CBE_URLS.home },
    { id: 'cbe.mainOperation', value: p.mainOperation, asOf: fetchDate, sourceUrl: CBE_URLS.home },
  ];
  if (p.cpiAsOf) {
    v.push({ id: 'eg.cpiUrbanHeadline', value: p.headlineInflation, asOf: p.cpiAsOf, sourceUrl: CBE_URLS.home });
    v.push({ id: 'eg.cpiCore', value: p.coreInflation, asOf: p.cpiAsOf, sourceUrl: CBE_URLS.home });
  }
  return v;
}

export function mpcPageToValues(p: CbeMpcPage, fetchDate: string): AdapterValue[] {
  return [
    { id: 'cbe.overnightDeposit', value: p.overnightDeposit, asOf: fetchDate, sourceUrl: CBE_URLS.mpc },
    { id: 'cbe.overnightLending', value: p.overnightLending, asOf: fetchDate, sourceUrl: CBE_URLS.mpc },
    { id: 'cbe.mainOperation', value: p.mainOperation, asOf: fetchDate, sourceUrl: CBE_URLS.mpc },
    { id: 'cbe.discountRate', value: p.discountRate, asOf: fetchDate, sourceUrl: CBE_URLS.mpc },
  ];
}

export function fxToValues(p: CbeFx): AdapterValue[] {
  return [{ id: 'eg.usdEgp', value: Number(p.usdMid.toFixed(4)), asOf: p.date, sourceUrl: CBE_URLS.fx, notes: `CBE official rate, buy ${p.usdBuy} / sell ${p.usdSell}; mid stored.` }];
}

export function auctionsToValues(rs: CbeAuctionResult[]): AdapterValue[] {
  const latest = new Map<number, CbeAuctionResult>();
  for (const r of rs) {
    const prev = latest.get(r.tenorYears);
    if (!prev || r.auctionDate > prev.auctionDate) latest.set(r.tenorYears, r);
  }
  return [...latest.values()].map((r) => ({
    id: `eg.tbondAuction.${r.tenorYears}y`,
    value: r.acceptedWeightedAvgYield,
    asOf: r.auctionDate,
    sourceUrl: CBE_URLS.tbondsFixed,
    notes: `Accepted weighted average yield, ${r.tenorYears}Y fixed coupon, ISIN ${r.isin}, auction ${r.auctionDate}.`,
  }));
}
