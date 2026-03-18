# WOLF Valuation Engine — World-Class Excel Rebuild
## Complete Prompt for Antigravity / Claude Opus 4 (Extended Thinking)

---

## DIAGNOSIS — WHY THE FILE BREAKS IN EXCEL

**Root cause:** The Sensitivity sheet (`sheet6.xml`) contains `LET()` formulas.
`LET()` is Excel 365 only. Any user on Excel 2019, 2021, or older Office will
trigger "We found a problem with some content" and Excel strips the formulas,
leaving blank cells.

**Fix:** Replace every `LET()` formula with compatible alternatives using
named ranges, helper columns, or `IFERROR(IF(...))` nesting.
All formulas must work in **Excel 2019 and above** (no LET, no LAMBDA,
no dynamic arrays unless wrapped in compatibility fallbacks).

---

## OBJECTIVE

Rebuild the WOLF Valuation Engine Excel export to be:

1. **Bug-free** — no corrupt formulas, opens cleanly in Excel 2019+
2. **100% live formulas** — no hard-coded calculated values anywhere
3. **World-class design** — institutional investment bank quality
4. **Mathematically verified** — every output matches the locked reference values

---

## PART 1 — BUG FIXES (DO FIRST)

### Fix 1 — Replace LET() with compatible formulas in Sensitivity sheet

The Sensitivity sheet's 25 DCF cells and 3 scenario cells must NOT use `LET()`.
Use this **Excel 2019-compatible** approach instead:

**Add a hidden helper sheet called `_Calc`** with named intermediate values,
then reference them in the Sensitivity sheet. This is cleaner than deeply
nested formulas and works in all Excel versions.

**`_Calc` sheet structure:**

```
// Column A = label, Column B = value
// These are the shared DCF building blocks

B1   =Inputs!B13            // Base Revenue
B2   =Inputs!B63/100        // Revenue Growth Rate
B3   =Inputs!B71/100        // EBITDA Margin
B4   =Inputs!B72/100        // D&A %
B5   =Inputs!B64/100        // Tax Rate
B6   =Inputs!B73/100        // CapEx %
B7   =Inputs!B74/100        // WC % of ΔRevenue
B8   =Inputs!B8             // Shares Outstanding
B9   =Inputs!B42+Inputs!B46 // Total Debt
B10  =Inputs!B27            // Cash
B11  =Inputs!B65            // Projection Years
```

**The compatibility-safe DCF formula** for one sensitivity cell (shown for
WACC = Base, Terminal Growth = Base — i.e. the center cell D7):

```excel
// Pre-compute the 5 FCFFs inline using named refs from _Calc sheet
// w = WACC, g = terminal growth, r = revenue growth
// FCFF(t) = R0*(1+r)^t * [(em-dp)*(1-tx)+dp-cp] - R0*(1+r)^(t-1)*r*wc
// PV(t) = FCFF(t) / (1+w)^t

// For each sensitivity cell, w and g come from the row/col headers.
// Headers must be real numbers (not text), stored in:
//   Row 4 (B4:F4) = growth values as decimals
//   Col A (A5:A9) = WACC values as decimals

// Then each DCF cell (e.g. D7) uses this formula:
=IFERROR(
  (
    (_Calc!$B$1*(1+_Calc!$B$2)*( (_Calc!$B$3-_Calc!$B$4)*(1-_Calc!$B$5)+_Calc!$B$4-_Calc!$B$6 ) - _Calc!$B$1*_Calc!$B$2*_Calc!$B$7) / (1+$A7)^1 +
    (_Calc!$B$1*(1+_Calc!$B$2)^2*( (_Calc!$B$3-_Calc!$B$4)*(1-_Calc!$B$5)+_Calc!$B$4-_Calc!$B$6 ) - _Calc!$B$1*(1+_Calc!$B$2)^1*_Calc!$B$2*_Calc!$B$7) / (1+$A7)^2 +
    (_Calc!$B$1*(1+_Calc!$B$2)^3*( (_Calc!$B$3-_Calc!$B$4)*(1-_Calc!$B$5)+_Calc!$B$4-_Calc!$B$6 ) - _Calc!$B$1*(1+_Calc!$B$2)^2*_Calc!$B$2*_Calc!$B$7) / (1+$A7)^3 +
    (_Calc!$B$1*(1+_Calc!$B$2)^4*( (_Calc!$B$3-_Calc!$B$4)*(1-_Calc!$B$5)+_Calc!$B$4-_Calc!$B$6 ) - _Calc!$B$1*(1+_Calc!$B$2)^3*_Calc!$B$2*_Calc!$B$7) / (1+$A7)^4 +
    (_Calc!$B$1*(1+_Calc!$B$2)^5*( (_Calc!$B$3-_Calc!$B$4)*(1-_Calc!$B$5)+_Calc!$B$4-_Calc!$B$6 ) - _Calc!$B$1*(1+_Calc!$B$2)^4*_Calc!$B$2*_Calc!$B$7) / (1+$A7)^5 +
    IF($A7>B$4,
      (_Calc!$B$1*(1+_Calc!$B$2)^4*( (_Calc!$B$3-_Calc!$B$4)*(1-_Calc!$B$5)+_Calc!$B$4-_Calc!$B$6 ) - _Calc!$B$1*(1+_Calc!$B$2)^3*_Calc!$B$2*_Calc!$B$7)*(1+B$4)/($A7-B$4) / (1+$A7)^5,
      0)
  ) - _Calc!$B$9 + _Calc!$B$10
) / _Calc!$B$8
```

