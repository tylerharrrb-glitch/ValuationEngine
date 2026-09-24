/**
 * Number and date formatting shared by the PDF and the UI (one convention everywhere).
 * Amounts: full EGP with thousands separators, negatives in parentheses; UI may abbreviate to bn/mn (2 dp).
 */
const nf = (dp: number) => new Intl.NumberFormat('en-US', { minimumFractionDigits: dp, maximumFractionDigits: dp });

export function fmtNumber(x: number | null | undefined, dp = 0): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'n/a';
  const s = nf(dp).format(Math.abs(x));
  if (Math.abs(x) < 0.5 * Math.pow(10, -dp)) return '-';
  return x < 0 ? `(${s})` : s;
}

export const fmtAmount = (x: number | null | undefined) => fmtNumber(x, 0);
export const fmtPerShare = (x: number | null | undefined) => fmtNumber(x, 2);

/** Percent from a fraction (0.26 → "26.03%"). */
export function fmtPctFrac(x: number | null | undefined, dp = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'n/a';
  return `${(x * 100).toFixed(dp)}%`;
}

/** Percent from percent units (26.03 → "26.03%"). */
export function fmtPct(x: number | null | undefined, dp = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'n/a';
  return `${x.toFixed(dp)}%`;
}

export function fmtMultiple(x: number | null | undefined, dp = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'n/a';
  return `${x.toFixed(dp)}x`;
}

/** Abbreviated amount for the UI: 59.42bn, 149.97mn. */
export function fmtAbbrev(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return 'n/a';
  const a = Math.abs(x);
  const s = a >= 1e9 ? `${(a / 1e9).toFixed(2)}bn` : a >= 1e6 ? `${(a / 1e6).toFixed(2)}mn` : nf(0).format(a);
  return x < 0 ? `(${s})` : s;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-07-02" → "02-Jul-2026". */
export function fmtDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}-${MONTHS[Number(m[2]) - 1]}-${m[1]}`;
}
