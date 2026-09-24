# Data sources

Generated from `data/rates.manual.json` (snapshot manual-2026-09-24) by `npx tsx scripts/gen-data-sources.ts`. Do not edit by hand.

Status is the value stored in the file; the application recomputes staleness for the current date (docs/RATES_RUNBOOK.md).

## Company data

- MOPCO (Misr Fertilizers Production Company, MFPC.CA): audited financial statements for FY2025 with FY2024 comparatives, auditor Crowe - Dr. A. M. Hegazy & Co., report dated 09-Mar-2026 (`tests/fixtures/mopco-fy2025.json`). Share price EGP 36.00 on 01-Jul-2026 from the EFG Hermes research page (user input).
- Other companies: entered by the user; never sent to a server.

## Rates registry

| Id | Label | Value | Nature | As of | Status | Source | URL |
|---|---|---|---|---|---|---|---|
| cbe.overnightDeposit | CBE overnight deposit rate | 19% | official | 2026-09-24 | ok | Central Bank of Egypt | https://www.cbe.org.eg/en/ |
| cbe.overnightLending | CBE overnight lending rate | 20% | official | 2026-09-24 | ok | Central Bank of Egypt | https://www.cbe.org.eg/en/ |
| cbe.mainOperation | CBE main operation rate | 19.5% | official | 2026-09-24 | ok | Central Bank of Egypt | https://www.cbe.org.eg/en/ |
| cbe.discountRate | CBE discount rate | 19.5% | official | 2026-09-24 | ok | Central Bank of Egypt | https://www.cbe.org.eg/en/monetary-policy/mpc-meetings-schedule |
| cbe.inflationTarget | CBE inflation target | 7% ±2pp, Q4 2026 (CBE guidance now points to 2H 2027) | official | 2026-08-20 | ok | Central Bank of Egypt | https://www.cbe.org.eg/en/monetary-policy/inflation-target |
| cbe.inflationTargetPoint | CBE inflation target (point, for USD-check inflation fade) | 7% | official | 2026-08-20 | ok | Central Bank of Egypt | https://www.cbe.org.eg/en/monetary-policy/inflation-target |
| cbe.mpcCalendar | CBE MPC meeting dates | 2026-08-20, 2026-09-24 | official | 2026-09-23 | unconfirmed | Central Bank of Egypt, MPC meetings schedule | https://www.cbe.org.eg/en/monetary-policy/mpc-meetings-schedule |
| eg.cpiUrbanHeadline | Urban headline CPI inflation, y/y | 14.5% | official | 2026-08-31 | ok | CAPMAS (reported by CBE) | https://www.cbe.org.eg/en/monetary-policy/inflation |
| eg.cpiCore | Core CPI inflation, y/y | 14.9% | official | 2026-08-31 | ok | Central Bank of Egypt | https://www.cbe.org.eg/en/monetary-policy/inflation |
| eg.cpiNationwide | Nationwide CPI inflation, y/y | 12.7% | official | 2026-08-31 | ok | CAPMAS | TO_VERIFY |
| eg.usdEgp | USD/EGP | 51.4281 | official | 2026-09-23 | ok | Central Bank of Egypt, official exchange rates | https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates |
| eg.bond10ySecondary | EGP 10Y government bond, secondary-market YTM | 21.58% | market_quote | 2026-05-21 | stale | Cbonds | TO_VERIFY |
| eg.tbondAuction.3y | EGP T-bond auction, 3y fixed coupon (accepted weighted average yield) | 23.697% | official | 2026-09-21 | ok | Central Bank of Egypt, T-bond auction results | https://www.cbe.org.eg/en/auctions/egp-t-bonds-fixed-coupon |
| us.treasury10y | US Treasury 10Y | 5.1% | market_quote | 2026-09-23 | ok | US Treasury (intraday, owner research) | https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve |
| eg.rating.moodys | Egypt sovereign rating, Moody's | Caa1 (positive) | official | 2026-04-03 | ok | Moody's Ratings | https://ratings.moodys.com/ratings-news/462631 |
| eg.rating.sp | Egypt sovereign rating, S&P | B (stable) | official | 2026-04-11 | ok | S&P Global Ratings press release; secondary: Ahram Online 11-Apr-2026 | TO_VERIFY |
| eg.rating.fitch | Egypt sovereign rating, Fitch | B (stable) | official | 2025-10-11 | unconfirmed | Fitch Ratings (via Ahram Online, 11-Oct-2025) | https://english.ahram.org.eg/News/554751.aspx |
| eg.cit | Corporate income tax rate | 22.5% | statutory | 2026-09-23 | ok | Income Tax Law 91/2005 | TO_VERIFY |
| eg.dividendWht.listed | Dividend withholding tax, EGX-listed | 5% | statutory | 2026-07-29 | ok | Law 151 of 2026 | TO_VERIFY |
| eg.dividendWht.unlisted | Dividend withholding tax, unlisted | 10% | statutory | 2026-07-29 | ok | Law 151 of 2026 | TO_VERIFY |
| eg.participationExemption | Participation exemption | 100% exempt if holding ≥25% for ≥2 years | statutory | 2026-07-29 | ok | Law 151 of 2026 | TO_VERIFY |
| eg.stampDuty.perSide | EGX stamp duty per side | 0.05% | statutory | 2026-07-29 | ok | Law 151 of 2026 | TO_VERIFY |
| eg.cgt.listedShares | Capital gains tax, listed shares | Exempt (replaced by stamp duty) | statutory | 2026-07-29 | ok | Law 151 of 2026 | TO_VERIFY |
| damodaran.matureErp | Mature-market equity risk premium | 4.2% | estimate | 2026-07-01 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/datasets/ctrypremJuly26.xlsx |
| damodaran.volatilityScalar | Equity / bond volatility scalar | 1.554495526258941 | estimate | 2026-07-01 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/datasets/ctrypremJuly26.xlsx |
| damodaran.egypt.rating | Egypt rating used by Damodaran | Caa1 | estimate | 2026-07-01 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/datasets/ctrypremJuly26.xlsx |
| damodaran.egypt.defaultSpread | Egypt rating-based default spread | 5.97018299895% | estimate | 2026-07-01 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/datasets/ctrypremJuly26.xlsx |
| damodaran.egypt.crp | Egypt country risk premium | 9.28062276282% | estimate | 2026-07-01 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/datasets/ctrypremJuly26.xlsx |
| damodaran.egypt.totalErp | Egypt total equity risk premium | 13.4806227628% | estimate | 2026-07-01 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/datasets/ctrypremJuly26.xlsx |
| damodaran.rf.egp | Inflation-based riskfree rate, EGP | 10.2044276177% | estimate | 2026-07-01 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/blog/DiffInflationRiskfree26.xlsx |
| damodaran.rf.usd | Riskfree rate, USD (Damodaran, July 2026) | 4.23% | estimate | 2026-07-01 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/blog/DiffInflationRiskfree26.xlsx |
| damodaran.expectedInflation.egp | Expected inflation 2026-2031, Egypt | 8.21666666667% | estimate | 2026-07-01 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/blog/DiffInflationRiskfree26.xlsx |
| damodaran.expectedInflation.usd | Expected inflation, USD | 2.35% | estimate | 2026-07-01 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/blog/DiffInflationRiskfree26.xlsx |
| damodaran.betas.emerging | Emerging-market industry betas (unlevered, corrected for cash) | table, 96 rows | estimate | 2026-01-05 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/datasets/betaemerg.xls |
| damodaran.synthetic.large | Synthetic rating table, large non-financial firms | table, 15 rows | estimate | 2026-01-01 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/ratings.xls |
| damodaran.synthetic.small | Synthetic rating table, smaller and riskier firms | table, 15 rows | estimate | 2026-01-01 | ok | Damodaran Online (NYU Stern) | https://pages.stern.nyu.edu/~adamodar/pc/ratings.xls |

