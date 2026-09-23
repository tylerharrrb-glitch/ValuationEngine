# WOLF Valuation Engine: Audit of the pre-v2 codebase

Read-only audit, performed 2026-09-23 on commit 5a073cb (branch `main`) before any v2 change.

## 1. File tree of src/ and functions/ with line counts

```
    75  functions/api/market-data.ts
   266  src/App.tsx
   167  src/__tests__/reconciliation.test.ts
   354  src/components/AIReport.tsx
   197  src/components/APIKeyModal.tsx
   432  src/components/AssumptionsPanel.tsx
   145  src/components/ComparableCompanies.tsx
   153  src/components/DCFResults.tsx
   119  src/components/DebouncedInput.tsx
   237  src/components/FinancialInputForm.tsx
   213  src/components/FootballFieldChart.tsx
   317  src/components/HowToBuildModal.tsx
   119  src/components/KeyMetrics.tsx
   246  src/components/QuickStartGuide.tsx
    98  src/components/ScenarioToggle.tsx
   214  src/components/StockSearch.tsx
    79  src/components/Tooltip.tsx
   350  src/components/UserAuth.tsx
   248  src/components/ValuationSummary.tsx
   387  src/components/WolfAnalystPanel.tsx
   132  src/components/WolfLogo.tsx
   487  src/components/charts/ChartsTab.tsx
   232  src/components/charts/HistoricalTrendsChart.tsx
   504  src/components/dispatch/DispatchPDF.tsx
   112  src/components/input/BalanceSheetValidation.tsx
   228  src/components/input/HistoricalDataPanel.tsx
  1346  src/components/input/InputTab.tsx
   190  src/components/layout/CompanyHeader.tsx
    34  src/components/layout/Footer.tsx
   152  src/components/layout/Header.tsx
    68  src/components/layout/TabNavigation.tsx
    35  src/components/shared/CalculationAuditTrail.tsx
    72  src/components/shared/ErrorBoundary.tsx
    96  src/components/shared/InputField.tsx
    12  src/components/shared/LoadingFallback.tsx
   359  src/components/valuation/ValuationTab.tsx
    45  src/components/valuation/sections/BaseYearFCF.tsx
    44  src/components/valuation/sections/BlendedWeightSlider.tsx
    46  src/components/valuation/sections/ComparableBreakdown.tsx
   178  src/components/valuation/sections/ConfidenceScore.tsx
   131  src/components/valuation/sections/CreditMetricsPanel.tsx
    74  src/components/valuation/sections/DCFProjectionsTable.tsx
   105  src/components/valuation/sections/DDMValuation.tsx
   200  src/components/valuation/sections/EASComplianceSection.tsx
   118  src/components/valuation/sections/EVBridgeChart.tsx
   120  src/components/valuation/sections/FCFESection.tsx
   109  src/components/valuation/sections/FCFFReconciliation.tsx
   137  src/components/valuation/sections/FXSensitivity.tsx
   187  src/components/valuation/sections/KeyMetricsGrid.tsx
   125  src/components/valuation/sections/LBOPanel.tsx
    79  src/components/valuation/sections/MarketVsFundamental.tsx
   150  src/components/valuation/sections/PiotroskiFScore.tsx
   144  src/components/valuation/sections/PrecedentTransactionsPanel.tsx
    80  src/components/valuation/sections/QualityScorecard.tsx
   185  src/components/valuation/sections/RelativeValuationPanel.tsx
    61  src/components/valuation/sections/ReverseDCFSection.tsx
   142  src/components/valuation/sections/SOTPPanel.tsx
   156  src/components/valuation/sections/SaveLoadPanel.tsx
   168  src/components/valuation/sections/ScenarioAnalysis.tsx
   128  src/components/valuation/sections/ValidationAlerts.tsx
   144  src/components/valuation/sections/ValuationStyleSelector.tsx
    45  src/components/valuation/sections/ValuationSummaryCards.tsx
   155  src/components/valuation/sections/WorkingCapitalDetail.tsx
   124  src/constants/initialData.ts
   198  src/constants/marketDefaults.ts
    43  src/constants/valuationStyles.ts
    57  src/data/sampleData.ts
   242  src/hooks/useFinancialData.ts
    72  src/hooks/useHistory.ts
    66  src/hooks/useKeyboardShortcuts.ts
    98  src/hooks/useMarketData.ts
    59  src/hooks/useTheme.ts
   240  src/hooks/useValuationCalculations.ts
   395  src/index.css
    13  src/main.tsx
   199  src/services/egyptMarketData.ts
   808  src/services/stockAPI.ts
   290  src/services/wolfAnalyst.ts
   323  src/services/yahooFinanceAPI.ts
   494  src/types/financial.ts
   678  src/utils/advancedAnalysis.ts
   130  src/utils/calculations/comparables.ts
   167  src/utils/calculations/dcf.ts
   138  src/utils/calculations/lboEngine.ts
   110  src/utils/calculations/metrics.ts
   117  src/utils/calculations/scenarios.ts
   107  src/utils/calculations/sotpEngine.ts
     6  src/utils/cn.ts
   185  src/utils/confidenceScore.ts
    32  src/utils/constants/scenarioParams.ts
   231  src/utils/easModules.ts
  1462  src/utils/excelExport.ts
  1446  src/utils/excelExportPro.ts
   202  src/utils/formatters.ts
   183  src/utils/industryMapping.ts
   496  src/utils/inputValidation.ts
   143  src/utils/jsonExport.ts
  1745  src/utils/pdfExport.ts
   264  src/utils/valuation.ts
  1168  src/utils/valuationEngine.ts
     6  src/vite-env.d.ts
   142  src/workers/monteCarlo.worker.ts
24610 total lines
```

