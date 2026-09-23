# Methodology

This document is the specification of the WOLF valuation core. The TypeScript engine (`src/engine/`) and the independent Python reference (`scripts/reference/wolf_reference.py`) both implement it. When they disagree, one of them is wrong about this document.

References: A. Damodaran, *Investment Valuation* (3rd ed.) and Damodaran Online datasets; T. Koller, M. Goedhart, D. Wessels (McKinsey & Company), *Valuation: Measuring and Managing the Value of Companies*, 7th ed. (2020); CFA Institute, CFA Program Curriculum, Equity Valuation readings (free cash flow valuation, discounted dividend valuation, market-based valuation).

## 0. Conventions

- Percent inputs are stored in percent units (10 = 10%) and converted to decimals in formulas.
- Statement lines carry their reported sign (costs negative). D&A from the notes is positive.
- "Base year" (year 0) is the latest historical fiscal year. Projection years are t = 1..N (default N = 5, maximum 10). Year N+1 is the terminal year.
- All registry inputs are read by id from a frozen rates snapshot. A rate override (value plus mandatory reason) replaces the registry value and is shown next to it.
- Every assumption carries a tag: *Sourced fact*, *Analyst assumption* or *Estimate*.

## 1. Timeline (valuation date, stub, discount timing)

Inputs: valuation date V, fiscal year end FYE_t of each projection year, mid-year toggle (default ON).

- FYE_0 is the base-year end. FYE_t = FYE_0 moved forward t years.
- Period 1 starts at S_1 = max(V, FYE_0) and ends at FYE_1. Stub fraction f_1 = YEARFRAC(V, FYE_1, basis 1) when V > FYE_0, else 1. It is an error if V > FYE_1; V = FYE_1 gives f_1 = 0.
- Periods t ≥ 2 run from FYE_{t−1} to FYE_t with f_t = 1.
- YEARFRAC basis 1 (actual/actual) follows Excel: if both dates are in the same calendar year, days / (366 if leap else 365); if the span is at most one year, days / 366 when a 29 February lies in the span (inclusive of the end date), else 365; otherwise days / average length of the calendar years spanned.
- Discount date d_t: mid-year ON: S_t + (FYE_t − S_t)/2 (in days, may be fractional); mid-year OFF: FYE_t.
- Years from valuation date: y_t = (d_t − V) / 365.
- Discount factor: DF_t = (1 + WACC)^(−y_t).
- Terminal value is discounted from the final period end: y_TV = (FYE_N − V) / 365, DF_TV = (1 + WACC)^(−y_TV).
- The cash flow included for period t is f_t × FCFF_t (the year-1 cash flow is scaled by the stub fraction).

Limitation stated on every output: the bridge uses the latest audited balance sheet; cash generated and dividends paid between FYE_0 and V are not captured.

## 2. Normalization

Normalized EBIT = reported operating profit − Σ (amount of each included adjustment), with amounts signed as reported (removing a reversal of +357 lowers EBIT by 357).

Default adjustments for EAS/IFRS statements (each tagged *Analyst assumption*, user-editable, created only when the amount is non-zero in the base year):

| Id | Line | Amount |
|---|---|---|
| ecl | ECL reversal / (charge) | income.eclReversal |
| impairment | Impairment reversal | income.impairmentReversal |
| provisions | Provisions no longer required (inside other income) | income.provisionsReleased |
| capitalGains | Capital gains / (losses) on disposals | income.capitalGains |

D&A_0 = depreciation + amortization. Normalized EBITDA = normalized EBIT + D&A_0. Reported EBITDA = reported operating profit + D&A_0.

Finance income and FX translation gains/losses are non-operating and excluded from FCFF; their balance-sheet counterparts enter the bridge (section 5.3).

## 3. Forecast

### 3.1 Base-year ratios (seed drivers)

With R_0 revenue, GP_0 gross profit, SM_0 and GA_0 the selling and G&A lines (negative), D&A_0 as above, EBIT*_0 normalized EBIT:

