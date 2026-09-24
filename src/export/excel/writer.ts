/**
 * Row-oriented sheet writer: labels in B, units in C, periods from D, notes in the
 * far-right column. Every numeric cell is either a blue hardcoded input or a black formula.
 */
import type ExcelJS from 'exceljs';
import { BLACK, BLUE, FMT, font, thin, type Fmt } from './style';

export type Cell =
  | { k: 'in'; v: number | string | null; fmt?: Fmt }
  | { k: 'f'; f: string; fmt?: Fmt }
  | { k: 't'; v: string }
  | { k: 'date'; v: string }
  | { k: 'link'; text: string; target: string }
  | null;

/** Hardcoded input (blue). */
export const inp = (v: number | string | null, fmt?: Fmt): Cell => ({ k: 'in', v, fmt });
/** Formula (black). Leading '=' is optional. */
export const fx = (f: string, fmt?: Fmt): Cell => ({ k: 'f', f: f.replace(/^=/, ''), fmt });
/** Static label text (black). */
export const txt = (v: string): Cell => ({ k: 't', v });
/** Hardcoded date input (blue), ISO string. */
export const dateIn = (v: string): Cell => ({ k: 'date', v });

export function colLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function quoteSheet(name: string): string {
  return /^[A-Za-z0-9_]+$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`;
}

export const LABEL_COL = 2; // B
export const UNIT_COL = 3; // C
export const FIRST_COL = 4; // D

export interface LineOpts {
  fmt?: Fmt;
  note?: string;
  /** Defined name for the first value cell. */
  name?: string;
  bold?: boolean;
  /** Thin top border on the value cells (totals). */
  total?: boolean;
  indent?: number;
}

function isoToDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export class SheetWriter {
  row = 6;
  readonly names: string[] = [];

  constructor(
    readonly wb: ExcelJS.Workbook,
    readonly ws: ExcelJS.Worksheet,
    readonly companyShort: string,
    readonly notesCol: number,
  ) {
    ws.views = [{ showGridLines: false }];
    ws.properties.defaultRowHeight = 15;
    ws.getColumn(1).width = 2;
    ws.getColumn(LABEL_COL).width = 52;
    ws.getColumn(UNIT_COL).width = 11;
    for (let c = FIRST_COL; c < notesCol; c++) ws.getColumn(c).width = 17;
    ws.getColumn(notesCol).width = 70;
    ws.pageSetup = {
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      paperSize: 9,
      margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.6, header: 0.3, footer: 0.3 },
    };
    const esc = (s: string) => s.replace(/&/g, '&&');
    ws.headerFooter = { oddFooter: `&C${esc(companyShort)} | ${esc(ws.name)} | Page &P of &N` };
  }

  get sheet(): string {
    return this.ws.name;
  }

  /** Absolute reference, optionally sheet-qualified. */
  ref(col: number, row: number, withSheet = true): string {
    const a = `$${colLetter(col)}$${row}`;
    return withSheet ? `${quoteSheet(this.sheet)}!${a}` : a;
  }

  /** Absolute range reference over a row. */
  rangeRow(row: number, c1: number, c2: number, withSheet = true): string {
    const a = `$${colLetter(c1)}$${row}:$${colLetter(c2)}$${row}`;
    return withSheet ? `${quoteSheet(this.sheet)}!${a}` : a;
  }

  rangeCol(col: number, r1: number, r2: number, withSheet = true): string {
    const a = `$${colLetter(col)}$${r1}:$${colLetter(col)}$${r2}`;
    return withSheet ? `${quoteSheet(this.sheet)}!${a}` : a;
  }

  private put(col: number, row: number, cell: Cell, fmt?: Fmt, bold = false) {
    if (cell === null) return;
    const c = this.ws.getCell(row, col);
    switch (cell.k) {
      case 'in':
        c.value = cell.v as ExcelJS.CellValue;
        c.font = font({ color: BLUE, bold });
        break;
      case 'f':
        c.value = { formula: cell.f } as ExcelJS.CellFormulaValue;
        c.font = font({ color: BLACK, bold });
        break;
      case 't':
        c.value = cell.v;
        c.font = font({ bold });
        break;
      case 'date':
        c.value = isoToDate(cell.v);
        c.font = font({ color: BLUE, bold });
        c.numFmt = FMT.date;
        return;
      case 'link':
        c.value = { text: cell.text, hyperlink: cell.target } as ExcelJS.CellHyperlinkValue;
        c.font = font({ underline: true });
        return;
    }
    const f = (cell.k === 'in' || cell.k === 'f') && cell.fmt ? cell.fmt : fmt;
    if (f && cell.k !== 't') c.numFmt = FMT[f];
  }

  title(title: string, subtitle: string) {
    const t = this.ws.getCell('B2');
    t.value = title;
    t.font = font({ bold: true, size: 14 });
    const s = this.ws.getCell('B3');
    s.value = subtitle;
    s.font = font();
    const l = this.ws.getCell('B4');
    l.value = 'Blue = hardcoded input | Black = formula';
    l.font = font();
    this.row = 6;
  }

  section(label: string) {
    if (this.row > 6) this.row++;
    const c = this.ws.getCell(this.row, LABEL_COL);
    c.value = label;
    c.font = font({ bold: true });
    for (let col = LABEL_COL; col <= this.notesCol; col++) this.ws.getCell(this.row, col).border = { bottom: thin };
    this.row++;
  }

  /** Column headers (bold, thin bottom border) starting at D; unit header in C, Notes header. */
  header(labels: (string | Cell)[], unit = '', notes = 'Notes') {
    const r = this.row;
    const cl = this.ws.getCell(r, UNIT_COL);
    cl.value = unit;
    cl.font = font({ bold: true });
    labels.forEach((l, i) => {
      const c = this.ws.getCell(r, FIRST_COL + i);
      if (typeof l === 'string') {
        c.value = l;
        c.font = font({ bold: true });
      } else this.put(FIRST_COL + i, r, l, undefined, true);
      c.alignment = { horizontal: 'right' };
    });
    const n = this.ws.getCell(r, this.notesCol);
    n.value = notes;
    n.font = font({ bold: true });
    for (let col = LABEL_COL; col <= this.notesCol; col++) this.ws.getCell(r, col).border = { bottom: thin };
    this.row++;
    return r;
  }

  line(label: string, unit: string, cells: Cell[], o: LineOpts = {}): number {
    const r = this.row;
    const lc = this.ws.getCell(r, LABEL_COL);
    lc.value = label;
    lc.font = font({ bold: o.bold });
    if (o.indent) lc.alignment = { indent: o.indent };
    const uc = this.ws.getCell(r, UNIT_COL);
    uc.value = unit;
    uc.font = font();
    cells.forEach((cell, i) => {
      this.put(FIRST_COL + i, r, cell, o.fmt, o.bold);
      if (o.total && cell !== null) this.ws.getCell(r, FIRST_COL + i).border = { top: thin };
    });
    if (o.note) {
      const nc = this.ws.getCell(r, this.notesCol);
      nc.value = o.note;
      nc.font = font();
    }
    if (o.name) this.name(o.name, FIRST_COL, r);
    this.row++;
    return r;
  }

  /** A single text line in column B (e.g. an explanatory statement). */
  textLine(text: string | Cell, col = LABEL_COL) {
    if (typeof text === 'string') {
      const c = this.ws.getCell(this.row, col);
      c.value = text;
      c.font = font();
    } else this.put(col, this.row, text);
    this.row++;
  }

  name(name: string, col: number, row: number) {
    this.wb.definedNames.add(`${quoteSheet(this.sheet)}!$${colLetter(col)}$${row}`, name);
    this.names.push(name);
  }

  blank() {
    this.row++;
  }
}
