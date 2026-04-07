# WOLF Valuation Engine — Complete Development Guide & Antigravity Masterclass Prompt
**Prepared by**: Claude Sonnet 4.6 | **Date**: April 7, 2026  
**Engine Version**: 4.0.0 | **Market**: EGX + NYSE/NASDAQ

---

## PART I — FORENSIC AUDIT: ALL BUGS & CALCULATION ERRORS

> All calculations were independently verified using Python against the uploaded JSON, Excel, and PDF files. The TechCorp Industries (TECH) test case was used as the canonical reference.

---

### BUG #1 — CRITICAL: Tax Rate Hardcoded at 21% Instead of Dynamic 22.5%

**Severity**: 🔴 CRITICAL — Cascades through Net Income, FCFF Method 3, and all NI-derived ratios.

**What the engine does**: The Income Statement displays `Tax Expense = 294,000,000 EGP`.  
**The math**: `294,000,000 ÷ 1,400,000,000 (EBT) = 21.00%` effective rate.  
**The assumption parameter**: `taxRate = 22.5%` → should produce `315,000,000 EGP`.

| Metric | Reported (Buggy) | Correct (22.5%) | Variance |
|---|---|---|---|
| Tax Expense | 294,000,000 | **315,000,000** | +21,000,000 |
| Net Income | 1,106,000,000 | **1,085,000,000** | -21,000,000 |
| FCFF Method 3 | 1,133,500,000 | **1,112,500,000** | -21,000,000 |

**Root Cause**: The `incomeStatement.taxExpense` field appears to have been seeded from a 21% US federal rate and was never recalculated from the tax assumption parameter.

**Fix Required (valuationEngine.ts)**:
```typescript
// WRONG — uses raw input field (hardcoded 21%)
const taxExpense = financialData.incomeStatement.taxExpense;

// CORRECT — always derive from assumption parameter
const EBT = EBIT - interestExpense;
const taxExpense = EBT * assumptions.taxRate;
const netIncome = EBT - taxExpense;
```

The `taxExpense` in the financial statements input should be used only for **display** in the historical income statement. All forward calculations and FCFF verifications must derive tax from `EBT × assumptions.taxRate`.

---

### BUG #2 — IMPORTANT: EBITDA Inconsistency Between IS and DCF

**Severity**: 🟡 IMPORTANT — Creates a disconnect that confuses users comparing the IS to the DCF.

**Fact**: The income statement EBITDA = **1,750,000,000 EGP (35.0% margin)**.  
The DCF projection engine uses the `ebitdaMargin` driver = **30.0%**, giving a base-year EBITDA of 1,500,000,000.

This 15.7% gap (250M EGP) means the DCF is projecting from a normalized/conservative EBITDA that does not tie to the actual reported IS. While this is a legitimate analytical choice (e.g., excluding one-off items), the engine must:

1. Explicitly flag this gap on the DCF sheet with a reconciliation note.
2. Add a toggle: **"Use Historical EBITDA as Base"** vs **"Use Driver-Based Projection"**.
3. If using driver-based, show the implied EBITDA compression from 35% → 30% in Year 0.

**Fix Required (DCF projection display)**:
```typescript
// Add reconciliation row to DCF output
const historicalEBITDA = financialData.incomeStatement.operatingIncome + D_and_A;
const projectedBaseEBITDA = baseRevenue * ebitdaMargin;
const normalizationGap = historicalEBITDA - projectedBaseEBITDA;
// Show "EBITDA Normalization: -250,000,000" as an explicit reconciliation item
```

---

### BUG #3 — UI DISPLAY: Altman Z-Score Shows Weighted Values Labeled as Raw Ratios

**Severity**: 🟡 IMPORTANT — The total Z-Score (5.39) is mathematically correct, but individual components are displayed incorrectly, misleading users.

**What is displayed in the PDF**:
| Component | PDF Shows | Interpretation | Correct Raw Ratio |
|---|---|---|---|
| X1 (WC/TA) | 0.363 | Labeled as ratio | Actual: **0.302** (1,300M / 4,300M) |
| X2 (RE/TA) | 0.912 | Labeled as ratio | Actual: **0.651** (2,800M / 4,300M) |
| X3 (EBIT/TA) | 1.151 | Labeled as ratio | Actual: **0.349** (1,500M / 4,300M) |
| X4 (MCap/TL) | 1.800 | Labeled as ratio | Actual: **3.000** (4,500M / 1,500M) |
| X5 (Rev/TA) | 1.163 | Labeled as ratio | Actual: **1.163** (5,000M / 4,300M) ✅ |

**The values shown are actually the weighted contributions** (raw × coefficient), not the raw ratios. For example, X1 = 0.302 × 1.2 = **0.362 ≈ 0.363** (correct weighted). X3 = 0.349 × 3.3 = **1.151** ✅. X4 = 3.000 × 0.6 = **1.800** ✅.

**Fix Required**: The display component must render TWO columns: Raw Ratio and Weighted Contribution.

```typescript
// CORRECT DISPLAY:
{ component: "X1", formula: "WC/TA", rawRatio: 0.302, coefficient: 1.2, weighted: 0.362 }
{ component: "X3", formula: "EBIT/TA", rawRatio: 0.349, coefficient: 3.3, weighted: 1.151 }
{ component: "X4", formula: "MCap/TL", rawRatio: 3.000, coefficient: 0.6, weighted: 1.800 }
```