## 2. Calculation functions

Duplicates are marked **DUP** with the copy they duplicate. "LIVE" = the path the current UI renders (see `useValuationCalculations.ts`).

| # | File:line | Function | Purpose | Status |
|---|---|---|---|---|
| 1 | src/utils/calculations/dcf.ts:22 | calculateNonOperatingAssets | cash − restricted + marketable sec. + LT investments + otherNonOpAssets | LIVE |
| 2 | src/utils/calculations/dcf.ts:41 | bridgeEnterpriseToEquity | EV + non-op assets − debt − MI − preferred | LIVE (shared) |
| 3 | src/utils/calculations/dcf.ts:62 | calculateDCFProjections | Revenue → EBITDA → EBIT → NOPAT → FCFF, single flat growth/margin | LIVE |
| 4 | src/utils/calculations/dcf.ts:114 | calculateDCFValue | Sum PV + Gordon/exit TV → EV → bridge → per share | LIVE |
| 5 | src/utils/calculations/dcf.ts:146 | calculateScenarioDCF | Multiplier-based scenario re-run | LIVE (football field) |
| 6 | src/utils/valuation.ts:183 | calculateEBITDA | EBIT + D + A | LIVE |
| 7 | src/utils/valuation.ts:189 | calculateEnterpriseValue | Mkt cap + debt − cash | LIVE (display) |
| 8 | src/utils/valuation.ts:202 | calculateDCF | **DUP** of #3+#4 | legacy |
| 9 | src/utils/valuation.ts:260 | calculateComparableValuation | Average-multiple comps | **DUP** of #23/#27 |
| 10 | src/utils/valuation.ts:328 | calculateKe | CAPM dispatcher local_rf/A/B/C | LIVE |
| 11 | src/utils/valuation.ts:359 | calculateWACC | Market-value weights; Kd = interestExpense/debt | LIVE |
| 12 | src/utils/valuation.ts:399 | resolveEffectiveWACC | CAPM WACC unless manual override >0.02pp | LIVE |
| 13 | src/utils/valuationEngine.ts:161 | calculateCostOfEquity | **DUP** of #10 (Method B Fisher-converts; #10 identical) | secondary |
| 14 | src/utils/valuationEngine.ts:206 | calculateWACC | **DUP** of #11 (different signature) | secondary |
| 15 | src/utils/valuationEngine.ts:259 | calculateFCFFVerification | 3-route FCFF cross-check | UI (FCFFReconciliation) |
| 16 | src/utils/valuationEngine.ts:292 | calculateDCFProjections | **DUP** of #3 | secondary |
| 17 | src/utils/valuationEngine.ts:372 | calculateDCFValue | **DUP** of #4, adds verdict OVERVALUED/UNDERVALUED | secondary |
| 18 | src/utils/valuationEngine.ts:478 | calculateDDM | Gordon, two-stage, H-model; DPS from total dividendsPaid | LIVE |
| 19 | src/utils/valuationEngine.ts:570 | calculateComparableValue | Median-multiple comps | **DUP** |
| 20 | src/utils/valuationEngine.ts:644 | calculateBlendedValuation | DCF/comps blend + verdict | secondary |
| 21 | src/utils/valuationEngine.ts:694 | calculateFinancialRatios | Ratios, Altman Z (original 1968 public-manufacturer form) | UI |
| 22 | src/utils/valuationEngine.ts:794 | generateSensitivityMatrix | WACC × g grid; **always end-of-year discounting** regardless of convention | UI |
| 23 | src/utils/valuationEngine.ts:864 | calculateScenarioAnalysis | Delta-based bear/bull | **DUP** of #28 (different deltas) |
| 24 | src/utils/valuationEngine.ts:924 | calculateReverseDCF | Closed-form implied g; EV uses cash only | UI |
| 25 | src/utils/valuationEngine.ts:980 | calculateAssumptionsFromData | Auto-derive beta/tax/Kd; clamps Kd to 20–35% for Egypt | UI |
| 26 | src/utils/valuationEngine.ts:1040 | validateInputs | Alerts | **DUP** of src/utils/inputValidation.ts:476 |
| 27 | src/utils/calculations/comparables.ts:45 | calculateComparableValuations | Comps; **falls back to bundled "EGX Market Average" multiples when no peers** | LIVE |
| 28 | src/utils/calculations/scenarios.ts:22 | calcScenarioPrice | Multiplier scenarios; re-implements projection loop inline | LIVE (**DUP** of #3 loop) |
| 29 | src/utils/calculations/metrics.ts:43 | calculateKeyMetrics | Multiples, NTM from projections | LIVE |
| 30 | src/utils/calculations/metrics.ts:94 | getRecommendation | STRONG BUY … STRONG SELL labels | LIVE |
| 31 | src/utils/calculations/lboEngine.ts:76 | calculateLBO | Single-tranche screening LBO; FCF = NI (no capex/NWC) | UI |
| 32 | src/utils/calculations/sotpEngine.ts:55 | calculateSOTP | EV/EBITDA per segment; `Math.max(0, …)` floor on per-share | UI |
| 33 | src/utils/advancedAnalysis.ts:22 | calculateReverseDCF | Bisection reverse DCF | **DUP** of #24 |
| 34 | src/utils/advancedAnalysis.ts:150 | runMonteCarloSimulation | Unseeded `Math.random`; equity floored at 0; bridge = cash only | UI |
| 35 | src/workers/monteCarlo.worker.ts:14 | runSimulation | **DUP** of #34 | UI |
| 36 | src/utils/advancedAnalysis.ts:384 | calculateSectorBenchmarks | Percentiles vs bundled sector averages (unsourced) | UI |
| 37 | src/utils/advancedAnalysis.ts:485 | calculateQualityScorecard | Heuristic score (unsourced thresholds) | UI |
| 38 | src/utils/easModules.ts:83 | calculateLeaseAdjustment | EAS 49 lease capitalization | UI |
| 39 | src/utils/easModules.ts:128 | calculateNormalizedEarnings | Normalization items | UI |
| 40 | src/utils/easModules.ts:165 | calculateDeferredTaxAdjustment | DTL adjustment | UI |
| 41 | src/utils/easModules.ts:192 | calculateEPS | Basic/diluted EPS | UI |
| 42 | src/utils/confidenceScore.ts:31 | calculateConfidenceScore | Heuristic 0–100 "confidence" | UI |
| 43 | src/utils/inputValidation.ts:476 | validateInputs | Hard blocks / warnings | LIVE |
| 44 | src/components/valuation/ValuationTab.tsx:~95-105 | (inline) | Recomputes TV/PV(TV) in the component | **DUP** of #4 |
| 45 | src/components/charts/ChartsTab.tsx:205-213, 266, 343 | (inline) | Recomputes DCF/equity in chart code with cash-only bridge | **DUP**, inconsistent |
| 46 | src/components/valuation/sections/PrecedentTransactionsPanel.tsx:61-62 | (inline) | EV→equity with debt − cash only | inconsistent bridge |
| 47 | src/components/valuation/sections/CreditMetricsPanel.tsx:38 | (inline) | Debt service = interest + 20% of ST debt (invented proxy) | UI |
| 48 | src/components/valuation/sections/PiotroskiFScore.tsx | (inline) | Single-period; 5 of 9 tests N/A | UI |
| 49 | src/components/valuation/sections/FXSensitivity.tsx:26 | (inline) | Depreciation scenarios 0–20% | UI |
| 50 | src/utils/excelExport.ts (1,462 lines) | exportToExcel | Entire exporter | **dead code** (never imported) |
| 51 | src/utils/pdfExport.ts:486-491, 959-963, 1277 | (inline) | Re-computes TV, DDM, sensitivity inside the PDF writer | **DUP** |
| 52 | src/components/dispatch/DispatchPDF.tsx:129 | (inline) | Re-computes EV/equity inside the PDF writer | **DUP** |

Summary: the DCF projection loop exists in 6 places (#3, #8, #16, #28, #34, #35); the EV→equity bridge exists in 3 inconsistent forms (full helper #2; `EV − debt + cash` in #19, #27, #34, #45, #46, excelExport; SOTP net debt #32).

## 3. Hardcoded macro constants

Raw grep: `grep -rnE "(19|20|20.4|19.5|22.5|4.23|9.71|9.49|13.5|12.5|7.56|47.66|52.9|4.25|4.5|0.125)|'Caa1'|'B-'"` over src/ and functions/ returned 190 lines after removing CSS/layout noise. The macro-relevant hits are:

| File:line | Value | Meaning |
|---|---|---|
| src/constants/marketDefaults.ts:25-38 | EGYPT_MACRO: 19.0 / 20.0 / 19.5 / 19.5 / 16.0 / 20.0 / 14.0 / 7.0 / 52.9 / 22.5 / 9.71 / 4.23 | CBE deposit/lending/main/discount, reserve ratio, EGP 10Y, headline CPI, CBE target, USD/EGP, CIT, CRP, mature ERP; asOf 2026-07-03 |
| src/constants/marketDefaults.ts:67-68 | 4.25, 4.23 | US Rf, mature ERP (USA region) |
| src/constants/marketDefaults.ts:82-83 | 20.40, 4.23 | Egypt default Rf, ERP |
| src/constants/marketDefaults.ts:87-88 | 22.5, 22.9 | CIT, default Kd |
| src/constants/marketDefaults.ts:95-104 | 9.71, 13.94, 6.37, 1.524, 3.95, 9.49 | CRP, total ERP, default spread, vol scalar, clean USD Rf, clean EGP Rf (Damodaran Jan-2026) |
| src/constants/marketDefaults.ts:114-129 | 9.49/4.23/9.71, 4.25/4.23/9.71, 20.40/4.23/0 | Method A/B/local_rf presets |
| src/constants/marketDefaults.ts:133-140 | 19.0, 20.0, 19.5, 13.5, 7.78, 3.3 | CBE rates (duplicate of EGYPT_MACRO), CPI, IMF expected inflation, US CPI |
| src/constants/marketDefaults.ts:143-148 | 5.0, 10.0, 0, **0.125**, 5.0, 10.0 | Dividend WHT listed/unlisted, CGT, **stamp duty 0.125% (wrong: 0.05% per side)**, legal reserve, employee share |
| src/constants/marketDefaults.ts:151-153 | 'Caa1', 'B', 'B' | Moody's / S&P / Fitch |
| src/services/egyptMarketData.ts:47-50 | EGYPT_MACRO refs | CBE rates mirror |
| src/services/egyptMarketData.ts:123-124 | 'Caa1', **'B-'** | **S&P shown as B- (wrong: B stable since Apr-2026 per owner research)** |
| src/services/egyptMarketData.ts:127-128 | 9.71, 4.23 | CRP, ERP mirror |
| src/constants/initialData.ts:71-93 | 22.5, 20.40, 4.23, 4.25, 9.71, 13.5, 9.49, 22.9 | Default assumptions |
| src/utils/valuationEngine.ts:49-72 | 4.25, 4.23, 20.40, 4.23, 22.5, 9.71 | **Second copy** of MARKET_DEFAULTS |
| src/utils/valuationEngine.ts:170-201 | `?? 9.71`, `?? 4.25`, `?? 13.5`, `?? 9.49` | Silent fallbacks inside Ke |
| src/utils/valuationEngine.ts:1004 | 20 (min Kd Egypt) | Kd clamp 20–35% |
| src/utils/valuationEngine.ts:1024 | 9.49 | clean Rf fallback |
| src/utils/valuation.ts:162-172 | `?? 9.71`, `?? 9.49`, `?? 4.25`, `?? 13.5` | Silent fallbacks inside LIVE Ke |
| src/utils/calculations/lboEngine.ts:70,73 | 22.5, 22.5 | LBO Kd and tax |
| src/components/valuation/sections/KeyMetricsGrid.tsx:71 | 22.5 | Statutory rate literal in UI |
| src/components/valuation/sections/CreditMetricsPanel.tsx:38 | 0.2 | Invented 20% principal proxy |
| src/utils/pdfExport.ts:1569 | 0.125% | Stamp duty in PDF text (wrong) |
| src/utils/pdfExport.ts:1729-1732 | 13.5, 3.3, 9.71, 4.23, 20.40, 4.25 | Hardcoded source text in PDF |
| src/utils/excelExportPro.ts:1117-1119 | "20–35%", "~20–27%" | Hardcoded guidance text in Excel |
| src/components/input/InputTab.tsx:632 | "~19–20% policy" | UI text |
| src/components/valuation/ValuationTab.tsx:215 | "~20-25%" | UI text |
| src/__tests__/reconciliation.test.ts:67-76 | 22.5, 20.0, 4.23, 4.25, 9.71, 13.5 | Test fixture |
| src/utils/excelExport.ts (12 hits) | various | dead code |

No hits for 7.56, 47.66, 12.5 as macro values (12.0 appears as max terminal growth).

## 4. Equity-value / EV-bridge computation sites (quoted)

1. `src/utils/calculations/dcf.ts:28-33` (shared helper, LIVE):
   ```ts
   return (
     (bs.cash ?? 0) - restricted +
     (bs.marketableSecurities ?? 0) +
     (bs.longTermInvestments ?? 0) +
     (assumptions?.otherNonOpAssets ?? 0)
   );
   ```
   and `dcf.ts:49-55`: `enterpriseValue + nonOperatingAssets - totalDebt - (bs.minorityInterest ?? 0) - (bs.preferredEquity ?? 0)`.
   Missing: lease liabilities (EAS 49), employee benefit obligations, associates, current vs non-current amortized-cost split. `restrictedCash` is read via `as any` and is not a typed field.
2. `src/utils/valuationEngine.ts:423-426` and `src/utils/valuation.ts:87`: call the helper.
3. `src/utils/valuationEngine.ts:610`: `const impliedEquity = impliedEV - totalDebt + cash;`
4. `src/utils/valuation.ts:124`: `const ebitdaEquityValue = evFromEbitda - totalDebt + cash;`
5. `src/utils/calculations/comparables.ts:93`: `((ebitda * evEbitdaMultiple) - totalDebt + balanceSheet.cash) / shares`
6. `src/utils/advancedAnalysis.ts:195` and `src/workers/monteCarlo.worker.ts:59`: `Math.max(ev - totalDebt + financialData.balanceSheet.cash, 0)` (floored at zero, cash only)
7. `src/utils/advancedAnalysis.ts:258`: `Math.max(baseEV - totalDebt + financialData.balanceSheet.cash, 0)`
8. `src/components/charts/ChartsTab.tsx:213, 266, 343`: `ev - totalDebt + financialData.balanceSheet.cash`
9. `src/components/valuation/sections/PrecedentTransactionsPanel.tsx:61-62`: `(is.revenue * medians.evRevenue - totalDebt + bs.cash) / shares`
10. `src/utils/calculations/sotpEngine.ts:94`: `const equityValue = totalEV - holdingDiscount - netDebt;` then `Math.max(0, equityValue / sharesOutstanding)`
11. `src/utils/pdfExport.ts:491, 1277` and `src/components/dispatch/DispatchPDF.tsx:129`: call the helper after recomputing EV locally.
12. `src/utils/excelExportPro.ts` DCF Model rows 34-42: `B42 = B34+B35+B36+B37+B38+B39+B40+B41` (cash, marketable securities, LT investments, other non-op, less debt, MI, preferred).
13. `src/utils/excelExport.ts:582, 1042` (dead): `evImpliedEV - totalDebt + balanceSheet.cash`.

## 5. Discounting convention (quoted)

`src/utils/calculations/dcf.ts:89-91` (LIVE):
```ts
// Discount factor based on convention
const period = adjustedAssumptions.discountingConvention === 'mid_year' ? i - 0.5 : i;
const discountFactor = Math.pow(1 + wacc, period);
```
Terminal value, `dcf.ts:132`: `const lastDiscountFactor = Math.pow(1 + wacc, adjustedAssumptions.projectionYears);`

Whole-year periods counted from the last fiscal year end. There is no valuation date, no stub period and no YEARFRAC; a valuation performed six months after FYE still discounts year 1 by a full (or half) year. The sensitivity grid (`valuationEngine.ts:831`) and Monte Carlo (`advancedAnalysis.ts:181`) always use end-of-year, so their centre cells do not match the headline DCF when mid-year is on. The Excel DCF sheet uses `1/POWER(1+$B$13,n)` with literal period numbers (`D26 = 1/POWER(1+$B$13,2)` …).

## 6. Network calls, sign-in and storage

| Call site | Target | Payload leaving the browser |
|---|---|---|
| src/hooks/useMarketData.ts:60 | `/api/market-data` (Pages Function) | none |
| functions/api/market-data.ts:39 | `https://open.er-api.com/v6/latest/USD` | none (server-side) |
| functions/api/market-data.ts:54 | `api.fiscaldata.treasury.gov/.../avg_interest_rates` | none. **Wrong dataset**: this is the average interest rate on Treasury debt, not the 10Y par yield. |
| src/services/stockAPI.ts:100, 560-561, 688-689 | `https://financialmodelingprep.com/stable/...` | ticker + user API key |
| src/services/yahooFinanceAPI.ts:138 | Yahoo quoteSummary through public CORS proxies | ticker (e.g. `MFPC.CA`) sent to third-party proxies |
| src/services/wolfAnalyst.ts:106 | `https://api.groq.com/openai/v1/chat/completions` | **Full financial statements and assumptions** in the prompt (`buildVerifyPrompt`) |

Sign In (`src/components/UserAuth.tsx:90-118`): no authentication. It stores a display name in `localStorage['wolf_user']`.
Save/Portfolio: `localStorage['wolf_valuations']` (UserAuth.tsx:101-155), `localStorage[STORAGE_KEY]` named slots (SaveLoadPanel.tsx:36-43), autosave `localStorage['wolf_valuation_state']` (useFinancialData.ts:199). API key `localStorage['fmp_api_key']`. Theme in localStorage.
No IndexedDB, no KV, no external database. **No server-side storage of financial inputs.** The only confidentiality breach is the Groq AI panel (financials sent to a third party) and the ticker sent to FMP/Yahoo/CORS proxies.

## 7. Excel exporter (`src/utils/excelExportPro.ts`, LIVE)

Evidence: the current exporter was run on the old MOPCO harness data (`scripts/verify-mopco.ts` inputs) and the file was scanned with openpyxl. Output of the scan:

```
== Inputs: 98x5; hardcoded numbers=48; formulas with literal constants=2
   F C22: =IF(ABS(B22-(B17-B20-B21))/MAX(ABS(B22),1)>0.05,"Differs from EBIT-Int-Tax ("&TEXT(B17-B20
   F B89: =B87*(1-B88/100)
== DCF Model: 46x7; hardcoded numbers=1; formulas with literal constants=13
   hardcoded: B24=0
   F B7: =Inputs!B63/100
   F B8: =Inputs!B71/100
   F B9: =Inputs!B72/100
   F B10: =Inputs!B64/100
   F B11: =Inputs!B73/100
   F B12: =Inputs!B74/100
   F B13: =Inputs!B61/100
   F B14: =Inputs!B62/100
   F D26: =1/POWER(1+$B$13,2)
   F E26: =1/POWER(1+$B$13,3)
   F F26: =1/POWER(1+$B$13,4)
   F G26: =1/POWER(1+$B$13,5)
   ... + 1
== Comparables: 27x5; hardcoded numbers=12; formulas with literal constants=0
   hardcoded: B6=7, C6=5, D6=1.2, E6=1.5, B8=7, C8=5, D8=1.2, E8=1.5, B19=0.4, B20=0.35, B21=0.15, B22=0.1
== Ratios: 38x2; hardcoded numbers=0; formulas with literal constants=1
   hardcoded: 
   F B27: =IFERROR(Inputs!B17*(1-Inputs!B64/100)/(Inputs!B50+Inputs!B70-Inputs!B27),0)
== Dashboard: 31x4; hardcoded numbers=1; formulas with literal constants=2
   hardcoded: C7=0.6
   F A18: =IF(B15>0.10,"UNDERVALUED",IF(B15>=-0.10,"FAIRLY VALUED","OVERVALUED"))
   F A20: =IF(B15>0.30,"STRONG BUY",IF(B15>0.10,"BUY",IF(B15>=-0.10,"HOLD",IF(B15>=-0.30,"SELL","STR
== _Calc: 66x7; hardcoded numbers=0; formulas with literal constants=26
   hardcoded: 
   F B2: =Inputs!B63/100
   F B3: =Inputs!B71/100
   F B4: =Inputs!B72/100
   F B5: =Inputs!B64/100
   F B6: =Inputs!B73/100
   F B7: =Inputs!B74/100
   F C40: =B40*(1+Inputs!B63/100*0.40)
   F D40: =C40*(1+Inputs!B63/100*0.40)
   F E40: =D40*(1+Inputs!B63/100*0.40)
   F F40: =E40*(1+Inputs!B63/100*0.40)
   F G40: =F40*(1+Inputs!B63/100*0.40)
   F C41: =C40*(Inputs!B71/100-0.015*1)
   ... + 14
== Sensitivity: 18x6; hardcoded numbers=0; formulas with literal constants=42
   hardcoded: 
   F B4: =Inputs!B62/100-0.03
   F C4: =Inputs!B62/100-0.015
   F D4: =Inputs!B62/100
   F E4: =Inputs!B62/100+0.015
   F F4: =Inputs!B62/100+0.03
   F A5: =Inputs!B61/100-0.04
   F B5: =IFERROR(('_Calc'!C26/(1+$A5)^1+'_Calc'!D26/(1+$A5)^2+'_Calc'!E26/(1+$A5)^3+'_Calc'!F26/(1
   F C5: =IFERROR(('_Calc'!C26/(1+$A5)^1+'_Calc'!D26/(1+$A5)^2+'_Calc'!E26/(1+$A5)^3+'_Calc'!F26/(1
   F D5: =IFERROR(('_Calc'!C26/(1+$A5)^1+'_Calc'!D26/(1+$A5)^2+'_Calc'!E26/(1+$A5)^3+'_Calc'!F26/(1
   F E5: =IFERROR(('_Calc'!C26/(1+$A5)^1+'_Calc'!D26/(1+$A5)^2+'_Calc'!E26/(1+$A5)^3+'_Calc'!F26/(1
   F F5: =IFERROR(('_Calc'!C26/(1+$A5)^1+'_Calc'!D26/(1+$A5)^2+'_Calc'!E26/(1+$A5)^3+'_Calc'!F26/(1
   F A6: =Inputs!B61/100-0.02
   ... + 30
== Z-Score: 16x4; hardcoded numbers=0; formulas with literal constants=6
   hardcoded: 
   F D4: =C4*1.2
   F D5: =C5*1.4
   F D6: =C6*3.3
   F D7: =C7*0.6
   F D8: =C8*1.0
   F D11: =IF(D10>2.99,"Safe Zone",IF(D10>1.81,"Grey Zone","Distress Zone"))
== DuPont: 17x3; hardcoded numbers=0; formulas with literal constants=0
   hardcoded: 
== DDM: 21x2; hardcoded numbers=0; formulas with literal constants=5
   hardcoded: 
   F B6: =Inputs!B86/100
   F B7: =Inputs!B62/100
   F B8: =Inputs!B63/100
   F B13: =IFERROR(B4*(1+B8)/(1+B6)^1+B4*(1+B8)^2/(1+B6)^2+B4*(1+B8)^3/(1+B6)^3+B4*(1+B8)^4/(1+B6)^4
   F B14: =IFERROR(B4*(1+B7+(B9/2)*(B8-B7))/(B6-B7),"N/A")
== Instructions: 51x1; hardcoded numbers=0; formulas with literal constants=0
   hardcoded:
```

Sheets, in order: Inputs, DCF Model, Comparables, Ratios, Dashboard, _Calc, Sensitivity, Z-Score, DuPont, DDM, Historical (only when historicals exist), Instructions.

Hardcoded numbers outside Inputs: Comparables B6:E8 (bundled EGX "market average" multiples 7 / 5 / 1.2 / 1.5) and B19:B22 (method weights 0.40/0.35/0.15/0.10); Dashboard C7 = 0.6 (DCF weight); DCF Model B24 = 0 (base-year ΔWC).

Literal constants inside formulas: `/100` percent conversions throughout DCF Model, _Calc, DDM; scenario multipliers inside _Calc (`*0.40`, `-0.015*1`, …); sensitivity axis steps (`-0.03`, `-0.015`, `+0.015`, `+0.03`, `-0.04`, `-0.02` …); Altman coefficients (`*1.2`, `*1.4`, `*3.3`, `*0.6`, `*1.0`) and zone cut-offs (2.99, 1.81); verdict thresholds (0.10, 0.30) in Dashboard; hardcoded period numbers in `1/POWER(1+$B$13,n)`; H-model `B9/2`.

Style: navy/blue/green/yellow fills, white banner text, medium borders, merged banners, "STRONG BUY … STRONG SELL" recommendation text, emoji-free but with bullet characters. No named ranges, no print setup, no Checks sheet, no Sources sheet.

## 8. Module inventory

| Module | Where | Assessment |
|---|---|---|
| DCF | calculations/dcf.ts (+5 copies) | Single flat growth/margin for all years; no stub/valuation date; bridge missing leases and employee obligations; Kd derived from total finance cost. |
| DDM | valuationEngine.ts:478 | Formulas correct; DPS includes employee/board distributions (MOPCO 3.08 instead of 2.54). |
| Comps | calculations/comparables.ts | Users type multiples directly; silent fallback to bundled "EGX Market Average" multiples when no peers; bridge cash-only. |
| LBO | calculations/lboEngine.ts | Screening only: one tranche, FCF = NI, no sources & uses, no capex/NWC; does not meet the Part 6 standard. |
| SOTP | calculations/sotpEngine.ts | Segment EV/EBITDA; fixed 10% holding discount; per-share floored at 0; no net debt allocation. |
| Precedents | PrecedentTransactionsPanel.tsx | Bundled placeholder deals ("Transaction 3 / Acquirer C"); no source/date fields. |
| Monte Carlo | advancedAnalysis.ts + worker | Unseeded, equity floored at 0, cash-only bridge, prices >10× filtered out (biases the distribution). |
| Altman Z | valuationEngine.ts:694, Excel Z-Score | Original 1968 public-manufacturer Z (1.2/1.4/3.3/0.6/1.0), not Z''-EM. |
| Piotroski | PiotroskiFScore.tsx | Single-period; 4-5 tests always N/A even when prior year exists. |
| DuPont | Excel DuPont + UI | 3-step and 5-step computed from single year; acceptable formulas. |
| EAS panel | EASComplianceSection.tsx, easModules.ts | Generic status claims ("Applied", "Available") not tied to company notes. |
| Credit metrics | CreditMetricsPanel.tsx | Uses invented principal proxy (20% of ST debt); interest cover uses total finance costs. |
| Reverse DCF | valuationEngine.ts:924 + advancedAnalysis.ts:22 | Two implementations; closed-form one ignores non-op assets. |
| FX sensitivity | FXSensitivity.tsx | Fixed depreciation steps; no revenue/cost USD-share inputs. |
| Inflation-adjusted return | ValuationTab.tsx (text) | Narrative only. |
| Scenarios | calculations/scenarios.ts + valuationEngine.ts:864 | Two inconsistent implementations; multiplier-based, not explicit driver sets. |
| Sensitivity | valuationEngine.ts:794 | End-of-year only; g axis clamped at 4% floor; not a full re-run. |
| Confidence score / quality scorecard / sector benchmarks | confidenceScore.ts, advancedAnalysis.ts | Heuristic scores on unsourced thresholds. |
| WOLF Analyst (AI) | wolfAnalyst.ts, WolfAnalystPanel.tsx, AIReport.tsx | Sends financials to Groq. Conflicts with Part 10. |

## 9. Test suite (verbatim)

```
RUN  v4.1.4 D:/WOLF/ValuationEngine


 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  21:06:26
   Duration  847ms (transform 313ms, setup 0ms, import 375ms, tests 26ms, environment 0ms)
```

Additional harnesses outside vitest: `scripts/verify-mopco.ts`, `scripts/verify-engine.ts`, `scripts/verify-excel.mjs`, `scripts/verify-excel-runtime.mjs`. They validate the old engine's internal consistency. `verify-mopco.ts` uses **calibrated, non-audited operating figures** (revenue 26.5bn, EBIT 10.0bn) that do not match the audited FY2025 statements.
