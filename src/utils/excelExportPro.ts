import * as XLSX from 'xlsx';
import { FinancialData, ValuationAssumptions, ComparableCompany } from '../types/financial';
import { calculateEBITDA } from './valuation';

// Excel number formats
const FMT = {
  number: '#,##0',
  decimal: '#,##0.00',
  percent: '0.00%',
  currency: '"$"#,##0',
  currencyDec: '"$"#,##0.00',
  multiple: '0.0"x"',
};

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
  assumptions: ValuationAssumptions,
  comparables: ComparableCompany[]
): void => {
  const wb = XLSX.utils.book_new();
  
  // Pre-calculate values for reference
  const ebitda = calculateEBITDA(financialData);
  const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const fcfMargin = (financialData.cashFlowStatement.freeCashFlow / financialData.incomeStatement.revenue) * 100;
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
  inputsWs['B12'] = header('Amount ($)');
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
  inputsWs['B25'] = header('Amount ($)');
  
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
  inputsWs['B53'] = header('Amount ($)');
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
  
  // EBITDA (calculated) - shifted down to row 67
  inputsWs['A67'] = header('CALCULATED VALUES (Reference Only)');
  inputsWs['A68'] = header('Item');
  inputsWs['B68'] = header('Value');
  inputsWs['A69'] = cell('EBITDA');
  inputsWs['B69'] = cell(ebitda, FMT.number);
  inputsWs['A70'] = cell('Total Debt');
  inputsWs['B70'] = cell(totalDebt, FMT.number);
  inputsWs['A71'] = cell('Base FCF Margin %');
  inputsWs['B71'] = cell(fcfMargin, FMT.decimal);
  inputsWs['A72'] = cell('Market Cap');
  inputsWs['B72'] = cell(marketCap, FMT.number);
  inputsWs['A73'] = cell('Enterprise Value');
  inputsWs['B73'] = cell(enterpriseValue, FMT.number);
  
  // Comparable Companies - shifted down to row 75
  inputsWs['A75'] = header('COMPARABLE COMPANIES');
  inputsWs['A76'] = header('Company');
  inputsWs['B76'] = header('P/E');
  inputsWs['C76'] = header('EV/EBITDA');
  inputsWs['D76'] = header('P/S');
  inputsWs['E76'] = header('P/B');
  
  comparables.forEach((comp, i) => {
    const row = 77 + i;
    inputsWs[`A${row}`] = cell(comp.name);
    inputsWs[`B${row}`] = cell(comp.peRatio, FMT.decimal);
    inputsWs[`C${row}`] = cell(comp.evEbitda, FMT.decimal);
    inputsWs[`D${row}`] = cell(comp.psRatio, FMT.decimal);
    inputsWs[`E${row}`] = cell(comp.pbRatio, FMT.decimal);
  });
  
  inputsWs['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
  inputsWs['!ref'] = `A1:E${77 + comparables.length}`;
  applyBoldRows(inputsWs, [1, 4, 5, 11, 12, 24, 25, 26, 33, 40, 45, 49, 52, 53, 59, 60, 67, 68, 75, 76]);
  XLSX.utils.book_append_sheet(wb, inputsWs, 'Inputs');

  // ============================================
  // SHEET 2: DCF MODEL (With formulas and years)
  // ============================================
  const dcfWs: XLSX.WorkSheet = {};
  
  dcfWs['A1'] = header('DCF VALUATION MODEL');
  dcfWs['A2'] = cell('All values in thousands ($000s)');
  
  // Key Assumptions (reference Inputs sheet)
  dcfWs['A4'] = header('KEY ASSUMPTIONS');
  dcfWs['A5'] = header('Item');
  dcfWs['B5'] = header('Value');
  dcfWs['A6'] = cell('Base Revenue');
  dcfWs['B6'] = formula('Inputs!B13', FMT.number);
  dcfWs['A7'] = cell('Base Free Cash Flow');
  dcfWs['B7'] = formula('Inputs!B56', FMT.number);
  dcfWs['A8'] = cell('Revenue Growth Rate');
  dcfWs['B8'] = formula('Inputs!B63/100', FMT.percent);
  dcfWs['A9'] = cell('FCF Margin');
  dcfWs['B9'] = formula('Inputs!B71/100', FMT.percent);
  dcfWs['A10'] = cell('WACC (Discount Rate)');
  dcfWs['B10'] = formula('Inputs!B61/100', FMT.percent);
  dcfWs['A11'] = cell('Terminal Growth Rate');
  dcfWs['B11'] = formula('Inputs!B62/100', FMT.percent);
  
  // Projections header with YEARS
  dcfWs['A13'] = header('CASH FLOW PROJECTIONS');
  dcfWs['A14'] = header('');
  dcfWs['B14'] = header(`${currentYear} (Base)`);
  dcfWs['C14'] = header(`${currentYear + 1}`);
  dcfWs['D14'] = header(`${currentYear + 2}`);
  dcfWs['E14'] = header(`${currentYear + 3}`);
  dcfWs['F14'] = header(`${currentYear + 4}`);
  dcfWs['G14'] = header(`${currentYear + 5}`);
  
  // Year number row
  dcfWs['A15'] = header('Year');
  dcfWs['B15'] = cell(0, FMT.number);
  dcfWs['C15'] = cell(1, FMT.number);
  dcfWs['D15'] = cell(2, FMT.number);
  dcfWs['E15'] = cell(3, FMT.number);
  dcfWs['F15'] = cell(4, FMT.number);
  dcfWs['G15'] = cell(5, FMT.number);
  
  // Revenue
  dcfWs['A16'] = cell('Revenue');
  dcfWs['B16'] = formula('B6', FMT.number);
  dcfWs['C16'] = formula('B16*(1+$B$8)', FMT.number);
  dcfWs['D16'] = formula('C16*(1+$B$8)', FMT.number);
  dcfWs['E16'] = formula('D16*(1+$B$8)', FMT.number);
  dcfWs['F16'] = formula('E16*(1+$B$8)', FMT.number);
  dcfWs['G16'] = formula('F16*(1+$B$8)', FMT.number);
  
  // Free Cash Flow
  dcfWs['A17'] = cell('Free Cash Flow');
  dcfWs['B17'] = formula('B7', FMT.number);
  dcfWs['C17'] = formula('C16*$B$9', FMT.number);
  dcfWs['D17'] = formula('D16*$B$9', FMT.number);
  dcfWs['E17'] = formula('E16*$B$9', FMT.number);
  dcfWs['F17'] = formula('F16*$B$9', FMT.number);
  dcfWs['G17'] = formula('G16*$B$9', FMT.number);
  
  // Discount Factor
  dcfWs['A18'] = cell('Discount Factor');
  dcfWs['B18'] = cell(1, FMT.decimal);
  dcfWs['C18'] = formula('1/POWER(1+$B$10,C15)', FMT.decimal);
  dcfWs['D18'] = formula('1/POWER(1+$B$10,D15)', FMT.decimal);
  dcfWs['E18'] = formula('1/POWER(1+$B$10,E15)', FMT.decimal);
  dcfWs['F18'] = formula('1/POWER(1+$B$10,F15)', FMT.decimal);
  dcfWs['G18'] = formula('1/POWER(1+$B$10,G15)', FMT.decimal);
  
  // Present Value
  dcfWs['A19'] = cell('Present Value of FCF');
  dcfWs['B19'] = cell('', FMT.number);
  dcfWs['C19'] = formula('C17*C18', FMT.number);
  dcfWs['D19'] = formula('D17*D18', FMT.number);
  dcfWs['E19'] = formula('E17*E18', FMT.number);
  dcfWs['F19'] = formula('F17*F18', FMT.number);
  dcfWs['G19'] = formula('G17*G18', FMT.number);
  
  // Valuation Summary
  dcfWs['A21'] = header('VALUATION SUMMARY');
  dcfWs['A22'] = header('Item');
  dcfWs['B22'] = header('Value');
  
  dcfWs['A23'] = cell('Sum of PV of FCF (Years 1-5)');
  dcfWs['B23'] = formula('SUM(C19:G19)', FMT.number);
  
  dcfWs['A24'] = cell('Terminal Value (at Year 5)');
  dcfWs['B24'] = formula('IFERROR(G17*(1+$B$11)/($B$10-$B$11),0)', FMT.number);
  
  dcfWs['A25'] = cell('PV of Terminal Value');
  dcfWs['B25'] = formula('IFERROR(B24*G18,0)', FMT.number);
  
  dcfWs['A26'] = cell('Enterprise Value');
  dcfWs['B26'] = formula('B23+B25', FMT.number);
  
  dcfWs['A27'] = cell('Plus: Cash');
  dcfWs['B27'] = formula('Inputs!B27', FMT.number);
  
  dcfWs['A28'] = cell('Less: Total Debt');
  dcfWs['B28'] = formula('Inputs!B70', FMT.number);
  
  dcfWs['A29'] = cell('Equity Value');
  dcfWs['B29'] = formula('MAX(B26+B27-B28,0)', FMT.number);
  
  dcfWs['A30'] = cell('Shares Outstanding');
  dcfWs['B30'] = formula('Inputs!B8', FMT.number);
  
  dcfWs['A31'] = header('DCF Implied Share Price');
  dcfWs['B31'] = formula('IFERROR(B29/B30,0)', FMT.currencyDec);
  
  dcfWs['A33'] = cell('Current Stock Price');
  dcfWs['B33'] = formula('Inputs!B9', FMT.currencyDec);
  
  dcfWs['A34'] = header('Upside / (Downside)');
  dcfWs['B34'] = formula('IFERROR((B31-B33)/B33,0)', FMT.percent);
  
  dcfWs['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }];
  dcfWs['!ref'] = 'A1:G34';
  applyBoldRows(dcfWs, [1, 4, 5, 13, 14, 15, 21, 22, 31, 34]);
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
  
  // Reference comparable data from Inputs
  const compCount = Math.max(comparables.length, 1);
  for (let i = 0; i < compCount; i++) {
    const row = 6 + i;
    const inputRow = 77 + i;
    compWs[`A${row}`] = formula(`Inputs!A${inputRow}`);
    compWs[`B${row}`] = formula(`Inputs!B${inputRow}`, FMT.decimal);
    compWs[`C${row}`] = formula(`Inputs!C${inputRow}`, FMT.decimal);
    compWs[`D${row}`] = formula(`Inputs!D${inputRow}`, FMT.decimal);
    compWs[`E${row}`] = formula(`Inputs!E${inputRow}`, FMT.decimal);
  }
  
  // Averages row
  const avgRow = 6 + compCount + 1;
  compWs[`A${avgRow}`] = header('Average Multiple');
  compWs[`B${avgRow}`] = formula(`IFERROR(AVERAGE(B6:B${avgRow-2}),0)`, FMT.decimal);
  compWs[`C${avgRow}`] = formula(`IFERROR(AVERAGE(C6:C${avgRow-2}),0)`, FMT.decimal);
  compWs[`D${avgRow}`] = formula(`IFERROR(AVERAGE(D6:D${avgRow-2}),0)`, FMT.decimal);
  compWs[`E${avgRow}`] = formula(`IFERROR(AVERAGE(E6:E${avgRow-2}),0)`, FMT.decimal);
  
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
  const summaryRow = impliedRow + 8;
  compWs[`A${summaryRow}`] = header('SUMMARY');
  compWs[`A${summaryRow + 1}`] = header('Average Implied Price');
  compWs[`B${summaryRow + 1}`] = formula(`IFERROR(AVERAGE(B${impliedRow + 2}:B${impliedRow + 5}),0)`, FMT.currencyDec);
  
  compWs[`A${summaryRow + 2}`] = cell('Current Stock Price');
  compWs[`B${summaryRow + 2}`] = formula('Inputs!B9', FMT.currencyDec);
  
  compWs[`A${summaryRow + 3}`] = header('Upside / (Downside)');
  compWs[`B${summaryRow + 3}`] = formula(`IFERROR((B${summaryRow + 1}-B${summaryRow + 2})/B${summaryRow + 2},0)`, FMT.percent);
  
  compWs['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 12 }];
  compWs['!ref'] = `A1:E${summaryRow + 4}`;
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
  ratiosWs['A27'] = cell('ROIC');
  ratiosWs['B27'] = formula('IFERROR(Inputs!B17*(1-Inputs!B64/100)/(Inputs!B50+Inputs!B70),0)', FMT.percent);
  
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
  
  ratiosWs['!cols'] = [{ wch: 28 }, { wch: 18 }];
  ratiosWs['!ref'] = 'A1:B37';
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
  dashWs['B7'] = formula("'DCF Model'!B31", FMT.currencyDec);
  dashWs['C7'] = cell(0.4, FMT.percent);
  dashWs['D7'] = formula('B7*C7', FMT.currencyDec);
  
  dashWs['A8'] = cell('P/E Multiple');
  dashWs['B8'] = formula(`'Comparables'!B${impliedRowRef + 2}`, FMT.currencyDec);
  dashWs['C8'] = cell(0.2, FMT.percent);
  dashWs['D8'] = formula('B8*C8', FMT.currencyDec);
  
  dashWs['A9'] = cell('EV/EBITDA Multiple');
  dashWs['B9'] = formula(`'Comparables'!B${impliedRowRef + 3}`, FMT.currencyDec);
  dashWs['C9'] = cell(0.2, FMT.percent);
  dashWs['D9'] = formula('B9*C9', FMT.currencyDec);
  
  dashWs['A10'] = cell('P/S Multiple');
  dashWs['B10'] = formula(`'Comparables'!B${impliedRowRef + 4}`, FMT.currencyDec);
  dashWs['C10'] = cell(0.1, FMT.percent);
  dashWs['D10'] = formula('B10*C10', FMT.currencyDec);
  
  dashWs['A11'] = cell('P/B Multiple');
  dashWs['B11'] = formula(`'Comparables'!B${impliedRowRef + 5}`, FMT.currencyDec);
  dashWs['C11'] = cell(0.1, FMT.percent);
  dashWs['D11'] = formula('B11*C11', FMT.currencyDec);
  
  // Blended Valuation
  dashWs['A13'] = header('FINAL VALUATION');
  dashWs['A14'] = header('Item');
  dashWs['B14'] = header('Value');
  dashWs['A15'] = header('Blended Target Price');
  dashWs['B15'] = formula('SUM(D7:D11)', FMT.currencyDec);
  
  dashWs['A16'] = cell('Current Stock Price');
  dashWs['B16'] = formula('Inputs!B9', FMT.currencyDec);
  
  dashWs['A17'] = header('Upside / (Downside)');
  dashWs['B17'] = formula('IFERROR((B15-B16)/B16,0)', FMT.percent);
  
  // Recommendation
  dashWs['A19'] = header('INVESTMENT RECOMMENDATION');
  dashWs['A20'] = formula('IF(B17>0.15,"STRONG BUY",IF(B17>0.05,"BUY",IF(B17>-0.05,"HOLD",IF(B17>-0.15,"SELL","STRONG SELL"))))');
  
  // Key Metrics Summary
  dashWs['A22'] = header('KEY METRICS SNAPSHOT');
  dashWs['A23'] = header('Metric');
  dashWs['B23'] = header('Value');
  dashWs['A24'] = cell('Market Cap');
  dashWs['B24'] = formula("'Ratios'!B5", FMT.number);
  dashWs['A25'] = cell('Enterprise Value');
  dashWs['B25'] = formula("'Ratios'!B6", FMT.number);
  dashWs['A26'] = cell('P/E Ratio');
  dashWs['B26'] = formula("'Ratios'!B11", FMT.decimal);
  dashWs['A27'] = cell('EV/EBITDA');
  dashWs['B27'] = formula("'Ratios'!B12", FMT.decimal);
  dashWs['A28'] = cell('Net Margin');
  dashWs['B28'] = formula("'Ratios'!B22", FMT.percent);
  dashWs['A29'] = cell('ROE');
  dashWs['B29'] = formula("'Ratios'!B25", FMT.percent);
  dashWs['A30'] = cell('FCF Yield');
  dashWs['B30'] = formula("'Ratios'!B36", FMT.percent);
  dashWs['A31'] = cell('Debt/EBITDA');
  dashWs['B31'] = formula("'Ratios'!B34", FMT.decimal);
  
  dashWs['!cols'] = [{ wch: 26 }, { wch: 18 }, { wch: 12 }, { wch: 18 }];
  dashWs['!ref'] = 'A1:D31';
  applyBoldRows(dashWs, [1, 5, 6, 13, 14, 15, 17, 19, 22, 23]);
  XLSX.utils.book_append_sheet(wb, dashWs, 'Dashboard');

  // ============================================
  // SHEET 6: SENSITIVITY ANALYSIS
  // ============================================
  const sensWs: XLSX.WorkSheet = {};
  
  sensWs['A1'] = header('SENSITIVITY ANALYSIS');
  sensWs['A2'] = cell('How valuation changes with different assumptions');
  
  // WACC vs Terminal Growth
  sensWs['A4'] = header('WACC vs TERMINAL GROWTH RATE');
  sensWs['A5'] = header('WACC \\ Growth');
  sensWs['B5'] = header('1.5%');
  sensWs['C5'] = header('2.0%');
  sensWs['D5'] = header('2.5%');
  sensWs['E5'] = header('3.0%');
  sensWs['F5'] = header('3.5%');
  
  const waccValues = [
    assumptions.discountRate - 2,
    assumptions.discountRate - 1,
    assumptions.discountRate,
    assumptions.discountRate + 1,
    assumptions.discountRate + 2,
  ];
  const growthValues = [1.5, 2.0, 2.5, 3.0, 3.5];
  
  waccValues.forEach((wacc, wi) => {
    const row = 6 + wi;
    sensWs[`A${row}`] = cell(`${wacc.toFixed(1)}%`, undefined, wi === 2);
    growthValues.forEach((g, gi) => {
      const col = String.fromCharCode(66 + gi); // B, C, D, E, F
      // Calculate implied price
      const baseRevenue = financialData.incomeStatement.revenue;
      const baseFCFMarg = financialData.cashFlowStatement.freeCashFlow / baseRevenue;
      let rev = baseRevenue;
      let spv = 0;
      let lFCF = 0;
      
      for (let yr = 1; yr <= assumptions.projectionYears; yr++) {
        rev = rev * (1 + assumptions.revenueGrowthRate / 100);
        const margin = baseFCFMarg + (assumptions.marginImprovement / 100) * yr;
        const fcfCalc = rev * margin;
        const df = Math.pow(1 + wacc / 100, yr);
        spv += fcfCalc / df;
        lFCF = fcfCalc;
      }
      
      let tv = 0;
      if (wacc > g) {
        tv = (lFCF * (1 + g / 100)) / ((wacc - g) / 100);
      } else {
        tv = lFCF * 12;
      }
      const lastDF = Math.pow(1 + wacc / 100, assumptions.projectionYears);
      const ev = spv + tv / lastDF;
      const equity = ev - totalDebt + financialData.balanceSheet.cash;
      const price = Math.max(equity / financialData.sharesOutstanding, 0);
      
      const isBold = wi === 2 && gi === 2;
      sensWs[`${col}${row}`] = cell(price, FMT.currencyDec, isBold);
    });
  });
  
  // Bull / Bear / Base section
  sensWs['A13'] = header('SCENARIO ANALYSIS');
  sensWs['A14'] = header('Scenario');
  sensWs['B14'] = header('Rev Growth');
  sensWs['C14'] = header('WACC');
  sensWs['D14'] = header('Margin Imp');
  sensWs['E14'] = header('Implied Price');
  
  // Bear
  const bearRevGrowth = assumptions.revenueGrowthRate * 0.4;
  const bearWACC = assumptions.discountRate + 2.5;
  const bearMargin = assumptions.marginImprovement - 1.5;
  sensWs['A15'] = cell('BEAR CASE');
  sensWs['B15'] = cell(bearRevGrowth, FMT.decimal);
  sensWs['C15'] = cell(bearWACC, FMT.decimal);
  sensWs['D15'] = cell(bearMargin, FMT.decimal);
  // Calculate bear price
  {
    let rev = financialData.incomeStatement.revenue;
    const baseFCFMarg = financialData.cashFlowStatement.freeCashFlow / rev;
    let spv = 0; let lFCF = 0;
    for (let yr = 1; yr <= assumptions.projectionYears; yr++) {
      rev *= (1 + bearRevGrowth / 100);
      const fcfC = rev * (baseFCFMarg + (bearMargin / 100) * yr);
      spv += fcfC / Math.pow(1 + bearWACC / 100, yr);
      lFCF = fcfC;
    }
    const tv = bearWACC > assumptions.terminalGrowthRate * 0.6
      ? (lFCF * (1 + assumptions.terminalGrowthRate * 0.6 / 100)) / ((bearWACC - assumptions.terminalGrowthRate * 0.6) / 100)
      : lFCF * 12;
    const ev = spv + tv / Math.pow(1 + bearWACC / 100, assumptions.projectionYears);
    sensWs['E15'] = cell(Math.max((ev - totalDebt + financialData.balanceSheet.cash) / financialData.sharesOutstanding, 0), FMT.currencyDec);
  }
  
  // Base
  sensWs['A16'] = cell('BASE CASE');
  sensWs['B16'] = cell(assumptions.revenueGrowthRate, FMT.decimal);
  sensWs['C16'] = cell(assumptions.discountRate, FMT.decimal);
  sensWs['D16'] = cell(assumptions.marginImprovement, FMT.decimal);
  {
    let rev = financialData.incomeStatement.revenue;
    const baseFCFMarg = financialData.cashFlowStatement.freeCashFlow / rev;
    let spv = 0; let lFCF = 0;
    for (let yr = 1; yr <= assumptions.projectionYears; yr++) {
      rev *= (1 + assumptions.revenueGrowthRate / 100);
      const fcfC = rev * (baseFCFMarg + (assumptions.marginImprovement / 100) * yr);
      spv += fcfC / Math.pow(1 + assumptions.discountRate / 100, yr);
      lFCF = fcfC;
    }
    const tv = (lFCF * (1 + assumptions.terminalGrowthRate / 100)) / ((assumptions.discountRate - assumptions.terminalGrowthRate) / 100);
    const ev = spv + tv / Math.pow(1 + assumptions.discountRate / 100, assumptions.projectionYears);
    sensWs['E16'] = cell(Math.max((ev - totalDebt + financialData.balanceSheet.cash) / financialData.sharesOutstanding, 0), FMT.currencyDec);
  }
  
  // Bull
  const bullRevGrowth = assumptions.revenueGrowthRate * 2.0;
  const bullWACC = Math.max(assumptions.discountRate - 2.5, 2);
  const bullMargin = assumptions.marginImprovement + 2.5;
  sensWs['A17'] = cell('BULL CASE');
  sensWs['B17'] = cell(bullRevGrowth, FMT.decimal);
  sensWs['C17'] = cell(bullWACC, FMT.decimal);
  sensWs['D17'] = cell(bullMargin, FMT.decimal);
  {
    let rev = financialData.incomeStatement.revenue;
    const baseFCFMarg = financialData.cashFlowStatement.freeCashFlow / rev;
    let spv = 0; let lFCF = 0;
    for (let yr = 1; yr <= assumptions.projectionYears; yr++) {
      rev *= (1 + bullRevGrowth / 100);
      const fcfC = rev * (baseFCFMarg + (bullMargin / 100) * yr);
      spv += fcfC / Math.pow(1 + bullWACC / 100, yr);
      lFCF = fcfC;
    }
    const tv = bullWACC > assumptions.terminalGrowthRate * 1.5
      ? (lFCF * (1 + assumptions.terminalGrowthRate * 1.5 / 100)) / ((bullWACC - assumptions.terminalGrowthRate * 1.5) / 100)
      : lFCF * 15;
    const ev = spv + tv / Math.pow(1 + bullWACC / 100, assumptions.projectionYears);
    sensWs['E17'] = cell(Math.max((ev - totalDebt + financialData.balanceSheet.cash) / financialData.sharesOutstanding, 0), FMT.currencyDec);
  }
  
  sensWs['A19'] = cell('Current Stock Price');
  sensWs['B19'] = formula('Inputs!B9', FMT.currencyDec);
  
  sensWs['!cols'] = [{ wch: 20 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }];
  sensWs['!ref'] = 'A1:F19';
  applyBoldRows(sensWs, [1, 4, 5, 13, 14]);
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
    ['   • Currency: $45.50'],
    ['   • Multiples: 15.0x'],
    [''],
    ['KEY FORMULAS'],
    ['   • DCF Value = Sum of PV(FCF) + PV(Terminal Value)'],
    ['   • Terminal Value = FCF₅ × (1+g) / (WACC-g)'],
    ['   • Equity Value = Enterprise Value + Cash - Debt'],
    ['   • Share Price = Equity Value / Shares Outstanding'],
    [''],
    ['TIPS FOR BEST RESULTS'],
    ['   • Use realistic growth assumptions (typically 3-15%)'],
    ['   • WACC should reflect company risk (typically 8-15%)'],
    ['   • Terminal growth should not exceed GDP growth (2-3%)'],
    ['   • Add comparable companies from the same industry'],
    [''],
    [''],
    [`Generated by WOLF Valuation Engine on ${new Date().toLocaleDateString()}`],
    ['Version 1.0'],
  ];
  
  const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
  instructionsWs['!cols'] = [{ wch: 75 }];
  applyBoldRows(instructionsWs, [1, 3, 5, 10, 16, 21, 25, 30, 37, 43]);
  XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions');

  // Generate and download
  const fileName = `WOLF_${financialData.ticker}_Valuation_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
};
