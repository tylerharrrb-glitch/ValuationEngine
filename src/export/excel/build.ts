/**
 * Builds the IB-standard workbook (spec Part 7) from an engine result.
 * Sheets are created in presentation order, then filled in dependency order so that
 * every cross-sheet reference exists before it is used. No cached formula results are
 * written: values exist only after the workbook is calculated (Excel recalculates on open;
 * the gate recalculates with LibreOffice).
 */
import ExcelJSns from 'exceljs';
import type ExcelJS from 'exceljs';
import type { CompanyData } from '../../domain/company';
import type { Assumptions } from '../../domain/assumptions';
import type { RatesSnapshot } from '../../domain/rates';
import type { ValuationResult } from '../../engine/valuation';
import { footballField } from '../../engine/football';
import { type BuildCtx, SHEETS } from './context';
import { SheetWriter, FIRST_COL } from './writer';
import { buildInputs } from './sheets/inputs';
import { buildOperatingModel } from './sheets/model';
import { buildNormalization, buildWacc, buildDcf } from './sheets/core';
import { buildUsdCheck, buildDdm, buildRelative } from './sheets/secondary';
import { buildScenarios, buildSensitivity } from './sheets/rerun';
import { buildHistorical, buildSources, buildSummary, buildCover, buildChecks } from './sheets/report';

// exceljs ships CJS; under Node ESM the constructor sits on .default.
const ExcelJSrt: typeof ExcelJS = ((ExcelJSns as unknown as { default?: typeof ExcelJS }).default ?? ExcelJSns) as typeof ExcelJS;

export interface WorkbookInput {
  company: CompanyData;
  assumptions: Assumptions;
  snapshot: RatesSnapshot;
  result: ValuationResult;
  preparedBy?: string;
}

export function buildWorkbook(input: WorkbookInput): ExcelJS.Workbook {
  const { company: c, assumptions: a, snapshot, result: v } = input;
  const wb = new ExcelJSrt.Workbook();
  wb.creator = input.preparedBy ?? 'Ahmed Wael Metwally';
  wb.created = new Date(`${a.valuationDate}T00:00:00Z`);
  wb.calcProperties = { fullCalcOnLoad: true };
  const n = a.projectionYears;
  const ctx: BuildCtx = {
    wb, c, a, snap: snapshot, v, football: footballField(v), n, preparedBy: input.preparedBy ?? 'Ahmed Wael Metwally', refs: new Map(),
  };
  const notes: Record<string, number> = {
    [SHEETS.cover]: FIRST_COL + 2,
    [SHEETS.summary]: FIRST_COL + 3,
    [SHEETS.inputs]: FIRST_COL + Math.max(n + 1, c.years.length, v.secondary.peers.length ? 11 : 5),
    [SHEETS.sources]: FIRST_COL + 11,
    [SHEETS.historical]: FIRST_COL + Math.max(c.years.length, 3),
    [SHEETS.normalization]: FIRST_COL + 3,
    [SHEETS.model]: FIRST_COL + n + 2,
    [SHEETS.wacc]: FIRST_COL + 1,
    [SHEETS.dcf]: FIRST_COL + Math.max(n, 1),
    [SHEETS.usd]: FIRST_COL + Math.max(n, 1),
    [SHEETS.ddm]: FIRST_COL + Math.max(a.ddm.highGrowthYears, 1),
    [SHEETS.relative]: FIRST_COL + 8,
    [SHEETS.scenarios]: FIRST_COL + n + 2,
    [SHEETS.sensitivity]: FIRST_COL + Math.max(n + 2, 5),
    [SHEETS.checks]: FIRST_COL + 3,
  };
  const writers = new Map<string, SheetWriter>();
  for (const name of Object.values(SHEETS)) {
    const ws = wb.addWorksheet(name);
    writers.set(name, new SheetWriter(wb, ws, c.shortName, notes[name]));
  }
  const W = (name: string) => writers.get(name)!;
  buildInputs(ctx, W(SHEETS.inputs));
  buildNormalization(ctx, W(SHEETS.normalization));
  buildOperatingModel(ctx, W(SHEETS.model));
  buildWacc(ctx, W(SHEETS.wacc));
  buildDcf(ctx, W(SHEETS.dcf));
  buildUsdCheck(ctx, W(SHEETS.usd));
  buildDdm(ctx, W(SHEETS.ddm));
  buildRelative(ctx, W(SHEETS.relative));
  buildScenarios(ctx, W(SHEETS.scenarios));
  buildSensitivity(ctx, W(SHEETS.sensitivity));
  buildHistorical(ctx, W(SHEETS.historical));
  buildSources(ctx, W(SHEETS.sources));
  buildSummary(ctx, W(SHEETS.summary));
  buildChecks(ctx, W(SHEETS.checks));
  buildCover(ctx, W(SHEETS.cover));
  return wb;
}

export async function workbookBuffer(input: WorkbookInput): Promise<ArrayBuffer> {
  const wb = buildWorkbook(input);
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export function workbookFileName(c: CompanyData, valuationDate: string): string {
  return `${c.shortName}_${c.ticker.replace(/\W+/g, '')}_valuation_${valuationDate}.xlsx`;
}
