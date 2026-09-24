/**
 * Operating model rows (METHODOLOGY section 3) as live formulas. One generator serves the
 * Operating Model sheet (full display) and the scenario / sensitivity mini-models (deltas).
 * Columns: D = base year (actual), then one column per projection year, then Terminal.
 */
import { latestYear, priorYear } from '../../../domain/company';
import { type BuildCtx, ref, setRef } from '../context';
import { SheetWriter, fx, FIRST_COL, colLetter, type Cell } from '../writer';
import type { Fmt } from '../style';

export interface Deltas {
  /** References (cells) holding the deltas as fractions; null = none. */
  growth: string | null;
  margin: string | null;
  wacc: string | null;
  terminalGrowth: string | null;
}

export interface ModelRefs {
  /** Row numbers on the writer's sheet. */
  rows: Record<string, number>;
  col: (k: number) => number;
  /** Absolute ref of a model cell. */
  at: (row: string, k: number) => string;
}

/**
 * Writes the operating model. `full` adds driver-percentage rows and notes; mini-models omit them
 * (drivers are then referenced inline).
 */
export function writeModel(ctx: BuildCtx, w: SheetWriter, deltas: Deltas | null, full: boolean, prefix = ''): ModelRefs {
  const { c } = ctx;
  const n = ctx.n;
  const T = n + 1; // terminal index
  const y = latestYear(c);
  const p = priorYear(c);
  const col = (k: number) => FIRST_COL + k;
  const rows: Record<string, number> = {};
  const L = (k: number) => colLetter(col(k));
  const cell = (row: string, k: number) => `$${L(k)}$${rows[row]}`;
  const prev = (row: string, k: number) => `$${L(k - 1)}$${rows[row]}`;
  const drv = (field: string, k: number) => ref(ctx, `drv.${field}.${k}`);
  const is = (f: string) => ref(ctx, `is.${f}`);
  const bs = (f: string) => ref(ctx, `bs.${f}`);
  const days = ref(ctx, 'days');
  const add = (base: string, d: string | null) => (d ? `(${base}+${d})` : base);
  const growthDriver = (k: number) => (k === T ? add(ref(ctx, 'g'), deltas?.terminalGrowth ?? null) : add(drv('revenueGrowth', k), deltas?.growth ?? null));
  const gmDriver = (k: number) => add(drv('grossMarginExDA', k), deltas?.margin ?? null);

  const emit = (key: string, label: string, unit: string, cells: (k: number) => string | null, fmt: Fmt, note = '', opts: { bold?: boolean; total?: boolean } = {}) => {
    rows[key] = w.row;
    const cs: Cell[] = [];
    for (let k = 0; k <= T; k++) {
      const f = cells(k);
      cs.push(f === null ? null : fx(f, fmt));
    }
    w.line(prefix + label, unit, cs, { fmt, note: full ? note : undefined, ...opts });
  };

  const opt = (show: boolean, key: string, label: string, unit: string, cells: (k: number) => string | null, fmt: Fmt, note = '') => {
    if (show) emit(key, label, unit, cells, fmt, note);
  };

  // Revenue
  opt(full, 'growth', 'Revenue growth', '%', (k) => (k === 0 ? (p ? `${is('revenue')}/${ref(ctx, 'is.revenue.prior')}-1` : null) : growthDriver(k)), 'pct', 'Inputs; terminal year = terminal growth');
  emit('revenue', 'Revenue', 'EGP', (k) => (k === 0 ? is('revenue') : `${prev('revenue', k)}*(1+${full ? cell('growth', k) : growthDriver(k)})`), 'amount', 'Prior year × (1 + growth)', { bold: true });
  opt(full, 'gm', 'Gross margin before D&A', '%', (k) => (k === 0 ? `(${is('grossProfit')}+${is('depreciation')}+${is('amortization')})/${cell('revenue', 0)}` : gmDriver(k)), 'pct', 'All D&A assumed in cost of sales');
  const gm = (k: number) => (full ? cell('gm', k) : gmDriver(k));
  emit('gp', 'Gross profit before D&A', 'EGP', (k) => `${cell('revenue', k)}*${k === 0 && !full ? `((${is('grossProfit')}+${is('depreciation')}+${is('amortization')})/${cell('revenue', 0)})` : gm(k)}`, 'amount');
  opt(full, 'sgaPct', 'SG&A', '% revenue', (k) => (k === 0 ? `-(${is('sellingMarketing')}+${is('generalAdmin')})/${cell('revenue', 0)}` : drv('sgaPctRevenue', k)), 'pct');
  emit('sga', 'SG&A', 'EGP', (k) => (k === 0 ? `-(${is('sellingMarketing')}+${is('generalAdmin')})` : `${cell('revenue', k)}*${full ? cell('sgaPct', k) : drv('sgaPctRevenue', k)}`), 'amount');
  opt(full, 'othPct', 'Other operating (net)', '% revenue', (k) => (k === 0 ? `(${ref(ctx, 'normEbit')}-${is('grossProfit')}-${is('sellingMarketing')}-${is('generalAdmin')})/${cell('revenue', 0)}` : drv('otherOpPctRevenue', k)), 'pct', 'Normalized: after removing non-recurring items');
  emit('oth', 'Other operating income (net)', 'EGP', (k) => (k === 0 ? `${ref(ctx, 'normEbit')}-${is('grossProfit')}-${is('sellingMarketing')}-${is('generalAdmin')}` : `${cell('revenue', k)}*${full ? cell('othPct', k) : drv('otherOpPctRevenue', k)}`), 'amount');
  emit('ebitda', 'EBITDA', 'EGP', (k) => `${cell('gp', k)}-${cell('sga', k)}+${cell('oth', k)}`, 'amount', 'Base year = normalized EBITDA', { bold: true, total: true });

  // PP&E and D&A (closing PP&E is five rows below opening; forward reference fixed here)
  rows.closePpe = w.row + 5;
  emit('openPpe', 'Opening PP&E', 'EGP', (k) => (k === 0 ? null : k === 1 ? bs('ppe') : prev('closePpe', k)), 'amount');
  emit('dep', 'Depreciation', 'EGP', (k) => (k === 0 ? is('depreciation') : `IF(${ref(ctx, 'daMethod')}="ppe_rollforward",${drv('depreciationRate', k)}*${cell('openPpe', k)},${cell('revenue', k)}*${drv('daPctRevenue', k)})`), 'amount', 'Roll-forward: rate × opening PP&E; % revenue mode: D&A % × revenue');
  emit('am', 'Amortization', 'EGP', (k) => (k === 0 ? is('amortization') : `IF(${ref(ctx, 'daMethod')}="ppe_rollforward",${cell('revenue', k)}*${drv('amortizationPctRevenue', k)},0)`), 'amount');
  emit('da', 'D&A', 'EGP', (k) => `${cell('dep', k)}+${cell('am', k)}`, 'amount');
  emit('capex', 'Capex', 'EGP', (k) => (k === 0 ? `-${ref(ctx, 'cf.capex')}` : k === T ? `${cell('revenue', k)}*${drv('capexPctRevenue', k)}` : `IF(${ref(ctx, 'capexMode')}="absolute",${drv('capexAbsolute', k)},${cell('revenue', k)}*${drv('capexPctRevenue', k)})`), 'amount', 'Terminal year: % revenue (value-driver consistent)');
  if (rows.closePpe !== w.row) throw new Error('Operating model layout: closing PP&E row moved');
  emit('closePpe', 'Closing PP&E', 'EGP', (k) => (k === 0 ? bs('ppe') : `${cell('openPpe', k)}+${cell('capex', k)}-${cell('dep', k)}`), 'amount', 'Opening + capex − depreciation');

  // EBIT to NOPAT
  emit('ebit', 'EBIT', 'EGP', (k) => `${cell('ebitda', k)}-${cell('da', k)}`, 'amount', 'Base year = normalized EBIT', { bold: true });
  emit('tax', 'Tax rate on EBIT', '%', (k) => (k === 0 ? ref(ctx, 'rate.eg.cit') : drv('taxRate', k)), 'pct');
  emit('taxAmt', 'Tax on EBIT', 'EGP', (k) => `${cell('ebit', k)}*${cell('tax', k)}`, 'amount');
  emit('nopat', 'NOPAT', 'EGP', (k) => `${cell('ebit', k)}-${cell('taxAmt', k)}`, 'amount', '', { total: true });

  // Working capital
  emit('cc', 'Cash cost of sales', 'EGP', (k) => `${cell('revenue', k)}*(1-${k === 0 && !full ? `((${is('grossProfit')}+${is('depreciation')}+${is('amortization')})/${cell('revenue', 0)})` : gm(k)})`, 'amount', 'Revenue × (1 − gross margin before D&A)');
  const dayRow = (key: string, label: string, field: string, base: string) =>
    opt(full, key, label, 'days', (k) => (k === 0 ? base : drv(field, k)), 'days');
  dayRow('dso', 'Receivable days', 'dso', `${bs('receivables')}/${cell('revenue', 0)}*${days}`);
  emit('ar', 'Accounts receivable', 'EGP', (k) => (k === 0 ? bs('receivables') : `${cell('revenue', k)}*${full ? cell('dso', k) : drv('dso', k)}/${days}`), 'amount');
  dayRow('dio', 'Inventory days', 'dio', `${bs('inventory')}/${cell('cc', 0)}*${days}`);
  emit('inv', 'Inventory', 'EGP', (k) => (k === 0 ? bs('inventory') : `${cell('cc', k)}*${full ? cell('dio', k) : drv('dio', k)}/${days}`), 'amount');
  dayRow('dpo', 'Payable days', 'dpo', `${bs('tradePayables')}/${cell('cc', 0)}*${days}`);
  emit('ap', 'Trade payables', 'EGP', (k) => (k === 0 ? bs('tradePayables') : `${cell('cc', k)}*${full ? cell('dpo', k) : drv('dpo', k)}/${days}`), 'amount');
  const ocaBase = `${bs('otherCurrentAssets')}+${bs('supplierAdvances')}+${bs('dueFromRelatedParties')}`;
  const oclBase = `${bs('otherPayables')}+${bs('customerAdvances')}+${bs('provisions')}+${bs('dueToRelatedParties')}+${bs('otherCurrentLiabilities')}`;
  opt(full, 'ocaPct', 'Other operating current assets', '% revenue', (k) => (k === 0 ? `(${ocaBase})/${cell('revenue', 0)}` : drv('otherCurrentAssetsPctRevenue', k)), 'pct');
  emit('oca', 'Other operating current assets', 'EGP', (k) => (k === 0 ? ocaBase : `${cell('revenue', k)}*${full ? cell('ocaPct', k) : drv('otherCurrentAssetsPctRevenue', k)}`), 'amount', 'Debtors and other debit balances, supplier advances, due from related parties');
  opt(full, 'oclPct', 'Other operating current liabilities', '% revenue', (k) => (k === 0 ? `(${oclBase})/${cell('revenue', 0)}` : drv('otherCurrentLiabilitiesPctRevenue', k)), 'pct');
  emit('ocl', 'Other operating current liabilities', 'EGP', (k) => (k === 0 ? oclBase : `${cell('revenue', k)}*${full ? cell('oclPct', k) : drv('otherCurrentLiabilitiesPctRevenue', k)}`), 'amount', 'Creditors and other credit balances, customer advances, provisions, due to related parties');
  emit('nwc', 'Operating net working capital', 'EGP', (k) => `${cell('ar', k)}+${cell('inv', k)}+${cell('oca', k)}-${cell('ap', k)}-${cell('ocl', k)}`, 'amount', '', { total: true });
  emit('dnwc', 'Change in net working capital', 'EGP', (k) => (k === 0 ? null : `${cell('nwc', k)}-${prev('nwc', k)}`), 'amount');

  // Distributions and FCFF
  emit('np', 'Net profit (forecast: NOPAT + after-tax net finance income)', 'EGP', (k) => (k === 0 ? is('netProfit') : `${cell('nopat', k)}+${ref(ctx, 'nfi')}*(1-${cell('tax', k)})`), 'amount', 'Distribution base and forward P/E only');
  emit('dist', 'Employee and board distributions', 'EGP', (k) => (k === 0 ? null : `IF(${ref(ctx, 'distOn')}=1,${ref(ctx, 'distPct')}*${prev('np', k)},0)`), 'amount', '% of prior-year net profit');
  emit('fcff', 'Free cash flow to the firm (FCFF)', 'EGP', (k) => (k === 0 ? null : `${cell('nopat', k)}+${cell('da', k)}-${cell('capex', k)}-${cell('dnwc', k)}-${cell('dist', k)}`), 'amount', 'NOPAT + D&A − capex − change in NWC − distributions', { bold: true, total: true });

  const at = (row: string, k: number) => w.ref(col(k), rows[row]);
  return { rows, col, at };
}

export function buildOperatingModel(ctx: BuildCtx, w: SheetWriter): ModelRefs {
  const { c } = ctx;
  const n = ctx.n;
  const y = latestYear(c);
  w.title(`${c.shortName}: Operating model`, 'Revenue to EBITDA, EBIT, NOPAT, working capital, PP&E roll-forward, distributions and FCFF. Drivers from Inputs; base year from the audited statements.');
  w.section('Operating model');
  w.header([`${y.fiscalYear}A`, ...Array.from({ length: n }, (_, k) => `${y.fiscalYear + k + 1}E`), 'Terminal'], 'Unit');
  const m = writeModel(ctx, w, null, true);
  for (const key of Object.keys(m.rows)) for (let k = 0; k <= n + 1; k++) setRef(ctx, `m.${key}.${k}`, m.at(key, k));
  setRef(ctx, 'm.fcffRange', w.rangeRow(m.rows.fcff, FIRST_COL + 1, FIRST_COL + n));
  return m;
}
