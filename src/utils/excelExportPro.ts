import * as XLSX from 'xlsx-js-style';
import { FinancialData, ValuationAssumptions, ComparableCompany } from '../types/financial';
import { calculateEBITDA, calculateWACC } from './valuation';
import { SCENARIO_PARAMS } from './constants/scenarioParams';

// Excel number formats — dynamic based on market region
function makeFMT(isEgypt: boolean) {
  const sym = isEgypt ? '"EGP "' : '"$"';
  return {
    number: '#,##0',
    decimal: '#,##0.00',
    percent: '0.00%',
    currency: `${sym}#,##0`,
    currencyDec: `${sym}#,##0.00`,
    multiple: '0.0"x"',
  };
}

// Create a cell with value and optional format
const cell = (v: string | number | null | undefined, fmt?: string, bold?: boolean): XLSX.CellObject => {
  if (v === null || v === undefined || v === '') {
    return { t: 's', v: '' };
  }
  if (typeof v === 'number') {
    const c: XLSX.CellObject = fmt ? { t: 'n', v, z: fmt } : { t: 'n', v };
    if (bold) c.s = { font: { bold: true } };
    return c;
  }
  const c: XLSX.CellObject = { t: 's', v: String(v) };
  if (bold) c.s = { font: { bold: true } };
  return c;
};

// Create a formula cell with optional format
const formula = (f: string, fmt?: string): XLSX.CellObject => {
  return fmt ? { t: 'n', f, z: fmt } : { t: 'n', f };
};

// Header cell (bold)
const header = (v: string): XLSX.CellObject => {
  return { t: 's', v, s: { font: { bold: true } } };
};

// Apply bold styling to cells in a worksheet — MERGES with existing font (preserves color, name, sz)
const applyBoldRows = (ws: XLSX.WorkSheet, rows: number[]): void => {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (const row of rows) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: row - 1, c });
      if (ws[addr]) {
        if (!ws[addr].s) ws[addr].s = {};
        ws[addr].s = { ...ws[addr].s, font: { ...(ws[addr].s?.font || {}), bold: true } };
      }
    }
  }
};

// ── WOLF BRAND DESIGN SYSTEM ─────────────────────────────────────
// Colors use 6-char hex as per xlsx-js-style README
const WOLF_COLORS = {
  navyDark:   '0D1B2A',
  navyMid:    '2E75B6',   // Medium blue — section headers (readable with white text)
  navyLight:  '2E6DA4',
  inputBlue:  'DCE6F1',
  inputBorder:'4472C4',
  outputGray: 'F2F2F2',
  calcGreen:  'E2EFDA',
  keyOutput:  'FFF2CC',
  bullGreen:  'C6EFCE',
  bullDark:   '375623',
  bearRed:    'FFC7CE',
  bearDark:   'C00000',
  baseGold:   'FFEB9C',
  textDark:   '0D1B2A',
  textMid:    '44546A',
  textWhite:  'FFFFFF',
  borderHard: '1B3A5C',
  borderSoft: 'D9E1EA',
  steelBlue:  'BDD7EE',   // Light steel blue — sub-section headers
};

const solidFill = (rgb: string) => ({ fgColor: { rgb } });
const thinBorder = (color: string) => ({ style: 'thin' as const, color: { rgb: color } });
const medBorder = (color: string) => ({ style: 'medium' as const, color: { rgb: color } });

// Banner cell (navy background, white text, large bold)
const bannerCell = (v: string): XLSX.CellObject => ({
  t: 's', v,
  s: {
    font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: WOLF_COLORS.textWhite } },
    fill: solidFill(WOLF_COLORS.navyDark),
    alignment: { vertical: 'center', horizontal: 'left' },
  },
});

// Section header (medium blue background, white text — readable)
const sectionHeaderCell = (v: string): XLSX.CellObject => ({
  t: 's', v,
  s: {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: WOLF_COLORS.textWhite } },
    fill: solidFill(WOLF_COLORS.navyMid),
    alignment: { vertical: 'center' },
  },
});

// Sub-section header (steel blue background, dark text — for CURRENT ASSETS etc.)
const subSectionCell = (v: string): XLSX.CellObject => ({
  t: 's', v,
  s: {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: WOLF_COLORS.textDark } },
    fill: solidFill(WOLF_COLORS.steelBlue),
  },
});

// Sub-header (gray background, dark text, bottom border)
const subHeaderCell = (v: string): XLSX.CellObject => ({
  t: 's', v,
  s: {
    font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: WOLF_COLORS.textDark } },
    fill: solidFill(WOLF_COLORS.outputGray),
    border: { bottom: medBorder(WOLF_COLORS.borderHard) },
  },
});

// Input cell (blue background, blue border — user editable)
const inputCell = (v: string | number, fmt?: string): XLSX.CellObject => {
  const isNum = typeof v === 'number';
  const border = {
    top: thinBorder(WOLF_COLORS.inputBorder),
    bottom: thinBorder(WOLF_COLORS.inputBorder),
    left: thinBorder(WOLF_COLORS.inputBorder),
    right: thinBorder(WOLF_COLORS.inputBorder),
  };
  return isNum
    ? { t: 'n', v, z: fmt, s: { fill: solidFill(WOLF_COLORS.inputBlue), border, font: { name: 'Calibri', sz: 10 } } }
    : { t: 's', v: String(v), s: { fill: solidFill(WOLF_COLORS.inputBlue), border, font: { name: 'Calibri', sz: 10 } } };
};

// Calculated formula cell (green background)
const calcFormula = (f: string, fmt?: string): XLSX.CellObject => ({
  t: 'n', f, z: fmt,
  s: {
    fill: solidFill(WOLF_COLORS.calcGreen),
    font: { name: 'Calibri', sz: 10, color: { rgb: WOLF_COLORS.textDark } },
  },
});

// Key output cell (gold background, bold large text, navy border)
const keyOutputCell = (f: string, fmt?: string): XLSX.CellObject => ({
  t: 'n', f, z: fmt,
  s: {
    fill: solidFill(WOLF_COLORS.keyOutput),
    font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: WOLF_COLORS.textDark } },
    border: {
      top: medBorder(WOLF_COLORS.navyMid),
      bottom: medBorder(WOLF_COLORS.navyMid),
      left: medBorder(WOLF_COLORS.navyMid),
      right: medBorder(WOLF_COLORS.navyMid),
    },
  },
});

// Bear scenario cell (red-tinted)
const bearCell = (f: string, fmt?: string): XLSX.CellObject => ({
  t: 'n', f, z: fmt,
  s: {
    fill: solidFill(WOLF_COLORS.bearRed),
    font: { name: 'Calibri', sz: 10, color: { rgb: WOLF_COLORS.bearDark } },
  },
});

// Bull scenario cell (green-tinted)
const bullCell = (f: string, fmt?: string): XLSX.CellObject => ({
  t: 'n', f, z: fmt,
  s: {
    fill: solidFill(WOLF_COLORS.bullGreen),
    font: { name: 'Calibri', sz: 10, color: { rgb: WOLF_COLORS.bullDark } },
  },
});

// Base scenario cell (gold-tinted)
const baseCell = (f: string, fmt?: string): XLSX.CellObject => ({
  t: 'n', f, z: fmt,
  s: {
    fill: solidFill(WOLF_COLORS.baseGold),
    font: { name: 'Calibri', sz: 10, bold: true },
  },
});

