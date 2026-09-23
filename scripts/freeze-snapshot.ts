/** Freezes data/rates.seed.json into tests/fixtures/rates-snapshot-2026-09-23.json (the parity-test snapshot). */
import { writeFileSync } from 'node:fs';
import { loadSeed } from '../tests/lib/fixtures';
import { freezeSnapshot } from '../src/data/registry/registry';

const snap = freezeSnapshot(loadSeed(), '2026-09-23T00:00:00Z');
writeFileSync('tests/fixtures/rates-snapshot-2026-09-23.json', JSON.stringify(snap, null, 2) + '\n');
console.log(`frozen ${snap.snapshotId}: ${snap.entries.length} entries`);
