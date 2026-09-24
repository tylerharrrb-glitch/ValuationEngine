/** USD Check, DDM and relative-valuation sheets (METHODOLOGY sections 6, 7, 13). */
import { latestYear, priorYear } from '../../../domain/company';
import { type BuildCtx, ref, setRef } from '../context';
import { SheetWriter, fx, FIRST_COL, colLetter } from '../writer';

export function buildUsdCheck(ctx: BuildCtx, w: SheetWriter) {
  const { c } = ctx;
  const n = ctx.n;
  const y = latestYear(c);
  const L = (k: number) => colLetter(FIRST_COL + k);
  const cols = Array.from({ length: n }, (_, k) => k);
  const D = (r: number) => `$D$${r}`;
  const R = (id: string) => ref(ctx, `rate.${id}`);
  w.title(`${c.shortName}: USD consistency check`, 'EGP cash flows converted at inflation-parity forward rates and discounted at a USD cost of capital. A consistency check of the EGP discount rate, not a second answer.');

  w.section('Forward exchange rates');
  w.header(Array.from({ length: n }, (_, k) => `${y.fiscalYear + k + 1}E`), 'Unit');
  const pe = w.line('EGP inflation', '%', cols.map((k) => fx(ref(ctx, `infE.${k + 1}`), 'pct2')));
  const pu = w.line('USD inflation', '%', cols.map((k) => fx(ref(ctx, `infU.${k + 1}`), 'pct2')));
  const diff = w.line('Inflation differential', '%', cols.map((k) => fx(`(1+$${L(k)}$${pe})/(1+$${L(k)}$${pu})-1`, 'pct2')));
  const fwd = w.line('Forward USD/EGP', 'EGP/USD', cols.map((k) => fx(`${k === 0 ? R('eg.usdEgp') : `$${L(k - 1)}$${w.row}`}*(1+$${L(k)}$${pe})/(1+$${L(k)}$${pu})`, 'fx')), { note: 'S0 × Π (1 + π EGP) / (1 + π USD)' });
  const fcffU = w.line('FCFF included, USD', 'USD', cols.map((k) => fx(`${ref(ctx, `dcf.frac.${k + 1}`)}*${ref(ctx, `m.fcff.${k + 1}`)}/$${L(k)}$${fwd}`, 'amount')));

  w.section('USD cost of capital (method A in USD)');
  w.header(['Value']);
  const us = w.line('US 10Y Treasury', '%', [fx(R('us.treasury10y'), 'pct2')]);
  const keU = w.line('Cost of equity, USD', '%', [fx(`${D(us)}+${ref(ctx, 'w.betaL')}*${ref(ctx, 'w.erp')}+${ref(ctx, 'w.crp')}+${ref(ctx, 'w.sp')}`, 'pct2')], { note: 'US 10Y + βL × ERP + CRP + size premium' });
  const kdU = w.line('Cost of debt, USD (pre-tax)', '%', [fx(`${D(us)}+${ref(ctx, 'w.spreadEff')}+${ref(ctx, 'w.cds')}`, 'pct2')], { note: 'US 10Y + company spread + country default spread' });
  const wU = w.line('WACC, USD', '%', [fx(`${ref(ctx, 'w.ev')}*${D(keU)}+${ref(ctx, 'w.dv')}*${D(kdU)}*(1-${ref(ctx, 'w.tax')})`, 'pct2')], { bold: true });

  w.section('USD valuation');
  w.header(Array.from({ length: n }, (_, k) => `${y.fiscalYear + k + 1}E`), 'Unit');
  const df = w.line('Discount factor, USD', 'x', cols.map((k) => fx(`(1+${D(wU)})^(-${ref(ctx, `dcf.years.${k + 1}`)})`, 'ratio4')));
  const pv = w.line('Present value, USD', 'USD', cols.map((k) => fx(`$${L(k)}$${fcffU}*$${L(k)}$${df}`, 'amount')));
  w.section('USD bridge and comparison');
  w.header(['Value']);
  const lastE = `$${L(n - 1)}$${pe}`;
  const lastU = `$${L(n - 1)}$${pu}`;
  const fT = w.line('Forward USD/EGP, terminal year', 'EGP/USD', [fx(`$${L(n - 1)}$${fwd}*(1+${lastE})/(1+${lastU})`, 'fx')]);
  const gU = w.line('Terminal growth, USD', '%', [fx(`(1+${ref(ctx, 'g')})*(1+${lastU})/(1+${lastE})-1`, 'pct2')], { note: 'Same real growth as the EGP terminal growth' });
  const sum = w.line('Sum of present values, USD', 'USD', [fx(`SUM(${w.rangeRow(pv, FIRST_COL, FIRST_COL + n - 1, false)})`, 'amount')]);
  const tv = w.line('Terminal value, USD', 'USD', [fx(`IF(${ref(ctx, 'tvMethod')}="gordon",${ref(ctx, `m.fcff.${n + 1}`)}/${D(fT)}/(${D(wU)}-${D(gU)}),${ref(ctx, `m.ebitda.${n}`)}/$${L(n - 1)}$${fwd}*${ref(ctx, 'exit')})`, 'amount')]);
  const pvtv = w.line('PV of terminal value, USD', 'USD', [fx(`${D(tv)}*(1+${D(wU)})^(-${ref(ctx, 'dcf.tvYears')})`, 'amount')]);
  const evU = w.line('Enterprise value, USD', 'USD', [fx(`${D(sum)}+${D(pvtv)}`, 'amount')], { total: true });
  const brU = w.line('Bridge, USD (EGP bridge / spot)', 'USD', [fx(`${ref(ctx, 'dcf.bridgeTotal')}/${R('eg.usdEgp')}`, 'amount')]);
  const eqU = w.line('Equity value, USD', 'USD', [fx(`${D(evU)}+${D(brU)}`, 'amount')], { bold: true });
  const eqE = w.line('USD equity value converted at spot', 'EGP', [fx(`${D(eqU)}*${R('eg.usdEgp')}`, 'amount')]);
  const eqEgp = w.line('Equity value, EGP DCF', 'EGP', [fx(ref(ctx, 'dcf.equity'), 'amount')]);
  const gap = w.line('Gap (USD-derived / EGP - 1)', '%', [fx(`${D(eqE)}/${D(eqEgp)}-1`, 'pct')], { bold: true });
  const rfd = w.line('Risk-free differential (EGP Rf - US 10Y)', 'pp', [fx(`${ref(ctx, 'w.rf')}-${D(us)}`, 'pct2')]);
  const aid = w.line('Average inflation differential', 'pp', [fx(`AVERAGE(${w.rangeRow(diff, FIRST_COL, FIRST_COL + n - 1, false)})`, 'pct2')]);
  setRef(ctx, 'usd.gap', w.ref(FIRST_COL, gap));
  setRef(ctx, 'usd.wacc', w.ref(FIRST_COL, wU));
  const band = ref(ctx, 'usdBand');
  w.blank();
  w.textLine(fx(`IF(ABS(${D(gap)})<=${band},"The USD valuation converted at spot is within "&TEXT(ABS(${D(gap)}),"0.0%")&" of the EGP valuation. The EGP discount rate and the inflation path used for forward FX rates are broadly consistent.",` +
    `"The USD valuation converted at spot is "&TEXT(ABS(${D(gap)}),"0.0%")&IF(${D(gap)}>0," above"," below")&" the EGP valuation. The EGP risk-free rate exceeds the US 10Y by "&SUBSTITUTE(TEXT(${D(rfd)},"0.00%"),"%","pp")&", while the forward FX rates assume an average inflation differential of "&SUBSTITUTE(TEXT(${D(aid)},"0.00%"),"%","pp")&"; the EGP discount rate implies "&IF(${D(gap)}>0,"more","less")&" depreciation than the inflation path.")`));
}

