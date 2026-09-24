# Changelog

## v2 (branch rebuild/v2)

Full rebuild to the owner's v2 specification. Part-by-part record in docs/PROGRESS.md.

- Part 1: read-only audit of the pre-v2 code (docs/AUDIT.md).
- Part 2: layered architecture (domain, engine, data, export, ui).
- Part 3: rates registry with sources, staleness, Cloudflare Worker refresh, /api/rates, runbook.
- Part 4: company data model and the audited MOPCO FY2025 fixture.
- Part 5: valuation core per docs/METHODOLOGY.md, verified against an independent Python reference.
- Part 6: secondary modules kept or removed (LBO, heuristic scores, AI panel removed).
- Part 7: IB-standard Excel workbook with live formulas, verified after LibreOffice recalculation.
- Part 8: broker-note PDF.
- Part 9: new UI with audit panels, rates panel, methodology and data-source pages.
- Part 10: company data stays in the browser; only /api/rates is fetched.
- Part 11: unit tests, golden file, verify-all, CI workflow.
- Part 12: documentation.

Corrections relative to the pre-v2 engine: S&P rating B (not B-); stamp duty 0.05% per side (not 0.125%); DDM DPS on shareholder dividends only (2.5373, not 3.08); cost of debt on debt and lease interest only; lease liabilities and employee benefit obligations in the equity bridge; valuation-date stub and mid-year timing; Altman Z''-EM instead of the 1968 Z.

## Golden file history

### 2026-09-24: golden file regenerated

Reason: Initial freeze after Part 5 parity (engine = Python reference) and Parts 6-10.

Outputs changed: 136 of 136. DCF per share 26.3307, DDM 27.1487, blended 26.5352.
