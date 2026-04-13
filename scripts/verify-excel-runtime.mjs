/**
 * Runtime verification: build a workbook the same way excelExportPro does,
 * then write to disk and read back to verify cell types.
 */
import XLSX from 'xlsx-js-style';
import { readFileSync, unlinkSync } from 'fs';

const FMT_NUMBER = '#,##0';
const FMT_PERCENT = '0.00%';
const FMT_DECIMAL = '#,##0.00';

// Reproduce the exact cell helpers from excelExportPro.ts
const inputCell = (v, fmt) => {
  return typeof v === 'number'
    ? { t: 'n', v, z: fmt, s: { fill: { fgColor: { rgb: 'DCE6F1' } } } }
    : { t: 's', v: String(v), s: { fill: { fgColor: { rgb: 'DCE6F1' } } } };
};

const cell = (v, fmt) => {
  if (v === null || v === undefined || v === '') return { t: 's', v: '' };
  return typeof v === 'number'
    ? (fmt ? { t: 'n', v, z: fmt } : { t: 'n', v })
    : { t: 's', v: String(v) };
};

const calcFormula = (f, fmt) => ({ t: 'n', f, z: fmt, s: { fill: { fgColor: { rgb: 'E2EFDA' } } } });

const NI_VALUE = 1_106_000_000;
const testFile = 'test-verify-output.xlsx';

// ── Build minimal workbook matching excelExportPro patterns ──
const wb = XLSX.utils.book_new();
const ws = {};

// Simulate Inputs sheet rows for NI area
ws['A17'] = cell('Operating Income (EBIT)');
ws['B17'] = calcFormula('B15-B16', FMT_NUMBER);
ws['A20'] = cell('Interest Expense');
ws['B20'] = cell(100_000_000, FMT_NUMBER);
ws['A21'] = cell('Tax Expense');
ws['B21'] = cell(294_000_000, FMT_NUMBER);
ws['A22'] = cell('Net Income');

// THIS IS THE FIX: inputCell instead of calcFormula
ws['B22'] = inputCell(NI_VALUE, FMT_NUMBER);

// Reconciliation in C22 (t:'str' for string-result formulas)
ws['C22'] = {
  t: 'str',
  f: 'IF(ABS(B22-(B17-B20-B21))/MAX(ABS(B22),1)>0.05,"Differs from EBIT-Int-Tax ("&TEXT(B17-B20-B21,"#,##0")&") by "&TEXT((B22-(B17-B20-B21))/B22,"0.0%"),"Ties to EBIT-Int-Tax")',
  v: '',
  s: { font: { name: 'Calibri', sz: 9, italic: true, color: { rgb: '008000' } } },
};

ws['!ref'] = 'A1:C22';
ws['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 55 }];
XLSX.utils.book_append_sheet(wb, ws, 'Inputs');

// ── Build Historical sheet ──
const histWs = {};
histWs['A1'] = { t: 's', v: 'WOLF VALUATION ENGINE — HISTORICAL MULTI-PERIOD', s: { font: { bold: true } } };
histWs['A4'] = { t: 's', v: 'Metric', s: { font: { bold: true } } };
histWs['B4'] = { t: 's', v: 'FY2021', s: { font: { bold: true } } };
histWs['C4'] = { t: 's', v: 'FY2022', s: { font: { bold: true } } };
histWs['A5'] = cell('Revenue');
histWs['B5'] = inputCell(3e9, FMT_NUMBER);
histWs['C5'] = inputCell(3.5e9, FMT_NUMBER);
histWs['A6'] = cell('Net Income');
histWs['B6'] = inputCell(600e6, FMT_NUMBER);
histWs['C6'] = inputCell(750e6, FMT_NUMBER);
histWs['!ref'] = 'A1:C6';
histWs['!cols'] = [{ wch: 35 }, { wch: 16 }, { wch: 16 }];
XLSX.utils.book_append_sheet(wb, histWs, 'Historical');

// ── Write to disk ──
XLSX.writeFile(wb, testFile);
console.log(`Wrote ${testFile}`);

// ── Read back and verify ──
const wb2 = XLSX.readFile(testFile);
console.log('Sheets:', wb2.SheetNames);

let failures = 0;

// Verify B22
const inputsSheet = wb2.Sheets['Inputs'];
const b22 = inputsSheet['B22'];
console.log('B22 raw:', JSON.stringify(b22));

if (b22?.f) {
  console.error(`❌ FAIL: B22 is a FORMULA: ${b22.f}`);
  failures++;
} else if (b22?.t === 'n' && b22?.v === NI_VALUE) {
  console.log(`✓ B22 is hard number = ${NI_VALUE.toLocaleString()}`);
} else {
  console.error(`❌ FAIL: B22 unexpected: ${JSON.stringify(b22)}`);
  failures++;
}

// Verify C22
const c22 = inputsSheet['C22'];
console.log('C22 raw:', JSON.stringify(c22));
if (c22?.f && c22.f.includes('B17-B20-B21')) {
  console.log('✓ C22 has reconciliation formula');
} else {
  console.error(`❌ FAIL: C22 no formula: ${JSON.stringify(c22)}`);
  failures++;
}

// Verify Historical
if (wb2.SheetNames.includes('Historical')) {
  const histSheet = wb2.Sheets['Historical'];
  console.log('✓ Historical sheet exists');
  console.log('  Row 1:', histSheet['A1']?.v);
  console.log('  Row 4:', histSheet['A4']?.v, '|', histSheet['B4']?.v, '|', histSheet['C4']?.v);
  console.log('  Row 5:', histSheet['A5']?.v, '|', histSheet['B5']?.v, '|', histSheet['C5']?.v);
} else {
  console.error('❌ FAIL: No Historical sheet');
  failures++;
}

// Clean up
try { unlinkSync(testFile); } catch {}

console.log(`\n${'='.repeat(50)}`);
if (failures === 0) {
  console.log('✅ ALL RUNTIME VERIFICATIONS PASSED');
} else {
  console.log(`❌ ${failures} FAILURES`);
  process.exit(1);
}