**Alternatively (cleaner):** Use the `_Calc` sheet to pre-build a full
FCFF model for each scenario, then the Sensitivity cells simply
reference `_Calc!FCFFn` values with different discount factors.
This approach is preferred for maintainability.

### Recommended `_Calc` sheet structure (full FCFF columns):

```
// _Calc sheet: Rows 1-15 = inputs, Rows 20-35 = FCFF buildup
// Columns B-G = Years 0 (base) through 5

// Row 20: Revenue
B20  =Inputs!B13
C20  =B20*(1+$B$2)
D20  =C20*(1+$B$2)
E20  =D20*(1+$B$2)
F20  =E20*(1+$B$2)
G20  =F20*(1+$B$2)

// Row 21: EBITDA
C21  =C20*$B$3
D21  =D20*$B$3
E21  =E20*$B$3
F21  =F20*$B$3
G21  =G20*$B$3

// Row 22: D&A
C22  =C20*$B$4
D22  =D20*$B$4
E22  =E20*$B$4
F22  =F20*$B$4
G22  =G20*$B$4

// Row 23: NOPAT = (EBITDA - D&A)*(1-tax)
C23  =(C21-C22)*(1-$B$5)
D23  =(D21-D22)*(1-$B$5)
E23  =(E21-E22)*(1-$B$5)
F23  =(F21-F22)*(1-$B$5)
G23  =(G21-G22)*(1-$B$5)

// Row 24: CapEx
C24  =C20*$B$6
D24  =D20*$B$6
E24  =E20*$B$6
F24  =F20*$B$6
G24  =G20*$B$6

// Row 25: ΔWC
C25  =(C20-B20)*$B$7
D25  =(D20-C20)*$B$7
E25  =(E20-D20)*$B$7
F25  =(F20-E20)*$B$7
G25  =(G20-F20)*$B$7

// Row 26: FCFF
C26  =C23+C22-C24-C25
D26  =D23+D22-D24-D25
E26  =E23+E22-E24-E25
F26  =F23+F22-F24-F25
G26  =G23+G22-G24-G25
```

Then each Sensitivity cell becomes a simple discounted sum:
```excel
// Cell D7 (base WACC=$A7, base terminal growth=D$4):
=IFERROR(
  C26/(1+$A7)^1 + D26/(1+$A7)^2 + E26/(1+$A7)^3 +
  F26/(1+$A7)^4 + G26/(1+$A7)^5 +
  IF($A7>D$4, G26*(1+D$4)/($A7-D$4)/(1+$A7)^5, 0) -
  _Calc!$B$9 + _Calc!$B$10,
  0
) / _Calc!$B$8
```

### Fix 2 — Sensitivity axis headers must be real numbers, not text

```
// CURRENT (text — cannot be used in formulas):
A5 = "21.8%"   // stored as text string

// CORRECT (real numbers with % number format applied):
A5 = =Inputs!B61/100-0.04    // 0.218421... displayed as "21.8%" via format
A6 = =Inputs!B61/100-0.02
A7 = =Inputs!B61/100          // base row
A8 = =Inputs!B61/100+0.02
A9 = =Inputs!B61/100+0.04

B4 = =Inputs!B62/100-0.03    // 0.05 displayed as "5.0%"
C4 = =Inputs!B62/100-0.015
D4 = =Inputs!B62/100          // base col
E4 = =Inputs!B62/100+0.015
F4 = =Inputs!B62/100+0.03

// Apply cell format: 0.0% to all axis cells
```

### Fix 3 — Scenario prices must be live formulas

The Bear/Base/Bull scenario FCFF calculations use variable margin per year
(−1.5%/yr Bear, +2.5%/yr Bull), so they cannot share the flat-margin
`_Calc` sheet. Build separate scenario helper rows in `_Calc`:

```
// _Calc rows 40-55: BEAR scenario
// Revenue growth = Inputs!B63/100 * 0.40
// WACC = Inputs!B61/100 + 2.5/100
// Terminal g = Inputs!B62/100 * 0.75
// EBITDA margin declines -1.5pp per year

B40  =Inputs!B13                              // Base Rev
C40  =B40*(1+Inputs!B63/100*0.40)
D40  =C40*(1+Inputs!B63/100*0.40)
E40  =D40*(1+Inputs!B63/100*0.40)
F40  =E40*(1+Inputs!B63/100*0.40)
G40  =F40*(1+Inputs!B63/100*0.40)

// EBITDA with margin compression:
C41  =C40*(Inputs!B71/100-0.015*1)
D41  =D40*(Inputs!B71/100-0.015*2)
E41  =E40*(Inputs!B71/100-0.015*3)
F41  =F40*(Inputs!B71/100-0.015*4)
G41  =G40*(Inputs!B71/100-0.015*5)

// D&A, NOPAT, CapEx, ΔWC, FCFF same pattern as base but using rows 40-41
// (see _Calc rows 42-46 following same structure as rows 22-26)

// Bear FCFF:
C46  =(C41-C40*Inputs!B72/100)*(1-Inputs!B64/100)+C40*Inputs!B72/100-C40*Inputs!B73/100-(C40-B40)*Inputs!B74/100
D46  =(D41-D40*Inputs!B72/100)*(1-Inputs!B64/100)+D40*Inputs!B72/100-D40*Inputs!B73/100-(D40-C40)*Inputs!B74/100
E46  =(E41-E40*Inputs!B72/100)*(1-Inputs!B64/100)+E40*Inputs!B72/100-E40*Inputs!B73/100-(E40-D40)*Inputs!B74/100
F46  =(F41-F40*Inputs!B72/100)*(1-Inputs!B64/100)+F40*Inputs!B72/100-F40*Inputs!B73/100-(F40-E40)*Inputs!B74/100
G46  =(G41-G40*Inputs!B72/100)*(1-Inputs!B64/100)+G40*Inputs!B72/100-G40*Inputs!B73/100-(G40-F40)*Inputs!B74/100

// Bear Price formula in Sensitivity!E14:
=IFERROR(
  (C46/(1+Inputs!B61/100+0.025)^1 + D46/(1+Inputs!B61/100+0.025)^2 +
   E46/(1+Inputs!B61/100+0.025)^3 + F46/(1+Inputs!B61/100+0.025)^4 +
   G46/(1+Inputs!B61/100+0.025)^5 +
   G46*(1+Inputs!B62/100*0.75)/(Inputs!B61/100+0.025-Inputs!B62/100*0.75) /
   (1+Inputs!B61/100+0.025)^5) -
  (Inputs!B42+Inputs!B46) + Inputs!B27,
  0
) / Inputs!B8

// Base Price = 'DCF Model'!B39  (always link directly)
Sensitivity!E15  ='DCF Model'!B39

// Bull pattern: same structure, +2.5pp/yr margin expansion, WACC-2.5pp, tg*1.25
// in _Calc rows 60-66, then Sensitivity!E16 references those rows
```

