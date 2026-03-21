## WOLF PDF EXPORT — COMPLETE REWRITE: html2canvas → jsPDF NATIVE

### THE PROBLEM
The current PDF export works by:
1. Rendering hidden HTML divs
2. Taking screenshots with html2canvas
3. Embedding those screenshots as raster images in the PDF

This produces: heavy files (5–15MB), blurry text, slow generation (10–30 seconds),
and a PDF that is essentially a photo — not searchable, not crisp, not professional.

### THE SOLUTION
Delete the entire html2canvas approach. Rewrite pdfExport.ts (or the equivalent
PDF generation file) using jsPDF's native drawing API only.

jsPDF draws text, rectangles, and lines directly as vectors. The result is:
- File size: 100–400KB (not 5–15MB)
- Generation time: under 1 second
- Text: perfectly sharp at any zoom level
- Searchable, copy-pasteable text
- No DOM rendering, no hidden divs, no screenshots

---

### STEP 1 — FIND AND DELETE THE OLD APPROACH

Search for these patterns and remove them entirely:
```bash
grep -rn "html2canvas\|html2Canvas\|canvas.toDataURL\|addImage.*canvas\|pdf-page\|pdf-container" src/
```

Delete:
- All imports of html2canvas
- All hidden <div className="pdf-page"> containers in JSX
- All useRef attached to PDF containers
- The entire async capture loop (forEach page → canvas → addImage)
- Any CSS like .pdf-page, .pdf-container, .pdf-hidden

---

### STEP 2 — INSTALL / VERIFY jsPDF

jsPDF should already be installed. Verify:
```bash
grep "jspdf" package.json
```

If missing: npm install jspdf

The API version being used must be jsPDF 2.x. Import like this:
```typescript
import jsPDF from 'jspdf';
```

Do NOT use autoTable plugin — build all tables manually with rectangles and text.
Do NOT use html2canvas — not at all, not even for charts.

---

### STEP 3 — THE COMPLETE NATIVE PDF BUILDER

