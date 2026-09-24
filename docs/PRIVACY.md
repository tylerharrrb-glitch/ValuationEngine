# Confidentiality and data handling

## What leaves the browser

Only one application request carries data from a server: `GET /api/rates` (Cloudflare Pages Function). It returns public macro data (policy rates, yields, inflation, FX, Damodaran estimates) and reads no request body. Static assets (JavaScript, CSS, self-hosted fonts) come from the same origin. No third-party request is made: no analytics, no Google Fonts, no market-data API, no AI service.

Company financial statements, assumptions, results, and the generated Excel and PDF files never leave the browser. Exports are built in the browser and downloaded directly.

## What is stored, and where

| Data | Where | Removed by |
|---|---|---|
| Saved valuations (company data, assumptions, secondary inputs, frozen rates snapshot) | IndexedDB database `wolf-v2`, this browser only | Delete on the Saved tab, or "Clear all local data" |
| Theme choice | localStorage `wolf-theme` | "Clear all local data" |

JSON export and import on the Saved tab move valuations between browsers under the user's control.

## Migration from the pre-v2 app

The Part 1 audit (docs/AUDIT.md, section 6) found no server-side storage of financial inputs. It found three client-side and third-party data paths, all removed in v2:

1. WOLF Analyst (AI panel) sent full financial statements and assumptions to `api.groq.com`. Removed (Part 6).
2. Ticker lookups went to financialmodelingprep.com and to Yahoo Finance through public CORS proxies. Removed; the share price is a user input with a mandatory price date.
3. The old app kept valuations in localStorage (`wolf_valuations`, `wolf_valuation_state`, `wolf_user`) and an FMP API key (`fmp_api_key`). v2 does not read or write these keys. They stay in a browser that used the old app until the user clicks "Clear all local data" on the About page, which deletes them together with the v2 IndexedDB database.

## Verification

`npx tsx scripts/verify-part10.ts` runs the Playwright smoke test and inspects every request made while MOPCO is loaded, valued and exported. It fails if any request URL or body contains a fixture value ("26844075576", "MFPC"), if any request leaves the application origin, or if the built bundle references a removed third-party endpoint.