---

## PART 2 — LIVE FORMULA FIXES (ALL SHEETS)

### Inputs Sheet — Replace hard-coded derived cells

```
B15  =B13-B14              // Gross Profit
B17  =B15-B16              // EBIT (Operating Income)
B22  =B17-B20-B21          // Net Income
B32  =SUM(B27:B31)         // Total Current Assets
B39  =B32+SUM(B34:B38)     // Total Assets
B44  =SUM(B41:B43)         // Total Current Liabilities
B48  =B44+B46+B47          // Total Liabilities
B50  =B39-B48              // Total Equity = Assets - Liabilities
B56  =B54-B55              // Free Cash Flow
B69  =B17+B18+B19          // EBITDA = EBIT + D&A
B70  =B42+B46              // Total Debt
B75  =B8*B9                // Market Cap
B76  =B75+B70-B27          // Enterprise Value

// WACC components block (add rows 82-93):
B83  [Rf — user input, link from Assumptions if stored elsewhere]
B84  [ERP — user input]
B85  [Beta — user input]
B86  =B83/100+B85*(B84/100)                    // Ke = 28.60%
B87  [Cost of Debt % — user input]
B89  =B87/100*(1-B64/100)                      // Kd(at) = 15.50%
B90  =B75/(B75+B70)                            // We = 78.95%
B91  =B70/(B75+B70)                            // Wd = 21.05%
B92  =B90*B86+B91*B89                          // WACC = 25.84%
B61  =B92*100                                  // WACC % (used by all sheets)
```

### DCF Model — Two remaining fixes

```
B24  =0                    // Base year ΔWC (no prior year — keep as 0, this is correct)
B26  =1                    // Base year discount factor = 1 (correct, no change needed)
B37  =B34+B35-B36          // Remove MAX(0) floor — negative equity is valid
```

### Dashboard — Weight constraint

```
C7   0.6                   // DCF weight (user-editable)
C8   =1-C7                 // Comps weight always complements to 1
```

### Z-Score — All live formulas

```
C4  =(Inputs!B32-Inputs!B44)/Inputs!B39        // X1
D4  =C4*1.2
C5  =Inputs!B50/Inputs!B39                      // X2
D5  =C5*1.4
C6  =Inputs!B17/Inputs!B39                      // X3
D6  =C6*3.3
C7  =Inputs!B75/MAX(Inputs!B48,1)               // X4
D7  =C7*0.6
C8  =Inputs!B13/Inputs!B39                      // X5
D8  =C8*1.0
D10 =SUM(D4:D8)                                 // Z-Score
D11 =IF(D10>2.99,"Safe Zone",IF(D10>1.81,"Grey Zone","Distress Zone"))
B4  ="Working Capital / Total Assets"
B5  ="Retained Earnings / Total Assets"
B6  ="EBIT / Total Assets"
B7  ="Market Cap / Total Liabilities"
B8  ="Revenue / Total Assets"
```

### DuPont — All live formulas

```
C5  =IFERROR(Inputs!B22/Inputs!B13,0)          // Net Profit Margin
C6  =IFERROR(Inputs!B13/Inputs!B39,0)          // Asset Turnover
C7  =IFERROR(Inputs!B39/MAX(Inputs!B50,1),0)   // Equity Multiplier
C8  =IFERROR(C5*C6*C7,0)                       // 3-factor ROE

// 5-factor:
C12 =IFERROR(Inputs!B22/(Inputs!B17-Inputs!B20),0)   // Tax Burden
C13 =IFERROR((Inputs!B17-Inputs!B20)/Inputs!B17,0)   // Interest Burden
C14 =IFERROR(Inputs!B17/Inputs!B13,0)                // Operating Margin
C15 =C6                                              // Asset Turnover
C16 =C7                                              // Equity Multiplier
C17 =IFERROR(C12*C13*C14*C15*C16,0)                  // 5-factor ROE
```

### DDM — All live formulas