- Gross margin before D&A: GMx = (GP_0 + D&A_0) / R_0. All D&A is assumed to sit in cost of sales; this affects the gross-margin presentation only, not EBITDA or EBIT.
- SG&A % revenue: SGA = −(SM_0 + GA_0) / R_0.
- Other operating (net) % revenue: OTH = (EBIT*_0 − GP_0 − SM_0 − GA_0) / R_0.
- Cash cost of sales: CC_0 = R_0 × (1 − GMx) = −cost of sales − D&A_0.
- DSO = receivables / R_0 × 365; DIO = inventory / CC_0 × 365; DPO = trade payables / CC_0 × 365.
- Other operating current assets OCA_0 = other current assets + supplier advances + due from related parties; OCA% = OCA_0 / R_0.
- Other operating current liabilities OCL_0 = other payables + customer advances + provisions + due to related parties + other current liabilities; OCL% = OCL_0 / R_0.
  Excluded from operating working capital: current tax payable (taxes are in NOPAT), lease liabilities (debt), employee benefit obligations (bridge), restricted cash (memo).
- NWC_0 = receivables + inventory + OCA_0 − trade payables − OCL_0.
- D&A % revenue: DA% = D&A_0 / R_0.
- Depreciation rate: DEP = depreciation_0 / opening PP&E, where opening PP&E is the prior-year closing PP&E (or the base-year closing PP&E if no prior year).
- Amortization % revenue: AM% = amortization_0 / R_0.
- Capex % revenue: CPX = −capex_0 / R_0.
- Revenue growth: g_R = R_0 / R_{−1} − 1 (0 if no prior year).
- Tax rate for NOPAT: the statutory corporate income tax rate (registry `eg.cit`). The effective rate is shown separately.

### 3.2 Default per-year drivers

Year-1 drivers equal the seed drivers. Terminal-year drivers (section 3.4) equal the seed drivers except: revenue growth = terminal growth g; capex % revenue = the value-driver-consistent level of section 3.4. With the linear fade ON (default), each driver in year t (t = 1..N) is

  x_t = x_seed + (x_terminal − x_seed) × (t − 1) / (N − 1)   (N > 1; x_1 = x_seed when N = 1),

so year N carries the terminal-year drivers. Drivers are then stored explicitly per year and are user-editable.

### 3.3 Operating model (years t = 1..N, and the terminal year N+1)

- R_t = R_{t−1} × (1 + g_t)
- EBITDA_t = R_t × (GMx_t − SGA_t + OTH_t)
- D&A:
  - % revenue mode: D&A_t = R_t × DA%_t (shown as a single line).
  - PP&E roll-forward mode (default): Opening_t = Closing_{t−1} (Closing_0 = base-year PP&E); Dep_t = DEP_t × Opening_t; Am_t = R_t × AM%_t; D&A_t = Dep_t + Am_t; Closing_t = Opening_t + Capex_t − Dep_t.
- EBIT_t = EBITDA_t − D&A_t; Tax_t = EBIT_t × τ_t; NOPAT_t = EBIT_t − Tax_t.
- Capex_t = R_t × CPX_t (or an absolute amount per year).
- CC_t = R_t × (1 − GMx_t); AR_t = R_t × DSO_t / 365; INV_t = CC_t × DIO_t / 365; AP_t = CC_t × DPO_t / 365; OCA_t = R_t × OCA%_t; OCL_t = R_t × OCL%_t.
- NWC_t = AR_t + INV_t + OCA_t − AP_t − OCL_t; ΔNWC_t = NWC_t − NWC_{t−1}.
- Forecast net profit (used only as the distribution base and for forward P/E): NP_t = NOPAT_t + NFI × (1 − τ_t), where NFI is the annual net finance income, default = base-year finance income + all base-year finance costs (held flat, *Analyst assumption*). NP_0 = reported net profit.
- Employee and board profit distributions (Egypt; toggle default ON for country EG): Dist_t = p × NP_{t−1}, p default = base-year distributions paid ÷ prior-year net profit (*Analyst assumption, based on FY2025 actual*). Under EAS these distributions go through equity, but they are a recurring cash payment to non-shareholders, so they are deducted from free cash flow to the firm.
- FCFF_t = NOPAT_t + D&A_t − Capex_t − ΔNWC_t − Dist_t.

### 3.4 Terminal year and the value-driver default for capex