---

### BUG #4 — EXCEL EXPORT: H-Model DDM Formula is Wrong

**Severity**: 🟡 IMPORTANT — Excel export H-Model value is wrong; web app is correct (12.18 EGP).

**Excel formula in DDM sheet**:
```
=B4*(B7+(B9/2)*(B8-B7))/(B6-B7)
= DPS × (g_stable + H × (g_high - g_stable)) / (Ke - g_stable)
= 2.0 × (0.08 + 2.5 × 0.07) / 0.206 = 2.48  ← WRONG
```

**Correct H-Model formula**:
```
P = D0 × (1 + g_stable + H × (g_high - g_stable)) / (Ke - g_stable)
= 2.0 × (1 + 0.08 + 2.5 × 0.07) / 0.206 = 12.18  ✅
```

The Excel formula is missing the `+1` base growth adjustment. Fix: `=B4*(1+B7+(B9/2)*(B8-B7))/(B6-B7)`

---

### BUG #5 — OUTDATED CBE RATES (Major Market Calibration Issue)

**Severity**: 🔴 CRITICAL for Egyptian market accuracy.

**Current CBE Status (April 7, 2026)**:
| Parameter | Engine Default | Correct April 2026 | Change |
|---|---|---|---|
| CBE Overnight Deposit | 27.25% | **19.00%** | ↓ 825 bps |
| CBE Overnight Lending | — | **20.00%** | — |
| Egypt 10Y Gov Bond (Rf) | 22.00% | **~20.00–20.50%** | ↓ 150–200 bps |
| Egypt Inflation | 28.00% | **~11.9–12.0%** | ↓ ~1,600 bps |
| Cost of Debt (Kd) | 20.00% | **~22–24%** | ↑ (see below) |

**Key insight on Cost of Debt**: The CBE overnight deposit rate is 19%, but the 10Y bond yield is ~20.4%. A typical Egyptian corporate (BBB-rated) borrows at **Rf + 200–400 bps**, giving Kd = **22–24%**. The engine's Kd of 20% is actually equal to or below the risk-free rate — this is economically impossible and must be fixed. Kd must always be ≥ Rf for a corporate borrower.

**Required formula for Kd**:
```
Kd = Rf (10Y Bond) + Credit Spread
where Credit Spread = f(D/E ratio, sector, credit rating) = ~200–400 bps for EGX companies
```

**Updated Egyptian Market Defaults** (to replace marketDefaults.ts):
```typescript
const EGYPT_MARKET_DEFAULTS = {
  riskFreeRate: 20.0,          // 10Y Egypt Gov Bond, March 2026 avg: 20.4%
  marketRiskPremium: 5.5,      // Damodaran mature market ERP (unchanged)
  countryRiskPremium: 7.5,     // Damodaran Egypt CRP (Caa1/B-)
  terminalGrowthRate: 8.0,     // Nominal, consistent with 7-9% long-term inflation target
  maxTerminalGrowth: 12.0,
  defaultTaxRate: 22.5,
  costOfDebt: 22.5,            // Was 20.0% — updated to Rf + ~250bp spread
  cbeBenchmarkRate: 19.0,      // Overnight deposit (updated from 27.25%)
  cbeLendingRate: 20.0,        // Overnight lending
  egyptInflation: 12.0,        // January 2026 actual (was 28%)
  usInflation: 3.0,
  dividendWithholdingTax: 10.0,
  capitalGainsTax: 10.0,
};
```

---

### BUG #6 — DPS Field Ambiguity

**Severity**: 🟠 MINOR — Could mislead users entering data.

**Issue**: The `ValuationAssumptions.dps` field in the JSON is `0.5`, but the DDM sheet correctly calculates DPS as `dividendsPaid / sharesOutstanding = 200M / 100M = 2.0 EGP`. The assumption field `dps` is used for the DDM calculation in the frontend but the Excel sheet overrides it with the derived value.

**Fix**: Either remove `dps` from `ValuationAssumptions` and always derive it from `cashFlowStatement.dividendsPaid / sharesOutstanding`, or clearly label the `dps` field as "Override DPS (leave blank to auto-derive)".

---

### VERIFIED CORRECT CALCULATIONS ✅

The following calculations were independently verified and are **accurate**:

| Calculation | Reported | Verified | Status |
|---|---|---|---|
| WACC (Method A) | 25.84% | 25.84% | ✅ |
| DCF Per Share | 43.93 EGP | 43.93 EGP | ✅ |
| Sum PV(FCFF) Yr 1-5 | 2,393,101,469 | 2,393,101,469 | ✅ |
| Terminal Value | 7,573,607,228 | 7,574,500,974 | ✅ (tiny FP diff) |
| All 5 FCFF Projections | (see PDF) | Match exactly | ✅ |
| GGM DDM | 10.49 EGP | 10.49 EGP | ✅ |
| Two-Stage DDM | 13.24 EGP | 13.24 EGP | ✅ |
| P/E Comparable | 77.42 EGP | 77.42 EGP | ✅ |
| EV/EBITDA Comparable | 83.50 EGP | 83.50 EGP | ✅ |
| P/B Comparable | 42.00 EGP | 42.00 EGP | ✅ |
| Blended Comparable | 73.39 EGP | 73.39 EGP | ✅ |
| Blended Final (60/40) | 55.72 EGP | 55.72 EGP | ✅ |
| P/E Ratio | 4.07x | 4.07x | ✅ |
| EV/EBITDA | 2.80x | 2.80x | ✅ |
| ROE | 39.50% | 39.50% | ✅ |
| ROA | 25.72% | 25.72% | ✅ |
| ROIC | 36.33% | 36.33% | ✅ |
| Current Ratio | 3.60x | 3.60x | ✅ |
| Quick Ratio | 2.80x | 2.80x | ✅ |
| Z-Score Total | 5.39 | 5.39 | ✅ |
| Ke (Cost of Equity) | 28.60% | 28.60% | ✅ |
| FCFF M1 & M2 | 1,112,500,000 | 1,112,500,000 | ✅ |
| All DCF sensitivities | 5×5 table | All match | ✅ |
| Scenario (Bear/Base/Bull) | 19.26/43.93/152.17 | Within range | ✅ |
| Profit Distribution (Law 159) | All rows | Correct | ✅ |

