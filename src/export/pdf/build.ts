/**
 * Broker-note style PDF (spec Part 8). One serif for headings (Times), one sans for body and
 * tables (Helvetica, tabular digits), right-aligned numbers, thin rules, black text and one accent.
 * Every sentence is a label, a templated statement from engine numbers, or user-entered text.
 */
import { jsPDF } from 'jspdf';
import type { CompanyData } from '../../domain/company';
import type { Assumptions } from '../../domain/assumptions';
import type { RatesSnapshot } from '../../domain/rates';
import type { ValuationResult } from '../../engine/valuation';
import { footballField } from '../../engine/football';
import { RF_LABELS } from '../../engine/wacc';
import { fmtAmount, fmtPerShare, fmtPct, fmtPctFrac, fmtMultiple, fmtDate, fmtNumber } from '../format';

export interface PdfInput {
  company: CompanyData;
  assumptions: Assumptions;
  snapshot: RatesSnapshot;
  result: ValuationResult;
  preparedBy?: string;
}

const ACCENT: [number, number, number] = [122, 92, 30];
const BLACK: [number, number, number] = [17, 17, 17];
const PAGE_W = 210;
const PAGE_H = 297;
const M = 16;
const CW = PAGE_W - 2 * M;

/** Standard PDF fonts are WinAnsi-encoded: map characters outside it. */
export function sanitize(s: string): string {
  return s
    .replace(/−/g, '-')
    .replace(/[–—]/g, '-')
    .replace(/×/g, 'x')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/β/g, 'beta')
    .replace(/λ/g, 'lambda')
    .replace(/π/g, 'pi')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7e -ÿ]/g, '');
}

type Align = 'left' | 'right';
interface Col {
  header: string;
  width: number;
  align?: Align;
}

class Doc {
  doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  y = M;
  constructor(readonly headerText: string) {
    this.doc.setTextColor(...BLACK);
    this.doc.setLineWidth(0.2);
  }

  ensure(h: number) {
    if (this.y + h > PAGE_H - M - 8) this.newPage();
  }

  newPage() {
    this.doc.addPage();
    this.y = M + 6;
  }

  h1(text: string) {
    this.ensure(14);
    this.doc.setFont('times', 'bold');
    this.doc.setFontSize(18);
    this.doc.text(sanitize(text), M, this.y + 6);
    this.y += 9;
  }

  h2(text: string) {
    this.ensure(12);
    this.y += 3;
    this.doc.setFont('times', 'bold');
    this.doc.setFontSize(13);
    this.doc.text(sanitize(text), M, this.y + 4);
    this.y += 5.5;
    this.doc.setDrawColor(...ACCENT);
    this.doc.line(M, this.y, M + CW, this.y);
    this.doc.setDrawColor(...BLACK);
    this.y += 3;
  }

  text(text: string, size = 9, bold = false) {
    this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    const lines = this.doc.splitTextToSize(sanitize(text), CW) as string[];
    const lh = size * 0.42;
    for (const l of lines) {
      this.ensure(lh + 1);
      this.doc.text(l, M, this.y + lh);
      this.y += lh + 0.6;
    }
    this.y += 1;
  }

  kv(pairs: [string, string][], labelW = 70) {
    this.doc.setFontSize(9);
    for (const [k, v] of pairs) {
      this.ensure(5);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(sanitize(k), M, this.y + 3.8);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(sanitize(v), M + labelW, this.y + 3.8);
      this.y += 5;
    }
    this.y += 1;
  }

  table(cols: Col[], rows: (string | { text: string; bold?: boolean })[][], opts: { size?: number; totalRows?: number[] } = {}) {
    const size = opts.size ?? 8.5;
    const rh = size * 0.5 + 1.4;
    const total = cols.reduce((s, c) => s + c.width, 0);
    const scale = CW / total;
    const xs: number[] = [];
    let x = M;
    for (const c of cols) {
      xs.push(x);
      x += c.width * scale;
    }
    const drawHeader = () => {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(size);
      cols.forEach((c, i) => {
        const w = c.width * scale;
        const t = sanitize(c.header);
        if (c.align === 'right') this.doc.text(t, xs[i] + w - 1, this.y + rh - 1.6, { align: 'right' });
        else this.doc.text(t, xs[i] + 0.5, this.y + rh - 1.6);
      });
      this.y += rh;
      this.doc.line(M, this.y, M + CW, this.y);
      this.y += 0.6;
    };
    this.ensure(rh * 2 + 2);
    drawHeader();
    rows.forEach((r, ri) => {
      if (this.y + rh > PAGE_H - M - 8) {
        this.newPage();
        drawHeader();
      }
      if (opts.totalRows?.includes(ri)) this.doc.line(M, this.y, M + CW, this.y);
      r.forEach((cell, i) => {
        const c = cols[i];
        const w = c.width * scale;
        const t = typeof cell === 'string' ? cell : cell.text;
        const bold = typeof cell !== 'string' && !!cell.bold;
        this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
        this.doc.setFontSize(size);
        const s = sanitize(t);
        if (c.align === 'right') this.doc.text(s, xs[i] + w - 1, this.y + rh - 1.6, { align: 'right' });
        else {
          const clipped = this.doc.splitTextToSize(s, w - 1)[0] ?? '';
          this.doc.text(clipped, xs[i] + 0.5, this.y + rh - 1.6);
        }
      });
      this.y += rh;
    });
    this.y += 2;
  }

