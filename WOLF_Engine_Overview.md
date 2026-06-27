# WOLF Valuation Engine -- Complete Developer Reference

> CFA-grade equity valuation platform for Egyptian and US markets.
> Last updated: 2026-04-12

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Project Structure](#2-project-structure)
3. [Data Model & Types](#3-data-model--types)
4. [WACC Calculation (Section 3)](#4-wacc-calculation)
5. [FCFF Three-Way Verification (Section 4)](#5-fcff-three-way-verification)
6. [DCF Projections & Valuation (Section 5)](#6-dcf-projections--valuation)
7. [Dividend Discount Models (Section 6)](#7-dividend-discount-models)
8. [Comparable Company Valuation](#8-comparable-company-valuation)
9. [LBO Model](#9-lbo-model)
10. [SOTP Valuation](#10-sotp-valuation)
11. [Precedent Transactions](#11-precedent-transactions)
12. [Relative Valuation](#12-relative-valuation)
13. [Blended Valuation & Verdict](#13-blended-valuation--verdict)
14. [Scenario Analysis](#14-scenario-analysis)
15. [Valuation Styles](#15-valuation-styles)
16. [Sensitivity Analysis](#16-sensitivity-analysis)
17. [Reverse DCF](#17-reverse-dcf)
18. [Confidence Score](#18-confidence-score)
19. [Financial Ratios & Metrics](#19-financial-ratios--metrics)
20. [Advanced Analysis](#20-advanced-analysis)
21. [EAS Compliance Modules](#21-eas-compliance-modules)
22. [Market Defaults & Constants](#22-market-defaults--constants)
23. [State Management & Data Flow](#23-state-management--data-flow)
24. [Component Architecture](#24-component-architecture)
25. [Export: PDF, Excel, JSON](#25-export-pdf-excel-json)
26. [WOLF Analyst AI](#26-wolf-analyst-ai)

---

## 1. Technology Stack

| Layer         | Technology                  | Version   |
|---------------|-----------------------------|-----------|
| Framework     | React                       | 19.2.3    |
| Language      | TypeScript                  | 5.9.3     |
| Build Tool    | Vite                        | 7.2.4     |
| Styling       | Tailwind CSS                | 4.1.17    |
| Charts        | Recharts                    | 3.7.0     |
| PDF Export    | jsPDF + jspdf-autotable     | 4.1 / 5.0 |
| Excel Export  | xlsx + xlsx-js-style        | 0.18.5    |
| Icons         | Lucide React                | 0.563     |
| Utilities     | clsx, tailwind-merge        | --        |

**Build commands:**
```bash
npm run dev       # Vite dev server
npm run build     # Production build to /dist
npm run preview   # Preview production build
```

---

## 2. Project Structure

```
src/
  types/
    financial.ts              # All TypeScript interfaces & enums
  utils/
    valuationEngine.ts        # Core: WACC, FCFF verification, DCF, DDM, Comps, Sensitivity, Ratios
    calculations/
      dcf.ts                  # Pure DCF projection & valuation functions
      comparables.ts          # Comparable company valuation (weighted blend)
      metrics.ts              # Key metrics & recommendation logic
      scenarios.ts            # Scenario analysis (bear/base/bull)
      lboEngine.ts            # LBO screening model
      sotpEngine.ts           # Sum-of-the-Parts valuation
    constants/
      scenarioParams.ts       # SCENARIO_PARAMS (single source of truth)
    advancedAnalysis.ts       # Reverse DCF, Monte Carlo, Quality Scorecard
    confidenceScore.ts        # Model confidence scoring (0-100)
    easModules.ts             # EAS 48, EAS 31, EAS 12, EAS 23 compliance
    pdfExport.ts              # Native jsPDF vector PDF generation
    excelExport.ts            # XLSX export with styled sheets
    excelExportPro.ts         # Enhanced Excel with _Calc sheet
    jsonExport.ts             # Full audit-trail JSON export
  constants/
    initialData.ts            # Sample financial data & default assumptions
    marketDefaults.ts         # Egypt/USA market configuration
    valuationStyles.ts        # Conservative/Moderate/Aggressive presets
  hooks/
    useValuationCalculations.ts  # Main calculation hook (useMemo-based)
    useFinancialData.ts          # State + undo/redo integration
    useHistory.ts                # Pure undo/redo (max 50 snapshots)
  services/
    wolfAnalyst.ts            # Groq-powered AI verification & chat
  workers/
    monteCarlo.worker.ts      # Web Worker for Monte Carlo simulation
  components/
    layout/
      Header.tsx              # Fixed navbar with controls
      CompanyHeader.tsx       # Hero section with valuation summary
      TabNavigation.tsx       # Input / Valuation / Charts tabs
      Footer.tsx
    input/
      InputTab.tsx            # Financial data entry tab
      HistoricalDataPanel.tsx # Multi-year historical data
      BalanceSheetValidation.tsx
    valuation/
      ValuationTab.tsx        # Main analysis tab (25+ sections)
      sections/
        DCFProjectionsTable.tsx
        FCFFReconciliation.tsx
        BaseYearFCF.tsx
        BlendedWeightSlider.tsx
        ComparableBreakdown.tsx
        DDMValuation.tsx
        ScenarioAnalysis.tsx
        ReverseDCFSection.tsx
        ConfidenceScore.tsx
        QualityScorecard.tsx
        PiotroskiFScore.tsx
        EVBridgeChart.tsx
        LBOPanel.tsx
        SOTPPanel.tsx
        PrecedentTransactionsPanel.tsx
        RelativeValuationPanel.tsx
        CreditMetricsPanel.tsx
        FXSensitivity.tsx
        WorkingCapitalDetail.tsx
        EASComplianceSection.tsx
        ValidationAlerts.tsx
        ValuationStyleSelector.tsx
        ValuationSummaryCards.tsx
        KeyMetricsGrid.tsx
        FCFESection.tsx
        MarketVsFundamental.tsx
        SaveLoadPanel.tsx
        CalculationAuditTrail.tsx
    charts/
      ChartsTab.tsx
      HistoricalTrendsChart.tsx
    WolfAnalystPanel.tsx      # AI verification panel
    dispatch/
      DispatchPDF.tsx         # PDF generation trigger
    ...shared, utility components
  App.tsx                     # Root orchestrator
```

---

## 3. Data Model & Types

**File:** `src/types/financial.ts`

### FinancialData (primary input)

```typescript
interface FinancialData {
  companyName: string;
  ticker: string;
  sharesOutstanding: number;
  currentStockPrice: number;
  dividendsPerShare: number;
  lastReportedDate?: string;       // From API (e.g. "2024-09-28")
  sector?: string;                 // From API profile
  fiscalYearEnd?: string;          // "dec", "jun", "mar", "sep"
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  cashFlowStatement: CashFlowStatement;
  historicalData?: HistoricalYear[];  // 2-5 prior years
}
```

### IncomeStatement

| Field              | Description                |
|--------------------|----------------------------|
| `revenue`          | Total revenue              |
| `costOfGoodsSold`  | COGS                       |
| `grossProfit`      | Revenue - COGS             |
| `operatingExpenses`| SG&A + other OpEx          |
| `operatingIncome`  | EBIT                       |
| `interestExpense`  | Interest on debt           |
| `taxExpense`       | Income tax                 |
| `netIncome`        | Bottom line                |
| `depreciation`     | Depreciation               |
| `amortization`     | Amortization               |

### BalanceSheet

**Current Assets:** cash, marketableSecurities, accountsReceivable, inventory, otherCurrentAssets, totalCurrentAssets

**Non-Current Assets:** propertyPlantEquipment, longTermInvestments, goodwill, intangibleAssets, otherNonCurrentAssets, totalAssets

**Current Liabilities:** accountsPayable, shortTermDebt, otherCurrentLiabilities, totalCurrentLiabilities

**Non-Current Liabilities:** longTermDebt, otherNonCurrentLiabilities, totalLiabilities

**Equity:** totalEquity, retainedEarnings? (for Altman Z), minorityInterest? (EV bridge), preferredEquity? (EV bridge), endOfServiceProvision? (EAS 42, debt-like)

### CashFlowStatement

| Field                     | Description                          |
|---------------------------|--------------------------------------|
| `operatingCashFlow`       | CFO                                  |
| `capitalExpenditures`     | CapEx                                |
| `freeCashFlow`            | CFO - CapEx                          |
| `dividendsPaid`           | Cash dividends (negative convention) |
| `netChangeInCash`         | Net cash change                      |
| `otherFinancingActivities?` | For cash reconciliation            |

### ValuationAssumptions

```typescript
interface ValuationAssumptions {
  // Core DCF
  discountRate: number;           // WACC (%) -- calculated from components
  terminalGrowthRate: number;     // Terminal growth rate (%)
  projectionYears: number;        // 3, 5, 7, or 10
  revenueGrowthRate: number;      // Annual revenue growth (%)
  taxRate: number;                // Corporate tax rate (%)

  // CAPM Parameters
  riskFreeRate: number;           // Rf (%) -- 20% Egypt, 4.5% USA
  marketRiskPremium: number;      // ERP (%) -- 5.5% Damodaran mature market
  beta: number;                   // vs EGX 30 or S&P 500
  capmMethod: 'A' | 'B';         // A = Local CAPM, B = USD Build-Up
  betaType: 'raw' | 'adjusted' | 'relevered';
  taxCategory: 'standard' | 'oil_gas' | 'suez_canal' | 'free_zone' | 'custom';

  // Method B (USD Build-Up) fields
  rfUS: number;                   // US 10Y Treasury (%)
  countryRiskPremium: number;     // CRP for Egypt (%)
  egyptInflation: number;         // Egypt CPI (%)
  usInflation: number;            // US CPI (%)

  // Cost of Debt
  costOfDebt: number;             // Pre-tax Kd (%)
  rfDate: string;                 // Timestamp of Rf rate

  // FCFF Projection Drivers
  ebitdaMargin: number;           // EBITDA / Revenue (%)
  daPercent: number;              // D&A / Revenue (%)
  capexPercent: number;           // CapEx / Revenue (%)
  deltaWCPercent: number;         // deltaWC / deltaRevenue (%)
  useConstantDrivers: boolean;    // Constant vs year-by-year

  // Terminal Value
  terminalMethod: 'gordon_growth' | 'exit_multiple';
  exitMultiple: number;           // Exit EV/EBITDA multiple

  // Discounting
  discountingConvention: 'end_of_year' | 'mid_year';

  // DDM
  dps?: number;                   // Deprecated -- auto-derived from dividendsPaid
  ddmHighGrowth: number;          // High-growth DPS growth rate (%)
  ddmStableGrowth: number;        // Terminal DPS growth rate (%)
  ddmHighGrowthYears: number;     // High-growth period length

  // Scenario Probabilities
  bearProbability: number;        // % (default 25)
  baseProbability: number;        // % (default 50)
  bullProbability: number;        // % (default 25)
}
```

---

## 4. WACC Calculation

**File:** `src/utils/valuationEngine.ts` (lines 106-201)

### Master Formula

```
WACC = (E/V) x Ke + (D/V) x Kd x (1 - t)

Where:
  E = Market Cap = Current Price x Shares Outstanding
  D = Short-Term Debt + Long-Term Debt
  V = E + D
  Kd = Pre-tax cost of debt (%)
  t  = Tax rate (%)
```

**Capital structure weights use MARKET CAP (not book equity).**

### Cost of Equity -- Method A (Local Currency CAPM, default for Egypt)

```
Ke = Rf(Egypt) + Beta x Mature_Market_ERP

Example: 20% + 1.2 x 5.5% = 26.6%
```

**No Country Risk Premium is added.** The Egyptian 10Y EGB yield already embeds sovereign risk.

### Cost of Equity -- Method B (USD Build-Up)

```
Ke(USD) = Rf(US) + Beta x Mature_ERP + CRP
Ke(EGP) = (1 + Ke_USD) x (1 + Egypt_Inflation) / (1 + US_Inflation) - 1

Example:
  Ke(USD) = 4.5% + 1.2 x 5.5% + 7.5% = 18.6%
  Ke(EGP) = (1.186) x (1.12) / (1.03) - 1 = 28.9%
```

The Fisher equation converts USD cost of equity to EGP terms.

### Beta Adjustments

| Type       | Formula                                       |
|------------|-----------------------------------------------|
| Raw        | As provided                                   |
| Adjusted   | (2/3 x Raw Beta) + (1/3 x 1.0) -- Bloomberg  |
| Relevered  | BetaL = BetaU x [1 + (1-t) x (D/E)]          |

### After-Tax Cost of Debt

```
Kd(after-tax) = Kd x (1 - t)
```

---

## 5. FCFF Three-Way Verification

**File:** `src/utils/valuationEngine.ts` (lines 203-249)

Three independent routes must produce identical FCFF values:

### Method 1 -- NOPAT Route (Primary)

```
FCFF = EBIT x (1 - t) + D&A - CapEx - deltaWC
```

### Method 2 -- EBITDA Route

```
FCFF = EBITDA x (1 - t) + D&A x t - CapEx - deltaWC
```

### Method 3 -- Net Income Route

```
FCFF = Net Income + Interest x (1 - t) + D&A - CapEx - deltaWC
```

**Tolerance:** All three must match within +/-0.001. Displayed in `FCFFReconciliation.tsx`.

**Critical rules:**
- FCFF must NEVER subtract Interest Expense directly
- deltaWC increase = cash outflow (subtracted)
- Tax rate is applied as a decimal (0.225 for 22.5%)

---

## 6. DCF Projections & Valuation

**Files:** `src/utils/calculations/dcf.ts`, `src/utils/valuationEngine.ts` (lines 257-426)

### Year-by-Year Projection

For each year `t` from 1 to N:

```
Revenue(t)  = Revenue(t-1) x (1 + Revenue_Growth%)
EBITDA(t)   = Revenue(t) x EBITDA_Margin%
D&A(t)      = Revenue(t) x DA_Percent%
EBIT(t)     = EBITDA(t) - D&A(t)
NOPAT(t)    = EBIT(t) x (1 - Tax_Rate)
CapEx(t)    = Revenue(t) x CapEx_Percent%
deltaWC(t)  = (Revenue(t) - Revenue(t-1)) x DeltaWC_Percent%
FCFF(t)     = NOPAT(t) + D&A(t) - CapEx(t) - deltaWC(t)
```

### Discounting

```
End-of-Year:  period = t
Mid-Year:     period = t - 0.5

Discount Factor = (1 + WACC)^period
Present Value   = FCFF(t) / Discount Factor
```

### Terminal Value

**Gordon Growth Method (default):**
```
TV = FCFF(N) x (1 + g) / (WACC - g)

Hard block: g >= WACC produces TV = 0
```

**Exit Multiple Method:**
```
TV = EBITDA(N) x Exit_Multiple
```

### Enterprise Value to Equity Bridge

```
Sum of PV(FCFF)        = SUM(PV_1 ... PV_N)
PV(Terminal Value)     = TV / (1 + WACC)^N
Enterprise Value       = Sum of PV(FCFF) + PV(Terminal Value)
Net Debt               = (Short-Term Debt + Long-Term Debt) - Cash
Equity Value           = Enterprise Value - Net Debt
Implied Share Price    = Equity Value / Shares Outstanding
```

**No MAX(0) floor on equity value** -- allows negative values for distressed companies.

### Verdict Logic

```
Upside = (Implied Price - Current Price) / Current Price x 100

UNDERVALUED:   Upside > +10%
FAIRLY VALUED: -10% <= Upside <= +10%
OVERVALUED:    Upside < -10%
```

---

## 7. Dividend Discount Models

**File:** `src/utils/valuationEngine.ts` (lines 433-510)

**All DDM models discount at Ke (cost of equity), NOT WACC.**

DPS is auto-derived as: `abs(dividendsPaid) / sharesOutstanding`. Falls back to `dividendsPerShare` field if dividendsPaid is zero.

### 7.1 Gordon Growth (Single-Stage)

```
P = D0 x (1 + g) / (Ke - g) = D1 / (Ke - g)

Requires: Ke > g
```

### 7.2 Two-Stage DDM

```
Phase 1 (High Growth, years 1..N):
  D(t) = D0 x (1 + g_high)^t
  PV = SUM[ D(t) / (1 + Ke)^t ]

Phase 2 (Terminal):
  Terminal Dividend = D(N) x (1 + g_stable)
  Terminal Value = Terminal Dividend / (Ke - g_stable)
  PV(Terminal) = Terminal Value / (1 + Ke)^N

P = PV(Phase 1) + PV(Terminal)
```

### 7.3 H-Model

```
P = D0 x (1 + g_L) / (Ke - g_L) + D0 x H x (g_S - g_L) / (Ke - g_L)

Where H = N / 2 (half-life of the high-growth period)
```

**Not applicable when:** Company pays no dividends, or net income is negative.

---

## 8. Comparable Company Valuation

**File:** `src/utils/calculations/comparables.ts`

### Four Valuation Methods

```
P/E:       Implied Price = EPS x P/E_Multiple
EV/EBITDA: Implied Price = (EBITDA x EV/EBITDA_Multiple - Debt + Cash) / Shares
P/S:       Implied Price = Revenue_Per_Share x P/S_Multiple
P/B:       Implied Price = Book_Value_Per_Share x P/B_Multiple
```

### Multiple Source Priority

1. **User-added peer companies** -- median of positive values
2. **Industry defaults** -- fallback when no peers added

### Blending Weights

| Sector Type  | P/E  | EV/EBITDA | P/S  | P/B  |
|-------------|------|-----------|------|------|
| **Standard**| 40%  | 35%       | 15%  | 10%  |
| **Financial/Banking** | 60% | 0% | 0% | 40% |

Banks exclude EV/EBITDA (not meaningful for financial institutions).

```
Blended Comps = PE_Implied x W_PE + EV_Implied x W_EV + PS_Implied x W_PS + PB_Implied x W_PB
```

Valuation style multiplier is applied to all multiples before calculation.

---

## 9. LBO Model

**File:** `src/utils/calculations/lboEngine.ts`

Simplified PE screening model (no debt tranches, PIK, or revolvers).

### Entry

```
Entry EV     = Base EBITDA x Entry_Multiple
Entry Debt   = Entry EV x Leverage_Ratio%
Entry Equity = Entry EV - Entry Debt (sponsor check)
```

### Holding Period (year 1 to N)

```
EBITDA(t)        = EBITDA(t-1) x (1 + EBITDA_Growth%)
Interest(t)      = Debt_Balance(t-1) x Cost_of_Debt%
EBT(t)           = EBITDA(t) - Interest(t)
Taxes(t)         = MAX(0, EBT(t) x Tax_Rate%)
Net Income(t)    = EBT(t) - Taxes(t)
FCF(t)           = MAX(0, Net Income(t))
Debt Repayment   = MIN(Debt_Balance, FCF x Paydown_Rate%)
Debt Balance(t)  = Debt Balance(t-1) - Repayment(t)
```

### Exit

```
Exit EV     = Terminal EBITDA x Exit_Multiple
Exit Equity = Exit EV - Remaining Debt

MOIC = Exit Equity / Entry Equity
IRR  = MOIC^(1/N) - 1
```

### Default Assumptions

| Parameter       | Default  |
|-----------------|----------|
| Entry Multiple  | 8.0x     |
| Exit Multiple   | 8.0x     |
| Holding Period  | 5 years  |
| Leverage Ratio  | 60%      |
| Cost of Debt    | 22.5%    |
| EBITDA Growth   | 8%       |
| Paydown Rate    | 75% FCF  |
| Tax Rate        | 22.5%    |

---

## 10. SOTP Valuation

**File:** `src/utils/calculations/sotpEngine.ts`

### Per-Segment Valuation

```
Segment EBITDA = Segment Revenue x EBITDA Margin%

Primary:   Segment EV = EBITDA x EV/EBITDA_Multiple
Fallback:  Segment EV = Net Income x P/E_Multiple    (if EV/EBITDA = 0)
```

### Consolidation

```
Total EV         = SUM(Segment EVs)
Holding Discount = Total EV x Discount% (default 10%)
Equity Value     = Total EV - Holding Discount - Net Debt
Per-Share Value  = MAX(0, Equity Value / Shares)
Upside           = (Per-Share Value - Current Price) / Current Price x 100
```

---

## 11. Precedent Transactions

**File:** `src/components/valuation/sections/PrecedentTransactionsPanel.tsx`

User enters historical M&A deals with EV/Revenue, EV/EBITDA multiples and acquisition premiums.

### Implied Valuations

```
From Revenue: (Revenue x Median_EV/Revenue - Debt + Cash) / Shares
From EBITDA:  (EBITDA x Median_EV/EBITDA - Debt + Cash) / Shares
From Premium: Current Price x (1 + Median_Premium%)
```

---

## 12. Relative Valuation

**File:** `src/components/valuation/sections/RelativeValuationPanel.tsx`

Similar to Comparable Company Valuation but presented as a standalone panel with additional sector context and visual comparison charts.

---

## 13. Blended Valuation & Verdict

**File:** `src/utils/valuationEngine.ts` (lines 599-643)

### Blended Value

```
Blended Value = DCF_Value x DCF_Weight + Comparable_Value x Comps_Weight

Default: 60% DCF / 40% Comps (adjustable via BlendedWeightSlider)

If no valid comps: 100% DCF
```

### Recommendation Bands

| Upside Range | Verdict        | Action       |
|-------------|----------------|--------------|
| > +30%      | UNDERVALUED    | STRONG BUY   |
| > +10%      | UNDERVALUED    | BUY          |
| -10% to +10%| FAIRLY VALUED | HOLD         |
| -30% to -10%| OVERVALUED    | SELL         |
| < -30%      | OVERVALUED     | STRONG SELL  |

---

## 14. Scenario Analysis

**File:** `src/utils/calculations/scenarios.ts`
**Params:** `src/utils/constants/scenarioParams.ts` (single source of truth)

### SCENARIO_PARAMS

| Parameter                | Bear  | Base | Bull  |
|--------------------------|-------|------|-------|
| Revenue Growth Multiplier| 0.40  | 1.00 | 2.00  |
| WACC Adjustment (pp)     | +2.50 | 0.00 | -2.50 |
| Margin Adj Per Year      | -1.5pp| 0.00 | +2.5pp|
| Terminal g Multiplier    | 0.75  | 1.00 | 1.25  |

**Example** (Base = 15% growth, 25.84% WACC, 8% terminal g):

| Scenario | Growth | WACC   | Terminal g | Margin Delta |
|----------|--------|--------|-----------|--------------|
| Bear     | 6.0%   | 28.34% | 6.0%      | -1.5pp/yr    |
| Base     | 15.0%  | 25.84% | 8.0%      | 0            |
| Bull     | 30.0%  | 23.34% | 10.0%     | +2.5pp/yr    |

Terminal growth is always clamped to `< WACC - 1`.

### Probability-Weighted Value

```
Weighted Value = Bear_Price x Bear_Prob + Base_Price x Base_Prob + Bull_Price x Bull_Prob

Defaults: 25% Bear / 50% Base / 25% Bull
```

---

## 15. Valuation Styles

**File:** `src/constants/valuationStyles.ts`

Three investor-profile presets that adjust all assumptions simultaneously:

| Parameter            | Conservative | Moderate | Aggressive |
|----------------------|-------------|----------|------------|
| Revenue Growth Mult  | 0.70        | 1.00     | 1.40       |
| WACC Add (pp)        | +1.5        | 0.0      | -1.0       |
| Terminal g Mult      | 0.80        | 1.00     | 1.20       |
| Comps Multiple Mult  | 0.80        | 1.00     | 1.30       |
| Margin Change (pp)   | -0.5        | 0.0      | +1.0       |

Applied in `useValuationCalculations` before any calculation begins.

---

## 16. Sensitivity Analysis

**File:** `src/utils/valuationEngine.ts` (lines 749-800+)

5x5 matrix of implied share prices varying WACC and Terminal Growth Rate.

### Axis Construction

```
WACC Axis:   [base-4%, base-2%, base, base+2%, base+4%]
Growth Axis: [base-3%, base-1.5%, base, base+1.5%, base+3%]
  Floor: 4% (Egypt minimum)
  Cap:   WACC - 1% (prevent g >= WACC)
```

Each cell recalculates full DCF with the corresponding WACC and terminal growth.

Color coding: green (upside > 10%), yellow (-10% to 10%), red (< -10%).

---

## 17. Reverse DCF

**File:** `src/utils/advancedAnalysis.ts` (lines 22-110+)

**Question:** What revenue growth rate does the current market price imply?

### Algorithm

Binary search (100 iterations) for the growth rate that produces an enterprise value equal to the market-implied EV:

```
Target EV = Market Cap + Total Debt - Cash

For each candidate growth rate:
  Project Revenue -> EBITDA -> FCFF for N years
  Calculate Terminal Value
  Sum PV(FCFF) + PV(TV) = Implied EV
  Compare to Target EV

Growth Gap = Implied Growth - Base Case Growth
```

### Market Expectation Classification

| Condition          | Classification |
|-------------------|----------------|
| Gap < 2pp         | Reasonable     |
| Gap 2-5pp higher  | Moderately aggressive |
| Gap 5-10pp higher | Significantly aggressive |
| Gap > 10pp higher | Substantially aggressive |
| (Inverse for lower) | Conservative variants |

---

## 18. Confidence Score

**File:** `src/utils/confidenceScore.ts`

Scores the model on a 0-100 scale across three pillars.

### Pillar 1: Data Quality (30 points max)

| Check                 | Points |
|----------------------|--------|
| D&A > 0             | 5      |
| CapEx > 0           | 5      |
| Interest consistency | 5      |
| EBITDA > 0          | 5      |
| Revenue > 0         | 5      |
| Shares > 0          | 5      |

### Pillar 2: Assumption Reasonableness (40 points max)

| Check                    | Points |
|--------------------------|--------|
| Revenue growth <= 25%    | 8      |
| EBITDA margin <= 50%     | 8      |
| Terminal g < GDP (~6%)   | 8      |
| WACC 15-35% (Egypt)      | 8      |
| FCFF 3-way reconciliation| 8      |

### Pillar 3: Model Robustness (30 points max)

| Check                       | Points |
|----------------------------|--------|
| Terminal Value < 80% of EV | 10     |
| Value within +/-50% market | 10     |
| DCF/DDM directional agree  | 5      |
| Interest coverage > 1.5x   | 5      |

### Grading

| Score | Grade |
|-------|-------|
| >= 85 | A     |
| 70-84 | B     |
| 55-69 | C     |
| 40-54 | D     |
| < 40  | F     |

---

## 19. Financial Ratios & Metrics

**Files:** `src/utils/calculations/metrics.ts`, `src/utils/valuationEngine.ts` (lines 649-738)

### Profitability

| Ratio          | Formula                                            |
|----------------|----------------------------------------------------|
| Gross Margin   | (Revenue - COGS) / Revenue x 100                   |
| EBITDA Margin  | EBITDA / Revenue x 100                              |
| EBIT Margin    | EBIT / Revenue x 100                                |
| Net Margin     | Net Income / Revenue x 100                          |
| ROE            | Net Income / Total Equity x 100                     |
| ROA            | Net Income / Total Assets x 100                     |
| ROIC           | NOPAT / Invested Capital x 100                      |

**ROIC note:** Uses statutory tax rate (22.5%), not effective tax rate.
**Invested Capital** = Total Equity + Total Debt - Cash.

### Leverage

| Ratio              | Formula                                  |
|--------------------|------------------------------------------|
| Debt / Equity      | Total Debt / Total Equity                |
| Net Debt / EBITDA  | (Debt - Cash) / EBITDA                   |
| Interest Coverage  | EBIT / Interest Expense (999 if no debt) |

### Liquidity

| Ratio          | Formula                                         |
|----------------|-------------------------------------------------|
| Current Ratio  | Current Assets / Current Liabilities             |
| Quick Ratio    | (Cash + Accounts Receivable) / Current Liabilities |

### Efficiency

| Ratio     | Formula                                |
|-----------|----------------------------------------|
| DSO       | 365 / (Revenue / Accounts Receivable)  |
| DIO       | 365 / (COGS / Inventory)              |
| DPO       | 365 / (COGS / Accounts Payable)       |
| CCC       | DSO + DIO - DPO                       |

### Value Creation

| Metric          | Formula                                    |
|------------------|--------------------------------------------|
| EVA              | NOPAT - (Invested Capital x WACC%)         |
| ROIC-WACC Spread | ROIC - WACC                                |

### Valuation Multiples

| Multiple         | Formula                                      |
|------------------|----------------------------------------------|
| Trailing P/E     | Market Cap / Net Income                       |
| Forward P/E      | Price / (EPS x 1.15)                          |
| EV/EBITDA        | Enterprise Value / EBITDA                     |
| EV/EBIT          | Enterprise Value / EBIT                       |
| EV/Revenue       | Enterprise Value / Revenue                    |
| P/B              | Market Cap / Total Equity                     |
| P/S              | Market Cap / Revenue                          |
| P/CF             | Market Cap / Operating Cash Flow              |
| PEG              | P/E / 15 (growth proxy)                       |
| Dividend Yield   | DPS / Price x 100                             |
| Earnings Yield   | EPS / Price x 100                             |
| FCF Yield        | FCF / Market Cap x 100                        |

### NTM (Next Twelve Months) Forward Multiples

Computed from Year 1 DCF projections:

```
NTM P/E       = Market Cap / NOPAT(Year 1)
NTM EV/EBITDA = EV / EBITDA(Year 1)
NTM P/S       = Market Cap / Revenue(Year 1)
```

### Quality Scores

**Altman Z-Score:**
```
Z = 1.2 x (WC/TA) + 1.4 x (RE/TA) + 3.3 x (EBIT/TA) + 0.6 x (MCap/TL) + Revenue/TA

Z > 2.99: Safe zone
1.81-2.99: Grey zone
Z < 1.81: Distress zone
```

**Piotroski F-Score:** 0-9 scoring (placeholder for future implementation).

---

## 20. Advanced Analysis

**File:** `src/utils/advancedAnalysis.ts`

### Monte Carlo Simulation

**Worker:** `src/workers/monteCarlo.worker.ts`

Random perturbations using normal distribution:
- Revenue growth: +/-3pp
- WACC: +/-2pp
- Terminal growth: +/-1pp

**Output:**
- Mean, median, standard deviation
- 5th, 25th, 75th, 95th percentile prices
- Probability above current market price
- Probability above base case

---

## 21. EAS Compliance Modules

**File:** `src/utils/easModules.ts`

### EAS 48 (IFRS 16) -- Lease Adjustments

```
ROU Asset = PV of Remaining Lease Payments at IBR
  = Payment x [(1 - (1+IBR)^(-N)) / IBR]

Lease Liability = ROU Asset (at inception)
Annual Depreciation = ROU / Remaining Term (straight-line)
Year 1 Interest = Lease Liability x IBR
EBITDA Add-Back = Full Annual Lease Payment
Post-EAS48 Debt = Pre-Debt + Lease Liability
```

### EAS 31 (IAS 1) -- Normalized Earnings

```
Gross Adjustment = SUM(add-backs) - SUM(deductions)
Tax Effect = SUM(tax-affected items) x Tax Rate
Net Adjustment = Gross - Tax Effect
Normalized NI = Reported NI + Net Adjustment
Normalized EPS = Normalized NI / Shares
```

### EAS 12 (IAS 12) -- Deferred Tax Bridge

```
Net DTA = Deferred Tax Asset - Deferred Tax Liability
EV Adjustment = Net DTA (added to equity value in bridge)
Adjusted Equity = Base Equity + Net DTA
```

### EAS 23 (IAS 33) -- EPS

```
Basic EPS = Net Income / Basic Shares Outstanding
Diluted EPS = Net Income / (Basic + Dilutive Shares)
Anti-dilution: If Diluted EPS > Basic EPS, options are anti-dilutive
```

---

## 22. Market Defaults & Constants

**File:** `src/utils/valuationEngine.ts` (lines 46-92), `src/constants/marketDefaults.ts`

### Egypt Market

| Parameter            | Value  | Source / Note                         |
|----------------------|--------|---------------------------------------|
| Risk-Free Rate       | 20.0%  | 10Y Egyptian Government Bond (Apr 2026) |
| Market Risk Premium  | 5.5%   | Damodaran mature market ERP           |
| Terminal Growth      | 8.0%   | Default; max 12%                      |
| Corporate Tax        | 22.5%  | Standard Egyptian corporate tax       |
| Cost of Debt         | 22.5%  | Rf 20% + 250bp corporate spread      |
| CRP (Method B only)  | 7.5%   | Damodaran for Egypt (Caa1/B-)         |
| CBE Benchmark Rate   | 19.0%  | Overnight deposit rate (Apr 2026)     |
| CBE Lending Rate     | 20.0%  | Overnight lending rate                |
| Egypt Inflation      | 12.0%  | Jan 2026 actual: ~11.9%              |
| US Inflation         | 3.0%   | For Fisher equation in Method B       |

### Egyptian Tax Categories

| Category   | Rate    |
|-----------|---------|
| Standard  | 22.5%   |
| Oil & Gas | 40.55%  |
| Suez Canal| 40.0%   |
| Free Zone | 0.0%    |
| Custom    | User-set|

### USA Market

| Parameter           | Value  |
|---------------------|--------|
| Risk-Free Rate      | 4.5%   |
| Market Risk Premium | 5.5%   |
| Terminal Growth     | 2.5%   |
| Max Terminal Growth | 3.0%   |
| Corporate Tax       | 21.0%  |
| CRP                 | 0.0%   |

### Egyptian Industry Multiples

| Industry    | P/E   | EV/EBITDA | P/S  | P/B  |
|-------------|-------|-----------|------|------|
| Banking     | 5.5x  | 4.0x      | 2.0x | 1.2x |
| Telecom     | 8.0x  | 4.5x      | 1.5x | 1.8x |
| Consumer    | 12.0x | 7.0x      | 1.2x | 2.5x |
| Real Estate | 6.0x  | 8.0x      | 2.0x | 0.8x |
| Industrial  | 7.0x  | 5.0x      | 0.8x | 1.0x |
| Healthcare  | 15.0x | 9.0x      | 2.5x | 3.0x |
| Default/EGX | 7.0x  | 5.0x      | 1.2x | 1.5x |

### Egyptian Peer Mappings

```
CIB          -> COMI.CA, QNBA.CA, ADIB.CA, FAISAL.CA
COMI.CA      -> QNBA.CA, ADIB.CA, FAISAL.CA, SAIB.CA
ETEL.CA      -> VODAFONE.CA, ORANGE.CA
EFID.CA      -> JUFO.CA, ISPH.CA, DOMTY.CA
TMGH.CA      -> PHDC.CA, EMFD.CA, MNHD.CA
DEFAULT_EG   -> COMI.CA, ETEL.CA, EFID.CA, EAST.CA, TMGH.CA
```

---

## 23. State Management & Data Flow

### Architecture

No external state library (Redux, Zustand). Pure React hooks + `useMemo`.

### Core Hooks

**`useFinancialData(initialData)`** -- `src/hooks/useFinancialData.ts`

Manages `financialData`, `assumptions`, `comparables` state with automatic undo/redo history.

Every call to `updateFinancialData()`, `updateAssumptions()`, or `updateComparables()` saves a snapshot to history.

**`useHistory()`** -- `src/hooks/useHistory.ts`

Pure undo/redo stack. Max 50 snapshots. Exposes `saveToHistory()`, `undo()`, `redo()`, `canUndo`, `canRedo`.

**`useValuationCalculations(...)`** -- `src/hooks/useValuationCalculations.ts`

Master calculation hook. Accepts all inputs and returns all computed outputs via `useMemo`:

```
Inputs:
  financialData, assumptions, comparables,
  scenario, valuationStyle, dcfWeight, marketRegion

Outputs:
  adjustedAssumptions     -> Style + scenario adjusted
  dcfProjections          -> Year-by-year projections array
  dcfValue                -> DCF per-share value
  scenarioCases           -> { bear, base, bull } prices
  industryMultiples       -> Sector default multiples
  comparableValuations    -> { pe, evEbitda, ps, pb, blended }
  comparableValue         -> Blended comps per share
  blendedValue            -> Weighted DCF + Comps
  upside                  -> % vs current price
  keyMetrics              -> All financial ratios
  recommendation          -> { text, action, verdict, color }
  footballFieldData       -> Valuation range chart data
  revenueProjectionData   -> Chart data for projections
  probabilityWeightedEV   -> Scenario probability-weighted value
```

### Data Flow Diagram

```
User Input (forms)
     |
     v
updateFinancialData() / updateAssumptions()
     |
     v
useFinancialData -> saves to history stack (max 50)
     |
     v
useValuationCalculations (useMemo recalculation)
     |
     +---> WACC (Method A or B CAPM)
     +---> DCF Projections (N years, FCFF per year)
     +---> Terminal Value (Gordon Growth or Exit Multiple)
     +---> Comparable Valuation (peer median multiples)
     +---> Blended Value (60/40 default, adjustable)
     +---> Scenario Analysis (Bear/Base/Bull)
     +---> DDM (Gordon, Two-Stage, H-Model)
     +---> Reverse DCF (implied growth)
     +---> Confidence Score (0-100)
     +---> Key Metrics (30+ ratios)
     +---> Sensitivity Matrix (5x5)
     |
     v
ValuationTab renders 25+ sections
     |
     v
Export: PDF / Excel / JSON / Save-Load
```

---

## 24. Component Architecture

### Root Layout

```
App.tsx
  Header (fixed navbar)
    ScenarioToggle (Bear/Base/Bull)
    Undo/Redo buttons
    Theme toggle
  CompanyHeader (hero: company name, blended value, verdict)
  TabNavigation (Input | Valuation | Charts)

  [InputTab]
    FinancialInputForm
    HistoricalDataPanel
    BalanceSheetValidation
    StockSearch

  [ValuationTab]
    ValidationAlerts
    ValuationStyleSelector (Conservative/Moderate/Aggressive)
    ValuationSummaryCards
    BaseYearFCF
    DCFProjectionsTable
    FCFFReconciliation
    BlendedWeightSlider
    ComparableBreakdown
    KeyMetricsGrid
    DDMValuation
    ScenarioAnalysis
    ReverseDCFSection
    QualityScorecard / PiotroskiFScore
    EASComplianceSection
    EVBridgeChart
    ConfidenceScore
    LBOPanel
    SOTPPanel
    PrecedentTransactionsPanel
    RelativeValuationPanel
    CreditMetricsPanel
    WorkingCapitalDetail
    FXSensitivity
    MarketVsFundamental
    FCFESection
    SaveLoadPanel
    CalculationAuditTrail

  [ChartsTab]
    Revenue projection chart (Recharts)
    HistoricalTrendsChart
    FootballFieldChart (valuation range bars)
    Sensitivity heatmap

  WolfAnalystPanel (AI verification sidebar)
  DispatchPDF (PDF generation)
```

---

## 25. Export: PDF, Excel, JSON

### PDF Export

**File:** `src/utils/pdfExport.ts`

Uses native jsPDF API (vector drawing -- no html2canvas). Generation: <1 second, file size: ~300KB.

**Pages include:**
- Executive summary with blended valuation and recommendation
- Company financial snapshot
- DCF analysis with projections table
- Sensitivity analysis heatmap
- Comparable company analysis
- Key metrics table
- Scenario analysis (bear/base/bull with probability weighting)
- Confidence score breakdown
- Reverse DCF / Quality Scorecard / EAS compliance

**File naming:** `{CompanyName}_{Scenario}_{Date}.pdf`

### Excel Export

**File:** `src/utils/excelExport.ts`, `src/utils/excelExportPro.ts`

**Sheets:**
1. **Summary** -- Valuation metrics and recommendation
2. **DCF Model** -- Detailed projections with FCFF components
3. **WACC Calculation** -- Cost of equity + cost of debt breakdown
4. **Key Metrics** -- All financial ratios
5. **Comparables** -- Industry multiples and implied values
6. **Scenarios** -- Bear/Base/Bull case details
7. **Sensitivity** -- WACC vs Terminal Growth matrix
8. **Inputs** -- Full assumption set
9. **_Calc** (Pro) -- Intermediate calculations sheet

Formatting: Currency (EGP/USD), percentage (0.00%), ratio (0.00x), number (#,##0), color-coded sections.

### JSON Export

**File:** `src/utils/jsonExport.ts`

Full audit trail conforming to `ValuationJSON` interface:

```typescript
{
  metadata: { engine_version, generation_date, currency, company_name, capm_method, ... },
  inputs: { ... },
  calculated: {
    wacc: WACCResult,
    dcf: { projections, ev_bridge, terminal_growth_used, ... },
    ddm: DDMResult,
    multiples: { ... },
    sensitivity: SensitivityMatrix,
    ratios: FinancialRatios,
    fcff_verification: FCFFVerification,
    scenarios: ScenarioAnalysis,
  }
}
```

---

## 26. WOLF Analyst AI

**File:** `src/services/wolfAnalyst.ts`

### Integration

- **API:** Groq (OpenAI-compatible endpoint)
- **Environment variable:** `VITE_GROQ_API_KEY`
- **Rate limiting:** 10-second minimum between API calls

### Modes

**Verify Mode:** Passes all current valuation data and formulas to the AI for independent verification. The system prompt includes reference formulas for WACC, FCFF, DCF, terminal value, and blending.

**Chat Mode:** Q&A about the valuation -- user can ask about specific assumptions, methodology, or results.

### System Prompt Reference Formulas

The AI is given these as ground truth:
- WACC = (E/V) x Ke + (D/V) x Kd x (1-t)
- Ke = Rf + Beta x ERP (Method A, no CRP)
- FCFF = EBIT x (1-t) + D&A - CapEx - deltaWC
- TV = FCFF_N x (1+g) / (WACC-g)
- Blended = DCF x 0.60 + Comps x 0.40
- Upside = (Blended - Price) / Price

---

## Appendix A: Key Design Decisions

1. **No MAX(0) floor on equity value** -- Distressed companies can show negative equity value. This is intentional and correct.

2. **Method A as default** -- For Egyptian valuations, the local currency CAPM avoids double-counting country risk (already in the 20% Rf).

3. **FCFF not FCFE** -- The engine values the entire firm (FCFF discounted at WACC), then bridges to equity, rather than valuing equity directly (FCFE discounted at Ke).

4. **Median over Mean** -- Comparable multiples use median to reduce outlier influence.

5. **Terminal growth clamped below WACC** -- If g >= WACC, terminal value is set to 0 rather than producing a mathematically meaningless result.

6. **Statutory tax for ROIC** -- ROIC uses 22.5% statutory rate, not the effective rate, for consistency.

7. **DPS auto-derived** -- Dividends per share is calculated from `abs(dividendsPaid) / sharesOutstanding`, not manual input.

8. **History-based state** -- All state changes create snapshots (max 50) for undo/redo. No external state management library.

---

## Appendix B: Adding a New Valuation Module

1. **Create calculation file:** `src/utils/calculations/newModule.ts`
   - Export types for inputs, results
   - Export pure calculation function(s) -- no React dependencies
   - Include default assumptions as a named constant

2. **Create UI component:** `src/components/valuation/sections/NewModulePanel.tsx`
   - Accept `financialData`, `assumptions`, and other needed props
   - Manage local state for module-specific inputs
   - Call calculation function and render results

3. **Add to ValuationTab:** Import and render in `src/components/valuation/ValuationTab.tsx`

4. **Add to exports:** Include in PDF (`pdfExport.ts`), Excel (`excelExport.ts`), and JSON (`jsonExport.ts`) outputs

5. **Update SCENARIO_PARAMS** if the module needs scenario variants

6. **Update Confidence Score** if the module provides additional validation signals