```
B4  =IFERROR(Inputs!B57/Inputs!B8,0)           // DPS = Dividends/Shares = 2.00
B6  =Inputs!B86/100                            // Ke from WACC block = 28.60%
     // OR: =Inputs!B83/100+Inputs!B85*Inputs!B84/100
B7  =Inputs!B62/100                            // Terminal growth = 8%
B8  =Inputs!B63/100                            // High growth = 15%
B9  =Inputs!B65                               // Years = 5

// Gordon Growth:
B12 =IFERROR(B4*(1+B7)/(B6-B7),"N/A")        // 10.49 EGP

// Two-Stage DDM (Excel 2019 compatible — no LET):
B13 =IFERROR(
      B4*(1+B8)/(1+B6)^1 + B4*(1+B8)^2/(1+B6)^2 + B4*(1+B8)^3/(1+B6)^3 +
      B4*(1+B8)^4/(1+B6)^4 + B4*(1+B8)^5/(1+B6)^5 +
      B4*(1+B8)^5*(1+B7)/(B6-B7)/(1+B6)^5,
      "N/A")                                   // 13.24 EGP

// H-Model:
B14 =IFERROR(B4*(B7+(B9/2)*(B8-B7))/(B6-B7),"N/A")   // 12.18 EGP

// DDM vs DCF spread:
B15 =IFERROR(B12-'DCF Model'!B39,0)           // −33.45 EGP
```

---

## PART 3 — WORLD-CLASS DESIGN SYSTEM

Completely redesign all 10 sheets to institutional investment bank standard.
Reference: Goldman Sachs, Morgan Stanley, JPMorgan Excel model aesthetics.

### Color Palette

```javascript
// Define as named styles in the workbook:
const COLORS = {
  // Primary brand
  navyDark:    '0D1B2A',   // Deep navy — main headers
  navyMid:     '1B3A5C',   // Section headers
  navyLight:   '2E6DA4',   // Accent bars, highlights

  // Input/output distinction
  inputBlue:   'DCE6F1',   // Light blue — user input cells
  inputBorder: '4472C4',   // Blue border for input cells
  outputGray:  'F2F2F2',   // Light gray — calculated cells (read-only)
  formulaGreen:'E2EFDA',   // Light green — key formula outputs

  // Status colors
  bullGreen:   '375623',   // Dark green for positive/bull
  bullLight:   'C6EFCE',   // Light green fill
  bearRed:     'C00000',   // Dark red for negative/bear
  bearLight:   'FFC7CE',   // Light red fill
  neutralGold: 'F4B942',   // Gold for base case / neutral
  baseLight:   'FFEB9C',   // Light yellow for base

  // Text
  textDark:    '0D1B2A',   // Primary text
  textMid:     '44546A',   // Secondary text / labels
  textLight:   '808080',   // Tertiary / hints
  textWhite:   'FFFFFF',   // On dark backgrounds

  // Borders
  borderHard:  '1B3A5C',   // Section dividers
  borderSoft:  'D9E1EA',   // Row separators
  borderDotted:'BDD7EE',   // Light grid lines
}
```

### Typography Rules

```
// Section headers (row titles like "INCOME STATEMENT"):
  Font: Calibri Bold 11pt, White on navyMid (#1B3A5C)
  Row height: 20px
  Left padding: indent level 1

// Sub-headers (column headers, metric labels):
  Font: Calibri Semibold 10pt, navyDark (#0D1B2A)
  Background: outputGray (#F2F2F2)
  Bottom border: borderHard (2pt)

// Data labels (row labels like "Revenue", "EBIT"):
  Font: Calibri Regular 10pt, textMid (#44546A)
  Background: white

// Input cells (user-editable):
  Font: Calibri Regular 10pt, textDark (#0D1B2A)
  Background: inputBlue (#DCE6F1)
  Border: inputBorder (#4472C4) thin all sides
  Note: Add "✎" indicator or cell comment "User Input"

// Calculated cells:
  Font: Calibri Regular 10pt, textDark
  Background: white or outputGray
  Locked (protection): cannot be edited

// Key output cells (DCF Per Share, Blended Value, Recommendation):
  Font: Calibri Bold 12pt
  Background: formulaGreen or navyDark
  Special formatting per verdict

// Numbers:
  Large integers: #,##0 (e.g. 5,000,000,000)
  Percentages: 0.00% (e.g. 25.84%)
  Per-share: "EGP "#,##0.00 (e.g. EGP 43.93)
  Multiples: 0.00"x" (e.g. 4.07x)
  Basis points: +0.00%;-0.00% with color scale
```

### Layout Standards

```
// Every sheet must have:
1. Top banner (rows 1-3):
   - Row 1: Navy bar spanning full width, white text
     "🐺 WOLF VALUATION ENGINE | [Sheet Name] | [Company] ([Ticker])"
   - Row 2: Subheader bar (navyMid), smaller text
     "Generated: [date formula] | Currency: EGP | CAPM Method: A — Local Currency"
   - Row 3: Empty separator row (height 6px)

2. Section organization:
   - Each section separated by a full-width navy header row
   - Two-column layout: labels in col A (width 28), values in col B (width 18)
   - Wide sheets (DCF Model, Sensitivity): extend to cols G+

3. Column widths (standardize):
   Col A: 30 (labels)
   Col B: 18 (primary values)
   Col C: 18 (secondary/notes)
   Col D-G: 14 each (projections/grid)

4. Footer (last 2 rows of each sheet):
   - Thin navy bar
   - "WOLF Valuation Engine V2.7 | Confidential | For Investment Purposes Only"
```

