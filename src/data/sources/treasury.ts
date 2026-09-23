/**
 * US Treasury Daily Par Yield Curve (home.treasury.gov XML feed).
 * Endpoint confirmed 2026-09-23:
 *   https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml
 *     ?data=daily_treasury_yield_curve&field_tdr_date_value_month=YYYYMM
 * Fallback: FRED series DGS10 (requires FRED_API_KEY).
 */
import type { AdapterValue } from './types';

export function treasuryXmlUrl(yyyymm: string): string {
  return `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=${yyyymm}`;
}

export const TREASURY_TEXT_URL =
  'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve';

export function fredDgs10Url(apiKey: string): string {
  return `https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&sort_order=desc&limit=10&file_type=json&api_key=${encodeURIComponent(apiKey)}`;
}

export interface TreasuryPoint {
  date: string;
  y10: number;
}

/** All (date, 10Y) points in a monthly XML feed, ascending by date. */
export function parseTreasuryXml(xml: string): TreasuryPoint[] {
  const pts: TreasuryPoint[] = [];
  const re = /<m:properties>([\s\S]*?)<\/m:properties>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const date = /<d:NEW_DATE[^>]*>([^<]+)</.exec(m[1])?.[1];
    const y = /<d:BC_10YEAR[^>]*>([^<]+)</.exec(m[1])?.[1];
    if (date && y && Number.isFinite(Number(y))) pts.push({ date: date.slice(0, 10), y10: Number(y) });
  }
  if (pts.length === 0) throw new Error('Treasury XML layout changed: no BC_10YEAR observations');
  return pts.sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function parseFredDgs10(json: string): TreasuryPoint {
  const j = JSON.parse(json) as { observations?: { date: string; value: string }[] };
  const obs = (j.observations ?? []).find((o) => o.value !== '.' && Number.isFinite(Number(o.value)));
  if (!obs) throw new Error('FRED DGS10: no numeric observation');
  return { date: obs.date, y10: Number(obs.value) };
}

export function treasuryToValues(p: TreasuryPoint, url: string): AdapterValue[] {
  return [{ id: 'us.treasury10y', value: p.y10, asOf: p.date, sourceUrl: url, notes: 'US Treasury daily par yield curve, 10-year.' }];
}
