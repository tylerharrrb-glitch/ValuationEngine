/** Valuation timeline: stub fraction, discount dates, years from valuation date (METHODOLOGY section 1). */
import type { TimelinePeriod } from '../domain/result';
import { toSerial, fromSerial, yearFracActual, addYears } from './dates';

export interface Timeline {
  valuationDate: string;
  baseFye: string;
  midYear: boolean;
  periods: TimelinePeriod[];
  /** Years from valuation date to the final period end (terminal value timing). */
  tvYears: number;
  stubFraction: number;
}

export function buildTimeline(valuationDate: string, baseFye: string, n: number, midYear: boolean): Timeline {
  if (!(n >= 1 && n <= 10)) throw new Error('Projection years must be between 1 and 10');
  const v = toSerial(valuationDate);
  const fye1 = addYears(baseFye, 1);
  if (v > toSerial(fye1)) {
    throw new Error(`Valuation date ${valuationDate} is after the first projected fiscal year end ${fye1}; add the latest fiscal year to the company data.`);
  }
  const afterBase = v > toSerial(baseFye);
  const baseYear = Number(baseFye.slice(0, 4));
  const periods: TimelinePeriod[] = [];
  for (let t = 1; t <= n; t++) {
    const end = addYears(baseFye, t);
    const start = t === 1 && afterBase ? valuationDate : addYears(baseFye, t - 1);
    const fraction = t === 1 && afterBase ? yearFracActual(valuationDate, end) : 1;
    const s = toSerial(start);
    const e = toSerial(end);
    const d = midYear ? s + (e - s) / 2 : e;
    periods.push({
      index: t,
      label: `${baseYear + t}E`,
      fiscalYear: baseYear + t,
      periodStart: start,
      periodEnd: end,
      fraction,
      discountDate: fromSerial(Math.floor(d)),
      discountDays: d - v,
      years: (d - v) / 365,
      endYears: (e - v) / 365,
    });
  }
  return { valuationDate, baseFye, midYear, periods, tvYears: periods[n - 1].endYears, stubFraction: periods[0].fraction };
}

export function discountFactor(rate: number, years: number): number {
  return Math.pow(1 + rate, -years);
}