## Differences from the bundled seed (data/rates.seed.json)

| Id | Seed value (as of) | Current value (as of) | Notes |
|---|---|---|---|
| cbe.overnightDeposit | 19% (2026-08-20) | 19% (2026-09-24) | MPC Thursday 24-Sep-2026: key policy rates kept unchanged (CBE homepage news "MPC decides to keep key policy rates unchanged" and "MPC Press Release 24 September 2026"; MPC page rate cards 19.00 / 20.00 / 19.50 / 19.50). Read manually on 24-Sep-2026. |
| cbe.overnightLending | 20% (2026-08-20) | 20% (2026-09-24) | MPC Thursday 24-Sep-2026: key policy rates kept unchanged (CBE homepage news "MPC decides to keep key policy rates unchanged" and "MPC Press Release 24 September 2026"; MPC page rate cards 19.00 / 20.00 / 19.50 / 19.50). Read manually on 24-Sep-2026. |
| cbe.mainOperation | 19.5% (2026-08-20) | 19.5% (2026-09-24) | MPC Thursday 24-Sep-2026: key policy rates kept unchanged (CBE homepage news "MPC decides to keep key policy rates unchanged" and "MPC Press Release 24 September 2026"; MPC page rate cards 19.00 / 20.00 / 19.50 / 19.50). Read manually on 24-Sep-2026. |
| cbe.discountRate | 19.5% (2026-08-20) | 19.5% (2026-09-24) | MPC Thursday 24-Sep-2026: key policy rates kept unchanged (CBE homepage news "MPC decides to keep key policy rates unchanged" and "MPC Press Release 24 September 2026"; MPC page rate cards 19.00 / 20.00 / 19.50 / 19.50). Read manually on 24-Sep-2026. |
| eg.usdEgp | 51.9 (2026-09-21) | 51.4281 (2026-09-23) | CBE official rate for 23/09/2026: buy 51.3606 / sell 51.4956; mid stored. Replaces the 21-Sep market close of the seed. |
| eg.tbondAuction.3y | 23.147% (2026-07-13) | 23.697% (2026-09-21) | Auction of 21-Sep-2026, ISIN EGBGR07181F3 (reopening), accepted weighted average yield 23.697% (accepted min 23.630%, max 23.800%). Seed value 23.147% was the 13-Jul-2026 auction. |

