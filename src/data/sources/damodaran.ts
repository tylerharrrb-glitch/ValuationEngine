/**
 * Damodaran (NYU Stern) dataset adapters, parsed with SheetJS.
 * All values are estimates (nature "estimate") and carry the dataset URL and version date.
 */
import * as XLSXns from 'xlsx';
import type { AdapterValue } from './types';

// SheetJS ships CJS; under Node ESM the namespace lands on .default.
const XLSX: typeof XLSXns = ((XLSXns as unknown as { default?: typeof XLSXns }).default ?? XLSXns) as typeof XLSXns;

export const DAMODARAN_BASE = 'https://pages.stern.nyu.edu/~adamodar';
export const DAMODARAN_URLS = {
  dataCurrent: `${DAMODARAN_BASE}/New_Home_Page/datacurrent.html`,
  ctryPremJuly26: `${DAMODARAN_BASE}/pc/datasets/ctrypremJuly26.xlsx`,
  betasEmerging: `${DAMODARAN_BASE}/pc/datasets/betaemerg.xls`,
  ratings: `${DAMODARAN_BASE}/pc/ratings.xls`,
  currencyRiskfreeJuly26: `${DAMODARAN_BASE}/pc/blog/DiffInflationRiskfree26.xlsx`,
} as const;

type Row = (string | number)[];

function sheetRows(buf: ArrayBuffer | Uint8Array, sheet: string): Row[] {
  const wb = XLSX.read(buf instanceof Uint8Array ? buf : new Uint8Array(buf), { type: 'array' });
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error(`Damodaran layout changed: sheet "${sheet}" not found`);
  return XLSX.utils.sheet_to_json<Row>(ws, { header: 1, raw: true, defval: '' });
}

function cell(buf: ArrayBuffer | Uint8Array, sheet: string, addr: string): unknown {
  const wb = XLSX.read(buf instanceof Uint8Array ? buf : new Uint8Array(buf), { type: 'array' });
  const ws = wb.Sheets[sheet];
  if (!ws) throw new Error(`Damodaran layout changed: sheet "${sheet}" not found`);
  return ws[addr]?.v;
}

function num(v: unknown, what: string): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) throw new Error(`Damodaran layout changed: ${what} is not numeric`);
  return n;
}

/** Fraction → percent without binary noise (0.0423 → 4.23). */
function pct(x: number): number {
  return Number((x * 100).toPrecision(12));
}

/** Excel serial → ISO date. */
function serialToIso(serial: number): string {
  return new Date(Math.round((serial - 25569) * 86400000)).toISOString().slice(0, 10);
}

export interface CountryPremium {
  matureErp: number; // percent
  volatilityScalar: number;
  country: string;
  moodysRating: string;
  defaultSpread: number; // percent
  totalErp: number; // percent
  crp: number; // percent
}

export function parseCountryPremium(buf: ArrayBuffer | Uint8Array, country = 'Egypt'): CountryPremium {
  const sheet = 'ERPs by country';
  const matureErp = pct(num(cell(buf, sheet, 'E3'), 'mature ERP (E3)'));
  const volatilityScalar = num(cell(buf, sheet, 'E6'), 'volatility scalar (E6)');
  const rows = sheetRows(buf, sheet);
  const r = rows.find((x) => x[0] === country);
  if (!r) throw new Error(`Damodaran layout changed: ${country} row not found`);
  return {
    matureErp,
    volatilityScalar,
    country,
    moodysRating: String(r[2]),
    defaultSpread: pct(num(r[3], 'default spread')),
    totalErp: pct(num(r[4], 'total ERP')),
    crp: pct(num(r[5], 'CRP')),
  };
}

export interface IndustryBeta {
  industry: string;
  firms: number;
  beta: number;
  debtToEquity: number;
  taxRate: number;
  unleveredBeta: number;
  cashToFirmValue: number;
  unleveredBetaCorrectedForCash: number;
}

