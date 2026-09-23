# Rates runbook

The rates registry is the only place macro inputs live. The engine reads values by id from a frozen `RatesSnapshot`; nothing is hardcoded in engine code.

Files:

| File | Role |
|---|---|
| `data/rates.seed.json` | Bundled into the client. Used when `/api/rates` is unreachable ("Offline snapshot as of <date>"). Rebuilt by `npx tsx scripts/build-seed.ts --seed-only`. |
| `data/rates.manual.json` | Git-versioned manual entries. Merged over the Worker output by `functions/api/rates.ts`: a manual entry wins only if its `asOf` is newer or the Worker entry is `fetch_failed`. |
| KV `RATES` | Worker output: `rates:latest`, `rates:YYYY-MM-DD`, `rates:changelog`. |

## Known constraint (23-Sep-2026)

The CBE website firewall rejects every request whose User-Agent is not a browser's. Our Worker identifies itself (`Mozilla/5.0 (compatible; WOLF-rates-refresh/1.0; +https://github.com/tylerharrrb-glitch/ValuationEngine)`) and does not impersonate a browser. So the four CBE adapters (homepage, MPC page, official FX, T-bond auctions) currently end in `fetch_failed`, and **all CBE values are maintained manually** through `data/rates.manual.json`. US Treasury and Damodaran fetch automatically. If CBE later allows identified clients, the Worker picks the values up with no code change. Ask CBE for allow-listing, or keep the manual routine below.

## Editing `data/rates.manual.json`

1. Open the source page in a browser and read the value.
2. Edit the entry: `value`, `asOf` (the date the value refers to), `verifiedAt` (today), `sourceUrl` (exact page), `status` (`ok`, or `unconfirmed` if you could not confirm it from a primary source), `notes` (what you saw and where).
3. Never invent a number or a URL. If the primary URL cannot be found, write `TO_VERIFY` and say so in `notes`.
4. Validate: `npx tsx scripts/verify-part3.ts --offline` (schema, bounds, staleness).
5. Commit with message `rates: <id> <old> -> <new> (<source>, <date>)`.

If the seed should also change (the offline fallback), run `npx tsx scripts/build-seed.ts --seed-only` after editing the owner values in `scripts/build-seed.ts`.

## After each CBE MPC meeting (8 per year)

- Page: https://www.cbe.org.eg/en/monetary-policy/mpc-meetings-schedule (rate cards: overnight deposit, overnight lending, main operation, discount rate) and the MPC press release on https://www.cbe.org.eg/en/ (news list).
- Update `cbe.overnightDeposit`, `cbe.overnightLending`, `cbe.mainOperation`, `cbe.discountRate` with `asOf` = meeting date, even if rates were held. Otherwise the `mpc` staleness rule flags them as soon as the meeting date passes.
- Update `cbe.mpcCalendar` when the CBE publishes the next year's schedule. The schedule page renders the dates with JavaScript, so read them in a browser. Set `status: "ok"` once all dates are read from the CBE page.
- **24-Sep-2026 meeting: not yet held when this registry was built (23-Sep-2026).** Update the four rates after the announcement.

## After each CPI release (about the 10th of each month)

- Urban headline and core: https://www.cbe.org.eg/en/monetary-policy/inflation (CBE press release "CPI Press Release <Month> <Year>").
- Nationwide: CAPMAS (https://www.capmas.gov.eg/). The exact release URL is `TO_VERIFY`.
- Ids: `eg.cpiUrbanHeadline`, `eg.cpiCore`, `eg.cpiNationwide`; `asOf` = last day of the reference month.

## EGP yields

- Secondary 10Y (`eg.bond10ySecondary`, default risk-free rate): market quote. Source used by the owner: Cbonds (URL `TO_VERIFY`). Daily cycle, so it is stale after 3 business days. Refresh before every valuation that uses it.
- Auctions: https://www.cbe.org.eg/en/auctions/egp-t-bonds-fixed-coupon ("Results" block, accepted weighted average yield). One entry per tenor: `eg.tbondAuction.<n>y`, `asOf` = auction date.

## FX and US Treasury

- `eg.usdEgp`: CBE official rate, https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates. Store the buy/sell mid and put both in `notes`.
- `us.treasury10y`: automatic. Feed: `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=YYYYMM` (field `BC_10YEAR`). Fallback FRED DGS10 with Worker secret `FRED_API_KEY`.

## Damodaran updates (January and July)

- https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datacurrent.html. The Worker discovers the newest `ctryprem*.xlsx` link on this page automatically on the 1st and 15th of each month.
- Country risk: sheet "ERPs by country". E3 = mature ERP, E6 = volatility scalar; Egypt row columns C-F = rating, default spread, total ERP, CRP.
- Inflation-based riskfree by currency: linked from the blog post of each update (July 2026: https://pages.stern.nyu.edu/~adamodar/pc/blog/DiffInflationRiskfree26.xlsx). **The file name changes each year: update `DAMODARAN_URLS.currencyRiskfreeJuly26` in `src/data/sources/damodaran.ts`.**
- Emerging-market industry betas: https://pages.stern.nyu.edu/~adamodar/pc/datasets/betaemerg.xls (annual, January).
- Synthetic rating table: https://pages.stern.nyu.edu/~adamodar/pc/ratings.xls. Update the `asOf` passed in `src/data/sources/refresh.ts` when the "Date of Analysis" on datafile/ratings.html changes.

## Rating actions (event)

- Moody's: https://ratings.moodys.com (Egypt, Government of). Last: Caa1 positive, 3-Apr-2026.
- S&P: primary press release URL `TO_VERIFY`; candidate https://www.spglobal.com/ratings/en/regulatory/article/-/view/type/HTML/id/3544107 returned HTTP 403 to automated fetch. Last: B stable (affirmed April 2026).
- Fitch: https://www.fitchratings.com. The last confirmed action is B stable, Oct-2025 (Ahram Online, 11-Oct-2025). No 2026 action was found on 23-Sep-2026, so the entry is `unconfirmed`.

## Tax changes (event)

`eg.cit` (Law 91/2005), `eg.dividendWht.*`, `eg.participationExemption`, `eg.stampDuty.perSide`, `eg.cgt.listedShares` (Law 151 of 2026, effective 29-Jul-2026). Primary legal texts are `TO_VERIFY`. Update after any amendment published in the Official Gazette.

## Manual refresh of the Worker

```
curl -X POST -H "Authorization: Bearer $REFRESH_SECRET" "https://wolf-rates-refresh.<account>.workers.dev/refresh"
curl -X POST -H "Authorization: Bearer $REFRESH_SECRET" "https://wolf-rates-refresh.<account>.workers.dev/refresh?damodaran=1"
```

The response lists every adapter outcome (`UPDATED`, `CONFIRMED`, `UNCONFIRMED`, `REJECTED`, `FETCH_FAILED`).

## Deployment (one-time)

```
cd workers/rates-refresh
npx wrangler kv namespace create RATES        # paste the id into wrangler.toml
npx wrangler secret put REFRESH_SECRET
npx wrangler deploy
```

Bind the same KV namespace to the Pages project as `RATES` (Pages > Settings > Functions > KV namespace bindings) so `/api/rates` can read it.

## Local dry-run

`npx tsx scripts/verify-part3.ts` runs every adapter against the live sites and prints the fetched values next to the seed. Differences are expected and printed.
