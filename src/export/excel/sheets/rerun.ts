/**
 * Scenarios and Sensitivity sheets. Every scenario and every sensitivity cell is a full
 * re-run expressed in live formulas (mini operating models where the forecast changes).
 */
import { type BuildCtx, ref, setRef } from '../context';
import { SheetWriter, fx, txt, FIRST_COL, colLetter, type Cell } from '../writer';
import { writeModel, type Deltas, type ModelRefs } from './model';

/** Valuation of a mini-model with a given WACC and terminal growth (expressions). Returns per-share ref. */
function miniValuation(ctx: BuildCtx, w: SheetWriter, m: ModelRefs, waccExpr: string, gExpr: string, prefix: string) {
  const n = ctx.n;
  const L = (k: number) => colLetter(FIRST_COL + k);
  const fcffRow = m.rows.fcff;
  const ebitdaRow = m.rows.ebitda;
  const cells: Cell[] = [null];
  for (let k = 1; k <= n; k++) {
    cells.push(fx(`$${L(k)}$${fcffRow}*${ref(ctx, `dcf.frac.${k}`)}*(1+${waccExpr})^(-${ref(ctx, `dcf.years.${k}`)})`, 'amount'));
  }
  const pv = w.line(`${prefix}Present value of FCFF`, 'EGP', cells);
  const D = (r: number) => `$D$${r}`;
  const sum = w.line(`${prefix}Sum of present values`, 'EGP', [fx(`SUM(${w.rangeRow(pv, FIRST_COL + 1, FIRST_COL + n, false)})`, 'amount')]);
  const tv = w.line(`${prefix}Terminal value`, 'EGP', [fx(`IF(${ref(ctx, 'tvMethod')}="gordon",IF(${gExpr}<${waccExpr},$${L(n + 1)}$${fcffRow}/(${waccExpr}-${gExpr}),"n/a"),$${L(n)}$${ebitdaRow}*${ref(ctx, 'exit')})`, 'amount')]);
  const ev = w.line(`${prefix}Enterprise value`, 'EGP', [fx(`IFERROR(${D(sum)}+${D(tv)}*(1+${waccExpr})^(-${ref(ctx, 'dcf.tvYears')}),"n/a")`, 'amount')], { total: true });
  const eq = w.line(`${prefix}Equity value`, 'EGP', [fx(`IFERROR(${D(ev)}+${ref(ctx, 'dcf.bridgeTotal')},"n/a")`, 'amount')]);
  const ps = w.line(`${prefix}Value per share`, 'EGP', [fx(`IFERROR(${D(eq)}/${ref(ctx, 'shares')},"n/a")`, 'perShare')], { bold: true });
  return { ev: w.ref(FIRST_COL, ev), equity: w.ref(FIRST_COL, eq), perShare: w.ref(FIRST_COL, ps) };
}