---

## PART 4 — SHEET-BY-SHEET DESIGN SPECIFICATIONS

### Sheet 1 — Inputs

**Purpose:** Central data entry. All inputs clearly marked. No calculations visible.

```
Layout:
├── Banner (rows 1-3)
├── COMPANY INFORMATION (rows 5-10)
│   ├── Company Name, Ticker, Shares, Stock Price
│   └── Market: [dropdown Egypt/US], Currency: EGP
├── INCOME STATEMENT (rows 12-23)
│   ├── [Blue cells] Revenue, COGS, OpEx, D&A(dep), D&A(amor), Interest, Tax
│   └── [Green auto-calc] Gross Profit, EBIT, Net Income
├── BALANCE SHEET (rows 25-52)
│   ├── [Blue cells] all raw balance sheet items
│   └── [Green auto-calc] Total Current Assets, Total Assets, Total Liabilities, Equity
├── CASH FLOW STATEMENT (rows 54-60)
│   ├── [Blue cells] OCF, CapEx, Dividends Paid
│   └── [Green auto-calc] Free Cash Flow
├── VALUATION ASSUMPTIONS (rows 62-76)
│   ├── [Blue cells] Revenue Growth, EBITDA Margin, D&A%, CapEx%, WC%, Terminal Growth, Projection Years
│   └── [Blue cells] Tax Rate
├── WACC COMPONENTS (rows 78-92)
│   ├── [Blue cells] Risk-Free Rate (Rf), ERP, Beta, Cost of Debt
│   └── [Green auto-calc] Ke, Kd(after-tax), We, Wd, WACC
│   └── WACC box: large highlighted cell showing "25.84%" with navy border
├── FCFF DRIVERS (rows 94-100)
│   └── [Green auto-calc] EBITDA, Total Debt, Market Cap, EV
└── COMPARABLE COMPANIES (rows 102-115)
    ├── Peer table with headers: Company | P/E | EV/EBITDA | P/S | P/B
    ├── 5 peer rows (blue input cells)
    └── [Green auto-calc] Average/Median row
```

**Color coding legend** (add at top right, rows 5-8, cols D-E):
```
D5: "■" (blue fill)    E5: "User Input — editable"
D6: "■" (green fill)   E6: "Calculated — do not edit"
D7: "■" (navy fill)    E7: "Key Output"
```

### Sheet 2 — DCF Model

**Purpose:** Full FCFF projection. Professional model layout.

```
Layout:
├── Banner
├── KEY ASSUMPTIONS sidebar (cols A-B, rows 5-15)
│   └── [Green cells] all driver assumptions pulled from Inputs
├── FCFF PROJECTIONS (cols A-G, rows 17-28)
│   ├── Year headers: 2026(Actual) | 2027 | 2028 | 2029 | 2030 | 2031
│   ├── Row labels in col A, values in cols B-G
│   ├── Rows: Revenue, EBITDA, D&A, EBIT, NOPAT, CapEx, ΔWC, FCFF
│   ├── Separator row after FCFF
│   ├── Discount Factor row
│   └── PV of FCFF row (shaded green)
├── VALUATION BUILD-UP (rows 30-44)
│   ├── Sum PV(FCFF) ─────────────────────────── [right-aligned EGP value]
│   ├── + Terminal Value (Gordon Growth, g=8%)── [right-aligned EGP value]
│   ├── + PV of Terminal Value ──────────────── [right-aligned EGP value]
│   ├── = Enterprise Value ────────────────────── [bold, navy background]
│   ├── − Total Debt ────────────────────────── [right-aligned EGP value]
│   ├── + Cash ──────────────────────────────── [right-aligned EGP value]
│   ├── = Equity Value ───────────────────────── [bold, navy background]
│   ├── ÷ Shares Outstanding ────────────────── [right-aligned]
│   └── DCF Per Share ────────────────────────── [XL font, gold highlight]
└── UPSIDE SUMMARY (rows 46-50)
    ├── Current Price vs DCF
    └── Upside % with conditional formatting (green if positive, red if negative)
```

### Sheet 3 — Comparables

**Purpose:** Peer valuation. Clean comparison table.

```
Layout:
├── Banner
├── PEER COMPANY MULTIPLES table
│   ├── Headers: Company | P/E | EV/EBITDA | P/S | P/B | Source
│   ├── 6 peer rows (alternating white/light gray rows)
│   └── Average / Median rows (bold, navy border top)
├── BLENDING WEIGHTS (small box, right side)
│   ├── P/E: 40%, EV/EBITDA: 35%, P/S: 15%, P/B: 10%
│   └── Sum check: must = 100%
├── IMPLIED VALUATIONS table
│   ├── Headers: Method | Peer Multiple | Per Share Metric | Implied Price
│   ├── 4 rows (P/E, EV/EBITDA, P/S, P/B)
│   └── Weighted Average row (bold gold highlight)
└── COMPARISON CHART placeholder note
    "This data feeds the Football Field chart in the Engine UI"
```

### Sheet 4 — Ratios

**Purpose:** 35+ metrics, organized by category. Dashboard-style.