export const exportToExcelWithFormulas = (
  financialData: FinancialData,
  assumptionsRaw: ValuationAssumptions,
  comparables: ComparableCompany[]
): void => {
  // ── WACC SYNC FIX ─────────────────────────────────────────────────────
  // Recalculate WACC from CAPM inputs and patch assumptions.discountRate
  // so ALL downstream code uses the same single source of truth.
  const syncedWACC = calculateWACC(financialData, assumptionsRaw);
  const assumptions = { ...assumptionsRaw, discountRate: syncedWACC };
  const wb = XLSX.utils.book_new();

  // Market region detection
  const isEgypt = (financialData as any).marketRegion === 'Egypt' || assumptions.riskFreeRate > 10;
  const FMT = makeFMT(isEgypt);
  const currencyLabel = isEgypt ? 'EGP' : 'USD';

  // Pre-calculate values for reference
  const ebitda = calculateEBITDA(financialData);
  const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const marketCap = financialData.currentStockPrice * financialData.sharesOutstanding;
  const enterpriseValue = marketCap + totalDebt - financialData.balanceSheet.cash;
  const currentYear = new Date().getFullYear();

  // ============================================
  // SHEET 1: INPUTS (All editable values)
  // ============================================
  const inputsWs: XLSX.WorkSheet = {};

  // Title — WOLF branded banner
  inputsWs['A1'] = bannerCell('WOLF VALUATION ENGINE — INPUT DATA');
  inputsWs['A2'] = cell('Edit blue cells. Green cells auto-calculate. All other sheets update automatically.');

  // Company Info
  inputsWs['A4'] = sectionHeaderCell('COMPANY INFORMATION');
  inputsWs['A5'] = subHeaderCell('Item');
  inputsWs['B5'] = subHeaderCell('Value');
  inputsWs['A6'] = cell('Company Name');
  inputsWs['B6'] = cell(financialData.companyName);
  inputsWs['A7'] = cell('Ticker Symbol');
  inputsWs['B7'] = cell(financialData.ticker);
  inputsWs['A8'] = cell('Shares Outstanding');
  inputsWs['B8'] = inputCell(financialData.sharesOutstanding, FMT.number);
  inputsWs['A9'] = cell('Current Stock Price');
  inputsWs['B9'] = inputCell(financialData.currentStockPrice, FMT.currencyDec);

  // Income Statement
  inputsWs['A11'] = sectionHeaderCell('INCOME STATEMENT');
  inputsWs['A12'] = subHeaderCell('Item');
  inputsWs['B12'] = subHeaderCell(`Amount (${currencyLabel})`);
  inputsWs['A13'] = cell('Revenue');
  inputsWs['B13'] = inputCell(financialData.incomeStatement.revenue, FMT.number);
  inputsWs['A14'] = cell('Cost of Goods Sold');
  inputsWs['B14'] = inputCell(financialData.incomeStatement.costOfGoodsSold, FMT.number);
  inputsWs['A15'] = cell('Gross Profit');
  inputsWs['B15'] = calcFormula('B13-B14', FMT.number);
  inputsWs['A16'] = cell('Operating Expenses');
  inputsWs['B16'] = inputCell(financialData.incomeStatement.operatingExpenses, FMT.number);
  inputsWs['A17'] = cell('Operating Income (EBIT)');
  inputsWs['B17'] = calcFormula('B15-B16', FMT.number);
  inputsWs['A18'] = cell('Depreciation');
  inputsWs['B18'] = cell(financialData.incomeStatement.depreciation, FMT.number);
  inputsWs['A19'] = cell('Amortization');
  inputsWs['B19'] = cell(financialData.incomeStatement.amortization, FMT.number);
  inputsWs['A20'] = cell('Interest Expense');
  inputsWs['B20'] = cell(financialData.incomeStatement.interestExpense, FMT.number);
  inputsWs['A21'] = cell('Tax Expense');
  inputsWs['B21'] = cell(financialData.incomeStatement.taxExpense, FMT.number);
  inputsWs['A22'] = cell('Net Income');
  inputsWs['B22'] = calcFormula('B17-B20-B21', FMT.number);

  // Balance Sheet - COMPLETE with all line items
  inputsWs['A24'] = sectionHeaderCell('BALANCE SHEET');
  inputsWs['A25'] = subHeaderCell('Item');
  inputsWs['B25'] = subHeaderCell(`Amount (${currencyLabel})`);

  // Current Assets
  inputsWs['A26'] = sectionHeaderCell('CURRENT ASSETS');
  inputsWs['A27'] = cell('Cash & Cash Equivalents');
  inputsWs['B27'] = cell(financialData.balanceSheet.cash, FMT.number);
  inputsWs['A28'] = cell('Marketable Securities');
  inputsWs['B28'] = cell(financialData.balanceSheet.marketableSecurities, FMT.number);
  inputsWs['A29'] = cell('Accounts Receivable');
  inputsWs['B29'] = cell(financialData.balanceSheet.accountsReceivable, FMT.number);
  inputsWs['A30'] = cell('Inventory');
  inputsWs['B30'] = cell(financialData.balanceSheet.inventory, FMT.number);
  inputsWs['A31'] = cell('Other Current Assets');
  inputsWs['B31'] = cell(financialData.balanceSheet.otherCurrentAssets, FMT.number);
  inputsWs['A32'] = cell('Total Current Assets');
  inputsWs['B32'] = calcFormula('SUM(B27:B31)', FMT.number);

  // Non-Current Assets
  inputsWs['A33'] = subSectionCell('NON-CURRENT ASSETS');
  inputsWs['A34'] = cell('PP&E (Net)');
  inputsWs['B34'] = cell(financialData.balanceSheet.propertyPlantEquipment, FMT.number);
  inputsWs['A35'] = cell('Long-term Investments');
  inputsWs['B35'] = cell(financialData.balanceSheet.longTermInvestments, FMT.number);
  inputsWs['A36'] = cell('Goodwill');
  inputsWs['B36'] = cell(financialData.balanceSheet.goodwill, FMT.number);
  inputsWs['A37'] = cell('Intangible Assets');
  inputsWs['B37'] = cell(financialData.balanceSheet.intangibleAssets, FMT.number);
  inputsWs['A38'] = cell('Other Non-Current Assets');
  inputsWs['B38'] = cell(financialData.balanceSheet.otherNonCurrentAssets, FMT.number);
  inputsWs['A39'] = cell('Total Assets');
  inputsWs['B39'] = calcFormula('B32+B34+B35+B36+B37+B38', FMT.number);

  // Current Liabilities
  inputsWs['A40'] = subSectionCell('CURRENT LIABILITIES');
  inputsWs['A41'] = cell('Accounts Payable');
  inputsWs['B41'] = cell(financialData.balanceSheet.accountsPayable, FMT.number);
  inputsWs['A42'] = cell('Short-term Debt');
  inputsWs['B42'] = cell(financialData.balanceSheet.shortTermDebt, FMT.number);
  inputsWs['A43'] = cell('Other Current Liabilities');
  inputsWs['B43'] = cell(financialData.balanceSheet.otherCurrentLiabilities, FMT.number);
  inputsWs['A44'] = cell('Total Current Liabilities');
  inputsWs['B44'] = calcFormula('B41+B42+B43', FMT.number);

  // Non-Current Liabilities
  inputsWs['A45'] = subSectionCell('NON-CURRENT LIABILITIES');
  inputsWs['A46'] = cell('Long-term Debt');
  inputsWs['B46'] = cell(financialData.balanceSheet.longTermDebt, FMT.number);
  inputsWs['A47'] = cell('Other Non-Current Liabilities');
  inputsWs['B47'] = cell(financialData.balanceSheet.otherNonCurrentLiabilities, FMT.number);
  inputsWs['A48'] = cell('Total Liabilities');
  inputsWs['B48'] = calcFormula('B44+B46+B47', FMT.number);

  // Equity
  inputsWs['A49'] = subSectionCell('EQUITY');
  inputsWs['A50'] = cell('Total Shareholders Equity');
  inputsWs['B50'] = calcFormula('B39-B48', FMT.number);

  // Cash Flow - shifted down to row 52
  inputsWs['A52'] = sectionHeaderCell('CASH FLOW STATEMENT');
  inputsWs['A53'] = subHeaderCell('Item');
  inputsWs['B53'] = subHeaderCell(`Amount (${currencyLabel})`);
  inputsWs['A54'] = cell('Operating Cash Flow');
  inputsWs['B54'] = cell(financialData.cashFlowStatement.operatingCashFlow, FMT.number);
  inputsWs['A55'] = cell('Capital Expenditures');
  inputsWs['B55'] = cell(financialData.cashFlowStatement.capitalExpenditures, FMT.number);
  inputsWs['A56'] = cell('Free Cash Flow');
  inputsWs['B56'] = calcFormula('B54-B55', FMT.number);
  inputsWs['A57'] = cell('Dividends Paid');
  inputsWs['B57'] = cell(financialData.cashFlowStatement.dividendsPaid, FMT.number);

  // Assumptions - shifted down to row 59
  inputsWs['A59'] = sectionHeaderCell('VALUATION ASSUMPTIONS');
  inputsWs['A60'] = subHeaderCell('Assumption');
  inputsWs['B60'] = subHeaderCell('Value');
  inputsWs['A61'] = cell('Discount Rate (WACC) %');
  inputsWs['B61'] = cell(assumptions.discountRate, FMT.decimal);
  inputsWs['A62'] = cell('Terminal Growth Rate %');
  inputsWs['B62'] = cell(assumptions.terminalGrowthRate, FMT.decimal);
  inputsWs['A63'] = cell('Revenue Growth Rate %');
  inputsWs['B63'] = cell(assumptions.revenueGrowthRate, FMT.decimal);
  inputsWs['A64'] = cell('Tax Rate %');
  inputsWs['B64'] = cell(assumptions.taxRate, FMT.decimal);
  inputsWs['A65'] = cell('Projection Years');
  inputsWs['B65'] = cell(assumptions.projectionYears, FMT.number);

  // FCFF Driver Assumptions
  inputsWs['A67'] = sectionHeaderCell('FCFF DRIVER ASSUMPTIONS');
  inputsWs['A68'] = subHeaderCell('Item');
  inputsWs['B68'] = subHeaderCell('Value');
  inputsWs['A69'] = cell('EBITDA');
  inputsWs['B69'] = calcFormula('B17+B18+B19', FMT.number);
  inputsWs['A70'] = cell('Total Debt');
  inputsWs['B70'] = calcFormula('B42+B46', FMT.number);
  inputsWs['A71'] = cell('EBITDA Margin %');
  inputsWs['B71'] = cell(assumptions.ebitdaMargin, FMT.decimal);
  inputsWs['A72'] = cell('D&A (% of Revenue)');
  inputsWs['B72'] = cell(assumptions.daPercent, FMT.decimal);
  inputsWs['A73'] = cell('CapEx (% of Revenue)');
  inputsWs['B73'] = cell(assumptions.capexPercent, FMT.decimal);
  inputsWs['A74'] = cell('ΔWC (% of ΔRevenue)');
  inputsWs['B74'] = cell(assumptions.deltaWCPercent, FMT.decimal);
  inputsWs['A75'] = cell('Market Cap');
  inputsWs['B75'] = calcFormula('B8*B9', FMT.number);
  inputsWs['A76'] = cell('Enterprise Value');
  inputsWs['B76'] = calcFormula('B75+B70-B27', FMT.number);

  // Comparable Companies - shifted down to row 78
  inputsWs['A78'] = sectionHeaderCell('COMPARABLE COMPANIES');
  inputsWs['A79'] = subHeaderCell('Company');
  inputsWs['B79'] = subHeaderCell('P/E');
  inputsWs['C79'] = subHeaderCell('EV/EBITDA');
  inputsWs['D79'] = subHeaderCell('P/S');
  inputsWs['E79'] = subHeaderCell('P/B');

  comparables.forEach((comp, i) => {
    const row = 80 + i;
    inputsWs[`A${row}`] = cell(comp.name);
    inputsWs[`B${row}`] = cell(comp.peRatio, FMT.decimal);
    inputsWs[`C${row}`] = cell(comp.evEbitda, FMT.decimal);
    inputsWs[`D${row}`] = cell(comp.psRatio, FMT.decimal);
    inputsWs[`E${row}`] = cell(comp.pbRatio, FMT.decimal);
  });

  // Bug #3 fix: If no custom comparables, add default EGX data so no blank rows
  if (comparables.length === 0) {
    inputsWs['A80'] = cell(`EGX Market Average (${currencyLabel})`);
    inputsWs['B80'] = cell(isEgypt ? 7.0 : 15.0, FMT.decimal);
    inputsWs['C80'] = cell(isEgypt ? 5.0 : 10.0, FMT.decimal);
    inputsWs['D80'] = cell(isEgypt ? 1.2 : 2.0, FMT.decimal);
    inputsWs['E80'] = cell(isEgypt ? 1.5 : 2.5, FMT.decimal);
  }

  // WACC Components (Auto-Calculated) — rows 82–93
  inputsWs['A82'] = sectionHeaderCell('WACC COMPONENTS (Auto-Calculated)');
  inputsWs['A83'] = cell('Risk-Free Rate (Rf) %');
  inputsWs['B83'] = cell(assumptions.riskFreeRate, FMT.decimal);
  inputsWs['A84'] = cell('Equity Risk Premium (ERP) %');
  inputsWs['B84'] = cell(assumptions.marketRiskPremium, FMT.decimal);
  inputsWs['A85'] = cell('Beta');
  inputsWs['B85'] = cell(assumptions.beta, FMT.decimal);
  inputsWs['A86'] = cell('Cost of Equity (Ke) %');
  inputsWs['B86'] = formula('B83+B85*B84', FMT.decimal);
  inputsWs['A87'] = cell('Cost of Debt (pre-tax) %');
  inputsWs['B87'] = cell(assumptions.costOfDebt, FMT.decimal);
  inputsWs['A88'] = cell('Tax Rate %');
  inputsWs['B88'] = formula('B64', FMT.decimal);
  inputsWs['A89'] = cell('Kd (after-tax) %');
  inputsWs['B89'] = formula('B87*(1-B88/100)', FMT.decimal);
  inputsWs['A90'] = cell('Equity Weight (We)');
  inputsWs['B90'] = formula('IFERROR(B75/(B75+B70),1)', FMT.decimal);
  inputsWs['A91'] = cell('Debt Weight (Wd)');
  inputsWs['B91'] = formula('IFERROR(B70/(B75+B70),0)', FMT.decimal);
  inputsWs['A92'] = cell('Calculated WACC %');
  inputsWs['B92'] = keyOutputCell('B90*B86+B91*B89', FMT.decimal);
  inputsWs['A93'] = cell('WACC used in model %');
  inputsWs['B93'] = formula('B92', FMT.decimal);
  // Link B61 to the calculated WACC
  inputsWs['B61'] = formula('B92', FMT.decimal);

  const lastInputRow = Math.max(80 + Math.max(comparables.length, 1), 93);
  inputsWs['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  inputsWs['!ref'] = `A1:E${lastInputRow}`;
  applyBoldRows(inputsWs, [1, 4, 5, 11, 12, 24, 25, 26, 33, 40, 45, 49, 52, 53, 59, 60, 67, 68, 75, 76, 82]);
  XLSX.utils.book_append_sheet(wb, inputsWs, 'Inputs');

  // ============================================
  // SHEET 2: DCF MODEL — FULL FCFF BUILDUP (Fix C1)
  // ============================================
  const dcfWs: XLSX.WorkSheet = {};

  dcfWs['A1'] = bannerCell(`WOLF VALUATION ENGINE — DCF MODEL | ${financialData.companyName} (${financialData.ticker})`);
  dcfWs['A2'] = cell(`All values in ${currencyLabel}`);

  dcfWs['A4'] = sectionHeaderCell('KEY ASSUMPTIONS');
  dcfWs['A5'] = subHeaderCell('Item'); dcfWs['B5'] = subHeaderCell('Value');
  dcfWs['A6'] = cell('Base Revenue'); dcfWs['B6'] = formula('Inputs!B13', FMT.number);
  dcfWs['A7'] = cell('Revenue Growth Rate'); dcfWs['B7'] = formula('Inputs!B63/100', FMT.percent);
  dcfWs['A8'] = cell('EBITDA Margin'); dcfWs['B8'] = formula('Inputs!B71/100', FMT.percent);
  dcfWs['A9'] = cell('D&A (% of Revenue)'); dcfWs['B9'] = formula('Inputs!B72/100', FMT.percent);
  dcfWs['A10'] = cell('Tax Rate'); dcfWs['B10'] = formula('Inputs!B64/100', FMT.percent);
  dcfWs['A11'] = cell('CapEx (% of Revenue)'); dcfWs['B11'] = formula('Inputs!B73/100', FMT.percent);
  dcfWs['A12'] = cell('\u0394WC (% of \u0394Revenue)'); dcfWs['B12'] = formula('Inputs!B74/100', FMT.percent);
  dcfWs['A13'] = cell('WACC'); dcfWs['B13'] = formula('Inputs!B61/100', FMT.percent);
  dcfWs['A14'] = cell('Terminal Growth'); dcfWs['B14'] = formula('Inputs!B62/100', FMT.percent);

  dcfWs['A16'] = sectionHeaderCell('FCFF PROJECTIONS');
  const cols = ['B', 'C', 'D', 'E', 'F', 'G'];
  dcfWs['B17'] = subHeaderCell(`${currentYear} (Actual)`);
  for (let i = 1; i <= 5; i++) dcfWs[`${cols[i]}17`] = subHeaderCell(`${currentYear + i} (Proj)`);

  // Row 18: Revenue
  dcfWs['A18'] = cell('Revenue');
  dcfWs['B18'] = formula('B6', FMT.number);
  for (let i = 1; i <= 5; i++) dcfWs[`${cols[i]}18`] = formula(`${cols[i - 1]}18*(1+$B$7)`, FMT.number);

  // C6 Fix: Base year (col B) uses ACTUAL financials; projected years use assumptions
  // Row 19: EBITDA
  dcfWs['A19'] = cell('EBITDA');
  dcfWs['B19'] = formula('Inputs!B17+Inputs!B18+Inputs!B19', FMT.number); // Actual: EBIT+Depr+Amort
  for (let i = 1; i <= 5; i++) dcfWs[`${cols[i]}19`] = formula(`${cols[i]}18*$B$8`, FMT.number);

  // Row 20: D&A
  dcfWs['A20'] = cell('D&A');
  dcfWs['B20'] = formula('Inputs!B18+Inputs!B19', FMT.number); // Actual: Depr+Amort
  for (let i = 1; i <= 5; i++) dcfWs[`${cols[i]}20`] = formula(`${cols[i]}18*$B$9`, FMT.number);

  // Row 21: EBIT
  dcfWs['A21'] = cell('EBIT');
  dcfWs['B21'] = formula('Inputs!B17', FMT.number); // Actual: Operating Income
  for (let i = 1; i <= 5; i++) dcfWs[`${cols[i]}21`] = formula(`${cols[i]}19-${cols[i]}20`, FMT.number);

  // Row 22: NOPAT
  dcfWs['A22'] = cell('NOPAT');
  for (const c of cols) dcfWs[`${c}22`] = formula(`${c}21*(1-$B$10)`, FMT.number);

  // Row 23: CapEx
  dcfWs['A23'] = cell('CapEx');
  dcfWs['B23'] = formula('Inputs!B55', FMT.number); // Actual: CFS CapEx
  for (let i = 1; i <= 5; i++) dcfWs[`${cols[i]}23`] = formula(`${cols[i]}18*$B$11`, FMT.number);

  // Row 24: \u0394WC
  dcfWs['A24'] = cell('\u0394WC');
  dcfWs['B24'] = cell(0, FMT.number);
  for (let i = 1; i <= 5; i++) dcfWs[`${cols[i]}24`] = formula(`(${cols[i]}18-${cols[i - 1]}18)*$B$12`, FMT.number);

  // Row 25: FCFF = NOPAT + D&A - CapEx - \u0394WC
  dcfWs['A25'] = header('FCFF');
  for (const c of cols) dcfWs[`${c}25`] = formula(`${c}22+${c}20-${c}23-${c}24`, FMT.number);

  // Row 26: Discount Factor
  dcfWs['A26'] = cell('Discount Factor');
  dcfWs['B26'] = formula('1/POWER(1+$B$13,0)', FMT.decimal);
  for (let i = 1; i <= 5; i++) dcfWs[`${cols[i]}26`] = formula(`1/POWER(1+$B$13,${i})`, FMT.decimal);

  // Row 27: PV of FCFF
  dcfWs['A27'] = cell('PV of FCFF');
  dcfWs['B27'] = formula('B25*B26', FMT.number);
  for (let i = 1; i <= 5; i++) dcfWs[`${cols[i]}27`] = formula(`${cols[i]}25*${cols[i]}26`, FMT.number);

  // Valuation Summary
  dcfWs['A29'] = sectionHeaderCell('VALUATION SUMMARY');
  dcfWs['A30'] = subHeaderCell('Item'); dcfWs['B30'] = subHeaderCell('Value');
  dcfWs['A31'] = cell('Sum PV(FCFF)'); dcfWs['B31'] = formula('SUM(C27:G27)', FMT.number);
  dcfWs['A32'] = cell('Terminal Value'); dcfWs['B32'] = formula('IFERROR(G25*(1+$B$14)/($B$13-$B$14),0)', FMT.number);
  dcfWs['A33'] = cell('PV(Terminal Value)'); dcfWs['B33'] = formula('IFERROR(B32*G26,0)', FMT.number);
  dcfWs['A34'] = cell('Enterprise Value'); dcfWs['B34'] = formula('B31+B33', FMT.number);
  dcfWs['A35'] = cell('Plus: Cash'); dcfWs['B35'] = formula('Inputs!B27', FMT.number);
  dcfWs['A36'] = cell('Less: Total Debt'); dcfWs['B36'] = formula('Inputs!B70', FMT.number);
  dcfWs['A37'] = cell('Equity Value'); dcfWs['B37'] = formula('B34+B35-B36', FMT.number);
  dcfWs['A38'] = cell('Shares Outstanding'); dcfWs['B38'] = formula('Inputs!B8', FMT.number);
  dcfWs['A39'] = header('DCF Per Share'); dcfWs['B39'] = keyOutputCell('IFERROR(B37/B38,0)', FMT.currencyDec);
  dcfWs['A41'] = cell('Current Price'); dcfWs['B41'] = formula('Inputs!B9', FMT.currencyDec);
  dcfWs['A42'] = header('Upside/(Downside)'); dcfWs['B42'] = formula('IFERROR((B39-B41)/B41,0)', FMT.percent);

  dcfWs['!cols'] = [{ wch: 22 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  dcfWs['!ref'] = 'A1:G42';
  applyBoldRows(dcfWs, [1, 4, 5, 16, 25, 29, 30, 39, 42]);
  XLSX.utils.book_append_sheet(wb, dcfWs, 'DCF Model');



  // ============================================
  // SHEET 3: COMPARABLE ANALYSIS
  // ============================================
  const compWs: XLSX.WorkSheet = {};

  compWs['A1'] = bannerCell('WOLF VALUATION ENGINE — COMPARABLE COMPANY ANALYSIS');
  compWs['A2'] = cell('Multiple-based valuation');

  // Comparables table header
  compWs['A4'] = sectionHeaderCell('PEER COMPANY MULTIPLES');
  compWs['A5'] = subHeaderCell('Company');
  compWs['B5'] = subHeaderCell('P/E');
  compWs['C5'] = subHeaderCell('EV/EBITDA');
  compWs['D5'] = subHeaderCell('P/S');
  compWs['E5'] = subHeaderCell('P/B');

  // Reference comparable data from Inputs (C3: add EGX defaults if no peers)
  const hasPeers = comparables.length > 0;
  const compCount = Math.max(comparables.length, 1);
  if (hasPeers) {
    for (let i = 0; i < compCount; i++) {
      const row = 6 + i;
      const inputRow = 80 + i;
      compWs[`A${row}`] = formula(`Inputs!A${inputRow}`);
      compWs[`B${row}`] = formula(`Inputs!B${inputRow}`, FMT.decimal);
      compWs[`C${row}`] = formula(`Inputs!C${inputRow}`, FMT.decimal);
      compWs[`D${row}`] = formula(`Inputs!D${inputRow}`, FMT.decimal);
      compWs[`E${row}`] = formula(`Inputs!E${inputRow}`, FMT.decimal);
    }
  } else {
    // EGX Market Average defaults
    compWs['A6'] = cell(`EGX Market Average (${currencyLabel})`);
    compWs['B6'] = cell(isEgypt ? 7.0 : 15.0, FMT.decimal);
    compWs['C6'] = cell(isEgypt ? 5.0 : 10.0, FMT.decimal);
    compWs['D6'] = cell(isEgypt ? 1.2 : 2.0, FMT.decimal);
    compWs['E6'] = cell(isEgypt ? 1.5 : 2.5, FMT.decimal);
  }

  // Averages row
  const avgRow = 6 + compCount + 1;
  compWs[`A${avgRow}`] = header('Average Multiple');
  compWs[`B${avgRow}`] = hasPeers ? formula(`IFERROR(AVERAGE(B6:B${avgRow - 2}),0)`, FMT.decimal) : cell(isEgypt ? 7.0 : 15.0, FMT.decimal);
  compWs[`C${avgRow}`] = hasPeers ? formula(`IFERROR(AVERAGE(C6:C${avgRow - 2}),0)`, FMT.decimal) : cell(isEgypt ? 5.0 : 10.0, FMT.decimal);
  compWs[`D${avgRow}`] = hasPeers ? formula(`IFERROR(AVERAGE(D6:D${avgRow - 2}),0)`, FMT.decimal) : cell(isEgypt ? 1.2 : 2.0, FMT.decimal);
  compWs[`E${avgRow}`] = hasPeers ? formula(`IFERROR(AVERAGE(E6:E${avgRow - 2}),0)`, FMT.decimal) : cell(isEgypt ? 1.5 : 2.5, FMT.decimal);

  // Implied Valuations
  const impliedRow = avgRow + 3;
  compWs[`A${impliedRow}`] = header('IMPLIED SHARE PRICE VALUATIONS');

  compWs[`A${impliedRow + 1}`] = header('Method');
  compWs[`B${impliedRow + 1}`] = header('Implied Price');
  compWs[`C${impliedRow + 1}`] = header('Multiple Used');
  compWs[`D${impliedRow + 1}`] = header('Per Share Metric');

  // P/E Valuation
  compWs[`A${impliedRow + 2}`] = cell('P/E Valuation');
  compWs[`B${impliedRow + 2}`] = formula(`IFERROR((Inputs!B22/Inputs!B8)*B${avgRow},0)`, FMT.currencyDec);
  compWs[`C${impliedRow + 2}`] = formula(`B${avgRow}`, FMT.multiple);
  compWs[`D${impliedRow + 2}`] = formula('IFERROR(Inputs!B22/Inputs!B8,0)', FMT.currencyDec);

  // EV/EBITDA Valuation
  compWs[`A${impliedRow + 3}`] = cell('EV/EBITDA Valuation');
  compWs[`B${impliedRow + 3}`] = formula(`IFERROR((Inputs!B69*C${avgRow}-Inputs!B70+Inputs!B27)/Inputs!B8,0)`, FMT.currencyDec);
  compWs[`C${impliedRow + 3}`] = formula(`C${avgRow}`, FMT.multiple);
  compWs[`D${impliedRow + 3}`] = formula('Inputs!B69', FMT.number);

  // P/S Valuation  
  compWs[`A${impliedRow + 4}`] = cell('P/S Valuation');
  compWs[`B${impliedRow + 4}`] = formula(`IFERROR((Inputs!B13/Inputs!B8)*D${avgRow},0)`, FMT.currencyDec);
  compWs[`C${impliedRow + 4}`] = formula(`D${avgRow}`, FMT.multiple);
  compWs[`D${impliedRow + 4}`] = formula('IFERROR(Inputs!B13/Inputs!B8,0)', FMT.currencyDec);

  // P/B Valuation
  compWs[`A${impliedRow + 5}`] = cell('P/B Valuation');
  compWs[`B${impliedRow + 5}`] = formula(`IFERROR((MAX(Inputs!B50,0)/Inputs!B8)*E${avgRow},0)`, FMT.currencyDec);
  compWs[`C${impliedRow + 5}`] = formula(`E${avgRow}`, FMT.multiple);
  compWs[`D${impliedRow + 5}`] = formula('IFERROR(MAX(Inputs!B50,0)/Inputs!B8,0)', FMT.currencyDec);

  // Blending Weights section — user-editable
  const weightsRow = impliedRow + 7;
  compWs[`A${weightsRow}`] = header('BLENDING WEIGHTS');
  compWs[`A${weightsRow + 1}`] = cell('P/E Weight');
  compWs[`B${weightsRow + 1}`] = cell(0.40, FMT.decimal);
  compWs[`A${weightsRow + 2}`] = cell('EV/EBITDA Weight');
  compWs[`B${weightsRow + 2}`] = cell(0.35, FMT.decimal);
  compWs[`A${weightsRow + 3}`] = cell('P/S Weight');
  compWs[`B${weightsRow + 3}`] = cell(0.15, FMT.decimal);
  compWs[`A${weightsRow + 4}`] = cell('P/B Weight');
  compWs[`B${weightsRow + 4}`] = cell(0.10, FMT.decimal);

  // Summary
  const summaryRow = weightsRow + 6;
  compWs[`A${summaryRow}`] = header('SUMMARY');
  compWs[`A${summaryRow + 1}`] = header('Weighted Average');
  compWs[`B${summaryRow + 1}`] = formula(`IFERROR(B${weightsRow + 1}*B${impliedRow + 2}+B${weightsRow + 2}*B${impliedRow + 3}+B${weightsRow + 3}*B${impliedRow + 4}+B${weightsRow + 4}*B${impliedRow + 5},0)`, FMT.currencyDec);

  compWs[`A${summaryRow + 2}`] = cell('Current Stock Price');
  compWs[`B${summaryRow + 2}`] = formula('Inputs!B9', FMT.currencyDec);

  compWs[`A${summaryRow + 3}`] = header('Upside / (Downside)');
  compWs[`B${summaryRow + 3}`] = formula(`IFERROR((B${summaryRow + 1}-B${summaryRow + 2})/B${summaryRow + 2},0)`, FMT.percent);

  // Bug #4 fix: Narrow column widths to prevent table splitting across pages
  compWs['!cols'] = [{ wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }];
  compWs['!ref'] = `A1:E${summaryRow + 4}`;
  // M3: Fit to one page wide when printing to prevent P/B column from splitting
  (compWs as any)['!print'] = { FitToWidth: 1, FitToHeight: 0 };
  (compWs as any)['!pageSetup'] = { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, scale: 0 };
  applyBoldRows(compWs, [1, 4, 5, avgRow, impliedRow, impliedRow + 1, weightsRow, summaryRow, summaryRow + 1, summaryRow + 3]);
  XLSX.utils.book_append_sheet(wb, compWs, 'Comparables');

  // ============================================
  // SHEET 4: FINANCIAL RATIOS
  // ============================================
  const ratiosWs: XLSX.WorkSheet = {};

  ratiosWs['A1'] = bannerCell('WOLF VALUATION ENGINE — KEY FINANCIAL RATIOS & METRICS');

  // Market Data
  ratiosWs['A3'] = sectionHeaderCell('MARKET DATA');
  ratiosWs['A4'] = subHeaderCell('Metric');
  ratiosWs['B4'] = subHeaderCell('Value');
  ratiosWs['A5'] = cell('Market Capitalization');
  ratiosWs['B5'] = formula('Inputs!B8*Inputs!B9', FMT.number);
  ratiosWs['A6'] = cell('Enterprise Value');
  ratiosWs['B6'] = formula('B5+Inputs!B70-Inputs!B27', FMT.number);
  ratiosWs['A7'] = cell('Net Debt');
  ratiosWs['B7'] = formula('Inputs!B70-Inputs!B27', FMT.number);

  // Valuation Ratios
  ratiosWs['A9'] = sectionHeaderCell('VALUATION RATIOS');
  ratiosWs['A10'] = subHeaderCell('Ratio');
  ratiosWs['B10'] = subHeaderCell('Value');
  ratiosWs['A11'] = cell('P/E Ratio');
  ratiosWs['B11'] = formula('IFERROR(B5/Inputs!B22,0)', FMT.decimal);
  ratiosWs['A12'] = cell('EV/EBITDA');
  ratiosWs['B12'] = formula('IFERROR(B6/Inputs!B69,0)', FMT.decimal);
  ratiosWs['A13'] = cell('P/S Ratio');
  ratiosWs['B13'] = formula('IFERROR(B5/Inputs!B13,0)', FMT.decimal);
  ratiosWs['A14'] = cell('P/B Ratio');
  ratiosWs['B14'] = formula('IFERROR(B5/MAX(Inputs!B50,1),0)', FMT.decimal);
  ratiosWs['A15'] = cell('EPS (Earnings Per Share)');
  ratiosWs['B15'] = formula('IFERROR(Inputs!B22/Inputs!B8,0)', FMT.currencyDec);
  ratiosWs['A16'] = cell('Book Value Per Share');
  ratiosWs['B16'] = formula('IFERROR(Inputs!B50/Inputs!B8,0)', FMT.currencyDec);

  // Profitability
  ratiosWs['A18'] = sectionHeaderCell('PROFITABILITY RATIOS');
  ratiosWs['A19'] = subHeaderCell('Ratio');
  ratiosWs['B19'] = subHeaderCell('Value');
  ratiosWs['A20'] = cell('Gross Margin');
  ratiosWs['B20'] = formula('IFERROR(Inputs!B15/Inputs!B13,0)', FMT.percent);
  ratiosWs['A21'] = cell('Operating Margin');
  ratiosWs['B21'] = formula('IFERROR(Inputs!B17/Inputs!B13,0)', FMT.percent);
  ratiosWs['A22'] = cell('Net Profit Margin');
  ratiosWs['B22'] = formula('IFERROR(Inputs!B22/Inputs!B13,0)', FMT.percent);
  ratiosWs['A23'] = cell('EBITDA Margin');
  ratiosWs['B23'] = formula('IFERROR(Inputs!B69/Inputs!B13,0)', FMT.percent);
  ratiosWs['A24'] = cell('FCF Margin');
  ratiosWs['B24'] = formula('IFERROR(Inputs!B56/Inputs!B13,0)', FMT.percent);
  ratiosWs['A25'] = cell('ROE (Return on Equity)');
  ratiosWs['B25'] = formula('IFERROR(Inputs!B22/MAX(Inputs!B50,1),0)', FMT.percent);
  ratiosWs['A26'] = cell('ROA (Return on Assets)');
  ratiosWs['B26'] = formula('IFERROR(Inputs!B22/MAX(Inputs!B39,1),0)', FMT.percent);
  // C4 Fix: ROIC IC = Equity + Debt − Cash (was missing Cash deduction)
  ratiosWs['A27'] = cell('ROIC');
  ratiosWs['B27'] = formula('IFERROR(Inputs!B17*(1-Inputs!B64/100)/(Inputs!B50+Inputs!B70-Inputs!B27),0)', FMT.percent);

  // Financial Health
  ratiosWs['A29'] = sectionHeaderCell('FINANCIAL HEALTH');
  ratiosWs['A30'] = subHeaderCell('Ratio');
  ratiosWs['B30'] = subHeaderCell('Value');
  ratiosWs['A31'] = cell('Current Ratio');
  ratiosWs['B31'] = formula('IFERROR(Inputs!B32/MAX(Inputs!B44,1),0)', FMT.decimal);
  ratiosWs['A32'] = cell('Quick Ratio');
  ratiosWs['B32'] = formula('IFERROR((Inputs!B27+Inputs!B29)/MAX(Inputs!B44,1),0)', FMT.decimal);
  ratiosWs['A33'] = cell('Debt to Equity');
  ratiosWs['B33'] = formula('IFERROR(Inputs!B70/MAX(Inputs!B50,1),0)', FMT.decimal);
  ratiosWs['A34'] = cell('Debt to EBITDA');
  ratiosWs['B34'] = formula('IFERROR(Inputs!B70/MAX(Inputs!B69,1),0)', FMT.decimal);
  ratiosWs['A35'] = cell('Interest Coverage');
  ratiosWs['B35'] = formula('IFERROR(Inputs!B17/MAX(Inputs!B20,1),0)', FMT.decimal);
  ratiosWs['A36'] = cell('FCF Yield');
  ratiosWs['B36'] = formula('IFERROR(Inputs!B56/MAX(B5,1),0)', FMT.percent);
  ratiosWs['A37'] = cell('Dividend Yield');
  ratiosWs['B37'] = formula('IFERROR(Inputs!B57/MAX(B5,1),0)', FMT.percent);
  // IMP8: Net Debt/EBITDA
  ratiosWs['A38'] = cell('Net Debt/EBITDA');
  ratiosWs['B38'] = formula('IFERROR(B7/MAX(Inputs!B69,1),0)', FMT.decimal);

  ratiosWs['!cols'] = [{ wch: 28 }, { wch: 18 }];
  ratiosWs['!ref'] = 'A1:B38';
  applyBoldRows(ratiosWs, [1, 3, 4, 9, 10, 18, 19, 29, 30]);
  XLSX.utils.book_append_sheet(wb, ratiosWs, 'Ratios');

  // ============================================
  // SHEET 5: DASHBOARD
  // ============================================
  const dashWs: XLSX.WorkSheet = {};
  const impliedRowRef = avgRow + 3; // Reference for comparables sheet

  dashWs['A1'] = bannerCell('WOLF VALUATION DASHBOARD');
  dashWs['A2'] = formula('Inputs!B6&" ("&Inputs!B7&")"');
  dashWs['A3'] = cell(`Analysis Date: ${new Date().toLocaleDateString()}`);

  // Valuation Methods Summary
  dashWs['A5'] = sectionHeaderCell('BLENDED VALUATION ANALYSIS');
  dashWs['A6'] = subHeaderCell('Method');
  dashWs['B6'] = subHeaderCell('Implied Price');
  dashWs['C6'] = subHeaderCell('Weight');
  dashWs['D6'] = subHeaderCell('Weighted Value');

  dashWs['A7'] = cell('DCF Valuation');
  dashWs['B7'] = formula("'DCF Model'!B39", FMT.currencyDec);
  dashWs['C7'] = cell(0.6, FMT.percent);
  dashWs['D7'] = formula('B7*C7', FMT.currencyDec);

  dashWs['A8'] = cell('Comps Weighted Avg');
  dashWs['B8'] = formula(`'Comparables'!B${impliedRowRef + 14}`, FMT.currencyDec);
  dashWs['C8'] = formula('1-C7', FMT.percent);
  dashWs['D8'] = formula('B8*C8', FMT.currencyDec);

  // Weight check
  dashWs['A9'] = cell('Weight Check');
  dashWs['B9'] = formula('C7+C8', FMT.decimal);

  dashWs['A10'] = sectionHeaderCell('FINAL VALUATION');
  dashWs['A11'] = subHeaderCell('Item');
  dashWs['B11'] = subHeaderCell('Value');
  dashWs['A12'] = header('Blended Target Price');
  dashWs['B12'] = formula('SUM(D7:D8)', FMT.currencyDec);

  dashWs['A14'] = cell('Current Stock Price');
  dashWs['B14'] = formula('Inputs!B9', FMT.currencyDec);

  dashWs['A15'] = header('Upside / (Downside)');
  dashWs['B15'] = formula('IFERROR((B12-B14)/B14,0)', FMT.percent);

  // C4 Fix: Unified recommendation with both verdict and action
  dashWs['A17'] = header('VERDICT');
  dashWs['A18'] = formula('IF(B15>0.10,"UNDERVALUED",IF(B15>=-0.10,"FAIRLY VALUED","OVERVALUED"))');
  dashWs['A19'] = header('INVESTMENT RECOMMENDATION');
  dashWs['A20'] = formula('IF(B15>0.30,"STRONG BUY",IF(B15>0.10,"BUY",IF(B15>=-0.10,"HOLD",IF(B15>=-0.30,"SELL","STRONG SELL"))))');

  // Key Metrics Summary
  dashWs['A22'] = sectionHeaderCell('KEY METRICS SNAPSHOT');
  dashWs['A23'] = subHeaderCell('Metric'); dashWs['B23'] = subHeaderCell('Value');
  dashWs['A24'] = cell('Market Cap'); dashWs['B24'] = formula("'Ratios'!B5", FMT.number);
  dashWs['A25'] = cell('Enterprise Value'); dashWs['B25'] = formula("'Ratios'!B6", FMT.number);
  dashWs['A26'] = cell('P/E Ratio'); dashWs['B26'] = formula("'Ratios'!B11", FMT.decimal);
  dashWs['A27'] = cell('EV/EBITDA'); dashWs['B27'] = formula("'Ratios'!B12", FMT.decimal);
  dashWs['A28'] = cell('Net Margin'); dashWs['B28'] = formula("'Ratios'!B22", FMT.percent);
  dashWs['A29'] = cell('ROE'); dashWs['B29'] = formula("'Ratios'!B25", FMT.percent);
  dashWs['A30'] = cell('FCF Yield'); dashWs['B30'] = formula("'Ratios'!B36", FMT.percent);
  dashWs['A31'] = cell('Debt/EBITDA'); dashWs['B31'] = formula("'Ratios'!B34", FMT.decimal);

  dashWs['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 12 }, { wch: 18 }];
  dashWs['!ref'] = 'A1:D31';
  applyBoldRows(dashWs, [1, 5, 6, 10, 11, 12, 15, 17, 19, 22, 23]);
  XLSX.utils.book_append_sheet(wb, dashWs, 'Dashboard');

  // ============================================
  // HIDDEN _CALC SHEET: FCFF Buildup (Excel 2019 compatible)
  // ============================================
  const calcWs: XLSX.WorkSheet = {};

  // _Calc Row 1-11: Input references
  calcWs['A1'] = cell('Base Revenue');        calcWs['B1'] = formula('Inputs!B13', FMT.number);
  calcWs['A2'] = cell('Rev Growth Rate');      calcWs['B2'] = formula('Inputs!B63/100', FMT.decimal);
  calcWs['A3'] = cell('EBITDA Margin');         calcWs['B3'] = formula('Inputs!B71/100', FMT.decimal);
  calcWs['A4'] = cell('D&A %');                 calcWs['B4'] = formula('Inputs!B72/100', FMT.decimal);
  calcWs['A5'] = cell('Tax Rate');              calcWs['B5'] = formula('Inputs!B64/100', FMT.decimal);
  calcWs['A6'] = cell('CapEx %');               calcWs['B6'] = formula('Inputs!B73/100', FMT.decimal);
  calcWs['A7'] = cell('WC % of ΔRevenue');     calcWs['B7'] = formula('Inputs!B74/100', FMT.decimal);
  calcWs['A8'] = cell('Shares Outstanding');    calcWs['B8'] = formula('Inputs!B8', FMT.number);
  calcWs['A9'] = cell('Total Debt');            calcWs['B9'] = formula('Inputs!B42+Inputs!B46', FMT.number);
  calcWs['A10'] = cell('Cash');                 calcWs['B10'] = formula('Inputs!B27', FMT.number);
  calcWs['A11'] = cell('Projection Years');     calcWs['B11'] = formula('Inputs!B65', FMT.number);

  // _Calc Row 19: Headers for FCFF buildup
  calcWs['A19'] = header('BASE CASE FCFF');
  const calcCols = ['B', 'C', 'D', 'E', 'F', 'G']; // Year 0 (base) through Year 5
  calcCols.forEach((c, i) => { calcWs[`${c}19`] = header(i === 0 ? 'Base' : `Year ${i}`); });

  // Row 20: Revenue buildup
  calcWs['A20'] = cell('Revenue');
  calcWs['B20'] = formula('$B$1', FMT.number); // Base year = R0
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}20`] = formula(`${calcCols[yr - 1]}20*(1+$B$2)`, FMT.number);
  }

  // Row 21: EBITDA
  calcWs['A21'] = cell('EBITDA');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}21`] = formula(`${calcCols[yr]}20*$B$3`, FMT.number);
  }

  // Row 22: D&A
  calcWs['A22'] = cell('D&A');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}22`] = formula(`${calcCols[yr]}20*$B$4`, FMT.number);
  }

  // Row 23: NOPAT = (EBITDA - D&A)*(1-tax)
  calcWs['A23'] = cell('NOPAT');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}23`] = formula(`(${calcCols[yr]}21-${calcCols[yr]}22)*(1-$B$5)`, FMT.number);
  }

  // Row 24: CapEx
  calcWs['A24'] = cell('CapEx');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}24`] = formula(`${calcCols[yr]}20*$B$6`, FMT.number);
  }

  // Row 25: ΔWC
  calcWs['A25'] = cell('ΔWC');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}25`] = formula(`(${calcCols[yr]}20-${calcCols[yr - 1]}20)*$B$7`, FMT.number);
  }

  // Row 26: FCFF = NOPAT + D&A - CapEx - ΔWC
  calcWs['A26'] = cell('FCFF');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}26`] = formula(`${calcCols[yr]}23+${calcCols[yr]}22-${calcCols[yr]}24-${calcCols[yr]}25`, FMT.number);
  }

  // ── BEAR scenario (rows 39-46) ──
  calcWs['A39'] = header('BEAR CASE FCFF');
  calcWs['A40'] = cell('Revenue');
  calcWs['B40'] = formula('$B$1', FMT.number);
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}40`] = formula(`${calcCols[yr - 1]}40*(1+Inputs!B63/100*0.40)`, FMT.number);
  }
  // Row 41: EBITDA with margin compression (-1.5pp per year)
  calcWs['A41'] = cell('EBITDA');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}41`] = formula(`${calcCols[yr]}40*(Inputs!B71/100-0.015*${yr})`, FMT.number);
  }
  // Rows 42-46: D&A, NOPAT, CapEx, ΔWC, FCFF for bear
  calcWs['A42'] = cell('D&A');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}42`] = formula(`${calcCols[yr]}40*$B$4`, FMT.number);
  }
  calcWs['A43'] = cell('NOPAT');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}43`] = formula(`(${calcCols[yr]}41-${calcCols[yr]}42)*(1-$B$5)`, FMT.number);
  }
  calcWs['A44'] = cell('CapEx');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}44`] = formula(`${calcCols[yr]}40*$B$6`, FMT.number);
  }
  calcWs['A45'] = cell('ΔWC');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}45`] = formula(`(${calcCols[yr]}40-${calcCols[yr - 1]}40)*$B$7`, FMT.number);
  }
  calcWs['A46'] = cell('FCFF');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}46`] = formula(`${calcCols[yr]}43+${calcCols[yr]}42-${calcCols[yr]}44-${calcCols[yr]}45`, FMT.number);
  }

  // ── BULL scenario (rows 59-66) ──
  calcWs['A59'] = header('BULL CASE FCFF');
  calcWs['A60'] = cell('Revenue');
  calcWs['B60'] = formula('$B$1', FMT.number);
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}60`] = formula(`${calcCols[yr - 1]}60*(1+Inputs!B63/100*2.00)`, FMT.number);
  }
  // Row 61: EBITDA with margin expansion (+2.5pp per year)
  calcWs['A61'] = cell('EBITDA');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}61`] = formula(`${calcCols[yr]}60*(Inputs!B71/100+0.025*${yr})`, FMT.number);
  }
  calcWs['A62'] = cell('D&A');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}62`] = formula(`${calcCols[yr]}60*$B$4`, FMT.number);
  }
  calcWs['A63'] = cell('NOPAT');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}63`] = formula(`(${calcCols[yr]}61-${calcCols[yr]}62)*(1-$B$5)`, FMT.number);
  }
  calcWs['A64'] = cell('CapEx');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}64`] = formula(`${calcCols[yr]}60*$B$6`, FMT.number);
  }
  calcWs['A65'] = cell('ΔWC');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}65`] = formula(`(${calcCols[yr]}60-${calcCols[yr - 1]}60)*$B$7`, FMT.number);
  }
  calcWs['A66'] = cell('FCFF');
  for (let yr = 1; yr <= 5; yr++) {
    calcWs[`${calcCols[yr]}66`] = formula(`${calcCols[yr]}63+${calcCols[yr]}62-${calcCols[yr]}64-${calcCols[yr]}65`, FMT.number);
  }

  calcWs['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  calcWs['!ref'] = 'A1:G66';
  XLSX.utils.book_append_sheet(wb, calcWs, '_Calc');
  // Hide the _Calc sheet
  (wb.Workbook || (wb.Workbook = {}));
  (wb.Workbook.Sheets || (wb.Workbook.Sheets = []));
  const calcSheetIdx = wb.SheetNames.indexOf('_Calc');
  while (wb.Workbook.Sheets.length <= calcSheetIdx) wb.Workbook.Sheets.push({});
  wb.Workbook.Sheets[calcSheetIdx].Hidden = 1;

  // ============================================
  // SHEET 6: SENSITIVITY ANALYSIS (Excel 2019 compatible — no LET)
  // ============================================
  const sensWs: XLSX.WorkSheet = {};

  sensWs['A1'] = bannerCell('WOLF VALUATION ENGINE — SENSITIVITY ANALYSIS');
  sensWs['A2'] = cell('DCF per share at different WACC / terminal growth combinations');
  sensWs['A3'] = cell('Change WACC or terminal growth on the Inputs sheet. This table recalculates automatically.');

  // Axis headers — real number formulas with 0.0% number format (NOT TEXT)
  sensWs['A4'] = subHeaderCell('WACC \\\\ Growth');
  const gOffsets = [-0.03, -0.015, 0, 0.015, 0.03];
  const wOffsets = [-0.04, -0.02, 0, 0.02, 0.04];
  const sensCols = ['B', 'C', 'D', 'E', 'F'];

  // Growth column headers (row 4) — real numbers with % format
  gOffsets.forEach((gOff, gi) => {
    const gStr = gOff === 0 ? 'Inputs!B62/100' : `Inputs!B62/100${gOff > 0 ? '+' : ''}${gOff}`;
    sensWs[`${sensCols[gi]}4`] = formula(gStr, '0.0%');
  });

  // WACC row headers (column A, rows 5-9) — real numbers with % format
  wOffsets.forEach((wOff, wi) => {
    const wStr = wOff === 0 ? 'Inputs!B61/100' : `Inputs!B61/100${wOff > 0 ? '+' : ''}${wOff}`;
    sensWs[`A${5 + wi}`] = formula(wStr, '0.0%');
  });

  // 25 DCF price cells (B5:F9) — reference _Calc FCFFs, discount at row WACC($A), terminal growth(col$4)
  // Formula: IFERROR((C26/(1+$A7)^1 + D26/(1+$A7)^2 + ... + TV) - debt + cash, 0) / shares
  wOffsets.forEach((_wOff, wi) => {
    gOffsets.forEach((_gOff, gi) => {
      const row = 5 + wi;
      const col = sensCols[gi];
      const wRef = `$A${row}`;  // WACC value in row header
      const gRef = `${col}$4`;  // Terminal growth in column header
      const f = `IFERROR(('_Calc'!C26/(1+${wRef})^1+'_Calc'!D26/(1+${wRef})^2+'_Calc'!E26/(1+${wRef})^3+'_Calc'!F26/(1+${wRef})^4+'_Calc'!G26/(1+${wRef})^5+IF(${wRef}>${gRef},'_Calc'!G26*(1+${gRef})/(${wRef}-${gRef})/(1+${wRef})^5,0)-'_Calc'!$B$9+'_Calc'!$B$10)/'_Calc'!$B$8,0)`;
      sensWs[`${col}${row}`] = formula(f, FMT.currencyDec);
    });
  });

  // Base cell check: D7 should equal DCF Model B39
  sensWs['A11'] = cell('Base cell check:');
  sensWs['B11'] = formula("D7-'DCF Model'!B39", FMT.decimal);
  sensWs['C11'] = formula('IF(ABS(B11)<0.01,"\u2705 MATCH","\u274C MISMATCH")');

  // Scenario Analysis
  sensWs['A12'] = sectionHeaderCell('SCENARIO ANALYSIS');
  sensWs['A13'] = subHeaderCell('Scenario'); sensWs['B13'] = subHeaderCell('Rev Growth %');
  sensWs['C13'] = subHeaderCell('WACC %'); sensWs['D13'] = subHeaderCell('EBITDA Margin %');
  sensWs['E13'] = subHeaderCell(`Price (${currencyLabel})`);

  // Bear Case (row 14) — references _Calc rows 40-46
  sensWs['A14'] = cell('BEAR CASE');
  sensWs['B14'] = bearCell('Inputs!B63*0.40', FMT.decimal);
  sensWs['C14'] = bearCell('Inputs!B61+2.5', FMT.decimal);
  sensWs['D14'] = bearCell('Inputs!B71', FMT.decimal);
  // Bear price: discount _Calc bear FCFFs at WACC+2.5pp, terminal growth = base*0.75
  sensWs['E14'] = formula(`IFERROR(('_Calc'!C46/(1+(Inputs!B61/100+0.025))^1+'_Calc'!D46/(1+(Inputs!B61/100+0.025))^2+'_Calc'!E46/(1+(Inputs!B61/100+0.025))^3+'_Calc'!F46/(1+(Inputs!B61/100+0.025))^4+'_Calc'!G46/(1+(Inputs!B61/100+0.025))^5+IF((Inputs!B61/100+0.025)>(Inputs!B62/100*0.75),'_Calc'!G46*(1+Inputs!B62/100*0.75)/((Inputs!B61/100+0.025)-(Inputs!B62/100*0.75))/(1+(Inputs!B61/100+0.025))^5,0)-'_Calc'!$B$9+'_Calc'!$B$10)/'_Calc'!$B$8,0)`, FMT.currencyDec);

  // Base Case (row 15) — price = DCF Model output
  sensWs['A15'] = cell('BASE CASE');
  sensWs['B15'] = baseCell('Inputs!B63', FMT.decimal);
  sensWs['C15'] = baseCell('Inputs!B61', FMT.decimal);
  sensWs['D15'] = baseCell('Inputs!B71', FMT.decimal);
  sensWs['E15'] = baseCell("'DCF Model'!B39", FMT.currencyDec);

  // Bull Case (row 16) — references _Calc rows 60-66
  sensWs['A16'] = cell('BULL CASE');
  sensWs['B16'] = bullCell('Inputs!B63*2.00', FMT.decimal);
  sensWs['C16'] = bullCell('Inputs!B61-2.5', FMT.decimal);
  sensWs['D16'] = bullCell('Inputs!B71', FMT.decimal);
  sensWs['E16'] = formula(`IFERROR(('_Calc'!C66/(1+(Inputs!B61/100-0.025))^1+'_Calc'!D66/(1+(Inputs!B61/100-0.025))^2+'_Calc'!E66/(1+(Inputs!B61/100-0.025))^3+'_Calc'!F66/(1+(Inputs!B61/100-0.025))^4+'_Calc'!G66/(1+(Inputs!B61/100-0.025))^5+IF((Inputs!B61/100-0.025)>(Inputs!B62/100*1.25),'_Calc'!G66*(1+Inputs!B62/100*1.25)/((Inputs!B61/100-0.025)-(Inputs!B62/100*1.25))/(1+(Inputs!B61/100-0.025))^5,0)-'_Calc'!$B$9+'_Calc'!$B$10)/'_Calc'!$B$8,0)`, FMT.currencyDec);

  sensWs['A18'] = cell('Current Stock Price');
  sensWs['B18'] = formula('Inputs!B9', FMT.currencyDec);

  sensWs['!cols'] = [{ wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  sensWs['!ref'] = 'A1:F18';
  applyBoldRows(sensWs, [1, 4, 12, 13]);
  XLSX.utils.book_append_sheet(wb, sensWs, 'Sensitivity');

  // ============================================
  // SHEET 7: INSTRUCTIONS
  // ============================================
  const instructionsData = [
    ['WOLF VALUATION ENGINE - INSTRUCTIONS'],
    [''],
    ['HOW TO USE THIS MODEL'],
    [''],
    ['1. INPUTS SHEET (Start Here)'],
    ['   • All data entry happens on the Inputs sheet'],
    ['   • Change company financials, assumptions, and comparable companies'],
    ['   • All other sheets will automatically update via formulas'],
    [''],
    ['2. DCF MODEL SHEET'],
    ['   • Shows 5-year cash flow projections with year labels'],
    ['   • Terminal value calculated using Gordon Growth Model'],
    ['   • Formula: TV = FCF × (1 + g) / (WACC - g)'],
    ['   • All formulas use IFERROR to prevent calculation errors'],
    [''],
    ['3. COMPARABLES SHEET'],
    ['   • Peer company multiples are averaged'],
    ['   • Implied valuations calculated for P/E, EV/EBITDA, P/S, P/B'],
    ['   • Shows the per-share metrics used in each calculation'],
    [''],
    ['4. RATIOS SHEET'],
    ['   • Key financial ratios automatically calculated'],
    ['   • Includes: Valuation, Profitability, and Financial Health metrics'],
    [''],
    ['5. DASHBOARD SHEET'],
    ['   • Blended valuation using weighted average of all methods'],
    ['   • Adjust the weights in column C to change the blend'],
    ['   • Final recommendation: STRONG BUY / BUY / HOLD / SELL / STRONG SELL'],
    [''],
    ['NUMBER FORMATS'],
    ['   • Large numbers: 1,000,000 (with comma separators)'],
    ['   • Decimals: 1,234.56'],
    ['   • Percentages: 25.50%'],
    ['   • Currency: EGP 45.50 (or $45.50 for US markets)'],
    ['   • Multiples: 15.0x'],
    [''],
    ['KEY FORMULAS'],
    ['   • DCF Value = Sum of PV(FCF) + PV(Terminal Value)'],
    ['   • Terminal Value = FCF₅ × (1+g) / (WACC-g)'],
    ['   • Equity Value = Enterprise Value + Cash - Debt'],
    ['   • Share Price = Equity Value / Shares Outstanding'],
    [''],
    ['TIPS FOR BEST RESULTS'],
    [isEgypt ? '   • Egyptian companies: WACC typically 20–35% (high interest rate environment)' : '   • WACC should reflect company risk (typically 8–15%)'],
    [isEgypt ? '   • Terminal growth for Egypt: 5–10% (nominal GDP). Never use 2–35% US rates.' : '   • Terminal growth should not exceed GDP growth (2–3%)'],
    [isEgypt ? '   • Risk-free rate: 10-year Egyptian government bond (~20–27% as of 2025)' : '   • Use realistic growth assumptions (typically 3–15%)'],
    ['   • Add comparable companies from the same industry'],
    [''],
    [''],
    [`Generated by WOLF Valuation Engine on ${new Date().toLocaleDateString()}`],
    ['Version 3.0'],
  ];

  // ═══ B4b: Additional Calculation Sheets (ALL FORMULAS) ═══════════════════════

  // ── Altman Z-Score Sheet ── ALL VALUES AS FORMULAS
  const zScoreWs: XLSX.WorkSheet = {};

  zScoreWs['A1'] = bannerCell('WOLF VALUATION ENGINE — ALTMAN Z-SCORE ANALYSIS');
  zScoreWs['A3'] = subHeaderCell('Component');
  zScoreWs['B3'] = subHeaderCell('Formula');
  zScoreWs['C3'] = subHeaderCell('Value');
  zScoreWs['D3'] = subHeaderCell('Weighted');

  // X1: Working Capital / Total Assets (weight = 1.2)
  zScoreWs['A4'] = cell('X1: Working Capital / Total Assets');
  zScoreWs['B4'] = formula('TEXT(Inputs!B32-Inputs!B44,"#,##0")&" / "&TEXT(Inputs!B39,"#,##0")');
  zScoreWs['C4'] = formula('IFERROR((Inputs!B32-Inputs!B44)/Inputs!B39,0)', FMT.decimal);
  zScoreWs['D4'] = formula('C4*1.2', FMT.decimal);

  // X2: Retained Earnings / Total Assets (weight = 1.4)   — uses Equity as proxy
  zScoreWs['A5'] = cell('X2: Retained Earnings / Total Assets');
  zScoreWs['B5'] = formula('TEXT(Inputs!B50,"#,##0")&" / "&TEXT(Inputs!B39,"#,##0")');
  zScoreWs['C5'] = formula('IFERROR(Inputs!B50/Inputs!B39,0)', FMT.decimal);
  zScoreWs['D5'] = formula('C5*1.4', FMT.decimal);

  // X3: EBIT / Total Assets (weight = 3.3)
  zScoreWs['A6'] = cell('X3: EBIT / Total Assets');
  zScoreWs['B6'] = formula('TEXT(Inputs!B17,"#,##0")&" / "&TEXT(Inputs!B39,"#,##0")');
  zScoreWs['C6'] = formula('IFERROR(Inputs!B17/Inputs!B39,0)', FMT.decimal);
  zScoreWs['D6'] = formula('C6*3.3', FMT.decimal);

  // X4: Market Cap / Total Liabilities (weight = 0.6)
  zScoreWs['A7'] = cell('X4: Market Cap / Total Liabilities');
  zScoreWs['B7'] = formula('TEXT(Inputs!B75,"#,##0")&" / "&TEXT(Inputs!B48,"#,##0")');
  zScoreWs['C7'] = formula('IFERROR(Inputs!B75/MAX(Inputs!B48,1),0)', FMT.decimal);
  zScoreWs['D7'] = formula('C7*0.6', FMT.decimal);

  // X5: Revenue / Total Assets (weight = 1.0)
  zScoreWs['A8'] = cell('X5: Revenue / Total Assets');
  zScoreWs['B8'] = formula('TEXT(Inputs!B13,"#,##0")&" / "&TEXT(Inputs!B39,"#,##0")');
  zScoreWs['C8'] = formula('IFERROR(Inputs!B13/Inputs!B39,0)', FMT.decimal);
  zScoreWs['D8'] = formula('C8*1.0', FMT.decimal);

  // Z-Score total
  zScoreWs['A10'] = header('Z-SCORE');
  zScoreWs['D10'] = formula('SUM(D4:D8)', FMT.decimal);

  // Interpretation
  zScoreWs['A11'] = header('Interpretation');
  zScoreWs['D11'] = formula('IF(D10>2.99,"Safe Zone",IF(D10>1.81,"Grey Zone","Distress Zone"))');

  // Thresholds
  zScoreWs['A13'] = cell('Thresholds:');
  zScoreWs['A14'] = cell('   > 2.99 = Safe Zone (low bankruptcy risk)');
  zScoreWs['A15'] = cell('   1.81 - 2.99 = Grey Zone (moderate risk)');
  zScoreWs['A16'] = cell('   < 1.81 = Distress Zone (high bankruptcy risk)');

  zScoreWs['!cols'] = [{ wch: 40 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
  zScoreWs['!ref'] = 'A1:D16';
  applyBoldRows(zScoreWs, [1, 3, 10, 11, 13]);
  XLSX.utils.book_append_sheet(wb, zScoreWs, 'Z-Score');

  // ── DuPont Decomposition Sheet ── ALL VALUES AS FORMULAS
  const dupontWs: XLSX.WorkSheet = {};

  dupontWs['A1'] = bannerCell('WOLF VALUATION ENGINE — DUPONT DECOMPOSITION');

  // 3-Factor DuPont
  dupontWs['A3'] = header('3-Factor DuPont Analysis');
  dupontWs['A4'] = header('Component');
  dupontWs['B4'] = header('Formula');
  dupontWs['C4'] = header('Value');

  dupontWs['A5'] = cell('Net Profit Margin');
  dupontWs['B5'] = formula('"NI / Revenue = "&TEXT(Inputs!B22,"#,##0")&" / "&TEXT(Inputs!B13,"#,##0")');
  dupontWs['C5'] = formula('IFERROR(Inputs!B22/Inputs!B13,0)', FMT.percent);

  dupontWs['A6'] = cell('\u00D7 Asset Turnover');
  dupontWs['B6'] = formula('"Revenue / Total Assets = "&TEXT(Inputs!B13,"#,##0")&" / "&TEXT(Inputs!B39,"#,##0")');
  dupontWs['C6'] = formula('IFERROR(Inputs!B13/Inputs!B39,0)', FMT.decimal);

  dupontWs['A7'] = cell('\u00D7 Equity Multiplier');
  dupontWs['B7'] = formula('"Total Assets / Equity = "&TEXT(Inputs!B39,"#,##0")&" / "&TEXT(Inputs!B50,"#,##0")');
  dupontWs['C7'] = formula('IFERROR(Inputs!B39/MAX(Inputs!B50,1),0)', FMT.decimal);

  dupontWs['A8'] = header('= ROE');
  dupontWs['C8'] = formula('IFERROR(C5*C6*C7,0)', FMT.percent);

  // 5-Factor DuPont
  dupontWs['A10'] = header('5-Factor DuPont Analysis');
  dupontWs['A11'] = header('Component');
  dupontWs['B11'] = header('Formula');
  dupontWs['C11'] = header('Value');

  // Tax Burden = NI / EBT
  dupontWs['A12'] = cell('Tax Burden');
  dupontWs['B12'] = formula('"NI / EBT = "&TEXT(Inputs!B22,"#,##0")&" / "&TEXT(Inputs!B17-Inputs!B20,"#,##0")');
  dupontWs['C12'] = formula('IFERROR(Inputs!B22/(Inputs!B17-Inputs!B20),0)', FMT.percent);

  // Interest Burden = EBT / EBIT
  dupontWs['A13'] = cell('\u00D7 Interest Burden');
  dupontWs['B13'] = formula('"EBT / EBIT = "&TEXT(Inputs!B17-Inputs!B20,"#,##0")&" / "&TEXT(Inputs!B17,"#,##0")');
  dupontWs['C13'] = formula('IFERROR((Inputs!B17-Inputs!B20)/Inputs!B17,0)', FMT.percent);

  // Operating Margin = EBIT / Revenue
  dupontWs['A14'] = cell('\u00D7 Operating Margin');
  dupontWs['B14'] = formula('"EBIT / Revenue = "&TEXT(Inputs!B17,"#,##0")&" / "&TEXT(Inputs!B13,"#,##0")');
  dupontWs['C14'] = formula('IFERROR(Inputs!B17/Inputs!B13,0)', FMT.percent);

  // Asset Turnover (same as 3-factor)
  dupontWs['A15'] = cell('\u00D7 Asset Turnover');
  dupontWs['C15'] = formula('C6', FMT.decimal);

  // Equity Multiplier (same as 3-factor)
  dupontWs['A16'] = cell('\u00D7 Equity Multiplier');
  dupontWs['C16'] = formula('C7', FMT.decimal);

  // ROE check (5-factor)
  dupontWs['A17'] = header('= ROE');
  dupontWs['C17'] = formula('IFERROR(C12*C13*C14*C15*C16,0)', FMT.percent);

  dupontWs['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 20 }];
  dupontWs['!ref'] = 'A1:C17';
  applyBoldRows(dupontWs, [1, 3, 4, 8, 10, 11, 17]);
  XLSX.utils.book_append_sheet(wb, dupontWs, 'DuPont');

  // ── DDM Sheet ── ALL VALUES AS FORMULAS
  const ddmWs: XLSX.WorkSheet = {};

  ddmWs['A1'] = bannerCell('WOLF VALUATION ENGINE — DIVIDEND DISCOUNT MODELS');
  ddmWs['A3'] = header('Inputs');

  // DPS (calculated from dividends paid / shares)
  ddmWs['A4'] = cell('DPS (Current)');
  ddmWs['B4'] = formula('IFERROR(ABS(Inputs!B57)/Inputs!B8,0)', FMT.currencyDec);

  ddmWs['A5'] = cell('Source');
  ddmWs['B5'] = formula('"Dividends Paid ("&TEXT(ABS(Inputs!B57),"#,##0")&") \u00F7 Shares ("&TEXT(Inputs!B8,"#,##0")&")"');

  // Cost of Equity — from WACC Components block
  ddmWs['A6'] = cell('Cost of Equity (Ke)');
  ddmWs['B6'] = formula('Inputs!B86/100', FMT.percent);

  ddmWs['A7'] = cell('Terminal Growth (g)');
  ddmWs['B7'] = formula('Inputs!B62/100', FMT.percent);

  ddmWs['A8'] = cell('High Growth Rate');
  ddmWs['B8'] = formula('Inputs!B63/100', FMT.percent);

  ddmWs['A9'] = cell('High Growth Period (years)');
  ddmWs['B9'] = formula('Inputs!B65', FMT.number);

  ddmWs['A11'] = header('Model Results');

  // Gordon Growth Model: P = DPS × (1+g) / (Ke − g)
  ddmWs['A12'] = cell('Gordon Growth (GGM)');
  ddmWs['B12'] = formula('IFERROR(B4*(1+B7)/(B6-B7),"N/A")', FMT.currencyDec);

  // Two-Stage DDM: Expanded year-by-year (Excel 2019 compatible — no LET)
  ddmWs['A13'] = cell('Two-Stage DDM');
  ddmWs['B13'] = formula('IFERROR(B4*(1+B8)/(1+B6)^1+B4*(1+B8)^2/(1+B6)^2+B4*(1+B8)^3/(1+B6)^3+B4*(1+B8)^4/(1+B6)^4+B4*(1+B8)^5/(1+B6)^5+B4*(1+B8)^5*(1+B7)/(B6-B7)/(1+B6)^5,"N/A")', FMT.currencyDec);

  // H-Model: P = DPS × [(1+g_l) + H × (g_h − g_l)] / (Ke − g_l)
  ddmWs['A14'] = cell('H-Model DDM');
  ddmWs['B14'] = formula('IFERROR(B4*(B7+(B9/2)*(B8-B7))/(B6-B7),"N/A")', FMT.currencyDec);

  // DDM vs DCF spread
  ddmWs['A15'] = cell('DDM vs DCF Spread');
  ddmWs['B15'] = formula("IFERROR(B12-'DCF Model'!B39,0)", FMT.currencyDec);

  // Notes
  ddmWs['A17'] = header('Notes:');
  ddmWs['A18'] = cell('   \u2022 Gordon Growth assumes constant dividend growth forever');
  ddmWs['A19'] = cell('   \u2022 Two-Stage: high growth for projection period, then terminal rate');
  ddmWs['A20'] = cell('   \u2022 H-Model: growth declines linearly from high to terminal over N years');
  ddmWs['A21'] = cell('   \u2022 DDM discounts at Ke (NOT WACC) \u2014 equity cash flows');

  ddmWs['!cols'] = [{ wch: 30 }, { wch: 24 }, { wch: 40 }];
  ddmWs['!ref'] = 'A1:C21';
  applyBoldRows(ddmWs, [1, 3, 11, 17]);
  XLSX.utils.book_append_sheet(wb, ddmWs, 'DDM');

  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsWs['!cols'] = [{ wch: 75 }];
  applyBoldRows(instructionsWs, [1, 3, 5, 10, 16, 21, 25, 30, 37, 43]);
  XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions');

  // Generate and download
  const fileName = `WOLF_${financialData.ticker}_Valuation_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
