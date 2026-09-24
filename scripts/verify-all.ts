/**
 * Runs every part's verification in sequence and prints one summary table.
 * Usage: npx tsx scripts/verify-all.ts [--offline]   (--offline skips Part 3's live dry-run)
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const offline = process.argv.includes('--offline');
const rows: { part: string; result: string; summary: string; seconds: number }[] = [];
for (let p = 1; p <= 12; p++) {
  const script = `scripts/verify-part${p}.ts`;
  if (!existsSync(script)) {
    rows.push({ part: `Part ${p}`, result: 'MISSING', summary: `${script} not found`, seconds: 0 });
    continue;
  }
  const args = ['tsx', script, ...(p === 3 && offline ? ['--offline'] : [])];
  const t0 = Date.now();
  const r = spawnSync('npx', args, { encoding: 'utf8', shell: true, maxBuffer: 256 * 1024 * 1024 });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  const last = out.trim().split('\n').reverse().find((l) => /^--- verify-part/.test(l)) ?? out.trim().split('\n').slice(-1)[0];
  const fails = out.split('\n').filter((l) => l.startsWith('FAIL'));
  rows.push({ part: `Part ${p}`, result: r.status === 0 ? 'PASS' : 'FAIL', summary: `${last.replace(/^--- |---$/g, '').trim()}${fails.length ? ' | ' + fails.join(' | ') : ''}`, seconds: (Date.now() - t0) / 1000 });
  process.stdout.write(`${rows[rows.length - 1].result}  Part ${p}\n`);
}
const t0 = Date.now();
const vt = spawnSync('npx', ['vitest', 'run'], { encoding: 'utf8', shell: true });
const vl = ((vt.stdout ?? '') + (vt.stderr ?? '')).split('\n').find((l) => /Tests\s+\d+/.test(l))?.trim() ?? 'no summary';
rows.push({ part: 'Unit tests', result: vt.status === 0 ? 'PASS' : 'FAIL', summary: vl, seconds: (Date.now() - t0) / 1000 });

console.log('');
console.log('verify-all summary');
console.log(`${'Gate'.padEnd(11)} ${'Result'.padEnd(7)} ${'Time (s)'.padStart(8)}  Summary`);
for (const r of rows) console.log(`${r.part.padEnd(11)} ${r.result.padEnd(7)} ${r.seconds.toFixed(1).padStart(8)}  ${r.summary}`);
const failed = rows.filter((r) => r.result !== 'PASS').length;
console.log(`${rows.length - failed}/${rows.length} gates PASS${failed ? `, ${failed} FAIL` : ''}`);
process.exit(failed ? 1 : 0);