```
Layout (two-column grid, side by side):
LEFT COLUMN (cols A-B):
├── PROFITABILITY
│   Gross Margin, Op Margin, Net Margin, EBITDA Margin, FCF Margin
│   ROE, ROA, ROIC
├── EFFICIENCY
│   Asset Turnover, Revenue/Employee (if available)
│   DSO, DIO, DPO, CCC

RIGHT COLUMN (cols D-E):
├── VALUATION
│   P/E, EV/EBITDA, P/S, P/B, EV/Revenue
│   EPS, Book Value/Share, FCF/Share, DPS
├── FINANCIAL HEALTH
│   Current Ratio, Quick Ratio, D/E, D/EBITDA
│   Interest Coverage, Net Debt, FCF Yield, Dividend Yield

Bottom section (full width):
└── SECTOR BENCHMARKS (note row)
    "Benchmarks: EGX Sector Average — update peer data on Comparables sheet"
```

Each metric row:
- Label in col A (or D)
- Value in col B (or E) with appropriate number format
- Conditional formatting: green if above benchmark, red if below, gray if neutral

### Sheet 5 — Dashboard

**Purpose:** Executive summary. One-page view of everything that matters.

```
Layout (premium card-based design):
┌──────────────────────────────────────────────────────────────────┐
│  🐺 WOLF VALUATION ENGINE              TechCorp Industries (TECH) │
│  EQUITY VALUATION — INSTITUTIONAL GRADE                          │
│  45.00 EGP    ↗ +23.82%    ● UNDERVALUED    ✓ BUY               │
└──────────────────────────────────────────────────────────────────┘

[VALUATION METHODS]                    [KEY METRICS]
┌─────────────────────────┐           ┌─────────────────────────┐
│ Method      Price  Wt   │           │ Market Cap   4,500M EGP  │
│ ─────────────────────── │           │ Enterprise V 4,793M EGP  │
│ DCF         43.93  60%  │           │ P/E          4.07x       │
│ Comps       73.39  40%  │           │ EV/EBITDA    2.80x       │
│ ─────────────────────── │           │ Net Margin   22.12%      │
│ BLENDED     55.72       │           │ ROE          39.50%      │
│ UPSIDE     +23.82%      │           │ ROIC         36.33%      │
└─────────────────────────┘           │ Div Yield    4.44%       │
                                       └─────────────────────────┘

[SCENARIO ANALYSIS]
┌──────────────────────────────────────────────────────────────────┐
│  BEAR      19.26 EGP  (−57.2%)   Growth: 6%  WACC: 28.3%       │
│  BASE      43.93 EGP   (−2.4%)   Growth: 15% WACC: 25.8%       │
│  BULL     152.20 EGP (+238.2%)   Growth: 30% WACC: 23.3%       │
└──────────────────────────────────────────────────────────────────┘

[ANALYST ASSESSMENT]
  Verdict:        ██████████████░░░  UNDERVALUED
  Confidence:     ████████████████░  HIGH
  Z-Score:        5.39 — Safe Zone (Low Bankruptcy Risk)
  Quality Grade:  A (32/40) — +10% Quality Premium
```

All boxes use borders, fills, and font sizes to create a card-like appearance.
Key numbers (prices, upside) use large fonts (14-16pt bold).

### Sheet 6 — Sensitivity

**Purpose:** Interactive scenario matrix + scenario analysis.

```
Layout:
├── Banner
├── HOW TO READ (row 4, italic small text):
│   "Change WACC or terminal growth assumptions on the Inputs sheet.
│    This table recalculates automatically."
│
├── SENSITIVITY MATRIX (5×5 grid)
│   ├── Axis headers: WACC down col A, Terminal Growth across row 4
│   ├── All headers = live formulas (not text)
│   ├── 25 DCF cells = live formulas (no LET, Excel 2019 compatible)
│   ├── Base case cell (D7): Gold highlight, bold border, "★" indicator
│   ├── Color scale: Red (low values) → Yellow → Green (high values)
│   └── Current price line: conditional format row where value ≈ current price
│
├── BASE CELL VERIFICATION (row 11):
│   "Base case check: D7 = [value] | DCF Model = [value] | Match: ✅/❌"
│
└── SCENARIO ANALYSIS (rows 13-20)
    ├── Headers: Scenario | Rev Growth | WACC | Term Growth | Margin Adj | Price | vs Current
    ├── BEAR row: Red fill, all cells live formulas
    ├── BASE row: Gold fill, links to DCF Model!B39
    ├── BULL row: Green fill, all cells live formulas
    └── Weighted Value row: Base scenario probability-weighted price
```

### Sheet 7 — Z-Score

**Purpose:** Bankruptcy risk analysis. Visual gauge.

```
Layout:
├── Banner
├── ALTMAN Z-SCORE (1968 original model for public manufacturing companies)
│
├── COMPONENTS TABLE
│   Columns: Factor | Description | Formula | Value | Weight | Weighted Score
│   Row X1: Working Capital / Total Assets | 1.2 | [formula] | [value]
│   Row X2: Retained Earnings / Total Assets | 1.4 | [formula] | [value]
│   Row X3: EBIT / Total Assets | 3.3 | [formula] | [value]
│   Row X4: Market Cap / Total Liabilities | 0.6 | [formula] | [value]
│   Row X5: Revenue / Total Assets | 1.0 | [formula] | [value]
│   TOTAL: Z-Score = SUM(weighted) = [large bold value]
│
├── ZONE INDICATOR (visual gauge row):
│   ░░░░░░░░░░░░░░░░░████████████████████████████████████████████
│   DISTRESS   GREY                         SAFE ZONE
│   < 1.81     1.81-2.99                    > 2.99
│   [Pointer shows current Z-Score = 5.39 → Safe Zone, green]
│
├── INTERPRETATION BOX
│   "Z-Score of 5.39 places TechCorp firmly in the Safe Zone.
│    Risk of financial distress within 2 years: LOW.
│    Score exceeds the 2.99 threshold by 2.40 points."
│
└── ZONE THRESHOLDS REFERENCE TABLE
```