The terminal year N+1 applies the terminal drivers to R_N with growth g. The default terminal capex % revenue makes net reinvestment consistent with the value-driver formula (McKinsey): reinvestment rate RR = g / RONIC, RONIC default = WACC (conservative: new investment earns its cost of capital).

  CPX_T = DA%_seed − NWC%_T × g / (1 + g) + RR × (GMx_T − SGA_T + OTH_T − DA%_seed) × (1 − τ)

where NWC%_T = (DSO/365 + (1 − GMx_T)(DIO − DPO)/365 + OCA% − OCL%) evaluated at seed drivers. The default is computed once, when the default assumptions are built, from the base-case WACC; it is then an ordinary editable input.

## 4. Cost of capital

### 4.1 Risk-free rate (user selects; default (a))

| Source | Registry id | Nature |
|---|---|---|
| (a) EGP 10Y secondary-market YTM | `eg.bond10ySecondary` | market quote |
| (b) latest CBE auction yield for a tenor | `eg.tbondAuction.<n>y` | official |
| (c) Damodaran inflation-based EGP riskfree | `damodaran.rf.egp` | estimate ("clean") |
| (d) Fisher-converted US 10Y | (1 + `us.treasury10y`) × (1 + `damodaran.expectedInflation.egp`) / (1 + `damodaran.expectedInflation.usd`) − 1 | derived ("clean") |

(a) and (b) are local-currency government yields and already contain Egypt's sovereign default risk. (c) and (d) are clean of it.

### 4.2 Beta

- Default: bottom-up. βU = Damodaran emerging-markets "unlevered beta corrected for cash" for the selected industry (`damodaran.betas.emerging`; MOPCO default "Chemical (Basic)").
- D = interest-bearing debt = bank debt + bonds + lease liabilities (book value as the market-value proxy). E = price × diluted shares.
- βL = βU × (1 + (1 − t_r) × D/E), t_r = relevering tax rate (default `eg.cit`).
- Cross-checks shown but not used: Blume-adjusted beta = 2/3 × βL + 1/3; regression beta when the user supplies a price series.

### 4.3 Cost of equity (ERP = `damodaran.matureErp`, CRP = `damodaran.egypt.crp`, SP = size/illiquidity premium, default 0)

| Method | Formula | Use with |
|---|---|---|
| local_rf (default) | Ke = Rf + βL × ERP + SP | local government Rf (a)/(b); country risk is inside Rf |
| A | Ke = Rf + βL × ERP + CRP + SP | clean Rf (c)/(d) |
| B | Ke = Rf + βL × (ERP + CRP) + SP | clean Rf |
| C | Ke = Rf + βL × ERP + λ × CRP + SP | clean Rf |

Warnings: A/B/C with a local Rf double-counts country risk; local_rf with a clean Rf omits it.

### 4.4 Cost of debt

- (a) Synthetic rating (default): interest coverage = normalized EBIT ÷ (debt interest + lease interest), using debt interest only (employee-benefit interest excluded). Rating and spread from the Damodaran table (`damodaran.synthetic.small` when market capitalisation converted at `eg.usdEgp` is below USD 5bn, else `.large`); a zero interest charge gives the top row. Kd = Rf + spread, plus the country default spread (`damodaran.egypt.defaultSpread`) only when Rf is clean.
- (b) CBE lending + spread: Kd = `cbe.overnightLending` + user spread.
- (c) Actual: (debt interest + lease interest) ÷ average of opening and closing interest-bearing debt.
- After-tax Kd = Kd × (1 − `eg.cit`).

### 4.5 Weights and WACC

Market weights (default): E/V = E / (E + D), D/V = D / (E + D). Target weights: D/V = user input. WACC = E/V × Ke + D/V × Kd × (1 − t).

## 5. Discounted cash flow

### 5.1 Present value

PV_t = f_t × FCFF_t × DF_t; Σ PV over t = 1..N.

### 5.2 Terminal value (both always computed)

