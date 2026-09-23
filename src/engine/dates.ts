/**
 * Pure date helpers. Dates are ISO strings (YYYY-MM-DD) handled as UTC day
 * serials so results match Excel/LibreOffice date arithmetic exactly.
 */

const MS_PER_DAY = 86_400_000;
/** Excel serial of 1970-01-01 (1900 date system). */
const EXCEL_EPOCH_OFFSET = 25_569;

export function parseISO(d: string): { y: number; m: number; day: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (!m) throw new Error(`Invalid ISO date: ${d}`);
  return { y: Number(m[1]), m: Number(m[2]), day: Number(m[3]) };
}

/** Days since 1970-01-01 (UTC). */
export function toSerial(d: string): number {
  const { y, m, day } = parseISO(d);
  return Date.UTC(y, m - 1, day) / MS_PER_DAY;
}

export function fromSerial(serial: number): string {
  const dt = new Date(Math.round(serial) * MS_PER_DAY);
  return dt.toISOString().slice(0, 10);
}

/** Excel 1900-system serial number for an ISO date. */
export function toExcelSerial(d: string): number {
  return toSerial(d) + EXCEL_EPOCH_OFFSET;
}

export function daysBetween(a: string, b: string): number {
  return toSerial(b) - toSerial(a);
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function addYears(d: string, n: number): string {
  const { y, m, day } = parseISO(d);
  const yy = y + n;
  const lastDay = new Date(Date.UTC(yy, m, 0)).getUTCDate();
  return `${String(yy).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
}

/**
 * YEARFRAC with basis 1 (actual/actual), following Excel's algorithm:
 *  - same calendar year: days / (365 or 366)
 *  - within one year: days / 366 if a 29-Feb lies in the span, else 365
 *  - longer: days / average year length over the calendar years spanned
 */
export function yearFracActual(start: string, end: string): number {
  let s = start;
  let e = end;
  if (toSerial(e) < toSerial(s)) [s, e] = [e, s];
  const a = parseISO(s);
  const b = parseISO(e);
  const days = daysBetween(s, e);
  if (days === 0) return 0;
  if (a.y === b.y) return days / (isLeapYear(a.y) ? 366 : 365);
  if (toSerial(e) <= toSerial(addYears(s, 1))) {
    let spansLeap = false;
    if (isLeapYear(a.y) && toSerial(s) <= toSerial(`${a.y}-02-29`)) spansLeap = true;
    if (isLeapYear(b.y) && toSerial(e) >= toSerial(`${b.y}-02-29`)) spansLeap = true;
    return days / (spansLeap ? 366 : 365);
  }
  let totalDays = 0;
  for (let y = a.y; y <= b.y; y++) totalDays += isLeapYear(y) ? 366 : 365;
  const avg = totalDays / (b.y - a.y + 1);
  return days / avg;
}

/** Fiscal year end date (ISO) for a fiscal year given FYE as MM-DD. */
export function fiscalYearEndDate(fiscalYear: number, fyeMonthDay: string): string {
  return `${fiscalYear}-${fyeMonthDay}`;
}

/** Whole-day count between two ISO dates, positive if b is after a. */
export function ageInDays(asOf: string, today: string): number {
  return daysBetween(asOf, today);
}

/** Business days (Mon-Fri) strictly after `from` up to and including `to`. */
export function businessDaysBetween(from: string, to: string): number {
  const a = toSerial(from);
  const b = toSerial(to);
  if (b <= a) return 0;
  let n = 0;
  for (let s = a + 1; s <= b; s++) {
    const dow = new Date(s * MS_PER_DAY).getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}
