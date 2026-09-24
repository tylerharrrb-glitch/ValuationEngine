# WOLF Valuation Engine (v2)

Equity valuation for EGX-listed companies. It combines a discounted cash flow model with a valuation-date stub and mid-year timing, a dividend discount model, and relative-valuation cross-checks. Macro inputs come from a dated, sourced rates registry. Every figure can be traced to its formula and inputs, and the results can be exported as a live-formula Excel workbook and a PDF note. Company data stays in the browser.

Built by Ahmed Wael Metwally. Output is analytical only and is not investment advice.

## Run

```
npm ci
npm run dev          # http://localhost:5173 (rates fall back to the bundled snapshot)
npm run build        # production build in dist/
npm test             # engine unit tests and the golden-file regression (vitest)
npm run e2e          # Playwright smoke test against the production build (run npm run build first)
npm run verify       # every part's gate plus unit tests, one summary table
```

`/api/rates` only exists on Cloudflare Pages (or under `npx wrangler pages dev dist`). Without it the app shows "Offline snapshot as of <date>" and uses `data/rates.seed.json`.

Gate prerequisites: Node 22, Python 3 with `openpyxl` and `pypdf`, LibreOffice (headless Excel recalculation), and the Playwright Chromium build (`npx playwright install chromium`).

## Architecture

```
 data/rates.seed.json   data/rates.manual.json         workers/rates-refresh (cron 06:00 UTC)
          |                       |                          |  CBE, US Treasury, Damodaran adapters
          |                       +---- functions/api/rates.ts <-- KV RATES (rates:latest, daily, changelog)
          |                                   |
          v                                   v
   src/ui/hooks/useRates  ----------->  registry (src/data/registry: validate, staleness, merge, snapshot)
          |
          |  freeze RatesSnapshot per valuation
          v
 src/ui (React) --- Web Worker ---> src/engine (pure) <--- src/domain (types)
          |                           timeline, normalize, forecast, wacc, dcf, usdCheck, ddm,
          |                           scenarios, sensitivity, reverseDcf, montecarlo, relative, scores, blend
          v
 src/export/excel (ExcelJS, live formulas)   src/export/pdf (jsPDF)
```

- One calculation core (`src/engine`). The UI, PDF and Excel all consume `runValuation()`. The Excel workbook carries its own live formulas as the audit model, and a gate proves they reproduce the engine.
- One rates registry. The engine reads every macro input by id from a frozen snapshot; engine code contains no macro literals.
- One company data model (`src/domain/company.ts`).

## Verification

| Gate | What it proves |
|---|---|
| `scripts/verify-part1.ts` | Audit of the pre-v2 code exists (docs/AUDIT.md) |
| `scripts/verify-part2.ts` | Engine and domain are pure; TypeScript clean |
| `scripts/verify-part3.ts` | Registry schema, bounds, staleness, adapters on recorded responses, live dry-run |
| `scripts/verify-part4.ts` | MOPCO fixture ties to the pound; derived facts exact |
| `scripts/verify-part5.ts` | Engine equals the independent Python reference (100 intermediates) |
| `scripts/verify-part6.ts` | Kept modules unit-tested; removed modules gone |
| `scripts/verify-part7.ts` | Excel recalculated by LibreOffice equals the engine; checks TRUE; style lint clean |
| `scripts/verify-part8.ts` | PDF text contains the engine values; no emoji or banned words |
| `scripts/verify-part9.ts` | Build, UI text scan, Playwright smoke test |
| `scripts/verify-part10.ts` | No company data in any network request; storage is local |
| `scripts/verify-part11.ts` | Unit tests, edge cases, golden file, CI workflow |
| `scripts/verify-part12.ts` | Documentation present and generated files current |

## Documentation

- `docs/METHODOLOGY.md`: formulas and conventions, the specification both implementations follow
- `docs/DATA_SOURCES.md`: every registry value with source, date and status (generated)
- `docs/RATES_RUNBOOK.md`: what to update after each MPC, CPI release, Damodaran update, rating action or tax change
- `docs/PRIVACY.md`: what is and is not stored or sent
- `docs/PROGRESS.md`: rebuild status, decisions and open issues
- `docs/AUDIT.md`: audit of the pre-v2 code
- `CHANGELOG.md`

## Deployment

Cloudflare Pages serves `dist/` and `functions/`. The rates Worker deploys separately from `workers/rates-refresh` (see docs/RATES_RUNBOOK.md). Branch `rebuild/v2` deploys to a preview URL only; production requires the owner's merge to `main`.