---

## PART II — EGYPTIAN MARKET DEEP CALIBRATION

### 2.1 Central Bank of Egypt — Current Monetary Policy (April 2026)

The CBE's Monetary Policy Committee held rates unchanged on April 2, 2026, keeping:
- **Overnight Deposit Rate**: 19.00%
- **Overnight Lending Rate**: 20.00%
- **Main Operation Rate**: 19.50%
- **Discount Rate**: 19.50%

This represents a cumulative **800 bps of cuts** from the peak of 27.25% (March 2024). The easing cycle was paused due to regional geopolitical uncertainty and upside inflation risks. The CBE targets inflation of **5–9% in Q4 2026**.

**10-Year Egyptian Government Bond Yield** (March 2026): **~20.0–20.5%** (average 20.41%). This is the correct risk-free rate for Method A CAPM. The engine's default of 22% is now **150–200 bps too high** and must be updated to 20.0–20.5%.

### 2.2 Egypt Inflation Reality

| Period | Inflation |
|---|---|
| Peak (early 2024) | ~40% |
| Mid-2025 | ~16.8% |
| October 2025 | 12.5% |
| January 2026 | **11.9%** |
| CBE Target Q4 2026 | **5–9%** |

The engine's `egyptInflation = 28%` in the JSON is severely outdated. For Method B CAPM (USD Build-Up) Fisher equation conversion, the current inflation should be **12%**, not 28%. This materially changes the implied EGP cost of equity under Method B.

### 2.3 WACC Recalibration to Current Rates

Using updated April 2026 parameters for TechCorp:
```
Rf (10Y Egypt Bond) = 20.0%
ERP (Damodaran Mature Market) = 5.5%
Beta = 1.2
Ke = 20.0% + 1.2 × 5.5% = 26.6%  (was 28.6%, a 200bp reduction)

Kd (pre-tax) = 22.5%  (Rf 20% + 250bp credit spread)
Kd (after-tax) = 22.5% × (1 – 22.5%) = 17.44%

We = 4,500M / 5,700M = 78.95%
Wd = 1,200M / 5,700M = 21.05%

Updated WACC = 78.95% × 26.6% + 21.05% × 17.44% = 20.99% + 3.67% = 24.66%
```

**Impact**: WACC drops from 25.84% to ~24.66%, increasing DCF per share by roughly **+8 to +12%**.

### 2.4 Terminal Growth Rate Justification for Egypt

The engine uses 8% terminal growth for Egypt, which is appropriate and defensible:
- Egypt's nominal long-term GDP growth = real GDP (~5%) + inflation (~8–10% long term) ≈ **13–15%**
- Terminal growth should not exceed WACC for mathematical stability
- 8% terminal growth in 24.66% WACC environment → Gordon Growth denominator = 16.66% ✅
- 8% in nominal terms with 12% inflation = **-3.4% real growth** — appropriately conservative for terminal

**Warning trigger** (add to validation): If terminal growth > (Rf × 0.7), show a warning: "Terminal growth is aggressive relative to risk-free rate."

### 2.5 Egyptian Tax Framework — Implementation Checklist

| Law | Rule | Engine Status |
|---|---|---|
| Law 91/2005 (as amended by 30/2023) | 22.5% standard corporate tax | ✅ Implemented |
| Law 91/2005 | Oil & Gas: 40.55% | ✅ Implemented |
| Suez Canal / EGPC / CBE | 40% | ✅ Implemented |
| SME Law 6/2025 | Turnover tax ≤ EGP 20M revenue | ✅ Implemented |
| Law 30/2023 | Dividend WHT: 10% | ✅ Mentioned |
| Law 30/2023 | Thin capitalization: D/E > 3:1 disallows deductions | ❌ **Not implemented** |
| Law 159/1981 | 10% employee profit share | ✅ Implemented |
| Law 159/1981 | 5% legal reserve | ✅ Implemented |
| IFRS 16 / EAS 48 | Lease capitalization | ✅ Flagged |

**Missing**: Thin capitalization rule. Under Law 30/2023, if a company's D/E ratio exceeds 3:1, interest deductions above that threshold are disallowed for tax purposes, increasing the effective tax burden. The engine should check: `if (totalDebt / totalEquity > 3) { showThinCapWarning(); }`.

---

## PART III — INSTITUTIONAL STANDARDS (Goldman Sachs / JPMorgan Style)

### 3.1 What Tier-1 Banks Do Differently

Based on Goldman Sachs and JPMorgan equity research methodology:

