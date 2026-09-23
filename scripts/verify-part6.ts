/**
 * Gate for Part 6: every kept secondary module has unit tests on MOPCO that pass;
 * removed modules have no remaining imports, code or UI routes anywhere in src/, functions/ or workers/.
 */
import { execSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Gate } from './lib/gate';

const g = new Gate('verify-part6');

const TEST = 'tests/engine/secondary.test.ts';
let out = '';
let ok = true;
try {
  out = execSync(`npx vitest run ${TEST}`, { stdio: 'pipe' }).toString();
} catch (e: any) {
  ok = false;
  out = String(e.stdout ?? '') + String(e.stderr ?? '');
}
const summary = /Tests\s+(\d+) passed(?: \((\d+)\))?/.exec(out);
const failedLine = /Tests\s+.*(\d+) failed/.exec(out);
g.check('secondary-module unit tests pass (vitest)', ok && !failedLine, summary ? summary[0] : out.split('\n').slice(-8).join(' | '));

const src = readFileSync(TEST, 'utf8');
const kept: [string, string][] = [
  ['Comparables', "describe('comparables'"],
  ['Precedent transactions', "describe('precedent transactions'"],
  ['SOTP', "describe('SOTP'"],
  ['Broker reference band', "describe('broker reference band'"],
  ['Piotroski F-score', "describe('Piotroski F-score"],
  ["Altman Z''-EM", 'describe("Altman Z\'\'-EM"'],
  ['DuPont', "describe('DuPont'"],
  ['Credit metrics', "describe('credit metrics'"],
  ['FX sensitivity', "describe('FX sensitivity'"],
  ['EAS panel', "describe('EAS panel'"],
];
for (const [name, marker] of kept) g.check(`kept module has MOPCO unit tests: ${name}`, src.includes(marker));

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|js|jsx|json)$/.test(f) ? [p] : [];
  });
}
const files = [...walk('src'), ...walk('functions'), ...walk('workers')];
const removed: [string, RegExp][] = [
  ['LBO', /\bLBO\b|lboEngine|LBOPanel|calculateLBO/],
  ['Confidence score', /confidenceScore|ConfidenceScore/],
  ['Quality scorecard / sector benchmarks', /QualityScorecard|SECTOR_AVERAGES|calculateSectorBenchmarks/],
  ['AI analyst (Groq)', /groq|wolfAnalyst|WolfAnalyst|AIReport/i],
  ['Bundled "EGX market average" peers', /EGX Market Average|EGYPTIAN_INDUSTRY_MULTIPLES|DEFAULT_INDUSTRY_MULTIPLES/],
  ['Placeholder precedent deals', /Acquirer C|Transaction 3/],
];
for (const [name, re] of removed) {
  const hits = files.filter((f) => re.test(readFileSync(f, 'utf8')));
  g.check(`removed module has no remaining code, imports or routes: ${name}`, hits.length === 0, hits.join(', ') || 'none');
}
g.finish();
