import * as XLSX from 'xlsx';
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

// Apply bold styling to cells in a worksheet
const applyBoldRows = (ws: XLSX.WorkSheet, rows: number[]): void => {
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (const row of rows) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r: row - 1, c });
      if (ws[addr]) {
        if (!ws[addr].s) ws[addr].s = {};
        ws[addr].s = { ...ws[addr].s, font: { bold: true } };
      }
    }
  }
};

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

  // Title
  inputsWs['A1'] = header('WOLF VALUATION ENGINE - INPUT DATA');
  inputsWs['A2'] = cell('Edit values here. All other sheets will update automatically.');

  // Company Info
  inputsWs['A4'] = header('COMPANY INFORMATION');
  inputsWs['A5'] = header('Item');
  inputsWs['B5'] = header('Value');
  inputsWs['A6'] = cell('Company Name');
  inputsWs['B6'] = cell(financialData.companyName);
  inputsWs['A7'] = cell('Ticker Symbol');
  inputsWs['B7'] = cell(financialData.ticker);
  inputsWs['A8'] = cell('Shares Outstanding');
  inputsWs['B8'] = cell(financialData.sharesOutstanding, FMT.number);
  inputsWs['A9'] = cell('Current Stock Price');
  inputsWs['B9'] = cell(financialData.currentStockPrice, FMT.currencyDec);

  // Income Statement
  inputsWs['A11'] = header('INCOME STATEMENT');
  inputsWs['A12'] = header('Item');
  inputsWs['B12'] = header(`Amount (${currencyLabel})`);
  inputsWs['A13'] = cell('Revenue');
  inputsWs['B13'] = cell(financialData.incomeStatement.revenue, FMT.number);
  inputsWs['A14'] = cell('Cost of Goods Sold');
  inputsWs['B14'] = cell(financialData.incomeStatement.costOfGoodsSold, FMT.number);
  inputsWs['A15'] = cell('Gross Profit');
  inputsWs['B15'] = cell(financialData.incomeStatement.grossProfit, FMT.number);
  inputsWs['A16'] = cell('Operating Expenses');
  inputsWs['B16'] = cell(financialData.incomeStatement.operatingExpenses, FMT.number);
  inputsWs['A17'] = cell('Operating Income (EBIT)');
  inputsWs['B17'] = cell(financialData.incomeStatement.operatingIncome, FMT.number);
  inputsWs['A18'] = cell('Depreciation');
  inputsWs['B18'] = cell(financialData.incomeStatement.depreciation, FMT.number);
  inputsWs['A19'] = cell('Amortization');
  inputsWs['B19'] = cell(financialData.incomeStatement.amortization, FMT.number);
  inputsWs['A20'] = cell('Interest Expense');
  inputsWs['B20'] = cell(financialData.incomeStatement.interestExpense, FMT.number);
  inputsWs['A21'] = cell('Tax Expense');
  inputsWs['B21'] = cell(financialData.incomeStatement.taxExpense, FMT.number);
  inputsWs['A22'] = cell('Net Income');
  inputsWs['B22'] = cell(financialData.incomeStatement.netIncome, FMT.number);

  // Balance Sheet - COMPLETE with all line items
  inputsWs['A24'] = header('BALANCE SHEET');
  inputsWs['A25'] = header('Item');
  inputsWs['B25'] = header(`Amount (${currencyLabel})`);

  // Current Assets
  inputsWs['A26'] = header('CURRENT ASSETS');
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
  inputsWs['B32'] = cell(financialData.balanceSheet.totalCurrentAssets, FMT.number);

  // Non-Current Assets
  inputsWs['A33'] = header('NON-CURRENT ASSETS');
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
  inputsWs['B39'] = cell(financialData.balanceSheet.totalAssets, FMT.number);

  // Current Liabilities
  inputsWs['A40'] = header('CURRENT LIABILITIES');
  inputsWs['A41'] = cell('Accounts Payable');
  inputsWs['B41'] = cell(financialData.balanceSheet.accountsPayable, FMT.number);
  inputsWs['A42'] = cell('Short-term Debt');
  inputsWs['B42'] = cell(financialData.balanceSheet.shortTermDebt, FMT.number);
  inputsWs['A43'] = cell('Other Current Liabilities');
  inputsWs['B43'] = cell(financialData.balanceSheet.otherCurrentLiabilities, FMT.number);
  inputsWs['A44'] = cell('Total Current Liabilities');
  inputsWs['B44'] = cell(financialData.balanceSheet.totalCurrentLiabilities, FMT.number);

  // Non-Current Liabilities
  inputsWs['A45'] = header('NON-CURRENT LIABILITIES');
  inputsWs['A46'] = cell('Long-term Debt');
  inputsWs['B46'] = cell(financialData.balanceSheet.longTermDebt, FMT.number);
  inputsWs['A47'] = cell('Other Non-Current Liabilities');
  inputsWs['B47'] = cell(financialData.balanceSheet.otherNonCurrentLiabilities, FMT.number);
  inputsWs['A48'] = cell('Total Liabilities');
  inputsWs['B48'] = cell(financialData.balanceSheet.totalLiabilities, FMT.number);

  // Equity
  inputsWs['A49'] = header('EQUITY');
  inputsWs['A50'] = cell('Total Shareholders Equity');
  inputsWs['B50'] = cell(financialData.balanceSheet.totalEquity, FMT.number);

  // Cash Flow - shifted down to row 52
  inputsWs['A52'] = header('CASH FLOW STATEMENT');
  inputsWs['A53'] = header('Item');
  inputsWs['B53'] = header(`Amount (${currencyLabel})`);
  inputsWs['A54'] = cell('Operating Cash Flow');
  inputsWs['B54'] = cell(financialData.cashFlowStatement.operatingCashFlow, FMT.number);
  inputsWs['A55'] = cell('Capital Expenditures');
  inputsWs['B55'] = cell(financialData.cashFlowStatement.capitalExpenditures, FMT.number);
  inputsWs['A56'] = cell('Free Cash Flow');
  inputsWs['B56'] = cell(financialData.cashFlowStatement.freeCashFlow, FMT.number);
  inputsWs['A57'] = cell('Dividends Paid');
  inputsWs['B57'] = cell(financialData.cashFlowStatement.dividendsPaid, FMT.number);

  // Assumptions - shifted down to row 59
  inputsWs['A59'] = header('VALUATION ASSUMPTIONS');
  inputsWs['A60'] = header('Assumption');
  inputsWs['B60'] = header('Value');
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
  inputsWs['A67'] = header('FCFF DRIVER ASSUMPTIONS');
  inputsWs['A68'] = header('Item');
  inputsWs['B68'] = header('Value');
  inputsWs['A69'] = cell('EBITDA');
  inputsWs['B69'] = cell(ebitda, FMT.number);
  inputsWs['A70'] = cell('Total Debt');
  inputsWs['B70'] = cell(totalDebt, FMT.number);
  inputsWs['A71'] = cell('EBITDA Margin %');
  inputsWs['B71'] = cell(assumptions.ebitdaMargin, FMT.decimal);
  inputsWs['A72'] = cell('D&A (% of Revenue)');
  inputsWs['B72'] = cell(assumptions.daPercent, FMT.decimal);
  inputsWs['A73'] = cell('CapEx (% of Revenue)');
  inputsWs['B73'] = cell(assumptions.capexPercent, FMT.decimal);
  inputsWs['A74'] = cell('ΔWC (% of ΔRevenue)');
  inputsWs['B74'] = cell(assumptions.deltaWCPercent, FMT.decimal);
  inputsWs['A75'] = cell('Market Cap');
  inputsWs['B75'] = cell(marketCap, FMT.number);
  inputsWs['A76'] = cell('Enterprise Value');
  inputsWs['B76'] = cell(enterpriseValue, FMT.number);

  // Comparable Companies - shifted down to row 78
  inputsWs['A78'] = header('COMPARABLE COMPANIES');
  inputsWs['A79'] = header('Company');
  inputsWs['B79'] = header('P/E');
  inputsWs['C79'] = header('EV/EBITDA');
  inputsWs['D79'] = header('P/S');
  inputsWs['E79'] = header('P/B');

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

  const lastInputRow = 80 + Math.max(comparables.length, 1);
  inputsWs['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  inputsWs['!ref'] = `A1:E${lastInputRow}`;
  applyBoldRows(inputsWs, [1, 4, 5, 11, 12, 24, 25, 26, 33, 40, 45, 49, 52, 53, 59, 60, 67, 68, 75, 76]);
  XLSX.utils.book_append_sheet(wb, inputsWs, 'Inputs');

  // ============================================
  // SHEET 2: DCF MODEL — FULL FCFF BUILDUP (Fix C1)
  // ============================================
  const dcfWs: XLSX.WorkSheet = {};

  dcfWs['A1'] = header('DCF VALUATION MODEL \u2014 FCFF Buildup');
  dcfWs['A2'] = cell(`All values in ${currencyLabel}`);

  dcfWs['A4'] = header('KEY ASSUMPTIONS');
  dcfWs['A5'] = header('Item'); dcfWs['B5'] = header('Value');
  dcfWs['A6'] = cell('Base Revenue'); dcfWs['B6'] = formula('Inputs!B13', FMT.number);
  dcfWs['A7'] = cell('Revenue Growth Rate'); dcfWs['B7'] = formula('Inputs!B63/100', FMT.percent);
  dcfWs['A8'] = cell('EBITDA Margin'); dcfWs['B8'] = formula('Inputs!B71/100', FMT.percent);
  dcfWs['A9'] = cell('D&A (% of Revenue)'); dcfWs['B9'] = formula('Inputs!B72/100', FMT.percent);
  dcfWs['A10'] = cell('Tax Rate'); dcfWs['B10'] = formula('Inputs!B64/100', FMT.percent);
  dcfWs['A11'] = cell('CapEx (% of Revenue)'); dcfWs['B11'] = formula('Inputs!B73/100', FMT.percent);
  dcfWs['A12'] = cell('\u0394WC (% of \u0394Revenue)'); dcfWs['B12'] = formula('Inputs!B74/100', FMT.percent);
  dcfWs['A13'] = cell('WACC'); dcfWs['B13'] = formula('Inputs!B61/100', FMT.percent);
  dcfWs['A14'] = cell('Terminal Growth'); dcfWs['B14'] = formula('Inputs!B62/100', FMT.percent);

  dcfWs['A16'] = header('FCFF PROJECTIONS');
  const cols = ['B', 'C', 'D', 'E', 'F', 'G'];
  dcfWs['B17'] = header(`${currentYear} (Actual)`);
  for (let i = 1; i <= 5; i++) dcfWs[`${cols[i]}17`] = header(`${currentYear + i} (Proj)`);

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
  dcfWs['B26'] = cell(1, FMT.decimal);
  for (let i = 1; i <= 5; i++) dcfWs[`${cols[i]}26`] = formula(`1/POWER(1+$B$13,${i})`, FMT.decimal);

  // Row 27: PV of FCFF
  dcfWs['A27'] = cell('PV of FCFF');
  dcfWs['B27'] = cell('', FMT.number);
  for (let i = 1; i <= 5; i++) dcfWs[`${cols[i]}27`] = formula(`${cols[i]}25*${cols[i]}26`, FMT.number);

  // Valuation Summary
  dcfWs['A29'] = header('VALUATION SUMMARY');
  dcfWs['A30'] = header('Item'); dcfWs['B30'] = header('Value');
  dcfWs['A31'] = cell('Sum PV(FCFF)'); dcfWs['B31'] = formula('SUM(C27:G27)', FMT.number);
  dcfWs['A32'] = cell('Terminal Value'); dcfWs['B32'] = formula('IFERROR(G25*(1+$B$14)/($B$13-$B$14),0)', FMT.number);
  dcfWs['A33'] = cell('PV(Terminal Value)'); dcfWs['B33'] = formula('IFERROR(B32*G26,0)', FMT.number);
  dcfWs['A34'] = cell('Enterprise Value'); dcfWs['B34'] = formula('B31+B33', FMT.number);
  dcfWs['A35'] = cell('Plus: Cash'); dcfWs['B35'] = formula('Inputs!B27', FMT.number);
  dcfWs['A36'] = cell('Less: Total Debt'); dcfWs['B36'] = formula('Inputs!B70', FMT.number);
  dcfWs['A37'] = cell('Equity Value'); dcfWs['B37'] = formula('MAX(B34+B35-B36,0)', FMT.number);
  dcfWs['A38'] = cell('Shares Outstanding'); dcfWs['B38'] = formula('Inputs!B8', FMT.number);
  dcfWs['A39'] = header('DCF Per Share'); dcfWs['B39'] = formula('IFERROR(B37/B38,0)', FMT.currencyDec);
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

  compWs['A1'] = header('COMPARABLE COMPANY ANALYSIS');
  compWs['A2'] = cell('Multiple-based valuation');

  // Comparables table header
  compWs['A4'] = header('PEER COMPANY MULTIPLES');
  compWs['A5'] = header('Company');
  compWs['B5'] = header('P/E');
  compWs['C5'] = header('EV/EBITDA');
  compWs['D5'] = header('P/S');
  compWs['E5'] = header('P/B');

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

  // Summary
  // C2 Fix: Weighted average (40% P/E, 35% EV/EBITDA, 15% P/S, 10% P/B)
  const summaryRow = impliedRow + 8;
  compWs[`A${summaryRow}`] = header('SUMMARY');
  compWs[`A${summaryRow + 1}`] = header('Weighted Avg (40% P/E \u00B7 35% EV/EBITDA \u00B7 15% P/S \u00B7 10% P/B)');
  compWs[`B${summaryRow + 1}`] = formula(`IFERROR(0.40*B${impliedRow + 2}+0.35*B${impliedRow + 3}+0.15*B${impliedRow + 4}+0.10*B${impliedRow + 5},0)`, FMT.currencyDec);

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
  applyBoldRows(compWs, [1, 4, 5, avgRow, impliedRow, impliedRow + 1, summaryRow, summaryRow + 1, summaryRow + 3]);
  XLSX.utils.book_append_sheet(wb, compWs, 'Comparables');

  // ============================================
  // SHEET 4: FINANCIAL RATIOS
  // ============================================
  const ratiosWs: XLSX.WorkSheet = {};

  ratiosWs['A1'] = header('KEY FINANCIAL RATIOS & METRICS');

  // Market Data
  ratiosWs['A3'] = header('MARKET DATA');
  ratiosWs['A4'] = header('Metric');
  ratiosWs['B4'] = header('Value');
  ratiosWs['A5'] = cell('Market Capitalization');
  ratiosWs['B5'] = formula('Inputs!B8*Inputs!B9', FMT.number);
  ratiosWs['A6'] = cell('Enterprise Value');
  ratiosWs['B6'] = formula('B5+Inputs!B70-Inputs!B27', FMT.number);
  ratiosWs['A7'] = cell('Net Debt');
  ratiosWs['B7'] = formula('Inputs!B70-Inputs!B27', FMT.number);

  // Valuation Ratios
  ratiosWs['A9'] = header('VALUATION RATIOS');
  ratiosWs['A10'] = header('Ratio');
  ratiosWs['B10'] = header('Value');
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
  ratiosWs['A18'] = header('PROFITABILITY RATIOS');
  ratiosWs['A19'] = header('Ratio');
  ratiosWs['B19'] = header('Value');
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
  ratiosWs['A29'] = header('FINANCIAL HEALTH');
  ratiosWs['A30'] = header('Ratio');
  ratiosWs['B30'] = header('Value');
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

  dashWs['A1'] = header('WOLF VALUATION DASHBOARD');
  dashWs['A2'] = formula('Inputs!B6&" ("&Inputs!B7&")"');
  dashWs['A3'] = cell(`Analysis Date: ${new Date().toLocaleDateString()}`);

  // Valuation Methods Summary
  dashWs['A5'] = header('BLENDED VALUATION ANALYSIS');
  dashWs['A6'] = header('Method');
  dashWs['B6'] = header('Implied Price');
  dashWs['C6'] = header('Weight');
  dashWs['D6'] = header('Weighted Value');

  dashWs['A7'] = cell('DCF Valuation');
  dashWs['B7'] = formula("'DCF Model'!B39", FMT.currencyDec);
  dashWs['C7'] = cell(0.6, FMT.percent);
  dashWs['D7'] = formula('B7*C7', FMT.currencyDec);

  dashWs['A8'] = cell('Comps Weighted Avg');
  dashWs['B8'] = formula(`'Comparables'!B${impliedRowRef + 9}`, FMT.currencyDec);
  dashWs['C8'] = cell(0.4, FMT.percent);
  dashWs['D8'] = formula('B8*C8', FMT.currencyDec);

  dashWs['A10'] = header('FINAL VALUATION');
  dashWs['A11'] = header('Item');
  dashWs['B11'] = header('Value');
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
  dashWs['A22'] = header('KEY METRICS SNAPSHOT');
  dashWs['A23'] = header('Metric'); dashWs['B23'] = header('Value');
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
  // SHEET 6: SENSITIVITY ANALYSIS
  // ============================================
  const sensWs: XLSX.WorkSheet = {};

  // FCFF buildup helper
  const calcFCFFPrice = (waccPct: number, gPct: number, revGrowthPct: number, ebitdaMargPct: number) => {
    const rev0 = financialData.incomeStatement.revenue;
    const eMarg = ebitdaMargPct / 100;
    const daPct = assumptions.daPercent / 100;
    const capPct = assumptions.capexPercent / 100;
    const dwcPct = assumptions.deltaWCPercent / 100;
    const tR = assumptions.taxRate / 100;
    const w = waccPct / 100;
    const g = gPct / 100;
    let rev = rev0; let prevRev = rev0; let pvSum = 0; let lastFCFF = 0;
    for (let yr = 1; yr <= assumptions.projectionYears; yr++) {
      prevRev = rev;
      rev *= (1 + revGrowthPct / 100);
      const ebitda_ = rev * eMarg;
      const da = rev * daPct;
      const ebit = ebitda_ - da;
      const nopat = ebit * (1 - tR);
      const capex = rev * capPct;
      const dwc = (rev - prevRev) * dwcPct;
      const fcff = nopat + da - capex - dwc;
      pvSum += fcff / Math.pow(1 + w, yr);
      lastFCFF = fcff;
    }
    let tv = 0;
    if (w > g) tv = (lastFCFF * (1 + g)) / (w - g);
    else tv = lastFCFF * 12;
    const pvTV = tv / Math.pow(1 + w, assumptions.projectionYears);
    const ev_ = pvSum + pvTV;
    const equity_ = ev_ - totalDebt + financialData.balanceSheet.cash;
    return Math.round(Math.max(equity_ / financialData.sharesOutstanding, 0) * 100) / 100;
  };

  // Pre-compute base-case FCFFs once (matching PDF approach — only vary WACC and TG, not FCFFs)
  const baseFCFFs: number[] = [];
  {
    const eMarg = assumptions.ebitdaMargin / 100;
    const daPct = assumptions.daPercent / 100;
    const capPct = assumptions.capexPercent / 100;
    const dwcPct = assumptions.deltaWCPercent / 100;
    const tR = assumptions.taxRate / 100;
    let rev = financialData.incomeStatement.revenue;
    for (let yr = 1; yr <= assumptions.projectionYears; yr++) {
      const prevRev = rev;
      rev *= (1 + assumptions.revenueGrowthRate / 100);
      const ebitda_ = rev * eMarg;
      const da = rev * daPct;
      const ebit = ebitda_ - da;
      const nopat = ebit * (1 - tR);
      const capex = rev * capPct;
      const dwc = (rev - prevRev) * dwcPct;
      baseFCFFs.push(nopat + da - capex - dwc);
    }
  }

  // Sensitivity grid: only vary WACC and terminal growth (FCFFs stay constant)
  const calcSensPrice = (waccPct: number, gPct: number) => {
    const w = waccPct / 100;
    const g = gPct / 100;
    if (w <= g) return 0;
    let pvSum = 0;
    for (let yr = 0; yr < baseFCFFs.length; yr++) {
      pvSum += baseFCFFs[yr] / Math.pow(1 + w, yr + 1);
    }
    const lastFCFF = baseFCFFs[baseFCFFs.length - 1];
    const tv = (lastFCFF * (1 + g)) / (w - g);
    const pvTV = tv / Math.pow(1 + w, baseFCFFs.length);
    const ev = pvSum + pvTV;
    const equity = ev - totalDebt + financialData.balanceSheet.cash;
    return Math.round(Math.max(equity / financialData.sharesOutstanding, 0) * 100) / 100;
  };

  sensWs['A1'] = header('SENSITIVITY ANALYSIS');
  sensWs['A2'] = cell('DCF per share at different WACC / terminal growth combinations');

  // C5/C6: Dynamic axes centered on actual WACC and terminal growth
  const baseWACC = assumptions.discountRate;
  const baseGrowth = assumptions.terminalGrowthRate;
  const waccAxis = [-4, -2, 0, 2, 4].map(d => baseWACC + d);
  const growthAxis = [-3, -1.5, 0, 1.5, 3].map(d => {
    const val = baseGrowth + d;
    return Math.max(isEgypt ? 4 : 1.5, Math.min(baseWACC - 1, val));
  });

  sensWs['A4'] = header('WACC \\\\ Growth');
  growthAxis.forEach((g, gi) => {
    sensWs[`${String.fromCharCode(66 + gi)}4`] = header(`${g.toFixed(1)}%`);
  });

  waccAxis.forEach((wacc, wi) => {
    const row = 5 + wi;
    sensWs[`A${row}`] = cell(`${wacc.toFixed(1)}%`, undefined, wi === 2);
    growthAxis.forEach((g, gi) => {
      const col = String.fromCharCode(66 + gi);
      const price = calcSensPrice(wacc, g);
      sensWs[`${col}${row}`] = cell(price, FMT.currencyDec, wi === 2 && gi === 2);
    });
  });

  // Scenario Analysis
  sensWs['A12'] = header('SCENARIO ANALYSIS');
  sensWs['A13'] = header('Scenario'); sensWs['B13'] = header('Rev Growth %');
  sensWs['C13'] = header('WACC %'); sensWs['D13'] = header('EBITDA Margin %');
  sensWs['E13'] = header(`Price (${currencyLabel})`);

  // C1 Fix: Use shared SCENARIO_PARAMS for consistency
  const SP = SCENARIO_PARAMS;

  // Shared scenario calc with per-year margin adjustment
  const calcScenarioFCFF = (scenario: 'bear' | 'base' | 'bull') => {
    const p = SP[scenario];
    const revG = assumptions.revenueGrowthRate * p.revenueGrowthMultiplier;
    const w = Math.max(2, assumptions.discountRate + p.waccAdjustmentPP);
    const tg = Math.min(assumptions.terminalGrowthRate * p.terminalGrowthMultiplier, w - 1);
    let rev = financialData.incomeStatement.revenue;
    let sumPV = 0, lastFCF = 0;
    const taxR = assumptions.taxRate / 100;
    const wDec = w / 100;
    for (let yr = 1; yr <= assumptions.projectionYears; yr++) {
      const prevRev = rev;
      rev *= (1 + revG / 100);
      const adjMargin = assumptions.ebitdaMargin + (p.marginAdjPerYear * 100 * yr);
      const ebitda = rev * (adjMargin / 100);
      const da = rev * (assumptions.daPercent / 100);
      const nopat = (ebitda - da) * (1 - taxR);
      const capex = rev * (assumptions.capexPercent / 100);
      const dwc = (rev - prevRev) * (assumptions.deltaWCPercent / 100);
      const fcf = nopat + da - capex - dwc;
      // Bug #5: Respect mid-year discounting convention (match engine scenarios.ts)
      const period = assumptions.discountingConvention === 'mid_year' ? yr - 0.5 : yr;
      sumPV += fcf / Math.pow(1 + wDec, period);
      lastFCF = fcf;
    }
    const tgDec = tg / 100;
    const tv = wDec > tgDec ? (lastFCF * (1 + tgDec)) / (wDec - tgDec) : lastFCF * 12;
    const ev = sumPV + tv / Math.pow(1 + wDec, assumptions.projectionYears);
    const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
    const equity = ev - totalDebt + financialData.balanceSheet.cash;
    return { price: equity / financialData.sharesOutstanding, revG, w, tg };
  };

  // Bear
  const bearResult = calcScenarioFCFF('bear');
  sensWs['A14'] = cell('BEAR CASE');
  sensWs['B14'] = cell(bearResult.revG, FMT.decimal); sensWs['C14'] = cell(bearResult.w, FMT.decimal);
  sensWs['D14'] = cell(assumptions.ebitdaMargin, FMT.decimal);
  sensWs['E14'] = cell(bearResult.price, FMT.currencyDec);

  // Base
  const baseResult = calcScenarioFCFF('base');
  sensWs['A15'] = cell('BASE CASE');
  sensWs['B15'] = cell(assumptions.revenueGrowthRate, FMT.decimal);
  sensWs['C15'] = cell(assumptions.discountRate, FMT.decimal);
  sensWs['D15'] = cell(assumptions.ebitdaMargin, FMT.decimal);
  sensWs['E15'] = cell(baseResult.price, FMT.currencyDec);

  // Bull
  const bullResult = calcScenarioFCFF('bull');
  sensWs['A16'] = cell('BULL CASE');
  sensWs['B16'] = cell(bullResult.revG, FMT.decimal); sensWs['C16'] = cell(bullResult.w, FMT.decimal);
  sensWs['D16'] = cell(assumptions.ebitdaMargin, FMT.decimal);
  sensWs['E16'] = cell(bullResult.price, FMT.currencyDec);

  sensWs['A18'] = cell('Current Stock Price');
  sensWs['B18'] = formula('Inputs!B9', FMT.currencyDec);

  // Bug #5 fix: Narrow column widths so all 5 growth columns fit on one page
  sensWs['!cols'] = [{ wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
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

  // ═══ B4b: Additional Calculation Sheets ═══════════════════════
  const IS = financialData.incomeStatement;
  const BS = financialData.balanceSheet;
  const fn = (v: number) => v.toLocaleString(); // number formatter for sheets
  const ebtVal = IS.operatingIncome - IS.interestExpense; // EBT = EBIT - Interest

  // ── Altman Z-Score Sheet ──
  const workingCapital = BS.totalCurrentAssets - BS.totalCurrentLiabilities;
  // BUG2 fix: Use actual retainedEarnings when available, otherwise totalEquity as proxy (matches PDF)
  const retainedEarnings = BS.retainedEarnings || BS.totalEquity;
  const marketEquity = financialData.currentStockPrice * financialData.sharesOutstanding;
  // BUG1 fix: X4 uses Total Liabilities per Altman's original formula (not just Total Debt)
  const totalLiab = BS.totalLiabilities || (BS.shortTermDebt + BS.longTermDebt);
  const zA = 1.2 * (workingCapital / BS.totalAssets);
  const zB = 1.4 * (retainedEarnings / BS.totalAssets);
  const zC = 3.3 * (IS.operatingIncome / BS.totalAssets);
  const zD = 0.6 * (marketEquity / totalLiab);
  const zE = 1.0 * (IS.revenue / BS.totalAssets);
  const zScore = zA + zB + zC + zD + zE;
  const zZone = zScore > 2.99 ? 'Safe Zone' : zScore > 1.81 ? 'Grey Zone' : 'Distress Zone';

  const zScoreData = [
    ['ALTMAN Z-SCORE ANALYSIS'],
    [''],
    ['Component', 'Formula', 'Value', 'Weighted'],
    ['X1: Working Capital / Total Assets', `${fn(workingCapital)} / ${fn(BS.totalAssets)}`, (workingCapital / BS.totalAssets).toFixed(4), zA.toFixed(4)],
    ['X2: Retained Earnings / Total Assets', `${fn(retainedEarnings)} / ${fn(BS.totalAssets)}`, (retainedEarnings / BS.totalAssets).toFixed(4), zB.toFixed(4)],
    ['X3: EBIT / Total Assets', `${fn(IS.operatingIncome)} / ${fn(BS.totalAssets)}`, (IS.operatingIncome / BS.totalAssets).toFixed(4), zC.toFixed(4)],
    ['X4: Market Equity / Total Liabilities', `${fn(marketEquity)} / ${fn(totalLiab)}`, (marketEquity / totalLiab).toFixed(4), zD.toFixed(4)],
    ['X5: Revenue / Total Assets', `${fn(IS.revenue)} / ${fn(BS.totalAssets)}`, (IS.revenue / BS.totalAssets).toFixed(4), zE.toFixed(4)],
    [''],
    ['Z-SCORE', '', '', zScore.toFixed(2)],
    ['Interpretation', '', '', zZone],
    [''],
    ['Thresholds:'],
    ['   > 2.99 = Safe Zone (low bankruptcy risk)'],
    ['   1.81 - 2.99 = Grey Zone (moderate risk)'],
    ['   < 1.81 = Distress Zone (high bankruptcy risk)'],
  ];
  const zScoreWs = XLSX.utils.aoa_to_sheet(zScoreData);
  zScoreWs['!cols'] = [{ wch: 40 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];
  applyBoldRows(zScoreWs, [1, 3, 10, 11]);
  XLSX.utils.book_append_sheet(wb, zScoreWs, 'Z-Score');

  // ── DuPont Decomposition Sheet ──
  const netMarginPct = IS.revenue > 0 ? IS.netIncome / IS.revenue : 0;
  const assetTurnover = BS.totalAssets > 0 ? IS.revenue / BS.totalAssets : 0;
  const equityMultiplier = BS.totalEquity > 0 ? BS.totalAssets / BS.totalEquity : 0;
  const roe3Factor = netMarginPct * assetTurnover * equityMultiplier;
  // 5-factor
  const taxBurden = ebtVal > 0 ? IS.netIncome / ebtVal : 0;
  const interestBurden = IS.operatingIncome > 0 ? ebtVal / IS.operatingIncome : 0;
  const opMarginPct = IS.revenue > 0 ? IS.operatingIncome / IS.revenue : 0;

  const dupontData = [
    ['DUPONT DECOMPOSITION'],
    [''],
    ['3-Factor DuPont Analysis'],
    ['Component', 'Formula', 'Value'],
    ['Net Profit Margin', `NI / Revenue = ${fn(IS.netIncome)} / ${fn(IS.revenue)}`, (netMarginPct * 100).toFixed(2) + '%'],
    ['× Asset Turnover', `Revenue / Total Assets = ${fn(IS.revenue)} / ${fn(BS.totalAssets)}`, assetTurnover.toFixed(4) + 'x'],
    ['× Equity Multiplier', `Total Assets / Equity = ${fn(BS.totalAssets)} / ${fn(BS.totalEquity)}`, equityMultiplier.toFixed(4) + 'x'],
    ['= ROE', '', (roe3Factor * 100).toFixed(2) + '%'],
    [''],
    ['5-Factor DuPont Analysis'],
    ['Component', 'Formula', 'Value'],
    ['Tax Burden', `NI / EBT = ${fn(IS.netIncome)} / ${fn(ebtVal)}`, (taxBurden * 100).toFixed(2) + '%'],
    ['× Interest Burden', `EBT / EBIT = ${fn(ebtVal)} / ${fn(IS.operatingIncome)}`, (interestBurden * 100).toFixed(2) + '%'],
    ['× Operating Margin', `EBIT / Revenue = ${fn(IS.operatingIncome)} / ${fn(IS.revenue)}`, (opMarginPct * 100).toFixed(2) + '%'],
    ['× Asset Turnover', '', assetTurnover.toFixed(4) + 'x'],
    ['× Equity Multiplier', '', equityMultiplier.toFixed(4) + 'x'],
    ['= ROE', '', (taxBurden * interestBurden * opMarginPct * assetTurnover * equityMultiplier * 100).toFixed(2) + '%'],
  ];
  const dupontWs = XLSX.utils.aoa_to_sheet(dupontData);
  dupontWs['!cols'] = [{ wch: 25 }, { wch: 45 }, { wch: 20 }];
  applyBoldRows(dupontWs, [1, 3, 4, 8, 10, 11, 17]);
  XLSX.utils.book_append_sheet(wb, dupontWs, 'DuPont');

  // ── DDM Sheet ──
  // BUG3 fix: Calculate DPS from dividendsPaid/shares (matching PDF and engine logic)
  const dividendsPaidAbs = Math.abs(financialData.cashFlowStatement.dividendsPaid || 0);
  const dps = dividendsPaidAbs > 0
    ? dividendsPaidAbs / financialData.sharesOutstanding
    : (financialData.dividendsPerShare || 0);
  const ke = (assumptions.riskFreeRate + assumptions.beta * assumptions.marketRiskPremium) / 100;
  const gTerminal = assumptions.terminalGrowthRate / 100;
  const gHigh = assumptions.revenueGrowthRate / 100;
  const nDDM = assumptions.projectionYears;
  const gordonDDM = ke > gTerminal && dps > 0 ? (dps * (1 + gTerminal)) / (ke - gTerminal) : 0;
  // Two-Stage DDM
  let twoStageDDM = 0;
  for (let t = 1; t <= nDDM; t++) {
    twoStageDDM += (dps * Math.pow(1 + gHigh, t)) / Math.pow(1 + ke, t);
  }
  if (ke > gTerminal) {
    const termDPS = dps * Math.pow(1 + gHigh, nDDM) * (1 + gTerminal);
    twoStageDDM += (termDPS / (ke - gTerminal)) / Math.pow(1 + ke, nDDM);
  }
  // H-Model
  const hModelDDM = dps > 0 && ke > gTerminal
    ? (dps * ((1 + gTerminal) + (nDDM / 2) * (gHigh - gTerminal))) / (ke - gTerminal)
    : 0;

  const ddmData = [
    ['DIVIDEND DISCOUNT MODELS (DDM)'],
    [''],
    ['Inputs'],
    ['Dividends Per Share (DPS)', `${currencyLabel} ${dps.toFixed(2)}`],
    ['  Source', dividendsPaidAbs > 0 ? `Dividends Paid (${fn(dividendsPaidAbs)}) ÷ Shares (${fn(financialData.sharesOutstanding)})` : 'Direct input'],
    ['Cost of Equity (Ke)', (ke * 100).toFixed(2) + '%'],
    ['Terminal Growth (g)', (gTerminal * 100).toFixed(2) + '%'],
    ['High Growth Rate', (gHigh * 100).toFixed(2) + '%'],
    ['High Growth Period', nDDM + ' years'],
    [''],
    ['Model', 'Fair Value', 'Notes'],
    ['Gordon Growth (GGM)', `${currencyLabel} ${gordonDDM.toFixed(2)}`, 'Single-stage constant growth'],
    ['Two-Stage DDM', `${currencyLabel} ${twoStageDDM.toFixed(2)}`, `${nDDM}yr high growth → terminal`],
    ['H-Model DDM', `${currencyLabel} ${hModelDDM.toFixed(2)}`, 'Linear growth decline to terminal'],
    [''],
    ['Notes:'],
    ['   • Gordon Growth assumes constant dividend growth forever'],
    ['   • Two-Stage: high growth for projection period, then terminal rate'],
    ['   • H-Model: growth declines linearly from high to terminal over N years'],
    ...(dps === 0 ? [['   ⚠️ No dividends declared — DDM values will be 0']] : []),
  ];
  const ddmWs = XLSX.utils.aoa_to_sheet(ddmData);
  ddmWs['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 40 }];
  applyBoldRows(ddmWs, [1, 3, 10]);
  XLSX.utils.book_append_sheet(wb, ddmWs, 'DDM');

  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsWs['!cols'] = [{ wch: 75 }];
  applyBoldRows(instructionsWs, [1, 3, 5, 10, 16, 21, 25, 30, 37, 43]);
  XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions');

  // Generate and download
  const fileName = `WOLF_${financialData.ticker}_Valuation_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