  finish(footerLeft: string) {
    const n = this.doc.getNumberOfPages();
    for (let p = 1; p <= n; p++) {
      this.doc.setPage(p);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...BLACK);
      if (p > 1) {
        this.doc.text(sanitize(this.headerText), M, M - 4);
        this.doc.line(M, M - 2.5, M + CW, M - 2.5);
      }
      this.doc.line(M, PAGE_H - M + 1, M + CW, PAGE_H - M + 1);
      this.doc.text(sanitize(footerLeft), M, PAGE_H - M + 5);
      this.doc.text(`Page ${p} of ${n}`, M + CW, PAGE_H - M + 5, { align: 'right' });
    }
  }
}

function footballChart(d: Doc, rows: ReturnType<typeof footballField>, price: number) {
  const labelW = 62;
  const x0 = M + labelW;
  const w = CW - labelW - 4;
  const all = rows.flatMap((r) => [r.low, r.high]).concat(price).filter(Number.isFinite);
  const lo = Math.min(...all) * 0.9;
  const hi = Math.max(...all) * 1.05;
  const X = (v: number) => x0 + ((v - lo) / (hi - lo)) * w;
  const bh = 5;
  d.ensure(rows.length * (bh + 3) + 16);
  const top = d.y;
  d.doc.setFontSize(8);
  rows.forEach((r, i) => {
    const y = top + i * (bh + 3);
    d.doc.setFont('helvetica', 'normal');
    d.doc.setTextColor(...BLACK);
    d.doc.text(sanitize(r.label), M, y + bh - 1.2);
    d.doc.setFillColor(...ACCENT);
    d.doc.setDrawColor(...ACCENT);
    if (r.reference) d.doc.rect(X(r.low), y, Math.max(0.4, X(r.high) - X(r.low)), bh, 'S');
    else d.doc.rect(X(r.low), y, Math.max(0.4, X(r.high) - X(r.low)), bh, 'F');
    d.doc.setFontSize(7);
    d.doc.text(fmtPerShare(r.low), X(r.low) - 1, y + bh - 1.2, { align: 'right' });
    d.doc.text(fmtPerShare(r.high), X(r.high) + 1, y + bh - 1.2);
    d.doc.setFontSize(8);
  });
  const bottom = top + rows.length * (bh + 3);
  d.doc.setDrawColor(...BLACK);
  d.doc.setLineWidth(0.3);
  d.doc.line(X(price), top - 2, X(price), bottom);
  d.doc.setLineWidth(0.2);
  d.doc.setFontSize(7.5);
  d.doc.text(`Price ${fmtPerShare(price)}`, X(price), bottom + 3.5, { align: 'center' });
  d.y = bottom + 7;
}