export function buildScenarios(ctx: BuildCtx, w: SheetWriter) {
  const { c, a } = ctx;
  const n = ctx.n;
  const base = c.years[c.years.length - 1].fiscalYear;
  w.title(`${c.shortName}: Scenarios`, 'Bear, Base and Bull are explicit driver sets on Inputs; each is a full re-run of the operating model and DCF below. Probabilities must sum to 100%.');
  const summaryRows = 18;
  const startSummary = w.row;
  w.row = startSummary + summaryRows;
  const outs: { ev: string; equity: string; perShare: string; wacc: string; g: string }[] = [];
  a.scenarios.forEach((s, i) => {
    w.section(`${s.name} case: operating model and DCF`);
    w.header([`${base}A`, ...Array.from({ length: n }, (_, k) => `${base + k + 1}E`), 'Terminal'], 'Unit');
    const wr = w.line(`${s.name}: WACC used`, '%', [fx(`${ref(ctx, 'wacc')}+${ref(ctx, `sc.dw.${i}`)}`, 'pct2')]);
    const gr = w.line(`${s.name}: terminal growth used`, '%', [fx(`${ref(ctx, 'g')}+${ref(ctx, `sc.dgt.${i}`)}`, 'pct2')]);
    const deltas: Deltas = { growth: ref(ctx, `sc.dg.${i}`), margin: ref(ctx, `sc.dm.${i}`), wacc: null, terminalGrowth: ref(ctx, `sc.dgt.${i}`) };
    const m = writeModel(ctx, w, deltas, false, `${s.name}: `);
    const val = miniValuation(ctx, w, m, `$D$${wr}`, `$D$${gr}`, `${s.name}: `);
    outs.push({ ...val, wacc: w.ref(FIRST_COL, wr), g: w.ref(FIRST_COL, gr) });
  });
  const end = w.row;
  w.row = startSummary;
  w.section('Scenario summary');
  w.header(a.scenarios.map((s) => s.name));
  const row = (label: string, unit: string, f: (i: number) => string, fmt: Parameters<typeof fx>[1], opts = {}) =>
    w.line(label, unit, a.scenarios.map((_, i) => fx(f(i), fmt)), opts);
  const prob = row('Probability', '%', (i) => ref(ctx, `sc.prob.${i}`), 'pct');
  row('Revenue growth delta (every year)', 'pp', (i) => ref(ctx, `sc.dg.${i}`), 'pct');
  row('Gross margin delta', 'pp', (i) => ref(ctx, `sc.dm.${i}`), 'pct');
  row('WACC delta', 'pp', (i) => ref(ctx, `sc.dw.${i}`), 'pct');
  row('Terminal growth delta', 'pp', (i) => ref(ctx, `sc.dgt.${i}`), 'pct');
  row('WACC used', '%', (i) => outs[i].wacc, 'pct2');
  row('Terminal growth used', '%', (i) => outs[i].g, 'pct2');
  row('Enterprise value', 'EGP', (i) => outs[i].ev, 'amount');
  row('Equity value', 'EGP', (i) => outs[i].equity, 'amount');
  const ps = row('Value per share', 'EGP', (i) => outs[i].perShare, 'perShare', { bold: true });
  row('Upside versus price', '%', (i) => `IFERROR(${outs[i].perShare}/${ref(ctx, 'price')}-1,"n/a")`, 'pct');
  const D = (r: number) => `$D$${r}`;
  const lastCol = FIRST_COL + a.scenarios.length - 1;
  const ps2 = w.line('Probability sum', '%', [fx(`SUM(${w.rangeRow(prob, FIRST_COL, lastCol, false)})`, 'pct')]);
  const wv = w.line('Probability-weighted value per share', 'EGP', [fx(`SUMPRODUCT(${w.rangeRow(prob, FIRST_COL, lastCol, false)},${w.rangeRow(ps, FIRST_COL, lastCol, false)})`, 'perShare')], { bold: true, total: true });
  setRef(ctx, 'sc.probSum', w.ref(FIRST_COL, ps2));
  setRef(ctx, 'sc.weighted', w.ref(FIRST_COL, wv));
  a.scenarios.forEach((s, i) => setRef(ctx, `sc.ps.${s.name}`, outs[i].perShare));
  void D;
  if (w.row > startSummary + summaryRows) throw new Error('Scenario summary block overflow');
  w.row = end;
}

