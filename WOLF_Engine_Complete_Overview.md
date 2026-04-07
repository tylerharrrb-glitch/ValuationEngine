# WOLF Valuation Engine — Complete Technical Overview

> **Engine Version**: 4.0.0  
> **Last Updated**: April 2026  
> **Market Focus**: Egyptian (EGX) + US (NYSE/NASDAQ)  
> **Standard**: CFA-grade financial modeling

---

## Table of Contents

1. [Technology Stack & Project Structure](#1-technology-stack--project-structure)
2. [Type System & Data Model](#2-type-system--data-model)
3. [Market Defaults & Egyptian Regulations](#3-market-defaults--egyptian-regulations)
4. [WACC Calculation (Section 3)](#4-wacc-calculation-section-3)
5. [FCFF Three-Way Cross-Verification (Section 4)](#5-fcff-three-way-cross-verification-section-4)
6. [DCF Projections & Valuation (Section 5)](#6-dcf-projections--valuation-section-5)
7. [Dividend Discount Models (Section 6)](#7-dividend-discount-models-section-6)
8. [Comparable Company Valuation](#8-comparable-company-valuation)
9. [Blended Valuation](#9-blended-valuation)
10. [Financial Ratios (Section 7)](#10-financial-ratios-section-7)
11. [Sensitivity Analysis (Section 8)](#11-sensitivity-analysis-section-8)
12. [Scenario Analysis (Section 8.2)](#12-scenario-analysis-section-82)
13. [Reverse DCF (Section 8.3)](#13-reverse-dcf-section-83)
14. [Monte Carlo Simulation](#14-monte-carlo-simulation)
15. [Advanced Analysis Modules](#15-advanced-analysis-modules)
16. [EAS Compliance Modules](#16-eas-compliance-modules)
17. [Confidence Score (Section 7.1)](#17-confidence-score-section-71)
18. [Input Validation](#18-input-validation)
19. [Valuation Styles](#19-valuation-styles)
20. [Stock Data API](#20-stock-data-api)
21. [WOLF Analyst (AI Verification)](#21-wolf-analyst-ai-verification)
22. [Export Systems](#22-export-systems)
23. [State Management & Hooks](#23-state-management--hooks)
24. [UI Components](#24-ui-components)
25. [Complete File Index](#25-complete-file-index)

---

## 1. Technology Stack & Project Structure

### Core Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | React | 19.2.3 |
| Language | TypeScript | 5.9.3 |
| Build Tool | Vite | 7.2.4 |
| CSS Framework | Tailwind CSS | 4.1.17 |
| Charts | Recharts | 3.7.0 |
| PDF Export | jsPDF + jspdf-autotable | 4.1.0 / 5.0.7 |
| Excel Export | xlsx-js-style | 1.2.0 |
| Icons | Lucide React | 0.563.0 |
| AI Backend | Groq API (llama3-70b) | — |
| Financial Data | Financial Modeling Prep (Stable API) | 2026 format |

### Project Layout

```
ValuationEngine/
├── src/
│   ├── App.tsx                          # Main application shell (12.4KB)
│   ├── main.tsx                         # Entry point
│   ├── index.css                        # Global styles (7KB)
│   ├── vite-env.d.ts                    # Vite type declarations
│   ├── types/
│   │   └── financial.ts                 # All TypeScript interfaces (14KB, 465 lines)
│   ├── constants/
│   │   ├── initialData.ts               # Default financial data & assumptions
│   │   ├── marketDefaults.ts            # USA/Egypt market parameters & tax categories
│   │   └── valuationStyles.ts           # Conservative/Moderate/Aggressive presets
│   ├── data/
│   │   └── sampleData.ts               # Sample company data
│   ├── hooks/
│   │   ├── useFinancialData.ts          # State management with history (8.7KB)
│   │   ├── useHistory.ts               # Undo/redo stack (2.7KB)
│   │   ├── useKeyboardShortcuts.ts      # Ctrl+Z, Ctrl+Y bindings
│   │   ├── useTheme.ts                 # Dark/light theme
│   │   └── useValuationCalculations.ts  # Central calculation orchestrator (9.6KB)
│   ├── services/
│   │   ├── stockAPI.ts                  # FMP API client (28.7KB, 729 lines)
│   │   ├── wolfAnalyst.ts              # Groq AI verification (11.4KB)
│   │   └── yahooFinanceAPI.ts          # Yahoo Finance fallback (12KB)
│   ├── utils/
│   │   ├── valuationEngine.ts           # ★ CORE ENGINE — all primary calculations (40KB, 1098 lines)
│   │   ├── valuation.ts                # Convenience wrappers (7.3KB)
│   │   ├── advancedAnalysis.ts          # Reverse DCF, Monte Carlo, Benchmarking, Quality (29KB)
│   │   ├── confidenceScore.ts           # 3-pillar confidence scoring (9.5KB)
│   │   ├── easModules.ts              # EAS/IFRS compliance (8.2KB)
│   │   ├── inputValidation.ts           # Hard blocks, warnings, edge cases (12KB)
│   │   ├── formatters.ts              # Currency/number formatting (6.1KB)
│   │   ├── industryMapping.ts           # Ticker→sector mapping
│   │   ├── excelExport.ts             # Standard Excel export (52KB)
│   │   ├── excelExportPro.ts           # Pro Excel with _Calc sheets (60KB)
│   │   ├── pdfExport.ts              # Native PDF generation (80KB)
│   │   ├── jsonExport.ts             # JSON export per Section 8.4 (5.7KB)
│   │   ├── cn.ts                      # className utility
│   │   ├── calculations/
│   │   │   ├── dcf.ts                 # Pure DCF functions (4.6KB)
│   │   │   ├── comparables.ts          # Comparable company logic (5.1KB)
│   │   │   ├── metrics.ts             # Key metrics & recommendations (4.5KB)
│   │   │   └── scenarios.ts            # Bull/Bear/Base cases (4.3KB)
│   │   └── constants/
│   │       └── scenarioParams.ts       # SINGLE SOURCE OF TRUTH for scenarios (1.4KB)
│   ├── workers/
│   │   └── monteCarlo.worker.ts        # Web Worker for Monte Carlo (5.6KB)
│   └── components/                     # 18 top-level + 6 subdirectories
│       ├── layout/                      # Header, Footer, TabNavigation, CompanyHeader
│       ├── input/                       # InputTab, HistoricalDataPanel, BalanceSheetValidation
│       ├── valuation/                   # ValuationTab + 21 section components
│       ├── charts/                      # ChartsTab with Recharts visualizations
│       ├── dispatch/                    # DispatchPDF export component
│       └── shared/                      # ErrorBoundary, InputField, LoadingFallback
├── .env / .env.example                  # API keys (VITE_FMP_API_KEY, VITE_GROQ_API_KEY)
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## 2. Type System & Data Model

**File**: [financial.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/types/financial.ts)

### Core Data Interfaces

#### `FinancialData` — Primary Input Object
```typescript
interface FinancialData {
  companyName: string;
  ticker: string;
  sharesOutstanding: number;
  currentStockPrice: number;
  dividendsPerShare: number;
  lastReportedDate?: string;
  sector?: string;
  fiscalYearEnd?: string;
  incomeStatement: IncomeStatement;
  balanceSheet: BalanceSheet;
  cashFlowStatement: CashFlowStatement;
  historicalData?: HistoricalYear[];
}
```

#### `IncomeStatement`
Fields: `revenue`, `costOfGoodsSold`, `grossProfit`, `operatingExpenses`, `operatingIncome` (EBIT), `interestExpense`, `taxExpense`, `netIncome`, `depreciation`, `amortization`

#### `BalanceSheet`
- **Current Assets**: `cash`, `marketableSecurities`, `accountsReceivable`, `inventory`, `otherCurrentAssets`, `totalCurrentAssets`
- **Non-Current Assets**: `propertyPlantEquipment`, `longTermInvestments`, `goodwill`, `intangibleAssets`, `otherNonCurrentAssets`, `totalAssets`
- **Liabilities**: `accountsPayable`, `shortTermDebt`, `otherCurrentLiabilities`, `totalCurrentLiabilities`, `longTermDebt`, `otherNonCurrentLiabilities`, `totalLiabilities`
- **Equity**: `totalEquity`, `retainedEarnings?`, `minorityInterest?`, `preferredEquity?`, `endOfServiceProvision?`

#### `CashFlowStatement`
Fields: `operatingCashFlow`, `capitalExpenditures`, `freeCashFlow`, `dividendsPaid`, `netChangeInCash`, `otherFinancingActivities?`

### Key Enum Types

| Type | Values |
|------|--------|
| `CAPMMethod` | `'A'` (Local Currency) / `'B'` (USD Build-Up) |
| `EgyptTaxCategory` | `'standard'` / `'oil_gas'` / `'suez_canal'` / `'free_zone'` / `'custom'` |
| `BetaType` | `'raw'` / `'adjusted'` / `'relevered'` |
| `DiscountingConvention` | `'end_of_year'` / `'mid_year'` |
| `TerminalValueMethod` | `'gordon_growth'` / `'exit_multiple'` |
| `MarketRegion` | `'USA'` / `'Egypt'` |

### `ValuationAssumptions` — All 30+ Assumption Fields

| Category | Field | Default (Egypt) | Description |
|----------|-------|-----------------|-------------|
| DCF | `discountRate` | 23.562% | WACC (auto-calculated) |
| DCF | `terminalGrowthRate` | 8.0% | Gordon Growth terminal rate |
| DCF | `projectionYears` | 5 | Must be {3, 5, 7, 10} |
| DCF | `revenueGrowthRate` | 15% | Annual revenue growth |
| DCF | `taxRate` | 22.5% | Corporate tax rate |
| CAPM | `riskFreeRate` | 22.0% | 10Y Egyptian Gov Bond |
| CAPM | `marketRiskPremium` | 5.5% | Mature Market ERP |
| CAPM | `beta` | 1.2 | vs EGX 30 index |
| CAPM | `capmMethod` | `'A'` | Local Currency CAPM |
| CAPM | `betaType` | `'raw'` | Raw beta |
| Method B | `rfUS` | 4.5% | US 10Y Treasury |
| Method B | `countryRiskPremium` | 7.5% | Damodaran for Egypt |
| Method B | `egyptInflation` | 28.0% | Egypt CPI |
| Method B | `usInflation` | 3.0% | US CPI |
| Debt | `costOfDebt` | 20.0% | Pre-tax Kd |
| Drivers | `ebitdaMargin` | 30.0% | EBITDA / Revenue |
| Drivers | `daPercent` | 8.0% | D&A / Revenue |
| Drivers | `capexPercent` | 10.0% | CapEx / Revenue |
| Drivers | `deltaWCPercent` | 20.0% | ΔWC / ΔRevenue |
| Terminal | `terminalMethod` | `'gordon_growth'` | Gordon or Exit Multiple |
| Terminal | `exitMultiple` | 8.0x | EV/EBITDA exit multiple |
| Discount | `discountingConvention` | `'end_of_year'` | End or Mid year |
| DDM | `dps` | 0.50 | Dividends per share |
| DDM | `ddmHighGrowth` | 15.0% | High-growth dividend rate |
| DDM | `ddmStableGrowth` | 8.0% | Terminal dividend rate |
| DDM | `ddmHighGrowthYears` | 5 | High-growth period |
| Scenarios | `bearProbability` | 25% | Bear case weight |
| Scenarios | `baseProbability` | 50% | Base case weight |
| Scenarios | `bullProbability` | 25% | Bull case weight |

---

## 3. Market Defaults & Egyptian Regulations

**Files**: [marketDefaults.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/constants/marketDefaults.ts), [valuationEngine.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/valuationEngine.ts)

### Market Parameters

| Parameter | USA | Egypt |
|-----------|-----|-------|
| Risk-Free Rate | 4.5% (10Y Treasury) | 22.0% (10Y Gov Bond) |
| Market Risk Premium | 5.5% | 5.5% (Mature ERP only) |
| Country Risk Premium | 0% | 7.5% (Method B only) |
| Terminal Growth | 2.5% | 8.0% |
| Max Terminal Growth | 3.0% | 12.0% |
| Default Tax Rate | 21.0% | 22.5% |
| Currency | USD ($) | EGP |
| CBE Benchmark Rate | — | 27.25% |
| Dividend WHT | — | 10% |
| Capital Gains Tax | — | 10% |

### Egyptian Tax Categories

| Category | Rate | Applies To |
|----------|------|------------|
| Standard (Default) | 22.5% | Most Egyptian companies |
| Industrial Zone | 0% | First 5 years, then reverts to 22.5% |
| Oil & Gas | 40.55% | Petroleum sector |
| Suez Canal / EGPC / CBE | 40.0% | Specific state entities |
| Free Zone | 0% | Free economic zone exports |
| Custom | User-defined | Special cases |

### SME Turnover Tax (Law 6/2025)
For companies with revenue up to EGP 20M, applied to **Revenue** (not EBT):

| Revenue Bracket (EGP) | Tax Rate |
|------------------------|----------|
| Up to 1,000,000 | 0.40% |
| 1,000,001 – 2,000,000 | 0.75% |
| 2,000,001 – 3,000,000 | 1.00% |
| 3,000,001 – 20,000,000 | 1.50% |

### Egyptian Industry Multiples (EGX)

| Sector | P/E | EV/EBITDA | P/S | P/B |
|--------|-----|-----------|-----|-----|
| Banking | 5.5x | N/A | 2.0x | 1.0x |
| Real Estate | 8.0x | 7.0x | 1.5x | 0.8x |
| Telecom | 12.0x | 6.0x | 1.8x | 2.0x |
| Consumer/FMCG | 15.0x | 8.0x | 1.0x | 2.5x |
| Industrial | 7.0x | 5.0x | 0.8x | 1.2x |
| Healthcare | 18.0x | 10.0x | 2.0x | 3.0x |
| Energy | 6.0x | 4.5x | 0.6x | 1.0x |
| EGX Average | 7.0x | 5.0x | 1.2x | 1.5x |

---

## 4. WACC Calculation (Section 3)

**File**: [valuationEngine.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/valuationEngine.ts) — Lines 106-201

### Master Formula

```
WACC = (E/V) × Ke + (D/V) × Kd × (1 − t)
```

Where:
- **E** = Market Capitalization (NOT book equity)
- **D** = Total Debt (Short-term + Long-term)
- **V** = E + D (Total Capital at market values)
- **Ke** = Cost of Equity (from CAPM)
- **Kd** = Pre-tax Cost of Debt
- **t** = Corporate Tax Rate

### Cost of Equity — Dual CAPM Methods

#### Method A — Local Currency CAPM (Default for EGP)
```
Ke = Rf(Egypt) + β × Mature_Market_ERP
```
- **NO Country Risk Premium added** — Egyptian Rf already embeds sovereign risk
- Rf = 22.0% (10-Year Egyptian Government Bond)
- ERP = 5.5% (Damodaran Mature Market ERP)

#### Method B — USD Build-Up
```
Ke(USD) = Rf(US) + β × Mature_ERP + CRP
Ke(EGP) = (1 + Ke_USD) × (1 + Egypt_Inflation) / (1 + US_Inflation) − 1
```
- Uses Fisher equation to convert USD cost of equity to EGP
- CRP = 7.5% (Damodaran for Egypt, Caa1/B- rating)

### Beta Adjustments
- **Raw**: Direct from API/input
- **Adjusted (Bloomberg)**: `Adjusted β = (2/3 × Raw β) + (1/3 × 1.0)`
- **Relevered**: `βL = βU × [1 + (1-t) × (D/E)]` — handled externally

### After-Tax Cost of Debt
```
Kd(after-tax) = Kd × (1 − t)
```

---

## 5. FCFF Three-Way Cross-Verification (Section 4)

**File**: [valuationEngine.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/valuationEngine.ts) — Lines 203-249

All three methods **must produce identical results** (tolerance: ±0.001):

### Method 1 — NOPAT Route (Primary)
```
FCFF = EBIT × (1−t) + D&A − CapEx − ΔWC
```

### Method 2 — EBITDA Route
```
FCFF = EBITDA × (1−t) + D&A × t − CapEx − ΔWC
```

### Method 3 — Net Income Route
```
FCFF = Net Income + Interest × (1−t) + D&A − CapEx − ΔWC
```

> [!CAUTION]
> FCFF must **NEVER** subtract Interest Expense directly. ΔWC increase = cash OUTFLOW (subtracted).

---

## 6. DCF Projections & Valuation (Section 5)

**Files**: [valuationEngine.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/valuationEngine.ts) Lines 251-426, [calculations/dcf.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/calculations/dcf.ts)

### Year-by-Year Projection Chain

For each year `t` from 1 to `projectionYears`:

```
Revenue(t)  = Revenue(t−1) × (1 + Revenue_Growth)
EBITDA(t)   = Revenue(t) × EBITDA_Margin
D&A(t)      = Revenue(t) × DA_Percent
EBIT(t)     = EBITDA(t) − D&A(t)
NOPAT(t)    = EBIT(t) × (1 − Tax_Rate)
CapEx(t)    = Revenue(t) × CapEx_Percent
ΔWC(t)      = (Revenue(t) − Revenue(t−1)) × DeltaWC_Percent
FCFF(t)     = NOPAT(t) + D&A(t) − CapEx(t) − ΔWC(t)
```

### Discounting Convention

| Convention | Period | Formula |
|-----------|--------|---------|
| End of Year | `t` | `DF = (1 + WACC)^t` |
| Mid Year | `t − 0.5` | `DF = (1 + WACC)^(t−0.5)` |

```
PV(FCFF_t) = FCFF_t / DF_t
```

### Terminal Value

#### Gordon Growth Method (Default)
```
TV = FCFF_N × (1 + g) / (WACC − g)
```
- **Hard block**: `g ≥ WACC` → TV = 0, error logged
- Required: `(WACC − g) > 0.0001`

#### Exit Multiple Method
```
TV = EBITDA_N × Exit_Multiple
```

### Present Value of Terminal Value
```
PV(TV) = TV / (1 + WACC)^N
```

### Enterprise Value & EV-to-Equity Bridge
```
Enterprise Value = Σ PV(FCFF) + PV(TV)
Net Debt = Total Debt − Cash
Equity Value = EV − Net Debt
Implied Share Price = Equity Value / Shares Outstanding
```

> [!IMPORTANT]
> **NO `MAX(0)` floor** on Equity Value — it can be negative for distressed companies.

### Verdict Logic (Section 5.5)
```
UNDERVALUED:   Intrinsic > Market Price × 1.10  (>10% upside)
FAIRLY VALUED: Market Price × 0.90 ≤ Intrinsic ≤ Market Price × 1.10
OVERVALUED:    Intrinsic < Market Price × 0.90  (>10% downside)
```

### Investment Recommendation Bands

| Upside | Verdict | Action |
|--------|---------|--------|
| > +30% | UNDERVALUED | STRONG BUY |
| > +10% | UNDERVALUED | BUY |
| ≥ −10% | FAIRLY VALUED | HOLD |
| ≥ −30% | OVERVALUED | SELL |
| < −30% | OVERVALUED | STRONG SELL |

---

## 7. Dividend Discount Models (Section 6)

**File**: [valuationEngine.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/valuationEngine.ts) — Lines 428-510

> [!IMPORTANT]
> All DDM models discount at **Ke** (Cost of Equity), **NOT** WACC.

### 6.1 — Gordon Growth (Single-Stage)
```
P = D₀ × (1 + g) / (Ke − g) = D₁ / (Ke − g)
```

### 6.2 — Two-Stage DDM
```
P = Σ[D₀(1+g₁)^t / (1+Ke)^t] for t=1..n  +  [Dₙ(1+g₂)/(Ke−g₂)] / (1+Ke)^n
```
- Phase 1: High-growth dividends for `n` years at rate `g₁`
- Phase 2: Terminal value using stable rate `g₂`

### 6.3 — H-Model
```
P = D₀ × (1 + gL) / (Ke − gL) + D₀ × H × (gS − gL) / (Ke − gL)
```
Where `H = n/2` (half-life of high-growth period)

### DPS Calculation
Priority: Actual `dividendsPaid / sharesOutstanding` from Cash Flow → `dividendsPerShare` from input → `dps` assumption

### Applicability Checks
- DDM returns `N/A` if company pays no dividends (`dps ≤ 0`)
- DDM returns `N/A` if Net Income is negative (unsustainable dividend)

---

## 8. Comparable Company Valuation

**Files**: [valuationEngine.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/valuationEngine.ts) Lines 512-583, [calculations/comparables.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/calculations/comparables.ts)

### Four Valuation Methods

| Method | Formula |
|--------|---------|
| **P/E** | Implied Price = EPS × Median P/E |
| **EV/EBITDA** | Implied EV = EBITDA × Multiple → Equity = EV − Debt + Cash → Per Share |
| **P/S** | Implied Price = Revenue/Share × Median P/S |
| **P/B** | Implied Price = Book Value/Share × Median P/B |

### Blended Comparable Weights

| Sector | P/E | EV/EBITDA | P/S | P/B |
|--------|-----|-----------|-----|-----|
| **Standard** | 40% | 35% | 15% | 10% |
| **Financial/Banks** | 60% | 0% | 0% | 40% |

> Banks: EV/EBITDA is not meaningful — redistributed to P/E and P/B.

### Multiples Source Priority
1. User-added comparable companies (median of valid peers)
2. Industry defaults from `EGYPTIAN_INDUSTRY_MULTIPLES` or `DEFAULT_INDUSTRY_MULTIPLES`

---

## 9. Blended Valuation

**File**: [valuationEngine.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/valuationEngine.ts) — Lines 585-643

```
Blended Value = DCF × (DCF_Weight / 100) + Comps × (Comps_Weight / 100)
```
- Default: **60% DCF / 40% Comps** (adjustable via slider)
- If no valid comps: 100% DCF, 0% Comps
- Upside = `(Blended − Price) / Price × 100`

---

## 10. Financial Ratios (Section 7)

**Files**: [valuationEngine.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/valuationEngine.ts) Lines 645-742, [calculations/metrics.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/calculations/metrics.ts)

### Profitability Ratios
| Ratio | Formula |
|-------|---------|
| Gross Margin | `(Revenue − COGS) / Revenue × 100` |
| EBITDA Margin | `EBITDA / Revenue × 100` |
| EBIT Margin | `EBIT / Revenue × 100` |
| Net Margin | `Net Income / Revenue × 100` |
| ROE | `Net Income / Total Equity × 100` |
| ROA | `Net Income / Total Assets × 100` |
| ROIC | `NOPAT / Invested Capital × 100` where IC = Equity + Debt − Cash |

> [!NOTE]
> ROIC uses statutory tax rate (22.5%) for NOPAT, not effective tax rate.

### Leverage Ratios
| Ratio | Formula |
|-------|---------|
| Debt/Equity | `Total Debt / Total Equity` |
| Net Debt/EBITDA | `(Total Debt − Cash) / EBITDA` |
| Interest Coverage | `EBIT / Interest Expense` (999 if no interest) |

### Liquidity Ratios
| Ratio | Formula |
|-------|---------|
| Current Ratio | `Current Assets / Current Liabilities` |
| Quick Ratio | `(Cash + AR) / Current Liabilities` |

### Efficiency Ratios
| Ratio | Formula |
|-------|---------|
| DSO | `365 / (Revenue / AR)` |
| DIO | `365 / (COGS / Inventory)` |
| DPO | `365 / (COGS / AP)` |
| Cash Conversion Cycle | `DSO + DIO − DPO` |

### Value Creation
| Ratio | Formula |
|-------|---------|
| EVA | `NOPAT − (Invested Capital × WACC)` |
| ROIC-WACC Spread | `ROIC − WACC` |

### Valuation Multiples
Trailing P/E, Forward P/E, EV/EBITDA, EV/EBIT, EV/Revenue, P/B, P/S, P/CF, PEG Ratio, Dividend Yield, Earnings Yield, FCF Yield

### Quality Scores
- **Altman Z-Score**: `1.2×(WC/TA) + 1.4×(RE/TA) + 3.3×(EBIT/TA) + 0.6×(MCap/TL) + (Rev/TA)`
- **Piotroski F-Score**: 9-point scoring (placeholder — TODO)

---

## 11. Sensitivity Analysis (Section 8)

**File**: [valuationEngine.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/valuationEngine.ts) — Lines 744-812

### 5×5 WACC × Terminal Growth Matrix
- **WACC axis**: Base ± 4%, ± 2% (5 values)
- **Growth axis**: Base ± 3%, ± 1.5% (5 values, floored at 4%, capped at WACC−1%)

Each cell recalculates the full DCF: Sum PV(FCFF) → Terminal Value → PV(TV) → EV → Equity → Implied Price

Color coding: 🟢 Green (>10% upside), 🟡 Yellow (±10%), 🔴 Red (>10% downside)

---

## 12. Scenario Analysis (Section 8.2)

**Files**: [valuationEngine.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/valuationEngine.ts) Lines 814-872, [constants/scenarioParams.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/constants/scenarioParams.ts), [calculations/scenarios.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/calculations/scenarios.ts)

### SCENARIO_PARAMS — Single Source of Truth

| Parameter | Bear | Base | Bull |
|-----------|------|------|------|
| Revenue Growth Multiplier | ×0.40 | ×1.00 | ×2.00 |
| WACC Adjustment (pp) | +2.50 | 0.00 | −2.50 |
| EBITDA Margin Adj/Year | −1.5pp | 0.00 | +2.5pp |
| Terminal Growth Multiplier | ×0.75 | ×1.00 | ×1.25 |

### Probability-Weighted Value
```
Weighted Value = P(Bear)×V(Bear) + P(Base)×V(Base) + P(Bull)×V(Bull)
               = 25% × Bear + 50% × Base + 25% × Bull
```

Safety: Terminal growth is always clamped to `WACC − 1` if it exceeds WACC.

---

## 13. Reverse DCF (Section 8.3)

**Files**: [valuationEngine.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/valuationEngine.ts) Lines 874-920, [advancedAnalysis.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/advancedAnalysis.ts) Lines 1-121

### Analytical Method (valuationEngine.ts)
Solves for implied terminal growth rate from market price:
```
Observed EV = Market Cap + Debt − Cash
Required PV(TV) = Observed EV − Σ PV(FCFF)
Implied TV = Required PV(TV) × (1+WACC)^N
g = (TV × WACC − FCFF_N) / (TV + FCFF_N)
```

### Binary Search Method (advancedAnalysis.ts)
Uses 100-iteration binary search over revenue growth rates (−10% to +50%) to find the implied growth rate that matches the market price. Uses full FCFF buildup for each iteration.

### Market Expectation Classification
| Gap (Implied − Base) | Classification |
|----------------------|----------------|
| > +5pp | Aggressive |
| −5pp to +5pp | Reasonable |
| < −5pp | Conservative |

---

## 14. Monte Carlo Simulation

**Files**: [advancedAnalysis.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/advancedAnalysis.ts) Lines 122-296, [monteCarlo.worker.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/workers/monteCarlo.worker.ts)

### Configuration
- **Simulations**: 5,000 runs (default)
- **Random distribution**: Gaussian (Box-Muller transform)
- **Execution**: Web Worker (off main thread)

### Parameter Variations (Standard Deviations)

| Parameter | Base | Std Dev |
|-----------|------|---------|
| Revenue Growth | User input | ±4% |
| WACC | User input | ±1.5% |
| Terminal Growth | User input | ±0.8% |
| EBITDA Margin | User input | ±1.5% |

### Output Statistics
- Mean, Median, Standard Deviation
- Percentiles: P5, P25, P75, P95
- Probability above current price, probability above base case
- 20-bucket histogram distribution

### Safety Constraints
- Terminal growth clamped to `WACC − 0.5`
- WACC floored at 2%
- Outlier filter: price must be < 10× current price and > 0
- Fallback TV: `FCFF × 12` if `WACC − g < 0.1`

---

## 15. Advanced Analysis Modules

**File**: [advancedAnalysis.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/advancedAnalysis.ts)

### Sector Benchmarking (Lines 298-460)
Compares company metrics against sector medians across 10 dimensions:
- Gross Margin, Operating Margin, Net Margin, ROE, ROA, FCF Margin
- Debt/Equity (lower is better), Current Ratio, P/E (lower is better), EV/EBITDA (lower is better)

Sectors: TECH, FINANCE, DEFAULT (EGX-calibrated)

Overall rating: Excellent / Above Average / Average / Below Average

### Quality Scorecard (Lines 462-679)
Four-pillar scoring system (total 40 points):

| Pillar | Max Score | Factors |
|--------|-----------|---------|
| Economic Moat | 10 | Gross Margin, Operating Margin, ROE, Market Position |
| Financial Health | 10 | Current Ratio, D/E, Interest Coverage, Cash/Debt |
| Growth & Profitability | 10 | Net Margin, FCF Generation, Earnings Quality |
| Capital Allocation | 10 | CapEx/Revenue, Dividend Payout, FCF Conversion, Cash Accumulation |

### Quality Grade & Premium

| Score % | Grade | Valuation Premium |
|---------|-------|-------------------|
| ≥ 85% | A+ | +15% |
| ≥ 75% | A | +10% |
| ≥ 65% | B+ | +5% |
| ≥ 55% | B | 0% |
| ≥ 45% | C | −5% |
| ≥ 35% | D | −10% |
| < 35% | F | −15% |

---

## 16. EAS Compliance Modules

**File**: [easModules.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/easModules.ts)

### EAS 48 (IFRS 16) — Lease Adjustments
```
ROU Asset = PMT × [(1 − (1+IBR)^−n) / IBR]    ← PV of annuity
Lease Liability = ROU Asset
Annual Depreciation = ROU / n                    ← straight-line
Interest Expense = Liability × IBR               ← Year 1
EBITDA Add-back = Full annual lease payment
Post-Adjustment Debt = Pre-Debt + Lease Liability
```

### EAS 31 (IAS 1) — Normalized Earnings
```
Gross Adjustment = Σ all non-recurring items
Tax Effect = Σ (tax-affected items × tax rate)
Net Adjustment = Gross − Tax Effect
Normalized NI = Reported NI + Net Adjustment
Normalized EPS = Normalized NI / Shares
```

### EAS 12 (IAS 12) — Deferred Tax in EV Bridge
```
Net DTA = DTA − DTL
Adjusted Equity = Base Equity + Net DTA
```
- Net DTA > 0 → adds to equity (future tax savings)
- Net DTL > 0 → reduces equity (future tax obligations)

### EAS 23 (IAS 33) — Basic & Diluted EPS
```
Basic EPS = Net Income / Basic Shares
Diluted EPS = (NI + Convertible Interest) / Diluted Shares
```
- **Anti-dilution check**: If Diluted EPS > Basic EPS → use Basic EPS

---

## 17. Confidence Score (Section 7.1)

**File**: [confidenceScore.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/confidenceScore.ts)

### Three-Pillar System (0–100 points)

#### Pillar 1: Data Quality (30 points)
| Check | Points | Condition |
|-------|--------|-----------|
| D&A > 0 | 5 | Depreciation present |
| CapEx > 0 | 5 | Capital expenditures reported |
| Interest consistency | 5 | Implied rate 0–30% |
| EBITDA > 0 | 5 | Positive operating profits |
| Revenue > 0 | 5 | Revenue present |
| Shares > 0 | 5 | Shares outstanding valid |

#### Pillar 2: Assumption Reasonableness (40 points)
| Check | Points | Condition |
|-------|--------|-----------|
| Revenue growth ≤ 25% | 8 | Reasonable growth |
| EBITDA margin ≤ 50% | 8 | Realistic margins |
| Terminal g < GDP (~6%) | 8 | Sustainable rate |
| WACC 15–35% (Egypt) | 8 | Egypt-calibrated range |
| FCFF 3-way reconciles | 8 | All methods match |

#### Pillar 3: Model Robustness (30 points)
| Check | Points | Condition |
|-------|--------|-----------|
| TV < 80% of EV | 10 | Not terminal-dominated |
| Value within ±50% of market | 10 | Reasonable deviation |
| DCF/DDM directional agreement | 5 | Same buy/sell signal |
| Interest coverage > 1.5x | 5 | Can service debt |

### Grades
| Score | Grade |
|-------|-------|
| ≥ 85 | A |
| ≥ 70 | B |
| ≥ 55 | C |
| ≥ 40 | D |
| < 40 | F |

---

## 18. Input Validation

**File**: [inputValidation.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/inputValidation.ts)

### Hard Blocks (Must fix — calculation blocked)

| ID | Field | Rule |
|----|-------|------|
| HB-1 | Revenue | ≥ 0 |
| HB-2 | Tax Rate | 0–60% |
| HB-3 | Risk-Free Rate | 0–40% |
| HB-4 | ERP | 0–20% |
| HB-5 | Cost of Debt | 0–50% |
| HB-6 | Terminal Growth | < WACC |
| HB-7 | Shares Outstanding | > 0 |
| HB-8 | Projection Years | ∈ {3, 5, 7, 10} |

### Soft Warnings (Calculation proceeds)

| ID | Condition |
|----|-----------|
| W-1 | Negative EBITDA |
| W-2 | Beta < 0 or > 2.5 |
| W-3 | Terminal growth > 10% |
| W-4 | CapEx < D&A (underinvestment) |
| W-5 | Interest coverage < 1.5x |
| W-6 | Dividend payout > 100% |
| W-7 | Revenue growth > 25% |
| W-8 | Terminal value > 85% of EV |
| W-9 | Negative book equity |

### Edge Cases (Auto-adjusted with explanation)

| ID | Condition | Effect |
|----|-----------|--------|
| EC-1 | All-equity firm (no debt) | WACC = Ke |
| EC-2 | Net cash position | Equity > EV |
| EC-3 | Zero dividends | DDM returns N/A |
| EC-4 | WACC > 30% | Aggressive discounting warning |
| EC-5 | Exit multiple method | Uses EBITDA × multiple |

---

## 19. Valuation Styles

**File**: [valuationStyles.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/constants/valuationStyles.ts)

| Adjustment | Conservative | Moderate | Aggressive |
|-----------|-------------|----------|-----------|
| Revenue Growth Mult | ×0.7 | ×1.0 | ×1.4 |
| WACC Add (pp) | +1.5 | 0 | −1.0 |
| Terminal Growth Mult | ×0.8 | ×1.0 | ×1.2 |
| Multiple Mult | ×0.8 | ×1.0 | ×1.3 |
| Margin Change | −0.5 | 0 | +1.0 |

These are applied **on top of** scenario adjustments in `useValuationCalculations`.

---

## 20. Stock Data API

**File**: [stockAPI.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/services/stockAPI.ts)

### Provider: Financial Modeling Prep (FMP) — Stable API (2026 format)

**Base URL**: `https://financialmodelingprep.com/stable/`

### Endpoints Used

| Endpoint | Purpose | Params |
|----------|---------|--------|
| `/profile` | Company info, price, beta, shares | `symbol` |
| `/income-statement` | IS data | `symbol&period=annual&limit=1` |
| `/balance-sheet-statement` | BS data | `symbol&period=annual&limit=1` |
| `/cash-flow-statement` | CF data | `symbol&period=annual&limit=1` |
| `/ratios-ttm` | TTM valuation ratios | `symbol` |

### Smart Data Handling
- **Shares Outstanding**: Priority — API direct → mktCap/price → 1B fallback
- **Interest Expense**: If API reports 0 but debt exists, assumes 2.8% cost of debt
- **Banks**: If sector is Financial and COGS=0, uses Interest Expense as cost of revenue
- **Long-term Investments**: Heuristic reclassification if >40% of non-current assets are unclassified
- **Dividends**: Fallback chain: `commonDividendsPaid` → `netDividendsPaid` → `dividendsPaid`
- **Egyptian Detection**: `.CA` suffix auto-switches to Egypt market defaults

### Peer Company System
Pre-mapped peer groups for US (AAPL→MSFT,GOOGL,AMZN,META) and Egyptian markets (COMI.CA→QNBA.CA,ADIB.CA,FAISAL.CA,SAIB.CA)

---

## 21. WOLF Analyst (AI Verification)

**File**: [wolfAnalyst.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/services/wolfAnalyst.ts)

### Configuration
- **API**: Groq (`api.groq.com/openai/v1/chat/completions`)
- **Model**: `llama3-70b-8192`
- **Max Tokens**: 2,000
- **Rate Limit**: 10-second minimum between calls

### Modes
1. **Verify**: Full audit of all engine outputs with detailed math verification
2. **Chat**: Free-form financial analysis questions

### Verification Prompt
Includes complete financial statements, all assumptions, FCFF verification results, DCF projections, scenario analysis, DDM results, and blended valuation. AI must mark each check as ✅ / ⚠️ / ❌.

---

## 22. Export Systems

### JSON Export ([jsonExport.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/jsonExport.ts))
Full `ValuationJSON` schema with:
- `metadata`: engine version, date, currency, CAPM method, discounting convention
- `inputs`: all financial data and assumptions
- `calculated`: WACC, DCF (with projections + EV bridge), DDM, multiples, sensitivity, ratios, FCFF verification, scenarios

### Excel Export ([excelExport.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/excelExport.ts), [excelExportPro.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/excelExportPro.ts))
- **Standard**: Multi-sheet workbook with formatted financial statements
- **Pro**: Hidden `_Calc_Base`, `_Calc_Bear`, `_Calc_Bull` sheets with live formulas
- Uses `xlsx-js-style` for professional formatting

### PDF Export ([pdfExport.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/utils/pdfExport.ts))
- Native jsPDF generation (80KB of code)
- Full report with cover page, financial statements, DCF projections, sensitivity matrix, football field chart, scenario analysis

---

## 23. State Management & Hooks

### [useFinancialData.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/hooks/useFinancialData.ts) — Central State
- Manages `financialData`, `assumptions`, `comparables`
- History-integrated setters (undo/redo)
- Auto-save to `localStorage` with 1-second debounce
- Auto-detects Egyptian stocks by `.CA` suffix

### [useValuationCalculations.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/hooks/useValuationCalculations.ts) — Orchestrator
Central `useMemo`-based hook that computes ALL derived values:
- Adjusted assumptions (scenario × style)
- DCF projections and value
- Scenario cases (Bear/Base/Bull)
- Comparable valuations
- Blended value and upside
- Key metrics and recommendation
- Football field data
- Chart data arrays

### [useHistory.ts](file:///c:/Users/user/Desktop/ValuationEngine/src/hooks/useHistory.ts)
Stack-based undo/redo with Ctrl+Z / Ctrl+Y keyboard shortcuts.

---

## 24. UI Components

### Layout Components
| Component | Purpose |
|-----------|---------|
| `Header.tsx` | App header with market selector, theme toggle |
| `CompanyHeader.tsx` | Company name, price, market cap display |
| `TabNavigation.tsx` | Input / Valuation / Charts tab switcher |
| `Footer.tsx` | Version info |

### Input Components
| Component | Purpose |
|-----------|---------|
| `InputTab.tsx` (62KB) | Main financial data input form — all IS/BS/CF fields |
| `HistoricalDataPanel.tsx` | Multi-year historical data entry |
| `BalanceSheetValidation.tsx` | Assets = Liabilities + Equity check |
| `AssumptionsPanel.tsx` | All WACC/DCF/DDM assumption inputs |
| `StockSearch.tsx` | Ticker search with FMP API lookup |
| `DebouncedInput.tsx` | Performance-optimized number inputs |

### Valuation Components
| Component | Purpose |
|-----------|---------|
| `ValuationTab.tsx` | Main valuation results page |
| `ValuationSummaryCards.tsx` | DCF/Comps/Blended value cards |
| `DCFProjectionsTable.tsx` | Year-by-year projection table |
| `BaseYearFCF.tsx` | Base year FCFF reconciliation |
| `FCFFReconciliation.tsx` | 3-way FCFF verification display |
| `EVBridgeChart.tsx` | EV → Equity bridge waterfall |
| `ScenarioAnalysis.tsx` | Bear/Base/Bull cards |
| `DDMValuation.tsx` | Gordon/Two-Stage/H-Model results |
| `KeyMetricsGrid.tsx` | 20+ financial metrics dashboard |
| `ConfidenceScore.tsx` | 3-pillar confidence breakdown |
| `PiotroskiFScore.tsx` | Piotroski 9-point breakdown |
| `FXSensitivity.tsx` | Currency sensitivity analysis |
| `EASComplianceSection.tsx` | EAS 48/31/12/23 module UI |
| `WorkingCapitalDetail.tsx` | DSO/DIO/DPO/CCC detail |
| `ValidationAlerts.tsx` | Hard blocks, warnings, edge cases |
| `ReverseDCFSection.tsx` | Market-implied growth display |
| `MarketVsFundamental.tsx` | Market price vs intrinsic comparison |
| `QualityScorecard.tsx` | 4-pillar quality grade |
| `BlendedWeightSlider.tsx` | DCF/Comps weight adjuster |
| `ValuationStyleSelector.tsx` | Conservative/Moderate/Aggressive |
| `SaveLoadPanel.tsx` | JSON save/load valuation state |
| `FootballFieldChart.tsx` | Valuation range comparison |
| `ComparableCompanies.tsx` | Peer company management |

### Other Key Components
| Component | Purpose |
|-----------|---------|
| `WolfAnalystPanel.tsx` | AI chat/verification panel |
| `AIReport.tsx` | AI-generated analysis report |
| `ChartsTab.tsx` (29KB) | Revenue/FCFF/EBITDA charts, sensitivity heatmap, scenario bar chart |
| `DispatchPDF.tsx` (37KB) | PDF generation orchestrator |
| `ScenarioToggle.tsx` | Bull/Bear/Base scenario selector |
| `HowToBuildModal.tsx` | User guide/tutorial modal |
| `QuickStartGuide.tsx` | Getting started walkthrough |
| `UserAuth.tsx` | User authentication |
| `APIKeyModal.tsx` | FMP API key entry |
| `Tooltip.tsx` | Information tooltips |

---

## 25. Complete File Index

### Source Files (by directory)

| Path | Size | Lines | Purpose |
|------|------|-------|---------|
| `src/types/financial.ts` | 14KB | 465 | All TypeScript interfaces |
| `src/utils/valuationEngine.ts` | 40KB | 1098 | ★ Core engine |
| `src/utils/advancedAnalysis.ts` | 29KB | 679 | Reverse DCF, Monte Carlo, Benchmarks, Quality |
| `src/utils/pdfExport.ts` | 80KB | — | PDF generation |
| `src/utils/excelExportPro.ts` | 60KB | — | Pro Excel with _Calc sheets |
| `src/utils/excelExport.ts` | 52KB | — | Standard Excel export |
| `src/utils/inputValidation.ts` | 12KB | 353 | Validation rules |
| `src/utils/confidenceScore.ts` | 9.5KB | 186 | 3-pillar confidence |
| `src/utils/easModules.ts` | 8.2KB | 232 | EAS/IFRS compliance |
| `src/utils/valuation.ts` | 7.3KB | 207 | Convenience wrappers |
| `src/utils/formatters.ts` | 6.1KB | 203 | Number/currency formatting |
| `src/utils/jsonExport.ts` | 5.7KB | 144 | JSON export |
| `src/utils/calculations/dcf.ts` | 4.6KB | 111 | Pure DCF functions |
| `src/utils/calculations/comparables.ts` | 5.1KB | 131 | Comparable calculations |
| `src/utils/calculations/metrics.ts` | 4.5KB | 96 | Metrics & recommendations |
| `src/utils/calculations/scenarios.ts` | 4.3KB | 112 | Scenario calculations |
| `src/utils/constants/scenarioParams.ts` | 1.4KB | 33 | Scenario single source of truth |
| `src/utils/industryMapping.ts` | 1.8KB | 36 | Ticker → sector mapping |
| `src/utils/cn.ts` | 169B | — | className merge utility |
| `src/services/stockAPI.ts` | 29KB | 729 | FMP API client |
| `src/services/wolfAnalyst.ts` | 11KB | 290 | Groq AI service |
| `src/services/yahooFinanceAPI.ts` | 12KB | — | Yahoo Finance fallback |
| `src/hooks/useValuationCalculations.ts` | 9.6KB | 209 | Calculation orchestrator |
| `src/hooks/useFinancialData.ts` | 8.7KB | 215 | State management |
| `src/hooks/useHistory.ts` | 2.7KB | — | Undo/redo |
| `src/hooks/useTheme.ts` | 1.1KB | — | Theme toggle |
| `src/hooks/useKeyboardShortcuts.ts` | 1.6KB | — | Keyboard bindings |
| `src/workers/monteCarlo.worker.ts` | 5.6KB | 143 | Web Worker |
| `src/constants/initialData.ts` | 3.6KB | 115 | Default data |
| `src/constants/marketDefaults.ts` | 5.4KB | 96 | Market parameters |
| `src/constants/valuationStyles.ts` | 1.2KB | 44 | Style presets |
| `src/data/sampleData.ts` | 1.9KB | — | Sample data |
| `src/App.tsx` | 12.4KB | — | Main app shell |
| `src/main.tsx` | 375B | — | Entry point |
| `src/index.css` | 7KB | — | Global styles |

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `VITE_FMP_API_KEY` | Financial Modeling Prep API key |
| `VITE_GROQ_API_KEY` | Groq API key for WOLF Analyst |

---

> [!TIP]
> **For any future development**: The single most important file is `valuationEngine.ts` (1098 lines) — it contains WACC, FCFF, DCF, DDM, Comparable, Blended, Sensitivity, Scenario, Reverse DCF, Ratios, and Validation. The `useValuationCalculations.ts` hook is the orchestrator that wires everything together in the UI.
