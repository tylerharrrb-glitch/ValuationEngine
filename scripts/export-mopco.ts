/**
 * Exports the MOPCO workbook (frozen snapshot, default assumptions) and the engine values
 * the recalculated workbook must reproduce. Usage: npx tsx scripts/export-mopco.ts <outDir>
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadMopco } from '../tests/lib/fixtures';
import { buildDefaultAssumptions } from '../src/engine/defaults';
import { runValuation } from '../src/engine/valuation';
import { workbookBuffer } from '../src/export/excel/build';
import type { RatesSnapshot } from '../src/domain/rates';

export async function exportMopco(outDir: string) {
  mkdirSync(outDir, { recursive: true });
  const snap = JSON.parse(readFileSync('tests/fixtures/rates-snapshot-2026-09-23.json', 'utf8')) as RatesSnapshot;
  const c = loadMopco();
  const a = buildDefaultAssumptions(c, snap, { betaIndustry: 'Chemical (Basic)' });
  const v = runValuation(c, a, snap);
  const buf = await workbookBuffer({ company: c, assumptions: a, snapshot: snap, result: v });
  const file = join(outDir, 'MOPCO_valuation.xlsx');
  writeFileSync(file, Buffer.from(buf));
  const core = v.core;
  type Exp = { sheet: string; label: string; col?: number; section?: string; value: number; kind: 'amount' | 'pershare' | 'rate' };
  const exp: Exp[] = [
    { sheet: 'DCF', label: 'DCF value per share', value: core.dcf.perShare, kind: 'pershare' },
    { sheet: 'DCF', label: 'Enterprise value', value: core.dcf.enterpriseValue, kind: 'amount' },
    { sheet: 'DCF', label: 'Equity value', value: core.dcf.equityValue, kind: 'amount' },
    { sheet: 'DCF', label: 'Sum of present values', value: core.dcf.sumPv, kind: 'amount' },
    { sheet: 'DCF', label: 'Gordon terminal value', value: core.dcf.terminal.gordonTv, kind: 'amount' },
    { sheet: 'DCF', label: 'Exit-multiple terminal value', value: core.dcf.terminal.exitTv, kind: 'amount' },
    { sheet: 'DCF', label: 'PV of terminal value used', value: core.dcf.pvTerminal, kind: 'amount' },
    { sheet: 'WACC', label: 'Cost of equity (Ke)', value: core.wacc.ke / 100, kind: 'rate' },
    { sheet: 'WACC', label: 'WACC', value: core.wacc.wacc / 100, kind: 'rate' },
    { sheet: 'WACC', label: 'Levered beta', value: core.wacc.leveredBeta, kind: 'rate' },
    { sheet: 'WACC', label: 'Pre-tax cost of debt used', value: core.wacc.kdPreTax / 100, kind: 'rate' },
    { sheet: 'Normalization', label: 'Normalized EBIT', value: core.norm.normalizedEbit, kind: 'amount' },
    { sheet: 'Normalization', label: 'Normalized EBITDA', value: core.norm.normalizedEbitda, kind: 'amount' },
    { sheet: 'DDM', label: 'Two-stage value per share', value: v.ddm.twoStage, kind: 'pershare' },
    { sheet: 'DDM', label: 'H-model value per share', value: v.ddm.hModel, kind: 'pershare' },
    { sheet: 'Summary', label: 'Blended value per share', value: v.blend.blendedValue, kind: 'pershare' },
    { sheet: 'Scenarios', label: 'Probability-weighted value per share', value: v.scenarios.weightedPerShare, kind: 'pershare' },
    { sheet: 'USD Check', label: 'Gap (USD-derived / EGP - 1)', value: v.usd.gap, kind: 'rate' },
    { sheet: 'USD Check', label: 'WACC, USD', value: v.usd.waccUsd / 100, kind: 'rate' },
  ];
  for (const l of core.dcf.bridge.filter((x) => !x.memo)) {
    const label = { cash: 'Add: cash and cash equivalents', fvtpl: 'Add: FVTPL securities', amortizedCurrent: 'Add: amortized-cost investments (current)', amortizedNonCurrent: 'Add: amortized-cost investments (non-current)', associates: 'Add: associates', debt: 'Less: bank debt and bonds', leases: 'Less: lease liabilities (EAS 49)', employeeBenefits: 'Less: employee benefit obligations', minority: 'Less: minority interest', preferred: 'Less: preferred equity' }[l.id]!;
    exp.push({ sheet: 'DCF', label, value: l.amount, kind: 'amount' });
  }
  core.forecast.years.forEach((y, k) => {
    exp.push({ sheet: 'Operating Model', label: 'Free cash flow to the firm (FCFF)', col: k + 1, value: y.fcff, kind: 'amount' });
    exp.push({ sheet: 'Operating Model', label: 'EBITDA', col: k + 1, value: y.ebitda, kind: 'amount' });
    exp.push({ sheet: 'Operating Model', label: 'Revenue', col: k + 1, value: y.revenue, kind: 'amount' });
    exp.push({ sheet: 'DCF', label: 'Present value', col: k, value: core.dcf.rows[k].pv, kind: 'amount' });
    exp.push({ sheet: 'DCF', label: 'Years from valuation date', col: k, value: core.dcf.rows[k].period.years, kind: 'rate' });
  });
  exp.push({ sheet: 'Operating Model', label: 'Free cash flow to the firm (FCFF)', col: a.projectionYears + 1, value: core.forecast.terminal.fcff, kind: 'amount' });
  v.scenarios.rows.forEach((s, i) => exp.push({ sheet: 'Scenarios', section: 'Scenario summary', label: 'Value per share', col: i, value: s.perShare, kind: 'pershare' }));
  const gridTitle: Record<string, string> = {
    wacc_g: 'Grid 1: WACC × terminal growth (Gordon)',
    wacc_exit: 'Grid 2: WACC × exit multiple',
    growth_margin: 'Grid 3: revenue growth delta (rows) × gross margin delta (columns)',
    rf_beta: 'Grid 4: risk-free rate × levered beta',
  };
  const grids = v.sensitivity.map((g) => ({ title: gridTitle[g.id], values: g.values }));
  const expected = { exp, grids, perShare: core.dcf.perShare };
  writeFileSync(join(outDir, 'expected.json'), JSON.stringify(expected, null, 2));
  return { file, expected };
}

if (process.argv[1]?.endsWith('export-mopco.ts')) {
  exportMopco(process.argv[2] ?? 'out').then((r) => console.log(`wrote ${r.file}`));
}
