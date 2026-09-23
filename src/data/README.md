# src/data

Rates registry (`registry/`: types, seed loading, merge, staleness) and one adapter per external source (`sources/`). Registry logic is pure; adapters do I/O and run only in the Cloudflare Worker or in scripts, never in the engine.