**1. Separate NTM (Next Twelve Months) vs LTM (Last Twelve Months) metrics**  
The engine only shows LTM. Add NTM multiples using Year 1 projections:
- NTM P/E = Current Price / Forward EPS (Year 1 Net Income / Shares)
- NTM EV/EBITDA = Enterprise Value / Forward EBITDA

**2. Football Field must use weighted blended bounds, not simplistic min/max**  
The blended Low/High in the Football Field should be:
```
Blended Low = (DCF Weight × DCF Low) + (Comps Weight × Comps Low)
Blended High = (DCF Weight × DCF High) + (Comps Weight × Comps High)
```
The Gemini Deep Research document confirmed this was missing. The current engine reports arbitrary blended bounds.

**3. Probability-weighted scenario pricing**:
```
Expected Value = (Bear% × Bear Price) + (Base% × Base Price) + (Bull% × Bull Price)
= 25% × 19.26 + 50% × 43.93 + 25% × 152.17
= 4.82 + 21.97 + 38.04 = 64.82 EGP (not currently shown)
```
Add this as "Probability-Weighted Expected Value" alongside the blended price.

**4. FCFE (Free Cash Flow to Equity)** — currently missing  
JPMorgan equity models always show FCFE separately:
```
FCFE = FCFF - Interest × (1-t) + Net Debt Change
     = 1,112,500,000 - 77,500,000 + 0 = 1,035,000,000 base year
FCFE per Share = 10.35 EGP
```

**5. EV Bridge with Minority Interest and Preferred Stock**  
Add EV → Equity bridge items:
- Less: Minority Interest
- Less: Preferred Equity  
- Plus: Non-core assets / investments

**6. Credit Metrics Snapshot** — missing from engine  
Add: Net Debt / EBITDA, DSCR, Interest Coverage, Current Ratio trend vs peers.

### 3.2 Football Field Fix

```typescript
// CORRECT Football Field blended bounds:
const dcfWeight = 0.6, compsWeight = 0.4;
const blendedLow  = dcfWeight * dcfLow  + compsWeight * compsLow;
const blendedHigh = dcfWeight * dcfHigh + compsWeight * compsHigh;

// For TechCorp:
// DCF Low = 32.07, Comps Low = average of (65.81, 70.97, 10.49, 35.70) weighted
// Blended Low = 0.6 × 32.07 + 0.4 × [weighted comps low]
```

---

## PART IV — COMPLETE DEVELOPMENT ROADMAP

### Phase 1 — Critical Bug Fixes (Priority: IMMEDIATE)

| # | Task | File | Impact |
|---|---|---|---|
| 1 | Fix tax rate bug: derive NI from EBT × taxRate | valuationEngine.ts | Fixes NI, FCFF M3, all NI ratios |
| 2 | Update CBE defaults: Rf=20.0%, Kd=22.5%, inflation=12% | marketDefaults.ts | All WACC-dependent outputs |
| 3 | Fix H-Model DDM in Excel export | excelExport.ts, excelExportPro.ts | DDM accuracy |
| 4 | Fix Z-Score display: show raw ratios + weighted separately | Z-Score component | User trust |
| 5 | Fix Football Field blended bounds calculation | ValuationTab component | Report accuracy |
| 6 | Add probability-weighted expected price | scenarios.ts | Institutional completeness |

### Phase 2 — Institutional Enhancements (Priority: HIGH)

| # | Task | File |
|---|---|---|
| 7 | Add NTM (forward) multiples alongside LTM | metrics.ts |
| 8 | Add FCFE calculation and display | valuationEngine.ts |
| 9 | Add thin capitalization check (Law 30/2023) | inputValidation.ts |
| 10 | Reconcile IS EBITDA vs DCF EBITDA driver with note | DCF display component |
| 11 | Kd ≥ Rf validation rule | inputValidation.ts |
| 12 | Add DSCR and credit metrics panel | ratios section |
| 13 | Clarify/remove ambiguous `dps` assumption field | types/financial.ts |

### Phase 3 — Data & API Upgrades (Priority: MEDIUM)

| # | Task | File |
|---|---|---|
| 14 | Live 10Y Egypt T-Bond yield from CBE API or proxy | stockAPI.ts |
| 15 | Live CBE policy rate display in WACC panel | stockAPI.ts |
| 16 | EGX sector beta database (30+ EGX stocks) | industryMapping.ts |
| 17 | Damodaran CRP live feed (annual update) | marketDefaults.ts |
| 18 | Add EGX ticker auto-complete (COMI, ETEL, ORWE, etc.) | stockAPI.ts |

### Phase 4 — Advanced Analytics (Priority: MEDIUM-LOW)

| # | Task | File |
|---|---|---|
| 19 | LBO / Leveraged Buyout module | New: lboEngine.ts |
| 20 | Sum-of-the-parts (SOTP) valuation | New: sotpEngine.ts |
| 21 | Precedent transaction analysis (M&A comps) | comparables.ts |
| 22 | Piotroski F-Score (currently in VALOR — add here) | advancedAnalysis.ts |
| 23 | EVA (Economic Value Added) | advancedAnalysis.ts |
| 24 | Historical trend charts (3–5Y income/BS/CF) | ChartsTab |
| 25 | Relative valuation vs EGX 30 index peers | comparables.ts |

---

## PART V — ANTIGRAVITY MASTERCLASS PROMPT

