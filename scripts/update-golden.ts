/**
 * Regenerates tests/golden/mopco.json. A written reason is mandatory and is appended to CHANGELOG.md
 * (spec Part 11: any change that moves the golden outputs must be explained in the same commit).
 * Usage: npx tsx scripts/update-golden.ts --reason "why the outputs moved"
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { goldenOutputs } from '../tests/lib/golden';

const i = process.argv.indexOf('--reason');
const reason = i > 0 ? process.argv[i + 1]?.trim() : '';
if (!reason) {
  console.error('Refusing to update the golden file without --reason "..."');
  process.exit(1);
}
const prev = existsSync('tests/golden/mopco.json') ? (JSON.parse(readFileSync('tests/golden/mopco.json', 'utf8')) as Record<string, number>) : {};
const next = goldenOutputs();
const moved = Object.keys(next).filter((k) => !(k in prev) || Math.abs((prev[k] ?? NaN) - next[k]) > 1e-9 * Math.max(1, Math.abs(next[k])));
writeFileSync('tests/golden/mopco.json', JSON.stringify(next, null, 2) + '\n');
const date = new Date().toISOString().slice(0, 10);
const entry = `\n### ${date}: golden file regenerated\n\nReason: ${reason}\n\nOutputs changed: ${moved.length} of ${Object.keys(next).length}. DCF per share ${next.dcfPerShare.toFixed(4)}, DDM ${next.ddmTwoStage.toFixed(4)}, blended ${next.blended.toFixed(4)}.\n`;
const log = existsSync('CHANGELOG.md') ? readFileSync('CHANGELOG.md', 'utf8') : '# Changelog\n';
writeFileSync('CHANGELOG.md', log.replace('\n## Golden file history\n', `\n## Golden file history\n${entry}`).includes(entry) ? log.replace('\n## Golden file history\n', `\n## Golden file history\n${entry}`) : log + `\n## Golden file history\n${entry}`);
console.log(`tests/golden/mopco.json written (${moved.length} outputs changed). CHANGELOG.md updated.`);