export function buildDdm(ctx: BuildCtx, w: SheetWriter) {
  const { c, a } = ctx;
  const y = latestYear(c);
  const p = priorYear(c);
  const n = a.ddm.highGrowthYears;
  const D = (r: number) => `$D$${r}`;
  const L = (k: number) => colLetter(FIRST_COL + k);
  w.title(`${c.shortName}: Dividend discount model`, 'Shareholder dividends only (employee and board distributions excluded). Two-stage model (headline) and H-model, discounted at the cost of equity.');
  w.section('Inputs');
  w.header(['Value']);
  const dps = w.line('DPS (base year)', 'EGP', [fx(`IF(ISNUMBER(${ref(ctx, 'dpsOverride')}),${ref(ctx, 'dpsOverride')},-${ref(ctx, 'cf.dividendsToShareholders')}/${ref(ctx, 'sharesBasic')})`, 'perShare')], { note: `FY${y.fiscalYear} dividends paid to shareholders / basic shares` });
  const ke = w.line('Cost of equity', '%', [fx(ref(ctx, 'w.ke'), 'pct2')]);
  const gH = w.line('High-growth rate', '%', [fx(ref(ctx, 'gH'), 'pct2')]);
  const gS = w.line('Stable growth', '%', [fx(ref(ctx, 'gS'), 'pct2')]);
  const yrs = w.line('High-growth years', 'years', [fx(ref(ctx, 'ddmN'), 'int')], { note: 'Columns below are laid out for this number of years' });
  w.section('Dividends');
  w.header(Array.from({ length: n }, (_, k) => `Year ${k + 1}`));
  const div = w.line('Dividend per share', 'EGP', Array.from({ length: n }, (_, k) => fx(`${k === 0 ? D(dps) : `$${L(k - 1)}$${w.row}`}*(1+${D(gH)})`, 'perShare')));
  const dfr = w.line('Discount factor', 'x', Array.from({ length: n }, (_, k) => fx(`${k === 0 ? '1' : `$${L(k - 1)}$${w.row}`}/(1+${D(ke)})`, 'ratio4')));
  const pv = w.line('Present value', 'EGP', Array.from({ length: n }, (_, k) => fx(`$${L(k)}$${div}*$${L(k)}$${dfr}`, 'perShare')));
  w.section('Value per share');
  w.header(['Value']);
  const sum = w.line('PV of high-growth dividends', 'EGP', [fx(`SUM(${w.rangeRow(pv, FIRST_COL, FIRST_COL + n - 1, false)})`, 'perShare')]);
  const tv = w.line('Terminal value at end of high growth', 'EGP', [fx(`IF(${D(ke)}>${D(gS)},$${L(n - 1)}$${div}*(1+${D(gS)})/(${D(ke)}-${D(gS)}),"n/a: Ke ≤ g")`, 'perShare')]);
  const pvtv = w.line('PV of terminal value', 'EGP', [fx(`IFERROR(${D(tv)}*$${L(n - 1)}$${dfr},"n/a")`, 'perShare')]);
  const two = w.line('Two-stage value per share', 'EGP', [fx(`IFERROR(${D(sum)}+${D(pvtv)},"n/a")`, 'perShare')], { bold: true, total: true, name: 'DDM_Per_Share' });
  const H = w.line('H (half-life of high growth)', 'years', [fx(`${D(yrs)}*${ref(ctx, 'hFactor')}`, 'ratio')]);
  const hm = w.line('H-model value per share', 'EGP', [fx(`IF(${D(ke)}>${D(gS)},${D(dps)}*(1+${D(gS)})/(${D(ke)}-${D(gS)})+${D(dps)}*${D(H)}*(${D(gH)}-${D(gS)})/(${D(ke)}-${D(gS)}),"n/a")`, 'perShare')]);
  setRef(ctx, 'ddm.two', w.ref(FIRST_COL, two));
  setRef(ctx, 'ddm.h', w.ref(FIRST_COL, hm));
  w.section('Sustainability');
  w.header(['Value']);
  const eqAvg = p ? `AVERAGE(${ref(ctx, 'bs.totalEquity.prior')},${ref(ctx, 'bs.totalEquity')})` : ref(ctx, 'bs.totalEquity');
  const roe = w.line('ROE (net profit / average equity)', '%', [fx(`${ref(ctx, 'is.netProfit')}/${eqAvg}`, 'pct')]);
  const payout = w.line('Payout (shareholder dividends / net profit)', '%', [fx(`-${ref(ctx, 'cf.dividendsToShareholders')}/${ref(ctx, 'is.netProfit')}`, 'pct')]);
  const sg = w.line('Sustainable growth (ROE × retention)', '%', [fx(`${D(roe)}*(1-${D(payout)})`, 'pct2')]);
  w.line('Stable growth within sustainable growth', 'check', [fx(`${D(gS)}<=${D(sg)}`)], { note: 'FALSE = warning: stable growth exceeds ROE × retention' });
  w.line('Payout at or below 100%', 'check', [fx(`${D(payout)}<=1`)]);
}

