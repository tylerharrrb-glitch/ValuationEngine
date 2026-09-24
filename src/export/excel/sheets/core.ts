/** Normalization, WACC and DCF sheets (METHODOLOGY sections 1, 2, 4, 5). */
import { latestYear, priorYear } from '../../../domain/company';
import { type BuildCtx, ref, setRef } from '../context';
import { SheetWriter, fx, txt, FIRST_COL, colLetter } from '../writer';

export function buildNormalization(ctx: BuildCtx, w: SheetWriter) {
  const { c, a } = ctx;
  const y = latestYear(c);
  const fy = y.fiscalYear;
  w.title(`${c.shortName}: Normalization`, `Reported FY${fy} operating profit to normalized EBIT and EBITDA. Each adjustment is an analyst assumption and can be switched off on Inputs.`);
  w.section(`FY${fy}A`);
  w.header(['Amount', 'Include', 'Removed']);
  const op = w.line('Reported operating profit', 'EGP', [fx(ref(ctx, 'is.operatingProfit'), 'amount')], { note: 'Sourced fact' });
  const fieldOf: Record<string, string> = { ecl: 'eclReversal', impairment: 'impairmentReversal', provisions: 'provisionsReleased', capitalGains: 'capitalGains' };
  const removed: string[] = [];
  a.normalization.forEach((adj, i) => {
    const field = fieldOf[adj.id];
    const amount = field ? fx(ref(ctx, `is.${field}`), 'amount') : fx(ref(ctx, `is.otherOperating`), 'amount');
    const r = w.row;
    w.line(`Less: ${adj.label}`, 'EGP', [amount, fx(ref(ctx, `norm.include.${i}`), 'int'), fx(`$D$${r}*$E$${r}`, 'amount')], { note: `${adj.tag}. ${adj.note}` });
    removed.push(`$F$${r}`);
  });
  const tot = w.line('Total removed', 'EGP', [null, null, fx(removed.length ? removed.join('+') : `${w.ref(FIRST_COL, op, false)}-${w.ref(FIRST_COL, op, false)}`, 'amount')], { total: true });
  const ne = w.line('Normalized EBIT', 'EGP', [fx(`$D$${op}-$F$${tot}`, 'amount')], { bold: true, total: true });
  setRef(ctx, 'normEbit', w.ref(FIRST_COL, ne));
  const dep = w.line('Add: depreciation', 'EGP', [fx(ref(ctx, 'is.depreciation'), 'amount')], { note: 'Sourced fact (notes)' });
  const am = w.line('Add: amortization', 'EGP', [fx(ref(ctx, 'is.amortization'), 'amount')], { note: 'Sourced fact (notes)' });
  const nebitda = w.line('Normalized EBITDA', 'EGP', [fx(`$D$${ne}+$D$${dep}+$D$${am}`, 'amount')], { bold: true, total: true });
  setRef(ctx, 'normEbitda', w.ref(FIRST_COL, nebitda));
  const rep = w.line('Reported EBITDA (operating profit + D&A)', 'EGP', [fx(`$D$${op}+$D$${dep}+$D$${am}`, 'amount')]);
  setRef(ctx, 'repEbitda', w.ref(FIRST_COL, rep));
  w.blank();
  w.textLine('Finance income and FX translation gains or losses are non-operating: excluded from FCFF; the related balance-sheet items enter the equity bridge.');
}