## Notes on individual entries

- `cbe.overnightDeposit`: MPC Thursday 24-Sep-2026: key policy rates kept unchanged (CBE homepage news "MPC decides to keep key policy rates unchanged" and "MPC Press Release 24 September 2026"; MPC page rate cards 19.00 / 20.00 / 19.50 / 19.50). Read manually on 24-Sep-2026.
- `cbe.overnightLending`: MPC Thursday 24-Sep-2026: key policy rates kept unchanged (CBE homepage news "MPC decides to keep key policy rates unchanged" and "MPC Press Release 24 September 2026"; MPC page rate cards 19.00 / 20.00 / 19.50 / 19.50). Read manually on 24-Sep-2026.
- `cbe.mainOperation`: MPC Thursday 24-Sep-2026: key policy rates kept unchanged (CBE homepage news "MPC decides to keep key policy rates unchanged" and "MPC Press Release 24 September 2026"; MPC page rate cards 19.00 / 20.00 / 19.50 / 19.50). Read manually on 24-Sep-2026.
- `cbe.discountRate`: MPC Thursday 24-Sep-2026: key policy rates kept unchanged (CBE homepage news "MPC decides to keep key policy rates unchanged" and "MPC Press Release 24 September 2026"; MPC page rate cards 19.00 / 20.00 / 19.50 / 19.50). Read manually on 24-Sep-2026.
- `cbe.inflationTargetPoint`: Point of the 7% ±2pp target. The CBE homepage on 23-Sep-2026 shows "7.0% (±2 percentage points) on average in 2026 Q4".
- `cbe.mpcCalendar`: 20-Aug-2026 confirmed by the CBE homepage news item "MPC decides to keep key policy rates unchanged". 24-Sep-2026 from owner research. The CBE schedule page renders dates with JavaScript and could not be read on 23-Sep-2026; remaining 2026 and 2027 dates are unconfirmed.
- `eg.cpiUrbanHeadline`: August 2026, released 10-Sep-2026.
- `eg.usdEgp`: CBE official rate for 23/09/2026: buy 51.3606 / sell 51.4956; mid stored. Replaces the 21-Sep market close of the seed.
- `eg.bond10ySecondary`: Last quote available to the owner is 21-May-2026. Manual refresh required.
- `eg.tbondAuction.3y`: Auction of 21-Sep-2026, ISIN EGBGR07181F3 (reopening), accepted weighted average yield 23.697% (accepted min 23.630%, max 23.800%). Seed value 23.147% was the 13-Jul-2026 auction.
- `us.treasury10y`: Approximate intraday level 23-Sep-2026. The Worker replaces it with the Treasury daily par yield (10-year).
- `eg.rating.sp`: Affirmation at B/B, stable. Candidate primary URL from a search index, not opened (HTTP 403 on 23-Sep-2026): https://www.spglobal.com/ratings/en/regulatory/article/-/view/type/HTML/id/3544107. The pre-v2 engine showed "B-", which is wrong.
- `eg.rating.fitch`: Last confirmed action Oct-2025. No 2026 Fitch action found on 23-Sep-2026; fitchratings.com not checked successfully.
- `eg.dividendWht.listed`: Effective 29-Jul-2026.
- `eg.stampDuty.perSide`: 0.05% per side on EGX trades; 0.025% per side for same-session trades; withheld by MCDR from the 29-Jul-2026 session. The pre-v2 engine used 0.125%, which is wrong.
- `damodaran.matureErp`: Workbook "ERPs by country"!E3 = 0.042. Secondary sources conflict (4.17% vs 4.20%); the workbook value is used.
- `damodaran.volatilityScalar`: Workbook "ERPs by country"!E6 (from "Relative Equity Volatility"!D7).
- `damodaran.egypt.rating`: Moody's rating column.
- `damodaran.rf.egp`: Damodaran "Inflation-based riskfree rates, by currency - July 2026": USD riskfree adjusted for the expected inflation differential (2026-2031).
- `damodaran.betas.emerging`: Dataset "Date updated" cell = 2026-01-05; updated annually in January. 96 industries.
- `damodaran.synthetic.large`: ratings.html: "Data used is as of January 2026". Spreads in percent.
- `damodaran.synthetic.small`: ratings.html: "Data used is as of January 2026". Spreads in percent.