export function buildRelative(ctx: BuildCtx, w: SheetWriter) {
  const { c, v } = ctx;
  const sec = v.secondary;
  const D = (r: number) => `$D$${r}`;
  w.title(`${c.shortName}: Comparables, precedents and SOTP`, 'Multiples computed from the raw peer and transaction inputs on Inputs; implied values use the equity bridge of the DCF sheet. Methods without inputs are excluded from the blend.');
  const inputs = "Inputs";
  const peerCell = (i: number, col: number) => `${inputs}!$${colLetter(FIRST_COL + col)}$${ctx.refs.get(`peer.${i}`)}`;
  w.section('Trading comparables');
  if (sec.peers.length === 0) {
    w.textLine('No peers entered on Inputs. No multiple is computed and the method is excluded from the blend.');
    setRef(ctx, 'comps.value', '');
  } else {
    w.header(['Market cap', 'EV', 'EV/EBITDA LTM', 'EV/EBITDA NTM', 'P/E LTM', 'P/E NTM', 'P/B', 'EV/Revenue']);
    const first = w.row;
    sec.peers.forEach((p, i) => {
      const r = w.row;
      const mc = `${peerCell(i, 0)}*${peerCell(i, 1)}`;
      const ratio = (num: string, den: string) => `IF(AND(ISNUMBER(${den}),${den}>0),${num}/${den},"n/a")`;
      w.line(`${p.name} (${p.ticker})`, p.currency, [
        fx(mc, 'amount'), fx(`$D$${r}+${peerCell(i, 2)}-${peerCell(i, 3)}+${peerCell(i, 4)}`, 'amount'),
        fx(ratio(`$E$${r}`, peerCell(i, 6)), 'multiple'), fx(ratio(`$E$${r}`, peerCell(i, 7)), 'multiple'),
        fx(ratio(`$D$${r}`, peerCell(i, 8)), 'multiple'), fx(ratio(`$D$${r}`, peerCell(i, 9)), 'multiple'),
        fx(ratio(`$D$${r}`, peerCell(i, 10)), 'multiple'), fx(ratio(`$E$${r}`, peerCell(i, 5)), 'multiple'),
      ], { note: `${p.source}, ${p.sourceDate}` });
    });
    const last = w.row - 1;
    const colRange = (k: number) => w.rangeCol(FIRST_COL + k, first, last, false);
    for (const [label, fn] of [['Median', 'MEDIAN'], ['Mean', 'AVERAGE'], ['First quartile', 'PERCENTILE.INC'], ['Third quartile', 'PERCENTILE.INC']] as const) {
      const q = label === 'First quartile' ? `,${ref(ctx, 'q1p')}` : label === 'Third quartile' ? `,${ref(ctx, 'q3p')}` : '';
      const r = w.line(label, 'x', [null, null, ...[2, 3, 4, 5, 6, 7].map((k) => fx(`IFERROR(${fn}(${colRange(k)}${q}),"n/a")`, 'multiple'))]);
      if (label === 'Median') setRef(ctx, 'comps.medianRow', String(r));
      if (label === 'First quartile') setRef(ctx, 'comps.q1Row', String(r));
      if (label === 'Third quartile') setRef(ctx, 'comps.q3Row', String(r));
    }
    const med = (k: number) => `$${colLetter(FIRST_COL + k)}$${ctx.refs.get('comps.medianRow')}`;
    const q = (row: string) => `$F$${ctx.refs.get(row)}`;
    const val = w.line('Implied value per share: median EV/EBITDA on normalized EBITDA', 'EGP', [fx(`(${med(2)}*${ref(ctx, 'normEbitda')}+${ref(ctx, 'dcf.bridgeTotal')})/${ref(ctx, 'shares')}`, 'perShare')], { bold: true, note: 'Value used in the blend' });
    setRef(ctx, 'comps.value', w.ref(FIRST_COL, val));
    setRef(ctx, 'comps.low', w.ref(FIRST_COL, w.line('Implied value at first quartile', 'EGP', [fx(`(${q('comps.q1Row')}*${ref(ctx, 'normEbitda')}+${ref(ctx, 'dcf.bridgeTotal')})/${ref(ctx, 'shares')}`, 'perShare')])));
    setRef(ctx, 'comps.high', w.ref(FIRST_COL, w.line('Implied value at third quartile', 'EGP', [fx(`(${q('comps.q3Row')}*${ref(ctx, 'normEbitda')}+${ref(ctx, 'dcf.bridgeTotal')})/${ref(ctx, 'shares')}`, 'perShare')])));
  }

  w.section('Precedent transactions');
  if (sec.transactions.length === 0) {
    w.textLine('No transactions entered on Inputs. The method is excluded from the blend.');
    setRef(ctx, 'prec.value', '');
  } else {
    w.header(['EV/EBITDA', 'EV/Revenue']);
    const first = w.row;
    sec.transactions.forEach((d, i) => {
      const r = ctx.refs.get(`deal.${i}`);
      const cellI = (col: number) => `${inputs}!$${colLetter(FIRST_COL + col)}$${r}`;
      w.line(`${d.target} / ${d.acquirer} (${d.date})`, '', [fx(`IF(${cellI(2)}>0,${cellI(0)}/${cellI(2)},"n/a")`, 'multiple'), fx(`IF(${cellI(1)}>0,${cellI(0)}/${cellI(1)},"n/a")`, 'multiple')], { note: d.source });
    });
    const last = w.row - 1;
    const med = w.line('Median', 'x', [fx(`MEDIAN(${w.rangeCol(FIRST_COL, first, last, false)})`, 'multiple'), fx(`MEDIAN(${w.rangeCol(FIRST_COL + 1, first, last, false)})`, 'multiple')]);
    const q1 = w.line('First quartile', 'x', [fx(`PERCENTILE.INC(${w.rangeCol(FIRST_COL, first, last, false)},${ref(ctx, 'q1p')})`, 'multiple')]);
    const q3 = w.line('Third quartile', 'x', [fx(`PERCENTILE.INC(${w.rangeCol(FIRST_COL, first, last, false)},${ref(ctx, 'q3p')})`, 'multiple')]);
    const imp = (r: number) => `(${D(r)}*${ref(ctx, 'normEbitda')}+${ref(ctx, 'dcf.bridgeTotal')})/${ref(ctx, 'shares')}`;
    setRef(ctx, 'prec.value', w.ref(FIRST_COL, w.line('Implied value per share: median EV/EBITDA', 'EGP', [fx(imp(med), 'perShare')], { bold: true })));
    setRef(ctx, 'prec.low', w.ref(FIRST_COL, w.line('Implied value at first quartile', 'EGP', [fx(imp(q1), 'perShare')])));
    setRef(ctx, 'prec.high', w.ref(FIRST_COL, w.line('Implied value at third quartile', 'EGP', [fx(imp(q3), 'perShare')])));
  }

  w.section('Sum of the parts');
  if (sec.segments.length === 0) {
    w.textLine('No segments entered on Inputs. The method is excluded from the blend.');
    setRef(ctx, 'sotp.value', '');
  } else {
    w.header(['Enterprise value']);
    const first = w.row;
    sec.segments.forEach((s, i) => {
      const r = ctx.refs.get(`seg.${i}`);
      const cellI = (col: number) => `${inputs}!$${colLetter(FIRST_COL + col)}$${r}`;
      w.line(s.name, 'EGP', [fx(`IF(${cellI(3)}=1,${cellI(0)}*${cellI(1)},${cellI(2)})`, 'amount')], { note: s.source });
    });
    const tot = w.line('Total segment EV', 'EGP', [fx(`SUM(${w.rangeCol(FIRST_COL, first, w.row - 1, false)})`, 'amount')], { total: true });
    setRef(ctx, 'sotp.value', w.ref(FIRST_COL, w.line('SOTP value per share (corporate bridge applied once)', 'EGP', [fx(`(${D(tot)}+${ref(ctx, 'dcf.bridgeTotal')})/${ref(ctx, 'shares')}`, 'perShare')], { bold: true })));
  }

  w.section('Broker targets (reference only)');
  if (!ctx.refs.get('brokers')) w.textLine('No broker targets entered.');
  else {
    w.header(['Value']);
    setRef(ctx, 'brk.low', w.ref(FIRST_COL, w.line('Lowest target', 'EGP', [fx(`MIN(${ref(ctx, 'brokers')})`, 'perShare')])));
    setRef(ctx, 'brk.mid', w.ref(FIRST_COL, w.line('Median target', 'EGP', [fx(`MEDIAN(${ref(ctx, 'brokers')})`, 'perShare')])));
    setRef(ctx, 'brk.high', w.ref(FIRST_COL, w.line('Highest target', 'EGP', [fx(`MAX(${ref(ctx, 'brokers')})`, 'perShare')])));
  }
}