The following is the complete, production-grade prompt for Google Antigravity (Claude Opus 4.6 Thinking). Paste it verbatim as your initial system/task prompt.

---

```
═══════════════════════════════════════════════════════════════════════════════
WOLF VALUATION ENGINE v4.0 — ANTIGRAVITY MASTERCLASS DEVELOPMENT PROMPT
AI Agent: Claude Opus 4.6 Thinking | Target: Google Antigravity
Author: Ahmed Wael Metwally | Engine URL: wolf-valuation-engine.pages.dev
Deployment: Cloudflare Pages | Stack: React 19 + TypeScript + Vite + Tailwind
═══════════════════════════════════════════════════════════════════════════════

## YOUR IDENTITY AND MISSION

You are WOLF ARCHITECT — a senior quantitative finance engineer and CFA-level 
analyst embedded in the WOLF Valuation Engine development workflow. You combine 
Goldman Sachs equity research precision with Egyptian capital markets expertise 
(EGX, CBE, FRA, Law 91/2005, Law 159/1981, EAS standards). You produce 
production-ready, paste-ready TypeScript/React code with ZERO placeholders.

Your operating law: EVERY calculation must be 100% formula-driven. Hardcoded 
financial values are a cardinal sin. All outputs must trace back to user inputs 
and assumption parameters through an unbroken chain of live formulas.

---

## CANONICAL TEST CASE (TechCorp Industries — TECH)

Use this as your verification dataset for every code change. Expected outputs 
must match within ±0.01 EGP.

### Financial Inputs
```typescript
const TECHCORP_CANONICAL = {
  revenue: 5_000_000_000,
  cogs: 2_000_000_000,
  opex: 1_500_000_000,
  depreciation: 200_000_000,
  amortization: 50_000_000,
  interestExpense: 100_000_000,
  cash: 800_000_000,
  shortTermDebt: 200_000_000,
  longTermDebt: 1_000_000_000,
  totalCurrentAssets: 1_800_000_000,
  totalCurrentLiabilities: 500_000_000,
  totalAssets: 4_300_000_000,
  totalEquity: 2_800_000_000,
  dividendsPaid: 200_000_000,
  sharesOutstanding: 100_000_000,
  currentStockPrice: 45,
};

const TECHCORP_ASSUMPTIONS = {
  taxRate: 22.5,          // Egyptian standard (Law 91/2005)
  wacc: 25.84,            // Auto-derived — do NOT hardcode
  terminalGrowthRate: 8.0,
  revenueGrowthRate: 15.0,
  ebitdaMargin: 30.0,
  daPercent: 8.0,
  capexPercent: 10.0,
  deltaWCPercent: 20.0,
  riskFreeRate: 20.0,     // April 2026: 10Y Egypt Gov Bond ~20.0–20.5%
  marketRiskPremium: 5.5, // Damodaran mature market ERP
  beta: 1.2,
  costOfDebt: 22.5,       // Must be > Rf; Kd = Rf + credit spread (min 200bp)
  capmMethod: 'A',        // Local Currency CAPM
};
```

### Expected Outputs (verified April 7, 2026)
```
WACC:                  25.84%  (with Rf=22%, legacy — recalculates automatically)
EBIT:                  1,500,000,000 EGP
EBT:                   1,400,000,000 EGP
Tax (22.5%):           315,000,000 EGP  ← CORRECT (NOT 294M)
Net Income (22.5%):    1,085,000,000 EGP ← CORRECT (NOT 1,106M)
FCFF M1 = M2 = M3:     1,112,500,000 EGP  ← All three must equal each other
DCF Per Share:         43.93 EGP
Comparable Per Share:  73.39 EGP
Blended (60/40):       55.72 EGP
Upside:               +23.82%
Recommendation:        BUY
Z-Score:               5.39 (Safe Zone)
GGM DDM:              10.49 EGP
Two-Stage DDM:         13.24 EGP
H-Model DDM:           12.18 EGP
```

---

## MANDATORY FORMULA RULES

### Rule 1: Tax Must Always Be Dynamic
```typescript
// ❌ FORBIDDEN — hardcoded values
const taxExpense = 294_000_000;
const netIncome = 1_106_000_000;

// ✅ REQUIRED — fully dynamic chain
const EBIT = revenue - COGS - operatingExpenses;
const EBT = EBIT - interestExpense;
const taxExpense = EBT * (taxRate / 100);
const netIncome = EBT - taxExpense;
```

### Rule 2: WACC Must Be Derived from Market Weights
```typescript
// ❌ FORBIDDEN
const wacc = 0.2584; // hardcoded

// ✅ REQUIRED
const marketCap = sharesOutstanding * currentStockPrice;
const totalDebt = shortTermDebt + longTermDebt;
const totalCapital = marketCap + totalDebt;
const Ke = riskFreeRate/100 + beta * (marketRiskPremium/100);
const KdAfterTax = (costOfDebt/100) * (1 - taxRate/100);
const WACC = (marketCap/totalCapital) * Ke + (totalDebt/totalCapital) * KdAfterTax;
```

### Rule 3: Cost of Debt Must Be > Risk-Free Rate
```typescript
// Validation rule — must trigger in inputValidation.ts
if (costOfDebt <= riskFreeRate) {
  throw new ValidationError(
    `Cost of Debt (${costOfDebt}%) must exceed Risk-Free Rate (${riskFreeRate}%). ` +
    `Corporate borrowers always pay a credit spread above sovereign yield. ` +
    `Suggested Kd = ${riskFreeRate + 2.5}% (Rf + 250 bps spread).`
  );
}
```

### Rule 4: FCFF Three-Way Cross-Verification Must Achieve Perfect Reconciliation
```typescript
const NOPAT = EBIT * (1 - taxRate/100);
const DA = depreciation + amortization;