export function buildSensitivity(ctx: BuildCtx, w: SheetWriter) {
  const { c } = ctx;
  const n = ctx.n;
  const T = n + 1;
  w.title(`${c.shortName}: Sensitivity`, 'Value per share, 5 × 5 grids with the base case at the centre. Each cell is a full re-run in formulas: grids 1, 2 and 4 re-discount the model cash flows; grid 3 uses one mini operating model per cell (below).');
  const W = ref(ctx, 'wacc');
  const G = ref(ctx, 'g');
  const off = (k: number) => ref(ctx, `off.${k}`);
  const inc = ref(ctx, 'dcf.incRange');
  const yrs = ref(ctx, 'dcf.yearsRange');
  const tv = ref(ctx, 'dcf.tvYears');
  const bridge = ref(ctx, 'dcf.bridgeTotal');
  const shares = ref(ctx, 'shares');
  const D = (r: number) => `$D$${r}`;
  const m = (row: string, k: number) => ref(ctx, `m.${row}.${k}`);
  const drv = (f: string) => ref(ctx, `drv.${f}.${T}`);
  const days = ref(ctx, 'days');

  // Terminal-year FCFF for each growth column (full terminal-year re-run).
  w.section('Grid 1 support: terminal-year FCFF by terminal growth');
  w.header(['g − 2 steps', 'g − 1 step', 'Base', 'g + 1 step', 'g + 2 steps']);
  const g5 = w.line('Terminal growth', '%', [0, 1, 2, 3, 4].map((k) => fx(`${G}+${off(k)}*${ref(ctx, 'st.g')}`, 'pct2')));
  const L = (k: number) => colLetter(FIRST_COL + k);
  const col5 = (f: (k: number) => string, fmt: Parameters<typeof fx>[1] = 'amount'): Cell[] => [0, 1, 2, 3, 4].map((k) => fx(f(k), fmt));
  const rev = w.line('Terminal-year revenue', 'EGP', col5((k) => `${m('revenue', n)}*(1+$${L(k)}$${g5})`));
  const ebitda = w.line('EBITDA', 'EGP', col5((k) => `$${L(k)}$${rev}*(${drv('grossMarginExDA')}-${drv('sgaPctRevenue')}+${drv('otherOpPctRevenue')})`));
  const dep = w.line('Depreciation', 'EGP', col5((k) => `IF(${ref(ctx, 'daMethod')}="ppe_rollforward",${drv('depreciationRate')}*${m('closePpe', n)},$${L(k)}$${rev}*${drv('daPctRevenue')})`));
  const am = w.line('Amortization', 'EGP', col5((k) => `IF(${ref(ctx, 'daMethod')}="ppe_rollforward",$${L(k)}$${rev}*${drv('amortizationPctRevenue')},0)`));
  const capex = w.line('Capex', 'EGP', col5((k) => `$${L(k)}$${rev}*${drv('capexPctRevenue')}`));
  const nopat = w.line('NOPAT', 'EGP', col5((k) => `($${L(k)}$${ebitda}-$${L(k)}$${dep}-$${L(k)}$${am})*(1-${drv('taxRate')})`));
  const cc = `(1-${drv('grossMarginExDA')})`;
  const nwc = w.line('Operating net working capital', 'EGP', col5((k) =>
    `$${L(k)}$${rev}*${drv('dso')}/${days}+$${L(k)}$${rev}*${cc}*${drv('dio')}/${days}+$${L(k)}$${rev}*${drv('otherCurrentAssetsPctRevenue')}-$${L(k)}$${rev}*${cc}*${drv('dpo')}/${days}-$${L(k)}$${rev}*${drv('otherCurrentLiabilitiesPctRevenue')}`));
  const dist = w.line('Distributions', 'EGP', col5(() => `IF(${ref(ctx, 'distOn')}=1,${ref(ctx, 'distPct')}*${m('np', n)},0)`));
  const tf = w.line('Terminal-year FCFF', 'EGP', col5((k) => `$${L(k)}$${nopat}+$${L(k)}$${dep}+$${L(k)}$${am}-$${L(k)}$${capex}-($${L(k)}$${nwc}-${m('nwc', n)})-$${L(k)}$${dist}`), { bold: true });

  const grids: { id: string; label: string; rowRef: (i: number) => string; colRef: (j: number) => string; cell: (r: string, c: string, j: number) => string; rowFmt: Parameters<typeof fx>[1]; colFmt: Parameters<typeof fx>[1]; rowLabel: string; colLabel: string }[] = [];
  const pvExplicit = (wExpr: string) => `SUMPRODUCT(${inc},(1+${wExpr})^(-${yrs}))`;

  grids.push({
    id: 'wacc_g', label: 'Grid 1: WACC × terminal growth (Gordon)', rowLabel: 'WACC', colLabel: 'Terminal growth',
    rowRef: (i) => `${W}+${off(i)}*${ref(ctx, 'st.wacc')}`, colRef: (j) => `$${L(j)}$${g5}`, rowFmt: 'pct2', colFmt: 'pct2',
    cell: (r, cc2, j) => `IF(${cc2}<${r},(${pvExplicit(r)}+$${L(j)}$${tf}/(${r}-${cc2})*(1+${r})^(-${tv})+${bridge})/${shares},"n/a")`,
  });
  grids.push({
    id: 'wacc_exit', label: 'Grid 2: WACC × exit multiple', rowLabel: 'WACC', colLabel: 'Exit EV/EBITDA',
    rowRef: (i) => `${W}+${off(i)}*${ref(ctx, 'st.wacc')}`, colRef: (j) => `${ref(ctx, 'exit')}+${off(j)}*${ref(ctx, 'st.exit')}`, rowFmt: 'pct2', colFmt: 'multiple',
    cell: (r, cc2) => `(${pvExplicit(r)}+${m('ebitda', n)}*${cc2}*(1+${r})^(-${tv})+${bridge})/${shares}`,
  });
  const waccOf = (rf: string, b: string) =>
    `(${ref(ctx, 'w.ev')}*(${rf}+${b}*${ref(ctx, 'w.betaPrem')}+${ref(ctx, 'w.keConst')})+${ref(ctx, 'w.dv')}*(${ref(ctx, 'w.kdRfLinked')}*${rf}+${ref(ctx, 'w.kdConst')})*(1-${ref(ctx, 'w.tax')}))`;
  grids.push({
    id: 'rf_beta', label: 'Grid 4: risk-free rate × levered beta', rowLabel: 'Risk-free rate', colLabel: 'Levered beta',
    rowRef: (i) => `${ref(ctx, 'w.rf')}+${off(i)}*${ref(ctx, 'st.rf')}`, colRef: (j) => `${ref(ctx, 'w.betaL')}+${off(j)}*${ref(ctx, 'st.beta')}`, rowFmt: 'pct2', colFmt: 'ratio',
    cell: (r, cc2) => {
      const wx = waccOf(r, cc2);
      return `IF(${ref(ctx, 'tvMethod')}="gordon",IF(${G}<${wx},(${pvExplicit(wx)}+${m('fcff', T)}/(${wx}-${G})*(1+${wx})^(-${tv})+${bridge})/${shares},"n/a"),(${pvExplicit(wx)}+${m('ebitda', n)}*${ref(ctx, 'exit')}*(1+${wx})^(-${tv})+${bridge})/${shares})`;
    },
  });

  const writeGrid = (g: (typeof grids)[number]) => {
    w.section(g.label);
    w.header([0, 1, 2, 3, 4].map((j) => fx(g.colRef(j), g.colFmt)), g.rowLabel + ' / ' + g.colLabel);
    const hdr = w.row - 1;
    const first = w.row;
    for (let i = 0; i < 5; i++) {
      const r = w.row;
      const rowCell = `$C$${r}`;
      w.line('', '', [0, 1, 2, 3, 4].map((j) => fx(g.cell(rowCell, `$${L(j)}$${hdr}`, j), 'perShare')));
      const c3 = w.ws.getCell(r, 3);
      c3.value = { formula: g.rowRef(i) } as never;
      c3.numFmt = g.rowFmt === 'pct2' ? '0.00%' : '0.00';
      c3.font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };
    }
    setRef(ctx, `grid.${g.id}.centre`, w.ref(FIRST_COL + 2, first + 2));
    setRef(ctx, `grid.${g.id}.first`, String(first));
  };
  writeGrid(grids[0]);
  writeGrid(grids[1]);

  // Grid 3: one mini operating model per cell.
  const g3Start = w.row;
  const cellRefs: string[][] = Array.from({ length: 5 }, () => Array(5).fill(''));
  const support: { i: number; j: number }[] = [];
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) support.push({ i, j });
  const gridBlockRows = 9;
  w.row = g3Start + gridBlockRows;
  const g4Start = w.row;
  w.row = g4Start + 9;
  w.section('Grid 3 support: one mini operating model per cell (revenue growth delta × gross margin delta)');
  for (const { i, j } of support) {
    const dr = w.line(`Cell (${i + 1},${j + 1}): revenue growth delta | gross margin delta`, 'pp', [fx(`${off(i)}*${ref(ctx, 'st.dg')}`, 'pct2'), fx(`${off(j)}*${ref(ctx, 'st.dm')}`, 'pct2')]);
    const deltas: Deltas = { growth: `$D$${dr}`, margin: `$E$${dr}`, wacc: null, terminalGrowth: null };
    const mm = writeModel(ctx, w, deltas, false, `(${i + 1},${j + 1}) `);
    const val = miniValuation(ctx, w, mm, W, G, `(${i + 1},${j + 1}) `);
    cellRefs[i][j] = val.perShare;
    w.blank();
  }
  const end = w.row;
  w.row = g3Start;
  w.section('Grid 3: revenue growth delta (rows) × gross margin delta (columns)');
  w.header([0, 1, 2, 3, 4].map((j) => fx(`${off(j)}*${ref(ctx, 'st.dm')}`, 'pct2')), 'Growth / Margin');
  const first3 = w.row;
  for (let i = 0; i < 5; i++) {
    const r = w.row;
    w.line('', '', [0, 1, 2, 3, 4].map((j) => fx(cellRefs[i][j], 'perShare')));
    const c3 = w.ws.getCell(r, 3);
    c3.value = { formula: `${off(i)}*${ref(ctx, 'st.dg')}` } as never;
    c3.numFmt = '0.00%';
    c3.font = { name: 'Calibri', size: 11, color: { argb: 'FF000000' } };
  }
  setRef(ctx, 'grid.growth_margin.centre', w.ref(FIRST_COL + 2, first3 + 2));
  setRef(ctx, 'grid.growth_margin.first', String(first3));
  if (w.row > g3Start + gridBlockRows) throw new Error('grid 3 block overflow');
  w.row = g4Start;
  writeGrid(grids[2]);
  if (w.row > g4Start + 9) throw new Error('grid 4 block overflow');
  w.row = end;
  void D;
  void txt;
}
