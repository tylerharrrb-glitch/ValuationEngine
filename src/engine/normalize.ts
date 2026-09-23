/** Reported → normalized EBIT / EBITDA (METHODOLOGY section 2). */
import type { CompanyData } from '../domain/company';
import { latestYear } from '../domain/company';
import type { NormalizationAdjustment } from '../domain/assumptions';
import type { NormalizationResult } from '../domain/result';

export function defaultNormalization(c: CompanyData): NormalizationAdjustment[] {
  const y = latestYear(c);
  const i = y.income;
  const candidates: [string, string, number, string][] = [
    ['ecl', 'ECL reversal / (charge)', i.eclReversal, 'Expected credit loss movements are non-recurring.'],
    ['impairment', 'Impairment reversal', i.impairmentReversal, 'Impairment reversals do not recur.'],
    ['provisions', 'Provisions no longer required (inside other income)', i.provisionsReleased, 'Release of prior-year provisions does not recur.'],
    ['capitalGains', 'Capital gains / (losses) on disposals', i.capitalGains, 'Disposal gains are not part of recurring operations.'],
  ];
  return candidates
    .filter(([, , amt]) => amt !== 0)
    .map(([id, label, amount, why]) => ({
      id,
      label,
      amount,
      include: true,
      tag: 'Analyst assumption' as const,
      note: `${why} Amount from the FY${y.fiscalYear} income statement.`,
    }));
}

export function normalize(c: CompanyData, adjustments: NormalizationAdjustment[]): NormalizationResult {
  const i = latestYear(c).income;
  const lines = adjustments.map((a) => ({ id: a.id, label: a.label, amount: a.amount, include: a.include, tag: a.tag, note: a.note }));
  const totalRemoved = adjustments.filter((a) => a.include).reduce((s, a) => s + a.amount, 0);
  const normalizedEbit = i.operatingProfit - totalRemoved;
  return {
    reportedOperatingProfit: i.operatingProfit,
    lines,
    totalRemoved,
    normalizedEbit,
    depreciation: i.depreciation,
    amortization: i.amortization,
    normalizedEbitda: normalizedEbit + i.depreciation + i.amortization,
    reportedEbitda: i.operatingProfit + i.depreciation + i.amortization,
  };
}