### Sheet 8 — DuPont

**Purpose:** ROE decomposition. Visual tree structure.

```
Layout:
├── Banner
├── 3-FACTOR DUPONT
│   Visual tree (using borders to simulate flowchart):
│
│   Net Profit Margin    Asset Turnover     Equity Multiplier
│      22.12%        ×      1.16x        ×      1.54x
│         └──────────────────┴──────────────────┘
│                            │
│                         ROE = 39.50%
│
├── 3-Factor component table with formulas
│
├── 5-FACTOR DUPONT
│   Tax Burden × Interest Burden × Op Margin × AT × EM = ROE
│    79.00%   ×    93.33%       ×  30.00%  × 1.16x × 1.54x = 39.50%
│
└── COMPARISON TO BENCHMARKS
    ROE 39.50% vs EGX Market Average [from Comparables sheet]
```

### Sheet 9 — DDM

**Purpose:** Dividend-based valuation. Clear model comparison.

```
Layout:
├── Banner
├── DDM INPUTS (left panel)
│   ├── DPS = Dividends Paid / Shares [live formula, blue highlight]
│   ├── Ke (Cost of Equity) [from WACC block]
│   ├── Terminal Growth (g) [from Inputs]
│   ├── High Growth Rate [from Inputs]
│   └── High Growth Period [from Inputs]
│
├── MODEL RESULTS (right panel, 3 cards)
│   ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   │ GORDON GROWTH   │ │  TWO-STAGE DDM  │ │   H-MODEL DDM   │
│   │                 │ │                 │ │                 │
│   │  EGP 10.49      │ │  EGP 13.24      │ │  EGP 12.18      │
│   │                 │ │                 │ │                 │
│   │ Single-stage    │ │ 5yr high-growth │ │ Linear decline  │
│   │ constant growth │ │ then terminal   │ │ to terminal     │
│   └─────────────────┘ └─────────────────┘ └─────────────────┘
│
├── DDM vs DCF COMPARISON
│   DCF Fair Value:  43.93 EGP
│   DDM Range:       10.49 – 13.24 EGP
│   Spread:          −30.69 to −33.44 EGP
│   Note: DDM undervalues growth stocks that reinvest dividends.
│         WOLF weights DCF more heavily for capital-intensive growers.
│
└── METHODOLOGY NOTE
    When to trust DDM: mature, dividend-stable companies with payout > 50%
    For TechCorp: payout ratio = 18.1% — DCF is the primary method
```

### Sheet 10 — Instructions

**Purpose:** Professional user guide. Branded and complete.

```
Layout:
├── Full-width navy header: "WOLF VALUATION ENGINE — USER GUIDE"
├── Quick Start (3 steps with numbered circles)
│   ① Enter company financials on the Inputs sheet
│   ② Review assumptions (WACC, growth rates) — adjust if needed
│   ③ Read your valuation on the Dashboard
├── Sheet Reference table
├── Formula Reference (key formulas explained)
├── Egyptian Market Notes
│   - WACC 20-35% typical (high interest environment)
│   - Terminal growth 5-10% (nominal GDP growth)
│   - EGX tickers use .CA suffix
├── Interpretation Guide
│   - Upside > 30%: STRONG BUY
│   - Upside 10-30%: BUY
│   - Upside ±10%: HOLD
│   - Downside 10-30%: SELL
│   - Downside > 30%: STRONG SELL
└── Footer: Version 2.7 | Generated by WOLF Valuation Engine
```

---

## PART 5 — DESIGN IMPLEMENTATION IN excelExport.ts

### Apply styles using ExcelJS (the library the engine uses):

