/**
 * Gate for Part 7 (Excel): export the MOPCO workbook, recalculate it headless with LibreOffice,
 * then check parity with the engine, all Checks TRUE, zero error values, and the style lint.
 * Fails (and says so) if LibreOffice is not available.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Gate } from './lib/gate';
import { exportMopco } from './export-mopco';

const SOFFICE_CANDIDATES = [process.env.SOFFICE, 'C:/Program Files/LibreOffice/program/soffice.exe', '/usr/bin/soffice', '/usr/bin/libreoffice', '/Applications/LibreOffice.app/Contents/MacOS/soffice'].filter(Boolean) as string[];

(async () => {
  const g = new Gate('verify-part7');
  const out = mkdtempSync(join(tmpdir(), 'wolf-xl-'));
  const { file } = await exportMopco(out);
  g.check('workbook exported', existsSync(file), file);
  const soffice = SOFFICE_CANDIDATES.find((p) => existsSync(p)) ?? (spawnSync('soffice', ['--version']).status === 0 ? 'soffice' : null);
  if (!g.check('LibreOffice available for headless recalculation', !!soffice, soffice ?? 'not found: install LibreOffice')) g.finish();
  const recalcDir = join(out, 'recalc');
  execFileSync(soffice!, ['--headless', '--convert-to', 'xlsx', '--outdir', recalcDir, file], { stdio: 'pipe', timeout: 300000 });
  const recalc = join(recalcDir, 'MOPCO_valuation.xlsx');
  g.check('workbook recalculated by LibreOffice', existsSync(recalc), recalc);
  const py = process.platform === 'win32' ? 'python' : 'python3';
  const res = spawnSync(py, ['scripts/excel/check_workbook.py', file, recalc, join(out, 'expected.json'), '--json', join(out, 'summary.json')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  console.log(res.stdout);
  if (res.stderr) console.log(res.stderr);
  const s = JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8'));
  g.check('recalculated values match the engine (0.01 per share, 1 EGP amounts)', s.parityFailures === 0, `${s.parityItems} items, ${s.parityFailures} outside tolerance`);
  g.check('Checks sheet: every check TRUE, master TRUE', s.checkFailures === 0, `${s.checks} checks, ${s.checkFailures} not TRUE`);
  g.check('zero #REF!/#DIV/0!/#NAME?/#VALUE! cells', s.errorCells === 0, `${s.errorCells} error cells`);
  for (const [k, n] of Object.entries(s.lint as Record<string, number>)) g.check(`style lint: ${k}`, n === 0, `${n} issues`);
  if (!process.argv.includes('--keep')) rmSync(out, { recursive: true, force: true });
  else console.log(`kept ${out}`);
  g.finish();
})();
