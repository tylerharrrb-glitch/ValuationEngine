/**
 * Generates docs/DATA_SOURCES.md from the rates registry (data/rates.manual.json, the maintained state
 * served by /api/rates when the Worker has no newer value) and lists where it differs from the seed.
 * Usage: npx tsx scripts/gen-data-sources.ts [--check]   (--check fails if the file is out of date)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { RatesRegistry, RateEntry } from '../src/domain/rates';

export function renderDataSources(): string {
  const manual = JSON.parse(readFileSync('data/rates.manual.json', 'utf8')) as RatesRegistry;
  const seed = JSON.parse(readFileSync('data/rates.seed.json', 'utf8')) as RatesRegistry;
  const val = (e: RateEntry) =>
    Array.isArray(e.value) ? (e.unit === 'date_list' ? (e.value as string[]).join(', ') : `table, ${e.value.length} rows`) : typeof e.value === 'number' ? (e.unit === 'pct' ? `${e.value}%` : String(e.value)) : String(e.value);
  const esc = (s: string) => s.replace(/\|/g, '/').replace(/\n/g, ' ');
  const lines = [
    '# Data sources',
    '',
    `Generated from \`data/rates.manual.json\` (snapshot ${manual.snapshotId}) by \`npx tsx scripts/gen-data-sources.ts\`. Do not edit by hand.`,
    '',
    'Status is the value stored in the file; the application recomputes staleness for the current date (docs/RATES_RUNBOOK.md).',
    '',
    '## Company data',
    '',
    '- MOPCO (Misr Fertilizers Production Company, MFPC.CA): audited financial statements for FY2025 with FY2024 comparatives, auditor Crowe - Dr. A. M. Hegazy & Co., report dated 09-Mar-2026 (`tests/fixtures/mopco-fy2025.json`). Share price EGP 36.00 on 01-Jul-2026 from the EFG Hermes research page (user input).',
    '- Other companies: entered by the user; never sent to a server.',
    '',
    '## Rates registry',
    '',
    '| Id | Label | Value | Nature | As of | Status | Source | URL |',
    '|---|---|---|---|---|---|---|---|',
    ...manual.entries.map((e) => `| ${e.id} | ${esc(e.label)} | ${esc(val(e))} | ${e.nature} | ${e.asOf} | ${e.status} | ${esc(e.sourceName)} | ${e.sourceUrl} |`),
    '',
    '## Differences from the bundled seed (data/rates.seed.json)',
    '',
  ];
  const seedBy = new Map(seed.entries.map((e) => [e.id, e]));
  const diffs = manual.entries.filter((e) => {
    const s = seedBy.get(e.id);
    return !s || JSON.stringify(s.value) !== JSON.stringify(e.value) || s.asOf !== e.asOf;
  });
  if (!diffs.length) lines.push('None.');
  else {
    lines.push('| Id | Seed value (as of) | Current value (as of) | Notes |', '|---|---|---|---|');
    for (const e of diffs) {
      const s = seedBy.get(e.id);
      lines.push(`| ${e.id} | ${s ? `${esc(val(s))} (${s.asOf})` : 'new'} | ${esc(val(e))} (${e.asOf}) | ${esc(e.notes ?? '')} |`);
    }
  }
  lines.push('', '## Notes on individual entries', '');
  for (const e of manual.entries.filter((x) => x.notes)) lines.push(`- \`${e.id}\`: ${esc(e.notes!)}`);
  return lines.join('\n') + '\n';
}

if (process.argv[1]?.endsWith('gen-data-sources.ts')) {
  const text = renderDataSources();
  if (process.argv.includes('--check')) {
    const cur = (() => { try { return readFileSync('docs/DATA_SOURCES.md', 'utf8'); } catch { return ''; } })();
    if (cur.replace(/\r\n/g, '\n') !== text) {
      console.error('docs/DATA_SOURCES.md is out of date');
      process.exit(1);
    }
    console.log('docs/DATA_SOURCES.md is up to date');
  } else {
    writeFileSync('docs/DATA_SOURCES.md', text);
    console.log('docs/DATA_SOURCES.md written');
  }
}
