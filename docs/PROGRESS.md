# WOLF v2 rebuild: progress

Branch: `rebuild/v2`. Spec: owner's "WOLF Valuation Engine v2 — Full Rebuild Specification" (Parts 0-12).
A new session starts here and in CLAUDE.md, not by re-exploring.

## Part status

| Part | Title | Status | Gate |
|---|---|---|---|
| 1 | Read-only audit | done | `npx tsx scripts/verify-part1.ts` 11/11 PASS |
| 2 | Target architecture | done | `npx tsx scripts/verify-part2.ts` 14/14 PASS |
| 3 | Rates registry and live data | done | `npx tsx scripts/verify-part3.ts` 41/41 PASS |
| 4 | Company data model and MOPCO fixture | done | `npx tsx scripts/verify-part4.ts` 36/36 PASS |
| 5 | Valuation core | done | `npx tsx scripts/verify-part5.ts` 11/11 PASS (100 intermediates TS vs Python) |
| 6 | Secondary modules | done | `npx tsx scripts/verify-part6.ts` 17/17 PASS |
| 7 | Excel export | done | `npx tsx scripts/verify-part7.ts` 17/17 PASS (158 parity items after LibreOffice recalculation, 33 checks TRUE, lint 0) |
| 8 | PDF export | done | `npx tsx scripts/verify-part8.ts` 5/5 PASS (22 engine strings found in extracted text) |
| 9 | UI | done | `npx tsx scripts/verify-part9.ts` 7/7 PASS (build, tsc, emoji/banned-word scan, Playwright smoke) |
| 10 | Confidentiality | done | `npx tsx scripts/verify-part10.ts` 12/12 PASS (12 requests, all same-origin, no fixture values) |
| 11 | Tests and regression | done | `npx tsx scripts/verify-part11.ts` 13/13 PASS (64 unit tests, golden file 136 outputs) |
| 12 | Documentation | done | `npx tsx scripts/verify-part12.ts` 8/8 PASS |

## Decisions taken

- D1 (Part 1): The audit found no server-side storage of financial inputs. Confidentiality breaches to be removed in Part 10: WOLF Analyst (Groq) sends full statements to a third party; FMP / Yahoo (via public CORS proxies) receive the ticker.
- D2 (Part 1): `tsx` added as a devDependency so gate scripts run with `npx tsx scripts/verify-partN.ts` without a network install.