export function buildWacc(ctx: BuildCtx, w: SheetWriter) {
  const { c } = ctx;
  const v = ctx.v.core.wacc;
  w.title(`${c.shortName}: Cost of capital`, 'Risk-free rate, bottom-up beta, cost of equity, cost of debt and weights. All rates from the frozen snapshot on Inputs.');
  const R = (id: string) => ref(ctx, `rate.${id}`);
  const D = (r: number) => `$D$${r}`;

  w.section('Risk-free rate');
  w.header(['Value']);
  const rfA = w.line('(a) EGP 10Y secondary YTM', '%', [fx(R('eg.bond10ySecondary'), 'pct2')], { note: `As of ${ctx.snap.entries.find((e) => e.id === 'eg.bond10ySecondary')?.asOf}, status ${ctx.snap.entries.find((e) => e.id === 'eg.bond10ySecondary')?.status}` });
  const rfB = w.line('(b) CBE auction yield (selected tenor)', '%', [fx(ref(ctx, 'auctionRate'), 'pct2')]);
  const rfC = w.line('(c) Damodaran inflation-based EGP riskfree', '%', [fx(R('damodaran.rf.egp'), 'pct2')]);
  const rfD = w.line('(d) US 10Y converted with expected inflation (Fisher)', '%', [fx(`(1+${R('us.treasury10y')})*(1+${R('damodaran.expectedInflation.egp')})/(1+${R('damodaran.expectedInflation.usd')})-1`, 'pct2')]);
  const src = ref(ctx, 'rfSource');
  const rf = w.line('Risk-free rate used', '%', [fx(`IF(${src}="eg_10y_secondary",${D(rfA)},IF(${src}="cbe_auction",${D(rfB)},IF(${src}="damodaran_egp",${D(rfC)},${D(rfD)})))`, 'pct2')], { bold: true, name: 'Rf', note: `Source: ${v.rfSource}` });
  const clean = w.line('Clean risk-free rate (1 = yes)', 'flag', [fx(`IF(OR(${src}="damodaran_egp",${src}="fisher_us10y"),1,0)`, 'int')], { note: 'Local government yields already contain sovereign default risk' });
  setRef(ctx, 'w.rf', w.ref(FIRST_COL, rf));

  w.section('Beta (bottom-up)');
  w.header(['Value']);
  const bu = w.line('Unlevered beta (corrected for cash)', 'x', [fx(ref(ctx, 'betaU'), 'ratio4')], { note: `Industry: ${v.betaIndustry}; dataset ${v.betaDatasetDate}` });
  const debt = w.line('Interest-bearing debt (bank, bonds, leases)', 'EGP', [fx(`${ref(ctx, 'bs.bankDebtCurrent')}+${ref(ctx, 'bs.bankDebtNonCurrent')}+${ref(ctx, 'bs.bondsNonCurrent')}+${ref(ctx, 'bs.leaseCurrent')}+${ref(ctx, 'bs.leaseNonCurrent')}`, 'amount')], { note: 'Book value as market-value proxy' });
  const eq = w.line('Market value of equity', 'EGP', [fx(`${ref(ctx, 'price')}*${ref(ctx, 'shares')}`, 'amount')], { note: 'Price × diluted shares' });
  const de = w.line('D/E', 'x', [fx(`${D(debt)}/${D(eq)}`, 'ratio4')]);
  const bl = w.line('Levered beta', 'x', [fx(`${D(bu)}*(1+(1-${ref(ctx, 'releverTax')})*${D(de)})`, 'ratio4')], { bold: true, note: 'βU × (1 + (1 − t) × D/E)' });
  setRef(ctx, 'w.betaL', w.ref(FIRST_COL, bl));

  w.section('Cost of equity');
  w.header(['Value']);
  const erp = w.line('Mature-market ERP', '%', [fx(R('damodaran.matureErp'), 'pct2')]);
  const crp = w.line('Egypt country risk premium', '%', [fx(R('damodaran.egypt.crp'), 'pct2')]);
  const sp = w.line('Size / illiquidity premium', '%', [fx(ref(ctx, 'sizePremium'), 'pct2')]);
  const m = ref(ctx, 'capm');
  const betaPrem = w.line('Premium multiplied by beta', '%', [fx(`IF(${m}="B",${D(erp)}+${D(crp)},${D(erp)})`, 'pct2')], { note: 'Method B loads CRP into the beta premium' });
  const keConst = w.line('Premium added outside beta', '%', [fx(`IF(${m}="A",${D(crp)},IF(${m}="C",${ref(ctx, 'lambda')}*${D(crp)},0))+${D(sp)}`, 'pct2')], { note: 'Method A: CRP; C: λ × CRP; local_rf and B: none' });
  const ke = w.line('Cost of equity (Ke)', '%', [fx(`${D(rf)}+${D(bl)}*${D(betaPrem)}+${D(keConst)}`, 'pct2')], { bold: true, total: true, name: 'Ke', note: `Method ${v.capmMethod}` });
  setRef(ctx, 'w.betaPrem', w.ref(FIRST_COL, betaPrem));
  setRef(ctx, 'w.keConst', w.ref(FIRST_COL, keConst));
  setRef(ctx, 'w.ke', w.ref(FIRST_COL, ke));
  setRef(ctx, 'w.erp', w.ref(FIRST_COL, erp));
  setRef(ctx, 'w.crp', w.ref(FIRST_COL, crp));
  setRef(ctx, 'w.sp', w.ref(FIRST_COL, sp));

  w.section('Cost of debt');
  w.header(['Value']);
  const interest = w.line('Debt and lease interest (employee-benefit interest excluded)', 'EGP', [fx(`-(${ref(ctx, 'is.financeCostDebt')}+${ref(ctx, 'is.financeCostLease')})`, 'amount')]);
  const cov = w.line('Interest coverage (normalized EBIT / interest)', 'x', [fx(`IF(${D(interest)}>0,${ref(ctx, 'normEbit')}/${D(interest)},"no interest")`, 'ratio')]);
  const idx = w.line('Synthetic rating table row', 'row', [fx(`IF(${D(interest)}>0,MATCH(${D(cov)},${ref(ctx, 'syn.above')},1),ROWS(${ref(ctx, 'syn.above')}))`, 'int')], { note: 'Largest lower coverage bound not above the coverage' });
  w.line('Synthetic rating', 'text', [fx(`INDEX(${ref(ctx, 'syn.rating')},${D(idx)})`)]);
  const spread = w.line('Company default spread', '%', [fx(`INDEX(${ref(ctx, 'syn.spread')},${D(idx)})`, 'pct2')]);
  const cds = w.line('Country default spread (added when Rf is clean)', '%', [fx(R('damodaran.egypt.defaultSpread'), 'pct2')]);
  const kdSyn = w.line('Kd, synthetic', '%', [fx(`${D(rf)}+${D(spread)}+${D(clean)}*${D(cds)}`, 'pct2')]);
  const kdCbe = w.line('Kd, CBE lending + spread', '%', [fx(`${R('cbe.overnightLending')}+${ref(ctx, 'kdSpread')}`, 'pct2')]);
  const p = priorYear(c);
  const avgDebt = p
    ? `AVERAGE(${D(debt)},${ref(ctx, 'bs.bankDebtCurrent.prior')}+${ref(ctx, 'bs.bankDebtNonCurrent.prior')}+${ref(ctx, 'bs.bondsNonCurrent.prior')}+${ref(ctx, 'bs.leaseCurrent.prior')}+${ref(ctx, 'bs.leaseNonCurrent.prior')})`
    : D(debt);
  const kdAct = w.line('Kd, actual (interest / average interest-bearing debt)', '%', [fx(`IFERROR(${D(interest)}/(${avgDebt}),"n/a")`, 'pct2')]);
  const km = ref(ctx, 'kdMethod');
  const kd = w.line('Pre-tax cost of debt used', '%', [fx(`IF(${km}="synthetic",${D(kdSyn)},IF(${km}="cbe_plus_spread",${D(kdCbe)},${D(kdAct)}))`, 'pct2')], { bold: true, note: `Method ${v.kdMethod}` });
  const tax = w.line('Tax rate', '%', [fx(R('eg.cit'), 'pct2')], { name: 'Tax_Rate' });
  const kdAt = w.line('After-tax cost of debt', '%', [fx(`${D(kd)}*(1-${D(tax)})`, 'pct2')], { total: true });
  setRef(ctx, 'w.spreadEff', w.ref(FIRST_COL, w.line('Company spread for the USD check (0 unless synthetic)', '%', [fx(`IF(${km}="synthetic",${D(spread)},0)`, 'pct2')])));
  setRef(ctx, 'w.kdRfLinked', w.ref(FIRST_COL, w.line('Kd moves with Rf (1 = synthetic)', 'flag', [fx(`IF(${km}="synthetic",1,0)`, 'int')])));
  setRef(ctx, 'w.kdConst', w.ref(FIRST_COL, w.line('Kd component independent of Rf', '%', [fx(`IF(${km}="synthetic",${D(spread)}+${D(clean)}*${D(cds)},${D(kd)})`, 'pct2')])));
  setRef(ctx, 'w.tax', w.ref(FIRST_COL, tax));
  setRef(ctx, 'w.cds', w.ref(FIRST_COL, cds));

  w.section('Weights and WACC');
  w.header(['Value']);
  const wm = ref(ctx, 'weightMethod');
  const ev = w.line('E/V', '%', [fx(`IF(${wm}="target",1-${ref(ctx, 'targetDv')},${D(eq)}/(${D(eq)}+${D(debt)}))`, 'pct2')]);
  const dv = w.line('D/V', '%', [fx(`IF(${wm}="target",${ref(ctx, 'targetDv')},${D(debt)}/(${D(eq)}+${D(debt)}))`, 'pct2')]);
  const wacc = w.line('WACC', '%', [fx(`${D(ev)}*${D(ke)}+${D(dv)}*${D(kdAt)}`, 'pct2')], { bold: true, total: true, name: 'WACC' });
  setRef(ctx, 'w.ev', w.ref(FIRST_COL, ev));
  setRef(ctx, 'w.dv', w.ref(FIRST_COL, dv));
  setRef(ctx, 'wacc', w.ref(FIRST_COL, wacc));
  for (const m of v.messages) w.textLine(txt(m.text));
}