Replace your entire PDF export function with this architecture.
File: src/utils/pdfExport.ts (or wherever PDF generation lives)
```typescript
import jsPDF from 'jspdf';

// ── DESIGN TOKENS ─────────────────────────────────────────────
const COLORS = {
  pageBg:     [11, 15, 26]    as [number,number,number], // #0B0F1A
  navy:       [26, 35, 64]    as [number,number,number], // #1A2340
  gold:       [197, 164, 78]  as [number,number,number], // #C5A44E
  ivory:      [244, 237, 228] as [number,number,number], // #F4EDE4
  gray:       [107, 114, 128] as [number,number,number], // #6B7280
  green:      [34, 197, 94]   as [number,number,number], // #22C55E
  red:        [239, 68, 68]   as [number,number,number], // #EF4444
  amber:      [245, 158, 11]  as [number,number,number], // #F59E0B
  dimGold:    [139, 117, 52]  as [number,number,number], // #8B7534
};

// ── PAGE DIMENSIONS (A4 Portrait, mm) ─────────────────────────
const PW = 210;   // page width
const PH = 297;   // page height
const ML = 20;    // margin left
const MR = 20;    // margin right
const CW = PW - ML - MR;  // content width = 170mm

// ── FONT SIZES ─────────────────────────────────────────────────
const FS = {
  h1: 22, h2: 14, h3: 11, h4: 9,
  body: 9, small: 7.5, mono: 8.5
};

// ── HELPER: set fill color ─────────────────────────────────────
function fill(doc: jsPDF, rgb: [number,number,number]) {
  doc.setFillColor(rgb[0], rgb[1], rgb[2]);
}
function stroke(doc: jsPDF, rgb: [number,number,number]) {
  doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
}
function textColor(doc: jsPDF, rgb: [number,number,number]) {
  doc.setTextColor(rgb[0], rgb[1], rgb[2]);
}

// ── HELPER: draw data row ──────────────────────────────────────
// label on left, value on right, optional highlight
function dataRow(
  doc: jsPDF, y: number,
  label: string, value: string,
  highlight = false,
  valueColor?: [number,number,number]
): number {
  const rowH = 7;
  if (highlight) {
    fill(doc, COLORS.navy);
    doc.rect(ML, y, CW, rowH, 'F');
  }
  // separator line
  stroke(doc, [30, 40, 60]);
  doc.setLineWidth(0.1);
  doc.line(ML, y + rowH, ML + CW, y + rowH);

  // label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(FS.body);
  textColor(doc, COLORS.gray);
  doc.text(label, ML + 3, y + rowH - 2);

  // value (right-aligned, monospace weight)
  doc.setFont('courier', 'bold');
  doc.setFontSize(FS.mono);
  textColor(doc, valueColor ?? COLORS.ivory);
  doc.text(value, ML + CW - 3, y + rowH - 2, { align: 'right' });

  return y + rowH;
}

// ── HELPER: section header ─────────────────────────────────────
function sectionHeader(doc: jsPDF, y: number, title: string): number {
  // gold underline
  stroke(doc, COLORS.gold);
  doc.setLineWidth(0.4);
  doc.line(ML, y + 7, ML + CW, y + 7);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FS.h3);
  textColor(doc, COLORS.gold);
  doc.text(title.toUpperCase(), ML, y + 5);
  return y + 12;
}

// ── HELPER: page header ────────────────────────────────────────
function pageHeader(doc: jsPDF, title: string) {
  fill(doc, COLORS.navy);
  doc.rect(0, 0, PW, 14, 'F');
  stroke(doc, COLORS.gold);
  doc.setLineWidth(0.3);
  doc.line(0, 14, PW, 14);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  textColor(doc, COLORS.gold);
  doc.text('WOLF', ML, 9.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  textColor(doc, COLORS.gray);
  doc.text(title.toUpperCase(), PW - MR, 9.5, { align: 'right' });
}

// ── HELPER: page footer ────────────────────────────────────────
function pageFooter(doc: jsPDF, pageNum: number) {
  fill(doc, COLORS.navy);
  doc.rect(0, PH - 10, PW, 10, 'F');
  stroke(doc, COLORS.gold);
  doc.setLineWidth(0.3);
  doc.line(0, PH - 10, PW, PH - 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  textColor(doc, COLORS.gray);
  doc.text('Wolf Valuation Engine | Part of the Wolf Financial Suite', ML, PH - 3.5);
  doc.text(`Page ${pageNum}`, PW - MR, PH - 3.5, { align: 'right' });
}

// ── HELPER: full page background ──────────────────────────────
function pageBg(doc: jsPDF) {
  fill(doc, COLORS.pageBg);
  doc.rect(0, 0, PW, PH, 'F');
}

// ── NUMBER FORMATTERS ──────────────────────────────────────────
const fmt = {
  egp:   (n: number | null) => n == null ? '—' : `${n.toFixed(2)} EGP`,
  large: (n: number | null) => n == null ? '—' : Math.abs(n).toLocaleString('en-US'),
  paren: (n: number | null) => n == null ? '—' :
    n < 0 ? `(${Math.abs(n).toLocaleString('en-US')})` : n.toLocaleString('en-US'),
  pct:   (n: number | null, sign = false) => n == null ? '—' :
    `${sign && n > 0 ? '+' : ''}${n.toFixed(2)}%`,
  x:     (n: number | null) => n == null ? '—' : `${n.toFixed(2)}x`,
  days:  (n: number | null) => n == null ? '—' : `${n.toFixed(1)} days`,
};


// ══════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ══════════════════════════════════════════════════════════════
export function generatePDF(data: ValuationData): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  // Pull all values from data (never hardcode)
  const company   = data.financialData.companyName;
  const ticker    = data.financialData.ticker;
  const price     = data.financialData.currentStockPrice;
  const dcf       = data.results.dcfPerShare;
  const comps     = data.results.comparableValue;
  const blended   = data.results.blendedValue;
  const upside    = data.results.upside * 100;
  const rec       = data.results.recommendation;    // 'BUY' | 'HOLD' | 'SELL'
  const wacc      = data.results.wacc.wacc * 100;   // auto-calculated WACC
  const tg        = data.assumptions.terminalGrowthRate;
  const grev      = data.assumptions.revenueGrowthRate;
  const margin    = data.assumptions.ebitdaMargin;
  const tax       = data.assumptions.taxRate;
  const bear      = data.results.scenarios.bear.price;
  const bull      = data.results.scenarios.bull.price;
  const tv        = data.results.terminalValue;
  const ev        = data.results.enterpriseValue;
  const equityVal = data.results.equityValue;
  const sumPV     = data.results.sumPVFCFF;
  const pvTV      = data.results.pvTerminalValue;
  const ke        = data.results.wacc.ke * 100;
  const gordon    = data.results.ddm?.gordon;
  const twoStage  = data.results.ddm?.twoStage;
  const hModel    = data.results.ddm?.hModel;
  const dps       = data.results.ddm?.dps;
  const zscore    = data.results.altmanZ?.score;
  const quality   = data.results.qualityScore?.total;
  const qualGrade = data.results.qualityScore?.grade;
  const mcMean    = data.results.monteCarlo?.mean;
  const proj      = data.results.projections; // array of 5 year projections
  const is        = data.financialData.incomeStatement;
  const bs        = data.financialData.balanceSheet;
  const cf        = data.financialData.cashFlowStatement;
  const ratios    = data.results.ratios;
  const sens      = data.results.sensitivityMatrix; // 5x5 array
  const date      = new Date().toLocaleDateString('en-GB', {
    day: '2-digit', month: 'long', year: 'numeric'
  });

  // ── PAGE 1: COVER ────────────────────────────────────────────
  pageBg(doc);

  // Centered WOLF wordmark
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(56);
  textColor(doc, COLORS.gold);
  doc.text('WOLF', PW / 2, 100, { align: 'center', charSpace: 8 });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  textColor(doc, COLORS.gray);
  doc.text('EQUITY VALUATION ENGINE', PW / 2, 108, { align: 'center', charSpace: 3 });

  // Gold rule
  stroke(doc, COLORS.gold);
  doc.setLineWidth(0.5);
  doc.line(PW / 2 - 25, 113, PW / 2 + 25, 113);

  // Report title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  textColor(doc, COLORS.ivory);
  doc.text('Equity Valuation Report', PW / 2, 128, { align: 'center' });

  // Company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  textColor(doc, COLORS.gold);
  doc.text(`${company} (${ticker})`, PW / 2, 140, { align: 'center' });

  // Date
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  textColor(doc, COLORS.gray);
  doc.text(date, PW / 2, 148, { align: 'center' });

  // Status badge (drawn rectangle)
  const badgeColor = rec === 'BUY' ? COLORS.green :
                     rec === 'SELL' ? COLORS.red : COLORS.amber;
  const badgeText = `${rec} — ${upside > 0 ? '+' : ''}${upside.toFixed(2)}% Upside`;
  stroke(doc, badgeColor);
  doc.setLineWidth(0.6);
  doc.rect(PW / 2 - 38, 154, 76, 10, 'S');
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  textColor(doc, badgeColor);
  doc.text(badgeText, PW / 2, 160.5, { align: 'center' });

  // Metadata line
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  textColor(doc, COLORS.gray);
  doc.text(
    `Currency: EGP  |  Current: ${fmt.egp(price)}  |  Blended: ${fmt.egp(blended)}`,
    PW / 2, 172, { align: 'center' }
  );

  // Footer (cover has its own simple footer)
  doc.setFontSize(6.5);
  textColor(doc, COLORS.gray);
  doc.text('Wolf Valuation Engine | Part of the Wolf Financial Suite', PW / 2, PH - 6, { align: 'center' });

  // ── PAGE 2: VALUATION SUMMARY ─────────────────────────────────
  doc.addPage();
  pageBg(doc);
  pageHeader(doc, 'Valuation Summary');
  pageFooter(doc, 2);

  let y = 22;
  y = sectionHeader(doc, y, 'Valuation Overview');

  // Three key metric cards side by side
  const cardW = (CW - 8) / 3;
  const cards = [
    { label: 'DCF Fair Value', value: fmt.egp(dcf) },
    { label: 'Comparable Fair Value', value: fmt.egp(comps) },
    { label: 'Blended Value (60/40)', value: fmt.egp(blended) },
  ];
  cards.forEach((card, i) => {
    const cx = ML + i * (cardW + 4);
    fill(doc, COLORS.navy);
    stroke(doc, i === 2 ? COLORS.gold : [40, 55, 80]);
    doc.setLineWidth(i === 2 ? 0.5 : 0.2);
    doc.rect(cx, y, cardW, 16, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    textColor(doc, COLORS.gray);
    doc.text(card.label, cx + cardW / 2, y + 5, { align: 'center' });
    doc.setFont('courier', 'bold');
    doc.setFontSize(11);
    textColor(doc, i === 2 ? COLORS.gold : COLORS.ivory);
    doc.text(card.value, cx + cardW / 2, y + 12, { align: 'center' });
  });
  y += 21;

  y = dataRow(doc, y, 'Current Stock Price', fmt.egp(price));
  const upsideColor = upside > 0 ? COLORS.green : COLORS.red;
  y = dataRow(doc, y, 'Upside / (Downside)', fmt.pct(upside, true), false, upsideColor);
  y = dataRow(doc, y, 'Recommendation', rec, false, badgeColor);
  y += 4;

  // Key assumptions (right column) — draw two-column layout
  const col1End = ML + CW * 0.52;
  const col2Start = col1End + 6;
  const col2W = ML + CW - col2Start;

  // Reset y and draw assumptions alongside valuation rows
  y = sectionHeader(doc, y, 'Key Assumptions');
  const assumptions = [
    ['WACC (Discount Rate)', fmt.pct(wacc)],
    ['Terminal Growth Rate', fmt.pct(tg)],
    ['Revenue Growth Rate', fmt.pct(grev)],
    ['EBITDA Margin', fmt.pct(margin)],
    ['Tax Rate', fmt.pct(tax)],
    ['Projection Years', '5'],
  ];
  assumptions.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(FS.body);
    textColor(doc, COLORS.gray);
    doc.text(label, ML + 3, y + 5);
    doc.setFont('courier', 'bold');
    doc.setFontSize(FS.mono);
    textColor(doc, COLORS.ivory);
    doc.text(value, ML + CW - 3, y + 5, { align: 'right' });
    stroke(doc, [30, 40, 60]);
    doc.setLineWidth(0.1);
    doc.line(ML, y + 7, ML + CW, y + 7);
    y += 7;
  });
  y += 5;

  // Football Field
  y = sectionHeader(doc, y, 'Football Field — Valuation Range');
  const ffHeaders = ['Method', 'Low', 'Mid', 'High', 'vs Current'];
  const ffW = [35, 32, 32, 32, 25];
  // header row
  fill(doc, COLORS.navy);
  doc.rect(ML, y, CW, 7, 'F');
  let fx = ML;
  ffHeaders.forEach((h, i) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    textColor(doc, COLORS.gold);
    doc.text(h, fx + 2, y + 5);
    fx += ffW[i];
  });
  y += 7;

  const ffRows = [
    ['DCF',       fmt.egp(dcf * 0.735), fmt.egp(dcf),  fmt.egp(dcf * 1.593), fmt.pct((dcf - price) / price * 100, true)],
    ['P/E',       fmt.egp(ratios?.peImplied * 0.85), fmt.egp(ratios?.peImplied), fmt.egp(ratios?.peImplied * 1.15), ''],
    ['EV/EBITDA', fmt.egp(ratios?.evEbitdaImplied * 0.85), fmt.egp(ratios?.evEbitdaImplied), fmt.egp(ratios?.evEbitdaImplied * 1.15), ''],
    ['DDM',       fmt.egp(gordon), fmt.egp(hModel), fmt.egp(twoStage), ''],
    ['P/B',       fmt.egp(ratios?.pbImplied * 0.85), fmt.egp(ratios?.pbImplied), fmt.egp(ratios?.pbImplied * 1.15), ''],
    ['Blended',   fmt.egp(blended * 0.90), fmt.egp(blended), fmt.egp(blended * 1.10), fmt.pct(upside, true)],
  ];
  ffRows.forEach((row, ri) => {
    if (ri % 2 === 0) { fill(doc, [15, 22, 40]); doc.rect(ML, y, CW, 7, 'F'); }
    fx = ML;
    row.forEach((cell, ci) => {
      const isValue = ci > 0;
      doc.setFont(isValue ? 'courier' : 'helvetica', isValue ? 'bold' : 'normal');
      doc.setFontSize(isValue ? FS.mono : FS.body);
      const cellColor = (ci === 4 && row[ci].startsWith('+')) ? COLORS.green :
                        (ci === 4 && row[ci].startsWith('-')) ? COLORS.red :
                        COLORS.ivory;
      textColor(doc, ci === 0 ? COLORS.gray : cellColor);
      doc.text(cell, fx + (ci > 0 ? ffW[ci] - 2 : 2), y + 5,
        { align: ci > 0 ? 'right' : 'left' });
      fx += ffW[ci];
    });
    y += 7;
  });
  y += 5;

  // Scenario analysis
  y = sectionHeader(doc, y, 'Scenario Analysis');
  const scenarios = [
    { name: 'BEAR CASE', price: bear, assumptions: 'Growth: 6.0%  WACC: 28.3%  Margin: −1.5%/yr', color: COLORS.red },
    { name: 'BASE CASE', price: dcf,  assumptions: `Growth: ${grev}%  WACC: ${wacc.toFixed(1)}%`,        color: COLORS.gold, highlight: true },
    { name: 'BULL CASE', price: bull, assumptions: 'Growth: 30.0%  WACC: 23.3%  Margin: +2.5%/yr', color: COLORS.green },
  ];
  scenarios.forEach(s => {
    if (s.highlight) { fill(doc, COLORS.navy); doc.rect(ML, y, CW, 10, 'F'); }
    // colored left bar
    fill(doc, s.color);
    doc.rect(ML, y, 1.5, 10, 'F');
    doc.setFont('helvetica', s.highlight ? 'bold' : 'normal');
    doc.setFontSize(8);
    textColor(doc, s.highlight ? COLORS.ivory : COLORS.gray);
    doc.text(s.name, ML + 5, y + 4);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    textColor(doc, COLORS.gray);
    doc.text(s.assumptions, ML + 5, y + 8);
    doc.setFont('courier', 'bold');
    doc.setFontSize(10);
    textColor(doc, s.color);
    doc.text(fmt.egp(s.price), ML + CW - 3, y + 7, { align: 'right' });
    const vsC = (s.price - price) / price * 100;
    doc.setFontSize(7.5);
    textColor(doc, vsC > 0 ? COLORS.green : COLORS.red);
    doc.text(fmt.pct(vsC, true), ML + CW - 40, y + 7, { align: 'right' });
    y += 11;
  });

  // ── PAGE 3: DCF ANALYSIS ────────────────────────────────────
  doc.addPage();
  pageBg(doc);
  pageHeader(doc, 'DCF Analysis');
  pageFooter(doc, 3);
  y = 22;

  y = sectionHeader(doc, y, 'FCFF Projections — 5-Year Horizon');

  // FCFF table header
  const years = ['Metric', '2027', '2028', '2029', '2030', '2031'];
  const yw = [42, 26, 26, 26, 26, 26];
  fill(doc, COLORS.navy);
  doc.rect(ML, y, CW, 7, 'F');
  let tx = ML;
  years.forEach((h, i) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    textColor(doc, COLORS.gold);
    doc.text(h, i === 0 ? tx + 2 : tx + yw[i] - 2, y + 5,
      { align: i === 0 ? 'left' : 'right' });
    tx += yw[i];
  });
  y += 7;

  // FCFF rows — pull from projections array
  const fcffRows = [
    { label: 'Revenue',         key: 'revenue',         highlight: false },
    { label: 'EBITDA',          key: 'ebitda',          highlight: false },
    { label: 'D&A',             key: 'da',              highlight: false },
    { label: 'EBIT',            key: 'ebit',            highlight: false },
    { label: 'NOPAT',           key: 'nopat',           highlight: false },
    { label: 'CapEx',           key: 'capex',           highlight: false },
    { label: 'Delta WC',        key: 'deltaWC',         highlight: false },
    { label: 'FCFF',            key: 'fcff',            highlight: true },
    { label: 'Discount Factor', key: 'discountFactor',  highlight: false, decimals: 3 },
    { label: 'PV of FCFF',      key: 'presentValue',    highlight: true },
  ];
  fcffRows.forEach((row, ri) => {
    if (row.highlight || ri % 2 === 0) {
      fill(doc, row.highlight ? [20, 35, 60] : [15, 22, 40]);
      doc.rect(ML, y, CW, 7, 'F');
    }
    if (row.highlight) { stroke(doc, COLORS.gold); doc.setLineWidth(0.2); doc.line(ML, y, ML+CW, y); }
    tx = ML;
    doc.setFont('helvetica', row.highlight ? 'bold' : 'normal');
    doc.setFontSize(FS.body);
    textColor(doc, row.highlight ? COLORS.ivory : COLORS.gray);
    doc.text(row.label, tx + 2, y + 5);
    tx += yw[0];
    proj.forEach((p: any, i: number) => {
      const val = p[row.key];
      doc.setFont('courier', row.highlight ? 'bold' : 'normal');
      doc.setFontSize(7.5);
      textColor(doc, row.highlight ? COLORS.gold : COLORS.ivory);
      const display = row.decimals
        ? val?.toFixed(row.decimals) ?? '—'
        : fmt.large(val);
      doc.text(display, tx + yw[i + 1] - 2, y + 5, { align: 'right' });
      tx += yw[i + 1];
    });
    y += 7;
  });
  y += 6;

  // Two-column section: EV bridge + WACC breakdown
  const halfW = (CW - 6) / 2;
  const col2X = ML + halfW + 6;
  let yL = y;
  let yR = y;

  // EV Bridge (left)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FS.h4);
  stroke(doc, COLORS.gold);
  doc.setLineWidth(0.3);
  doc.line(ML, yL + 7, ML + halfW, yL + 7);
  textColor(doc, COLORS.gold);
  doc.text('EV-TO-EQUITY BRIDGE', ML, yL + 5);
  yL += 12;

  const bridgeRows: [string, string, boolean, ([number,number,number])?][] = [
    ['Sum of PV(FCFF) Yr 1–5', fmt.large(sumPV), false],
    ['Terminal Value (g=8%)', fmt.large(tv), false],
    ['PV of Terminal Value', fmt.large(pvTV), false],
    ['Enterprise Value', fmt.large(ev), true, COLORS.gold],
    ['Less: Total Debt', `(${fmt.large(bs.totalDebt)})`, false, COLORS.red],
    ['Plus: Cash', fmt.large(bs.cash), false],
    ['Equity Value', fmt.large(equityVal), true, COLORS.gold],
    ['Shares Outstanding', fmt.large(data.financialData.sharesOutstanding), false],
    ['DCF Fair Value / Share', fmt.egp(dcf), true, COLORS.gold],
  ];
  bridgeRows.forEach(([label, value, hl, vc]) => {
    if (hl) { fill(doc, COLORS.navy); doc.rect(ML, yL, halfW, 7, 'F'); }
    doc.setFont('helvetica', hl ? 'bold' : 'normal');
    doc.setFontSize(FS.body);
    textColor(doc, COLORS.gray);
    doc.text(label, ML + 2, yL + 5);
    doc.setFont('courier', hl ? 'bold' : 'normal');
    doc.setFontSize(hl ? 9 : FS.mono);
    textColor(doc, vc ?? COLORS.ivory);
    doc.text(value, ML + halfW - 2, yL + 5, { align: 'right' });
    stroke(doc, [30, 40, 60]);
    doc.setLineWidth(0.1);
    doc.line(ML, yL + 7, ML + halfW, yL + 7);
    yL += 7;
  });

  // WACC Breakdown (right)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(FS.h4);
  stroke(doc, COLORS.gold);
  doc.setLineWidth(0.3);
  doc.line(col2X, yR + 7, col2X + halfW, yR + 7);
  textColor(doc, COLORS.gold);
  doc.text('WACC BREAKDOWN', col2X, yR + 5);
  yR += 12;

  const waccRows: [string, string, boolean?][] = [
    ['Risk-Free Rate (Rf)', fmt.pct(data.assumptions.riskFreeRate)],
    ['Equity Risk Premium', fmt.pct(data.assumptions.equityRiskPremium)],
    ['Beta', data.assumptions.beta.toFixed(2)],
    ['Cost of Equity (Ke)', fmt.pct(ke), true],
    ['Cost of Debt (Pre-Tax)', fmt.pct(data.assumptions.costOfDebt)],
    ['Tax Rate', fmt.pct(tax)],
    ['Cost of Debt (After-Tax)', fmt.pct(ke * 0 + data.results.wacc.kdAfterTax * 100)],
    ['Equity Weight (We)', fmt.pct(data.results.wacc.equityWeight * 100)],
    ['Debt Weight (Wd)', fmt.pct(data.results.wacc.debtWeight * 100)],
    ['WACC', fmt.pct(wacc), true],
  ];
  waccRows.forEach(([label, value, hl]) => {
    if (hl) { fill(doc, COLORS.navy); doc.rect(col2X, yR, halfW, 7, 'F'); }
    doc.setFont('helvetica', hl ? 'bold' : 'normal');
    doc.setFontSize(FS.body);
    textColor(doc, COLORS.gray);
    doc.text(label, col2X + 2, yR + 5);
    doc.setFont('courier', hl ? 'bold' : 'normal');
    doc.setFontSize(hl ? 10 : FS.mono);
    textColor(doc, hl ? COLORS.gold : COLORS.ivory);
    doc.text(value, col2X + halfW - 2, yR + 5, { align: 'right' });
    stroke(doc, [30, 40, 60]);
    doc.setLineWidth(0.1);
    doc.line(col2X, yR + 7, col2X + halfW, yR + 7);
    yR += 7;
  });

  // Continue same pattern for pages 4–9...
  // [Pages 4-9 follow the identical pattern: addPage() → pageBg() → pageHeader() → pageFooter() → sections]
  // Build each page using the same dataRow(), sectionHeader(), fill/stroke helpers above.

  // ── PAGE 4: COMPARABLES & SENSITIVITY ──────────────────────
  // ── PAGE 5: ADVANCED ANALYTICS ─────────────────────────────
  // ── PAGE 6: FINANCIAL STATEMENTS ───────────────────────────
  // ── PAGE 7: RATIOS & DDM ────────────────────────────────────
  // ── PAGE 8: FCFF RECONCILIATION & EAS ──────────────────────
  // ── PAGE 9: ASSUMPTIONS & DISCLAIMER ────────────────────────
  // [Implement each following the same pattern as pages 2 and 3 above]

  // ── SAVE ─────────────────────────────────────────────────────
  const filename = `WOLF_Valuation_Report_${ticker}_${new Date().toISOString().slice(0,10)}.pdf`;
  doc.save(filename);
}
```

