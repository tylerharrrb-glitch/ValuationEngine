# Architecture

```
            data/rates.seed.json      data/rates.manual.json
                    |                          |
workers/rates-refresh (cron) --KV RATES--> functions/api/rates.ts
                                               |
                         src/data/registry  <--+  (merge, staleness, snapshot)
                                 |
 tests/fixtures/*.json --> src/domain (types) <-- src/ui (React, thin)
                                 |                    |
                           src/engine (pure)  <-------+
                                 |
                     src/export/excel, src/export/pdf
```

Rules:

1. `src/engine` and `src/domain` are pure: no React, no `fetch`, no browser globals, no `Math.random` (Monte Carlo uses a seeded PRNG). Enforced by `scripts/verify-part2.ts`.
2. One calculation core. UI, PDF and Excel read engine results. Excel carries its own live formulas as the audit model; `scripts/verify-part7.ts` proves they agree with the engine after recalculation.
3. One rates registry. Every macro input is read from a `RatesSnapshot` by id; no macro literals in engine code.
4. One company data model (`src/domain/company.ts`).
