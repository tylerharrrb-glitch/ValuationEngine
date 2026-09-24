/** Golden-file regression (spec Part 11): MOPCO outputs must not move without regenerating the golden file with a reason. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { goldenOutputs } from '../lib/golden';

describe('MOPCO golden file', () => {
  const golden = JSON.parse(readFileSync('tests/golden/mopco.json', 'utf8')) as Record<string, number | null>;
  const now = goldenOutputs();
  it('has the same keys', () => {
    expect(Object.keys(now).sort()).toEqual(Object.keys(golden).sort());
  });
  it('every output matches (relative tolerance 1e-9)', () => {
    const moved = Object.keys(golden).filter((k) => {
      const g = golden[k];
      const n = now[k];
      if (g === null) return !Number.isNaN(n as number);
      return Math.abs(n - g) > 1e-9 * Math.max(1, Math.abs(g));
    });
    expect(moved, 'outputs moved; regenerate with scripts/update-golden.ts --reason').toEqual([]);
  });
});
