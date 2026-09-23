/**
 * Gate for Part 2: the engine layer is pure.
 *  - src/engine and src/domain import nothing from react, ui/, or browser I/O
 *  - no fetch / window / document / localStorage / indexedDB in src/engine
 *  - `tsc --noEmit` is clean for the whole project
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { Gate } from './lib/gate';

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

const g = new Gate('verify-part2');
for (const d of ['src/domain', 'src/engine', 'src/data', 'src/export', 'src/ui', 'workers/rates-refresh', 'functions/api', 'data', 'tests/fixtures', 'scripts', 'docs']) {
  g.check(`directory exists: ${d}`, existsSync(d));
}
const pureFiles = [...walk('src/engine'), ...walk('src/domain')];
g.check('engine/domain contain source files', pureFiles.length > 0, `${pureFiles.length} files`);
const banned: Array<[RegExp, string]> = [
  [/from\s+['"]react(-dom)?(\/[^'"]*)?['"]/, 'imports react'],
  [/from\s+['"][^'"]*\/ui(\/|['"])/, 'imports ui/'],
  [/from\s+['"][^'"]*\/(export|data\/sources)(\/|['"])/, 'imports export/ or data/sources'],
  [/\bfetch\s*\(/, 'calls fetch'],
  [/\b(window|document|localStorage|sessionStorage|indexedDB|XMLHttpRequest)\b/, 'uses browser globals'],
  [/\bMath\.random\s*\(/, 'uses unseeded Math.random'],
];
const violations: string[] = [];
for (const f of pureFiles) {
  const src = readFileSync(f, 'utf8');
  for (const [re, what] of banned) if (re.test(src)) violations.push(`${f}: ${what}`);
}
g.check('engine/domain have no react, ui, fetch or browser I/O imports', violations.length === 0, violations.join('; ') || 'clean');
let tscOut = '';
let tscOk = true;
try {
  execSync('npx tsc --noEmit -p tsconfig.json', { stdio: 'pipe' });
} catch (e: any) {
  tscOk = false;
  tscOut = String(e.stdout ?? '') + String(e.stderr ?? '');
}
g.check('tsc --noEmit clean', tscOk, tscOk ? '0 errors' : tscOut.split('\n').slice(0, 10).join(' | '));
g.finish();