export function parseIndustryBetas(buf: ArrayBuffer | Uint8Array): { updated: string; rows: IndustryBeta[] } {
  const rows = sheetRows(buf, 'Industry Averages');
  const updatedSerial = rows[0]?.[1];
  const updated = typeof updatedSerial === 'number' ? serialToIso(updatedSerial) : 'TO_VERIFY';
  const h = rows.findIndex((r) => r[0] === 'Industry Name');
  if (h < 0) throw new Error('Damodaran layout changed: "Industry Name" header not found');
  const header = rows[h].map((x) => String(x).trim());
  const col = (name: string) => {
    const i = header.findIndex((x) => x.toLowerCase() === name.toLowerCase());
    if (i < 0) throw new Error(`Damodaran layout changed: column "${name}" not found`);
    return i;
  };
  const c = {
    firms: col('Number of firms'),
    beta: col('Beta'),
    de: col('D/E Ratio'),
    tax: col('Effective Tax rate'),
    ub: col('Unlevered beta'),
    cash: col('Cash/Firm value'),
    ubc: col('Unlevered beta corrected for cash'),
  };
  const out: IndustryBeta[] = [];
  for (const r of rows.slice(h + 1)) {
    if (!r[0] || typeof r[c.firms] !== 'number') continue;
    out.push({
      industry: String(r[0]).trim(),
      firms: r[c.firms] as number,
      beta: num(r[c.beta], 'beta'),
      debtToEquity: num(r[c.de], 'D/E'),
      taxRate: num(r[c.tax], 'tax'),
      unleveredBeta: num(r[c.ub], 'unlevered beta'),
      cashToFirmValue: num(r[c.cash], 'cash/firm value'),
      unleveredBetaCorrectedForCash: num(r[c.ubc], 'unlevered beta corrected for cash'),
    });
  }
  if (out.length < 50) throw new Error(`Damodaran layout changed: only ${out.length} industries parsed`);
  return { updated, rows: out };
}

export interface SpreadRow {
  coverageAbove: number;
  coverageUpTo: number;
  rating: string;
  spread: number; // percent
}

export function parseSyntheticRatings(buf: ArrayBuffer | Uint8Array): { large: SpreadRow[]; small: SpreadRow[] } {
  const rows = sheetRows(buf, 'Start here Ratings sheet');
  const block = (startLabel: RegExp): SpreadRow[] => {
    const s = rows.findIndex((r) => startLabel.test(String(r[0])));
    if (s < 0) throw new Error(`Damodaran layout changed: block ${startLabel} not found`);
    const out: SpreadRow[] = [];
    for (const r of rows.slice(s + 1)) {
      if (typeof r[0] !== 'number' || typeof r[1] !== 'number') {
        if (out.length > 0) break;
        continue;
      }
      out.push({ coverageAbove: r[0], coverageUpTo: r[1], rating: String(r[2]), spread: pct(num(r[3], 'spread')) });
    }
    if (out.length < 10) throw new Error(`Damodaran layout changed: synthetic table ${startLabel} has ${out.length} rows`);
    return out;
  };
  return { large: block(/^For large non-financial/i), small: block(/^For smaller and riskier/i) };
}

export interface CurrencyRiskfree {
  usdRiskfree: number;
  usdExpectedInflation: number;
  country: string;
  expectedInflation: number;
  riskfree: number;
}

export function parseCurrencyRiskfree(buf: ArrayBuffer | Uint8Array, country = 'Egypt'): CurrencyRiskfree {
  const rows = sheetRows(buf, 'Sheet1');
  const find = (label: RegExp) => rows.find((r) => label.test(String(r[0])));
  const usInf = find(/^Expected Inflation in US/i);
  const usRf = find(/^Riskfree Rate in US/i);
  const r = rows.find((x) => x[0] === country);
  if (!usInf || !usRf || !r) throw new Error('Damodaran layout changed: currency riskfree rows not found');
  return {
    usdExpectedInflation: pct(num(usInf[1], 'US expected inflation')),
    usdRiskfree: pct(num(usRf[1], 'USD riskfree')),
    country,
    expectedInflation: pct(num(r[2], 'expected inflation')),
    riskfree: pct(num(r[3], 'riskfree')),
  };
}