- Gordon: TV_G = FCFF_{N+1} / (WACC − g). Error if g ≥ WACC.
- Exit multiple: TV_X = EBITDA_N × M. Default M = the company's own EV/EBITDA at the price date: (market capitalisation + interest-bearing debt − unrestricted cash and investments) ÷ reported EBITDA (*Estimate*).
- PV(TV) = TV × DF_TV. The selected method (default Gordon) enters EV; the other is displayed.
- Cross-checks: implied exit multiple from Gordon = TV_G / EBITDA_N; implied growth from the exit value = WACC − FCFF_{N+1} / TV_X (FCFF_{N+1} held at its base value); value-driver check: implied reinvestment rate g / RONIC versus forecast reinvestment rate (Capex_{N+1} − D&A_{N+1} + ΔNWC_{N+1}) / NOPAT_{N+1}.
- Warnings: g above the long-run nominal GDP proxy (default 11%, *Analyst assumption*); PV(TV) above 85% of EV. Egypt default g = 10%: near Egypt long-run nominal GDP; test sensitivity.

### 5.3 Enterprise value to equity value

EV = Σ PV + PV(TV). Every bridge line is taken from the base-year balance sheet:

| Line | Sign |
|---|---|
| Cash and cash equivalents | + |
| FVTPL securities | + |
| Amortized-cost investments, current | + |
| Amortized-cost investments, non-current | + |
| Associates at carrying value (or user fair value) | + |
| Restricted / pledged deposits | memo only, excluded |
| Bank debt and bonds | − |
| Lease liabilities (EAS 49), current + non-current | − |
| Employee benefit obligations, current + non-current (toggle, default ON; optionally × (1 − CIT)) | − |
| Minority interest | − |
| Preferred equity | − |

Equity value = EV + Σ bridge lines. Value per share = equity value ÷ diluted shares.

Outputs: EV, equity value, value per share, implied EV/EBITDA on normalized base-year EBITDA (FY0A) and on year-1 EBITDA (FY1E), implied P/E on base-year reported net profit and on NP_1, PV(TV) as a share of EV, upside versus price.

## 6. Parallel USD valuation (consistency check)

- S_0 = `eg.usdEgp`. Inflation paths per projection year: EGP default = `eg.cpiUrbanHeadline` in year 1, `cbe.inflationTargetPoint` from year 3, linear in between; USD default = 2.5% flat (*Analyst assumption*).
- Forward rates F_t = S_0 × Π_{k≤t} (1 + π_EGP,k) / (1 + π_USD,k); F_{N+1} = F_N × (1 + π_EGP,N) / (1 + π_USD,N).
- USD cash flows: f_t × FCFF_t / F_t, same timing y_t.
- USD cost of capital (method A in USD): Ke$ = `us.treasury10y` + βL × ERP + CRP + SP; Kd$ = `us.treasury10y` + company spread (section 4.4 table) + country default spread; WACC$ with the same weights.
- USD terminal: g$ = (1 + g)(1 + π_USD,N)/(1 + π_EGP,N) − 1; Gordon TV$ = (FCFF_{N+1} / F_{N+1}) / (WACC$ − g$); exit TV$ = EBITDA_N / F_N × M.
- Bridge in USD = EGP bridge total / S_0. USD equity × S_0 is compared with EGP equity; gap % = USD-derived EGP equity / EGP equity − 1.
- Interpretation shown as a templated sentence comparing the Rf differential (EGP Rf − US 10Y) with the average inflation differential used for the forward rates. This is a consistency check, not a second answer.

## 7. Dividend discount model

- D_0 = dividends paid to shareholders in the base year ÷ basic shares. Employee and board distributions are never included.
- Ke from section 4.3. Discounting in whole years from the valuation date.
- Two-stage (headline): D_t = D_0 (1 + g_H)^t for t = 1..n; V = Σ D_t / (1 + Ke)^t + [D_n (1 + g_S) / (Ke − g_S)] / (1 + Ke)^n.
- H-model: V = D_0 (1 + g_S)/(Ke − g_S) + D_0 × H × (g_H − g_S)/(Ke − g_S), H = n/2.
- Defaults (*Analyst assumption*): g_H = forecast revenue CAGR over N years; n = N; g_S = terminal growth g.
- Checks: error if Ke ≤ g_S; warning if g_S > ROE × retention, with ROE = NP_0 / average equity and retention = 1 − payout, payout = base-year dividends to shareholders ÷ NP_0; warning if payout > 100%.

## 8. Scenarios

