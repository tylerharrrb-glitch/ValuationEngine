# CLAUDE.md: standards for work on the WOLF Valuation Engine

Start every session by reading `docs/PROGRESS.md` (status, decisions, open issues, next step) and this file. Do not re-explore the codebase to rediscover what these files record.

## Execution rules (spec Part 0)

- Work happens on branch `rebuild/v2` (or a branch from it). Never push to `main` and never deploy to production; deploy to a Cloudflare preview only. The owner approves merges.
- Each part ends with its gate `scripts/verify-partN.ts`, which prints PASS/FAIL per check. Do not move on while any check fails. `npx tsx scripts/verify-all.ts` runs them all.
- Update `docs/PROGRESS.md` before every commit (status, decisions, open issues, next step).
- Honesty: never report something as done because `tsc` or `vite build` passed. Proof is a script that opens the real artifact (engine output, the Excel file after LibreOffice recalculation, the extracted PDF text) and asserts values. Paste verbatim output. State failures, skips and unknowns first.
- No invented data. Never invent a financial figure, rate, URL, rating or date. Unverifiable values carry `status: "unconfirmed"`; unconfirmed URLs are `TO_VERIFY`.
- No AI-looking output: no emoji anywhere. User-facing sentences are labels, templated statements generated from numbers, or text the user typed. Banned in user-facing text: institutional-grade, comprehensive, robust, cutting-edge, seamless, powerful, state-of-the-art, AI-powered, certified (the owner's own credential on the About page excepted).
- One source of truth per concept: one calculation core (`src/engine`), one rates registry (`src/data/registry` + `data/*.json`), one company model (`src/domain/company.ts`). No duplicated formulas in TypeScript.

## Architecture rules

- `src/engine` and `src/domain` are pure: no React, no `fetch`, no browser globals, no `Math.random` (seeded PRNG only).
- The engine reads macro inputs only through `RateReader` on a frozen `RatesSnapshot`. Overrides require a reason.
- The Python reference (`scripts/reference/wolf_reference.py`) is written from `docs/METHODOLOGY.md`, never translated from the TypeScript. Change the methodology document first, then both implementations.
- Any change that moves MOPCO outputs must regenerate `tests/golden/mopco.json` with `npx tsx scripts/update-golden.ts --reason "..."` in the same commit (the reason goes to CHANGELOG.md).

## Rates (spec Part 3)

- Entry schema in `src/domain/rates.ts`; validation, staleness, bounds, two-source agreement and manual merge in `src/data/registry/registry.ts`.
- Staleness is computed, never hardcoded: mpc (scheduled meeting passed without a newer value), monthly (40 days), daily (3 business days), semiannual (200 days), event (never).
- Automated fetches use the identifying User-Agent and respect robots.txt. Never impersonate a browser in the Worker. The CBE firewall rejects identified clients, so CBE values are maintained manually in `data/rates.manual.json` following `docs/RATES_RUNBOOK.md`.
- Every valuation freezes a snapshot; saved valuations, PDF and Excel carry it. "Update to current rates" shows a diff first.
- After editing `data/rates.manual.json`, run `npx tsx scripts/gen-data-sources.ts`.

## Excel (spec Part 7)

- Calibri 11. Blue 0000FF = hardcoded input; black = formula; red only for FALSE on Checks (conditional format). No fills, no merged cells, no freeze panes, gridlines off, thin rules only.
- Every hardcoded number sits on Inputs (Sources and Cover excepted). Formulas contain no numeric literals except 0 and 1. Every calculation cell is a live formula; no Data Tables, macros or volatile functions.
- Number formats: amounts `_(#,##0_);(#,##0);_("–"_);_(@_)`, percent `0.0%`, multiples `0.0"x"`, per share `#,##0.00`, dates `dd-mmm-yyyy`.
- Landscape, fit to one page wide, footer "<Company> | <Sheet> | Page &P of &N". Named ranges for WACC, Ke, Tax_Rate, Terminal_Growth, Exit_Multiple, Shares_Diluted, Valuation_Date, Midyear.
- `scripts/verify-part7.ts` recalculates with LibreOffice and runs the parity check and style lint (`scripts/excel/check_workbook.py`).

## UI (spec Part 9)

- WOLF dark and gold. Gold only for the active tab, the primary button and the key output figure. Green and red only for up and down values; amber only for warnings. One neutral section-header style.
- Two type families (Spectral, IBM Plex Sans), self-hosted. Tabular figures, right-aligned numbers; the UI may abbreviate to bn/mn with 2 dp, while Excel uses full EGP.
- Every computed figure opens the audit panel (formula, inputs, rate source / URL / asOf / status).
- Price date and valuation date are mandatory. Warnings are inline, not modal. The DDM uses shareholder dividends only.

## Confidentiality (spec Part 10)

- Company financials never leave the browser. Saved valuations live in IndexedDB with JSON export and import. The only data request is `GET /api/rates`. No third-party requests (no analytics, AI services, market-data APIs or font CDNs).
- "Clear all local data" removes the IndexedDB database and every `wolf*` localStorage key (plus the legacy `fmp_api_key`).
- `scripts/verify-part10.ts` fails if any request carries a fixture value or leaves the origin.

## Commands

```
npx tsx scripts/verify-all.ts [--offline]
npx tsx scripts/verify-partN.ts
npm test ; npm run build ; npm run e2e
python scripts/reference/wolf_reference.py tests/fixtures/mopco-fy2025.json tests/fixtures/rates-snapshot-2026-09-23.json --industry "Chemical (Basic)"
```