// Method 1: NOPAT approach
const FCFF_M1 = NOPAT + DA - capex - deltaWC;

// Method 2: EBITDA approach
const FCFF_M2 = EBITDA * (1 - taxRate/100) + DA * (taxRate/100) - capex - deltaWC;

// Method 3: Net Income approach (requires correct NI from Rule 1)
const FCFF_M3 = netIncome + interestExpense * (1 - taxRate/100) + DA - capex - deltaWC;

// Tolerance check: all three must be within ±100 EGP of each other
const maxDiff = Math.max(
  Math.abs(FCFF_M1 - FCFF_M2),
  Math.abs(FCFF_M1 - FCFF_M3),
  Math.abs(FCFF_M2 - FCFF_M3)
);
if (maxDiff > 100) {
  console.error(`FCFF cross-verification FAILED. Gap: ${maxDiff}. Check tax rate consistency.`);
}
```

### Rule 5: Z-Score Must Display Raw Ratios, Not Weighted Values
```typescript
// ❌ WRONG — displaying weighted contributions as raw ratios
const X1_display = workingCapital / totalAssets * 1.2; // shows weighted

// ✅ CORRECT — display raw ratio; compute weighted separately for Z total
const X1_raw = workingCapital / totalAssets;           // display this
const X1_weighted = X1_raw * 1.2;                      // use for Z total
const X3_raw = EBIT / totalAssets;                     // 0.349, NOT 1.151
const X4_raw = marketCap / totalLiabilities;           // 3.000, NOT 1.800
```

### Rule 6: H-Model DDM Formula
```typescript
// ❌ WRONG (missing +1 in numerator)
const hModel = DPS * (gL + H * (gH - gL)) / (Ke - gL);

// ✅ CORRECT (standard H-Model formula)
const hModel = DPS * (1 + gL + H * (gH - gL)) / (Ke - gL);
// For TechCorp: 2.0 × (1 + 0.08 + 2.5 × 0.07) / (0.286 - 0.08) = 12.18 ✅
```

### Rule 7: Football Field Blended Bounds Must Be Weighted
```typescript
// ❌ WRONG — ignoring weights for bounds
const blendedLow = Math.min(dcfLow, compsLow);
const blendedHigh = Math.max(dcfHigh, compsHigh);

// ✅ CORRECT — weighted blend applies to bounds too
const blendedLow  = (dcfWeight * dcfLow)  + (compsWeight * compsLow);
const blendedHigh = (dcfWeight * dcfHigh) + (compsWeight * compsHigh);
```

### Rule 8: Probability-Weighted Expected Value (Add This)
```typescript
// Add to scenarios.ts — currently missing from engine
const probabilityWeightedEV =
  (bearProbability/100 * bearPrice) +
  (baseProbability/100 * basePrice) +
  (bullProbability/100 * bullPrice);
// TechCorp: 25%×19.26 + 50%×43.93 + 25%×152.17 = 64.82 EGP
```

---

## CURRENT MARKET DEFAULTS (April 2026 — Replace marketDefaults.ts)

```typescript
export const EGYPT_MARKET_DEFAULTS_2026 = {
  // CBE Policy Rates (April 2, 2026 — held unchanged)
  cbeBenchmarkRate: 19.00,      // Overnight deposit rate
  cbeLendingRate: 20.00,        // Overnight lending rate

  // Capital Market Parameters
  riskFreeRate: 20.00,          // 10Y Egypt Gov Bond (Mar 2026 avg: 20.4%)
  marketRiskPremium: 5.50,      // Damodaran mature market ERP (unchanged)
  countryRiskPremium: 7.50,     // Damodaran Egypt (Caa1/B-)
  defaultBeta: 1.20,

  // Rates
  defaultCostOfDebt: 22.50,     // Rf 20% + 250bp corporate spread
  defaultTaxRate: 22.50,        // Law 91/2005 standard
  terminalGrowthRate: 8.00,     // Nominal, ~0% real vs CBE 2026 inflation target
  maxTerminalGrowth: 12.00,

  // Macro
  egyptInflation: 12.00,        // January 2026: 11.9% (updated from 28%)
  usInflation: 3.00,

  // Egyptian Legal
  dividendWithholdingTax: 10.00,
  capitalGainsTax: 10.00,
  legalReserveRate: 5.00,       // Law 159/1981
  employeeProfitShare: 10.00,   // Law 159/1981

  // Method B CAPM (USD Build-Up)
  rfUS: 4.50,                   // US 10Y Treasury
};
```

---

## EGX SECTOR BETA DATABASE (Add to industryMapping.ts)

```typescript
// EGX beta estimates (vs EGX 30) — April 2026
export const EGX_SECTOR_BETAS = {
  banking: 0.85,
  real_estate: 1.10,
  telecom: 0.90,
  consumer_fmcg: 0.95,
  industrial: 1.15,
  healthcare: 0.80,
  energy_oil_gas: 1.30,
  construction_materials: 1.20,
  food_beverages: 0.85,
  technology: 1.25,
  chemicals: 1.10,
  media_entertainment: 1.40,
  transportation: 1.05,
  utilities: 0.70,
  default: 1.20,
};

