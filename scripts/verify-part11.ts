/**
 * Gate for Part 11: unit tests pass (including the spec's edge cases), every engine module is
 * exercised by a test, the golden file exists and matches, verify-all exists, and the CI workflow
 * runs verify-all on pushes to rebuild/v2 with LibreOffice installed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { Gate } from './lib/gate';

const g = new Gate('verify-part11');
const r = spawnSync('npx', ['vitest', 'run'], { encoding: 'utf8', shell: true });
const out = (r.stdout ?? '') + (r.stderr ?? '');
const line = out.split('\n').find((l) => /Tests\s+\d+/.test(l))?.trim() ?? '';
g.check('vitest suite passes', r.status === 0, line);
const tests = ['tests/engine/core.test.ts', 'tests/engine/secondary.test.ts', 'tests/engine/golden.test.ts'].map((f) => readFileSync(f, 'utf8')).join('\n');
for (const [label, re] of [
  ['zero debt', /zero debt/i], ['negative FCFF', /negative FCFF/i], ['g >= WACC', /g ≥ WACC/], ['missing years', /missing years/i], ['stub = 0', /stub = 0/], ['stub = 1', /stub = 1/],
] as const) g.check(`edge case tested: ${label}`, re.test(tests));
const engine = readdirSync('src/engine').filter((f) => f.endsWith('.ts')).map((f) => f.replace('.ts', ''));
const untested = engine.filter((m) => !tests.includes(`src/engine/${m}'`));
g.check('every engine module is imported by a unit test', untested.length === 0, untested.join(', ') || `${engine.length} modules`);
g.check('golden file tests/golden/mopco.json exists', existsSync('tests/golden/mopco.json'));
g.check('golden test present and passing', /MOPCO golden file/.test(out) || (r.status === 0 && existsSync('tests/engine/golden.test.ts')));
g.check('CHANGELOG.md records the golden file reason', /Golden file history[\s\S]*Reason: /.test(readFileSync('CHANGELOG.md', 'utf8')));
g.check('scripts/verify-all.ts exists', existsSync('scripts/verify-all.ts'));
const wf = existsSync('.github/workflows/verify.yml') ? readFileSync('.github/workflows/verify.yml', 'utf8') : '';
g.check('GitHub Actions runs verify-all on pushes to rebuild/v2 with LibreOffice', /rebuild\/v2/.test(wf) && /verify-all/.test(wf) && /libreoffice/i.test(wf) && /playwright install/.test(wf));
g.finish();