const JULY_2026 = '2026-07-01';

const MONTHS: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12',
};

/**
 * Latest country-risk workbook linked from datacurrent.html, e.g.
 * <a href=".../ctrypremJuly26.xlsx">July 1, 2026 update</a>. Returns the first (newest) link.
 */
export function discoverCountryPremiumWorkbook(html: string): { url: string; asOf: string } {
  const re = /<a[^>]+href="([^"]*ctryprem[^"]*\.xlsx)"[^>]*>\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s+update\s*<\/a>/gi;
  const m = re.exec(html);
  if (!m || !MONTHS[m[2].toLowerCase()]) throw new Error('Damodaran layout changed: no ctryprem workbook link on datacurrent.html');
  const url = m[1].startsWith('http') ? m[1] : `${DAMODARAN_BASE}/New_Home_Page/${m[1]}`;
  return { url, asOf: `${m[4]}-${MONTHS[m[2].toLowerCase()]}-${m[3].padStart(2, '0')}` };
}

export function countryPremiumToValues(p: CountryPremium, url: string, asOf = JULY_2026): AdapterValue[] {
  return [
    { id: 'damodaran.matureErp', value: p.matureErp, asOf, sourceUrl: url },
    { id: 'damodaran.volatilityScalar', value: p.volatilityScalar, asOf, sourceUrl: url },
    { id: 'damodaran.egypt.rating', value: p.moodysRating, asOf, sourceUrl: url },
    { id: 'damodaran.egypt.defaultSpread', value: p.defaultSpread, asOf, sourceUrl: url },
    { id: 'damodaran.egypt.crp', value: p.crp, asOf, sourceUrl: url },
    { id: 'damodaran.egypt.totalErp', value: p.totalErp, asOf, sourceUrl: url },
  ];
}

export function currencyRiskfreeToValues(p: CurrencyRiskfree, url: string, asOf = JULY_2026): AdapterValue[] {
  return [
    { id: 'damodaran.rf.egp', value: p.riskfree, asOf, sourceUrl: url },
    { id: 'damodaran.rf.usd', value: p.usdRiskfree, asOf, sourceUrl: url },
    { id: 'damodaran.expectedInflation.egp', value: p.expectedInflation, asOf, sourceUrl: url },
    { id: 'damodaran.expectedInflation.usd', value: p.usdExpectedInflation, asOf, sourceUrl: url },
  ];
}

export function betasToValues(b: { updated: string; rows: IndustryBeta[] }, url: string): AdapterValue[] {
  return [{
    id: 'damodaran.betas.emerging',
    value: b.rows.map((r) => ({
      industry: r.industry,
      firms: r.firms,
      beta: r.beta,
      debtToEquity: r.debtToEquity,
      taxRate: r.taxRate,
      unleveredBeta: r.unleveredBeta,
      cashToFirmValue: r.cashToFirmValue,
      unleveredBetaCorrectedForCash: r.unleveredBetaCorrectedForCash,
    })),
    asOf: b.updated,
    sourceUrl: url,
  }];
}

export function ratingsToValues(t: { large: SpreadRow[]; small: SpreadRow[] }, url: string, asOf: string): AdapterValue[] {
  const map = (rs: SpreadRow[]) => rs.map((r) => ({ coverageAbove: r.coverageAbove, coverageUpTo: r.coverageUpTo, rating: r.rating, spread: r.spread }));
  return [
    { id: 'damodaran.synthetic.large', value: map(t.large), asOf, sourceUrl: url },
    { id: 'damodaran.synthetic.small', value: map(t.small), asOf, sourceUrl: url },
  ];
}