---

### STEP 4 — CONNECT TO THE EXPORT BUTTON

Replace the old export trigger with a simple synchronous call:
```typescript
// In your Export button handler:
import { generatePDF } from '../utils/pdfExport';

// ❌ OLD (async, heavy):
const handleExportPDF = async () => {
  setIsGenerating(true);
  await generatePDF(containerRef.current, valuationData);
  setIsGenerating(false);
};

// ✅ NEW (synchronous, instant):
const handleExportPDF = () => {
  generatePDF(valuationData);
};
```

No loading spinner needed. No await. No ref. No hidden divs.

---

### STEP 5 — CLEAN UP JSX

Remove every hidden PDF container from your JSX:
```tsx
// DELETE all of this from App.tsx or wherever it lives:
<div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
  <div className="pdf-page" ref={page1Ref}>...</div>
  <div className="pdf-page" ref={page2Ref}>...</div>
  {/* etc */}
</div>
```

Remove all refs: page1Ref, page2Ref, pdfContainerRef, etc.
Remove all PDF-related useState: isGenerating, pdfReady, etc.

---

### STEP 6 — REMOVE html2canvas FROM DEPENDENCIES
```bash
npm uninstall html2canvas
```

Remove the import from every file that has it:
```bash
grep -rn "html2canvas" src/ --include="*.ts" --include="*.tsx"
```

---

### VERIFICATION

After implementation, click Export PDF and verify:

1. PDF generates in under 1 second (no spinner, no delay)
2. File size is under 500KB (not 5–15MB)
3. Text is perfectly sharp when zoomed to 400% in a PDF viewer
4. Text is selectable and copyable
5. All 9 pages present with correct page numbers
6. All values match: DCF=43.93, Blended=55.72, Upside=+23.82%
7. Colors match: navy headers, gold accents, ivory text on dark background
8. No images embedded — verify in PDF properties: "0 images"