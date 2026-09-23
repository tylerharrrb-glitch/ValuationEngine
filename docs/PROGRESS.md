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
| 5 | Valuation core | not started | |
| 6 | Secondary modules | not started | |
| 7 | Excel export | not started | |
| 8 | PDF export | not started | |
| 9 | UI | not started | |
| 10 | Confidentiality | not started | |
| 11 | Tests and regression | not started | |
| 12 | Documentation | not started | |

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

## Open issues

- LibreOffice 26.8.0 installed via winget on 2026-09-23 (installer requested a reboot); headless conversion to be tested at Part 7.

- CBE adapters blocked by the CBE firewall (see D5). CBE values must be refreshed manually.
- Values read on 23-Sep-2026 that differ from the seed (not applied): CBE official USD/EGP 51.3606 buy / 51.4956 sell (seed 51.9 market close 21-Sep); latest 3Y T-bond auction 21-Sep-2026 weighted avg 23.697% (seed 23.147% from 13-Jul); US 10Y par 4.96% on 22-Sep-2026 (seed 5.10 intraday 23-Sep).
- 24-Sep-2026 MPC not yet held when the registry was built; the four policy rates go stale on 24-Sep until updated.
- MPC calendar beyond 24-Sep-2026 unconfirmed; S&P primary URL TO_VERIFY; Fitch 2026 action unconfirmed; legal texts TO_VERIFY.
- MOPCO FY2025: the asset lines as supplied sum to 61,193,831,632, 1 EGP below the stated total 61,193,831,633 (the balance sheet itself balances). Owner to check which line differs against the audited statements.
- Cloudflare deployment of the Worker/KV not done yet (needs account access).

## Next step

Part 5: write docs/METHODOLOGY.md, then engine timeline/normalize/forecast/wacc/dcf/usdCheck/ddm/scenarios/sensitivity/reverse/MC/blend; independent Python reference; parity gate.
