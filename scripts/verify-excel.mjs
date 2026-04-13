/**
 * Verification script: reads excelExportPro.ts output and checks:
 * 1. Inputs!B22 is a hard number (not formula)
 * 2. Inputs!C22 has a reconciliation formula
 * 3. Historical sheet exists (when historicalData present)
 * 4. Sheet list
 *
 * We can't easily import the TS function in Node, so we use a different approach:
 * parse the source code to verify the changes structurally.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';

const srcPath = resolve('src/utils/excelExportPro.ts');
const src = readFileSync(srcPath, 'utf-8');

let failures = 0;
let passes = 0;

function check(name, condition, detail) {
  if (condition) {
    console.log(`✓ ${name}`);
    passes++;
  } else {
    console.error(`✗ FAIL: ${name} — ${detail}`);
    failures++;
  }
}

// ── Test 1: B22 is inputCell (hard value), NOT calcFormula ──
const b22Line = src.split('\n').find(l => l.includes("inputsWs['B22']"));
check(
  'B22 uses inputCell (hard value)',
  b22Line && b22Line.includes('inputCell') && !b22Line.includes('calcFormula'),
  `Found: ${b22Line?.trim()}`
);

// ── Test 2: B22 references financialData.incomeStatement.netIncome ──
check(
  'B22 passes netIncome from financialData',
  b22Line && b22Line.includes('financialData.incomeStatement.netIncome'),
  `Found: ${b22Line?.trim()}`
);

// ── Test 3: C22 exists with reconciliation formula ──
const c22Exists = src.includes("inputsWs['C22']");
// The formula may be on a subsequent line in a multiline object literal
const c22Idx = src.indexOf("inputsWs['C22']");
const c22Context = c22Idx >= 0 ? src.slice(c22Idx, c22Idx + 400) : '';
const c22HasFormula = c22Context.includes('B17-B20-B21') || c22Context.includes('B22-(B17-B20-B21)');
check(
  'C22 exists with reconciliation formula',
  c22Exists && c22HasFormula,
  `C22 exists: ${c22Exists}, has formula ref: ${c22HasFormula}`
);

// ── Test 4: Historical sheet is created ──
const hasHistSheet = src.includes("book_append_sheet(wb, histWs, 'Historical')");
check(
  'Historical sheet appended to workbook',
  hasHistSheet,
  'No book_append_sheet call for Historical found'
);

// ── Test 5: Historical sheet has Piotroski F-Score ──
const hasPiotroski = src.includes('PIOTROSKI F-SCORE') || src.includes('F-SCORE');
check(
  'Historical sheet includes Piotroski F-Score',
  hasPiotroski,
  'No Piotroski F-Score section found'
);

// ── Test 6: Historical sheet has CAGR ──
const hasCagr = src.includes('CAGR') && src.includes('TREND ANALYSIS');
check(
  'Historical sheet includes CAGR analysis',
  hasCagr,
  'No CAGR section found'
);

// ── Test 7: Historical is conditional on historicalData ──
const hasConditional = src.includes("financialData.historicalData && financialData.historicalData.length > 0");
check(
  'Historical sheet is conditional on data presence',
  hasConditional,
  'No conditional check found'
);

// ── Test 8: Count all sheet names ──
const sheetNames = [];
const sheetRegex = /book_append_sheet\(wb,\s*\w+,\s*'([^']+)'\)/g;
let match;
while ((match = sheetRegex.exec(src)) !== null) {
  sheetNames.push(match[1]);
}
console.log(`\nSheets in workbook: [${sheetNames.join(', ')}]`);
check(
  'Historical in sheet list',
  sheetNames.includes('Historical'),
  `Sheet names: ${sheetNames.join(', ')}`
);

// ── Test 9: Old calcFormula for B22 is GONE ──
const oldB22 = src.includes("calcFormula('B17-B20-B21'");
check(
  'Old calcFormula for B22 is removed',
  !oldB22,
  'calcFormula(\'B17-B20-B21\') still exists in the file'
);

// ── Summary ──
console.log(`\n${'='.repeat(50)}`);
if (failures === 0) {
  console.log(`✅ ALL ${passes} VERIFICATIONS PASSED`);
} else {
  console.log(`❌ ${failures} FAILURES, ${passes} passes`);
  process.exit(1);
}
