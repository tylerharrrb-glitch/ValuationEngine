/** Shared build context: engine result, inputs, and the cross-sheet reference registry. */
import type ExcelJS from 'exceljs';
import type { CompanyData } from '../../domain/company';
import type { Assumptions } from '../../domain/assumptions';
import type { RatesSnapshot } from '../../domain/rates';
import type { ValuationResult } from '../../engine/valuation';
import type { FootballRow } from '../../engine/football';

export interface BuildCtx {
  wb: ExcelJS.Workbook;
  c: CompanyData;
  a: Assumptions;
  snap: RatesSnapshot;
  v: ValuationResult;
  football: FootballRow[];
  /** Projection years. */
  n: number;
  preparedBy: string;
  refs: Map<string, string>;
}

export function ref(ctx: BuildCtx, key: string): string {
  const r = ctx.refs.get(key);
  if (!r) throw new Error(`Excel export: reference "${key}" not registered`);
  return r;
}

export function setRef(ctx: BuildCtx, key: string, value: string) {
  ctx.refs.set(key, value);
}

export const SHEETS = {
  cover: 'Cover',
  summary: 'Summary',
  inputs: 'Inputs',
  sources: 'Sources',
  historical: 'Historical',
  normalization: 'Normalization',
  model: 'Operating Model',
  wacc: 'WACC',
  dcf: 'DCF',
  usd: 'USD Check',
  ddm: 'DDM',
  relative: 'Comps Precedents SOTP',
  scenarios: 'Scenarios',
  sensitivity: 'Sensitivity',
  checks: 'Checks',
} as const;