export function buildDcf(ctx: BuildCtx, w: SheetWriter) {
  const { c } = ctx;
  const n = ctx.n;
  const y = latestYear(c);
  w.title(`${c.shortName}: DCF`, 'Stub year and mid-year timing from the valuation date; Gordon and exit-multiple terminal values; equity bridge from the latest balance sheet (cash flows between the year end and the valuation date are not captured).');
  const cols = Array.from({ length: n }, (_, k) => FIRST_COL + k);
  const L = (k: number) => colLetter(FIRST_COL + k);
  const V = ref(ctx, 'valDate');
  const days = ref(ctx, 'days');
  const W = ref(ctx, 'wacc');
  w.section('Discounting (valuation date, stub, mid-year)');
  w.header(Array.from({ length: n }, (_, k) => `${y.fiscalYear + k + 1}E`), 'Unit');
  const fye = w.row;
  w.line('Fiscal year ended', 'date', cols.map((_, k) => fx(k === 0
    ? `DATE(YEAR(${ref(ctx, 'baseFye')})+1,MONTH(${ref(ctx, 'baseFye')}),DAY(${ref(ctx, 'baseFye')}))`
    : `DATE(YEAR($${L(k - 1)}$${fye})+1,MONTH($${L(k - 1)}$${fye}),DAY($${L(k - 1)}$${fye}))`, 'date')));
  const start = w.line('Period start', 'date', cols.map((_, k) => fx(k === 0 ? `MAX(${V},${ref(ctx, 'baseFye')})` : `$${L(k - 1)}$${fye}`, 'date')));
  const frac = w.line('Share of year cash flow included', '%', cols.map((_, k) => fx(k === 0 ? `IF(${V}>${ref(ctx, 'baseFye')},YEARFRAC(${V},$${L(0)}$${fye},1),1)` : `YEARFRAC($${L(k)}$${start},$${L(k)}$${fye},1)`, 'pct')), { note: 'Year 1 = YEARFRAC(valuation date, first fiscal year end, actual/actual)' });
  const disc = w.line('Date for discounting', 'date', cols.map((_, k) => fx(`IF(${ref(ctx, 'midyear')}=1,AVERAGE($${L(k)}$${start},$${L(k)}$${fye}),$${L(k)}$${fye})`, 'date')), { note: 'Mid-point of the period when mid-year is on, else period end' });
  const yrs = w.line('Years from valuation date', 'years', cols.map((_, k) => fx(`($${L(k)}$${disc}-${V})/${days}`, 'ratio4')));
  const df = w.line('Discount factor', 'x', cols.map((_, k) => fx(`(1+${W})^(-$${L(k)}$${yrs})`, 'ratio4')));
  const fcff = w.line('FCFF', 'EGP', cols.map((_, k) => fx(ref(ctx, `m.fcff.${k + 1}`), 'amount')), { note: 'Operating Model' });
  const inc = w.line('FCFF included', 'EGP', cols.map((_, k) => fx(`$${L(k)}$${fcff}*$${L(k)}$${frac}`, 'amount')));
  const pv = w.line('Present value', 'EGP', cols.map((_, k) => fx(`$${L(k)}$${inc}*$${L(k)}$${df}`, 'amount')), { bold: true, total: true });
  for (let k = 0; k < n; k++) {
    setRef(ctx, `dcf.frac.${k + 1}`, w.ref(FIRST_COL + k, frac));
    setRef(ctx, `dcf.years.${k + 1}`, w.ref(FIRST_COL + k, yrs));
  }
  setRef(ctx, 'dcf.fracRange', w.rangeRow(frac, FIRST_COL, FIRST_COL + n - 1));
  setRef(ctx, 'dcf.yearsRange', w.rangeRow(yrs, FIRST_COL, FIRST_COL + n - 1));
  setRef(ctx, 'dcf.incRange', w.rangeRow(inc, FIRST_COL, FIRST_COL + n - 1));

  const D = (r: number) => `$D$${r}`;
  w.section('Terminal value');
  w.header(['Value']);
  const sumPv = w.line('Sum of present values', 'EGP', [fx(`SUM(${w.rangeRow(pv, FIRST_COL, FIRST_COL + n - 1, false)})`, 'amount')], { bold: true });
  const tvYears = w.line('Years to final period end', 'years', [fx(`($${L(n - 1)}$${fye}-${V})/${days}`, 'ratio4')], { note: 'Terminal value discounted from the final period end' });
  const dfTv = w.line('Terminal discount factor', 'x', [fx(`(1+${W})^(-${D(tvYears)})`, 'ratio4')]);
  const g = ref(ctx, 'g');
  const fT = w.line('Terminal-year FCFF', 'EGP', [fx(ref(ctx, `m.fcff.${n + 1}`), 'amount')]);
  const gTv = w.line('Gordon terminal value', 'EGP', [fx(`IF(${g}<${W},${D(fT)}/(${W}-${g}),"n/a: g ≥ WACC")`, 'amount')], { note: 'FCFF(n+1) / (WACC − g)' });
  const gPv = w.line('PV of Gordon terminal value', 'EGP', [fx(`IFERROR(${D(gTv)}*${D(dfTv)},"n/a")`, 'amount')]);
  const eN = w.line('Final-year EBITDA', 'EGP', [fx(ref(ctx, `m.ebitda.${n}`), 'amount')]);
  const xTv = w.line('Exit-multiple terminal value', 'EGP', [fx(`${D(eN)}*${ref(ctx, 'exit')}`, 'amount')], { note: 'EBITDA(n) × exit multiple' });
  const xPv = w.line('PV of exit-multiple terminal value', 'EGP', [fx(`${D(xTv)}*${D(dfTv)}`, 'amount')]);
  const pvTv = w.line('PV of terminal value used', 'EGP', [fx(`IF(${ref(ctx, 'tvMethod')}="gordon",${D(gPv)},${D(xPv)})`, 'amount')], { bold: true, note: `Method: ${ctx.a.terminal.method}` });
  const ev = w.line('Enterprise value', 'EGP', [fx(`${D(sumPv)}+${D(pvTv)}`, 'amount')], { bold: true, total: true, name: 'Enterprise_Value' });
  const tvShare = w.line('PV of terminal value / EV', '%', [fx(`${D(pvTv)}/${D(ev)}`, 'pct')]);
  w.line('Implied exit multiple from Gordon', 'x', [fx(`IFERROR(${D(gTv)}/${D(eN)},"n/a")`, 'multiple')]);
  w.line('Implied growth from exit value', '%', [fx(`${W}-${D(fT)}/${D(xTv)}`, 'pct2')], { note: 'WACC − FCFF(n+1) / exit TV' });
  const ronic = w.line('RONIC', '%', [fx(`IF(ISNUMBER(${ref(ctx, 'ronicIn')}),${ref(ctx, 'ronicIn')},${W})`, 'pct2')]);
  w.line('Reinvestment rate implied by g / RONIC', '%', [fx(`${g}/${D(ronic)}`, 'pct')]);
  w.line('Terminal-year reinvestment rate in the forecast', '%', [fx(`(${ref(ctx, `m.capex.${n + 1}`)}-${ref(ctx, `m.da.${n + 1}`)}+${ref(ctx, `m.dnwc.${n + 1}`)})/${ref(ctx, `m.nopat.${n + 1}`)}`, 'pct')], { note: '(Capex − D&A + change in NWC) / NOPAT' });
  setRef(ctx, 'dcf.sumPv', w.ref(FIRST_COL, sumPv));
  setRef(ctx, 'dcf.tvYears', w.ref(FIRST_COL, tvYears));
  setRef(ctx, 'dcf.gordonTv', w.ref(FIRST_COL, gTv));
  setRef(ctx, 'dcf.exitTv', w.ref(FIRST_COL, xTv));
  setRef(ctx, 'dcf.pvTv', w.ref(FIRST_COL, pvTv));
  setRef(ctx, 'dcf.ev', w.ref(FIRST_COL, ev));
  setRef(ctx, 'dcf.tvShare', w.ref(FIRST_COL, tvShare));

  w.section(`Enterprise value to equity value (balance sheet ${y.periodEnd})`);
  w.header(['Value']);
  const bs = (f: string) => ref(ctx, `bs.${f}`);
  const lines: [string, string, string][] = [
    ['cash', 'Add: cash and cash equivalents', bs('cash')],
    ['fvtpl', 'Add: FVTPL securities', bs('fvtplSecurities')],
    ['amortizedCurrent', 'Add: amortized-cost investments (current)', bs('amortizedCostCurrent')],
    ['amortizedNonCurrent', 'Add: amortized-cost investments (non-current)', bs('amortizedCostNonCurrent')],
    ['associates', 'Add: associates', `IF(ISNUMBER(${ref(ctx, 'assocFv')}),${ref(ctx, 'assocFv')},${bs('associates')})`],
    ['debt', 'Less: bank debt and bonds', `-(${bs('bankDebtCurrent')}+${bs('bankDebtNonCurrent')}+${bs('bondsNonCurrent')})`],
    ['leases', 'Less: lease liabilities (EAS 49)', `-(${bs('leaseCurrent')}+${bs('leaseNonCurrent')})`],
    ['employeeBenefits', 'Less: employee benefit obligations', `-IF(${ref(ctx, 'ebOn')}=1,(${bs('employeeBenefitsCurrent')}+${bs('employeeBenefitsNonCurrent')})*IF(${ref(ctx, 'ebTax')}=1,1-${ref(ctx, 'rate.eg.cit')},1),0)`],
    ['minority', 'Less: minority interest', `-${bs('minorityInterest')}`],
    ['preferred', 'Less: preferred equity', `-${bs('preferredEquity')}`],
  ];
  const first = w.row;
  for (const [id, label, f] of lines) {
    const r = w.line(label, 'EGP', [fx(f, 'amount')], { note: 'Balance sheet' });
    setRef(ctx, `bridge.${id}`, w.ref(FIRST_COL, r));
  }
  const last = w.row - 1;
  const memo = w.line('Memo: restricted / pledged deposits (excluded)', 'EGP', [fx(`${bs('restrictedCashCurrent')}+${bs('restrictedCashNonCurrent')}`, 'amount')], { note: 'Not available to shareholders; not added' });
  setRef(ctx, 'bridge.restricted', w.ref(FIRST_COL, memo));
  const bt = w.line('Bridge total', 'EGP', [fx(`SUM(${w.rangeCol(FIRST_COL, first, last, false)})`, 'amount')], { total: true });
  setRef(ctx, 'dcf.bridgeTotal', w.ref(FIRST_COL, bt));
  const eqv = w.line('Equity value', 'EGP', [fx(`${D(ev)}+${D(bt)}`, 'amount')], { bold: true, total: true, name: 'Equity_Value' });
  const sh = w.line('Diluted shares', 'shares', [fx(ref(ctx, 'shares'), 'amount')]);
  const ps = w.line('DCF value per share', 'EGP', [fx(`${D(eqv)}/${D(sh)}`, 'perShare')], { bold: true, name: 'DCF_Per_Share' });
  const up = w.line('Upside versus price', '%', [fx(`${D(ps)}/${ref(ctx, 'price')}-1`, 'pct')]);
  setRef(ctx, 'dcf.equity', w.ref(FIRST_COL, eqv));
  setRef(ctx, 'dcf.perShare', w.ref(FIRST_COL, ps));
  setRef(ctx, 'dcf.upside', w.ref(FIRST_COL, up));

  w.section('Implied multiples');
  w.header(['Value']);
  setRef(ctx, 'dcf.evEbitdaLtm', w.ref(FIRST_COL, w.line(`EV / normalized EBITDA FY${y.fiscalYear}A`, 'x', [fx(`${D(ev)}/${ref(ctx, 'normEbitda')}`, 'multiple')])));
  setRef(ctx, 'dcf.evEbitdaNtm', w.ref(FIRST_COL, w.line(`EV / EBITDA FY${y.fiscalYear + 1}E`, 'x', [fx(`${D(ev)}/${ref(ctx, 'm.ebitda.1')}`, 'multiple')])));
  setRef(ctx, 'dcf.peLtm', w.ref(FIRST_COL, w.line(`Equity value / net profit FY${y.fiscalYear}A`, 'x', [fx(`${D(eqv)}/${ref(ctx, 'is.netProfit')}`, 'multiple')])));
  setRef(ctx, 'dcf.peNtm', w.ref(FIRST_COL, w.line(`Equity value / net profit FY${y.fiscalYear + 1}E`, 'x', [fx(`${D(eqv)}/${ref(ctx, 'm.np.1')}`, 'multiple')])));
}
