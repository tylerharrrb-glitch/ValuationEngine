# WOLF v2 rebuild: progress

Branch: `rebuild/v2`. Spec: owner's "WOLF Valuation Engine v2 — Full Rebuild Specification" (Parts 0-12).
A new session starts here and in CLAUDE.md, not by re-exploring.

## Part status

| Part | Title | Status | Gate |
|---|---|---|---|
| 1 | Read-only audit | done | `npx tsx scripts/verify-part1.ts` 11/11 PASS |
| 2 | Target architecture | not started | |
| 3 | Rates registry and live data | not started | |
| 4 | Company data model and MOPCO fixture | not started | |
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

## Open issues

- LibreOffice is required for the Part 7 gate. Install started via winget on 2026-09-23; result to be confirmed before Part 7.

## Next step

Part 2: create `src/domain`, `src/engine`, `src/data`, `src/export`, `src/ui` skeleton and the architecture gate.
