/** Prints the engine vs Python reference vs recalculated Excel table for MOPCO (final report item 2). */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { exportMopco } from './export-mopco';
import { loadMopco } from '../tests/lib/fixtures';
import { buildDefaultAssumptions } from '../src/engine/defaults';
import { runValuation } from '../src/engine/valuation';
import type { RatesSnapshot } from '../src/domain/rates';

(async () => {
  const SNAP = 'tests/fixtures/rates-snapshot-2026-09-23.json';
  const snap = JSON.parse(readFileSync(SNAP, 'utf8')) as RatesSnapshot;
  const c = loadMopco();
  const a = buildDefaultAssumptions(c, snap, { betaIndustry: 'Chemical (Basic)' });
  const v = runValuation(c, a, snap);
  const out = mkdtempSync(join(tmpdir(), 'wolf-parity-'));
  const py = process.platform === 'win32' ? 'python' : 'python3';
  execFileSync(py, ['scripts/reference/wolf_reference.py', 'tests/fixtures/mopco-fy2025.json', SNAP, '--industry', 'Chemical (Basic)', '--out', join(out, 'ref.json')]);
  const ref = JSON.parse(readFileSync(join(out, 'ref.json'), 'utf8'));
  const { file } = await exportMopco(out);
  const soffice = process.env.SOFFICE ?? (process.platform === 'win32' ? 'C:/Program Files/LibreOffice/program/soffice.exe' : 'soffice');
  execFileSync(soffice, ['--headless', '--convert-to', 'xlsx', '--outdir', join(out, 'recalc'), file], { stdio: 'pipe' });
  const d = v.core.dcf;
  const bridgeLabel: Record<string, string> = { cash: 'Add: cash and cash equivalents', fvtpl: 'Add: FVTPL securities', amortizedCurrent: 'Add: amortized-cost investments (current)', amortizedNonCurrent: 'Add: amortized-cost investments (non-current)', associates: 'Add: associates', debt: 'Less: bank debt and bonds', leases: 'Less: lease liabilities (EAS 49)', employeeBenefits: 'Less: employee benefit obligations', minority: 'Less: minority interest', preferred: 'Less: preferred equity' };
  const rows: { item: string; engine: number; ref: number; sheet: string; label: string; kind: 'pct' | 'amt' | 'ps' }[] = [
    { item: 'Ke (%)', engine: v.core.wacc.ke, ref: ref.ke, sheet: 'WACC', label: 'Cost of equity (Ke)', kind: 'pct' },
    { item: 'WACC (%)', engine: v.core.wacc.wacc, ref: ref.wacc, sheet: 'WACC', label: 'WACC', kind: 'pct' },
    { item: 'Enterprise value', engine: d.enterpriseValue, ref: ref.enterpriseValue, sheet: 'DCF', label: 'Enterprise value', kind: 'amt' },
    ...d.bridge.filter((l) => !l.memo).map((l) => ({ item: `Bridge: ${l.label}`, engine: l.amount, ref: ref.bridge[l.id], sheet: 'DCF', label: bridgeLabel[l.id], kind: 'amt' as const })),
    { item: 'Equity value', engine: d.equityValue, ref: ref.equityValue, sheet: 'DCF', label: 'Equity value', kind: 'amt' },
    { item: 'DCF value per share', engine: d.perShare, ref: ref.perShare, sheet: 'DCF', label: 'DCF value per share', kind: 'ps' },
    { item: 'DDM value per share (two-stage)', engine: v.ddm.twoStage, ref: ref.ddm.twoStage, sheet: 'DDM', label: 'Two-stage value per share', kind: 'ps' },
    { item: 'Blended value per share', engine: v.blend.blendedValue, ref: ref.blended, sheet: 'Summary', label: 'Blended value per share', kind: 'ps' },
  ];
  writeFileSync(join(out, 'req.json'), JSON.stringify(rows.map((r) => ({ sheet: r.sheet, label: r.label }))));
  const xl = JSON.parse(execFileSync(py, ['scripts/excel/read_values.py', join(out, 'recalc', 'MOPCO_valuation.xlsx'), join(out, 'req.json')], { encoding: 'utf8' })) as number[];
  const f = (x: number, k: string) => (k === 'amt' ? Math.round(x).toLocaleString('en-US') : k === 'ps' ? x.toFixed(4) : x.toFixed(6));
  console.log(`${'Item'.padEnd(52)} ${'Engine (TS)'.padStart(18)} ${'Python reference'.padStart(18)} ${'Excel (recalc.)'.padStart(18)}`);
  rows.forEach((r, i) => {
    const x = r.kind === 'pct' ? xl[i] * 100 : xl[i];
    console.log(`${r.item.padEnd(52)} ${f(r.engine, r.kind).padStart(18)} ${f(r.ref, r.kind).padStart(18)} ${f(x, r.kind).padStart(18)}`);
  });
})();