Bear / Base / Bull are explicit driver sets, each a full re-run of sections 3-5: revenue-growth delta (pp, every projection year), gross-margin-before-D&A delta (pp, every year including terminal), WACC delta (pp), terminal-growth delta (pp). Defaults (*Analyst assumption*): Bear 25% (−5, −3, +1, −1); Base 50% (0, 0, 0, 0); Bull 25% (+5, +3, −1, +1). Probabilities must sum to 100%. Probability-weighted value = Σ p × value.

## 9. Sensitivity

Four 5×5 grids of value per share with the base case at the centre, each cell a full re-run:

| Grid | Rows | Columns | Default steps |
|---|---|---|---|
| 1 | WACC | terminal growth g | 1.0pp, 1.0pp |
| 2 | WACC | exit multiple (exit method) | 1.0pp, 1.0x |
| 3 | revenue-growth delta (all years) | gross-margin delta | 2.0pp, 2.0pp |
| 4 | Rf | levered beta | 1.0pp, 0.10 |

## 10. Reverse DCF

Bisection (tolerance 0.0001 on the solved rate, in decimal) for: (i) the terminal growth g that makes value per share equal to the price (bracket [−0.05, WACC − 0.0001]); (ii) the uniform revenue growth applied to every projection year that makes value per share equal to the price (bracket [−0.50, 2.00]). If the bracket does not contain a root, the result is reported as not attainable.

## 11. Monte Carlo

PRNG mulberry32 with a documented seed (default 20260923); standard normals by Box-Muller. 10,000 runs. Per run: revenue-growth shift ~ N(0, 3pp) applied to every projection year; margin shift ~ N(0, 2pp) applied to gross margin before D&A in every year; WACC ~ N(base, 1pp); g ~ Uniform(base − 1pp, base + 1pp); constraint WACC − g ≥ 1pp enforced by redrawing WACC and g. Reported: mean, median, P5, P25, P75, P95 (linear interpolation between order statistics) and P(value > price).

## 12. Blended value and verdict

- User weights per method (DCF, DDM, comparables, precedents, SOTP) must sum to 100%. Default: DCF 75%, DDM 25%.
- A method without valid inputs (e.g. comparables with no peers entered) is excluded and flagged; remaining weights are rescaled to 100% and both the entered and the effective weights are shown. No default peer set is ever substituted.
- Verdict: "Implied upside x%" with a band: within ±10% "In line with market price"; above +10% "Above market price"; below −10% "Below market price". No buy/sell language.

## 13. Secondary modules

- Comparables: peers entered as raw data (price, shares, debt, cash, EBITDA, net income, book equity, source and date per peer); multiples computed; median, mean, quartiles.
- Precedent transactions: user-entered deals (EV, revenue, EBITDA, source, date); EV/EBITDA and EV/revenue quartiles; implied value uses the bridge of section 5.3.
- SOTP: segments valued by their own EV/EBITDA multiple or DCF value; corporate bridge applied once.
- Piotroski F-score: nine standard tests; requires two years (N/A otherwise); bonus share issues are not dilution (shares restated).
- Altman Z''-EM (Altman 2005): Z'' = 3.25 + 6.56 X1 + 3.26 X2 + 6.72 X3 + 1.05 X4, X1 = working capital / total assets, X2 = retained earnings / total assets, X3 = EBIT / total assets, X4 = book equity / total liabilities. Zones: safe above 5.85, grey 4.35 to 5.85, distress below 4.35 (score including the 3.25 constant; equivalent to 2.60 / 1.10 on Z'' without it). Source: E. Altman, "An emerging market credit scoring system for corporate bonds", Emerging Markets Review 6 (2005); zones as tabulated in Altman et al., "The Evolution & Applications of the Altman Z-Score Family" (https://www.hofstra.edu/pdf/community/bdc/breslin/breslin-evolution-of-altman-z-score.pdf).
- DuPont: 3-step (net margin × asset turnover × equity multiplier) and 5-step (tax burden × interest burden × EBIT margin × asset turnover × equity multiplier), on average balances when two years exist.
- Credit metrics: net debt / EBITDA, interest cover (EBIT ÷ debt and lease interest), FFO / debt.
- FX sensitivity: value per share when the EGP moves ±10% / ±20% against the USD, applying the move to the USD share of revenue and the USD share of costs (user inputs; MOPCO export share 79.97% pre-filled as a sourced fact, USD cost share has no default).
