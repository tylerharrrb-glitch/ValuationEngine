/** Inputs sheet: every hardcoded number in the workbook lives here (blue), with its tag and reason. */
import { IS_LINES, BS_LINES, CF_LINES, DRIVERS, type Line } from '../../../domain/lines';
import { dilutedShares, latestYear } from '../../../domain/company';
import type { YearDrivers } from '../../../domain/assumptions';
import type { SpreadRow } from '../../../engine/wacc';
import { ZEM } from '../../../engine/scores';
import { type BuildCtx, setRef, ref } from '../context';
import { SheetWriter, inp, fx, dateIn, FIRST_COL, type Cell } from '../writer';
import type { Fmt } from '../style';

const pct = (x: number | null | undefined) => (x === null || x === undefined ? null : x / 100);

export function buildInputs(ctx: BuildCtx, w: SheetWriter) {
  const { c, a, v, snap } = ctx;
  const n = ctx.n;
  const y = latestYear(c);
  const years = c.years;
  const lastCol = FIRST_COL + years.length - 1;
  w.title(`${c.shortName}: Inputs`, 'Every hardcoded number used by the workbook. Company data from the audited statements; rates from the frozen snapshot; assumptions as set by the analyst.');

  // ----------------------------------------------------------- company and timeline
  w.section('Company and timeline');
  w.header(['Value']);
  w.line('Company', '', [inp(c.name)], { note: 'Sourced fact' });
  w.line('Ticker', '', [inp(c.ticker)], { note: 'Sourced fact' });
  setRef(ctx, 'valDate', w.ref(FIRST_COL, w.line('Valuation date', 'date', [dateIn(a.valuationDate)], { name: 'Valuation_Date', note: 'Analyst assumption. Mandatory.' })));
  setRef(ctx, 'price', w.ref(FIRST_COL, w.line('Share price', 'EGP', [inp(c.price, 'perShare')], { name: 'Price', note: `Sourced fact: ${c.priceSource}` })));
  setRef(ctx, 'priceDate', w.ref(FIRST_COL, w.line('Price date', 'date', [dateIn(c.priceDate)], { note: 'Sourced fact. Mandatory.' })));
  const basic = w.line('Basic shares', 'shares', [inp(c.shares.basic, 'amount')], { note: `Sourced fact. ${c.shares.note}` });
  const dil = w.line('Dilutive items', 'shares', [inp(dilutedShares(c) - c.shares.basic, 'amount')], { note: c.shares.dilutiveItems.length ? c.shares.dilutiveItems.map((d) => d.label).join('; ') : 'None disclosed' });
  setRef(ctx, 'sharesBasic', w.ref(FIRST_COL, basic));
  setRef(ctx, 'shares', w.ref(FIRST_COL, w.line('Diluted shares', 'shares', [fx(`${w.ref(FIRST_COL, basic, false)}+${w.ref(FIRST_COL, dil, false)}`, 'amount')], { name: 'Shares_Diluted' })));
  setRef(ctx, 'baseFye', w.ref(FIRST_COL, w.line('Base fiscal year end', 'date', [dateIn(y.periodEnd)], { name: 'Base_FYE', note: 'Sourced fact: latest audited year end' })));
  setRef(ctx, 'midyear', w.ref(FIRST_COL, w.line('Mid-year discounting (1 = on, 0 = off)', 'flag', [inp(a.midYear ? 1 : 0, 'int')], { name: 'Midyear', note: 'Analyst assumption' })));
  setRef(ctx, 'days', w.ref(FIRST_COL, w.line('Days per year (unit conversion)', 'days', [inp(365, 'int')], { name: 'Days_Per_Year', note: 'Unit conversion for years from valuation date and working-capital days' })));
  w.line('Projection years', 'years', [inp(n, 'int')], { note: 'Structural: one column per projection year' });

  // ----------------------------------------------------------- historical statements
  const yearHeaders = years.map((yy) => `${yy.fiscalYear}A`);
  const hist = (title: string, lines: Line<any>[], pick: (i: number) => any, key: string) => {
    w.section(title);
    w.header(yearHeaders, 'EGP');
    for (const [field, label] of lines) {
      const fmt: Fmt = field === 'epsReported' ? 'perShare' : 'amount';
      const r = w.line(label, field === 'epsReported' ? 'EGP' : 'EGP', years.map((_, i) => inp(pick(i)[field] ?? null, fmt)), { note: 'Sourced fact: audited statements' });
      years.forEach((yy, i) => setRef(ctx, `${key}.${field}.${yy.fiscalYear}`, w.ref(FIRST_COL + i, r)));
      setRef(ctx, `${key}.${field}`, w.ref(lastCol, r));
      if (years.length >= 2) setRef(ctx, `${key}.${field}.prior`, w.ref(lastCol - 1, r));
    }
  };
  hist('Income statement', IS_LINES, (i) => years[i].income, 'is');
  hist('Balance sheet', BS_LINES, (i) => years[i].balance, 'bs');
  hist('Cash flow statement', CF_LINES, (i) => years[i].cashFlow, 'cf');
  setRef(ctx, 'histCols', JSON.stringify(years.map((_, i) => FIRST_COL + i)));

  // ----------------------------------------------------------- normalization
  w.section('Normalization adjustments (removed from reported operating profit)');
  w.header(['Include (1/0)']);
  a.normalization.forEach((adj, i) => {
    const r = w.line(adj.label, 'flag', [inp(adj.include ? 1 : 0, 'int')], { note: `${adj.tag}. ${adj.note}` });
    setRef(ctx, `norm.include.${i}`, w.ref(FIRST_COL, r));
  });

  // ----------------------------------------------------------- rates
  w.section(`Rates used (frozen snapshot ${snap.snapshotId})`);
  w.header(['Value']);
  const used = new Map(v.ratesUsed.map((u) => [u.id, u]));
  const rateIds = [
    'eg.bond10ySecondary', ...snap.entries.filter((e) => e.id.startsWith('eg.tbondAuction.')).map((e) => e.id), 'damodaran.rf.egp', 'us.treasury10y',
    'damodaran.expectedInflation.egp', 'damodaran.expectedInflation.usd', 'damodaran.matureErp', 'damodaran.egypt.crp', 'damodaran.egypt.defaultSpread',
    'eg.cit', 'eg.usdEgp', 'cbe.overnightLending',
  ];
  for (const id of rateIds) {
    const e = snap.entries.find((x) => x.id === id);
    if (!e) continue;
    const ov = a.costOfCapital.rateOverrides[id];
    const val = ov ? ov.value : (e.value as number);
    const isFx = e.unit === 'EGP_per_USD';
    const note = `${e.nature === 'estimate' ? 'Estimate' : 'Sourced fact'}: ${e.sourceName}, as of ${e.asOf}, status ${e.status}${ov ? `. OVERRIDE of registry value ${e.value}: ${ov.reason}` : ''}${used.has(id) ? '' : '. Not used by the selected methods.'}`;
    const r = w.line(`${e.label} [${id}]`, isFx ? 'EGP/USD' : '%', [inp(isFx ? val : pct(val), isFx ? 'fx' : 'pct2')], { note });
    setRef(ctx, `rate.${id}`, w.ref(FIRST_COL, r));
  }
  const cc = a.costOfCapital;
  const betaRow = (snap.entries.find((e) => e.id === 'damodaran.betas.emerging')!.value as unknown as { industry: string; unleveredBetaCorrectedForCash: number }[])
    .find((b) => b.industry === cc.betaIndustry);
  const betaU = cc.unleveredBetaOverride ?? betaRow?.unleveredBetaCorrectedForCash ?? NaN;
  setRef(ctx, 'betaU', w.ref(FIRST_COL, w.line('Unlevered beta (corrected for cash)', 'x', [inp(betaU, 'ratio4')], {
    name: 'Beta_Unlevered',
    note: cc.unleveredBetaOverride === null ? `Estimate: Damodaran emerging markets, industry "${cc.betaIndustry}", dataset ${v.core.wacc.betaDatasetDate}` : 'Analyst override',
  })));
  const synId = cc.syntheticTable === 'large' ? 'damodaran.synthetic.large' : 'damodaran.synthetic.small';
  const syn = (snap.entries.find((e) => e.id === synId)!.value as unknown as SpreadRow[]).slice().sort((p, q) => p.coverageAbove - q.coverageAbove);
  w.section(`Synthetic rating table (${synId}, sorted by lower coverage bound)`);
  w.header(['Coverage above', 'Rating', 'Spread']);
  const synStart = w.row;
  for (const s of syn) w.line('', '', [inp(s.coverageAbove, 'ratio'), inp(s.rating), inp(s.spread / 100, 'pct2')], { note: 'Estimate: Damodaran ratings.xls' });
  const synEnd = w.row - 1;
  setRef(ctx, 'syn.above', w.rangeCol(FIRST_COL, synStart, synEnd));
  setRef(ctx, 'syn.rating', w.rangeCol(FIRST_COL + 1, synStart, synEnd));
  setRef(ctx, 'syn.spread', w.rangeCol(FIRST_COL + 2, synStart, synEnd));

  // ----------------------------------------------------------- cost of capital choices
  w.section('Cost of capital');
  w.header(['Value']);
  setRef(ctx, 'rfSource', w.ref(FIRST_COL, w.line('Risk-free source (eg_10y_secondary / cbe_auction / damodaran_egp / fisher_us10y)', 'text', [inp(cc.rfSource)], { name: 'Rf_Source', note: 'Analyst assumption' })));
  setRef(ctx, 'auctionRate', w.ref(FIRST_COL, w.line('Auction yield used when source = cbe_auction', '%', [fx(ref(ctx, `rate.${cc.auctionTenorId}`), 'pct2')], { note: `Registry id ${cc.auctionTenorId}` })));
  setRef(ctx, 'capm', w.ref(FIRST_COL, w.line('CAPM method (local_rf / A / B / C)', 'text', [inp(cc.capmMethod)], { name: 'CAPM_Method', note: 'Analyst assumption' })));
  setRef(ctx, 'lambda', w.ref(FIRST_COL, w.line('Lambda (method C)', 'x', [inp(cc.lambda, 'ratio')], { note: 'Analyst assumption' })));
  setRef(ctx, 'sizePremium', w.ref(FIRST_COL, w.line('Size / illiquidity premium', '%', [inp(pct(cc.sizePremium.value), 'pct2')], { note: `${cc.sizePremium.tag}. ${cc.sizePremium.note}` })));
  setRef(ctx, 'releverTax', w.ref(FIRST_COL, w.line('Relevering tax rate', '%', [inp(pct(cc.releverTaxRate), 'pct2')], { note: 'Statutory CIT' })));
  setRef(ctx, 'kdMethod', w.ref(FIRST_COL, w.line('Cost of debt method (synthetic / cbe_plus_spread / actual)', 'text', [inp(cc.kdMethod)], { name: 'Kd_Method', note: 'Analyst assumption' })));
  setRef(ctx, 'kdSpread', w.ref(FIRST_COL, w.line('Spread over CBE lending rate', '%', [inp(pct(cc.kdSpreadOverCbe), 'pct2')], { note: 'Analyst assumption (used only with cbe_plus_spread)' })));
  setRef(ctx, 'weightMethod', w.ref(FIRST_COL, w.line('Capital weights (market / target)', 'text', [inp(cc.weightMethod)], { note: 'Analyst assumption' })));
  setRef(ctx, 'targetDv', w.ref(FIRST_COL, w.line('Target D/V', '%', [inp(pct(cc.targetDebtWeight), 'pct')], { note: 'Analyst assumption (used only with target weights)' })));

  // ----------------------------------------------------------- terminal
  w.section('Terminal value');
  w.header(['Value']);
  setRef(ctx, 'tvMethod', w.ref(FIRST_COL, w.line('Terminal method (gordon / exit_multiple)', 'text', [inp(a.terminal.method)], { name: 'Terminal_Method', note: 'Analyst assumption' })));
  setRef(ctx, 'g', w.ref(FIRST_COL, w.line('Terminal growth', '%', [inp(pct(a.terminal.growth.value), 'pct2')], { name: 'Terminal_Growth', note: `${a.terminal.growth.tag}. ${a.terminal.growth.note}` })));
  setRef(ctx, 'exit', w.ref(FIRST_COL, w.line('Exit multiple (EV/EBITDA)', 'x', [inp(a.terminal.exitMultiple.value, 'multiple')], { name: 'Exit_Multiple', note: `${a.terminal.exitMultiple.tag}. ${a.terminal.exitMultiple.note}` })));
  setRef(ctx, 'gdp', w.ref(FIRST_COL, w.line('Long-run nominal GDP proxy (growth warning)', '%', [inp(pct(a.terminal.nominalGdpProxy), 'pct')], { note: 'Analyst assumption' })));
  setRef(ctx, 'ronicIn', w.ref(FIRST_COL, w.line('RONIC (blank = WACC)', '%', [inp(a.terminal.ronic === null ? null : pct(a.terminal.ronic), 'pct2')], { note: 'Analyst assumption; default WACC (conservative)' })));
  setRef(ctx, 'tvShareLimit', w.ref(FIRST_COL, w.line('Terminal value share of EV warning level', '%', [inp(0.85, 'pct')], { note: 'Spec 5.5 guard' })));

  // ----------------------------------------------------------- per-year drivers
  w.section('Operating drivers per projection year');
  const yearsLbl = Array.from({ length: n }, (_, k) => `${y.fiscalYear + k + 1}E`);
  w.header([...yearsLbl, 'Terminal']);
  setRef(ctx, 'daMethod', w.ref(FIRST_COL, w.line('D&A method (ppe_rollforward / pct_revenue)', 'text', [inp(a.daMethod)], { name: 'DA_Method', note: 'Analyst assumption' })));
  setRef(ctx, 'capexMode', w.ref(FIRST_COL, w.line('Capex mode (pct_revenue / absolute)', 'text', [inp(a.capexMode)], { name: 'Capex_Mode', note: 'Analyst assumption; terminal year always % revenue' })));
  for (const [field, label, unit, fmt, isPct] of DRIVERS) {
    const val = (d: YearDrivers) => (isPct ? pct(d[field]) : d[field]);
    const cells: Cell[] = [...a.years.slice(0, n).map((d) => inp(val(d), fmt)), field === 'revenueGrowth' ? fx(ref(ctx, 'g'), fmt) : inp(val(a.terminal.drivers), fmt)];
    const r = w.line(label, unit, cells, {
      note: field === 'capexPctRevenue'
        ? 'Analyst assumption: FY actual fading linearly to the terminal level; terminal = value-driver consistent (g / RONIC reinvestment)'
        : field === 'revenueGrowth' ? 'Analyst assumption: FY actual fading linearly to terminal growth' : field === 'taxRate' ? 'Statutory CIT' : 'Analyst assumption: FY actual, linear fade to terminal',
    });
    for (let k = 0; k <= n; k++) setRef(ctx, `drv.${field}.${k + 1}`, w.ref(FIRST_COL + k, r));
  }

  // ----------------------------------------------------------- Egypt and bridge
  w.section('Egypt-specific adjustments and bridge options');
  w.header(['Value']);
  setRef(ctx, 'distOn', w.ref(FIRST_COL, w.line('Deduct employee and board distributions (1/0)', 'flag', [inp(a.egypt.distributionsOn ? 1 : 0, 'int')], { note: 'Analyst assumption. Under EAS these go through equity but are a recurring cash payment to non-shareholders.' })));
  setRef(ctx, 'distPct', w.ref(FIRST_COL, w.line('Distributions, % of prior-year net profit', '%', [inp(pct(a.egypt.distributionsPct.value), 'pct2')], { note: `${a.egypt.distributionsPct.tag}. ${a.egypt.distributionsPct.note}` })));
  setRef(ctx, 'nfi', w.ref(FIRST_COL, w.line('Net finance income (annual, pre-tax)', 'EGP', [inp(a.egypt.netFinanceIncome.value, 'amount')], { note: `${a.egypt.netFinanceIncome.tag}. ${a.egypt.netFinanceIncome.note}` })));
  setRef(ctx, 'ebOn', w.ref(FIRST_COL, w.line('Deduct employee benefit obligations (1/0)', 'flag', [inp(a.bridge.deductEmployeeBenefits ? 1 : 0, 'int')], { note: 'Analyst assumption' })));
  setRef(ctx, 'ebTax', w.ref(FIRST_COL, w.line('Tax-effect employee benefit obligations (1/0)', 'flag', [inp(a.bridge.taxEffectEmployeeBenefits ? 1 : 0, 'int')], { note: 'Analyst assumption' })));
  setRef(ctx, 'assocFv', w.ref(FIRST_COL, w.line('Associates fair value (blank = carrying value)', 'EGP', [inp(a.bridge.associatesFairValue, 'amount')], { note: 'Analyst assumption' })));

  // ----------------------------------------------------------- scenarios
  w.section('Scenario driver sets (full re-runs)');
  w.header(a.scenarios.map((s) => s.name));
  const sRow = (label: string, unit: string, f: (s: (typeof a.scenarios)[number]) => number, key: string, fmt: Fmt) => {
    const r = w.line(label, unit, a.scenarios.map((s) => inp(f(s), fmt)), { note: 'Analyst assumption' });
    a.scenarios.forEach((_, i) => setRef(ctx, `sc.${key}.${i}`, w.ref(FIRST_COL + i, r)));
    setRef(ctx, `sc.${key}.range`, w.rangeRow(r, FIRST_COL, FIRST_COL + a.scenarios.length - 1));
  };
  sRow('Probability', '%', (s) => s.probability / 100, 'prob', 'pct');
  sRow('Revenue growth delta (every projection year)', 'pp', (s) => s.revenueGrowthDelta / 100, 'dg', 'pct');
  sRow('Gross margin delta (every year, incl. terminal)', 'pp', (s) => s.marginDelta / 100, 'dm', 'pct');
  sRow('WACC delta', 'pp', (s) => s.waccDelta / 100, 'dw', 'pct');
  sRow('Terminal growth delta', 'pp', (s) => s.growthDelta / 100, 'dgt', 'pct');

  // ----------------------------------------------------------- DDM
  w.section('Dividend discount model');
  w.header(['Value']);
  setRef(ctx, 'dpsOverride', w.ref(FIRST_COL, w.line('DPS override (blank = shareholder dividends / basic shares)', 'EGP', [inp(a.ddm.dpsOverride, 'perShare')], { note: 'Employee and board distributions are never included' })));
  setRef(ctx, 'gH', w.ref(FIRST_COL, w.line('High-growth rate', '%', [inp(pct(a.ddm.highGrowth.value), 'pct2')], { note: `${a.ddm.highGrowth.tag}. ${a.ddm.highGrowth.note}` })));
  setRef(ctx, 'ddmN', w.ref(FIRST_COL, w.line('High-growth years', 'years', [inp(a.ddm.highGrowthYears, 'int')], { note: 'Analyst assumption; one column per year on the DDM sheet' })));
  setRef(ctx, 'gS', w.ref(FIRST_COL, w.line('Stable growth', '%', [inp(pct(a.ddm.stableGrowth.value), 'pct2')], { note: `${a.ddm.stableGrowth.tag}. ${a.ddm.stableGrowth.note}` })));
  setRef(ctx, 'hFactor', w.ref(FIRST_COL, w.line('H-model half-life factor (H = years × factor)', 'x', [inp(0.5, 'ratio')], { note: 'Definition of the H-model half-life' })));

  // ----------------------------------------------------------- USD check
  w.section('USD consistency check: inflation paths');
  w.header(yearsLbl);
  const pe = w.line('EGP inflation', '%', a.usd.egpInflation.slice(0, n).map((x) => inp(pct(x), 'pct2')), { note: 'Default: urban headline CPI in year 1, CBE target point from year 3, linear in between' });
  const pu = w.line('USD inflation', '%', a.usd.usdInflation.slice(0, n).map((x) => inp(pct(x), 'pct2')), { note: 'Analyst assumption: 2.5% flat' });
  for (let k = 0; k < n; k++) {
    setRef(ctx, `infE.${k + 1}`, w.ref(FIRST_COL + k, pe));
    setRef(ctx, `infU.${k + 1}`, w.ref(FIRST_COL + k, pu));
  }

  // ----------------------------------------------------------- sensitivity
  w.section('Sensitivity steps and grid offsets');
  w.header(['Value']);
  const st = a.sensitivity;
  setRef(ctx, 'st.wacc', w.ref(FIRST_COL, w.line('WACC step', 'pp', [inp(st.wacc / 100, 'pct2')])));
  setRef(ctx, 'st.g', w.ref(FIRST_COL, w.line('Terminal growth step', 'pp', [inp(st.growth / 100, 'pct2')])));
  setRef(ctx, 'st.exit', w.ref(FIRST_COL, w.line('Exit multiple step', 'x', [inp(st.exitMultiple, 'multiple')])));
  setRef(ctx, 'st.dg', w.ref(FIRST_COL, w.line('Revenue growth step', 'pp', [inp(st.revenueGrowth / 100, 'pct2')])));
  setRef(ctx, 'st.dm', w.ref(FIRST_COL, w.line('Gross margin step', 'pp', [inp(st.margin / 100, 'pct2')])));
  setRef(ctx, 'st.rf', w.ref(FIRST_COL, w.line('Risk-free step', 'pp', [inp(st.rf / 100, 'pct2')])));
  setRef(ctx, 'st.beta', w.ref(FIRST_COL, w.line('Levered beta step', 'x', [inp(st.beta, 'ratio')])));
  const off = w.line('Grid offsets (steps from base)', 'steps', [-2, -1, 0, 1, 2].map((k) => inp(k, 'int')), { note: 'Five columns and rows with the base case at the centre' });
  for (let k = 0; k < 5; k++) setRef(ctx, `off.${k}`, w.ref(FIRST_COL + k, off));

  // ----------------------------------------------------------- blend
  w.section('Blend weights (must sum to 100%)');
  w.header(['Weight']);
  for (const [id, label] of [['dcf', 'DCF (FCFF)'], ['ddm', 'Dividend discount model'], ['comps', 'Trading comparables'], ['precedents', 'Precedent transactions'], ['sotp', 'Sum of the parts']] as const) {
    setRef(ctx, `bw.${id}`, w.ref(FIRST_COL, w.line(label, '%', [inp(a.blend[id] / 100, 'pct')], { note: 'Analyst assumption' })));
  }

  // ----------------------------------------------------------- bands
  w.section('Presentation bands');
  w.header(['Value']);
  setRef(ctx, 'verdictBand', w.ref(FIRST_COL, w.line('Verdict band ("In line with market price" within ±)', '%', [inp(0.1, 'pct')], { note: 'Spec 5.13' })));
  setRef(ctx, 'tol.amount', w.ref(FIRST_COL, w.line('Check tolerance: amounts', 'EGP', [inp(1, 'ratio')], { note: 'Checks sheet' })));
  setRef(ctx, 'tol.share', w.ref(FIRST_COL, w.line('Check tolerance: per-share values', 'EGP', [inp(0.01, 'ratio')], { note: 'Checks sheet' })));
  setRef(ctx, 'tol.rate', w.ref(FIRST_COL, w.line('Check tolerance: rates and weights', 'x', [inp(0.0000001, 'ratio4')], { note: 'Checks sheet' })));
  setRef(ctx, 'q1p', w.ref(FIRST_COL, w.line('First quartile point', '%', [inp(0.25, 'pct')], { note: 'Quartiles by linear interpolation (PERCENTILE.INC)' })));
  setRef(ctx, 'q3p', w.ref(FIRST_COL, w.line('Third quartile point', '%', [inp(0.75, 'pct')], { note: 'Quartiles by linear interpolation (PERCENTILE.INC)' })));
  setRef(ctx, 'usdBand', w.ref(FIRST_COL, w.line('USD check consistency band (±)', '%', [inp(0.1, 'pct')], { note: 'Gap within this band is described as consistent' })));

  // ----------------------------------------------------------- scores constants
  w.section("Score constants (Altman Z''-EM, Altman 2005)");
  w.header(['Value']);
  const zr = [
    ['Constant', ZEM.constant], ['X1 coefficient (working capital / total assets)', ZEM.c1], ['X2 coefficient (retained earnings / total assets)', ZEM.c2],
    ['X3 coefficient (EBIT / total assets)', ZEM.c3], ['X4 coefficient (book equity / total liabilities)', ZEM.c4], ['Safe zone above', ZEM.safe], ['Distress zone below', ZEM.distress],
  ] as const;
  const zk = ['const', 'c1', 'c2', 'c3', 'c4', 'safe', 'distress'];
  zr.forEach(([label, val], i) => setRef(ctx, `z.${zk[i]}`, w.ref(FIRST_COL, w.line(label, 'x', [inp(val, 'ratio')], { note: 'Sourced fact: Altman (2005), zones as tabulated by Altman et al.' }))));

  // ----------------------------------------------------------- secondary inputs
  const sec = v.secondary;
  w.section('Trading comparables (raw peer inputs)');
  if (sec.peers.length === 0) w.textLine('No peers entered. The comparables method is excluded from the blend.');
  else {
    w.header(['Price', 'Shares', 'Debt', 'Cash', 'Minority', 'Revenue LTM', 'EBITDA LTM', 'EBITDA NTM', 'Net income LTM', 'Net income NTM', 'Book equity'], '', 'Source and date');
    sec.peers.forEach((p, i) => {
      const r = w.line(`${p.name} (${p.ticker})`, p.currency, [
        inp(p.price, 'perShare'), inp(p.shares, 'amount'), inp(p.debt, 'amount'), inp(p.cash, 'amount'), inp(p.minorityInterest, 'amount'), inp(p.revenueLtm, 'amount'),
        inp(p.ebitdaLtm, 'amount'), inp(p.ebitdaNtm, 'amount'), inp(p.netIncomeLtm, 'amount'), inp(p.netIncomeNtm, 'amount'), inp(p.bookEquity, 'amount'),
      ], { note: `${p.source}, ${p.sourceDate}; price date ${p.priceDate}` });
      setRef(ctx, `peer.${i}`, String(r));
    });
  }
  w.section('Precedent transactions');
  if (sec.transactions.length === 0) w.textLine('No transactions entered. The precedents method is excluded from the blend.');
  else {
    w.header(['EV', 'Revenue', 'EBITDA'], '', 'Target, acquirer, date, source');
    sec.transactions.forEach((d, i) => {
      const r = w.line(d.target, d.currency, [inp(d.enterpriseValue, 'amount'), inp(d.revenue, 'amount'), inp(d.ebitda, 'amount')], { note: `${d.target} / ${d.acquirer}, ${d.date}, ${d.source}` });
      setRef(ctx, `deal.${i}`, String(r));
    });
  }
  w.section('Sum-of-the-parts segments');
  if (sec.segments.length === 0) w.textLine('No segments entered. The SOTP method is excluded from the blend.');
  else {
    w.header(['EBITDA', 'Multiple', 'Value (value method)', 'Method (1 = multiple)'], '', 'Source');
    sec.segments.forEach((s, i) => {
      const r = w.line(s.name, 'EGP', [inp(s.ebitda, 'amount'), inp(s.multiple, 'multiple'), inp(s.value, 'amount'), inp(s.method === 'multiple' ? 1 : 0, 'int')], { note: s.source });
      setRef(ctx, `seg.${i}`, String(r));
    });
  }
  w.section('Broker targets (reference only, not in the blend)');
  if (sec.brokers.length === 0) w.textLine('No broker targets entered.');
  else {
    w.header(['Target'], '', 'Broker, date, rating, source');
    const first = w.row;
    sec.brokers.forEach((b) => w.line(b.broker, 'EGP', [inp(b.target, 'perShare')], { note: `${b.broker}, ${b.date}, ${b.rating}, ${b.sourceUrl}` }));
    setRef(ctx, 'brokers', w.rangeCol(FIRST_COL, first, w.row - 1));
  }
  w.section('FX sensitivity shares');
  w.header(['Value']);
  w.line('USD-linked share of revenue', '%', [inp(pct(a.fx.usdRevenueShare), 'pct')], { note: a.fx.usdRevenueShare === null ? 'Not entered' : 'Sourced fact: export share of FY sales (pre-filled)' });
  w.line('USD-linked share of costs', '%', [inp(pct(a.fx.usdCostShare), 'pct')], { note: a.fx.usdCostShare === null ? 'Not entered (no default)' : 'Analyst input' });

  // ----------------------------------------------------------- engine outputs (parity)
  w.section('Engine outputs (stored for the parity check on the Checks sheet)');
  w.header(['Value']);
  const eo = (key: string, label: string, val: number, fmt: Fmt) => setRef(ctx, `eng.${key}`, w.ref(FIRST_COL, w.line(label, '', [inp(Number.isFinite(val) ? val : null, fmt)], { note: 'Output of the WOLF engine for the same inputs' })));
  const core = v.core;
  eo('perShare', 'DCF value per share', core.dcf.perShare, 'perShare');
  eo('ev', 'Enterprise value', core.dcf.enterpriseValue, 'amount');
  eo('equity', 'Equity value', core.dcf.equityValue, 'amount');
  eo('wacc', 'WACC', core.wacc.wacc / 100, 'pct2');
  eo('ke', 'Cost of equity', core.wacc.ke / 100, 'pct2');
  eo('ddm', 'DDM two-stage value per share', v.ddm.twoStage, 'perShare');
  eo('blended', 'Blended value per share', v.blend.blendedValue, 'perShare');
  eo('weighted', 'Probability-weighted scenario value per share', v.scenarios.weightedPerShare, 'perShare');
  const mc = v.monteCarlo;
  if (mc) {
    eo('mc.p5', `Monte Carlo P5 (seed ${mc.seed}, ${mc.runs} runs)`, mc.p5, 'perShare');
    eo('mc.median', 'Monte Carlo median', mc.median, 'perShare');
    eo('mc.p95', 'Monte Carlo P95', mc.p95, 'perShare');
  }
}
