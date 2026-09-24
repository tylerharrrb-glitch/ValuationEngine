/**
 * Excel house style (spec 7.1): Calibri 11; blue = hardcoded input, black = formula;
 * red only for FALSE on Checks (conditional format); no fills; thin rules only.
 */
import type ExcelJS from 'exceljs';

export const FONT = 'Calibri';
export const BLACK = 'FF000000';
export const BLUE = 'FF0000FF';
export const RED = 'FFFF0000';

export const FMT = {
  amount: '_(#,##0_);(#,##0);_("–"_);_(@_)',
  pct: '0.0%',
  pct2: '0.00%',
  multiple: '0.0"x"',
  perShare: '#,##0.00',
  date: 'dd-mmm-yyyy',
  ratio: '0.00',
  ratio4: '0.0000',
  days: '0.0',
  int: '0',
  fx: '0.0000',
  text: '@',
} as const;

export type Fmt = keyof typeof FMT;

export const thin: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: BLACK } };

export function font(opts: { bold?: boolean; size?: number; color?: string; underline?: boolean; italic?: boolean } = {}): Partial<ExcelJS.Font> {
  return {
    name: FONT,
    size: opts.size ?? 11,
    bold: opts.bold ?? false,
    italic: opts.italic ?? false,
    underline: opts.underline ?? false,
    color: { argb: opts.color ?? BLACK },
  };
}