```typescript
// src/utils/excelExport.ts

// ── BRAND COLORS ─────────────────────────────────────────────────
const WOLF = {
  navy:       { argb: 'FF0D1B2A' },
  navyMid:    { argb: 'FF1B3A5C' },
  navyLight:  { argb: 'FF2E6DA4' },
  inputBlue:  { argb: 'FFDCE6F1' },
  calcGreen:  { argb: 'FFE2EFDA' },
  keyOutput:  { argb: 'FFFFF2CC' },
  bullGreen:  { argb: 'FFC6EFCE' },
  bearRed:    { argb: 'FFFFC7CE' },
  baseGold:   { argb: 'FFFFEB9C' },
  white:      { argb: 'FFFFFFFF' },
  textDark:   { argb: 'FF0D1B2A' },
  textMid:    { argb: 'FF44546A' },
  borderSoft: { argb: 'FFD9E1EA' },
};

// ── REUSABLE STYLE FUNCTIONS ──────────────────────────────────────

function bannerRow(ws: Worksheet, row: number, text: string) {
  const r = ws.getRow(row);
  r.height = 24;
  const cell = ws.getCell(`A${row}`);
  cell.value = text;
  cell.font = { name: 'Calibri', size: 13, bold: true, color: WOLF.white };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: WOLF.navy };
  cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.mergeCells(`A${row}:H${row}`);
}

function sectionHeader(ws: Worksheet, row: number, text: string) {
  const cell = ws.getCell(`A${row}`);
  cell.value = text;
  cell.font = { name: 'Calibri', size: 10, bold: true, color: WOLF.white };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: WOLF.navyMid };
  ws.mergeCells(`A${row}:H${row}`);
  ws.getRow(row).height = 18;
}

function inputCell(cell: Cell, formula?: string, value?: any) {
  // Blue background = user editable
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: WOLF.inputBlue };
  cell.border = {
    top:    { style: 'thin', color: { argb: 'FF4472C4' } },
    bottom: { style: 'thin', color: { argb: 'FF4472C4' } },
    left:   { style: 'thin', color: { argb: 'FF4472C4' } },
    right:  { style: 'thin', color: { argb: 'FF4472C4' } },
  };
  if (value !== undefined) cell.value = value;
}

function calcCell(cell: Cell, formula: string) {
  // Green background = calculated, do not edit
  cell.value = { formula };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: WOLF.calcGreen };
  cell.protection = { locked: true };
}

function keyOutputCell(cell: Cell, formula: string) {
  // Gold highlight = key output
  cell.value = { formula };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: WOLF.keyOutput };
  cell.font = { name: 'Calibri', size: 12, bold: true, color: WOLF.textDark };
  cell.border = {
    top:    { style: 'medium', color: WOLF.navyMid },
    bottom: { style: 'medium', color: WOLF.navyMid },
    left:   { style: 'medium', color: WOLF.navyMid },
    right:  { style: 'medium', color: WOLF.navyMid },
  };
}

function addColorScale(ws: Worksheet, range: string) {
  // Red-Yellow-Green color scale for sensitivity matrix
  ws.addConditionalFormatting({
    ref: range,
    rules: [{
      type: 'colorScale',
      cfvo: [
        { type: 'min' },
        { type: 'percentile', value: 50 },
        { type: 'max' }
      ],
      color: [
        { argb: 'FFFFC7CE' },  // Red (low)
        { argb: 'FFFFFFEB' },  // Yellow (mid)
        { argb: 'FFC6EFCE' },  // Green (high)
      ]
    }]
  });
}
```

---

## PART 6 — COMPLETE VERIFICATION CHECKLIST

After implementation, verify these exact values open correctly in Excel 2019:

### Opening test
- [ ] File opens with NO repair dialog
- [ ] No "We found a problem" message
- [ ] All 10 sheets present and named correctly
- [ ] Banner visible on every sheet

### Formula integrity test (change Inputs!B9 from 45 to 90, verify cascade)
- [ ] Inputs!B75 (Market Cap) → 9,000,000,000
- [ ] Inputs!B61 (WACC %) → changes to reflect new capital structure
- [ ] DCF Model!B39 (DCF per share) → changes
- [ ] Sensitivity!D7 (base cell) → matches DCF Model!B39
- [ ] Dashboard!B12 (Blended) → updates
- [ ] Dashboard!B15 (Upside) → updates
- [ ] Z-Score!D10 → updates (market cap changes X4)
- Reset B9 back to 45 and verify all values return to baseline

### Baseline verification (with B9 = 45)
| Cell | Expected | Tolerance |
|------|----------|-----------|
| Inputs!B92 (WACC) | 25.84% | ±0.01% |
| DCF Model!B39 | 43.93 | ±0.01 |
| Comparables!B20 | 73.39 | ±0.01 |
| Dashboard!B12 | 55.72 | ±0.01 |
| Dashboard!B15 | 23.82% | ±0.01% |
| Sensitivity!D7 | 43.93 | ±0.01 |
| Sensitivity!B5 | 51.30 | ±0.02 |
| Sensitivity!F9 | 37.91 | ±0.02 |
| Sensitivity!B9 | 32.26 | ±0.02 |
| Sensitivity!F5 | 69.96 | ±0.02 |
| Sensitivity!E14 | 19.26 | ±0.05 |
| Sensitivity!E16 | 152.20 | ±0.10 |
| Z-Score!D10 | 5.39 | ±0.01 |
| DuPont!C8 | 39.50% | ±0.01% |
| DDM!B12 | 10.49 | ±0.01 |
| DDM!B13 | 13.24 | ±0.01 |
| DDM!B14 | 12.18 | ±0.01 |
| Ratios!B27 (ROIC) | 36.33% | ±0.01% |

### Design test
- [ ] Navy banner on every sheet
- [ ] Blue input cells on Inputs sheet
- [ ] Green calculated cells visible
- [ ] Gold highlight on DCF per share, Blended value
- [ ] Color scale on Sensitivity matrix (red→green)
- [ ] Bear row in red, Bull row in green on Scenario table
- [ ] No overlapping merged cells
- [ ] All column widths set correctly
- [ ] Print area set on Dashboard (A1:H40)

---

## IMPLEMENTATION NOTES

1. **Do not use LET(), LAMBDA(), or dynamic array functions.** Excel 2019 compatibility required.
2. **`_Calc` sheet must be hidden:** `ws.state = 'hidden'`
3. **Worksheet protection:** Lock all calculated cells, leave input cells unlocked.
4. **Print settings:** Dashboard set as default print sheet, A4 landscape, fit to 1 page.
5. **File validation:** After building, open with `openpyxl` to verify no formulas wrote as plain values.
6. **The formula for Two-Stage DDM** — expanded year-by-year is preferred over geometric series to avoid floating point issues in Excel.

---

*WOLF Valuation Engine — World-Class Excel Rebuild Prompt — V2.7*
*Verified reference values: DCF=43.93 · Blended=55.72 · WACC=25.84% · Bear=19.26 · Bull=152.20*