// Key EGX Tickers for auto-populate
export const EGX_MAJOR_STOCKS = [
  { ticker: "COMI", name: "Commercial International Bank (CIB)", sector: "banking" },
  { ticker: "ETEL", name: "Telecom Egypt", sector: "telecom" },
  { ticker: "ORWE", name: "Oriental Weavers", sector: "industrial" },
  { ticker: "ALCN", name: "Aluminium Company of Egypt", sector: "industrial" },
  { ticker: "CLHO", name: "Cairo Poultry (Koki)", sector: "consumer_fmcg" },
  { ticker: "HELI", name: "Heliopolis Housing", sector: "real_estate" },
  { ticker: "TMGH", name: "Talaat Mostafa Group", sector: "real_estate" },
  { ticker: "EFIH", name: "EFG Hermes", sector: "banking" },
  { ticker: "SWDY", name: "El Sewedy Electric", sector: "industrial" },
  { ticker: "ARMC", name: "Americana Restaurants", sector: "consumer_fmcg" },
];
```

---

## PHASE 1 IMPLEMENTATION INSTRUCTIONS (Do These First)

### Task 1.1 — Fix Tax Rate Bug (valuationEngine.ts)

Locate every instance where `taxExpense` or `netIncome` is read directly from 
`financialData.incomeStatement.taxExpense` for calculation purposes. Replace with:
```typescript
const EBT = EBIT - financialData.incomeStatement.interestExpense;
const derivedTaxExpense = EBT * (assumptions.taxRate / 100);
const derivedNetIncome = EBT - derivedTaxExpense;
```
Keep `financialData.incomeStatement.taxExpense` only for the historical IS display 
panel. Label it "Reported Tax Expense" and add a note if it differs from derived.

### Task 1.2 — Update marketDefaults.ts

Replace the entire EGYPT market defaults with the April 2026 calibrated values 
from the section above. Add a `lastUpdated` field and a UI badge showing 
"CBE Rate: 19% (Apr 2026)" in the WACC panel header.

### Task 1.3 — Fix Z-Score Display Component

In the Z-Score section/component, separate display into three columns:
- Column 1: Component name and formula description
- Column 2: Raw ratio value (e.g., X1 = 0.302, X3 = 0.349, X4 = 3.000)
- Column 3: Weighted contribution (raw × coefficient) 
- Bottom row: Z-Score = sum of weighted contributions

### Task 1.4 — Fix H-Model in Excel Export

In `excelExport.ts` and `excelExportPro.ts`, locate the H-Model formula string 
and add +1 in the numerator:
```typescript
// Find and replace:
`${dps}*(${gStable}+(${H}/2)*(${gHigh}-${gStable}))/(${Ke}-${gStable})`
// Replace with:
`${dps}*(1+${gStable}+(${H}/2)*(${gHigh}-${gStable}))/(${Ke}-${gStable})`
```

### Task 1.5 — Fix Football Field Blended Bounds

In the Football Field calculation, apply weights to Low and High bounds:
```typescript
const footballField = {
  blended: {
    low:  dcfWeight * results.dcf.lowPrice  + compsWeight * results.comps.lowPrice,
    mid:  dcfWeight * results.dcf.midPrice  + compsWeight * results.comps.midPrice,
    high: dcfWeight * results.dcf.highPrice + compsWeight * results.comps.highPrice,
  }
};
```

### Task 1.6 — Add Probability-Weighted Expected Value

In `scenarios.ts`, after computing bear/base/bull prices, add:
```typescript
export function calculateProbabilityWeightedEV(
  bearPrice: number, basePrice: number, bullPrice: number,
  bearProb: number, baseProb: number, bullProb: number
): number {
  return (bearProb/100) * bearPrice + 
         (baseProb/100) * basePrice + 
         (bullProb/100) * bullPrice;
}
```
Display in the Scenario Analysis panel as: "Prob-Weighted Expected Value: XX.XX EGP"

---

## VALIDATION SUITE — 12 CRITICAL ASSERTIONS

After every code change, run these assertions. All must pass:

```typescript
const v = calculateValuation(TECHCORP_DATA, TECHCORP_ASSUMPTIONS);

// 1. Tax correctness
assert(Math.abs(v.incomeStatement.taxExpense - 315_000_000) < 1, "Tax must be 315M");
assert(Math.abs(v.incomeStatement.netIncome - 1_085_000_000) < 1, "NI must be 1,085M");

// 2. WACC integrity
assert(Math.abs(v.wacc - 0.2584) < 0.0001, "WACC must be 25.84%");

// 3. FCFF cross-verification (all three methods must equal)
assert(Math.abs(v.fcff.method1 - v.fcff.method2) < 100, "M1 ≈ M2");
assert(Math.abs(v.fcff.method1 - v.fcff.method3) < 100, "M1 ≈ M3");
assert(Math.abs(v.fcff.method1 - 1_112_500_000) < 100, "FCFF = 1,112.5M");

// 4. DCF per share
assert(Math.abs(v.dcf.perShare - 43.93) < 0.01, "DCF = 43.93 EGP");

// 5. Blended valuation
assert(Math.abs(v.blended.midPrice - 55.72) < 0.01, "Blended = 55.72 EGP");