- D3 (Part 2): New code lives in src/domain, src/engine, src/data, src/export, src/ui. The pre-v2 code (src/utils, src/components, src/hooks, src/services, src/constants) stays in place until Part 9 replaces the UI, then is deleted.
- D4 (Part 2): Statement sign convention: lines stored with their reported sign (costs negative); D&A positive. See src/domain/company.ts.
- D5 (Part 3): Automated fetches use an identifying UA and never impersonate a browser. The CBE firewall rejects them, so the CBE adapters end in fetch_failed and CBE values are manual (runbook). One-time manual verification on 23-Sep-2026 read CBE pages from a browser-type client to record fixtures.
- D6 (Part 3): Added registry entries beyond spec 3.3: cbe.inflationTargetPoint (7.0, numeric point of the target for the USD-check fade), damodaran.rf.usd, damodaran.expectedInflation.egp/.usd (used by Rf option (d), Fisher from US 10Y).
- D7 (Part 3): Seed and manual file hold the owner's 23-Sep-2026 values unchanged. Values verified today that differ are listed under Open issues for the owner to apply.
- D8 (Part 4): Balance-sheet component-sum checks allow ±1 EGP for line rounding and print the difference. Totals (assets = equity + liabilities, OP, PBT, NP, CFO) tie with 0.5 EGP tolerance.
- D9 (Part 4): Pledged deposits (EGP 1,010,115,488) mapped to restrictedCashNonCurrent; "Other assets & PUC" to intangibleAndOtherAssets; "General reserve" to otherReserves; "Result of merging process" to otherEquity; "Debtors & other debit balances" to otherCurrentAssets.
- D10 (Part 5): Forecast drivers: gross margin before D&A (all D&A assumed in cost of sales), SG&A % and other operating % revenue; NWC days on cash cost of sales; D&A by PP&E roll-forward (default); forecast net profit = NOPAT + after-tax net finance income held flat (distribution base only).
- D11 (Part 5): Default drivers fade linearly from FY2025 actuals (year 1) to terminal drivers (year N). Terminal capex default is value-driver consistent (net reinvestment = g/RONIC × NOPAT, RONIC = WACC). Exit multiple default = company's own EV/EBITDA at the price date (5.66x).
- D12 (Part 5): Kd "actual" and synthetic coverage use debt + lease interest (MOPCO has only lease debt), never employee-benefit interest. Synthetic table: small-firm table when market cap < USD 5bn at eg.usdEgp.
- D13 (Part 5): Blend default DCF 75% / DDM 25%; invalid methods excluded, remaining weights rescaled, both shown. DDM high growth default = forecast revenue CAGR; DDM discounts whole years from the valuation date.
- D14 (Part 5): Monte Carlo: mulberry32 seed 20260923; growth shift N(0,3pp), margin shift N(0,2pp), WACC N(base,1pp), g U(base±1pp), redraw when WACC − g < 1pp.
- D15 (Part 5): Altman Z''-EM lower cut-off corrected to 4.35 (the draft had 4.15) after checking the published zones.
- D16 (Part 6) Modules kept: trading comparables (raw peer inputs, computed multiples, median EV/EBITDA feeds the blend), precedent transactions, SOTP (user segments; MOPCO segment figures not supplied, so empty by default), broker reference band (never in the blend), Piotroski (two-year variant on year-end assets), Altman Z''-EM, DuPont 3/5-step, credit metrics, FX sensitivity (USD cost share has no default), EAS panel (only standards evidenced by statement lines: EAS 47/48/49), reverse DCF, Monte Carlo, scenarios, sensitivity, USD check.
- D17 (Part 6) Modules removed: LBO (screening model did not meet the spec's full-build bar: no sources & uses, single tranche, FCF = net income); confidence score, quality scorecard and sector benchmarks (heuristic scores on unsourced thresholds); WOLF Analyst AI panel and AI report (sent statements to Groq, conflicts with Part 10); bundled EGX industry multiples and placeholder precedent deals; inflation-adjusted return narrative.
- D18 (Part 6) The entire pre-v2 tree (src/components, utils, services, constants, types, hooks, workers, old tests and scripts, functions/api/market-data.ts) was deleted; a placeholder App renders until Part 9. History is in git (commit 5a073cb).
- D19 (Part 7): Excel built with ExcelJS (styles, defined names, page setup, footers, hyperlinks). No cached formula results are written; fullCalcOnLoad is set. Sheet 12 is named "Comps Precedents SOTP" (LBO removed). Every constant sits on Inputs as a blue input (including days per year, check tolerances, quartile points, H-model factor, Altman coefficients, grid offsets); literals 0 and 1 are the only numbers allowed inside formulas.
- D20 (Part 7): Scenarios and the growth x margin sensitivity grid are full re-runs through mini operating models on their own sheets (3 + 25 blocks). Grids WACC x g, WACC x exit and Rf x beta re-discount the model cash flows with SUMPRODUCT; WACC x g uses a g-dependent terminal-year FCFF row.
- D21 (Part 7): Monte Carlo is not reproduced in Excel; its P5/median/P95 appear as engine outputs on Inputs for the football-field row. The Blume beta cross-check is shown in the UI only.
- D22 (Part 8): PDF with jsPDF standard fonts: Times (headings) and Helvetica (body, tabular digits); no font download. Text is sanitized to WinAnsi (e.g. "−" to "-", "×" to "x", "β" to "beta"). Single accent colour for rules and football-field bars; reference-only rows (broker targets) drawn as outlines. Amounts in full EGP.
- D23 (Part 9): New UI in src/ui: tabs Company data, Assumptions (spec order 1-7), Valuation, Analysis, Relative, Historical, Rates, Methodology, Data sources, Saved, About. The engine runs in a Web Worker (debounced 350 ms). Every headline figure, forecast cell, sensitivity cell and WACC component opens an audit drawer (formula, inputs, rate source / URL / asOf / status). Exporters are lazy-loaded.
- D24 (Part 9): Fonts self-hosted via @fontsource (Spectral 600 for headings, IBM Plex Sans for body); no Google Fonts request. Gold only on the active tab, primary button and blended value; football-field bars neutral.
- D25 (Part 9): The FMVA credential line moved to the About page with the owner's original wording ("FMVA® Certified"); marketing chips and the footer line removed.
- D26 (Part 9): Removed unused dependencies: recharts, lucide-react, xlsx-js-style, stackblur-canvas, clsx, tailwind-merge, @types/jspdf, jspdf-autotable, vite-plugin-singlefile. SheetJS (xlsx) stays for the Damodaran adapters.
- D27 (Part 10): No server-side storage existed. Legacy localStorage keys from the pre-v2 app (wolf_valuations, wolf_valuation_state, wolf_user, fmp_api_key) are removed by "Clear all local data"; v2 never reads them. See docs/PRIVACY.md.

## Open issues

- LibreOffice 26.8.0 installed via winget on 2026-09-23 (installer requested a reboot); headless conversion to be tested at Part 7.

- CBE adapters blocked by the CBE firewall (see D5). CBE values must be refreshed manually.
- US 10Y par 4.96% on 22-Sep-2026 differs from the seed 5.10 (intraday 23-Sep); the Worker replaces it automatically once deployed with KV.
- 24-Sep-2026 MPC held: rates unchanged. Recorded in data/rates.manual.json (asOf 2026-09-24), together with CBE official USD/EGP 51.4281 (23-Sep) and the 21-Sep 3Y auction 23.697%. The seed file is unchanged (owner values of 23-Sep).
- MPC calendar beyond 24-Sep-2026 unconfirmed; S&P primary URL TO_VERIFY; Fitch 2026 action unconfirmed; legal texts TO_VERIFY.
- MOPCO FY2025: the asset lines as supplied sum to 61,193,831,632, 1 EGP below the stated total 61,193,831,633 (the balance sheet itself balances). Owner to check which line differs against the audited statements.
- Deployment: on 2026-09-24 the owner approved production; main was fast-forwarded to rebuild/v2 (14786fd) and Cloudflare Pages deployed it to production (https://wolf-valuation-engine.pages.dev). Smoke test passed on production (blended 26.54, DCF 26.33, 12 same-origin requests, no leaks). Not done: the rates Worker and the RATES KV namespace (wrangler is not logged in on this machine), so /api/rates serves data/rates.manual.json and reports kvError.
- GitHub Actions workflow did not start: GitHub reports the account is locked due to a billing issue.

- MOPCO default result on the seed snapshot: DCF 26.33, DDM 27.15, blended 26.54 per share (price 36.00; EFG Hermes target 43 is a reference only). The default risk-free rate (EGP 10Y secondary 21.58%) is stale (21-May-2026); refresh it before relying on the output.

- Excel: no chart in the workbook (ExcelJS cannot write charts; the spec allows at most one). Recalculation verified in LibreOffice only; Excel desktop and Google Sheets not tested in this environment.

## Next step

Owner: review the preview, then (1) run `npx wrangler login` and the one-time Worker/KV steps in docs/RATES_RUNBOOK.md, (2) resolve the GitHub billing lock so CI runs, (3) done: production approved and deployed 2026-09-24.
