/** 5×5 sensitivity grids, every cell a full re-run (METHODOLOGY section 9). */
import type { CompanyData } from '../domain/company';
import type { Assumptions } from '../domain/assumptions';
import type { RatesSnapshot } from '../domain/rates';
import type { CoreRun } from './core';
import { perShare } from './core';

export interface Grid {
  id: 'wacc_g' | 'wacc_exit' | 'growth_margin' | 'rf_beta';
  title: string;
  rowLabel: string;
  colLabel: string;
  rows: number[];
  cols: number[];
  /** values[i][j] = value per share for rows[i], cols[j]. */
  values: number[][];
  centre: number;
}

const OFFSETS = [-2, -1, 0, 1, 2];

function grid(
  id: Grid['id'], title: string, rowLabel: string, colLabel: string, rows: number[], cols: number[],
  cell: (r: number, c: number) => number,
): Grid {
  const values = rows.map((r) => cols.map((c) => cell(r, c)));
  return { id, title, rowLabel, colLabel, rows, cols, values, centre: values[2][2] };
}

export function runSensitivity(c: CompanyData, a: Assumptions, snapshot: RatesSnapshot, base: CoreRun): Grid[] {
  const s = a.sensitivity;
  const w0 = base.wacc.wacc;
  const g0 = base.growth;
  const m0 = a.terminal.exitMultiple.value;
  const rf0 = base.wacc.rf;
  const b0 = base.wacc.leveredBeta;
  const waccAxis = OFFSETS.map((k) => w0 + k * s.wacc);
  return [
    grid('wacc_g', 'WACC × terminal growth', 'WACC (%)', 'Terminal growth (%)', waccAxis, OFFSETS.map((k) => g0 + k * s.growth),
      (w, g) => (g < w ? perShare(c, a, snapshot, { wacc: w / 100, growth: g, terminalMethod: 'gordon' }) : NaN)),
    grid('wacc_exit', 'WACC × exit multiple', 'WACC (%)', 'Exit EV/EBITDA (x)', waccAxis, OFFSETS.map((k) => m0 + k * s.exitMultiple),
      (w, m) => perShare(c, a, snapshot, { wacc: w / 100, exitMultiple: m, terminalMethod: 'exit_multiple' })),
    grid('growth_margin', 'Revenue growth × gross margin', 'Revenue growth delta (pp, every year)', 'Gross margin delta (pp)',
      OFFSETS.map((k) => k * s.revenueGrowth), OFFSETS.map((k) => k * s.margin),
      (dg, dm) => perShare(c, a, snapshot, { revenueGrowthDelta: dg, marginDelta: dm })),
    grid('rf_beta', 'Risk-free rate × levered beta', 'Risk-free rate (%)', 'Levered beta', OFFSETS.map((k) => rf0 + k * s.rf), OFFSETS.map((k) => b0 + k * s.beta),
      (rf, b) => perShare(c, a, snapshot, { rf, leveredBeta: b })),
  ];
}
