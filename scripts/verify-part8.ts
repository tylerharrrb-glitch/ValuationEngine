/**
 * Gate for Part 8 (PDF): export the MOPCO PDF, extract its text (pypdf), and assert that the
 * per-share values, WACC and every bridge line match the engine; no emoji; no banned words.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { Gate } from './lib/gate';
import { loadMopco } from '../tests/lib/fixtures';
import { buildDefaultAssumptions } from '../src/engine/defaults';
import { runValuation } from '../src/engine/valuation';
import { pdfBytes } from '../src/export/pdf/build';
import { fmtAmount, fmtPerShare, fmtPct } from '../src/export/format';
import type { RatesSnapshot } from '../src/domain/rates';

const g = new Gate('verify-part8');
const snap = JSON.parse(readFileSync('tests/fixtures/rates-snapshot-2026-09-23.json', 'utf8')) as RatesSnapshot;
const c = loadMopco();
const a = buildDefaultAssumptions(c, snap, { betaIndustry: 'Chemical (Basic)' });
const v = runValuation(c, a, snap);
const out = mkdtempSync(join(tmpdir(), 'wolf-pdf-'));
const file = join(out, 'MOPCO_valuation.pdf');
writeFileSync(file, Buffer.from(pdfBytes({ company: c, assumptions: a, snapshot: snap, result: v })));
g.check('PDF exported', true, file);
const d = v.core.dcf;
const required = [
  { label: 'DCF value per share', text: fmtPerShare(d.perShare) },
  { label: 'DDM two-stage value per share', text: `EGP ${fmtPerShare(v.ddm.twoStage)}` },
  { label: 'Blended value per share', text: `EGP ${fmtPerShare(v.blend.blendedValue)}` },
  { label: 'WACC', text: fmtPct(v.core.wacc.wacc) },
  { label: 'Cost of equity', text: fmtPct(v.core.wacc.ke) },
  { label: 'Enterprise value', text: fmtAmount(d.enterpriseValue) },
  { label: 'Equity value', text: fmtAmount(d.equityValue) },
  ...d.bridge.map((l) => ({ label: `Bridge: ${l.label}`, text: `${l.memo ? 'Memo: ' : ''}${l.label} ${fmtAmount(l.amount)}` })),
  { label: 'Verdict band', text: v.blend.verdict.band },
  { label: 'Disclaimer', text: 'not investment advice' },
  { label: 'FRA statement', text: 'not a research publication licensed by the Financial Regulatory Authority' },
  { label: 'Rates snapshot id', text: snap.snapshotId },
];
writeFileSync(join(out, 'expected.json'), JSON.stringify({ required }));
const py = process.platform === 'win32' ? 'python' : 'python3';
const r = spawnSync(py, ['scripts/pdf/check_pdf.py', file, join(out, 'expected.json')], { encoding: 'utf8' });
console.log(r.stdout, r.stderr ?? '');
const s = JSON.parse(r.stdout.trim().split('\n').pop()!);
g.check('per-share values, WACC, EV, equity and every bridge line found in the PDF text', s.missing === 0, `${s.required - s.missing}/${s.required} present`);
g.check('no emoji in the PDF', s.emoji === 0);
g.check('no banned words in the PDF', s.banned.length === 0, s.banned.join(', '));
g.check('Key risks section absent when no risks entered', !spawnSync(py, ['-c', `from pypdf import PdfReader;import sys;t=''.join(p.extract_text() for p in PdfReader(sys.argv[1]).pages);print('Key risks' in t)`, file], { encoding: 'utf8' }).stdout.includes('True'));
if (process.argv.includes('--keep')) console.log(`kept ${out}`);
else rmSync(out, { recursive: true, force: true });
g.finish();