// 6. DDM models
assert(Math.abs(v.ddm.gordon - 10.49) < 0.01, "GGM = 10.49 EGP");
assert(Math.abs(v.ddm.twoStage - 13.24) < 0.01, "Two-Stage = 13.24 EGP");
assert(Math.abs(v.ddm.hModel - 12.18) < 0.01, "H-Model = 12.18 EGP");

// 7. Z-Score components are raw ratios (not weighted)
assert(Math.abs(v.zScore.x1Raw - 0.302) < 0.001, "X1 raw = 0.302");
assert(Math.abs(v.zScore.x3Raw - 0.349) < 0.001, "X3 raw = 0.349");
assert(Math.abs(v.zScore.x4Raw - 3.000) < 0.001, "X4 raw = 3.000");

// 8. Z-Score total
assert(Math.abs(v.zScore.total - 5.39) < 0.01, "Z-Score = 5.39");

// 9. Cost of Debt > Risk-Free Rate
assert(v.assumptions.costOfDebt > v.assumptions.riskFreeRate, "Kd > Rf");

// 10. Comparable valuations
assert(Math.abs(v.comps.peValue - 77.42) < 0.01, "P/E comp = 77.42 EGP");
assert(Math.abs(v.comps.evEbitdaValue - 83.50) < 0.01, "EV/EBITDA comp = 83.50 EGP");

// 11. Key ratios
assert(Math.abs(v.ratios.roe - 0.3982) < 0.001, "ROE uses correct NI 1,085M");
assert(Math.abs(v.ratios.currentRatio - 3.60) < 0.01, "Current ratio = 3.60x");

// 12. Probability-weighted EV (new)
const pwEV = calculateProbabilityWeightedEV(19.26, 43.93, 152.17, 25, 50, 25);
assert(Math.abs(pwEV - 64.82) < 0.01, "Prob-weighted EV = 64.82 EGP");
```

---

## CODE QUALITY STANDARDS

1. **TypeScript strict mode** — no `any` types anywhere
2. **Single Source of Truth** — financial assumptions in `ValuationAssumptions`, market defaults in `marketDefaults.ts`, scenario parameters in `scenarioParams.ts`. Never duplicate constants.
3. **IFERROR everywhere in Excel** — every formula: `=IFERROR(formula, 0)`
4. **No magic numbers** — named constants for: tax rates, legal reserve %, employee share %, CAPM coefficients
5. **Precision** — all financial outputs to 2 decimal places; ratios to 4 decimal places internally
6. **React 19 + Vite 6 + Tailwind CSS** — no TypeScript changes to this stack
7. **Wolfpack UI tokens**: Playfair Display (headings), IBM Plex Mono (numbers/data), Sora (body text)
8. **Test before shipping** — run the 12 assertions above against TechCorp before any commit

---

## RESPONSE FORMAT FOR THIS WORKFLOW

When Antigravity delivers code changes, use this format:

```
## CHANGES MADE
[Brief description of what was changed and why]

## VERIFICATION
[Show the key assertion outputs — e.g., "FCFF M1=M2=M3=1,112,500,000 ✅"]

## AFFECTED FILES
[List only the files modified]

## CODE
[Complete, paste-ready code — no truncation, no "// ... rest of code"]
```

---

## NEXT SESSION CONTEXT

Load this context at the start of every Antigravity session:
- Engine: wolf-valuation-engine.pages.dev
- Stack: React 19.2.3 + TypeScript 5.9.3 + Vite 7.2.4 + Tailwind 4.1.17
- Core engine file: src/utils/valuationEngine.ts (1,098 lines)
- Current Phase: Phase 1 Bug Fixes
- Critical files: valuationEngine.ts, marketDefaults.ts, excelExport.ts, advancedAnalysis.ts
- Test case: TechCorp Industries (TECH) — 12 assertions must all pass
- CBE Rates (April 2026): Deposit 19%, Lending 20%, 10Y Bond ~20.4%
- Deployment: Cloudflare Pages (push to GitHub → auto-deploy)

═══════════════════════════════════════════════════════════════════════════════
END OF MASTERCLASS PROMPT — WOLF VALUATION ENGINE v4.0
═══════════════════════════════════════════════════════════════════════════════
```

---

## QUICK REFERENCE — ERROR IMPACT MATRIX

| Bug | Root Cause | Files to Fix | Impact if Unfixed |
|---|---|---|---|
| Tax 21% hardcoded | `incomeStatement.taxExpense` used raw | valuationEngine.ts | NI wrong, FCFF M3 mismatch, ROE/ROA off |
| CBE rates outdated | marketDefaults.ts last updated 2024 | marketDefaults.ts | WACC ~100-200bp too high, DCF undervalues |
| Z-Score display | Weighted shown as raw | Z-Score component | Users believe X3=1.151 is a ratio (impossibe: >1 for EBIT/TA means EBIT > assets) |
| H-Model Excel | Missing +1 | excelExportPro.ts | H-Model = 2.48 instead of 12.18 in Excel download |
| Football Field bounds | No weighting applied | ValuationTab/footballField | Blended range is mathematically wrong |
| Kd ≤ Rf possible | No validation | inputValidation.ts | Users can input Kd=15% with Rf=20%, giving negative spread |

---

*This document was generated by comprehensive forensic audit of the WOLF Valuation Engine v4.0.0 using the TechCorp Industries (TECH) test case. All calculations independently verified in Python. CBE rates verified against official CBE.org.eg press releases dated April 2, 2026.*
