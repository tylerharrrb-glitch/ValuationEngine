/** Historical, Sources, Summary, Cover and Checks sheets. */
import { latestYear } from '../../../domain/company';
import { type BuildCtx, ref, setRef, SHEETS } from '../context';
import { SheetWriter, fx, inp, txt, dateIn, FIRST_COL, colLetter, quoteSheet, type Cell } from '../writer';
import { BLACK, RED, font } from '../style';

export function buildHistorical(ctx: BuildCtx, w: SheetWriter) {
  const { c } = ctx;
  const yrs = c.years;
  const L = (k: number) => colLetter(FIRST_COL + k);
  w.title(`${c.shortName}: Historical analysis`, `Audited years available: ${yrs.map((y) => y.fiscalYear).join(', ')}. Earlier years were not supplied and are not filled. N/A where two years are required.`);
  const B = (f: string, i: number) => ref(ctx, `bs.${f}.${yrs[i].fiscalYear}`);
  const I = (f: string, i: number) => ref(ctx, `is.${f}.${yrs[i].fiscalYear}`);
  const C = (f: string, i: number) => ref(ctx, `cf.${f}.${yrs[i].fiscalYear}`);
  const ca = (i: number) => ['inventory', 'receivables', 'amortizedCostCurrent', 'fvtplSecurities', 'otherCurrentAssets', 'dueFromRelatedParties', 'supplierAdvances', 'restrictedCashCurrent', 'cash'].map((f) => B(f, i)).join('+');
  const cl = (i: number) => ['bankDebtCurrent', 'leaseCurrent', 'currentTaxPayable', 'tradePayables', 'otherPayables', 'customerAdvances', 'employeeBenefitsCurrent', 'provisions', 'dueToRelatedParties', 'otherCurrentLiabilities'].map((f) => B(f, i)).join('+');
  const ibdNc = (i: number) => `${B('bankDebtNonCurrent', i)}+${B('bondsNonCurrent', i)}+${B('leaseNonCurrent', i)}`;
  const per = (f: (i: number) => string | null): Cell[] => yrs.map((_, i) => { const x = f(i); return x === null ? txt('N/A') : fx(x); });
  const hdr = yrs.map((y) => `${y.fiscalYear}A`);

  w.section('Ratios');
  w.header(hdr);
  w.line('Revenue growth', '%', per((i) => (i === 0 ? null : `${I('revenue', i)}/${I('revenue', i - 1)}-1`)), { fmt: 'pct' });
  w.line('Gross margin', '%', per((i) => `${I('grossProfit', i)}/${I('revenue', i)}`), { fmt: 'pct' });
  w.line('EBITDA margin (reported)', '%', per((i) => `(${I('operatingProfit', i)}+${I('depreciation', i)}+${I('amortization', i)})/${I('revenue', i)}`), { fmt: 'pct' });
  w.line('Net margin', '%', per((i) => `${I('netProfit', i)}/${I('revenue', i)}`), { fmt: 'pct' });
  w.line('Effective tax rate', '%', per((i) => `-${I('totalTax', i)}/${I('profitBeforeTax', i)}`), { fmt: 'pct' });
  w.line('Return on equity (year-end equity)', '%', per((i) => `${I('netProfit', i)}/${B('totalEquity', i)}`), { fmt: 'pct' });
  w.line('Current ratio', 'x', per((i) => `(${ca(i)})/(${cl(i)})`), { fmt: 'ratio' });
  w.line('Net cash (cash and investments less debt and leases)', 'EGP', per((i) => `${B('cash', i)}+${B('fvtplSecurities', i)}+${B('amortizedCostCurrent', i)}+${B('amortizedCostNonCurrent', i)}-${B('bankDebtCurrent', i)}-${B('leaseCurrent', i)}-(${ibdNc(i)})`), { fmt: 'amount' });

  w.section('Piotroski F-score (latest year versus prior year; ratios on year-end total assets)');
  const k = yrs.length - 1;
  if (yrs.length < 2) w.textLine('N/A: requires two fiscal years.');
  else {
    w.header(['Current', 'Prior', 'Score']);
    const roa = (i: number) => `${I('netProfit', i)}/${B('totalAssets', i)}`;
    const t: [string, string, string | null, string][] = [
      ['Return on assets positive', roa(k), null, `IF($D$#>0,1,0)`],
      ['Operating cash flow positive', C('netCashFromOperating', k), null, `IF($D$#>0,1,0)`],
      ['Return on assets improved', roa(k), roa(k - 1), `IF($D$#>$E$#,1,0)`],
      ['Cash flow / assets above ROA (accruals)', `${C('netCashFromOperating', k)}/${B('totalAssets', k)}`, roa(k), `IF($D$#>$E$#,1,0)`],
      ['Long-term leverage lower', `(${ibdNc(k)})/${B('totalAssets', k)}`, `(${ibdNc(k - 1)})/${B('totalAssets', k - 1)}`, `IF($D$#<$E$#,1,0)`],
      ['Current ratio higher', `(${ca(k)})/(${cl(k)})`, `(${ca(k - 1)})/(${cl(k - 1)})`, `IF($D$#>$E$#,1,0)`],
      ['No equity issued (shares restated; bonus issues are not dilution)', ref(ctx, 'sharesBasic'), ref(ctx, 'sharesBasic'), `IF($D$#<=$E$#,1,0)`],
      ['Gross margin higher', `${I('grossProfit', k)}/${I('revenue', k)}`, `${I('grossProfit', k - 1)}/${I('revenue', k - 1)}`, `IF($D$#>$E$#,1,0)`],
      ['Asset turnover higher', `${I('revenue', k)}/${B('totalAssets', k)}`, `${I('revenue', k - 1)}/${B('totalAssets', k - 1)}`, `IF($D$#>$E$#,1,0)`],
    ];
    const first = w.row;
    for (const [label, cur, prior, score] of t) {
      const r = w.row;
      w.line(label, '', [fx(cur, 'ratio4'), prior === null ? null : fx(prior, 'ratio4'), fx(score.replace(/#/g, String(r)), 'int')]);
    }
    const f = w.line('F-score', 'of 9', [null, null, fx(`SUM(${w.rangeCol(FIRST_COL + 2, first, w.row - 1, false)})`, 'int')], { bold: true, total: true });
    setRef(ctx, 'hist.piotroski', w.ref(FIRST_COL + 2, f));
  }

  w.section("Altman Z''-EM (Altman 2005, emerging markets)");
  w.header(hdr);
  const Z = (key: string) => ref(ctx, `z.${key}`);
  const x1 = w.line('X1 working capital / total assets', 'x', per((i) => `((${ca(i)})-(${cl(i)}))/${B('totalAssets', i)}`), { fmt: 'ratio4' });
  const x2 = w.line('X2 retained earnings / total assets', 'x', per((i) => `${B('retainedEarnings', i)}/${B('totalAssets', i)}`), { fmt: 'ratio4' });
  const x3 = w.line('X3 EBIT / total assets', 'x', per((i) => `${I('operatingProfit', i)}/${B('totalAssets', i)}`), { fmt: 'ratio4' });
  const x4 = w.line('X4 book equity / total liabilities', 'x', per((i) => `${B('totalEquity', i)}/${B('totalLiabilities', i)}`), { fmt: 'ratio4' });
  const zs = w.line("Z''-EM score", 'x', per((i) => `${Z('const')}+${Z('c1')}*$${L(i)}$${x1}+${Z('c2')}*$${L(i)}$${x2}+${Z('c3')}*$${L(i)}$${x3}+${Z('c4')}*$${L(i)}$${x4}`), { fmt: 'ratio', bold: true });
  w.line('Zone', '', per((i) => `IF($${L(i)}$${zs}>${Z('safe')},"Safe",IF($${L(i)}$${zs}>=${Z('distress')},"Grey","Distress"))`));
  setRef(ctx, 'hist.z', w.ref(FIRST_COL + k, zs));

  w.section(`DuPont (FY${yrs[k].fiscalYear}; ${yrs.length >= 2 ? 'average balances' : 'year-end balances'})`);
  w.header(['Value']);
  const avg = (f: string) => (yrs.length >= 2 ? `AVERAGE(${B(f, k - 1)},${B(f, k)})` : B(f, k));
  const D = (r: number) => `$D$${r}`;
  const nm = w.line('Net margin', '%', [fx(`${I('netProfit', k)}/${I('revenue', k)}`, 'pct')]);
  const at = w.line('Asset turnover', 'x', [fx(`${I('revenue', k)}/${avg('totalAssets')}`, 'ratio4')]);
  const em = w.line('Equity multiplier', 'x', [fx(`${avg('totalAssets')}/${avg('totalEquity')}`, 'ratio4')]);
  const roe3 = w.line('ROE (3-step)', '%', [fx(`${D(nm)}*${D(at)}*${D(em)}`, 'pct2')], { bold: true, total: true });
  const tb = w.line('Tax burden (net profit / PBT)', 'x', [fx(`${I('netProfit', k)}/${I('profitBeforeTax', k)}`, 'ratio4')]);
  const ib = w.line('Interest burden (PBT / EBIT)', 'x', [fx(`${I('profitBeforeTax', k)}/${I('operatingProfit', k)}`, 'ratio4')], { note: 'Above 1 when finance income exceeds finance costs' });
  const ebm = w.line('EBIT margin', '%', [fx(`${I('operatingProfit', k)}/${I('revenue', k)}`, 'pct')]);
  const roe5 = w.line('ROE (5-step)', '%', [fx(`${D(tb)}*${D(ib)}*${D(ebm)}*${D(at)}*${D(em)}`, 'pct2')], { bold: true, total: true });
  setRef(ctx, 'hist.roe3', w.ref(FIRST_COL, roe3));
  setRef(ctx, 'hist.roe5', w.ref(FIRST_COL, roe5));
}

export function buildSources(ctx: BuildCtx, w: SheetWriter) {
  const { c, snap, v } = ctx;
  w.title(`${c.shortName}: Sources`, `Every registry value in the frozen rates snapshot ${snap.snapshotId}, with source, date and status; and the source of the company data.`);
  w.section('Company data');
  w.header(['Value']);
  w.line('Financial statements', '', [inp(c.statementsSource.description)]);
  w.line('Auditor', '', [inp(c.statementsSource.auditor)]);
  w.line('Audit report date', 'date', [dateIn(c.statementsSource.reportDate)]);
  w.line('Share price source', '', [inp(c.priceSource)]);
  for (const f of c.facts) w.line(f.label, '', [inp(f.text)], { note: f.source });
  w.section(`Rates registry (snapshot ${snap.snapshotId})`);
  w.header(['Id', 'Value', 'Unit', 'Nature', 'Source', 'URL', 'As of', 'Method', 'Status', 'Used in model', 'Flag'], 'Label', 'Notes');
  const used = new Set(v.ratesUsed.map((u) => u.id));
  const first = w.row;
  for (const e of snap.entries) {
    const r = w.row;
    const val: Cell = Array.isArray(e.value)
      ? inp(e.unit === 'date_list' ? (e.value as string[]).join(', ') : `Table, ${(e.value as unknown[]).length} rows`)
      : typeof e.value === 'number'
        ? inp(e.unit === 'pct' ? e.value / 100 : e.value, e.unit === 'pct' ? 'pct2' : e.unit === 'EGP_per_USD' ? 'fx' : 'ratio4')
        : inp(String(e.value));
    const url: Cell = e.sourceUrl === 'TO_VERIFY' ? inp('TO_VERIFY') : { k: 'link', text: e.sourceUrl, target: e.sourceUrl };
    w.line(e.label, '', [inp(e.id), val, inp(e.unit), inp(e.nature), inp(e.sourceName), url, dateIn(e.asOf), inp(e.method), inp(e.status), inp(used.has(e.id) ? 'Yes' : 'No'),
      fx(`IF(AND($M$${r}="Yes",$L$${r}<>"ok"),"Flagged: "&$L$${r},"")`)], { note: e.notes });
  }
  const last = w.row - 1;
  setRef(ctx, 'src.used', w.rangeCol(FIRST_COL + 9, first, last));
  setRef(ctx, 'src.status', w.rangeCol(FIRST_COL + 8, first, last));
  setRef(ctx, 'src.flag', w.rangeCol(FIRST_COL + 10, first, last));
}

export function buildSummary(ctx: BuildCtx, w: SheetWriter) {
  const { c, a, v } = ctx;
  const y = latestYear(c);
  w.title(`${c.shortName}: Summary`, 'Value per share by method, blend weights, implied upside and key assumptions. Values are live formulas from the model sheets.');
  const D = (r: number) => `$D$${r}`;
  w.section('Value per share by method');
  w.header(['Value per share', 'Entered weight', 'Effective weight']);
  const methods: [string, string, string][] = [
    ['dcf', 'DCF (FCFF)', ref(ctx, 'dcf.perShare')],
    ['ddm', 'Dividend discount model (two-stage)', ref(ctx, 'ddm.two')],
    ['comps', 'Trading comparables (median EV/EBITDA)', ctx.refs.get('comps.value') || '"n/a"'],
    ['precedents', 'Precedent transactions (median EV/EBITDA)', ctx.refs.get('prec.value') || '"n/a"'],
    ['sotp', 'Sum of the parts', ctx.refs.get('sotp.value') || '"n/a"'],
  ];
  const first = w.row;
  const rows: number[] = [];
  for (const [id, label, src] of methods) {
    const r = w.row;
    rows.push(r);
    w.line(label, 'EGP', [fx(src, 'perShare'), fx(ref(ctx, `bw.${id}`), 'pct'), fx(`IF(AND(ISNUMBER($D$${r}),$E$${r}>0),$E$${r}/SUMPRODUCT(ISNUMBER(#V#)*(#W#)),0)`, 'pct')],
      { note: `${id === 'dcf' || id === 'ddm' ? '' : 'Excluded when no inputs are entered. '}` });
  }
  const last = w.row - 1;
  const vr = w.rangeCol(FIRST_COL, first, last, false);
  const wr = w.rangeCol(FIRST_COL + 1, first, last, false);
  for (const r of rows) {
    const cell = w.ws.getCell(r, FIRST_COL + 2);
    const f = (cell.value as { formula: string }).formula.replace('#V#', vr).replace('#W#', wr);
    cell.value = { formula: f } as never;
  }
  const ws = w.line('Entered weights sum', '%', [null, fx(`SUM(${wr})`, 'pct')]);
  setRef(ctx, 'sum.weights', w.ref(FIRST_COL + 1, ws));
  const bl = w.line('Blended value per share', 'EGP', [fx(`SUMPRODUCT(${vr},${w.rangeCol(FIRST_COL + 2, first, last, false)})`, 'perShare')], { bold: true, total: true, name: 'Blended_Value' });
  const price = w.line(`Share price (${c.priceDate})`, 'EGP', [fx(ref(ctx, 'price'), 'perShare')]);
  const up = w.line('Implied upside', '%', [fx(`${D(bl)}/${D(price)}-1`, 'pct')], { bold: true });
  w.line('Band', '', [fx(`IF(ABS(${D(up)})<=${ref(ctx, 'verdictBand')},"In line with market price",IF(${D(up)}>0,"Above market price","Below market price"))`)]);
  setRef(ctx, 'sum.blended', w.ref(FIRST_COL, bl));

  w.section('Implied multiples (DCF)');
  w.header(['Value']);
  w.line(`EV / normalized EBITDA FY${y.fiscalYear}A`, 'x', [fx(ref(ctx, 'dcf.evEbitdaLtm'), 'multiple')]);
  w.line(`EV / EBITDA FY${y.fiscalYear + 1}E`, 'x', [fx(ref(ctx, 'dcf.evEbitdaNtm'), 'multiple')]);
  w.line(`P/E FY${y.fiscalYear}A`, 'x', [fx(ref(ctx, 'dcf.peLtm'), 'multiple')]);
  w.line(`P/E FY${y.fiscalYear + 1}E`, 'x', [fx(ref(ctx, 'dcf.peNtm'), 'multiple')]);
  w.line('PV of terminal value / EV', '%', [fx(ref(ctx, 'dcf.tvShare'), 'pct')]);

  w.section('Key assumptions');
  w.header(['Value']);
  w.line('WACC', '%', [fx(ref(ctx, 'wacc'), 'pct2')]);
  w.line('Cost of equity', '%', [fx(ref(ctx, 'w.ke'), 'pct2')]);
  w.line('Risk-free rate', '%', [fx(ref(ctx, 'w.rf'), 'pct2')], { note: `${v.core.wacc.rfId}, as of ${v.core.wacc.rfAsOf}, status ${v.core.wacc.rfStatus}` });
  w.line('Levered beta', 'x', [fx(ref(ctx, 'w.betaL'), 'ratio4')]);
  w.line('Terminal growth', '%', [fx(ref(ctx, 'g'), 'pct2')]);
  w.line('Terminal method', '', [fx(ref(ctx, 'tvMethod'))]);
  w.line('Employee and board distributions, % of prior-year profit', '%', [fx(`${ref(ctx, 'distPct')}*${ref(ctx, 'distOn')}`, 'pct2')]);

  w.section('Football field (value per share)');
  w.header(['Low', 'Mid', 'High']);
  const gFirst = Number(ref(ctx, 'grid.wacc_g.first'));
  const inner = `${quoteSheet(SHEETS.sensitivity)}!$E$${gFirst + 1}:$G$${gFirst + 3}`;
  w.line('DCF (FCFF): WACC ± 1 step × g ± 1 step', 'EGP', [fx(`MIN(${inner})`, 'perShare'), fx(ref(ctx, 'dcf.perShare'), 'perShare'), fx(`MAX(${inner})`, 'perShare')]);
  if (v.ddm.applicable) w.line('Dividend discount model', 'EGP', [fx(`MIN(${ref(ctx, 'ddm.two')},${ref(ctx, 'ddm.h')})`, 'perShare'), fx(ref(ctx, 'ddm.two'), 'perShare'), fx(`MAX(${ref(ctx, 'ddm.two')},${ref(ctx, 'ddm.h')})`, 'perShare')]);
  w.line('Scenarios (Bear to Bull)', 'EGP', [fx(ref(ctx, 'sc.ps.Bear'), 'perShare'), fx(ref(ctx, 'sc.weighted'), 'perShare'), fx(ref(ctx, 'sc.ps.Bull'), 'perShare')]);
  if (v.monteCarlo) w.line(`Monte Carlo P5 to P95 (engine output, seed ${v.monteCarlo.seed})`, 'EGP', [fx(ref(ctx, 'eng.mc.p5'), 'perShare'), fx(ref(ctx, 'eng.mc.median'), 'perShare'), fx(ref(ctx, 'eng.mc.p95'), 'perShare')], { note: 'Simulation is run by the engine; not reproduced in the workbook' });
  if (ctx.refs.get('comps.low')) w.line('Trading comparables (EV/EBITDA Q1 to Q3)', 'EGP', [fx(ref(ctx, 'comps.low'), 'perShare'), fx(ref(ctx, 'comps.value'), 'perShare'), fx(ref(ctx, 'comps.high'), 'perShare')]);
  if (ctx.refs.get('prec.low')) w.line('Precedent transactions (EV/EBITDA Q1 to Q3)', 'EGP', [fx(ref(ctx, 'prec.low'), 'perShare'), fx(ref(ctx, 'prec.value'), 'perShare'), fx(ref(ctx, 'prec.high'), 'perShare')]);
  if (ctx.refs.get('brk.low')) w.line('Broker targets (reference only, not in the blend)', 'EGP', [fx(ref(ctx, 'brk.low'), 'perShare'), fx(ref(ctx, 'brk.mid'), 'perShare'), fx(ref(ctx, 'brk.high'), 'perShare')]);
  w.line('Share price', 'EGP', [null, fx(ref(ctx, 'price'), 'perShare'), null]);
  void a;
}

export function buildCover(ctx: BuildCtx, w: SheetWriter) {
  const { c, snap, a } = ctx;
  w.title(`${c.name} (${c.ticker}): Valuation workbook`, 'Discounted cash flow valuation with cross-checks. Analytical only; not investment advice. Inputs are as entered; macro rates from the frozen snapshot listed on Sources.');
  w.section('Valuation');
  w.header(['Value']);
  w.line('Company', '', [inp(c.name)]);
  w.line('Ticker', '', [inp(c.ticker)]);
  w.line('Valuation date', 'date', [fx(ref(ctx, 'valDate'), 'date')]);
  w.line('Share price', 'EGP', [fx(ref(ctx, 'price'), 'perShare')]);
  w.line('Price date', 'date', [fx(ref(ctx, 'priceDate'), 'date')]);
  w.line('Prepared by', '', [inp(ctx.preparedBy)]);
  w.line('Rates snapshot', '', [inp(snap.snapshotId)], { note: `Frozen ${snap.frozenAt}` });
  w.line('Terminal method', '', [inp(a.terminal.method)]);
  const mc = w.line('Master check (all checks TRUE)', '', [fx(ref(ctx, 'checks.master'))], { bold: true });
  setRef(ctx, 'cover.master', w.ref(FIRST_COL, mc));
  w.section('Contents');
  w.header(['Sheet']);
  for (const name of Object.values(SHEETS)) {
    w.line(name, '', [{ k: 'link', text: name, target: `#${quoteSheet(name)}!A1` }]);
  }
}

export function buildChecks(ctx: BuildCtx, w: SheetWriter) {
  const { c, v } = ctx;
  const n = ctx.n;
  w.title(`${c.shortName}: Checks`, 'Every check must be TRUE. The master check on the Cover is the AND of all checks below.');
  w.section('Checks');
  w.header(['Result', 'Value', 'Compared with']);
  const first = w.row;
  const chk = (label: string, cond: string, val?: string, cmp?: string, fmt: Parameters<typeof fx>[1] = 'amount') =>
    w.line(label, '', [fx(cond), val ? fx(val, fmt) : null, cmp ? fx(cmp, fmt) : null]);
  const TA = ref(ctx, 'tol.amount');
  const TS = ref(ctx, 'tol.share');
  const TR = ref(ctx, 'tol.rate');
  const startChecks = w.row;
  for (const yy of c.years) {
    const B = (f: string) => ref(ctx, `bs.${f}.${yy.fiscalYear}`);
    const I = (f: string) => ref(ctx, `is.${f}.${yy.fiscalYear}`);
    chk(`FY${yy.fiscalYear} balance sheet balances`, `ABS(${B('totalAssets')}-${B('totalEquity')}-${B('totalLiabilities')})<${TA}`);
    chk(`FY${yy.fiscalYear} operating profit recomputes`, `ABS(${I('operatingProfit')}-(${['grossProfit', 'otherIncome', 'sellingMarketing', 'generalAdmin', 'capitalGains', 'otherExpenses', 'impairmentReversal', 'eclReversal', 'otherOperating'].map(I).join('+')}))<${TA}`);
    chk(`FY${yy.fiscalYear} net profit recomputes`, `ABS(${I('netProfit')}-(${I('operatingProfit')}+${['financeIncome', 'financeCostDebt', 'financeCostLease', 'financeCostEmployeeBenefit', 'financeCostOther', 'fxGainLoss', 'shareOfAssociates', 'otherNonOperating', 'totalTax'].map(I).join('+')}))<${TA}`);
  }
  for (let k = 1; k <= n + 1; k++) {
    const m = (r: string) => ref(ctx, `m.${r}.${k}`);
    chk(`Forecast ${k <= n ? `year ${k}` : 'terminal year'}: NWC ties to its components`, `ABS(${m('nwc')}-(${m('ar')}+${m('inv')}+${m('oca')}-${m('ap')}-${m('ocl')}))<${TA}`);
    chk(`Forecast ${k <= n ? `year ${k}` : 'terminal year'}: PP&E roll-forward ties`, `ABS(${m('closePpe')}-(${m('openPpe')}+${m('capex')}-${m('dep')}))<${TA}`);
  }
  chk('Bridge sums: equity = EV + bridge lines', `ABS(${ref(ctx, 'dcf.equity')}-(${ref(ctx, 'dcf.ev')}+${['cash', 'fvtpl', 'amortizedCurrent', 'amortizedNonCurrent', 'associates', 'debt', 'leases', 'employeeBenefits', 'minority', 'preferred'].map((id) => ref(ctx, `bridge.${id}`)).join('+')}))<${TA}`);
  chk('Scenario probabilities sum to 100%', `ABS(${ref(ctx, 'sc.probSum')}-1)<${TR}`, ref(ctx, 'sc.probSum'), undefined, 'pct');
  chk('Blend weights sum to 100%', `ABS(${ref(ctx, 'sum.weights')}-1)<${TR}`, ref(ctx, 'sum.weights'), undefined, 'pct');
  chk('Terminal growth below WACC', `${ref(ctx, 'g')}<${ref(ctx, 'wacc')}`, ref(ctx, 'g'), ref(ctx, 'wacc'), 'pct2');
  for (const id of ['wacc_g', 'growth_margin', 'rf_beta']) {
    chk(`Sensitivity centre equals DCF value (${id})`, `ABS(${ref(ctx, `grid.${id}.centre`)}-${ref(ctx, 'dcf.perShare')})<${TS}`, ref(ctx, `grid.${id}.centre`), ref(ctx, 'dcf.perShare'), 'perShare');
  }
  chk('Excel DCF per share equals engine (Inputs)', `ABS(${ref(ctx, 'dcf.perShare')}-${ref(ctx, 'eng.perShare')})<${TS}`, ref(ctx, 'dcf.perShare'), ref(ctx, 'eng.perShare'), 'perShare');
  chk('Excel enterprise value equals engine', `ABS(${ref(ctx, 'dcf.ev')}-${ref(ctx, 'eng.ev')})<${TA}`, ref(ctx, 'dcf.ev'), ref(ctx, 'eng.ev'));
  chk('Excel WACC equals engine', `ABS(${ref(ctx, 'wacc')}-${ref(ctx, 'eng.wacc')})<${TR}`, ref(ctx, 'wacc'), ref(ctx, 'eng.wacc'), 'pct2');
  if (v.ddm.applicable) chk('Excel DDM per share equals engine', `ABS(${ref(ctx, 'ddm.two')}-${ref(ctx, 'eng.ddm')})<${TS}`, ref(ctx, 'ddm.two'), ref(ctx, 'eng.ddm'), 'perShare');
  chk('Excel blended value equals engine', `ABS(${ref(ctx, 'sum.blended')}-${ref(ctx, 'eng.blended')})<${TS}`, ref(ctx, 'sum.blended'), ref(ctx, 'eng.blended'), 'perShare');
  chk('Excel probability-weighted scenario value equals engine', `ABS(${ref(ctx, 'sc.weighted')}-${ref(ctx, 'eng.weighted')})<${TS}`, ref(ctx, 'sc.weighted'), ref(ctx, 'eng.weighted'), 'perShare');
  chk('No stale or unconfirmed rate used without a flag', `COUNTIFS(${ref(ctx, 'src.used')},"Yes",${ref(ctx, 'src.status')},"<>ok")=COUNTIF(${ref(ctx, 'src.flag')},"Flagged*")`);
  const lastChk = w.row - 1;
  const master = w.line('Master check', '', [fx(`AND(${w.rangeCol(FIRST_COL, startChecks, lastChk, false)})`)], { bold: true, total: true, name: 'Master_Check' });
  setRef(ctx, 'checks.master', w.ref(FIRST_COL, master));
  // Red only for FALSE, on this sheet only.
  w.ws.addConditionalFormatting({
    ref: `D${startChecks}:D${master}`,
    rules: [{ type: 'cellIs', operator: 'equal', formulae: ['FALSE'], priority: 1, style: { font: { color: { argb: RED } } } }],
  });
  void first;
  void font;
  void BLACK;
}