export function buildPdf(input: PdfInput): jsPDF {
  const { company: c, assumptions: a, snapshot: snap, result: v } = input;
  const core = v.core;
  const w = core.wacc;
  const dcf = core.dcf;
  const y0 = c.years[c.years.length - 1];
  const d = new Doc(`${c.name} (${c.ticker}) | Valuation date ${fmtDate(a.valuationDate)}`);
  const doc = d.doc;
  doc.setProperties({ title: `${c.shortName} valuation ${a.valuationDate}`, author: input.preparedBy ?? 'Ahmed Wael Metwally', subject: 'Equity valuation', creator: 'WOLF Valuation Engine' });

  // ------------------------------------------------------------------ page 1: summary
  d.h1(`${c.name} (${c.ticker})`);
  d.text(`Equity valuation as of ${fmtDate(a.valuationDate)}. Share price EGP ${fmtPerShare(c.price)} on ${fmtDate(c.priceDate)}. Rates snapshot ${snap.snapshotId}. Company data: ${c.statementsSource.description} Auditor: ${c.statementsSource.auditor}, report dated ${fmtDate(c.statementsSource.reportDate)}.`, 8.5);
  const ff = footballField(v);
  const nonRef = ff.filter((r) => !r.reference);
  const lowAll = Math.min(...nonRef.map((r) => r.low));
  const highAll = Math.max(...nonRef.map((r) => r.high));
  d.doc.setDrawColor(...ACCENT);
  d.doc.setLineWidth(0.4);
  d.doc.line(M, d.y, M + CW, d.y);
  d.doc.setLineWidth(0.2);
  d.y += 5;
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.text(`EGP ${fmtPerShare(v.blend.blendedValue)}`, M, d.y + 7);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Blended value per share', M, d.y + 12);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(sanitize(v.blend.verdict.text), M + 80, d.y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(sanitize(v.blend.verdict.band), M + 80, d.y + 10);
  doc.text(sanitize(`Value range across methods: EGP ${fmtPerShare(lowAll)} to ${fmtPerShare(highAll)}`), M + 80, d.y + 15);
  d.y += 20;

  d.h2('Value by method');
  d.table(
    [{ header: 'Method', width: 60 }, { header: 'Value per share (EGP)', width: 32, align: 'right' }, { header: 'Entered', width: 22, align: 'right' }, { header: 'Effective', width: 22, align: 'right' }, { header: 'Note', width: 60 }],
    [
      ...v.blend.rows.map((r) => [r.label, r.value === null ? 'n/a' : fmtPerShare(r.value), fmtPct(r.enteredWeight, 0), fmtPct(r.effectiveWeight, 1), r.note]),
      [{ text: 'Blended value per share', bold: true }, { text: fmtPerShare(v.blend.blendedValue), bold: true }, fmtPct(v.blend.enteredSum, 0), '100.0%', ''],
    ],
    { totalRows: [v.blend.rows.length] },
  );
  d.h2('Football field (value per share, EGP)');
  footballChart(d, ff, c.price);
  d.text('Filled bars enter the valuation range; outlined bars are references only. The vertical line is the share price.', 7.5);

  d.h2('Key assumptions');
  const rfUse = v.ratesUsed.find((u) => u.id === w.rfId);
  d.table(
    [{ header: 'Assumption', width: 52 }, { header: 'Value', width: 24, align: 'right' }, { header: 'Source / basis', width: 128 }],
    [
      ['Risk-free rate', fmtPct(w.rf), `${RF_LABELS[a.costOfCapital.rfSource]} (${w.rfId}), as of ${fmtDate(w.rfAsOf)}, status ${w.rfStatus}${rfUse?.overridden ? `, override: ${rfUse.overrideReason}` : ''}`],
      ['Mature-market equity risk premium', fmtPct(w.matureErp), `Damodaran, ${v.ratesUsed.find((u) => u.id === 'damodaran.matureErp')?.asOf ?? ''}`],
      ['Levered beta', fmtNumber(w.leveredBeta, 4), `Unlevered ${fmtNumber(w.unleveredBeta, 4)} (${w.betaIndustry}, dataset ${w.betaDatasetDate}), D/E ${fmtNumber(w.debtToEquity, 6)}`],
      ['Cost of equity', fmtPct(w.ke), `CAPM method ${w.capmMethod}`],
      ['WACC', fmtPct(w.wacc), `E/V ${fmtPctFrac(w.equityWeight)}, D/V ${fmtPctFrac(w.debtWeight)}`],
      ['Terminal growth', fmtPct(core.growth), a.terminal.growth.note],
      ['Terminal method', a.terminal.method === 'gordon' ? 'Gordon' : 'Exit multiple', `Exit multiple ${fmtMultiple(a.terminal.exitMultiple.value, 2)} (${a.terminal.exitMultiple.tag})`],
      ['Projection years / mid-year', `${a.projectionYears} / ${a.midYear ? 'on' : 'off'}`, `Stub fraction year 1: ${fmtNumber(core.timeline.stubFraction, 4)}`],
      ['Employee and board distributions', a.egypt.distributionsOn ? fmtPct(a.egypt.distributionsPct.value) : 'off', 'Percent of prior-year net profit, deducted from FCFF'],
    ],
  );
  const warn = v.messages.filter((m) => m.severity !== 'info');
  if (warn.length) {
    d.h2('Warnings');
    for (const m of warn) d.text(`${m.severity === 'error' ? 'Error' : 'Warning'}: ${m.text}`, 8.5);
  }

  // ------------------------------------------------------------------ cost of capital
  d.newPage();
  d.h2('Cost of capital');
  d.table(
    [{ header: 'Component', width: 90 }, { header: 'Value', width: 30, align: 'right' }, { header: 'Basis', width: 84 }],
    [
      ['Risk-free rate', fmtPct(w.rf), `${w.rfId}, as of ${fmtDate(w.rfAsOf)} (${w.rfStatus})`],
      ['Unlevered beta', fmtNumber(w.unleveredBeta, 4), `${w.betaIndustry}, dataset ${w.betaDatasetDate}`],
      ['D/E (market values)', fmtNumber(w.debtToEquity, 6), `Debt ${fmtAmount(w.debtValue)}; equity ${fmtAmount(w.equityValue)}`],
      ['Relevering tax rate', fmtPct(w.releverTaxRate), 'Statutory corporate income tax'],
      ['Levered beta', fmtNumber(w.leveredBeta, 4), 'Unlevered x (1 + (1 - t) x D/E)'],
      ['Blume-adjusted beta (cross-check)', fmtNumber(w.blumeBeta, 4), 'Not used'],
      ['Mature-market ERP', fmtPct(w.matureErp), 'Damodaran'],
      ['Country risk premium', fmtPct(w.crp), w.capmMethod === 'local_rf' ? 'Not added: country risk is in the local risk-free rate' : 'Added per CAPM method'],
      ['Size / illiquidity premium', fmtPct(w.sizePremium), a.costOfCapital.sizePremium.tag],
      [{ text: 'Cost of equity', bold: true }, { text: fmtPct(w.ke), bold: true }, `Method ${w.capmMethod}`],
      ['Interest coverage', w.interestCoverage === null ? 'n/a' : Number.isFinite(w.interestCoverage) ? fmtNumber(w.interestCoverage, 1) + 'x' : 'no interest', 'Normalized EBIT / debt and lease interest'],
      ['Synthetic rating / spread', w.syntheticRating ? `${w.syntheticRating} / ${fmtPct(w.companySpread ?? NaN)}` : 'n/a', 'Damodaran table'],
      ['Pre-tax cost of debt', fmtPct(w.kdPreTax), `Method ${w.kdMethod}`],
      ['After-tax cost of debt', fmtPct(w.kdAfterTax), `Tax ${fmtPct(w.kdTaxRate)}`],
      ['E/V and D/V', `${fmtPctFrac(w.equityWeight)} / ${fmtPctFrac(w.debtWeight)}`, a.costOfCapital.weightMethod === 'market' ? 'Market values' : 'Target structure'],
      [{ text: 'WACC', bold: true }, { text: fmtPct(w.wacc), bold: true }, ''],
    ],
    { totalRows: [9, 15] },
  );
  for (const m of w.messages) d.text(m.text, 8);

  // ------------------------------------------------------------------ DCF
  d.h2('Discounted cash flow (EGP)');
  const yrs = core.forecast.years;
  const colsY: Col[] = [{ header: '', width: 44 }, ...yrs.map((y) => ({ header: y.label, width: 26, align: 'right' as Align })), { header: 'Terminal', width: 26, align: 'right' }];
  const row = (label: string, f: (y: (typeof yrs)[number]) => string, term?: string) => [label, ...yrs.map(f), term ?? ''];
  const T = core.forecast.terminal;
  d.table(colsY, [
    row('Revenue', (y) => fmtAmount(y.revenue), fmtAmount(T.revenue)),
    row('Revenue growth', (y) => fmtPct(y.revenueGrowth, 1), fmtPct(T.revenueGrowth, 1)),
    row('EBITDA', (y) => fmtAmount(y.ebitda), fmtAmount(T.ebitda)),
    row('D&A', (y) => fmtAmount(y.da), fmtAmount(T.da)),
    row('EBIT', (y) => fmtAmount(y.ebit), fmtAmount(T.ebit)),
    row('NOPAT', (y) => fmtAmount(y.nopat), fmtAmount(T.nopat)),
    row('Capex', (y) => fmtAmount(-y.capex), fmtAmount(-T.capex)),
    row('Change in NWC', (y) => fmtAmount(-y.deltaNwc), fmtAmount(-T.deltaNwc)),
    row('Distributions', (y) => fmtAmount(-y.distributions), fmtAmount(-T.distributions)),
    [{ text: 'FCFF', bold: true }, ...yrs.map((y) => ({ text: fmtAmount(y.fcff), bold: true })), { text: fmtAmount(T.fcff), bold: true }],
    ['Share of year included', ...dcf.rows.map((r) => fmtNumber(r.period.fraction, 4)), ''],
    ['Years from valuation date', ...dcf.rows.map((r) => fmtNumber(r.period.years, 4)), ''],
    ['Discount factor', ...dcf.rows.map((r) => fmtNumber(r.discountFactor, 4)), ''],
    [{ text: 'Present value', bold: true }, ...dcf.rows.map((r) => ({ text: fmtAmount(r.pv), bold: true })), ''],
  ], { size: 7.5, totalRows: [9, 13] });
  const t = dcf.terminal;
  d.table(
    [{ header: 'Terminal value and enterprise value', width: 110 }, { header: 'EGP', width: 50, align: 'right' }],
    [
      ['Sum of present values', fmtAmount(dcf.sumPv)],
      [`Gordon terminal value (g ${fmtPct(core.growth)}, FCFF next year ${fmtAmount(t.gordonFcffNext)})`, fmtAmount(t.gordonTv)],
      [`Exit-multiple terminal value (${fmtMultiple(a.terminal.exitMultiple.value, 2)} x EBITDA)`, fmtAmount(t.exitTv)],
      [`PV of terminal value used (${t.selected === 'gordon' ? 'Gordon' : 'exit multiple'}, discount factor ${fmtNumber(t.discountFactor, 4)})`, fmtAmount(dcf.pvTerminal)],
      [{ text: 'Enterprise value', bold: true }, { text: fmtAmount(dcf.enterpriseValue), bold: true }],
      ['PV of terminal value / EV', fmtPctFrac(dcf.tvShareOfEv, 1)],
      ['Implied exit multiple from Gordon', fmtMultiple(t.impliedExitMultipleFromGordon, 2)],
      ['Implied growth from exit value', fmtPctFrac(t.impliedGrowthFromExit)],
      ['Reinvestment rate: g / RONIC vs forecast terminal year', `${fmtPctFrac(t.impliedReinvestmentRate, 1)} vs ${fmtPctFrac(t.forecastReinvestmentRate, 1)}`],
    ],
    { totalRows: [4] },
  );

  d.h2(`Enterprise value to equity value (balance sheet ${fmtDate(y0.periodEnd)})`);
  d.table(
    [{ header: 'Line', width: 110 }, { header: 'EGP', width: 50, align: 'right' }],
    [
      ['Enterprise value', fmtAmount(dcf.enterpriseValue)],
      ...dcf.bridge.map((l) => [l.memo ? `Memo: ${l.label}` : l.label, fmtAmount(l.amount)]),
      [{ text: 'Equity value', bold: true }, { text: fmtAmount(dcf.equityValue), bold: true }],
      ['Diluted shares', fmtAmount(dcf.dilutedShares)],
      [{ text: 'DCF value per share', bold: true }, { text: fmtPerShare(dcf.perShare), bold: true }],
      ['Upside versus price', fmtPctFrac(dcf.upside, 1)],
      [`Implied EV / normalized EBITDA FY${y0.fiscalYear}A`, fmtMultiple(dcf.impliedEvEbitdaLtm, 2)],
      [`Implied EV / EBITDA FY${y0.fiscalYear + 1}E`, fmtMultiple(dcf.impliedEvEbitdaNtm, 2)],
      [`Implied P/E FY${y0.fiscalYear}A / FY${y0.fiscalYear + 1}E`, `${fmtMultiple(dcf.impliedPeLtm, 2)} / ${fmtMultiple(dcf.impliedPeNtm, 2)}`],
    ],
    { totalRows: [dcf.bridge.length + 1] },
  );
  d.text('The bridge uses the latest audited balance sheet; cash generated and dividends paid between the fiscal year end and the valuation date are not captured.', 7.5);

  // ------------------------------------------------------------------ sensitivity
  d.newPage();
  d.h2('Sensitivity (value per share, EGP; base case at the centre)');
  for (const g of v.sensitivity) {
    const fmtAxis = (x: number, isRow: boolean) => {
      if (g.id === 'wacc_exit' && !isRow) return fmtMultiple(x, 1);
      if (g.id === 'rf_beta' && !isRow) return fmtNumber(x, 2);
      if (g.id === 'growth_margin') return `${x >= 0 ? '+' : ''}${x.toFixed(1)}pp`;
      return fmtPct(x);
    };
    d.text(`${g.title}. Rows: ${g.rowLabel}. Columns: ${g.colLabel}.`, 8.5, true);
    d.table(
      [{ header: '', width: 30, align: 'right' }, ...g.cols.map((c2) => ({ header: fmtAxis(c2, false), width: 26, align: 'right' as Align }))],
      g.rows.map((r, i) => [fmtAxis(r, true), ...g.values[i].map((x, j) => (i === 2 && j === 2 ? { text: fmtPerShare(x), bold: true } : fmtPerShare(x)))]),
      { size: 8 },
    );
  }

  // ------------------------------------------------------------------ scenarios, DDM, USD, reverse, MC
  d.h2('Scenarios (full re-runs)');
  d.table(
    [{ header: '', width: 60 }, ...v.scenarios.rows.map((s) => ({ header: s.name, width: 30, align: 'right' as Align }))],
    [
      ['Probability', ...v.scenarios.rows.map((s) => fmtPct(s.probability, 0))],
      ['Revenue growth delta (every year)', ...v.scenarios.rows.map((s) => `${s.revenueGrowthDelta >= 0 ? '+' : ''}${s.revenueGrowthDelta}pp`)],
      ['Gross margin delta', ...v.scenarios.rows.map((s) => `${s.marginDelta >= 0 ? '+' : ''}${s.marginDelta}pp`)],
      ['WACC used', ...v.scenarios.rows.map((s) => fmtPct(s.wacc))],
      ['Terminal growth used', ...v.scenarios.rows.map((s) => fmtPct(s.growth))],
      [{ text: 'Value per share', bold: true }, ...v.scenarios.rows.map((s) => ({ text: fmtPerShare(s.perShare), bold: true }))],
    ],
  );
  d.text(`Probability-weighted value per share: EGP ${fmtPerShare(v.scenarios.weightedPerShare)}.`, 8.5, true);

  d.h2('Dividend discount model (shareholder dividends only)');
  const dd = v.ddm;
  d.kv([
    ['Base-year DPS', `EGP ${fmtPerShare(dd.dps0)}`],
    ['DPS basis', dd.dpsSource],
    ['Cost of equity', fmtPct(dd.ke)],
    ['High growth / years / stable growth', `${fmtPct(dd.highGrowth)} / ${dd.highGrowthYears} / ${fmtPct(dd.stableGrowth)}`],
    ['Two-stage value per share', `EGP ${fmtPerShare(dd.twoStage)}`],
    ['H-model value per share', `EGP ${fmtPerShare(dd.hModel)}`],
    ['ROE / payout / sustainable growth', `${fmtPctFrac(dd.roe)} / ${fmtPctFrac(dd.payout)} / ${fmtPctFrac(dd.sustainableGrowth)}`],
  ], 62);
  for (const m of dd.messages) d.text(m.text, 8);

  d.h2('USD consistency check');
  const u = v.usd;
  d.kv([
    ['Spot USD/EGP', fmtNumber(u.spot, 4)],
    ['USD WACC / USD terminal growth', `${fmtPct(u.waccUsd)} / ${fmtPct(u.growthUsd)}`],
    ['USD equity value converted at spot', `EGP ${fmtAmount(u.equityEgpEquivalent)}`],
    ['EGP DCF equity value', `EGP ${fmtAmount(u.equityEgp)}`],
    ['Gap', fmtPctFrac(u.gap, 1)],
  ], 62);
  d.text(u.explanation, 8.5);

  d.h2('Reverse DCF and Monte Carlo');
  const rv = v.reverse;
  d.text(rv.impliedTerminalGrowth.attainable
    ? `At the share price of EGP ${fmtPerShare(c.price)}, the DCF implies a terminal growth rate of ${fmtPct(rv.impliedTerminalGrowth.value)} (base ${fmtPct(core.growth)}).`
    : `No terminal growth rate between ${fmtPct(rv.impliedTerminalGrowth.bracket[0])} and ${fmtPct(rv.impliedTerminalGrowth.bracket[1])} reproduces the share price.`, 8.5);
  d.text(rv.impliedRevenueGrowth.attainable
    ? `A uniform revenue growth of ${fmtPct(rv.impliedRevenueGrowth.value)} in every projection year reproduces the share price.`
    : 'No uniform revenue growth in the searched range reproduces the share price.', 8.5);
  if (v.monteCarlo) {
    const mc = v.monteCarlo;
    d.text(`Monte Carlo (${mc.runs.toLocaleString('en-US')} runs, seed ${mc.seed}): mean ${fmtPerShare(mc.mean)}, median ${fmtPerShare(mc.median)}, P5 ${fmtPerShare(mc.p5)}, P25 ${fmtPerShare(mc.p25)}, P75 ${fmtPerShare(mc.p75)}, P95 ${fmtPerShare(mc.p95)}; probability of a value above the price ${fmtPctFrac(mc.probAbovePrice, 1)}.`, 8.5);
  }

  // ------------------------------------------------------------------ secondary modules
  d.newPage();
  d.h2('Relative valuation');
  if (v.comps.peers.length === 0) d.text('Trading comparables: no peers entered; the method is excluded from the blend.', 8.5);
  else {
    d.table(
      [{ header: 'Peer', width: 50 }, { header: 'EV/EBITDA LTM', width: 24, align: 'right' }, { header: 'EV/EBITDA NTM', width: 24, align: 'right' }, { header: 'P/E LTM', width: 20, align: 'right' }, { header: 'P/B', width: 18, align: 'right' }, { header: 'Source', width: 48 }],
      v.comps.peers.map((p) => [`${p.name} (${p.ticker})`, fmtMultiple(p.evEbitdaLtm), fmtMultiple(p.evEbitdaNtm), fmtMultiple(p.peLtm), fmtMultiple(p.pb), `${p.source}, ${p.sourceDate}`]),
    );
    for (const i of v.comps.implied) d.text(`${i.multiple}: ${fmtMultiple(i.statistic, 2)} gives EGP ${fmtPerShare(i.perShare)} per share.`, 8.5);
  }
  if (v.precedents.deals.length === 0) d.text('Precedent transactions: none entered; the method is excluded from the blend.', 8.5);
  else for (const i of v.precedents.implied) d.text(`Precedent transactions, ${i.multiple}: ${fmtMultiple(i.statistic, 2)} gives EGP ${fmtPerShare(i.perShare)} per share.`, 8.5);
  if (v.sotp.segments.length === 0) d.text('Sum of the parts: no segments entered; the method is excluded from the blend.', 8.5);
  else d.text(`Sum of the parts: segment EV ${fmtAmount(v.sotp.enterpriseValue)}, equity ${fmtAmount(v.sotp.equityValue)}, EGP ${fmtPerShare(v.sotp.perShare)} per share.`, 8.5);
  if (v.brokers) d.text(`Broker targets (reference only, not in the blend): ${v.brokers.count} targets from EGP ${fmtPerShare(v.brokers.low)} to ${fmtPerShare(v.brokers.high)}, median ${fmtPerShare(v.brokers.median)}.`, 8.5);

  d.h2('Historical quality and credit');
  const pz = v.piotroski;
  if (pz.available) {
    d.table(
      [{ header: 'Piotroski test', width: 110 }, { header: 'Score', width: 20, align: 'right' }],
      [...pz.tests.map((tt) => [tt.name, String(tt.score)]), [{ text: 'F-score (of 9)', bold: true }, { text: String(pz.score), bold: true }]],
      { totalRows: [pz.tests.length] },
    );
    d.text(pz.variant, 7.5);
  } else d.text(`Piotroski F-score: ${pz.reason}`, 8.5);
  d.table(
    [{ header: "Altman Z''-EM", width: 60 }, ...v.zScores.map((z) => ({ header: `FY${z.fiscalYear}`, width: 30, align: 'right' as Align }))],
    [
      ['Score', ...v.zScores.map((z) => fmtNumber(z.score, 2))],
      ['Zone', ...v.zScores.map((z) => z.zone)],
    ],
  );
  const du = v.dupont;
  d.kv([
    [`DuPont FY${du.fiscalYear} (${du.averageBalances ? 'average balances' : 'year-end balances'})`, `ROE ${fmtPctFrac(du.roe3)}`],
    ['Net margin x asset turnover x equity multiplier', `${fmtPctFrac(du.netMargin)} x ${fmtNumber(du.assetTurnover, 3)} x ${fmtNumber(du.equityMultiplier, 3)}`],
    ['Tax burden x interest burden x EBIT margin', `${fmtNumber(du.taxBurden, 3)} x ${fmtNumber(du.interestBurden, 3)} x ${fmtPctFrac(du.ebitMargin)}`],
    ['Net debt / EBITDA', fmtMultiple(v.credit.netDebtToEbitda, 2)],
    ['Interest cover (debt and lease interest)', Number.isFinite(v.credit.interestCover) ? fmtMultiple(v.credit.interestCover, 1) : 'n/a'],
    ['FFO / debt', Number.isFinite(v.credit.ffoToDebt) ? fmtMultiple(v.credit.ffoToDebt, 1) : 'n/a'],
  ], 90);
  for (const n of v.credit.notes) d.text(n, 8);

  d.h2('FX sensitivity');
  if (!v.fx.available) d.text(`Not computed: ${v.fx.reason} USD-linked revenue share: ${v.fx.usdRevenueShare === null ? 'not entered' : fmtPct(v.fx.usdRevenueShare, 2)}.`, 8.5);
  else d.table([{ header: 'Move', width: 90 }, { header: 'Value per share', width: 30, align: 'right' }, { header: 'Change', width: 30, align: 'right' }], v.fx.rows.map((r) => [r.label, fmtPerShare(r.perShare), fmtPctFrac(r.change, 1)]));

  if (v.eas.length) {
    d.h2('Egyptian Accounting Standards reflected in the statement lines');
    for (const e of v.eas) d.text(`${e.standard} (${e.topic}): ${e.text}`, 8.5);
  }
  if (v.secondary.risks.length) {
    d.h2('Key risks (entered by the analyst)');
    for (const r of v.secondary.risks) d.text(`- ${r}`, 8.5);
  }

  // ------------------------------------------------------------------ sources
  d.newPage();
  d.h2(`Sources (rates snapshot ${snap.snapshotId}, frozen ${snap.frozenAt.slice(0, 10)})`);
  d.text(`Company data: ${c.statementsSource.description} Auditor ${c.statementsSource.auditor}, report dated ${fmtDate(c.statementsSource.reportDate)}. Share price: ${c.priceSource}.`, 8);
  const used = new Set(v.ratesUsed.map((x) => x.id));
  d.table(
    [{ header: 'Id', width: 44 }, { header: 'Value', width: 30, align: 'right' }, { header: 'As of', width: 20 }, { header: 'Status', width: 18 }, { header: 'Used', width: 10 }, { header: 'Source and URL', width: 82 }],
    snap.entries.map((e) => [
      e.id,
      Array.isArray(e.value) ? `${e.value.length} rows` : typeof e.value === 'number' ? (e.unit === 'pct' ? fmtPct(e.value, 3) : fmtNumber(e.value, 4)) : String(e.value),
      fmtDate(e.asOf),
      e.status,
      used.has(e.id) ? 'yes' : '',
      `${e.sourceName}: ${e.sourceUrl}`,
    ]),
    { size: 6.8 },
  );

  // ------------------------------------------------------------------ methodology appendix
  d.h2('Methodology (condensed)');
  const meth = [
    'Timeline: year-1 cash flow scaled by YEARFRAC(valuation date, first fiscal year end, actual/actual); discount dates at period mid-points when mid-year is on; years = days from the valuation date / 365; terminal value discounted from the final period end.',
    'Normalization: reported operating profit less ECL movements, impairment reversals, provisions released and disposal gains (analyst-editable); finance income and FX translation are non-operating.',
    'Forecast: revenue growth, gross margin before D&A, SG&A and other operating items as % revenue; D&A by PP&E roll-forward; capex % revenue; working capital by receivable, inventory and payable days; drivers fade linearly from the last actual year to terminal drivers.',
    'FCFF = NOPAT + D&A - capex - change in NWC - employee and board distributions (percent of prior-year net profit), NOPAT at the statutory tax rate.',
    'Cost of equity by CAPM with a bottom-up beta (Damodaran emerging-markets unlevered beta corrected for cash, relevered at market D/E); cost of debt from a synthetic rating on debt and lease interest; market-value weights.',
    'Terminal value: Gordon growth on the terminal-year FCFF and exit multiple on final-year EBITDA, both computed; terminal capex default consistent with reinvestment = g / RONIC (RONIC = WACC).',
    'Equity value = EV + cash, FVTPL and amortized-cost investments, associates - debt, leases, employee benefit obligations, minority interest and preferred equity; restricted deposits excluded.',
    'DDM: two-stage and H-model on shareholder dividends only, discounted at the cost of equity.',
    'Scenarios and sensitivities are full re-runs of the model. Monte Carlo uses a seeded generator. The blend uses the entered weights; methods without inputs are excluded.',
    'References: Damodaran, Investment Valuation and Damodaran Online datasets; Koller, Goedhart and Wessels, Valuation (McKinsey, 7th ed.); CFA Institute equity valuation curriculum.',
  ];
  for (const m of meth) d.text(`- ${m}`, 8);

  d.h2('Disclaimer');
  d.text(`Prepared by ${input.preparedBy ?? 'Ahmed Wael Metwally'} with the WOLF Valuation Engine. This document is analytical only and is not investment advice, a recommendation, or an offer to buy or sell securities. It is not a research publication licensed by the Financial Regulatory Authority (FRA) of Egypt. Company data and assumptions are user-supplied; macro rates are taken from the rates snapshot listed on the Sources page with their dates and statuses.`, 8);

  d.finish(`${c.shortName} (${c.ticker}) | Analytical only. Not investment advice.`);
  return doc;
}

export function pdfBytes(input: PdfInput): ArrayBuffer {
  return buildPdf(input).output('arraybuffer');
}

export function pdfFileName(c: CompanyData, valuationDate: string): string {
  return `${c.shortName}_${c.ticker.replace(/\W+/g, '')}_valuation_${valuationDate}.pdf`;
}
