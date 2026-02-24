import * as XLSX from 'xlsx';
import { FinancialData, ValuationAssumptions, ComparableCompany, DCFProjection, MarketRegion } from '../types/financial';
import { calculateDCF, calculateComparableValuation, calculateEBITDA, calculateEnterpriseValue, calculateWACC } from './valuation';
import { calculateQualityScorecard } from './advancedAnalysis';

interface ExportData {
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  comparables: ComparableCompany[];
  marketRegion?: MarketRegion;
}

// ─── Helpers: write numeric cells with Excel formatting ─────────────

/** Add a cell to a worksheet at the given row/col with proper type */
function setCell(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  value: string | number | boolean | null,
  fmt?: string
) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col });
  if (value === null || value === undefined || value === '') {
    ws[addr] = { t: 's', v: '' };
  } else if (typeof value === 'number') {
    ws[addr] = { t: 'n', v: value, z: fmt || '#,##0' };
  } else if (typeof value === 'boolean') {
    ws[addr] = { t: 'b', v: value };
  } else {
    ws[addr] = { t: 's', v: String(value) };
  }
}

/**
 * Write an array of rows into a worksheet. Each cell can be:
 *   - a string → text cell
 *   - a number → numeric cell (formatted with the column's fmt or default #,##0)
 *   - null/undefined → empty
 */
function writeRows(
  ws: XLSX.WorkSheet,
  rows: (string | number | null | undefined)[][],
  startRow: number,
  colFormats?: (string | undefined)[]
): number {
  let r = startRow;
  for (const row of rows) {
    for (let c = 0; c < row.length; c++) {
      const val = row[c];
      const fmt = colFormats?.[c];
      if (val !== null && val !== undefined) {
        setCell(ws, r, c, val, fmt);
      }
    }
    r++;
  }
  // Update the worksheet range
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const maxR = r - 1;
  const maxC = rows.reduce((m, row) => Math.max(m, row.length - 1), 0);
  if (maxR > range.e.r) range.e.r = maxR;
  if (maxC > range.e.c) range.e.c = maxC;
  ws['!ref'] = XLSX.utils.encode_range(range);
  return r;
}

/** Create a fresh worksheet */
function newSheet(): XLSX.WorkSheet {
  return { '!ref': 'A1' };
}

// ─── Number format strings for Excel ───────────────────────────────

const FMT_CURRENCY = '#,##0.00';

const FMT_RATIO = '0.00"x"';
const FMT_INT = '#,##0';
const FMT_DEC2 = '#,##0.00';
const FMT_DEC4 = '0.0000';

// ─── Main Export Function ──────────────────────────────────────────

export function exportToExcel(data: ExportData): void {
  const { financialData, assumptions, comparables, marketRegion = 'Egypt' } = data;
  const ccy = marketRegion === 'Egypt' ? 'EGP' : 'USD';
  const wb = XLSX.utils.book_new();

  // Calculate all valuation data
  const { value: dcfValue, projections } = calculateDCF(financialData, assumptions);
  const compResults = calculateComparableValuation(financialData, comparables);
  const ebitda = calculateEBITDA(financialData);
  const ev = calculateEnterpriseValue(financialData);
  const wacc = calculateWACC(financialData, assumptions);
  const marketCap = financialData.currentStockPrice * financialData.sharesOutstanding;
  const dcfPerShare = dcfValue / financialData.sharesOutstanding;
  const dcfUpside = ((dcfPerShare - financialData.currentStockPrice) / financialData.currentStockPrice) * 100;
  const { incomeStatement, balanceSheet, cashFlowStatement } = financialData;
  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const qualityResult = calculateQualityScorecard(financialData);

  // ============================================
  // SHEET 1: EXECUTIVE SUMMARY
  // ============================================
  const ws1 = newSheet();
  let r = 0;

  r = writeRows(ws1, [
    ['WOLF VALUATION REPORT'],
    [],
    ['Company Information'],
    ['Company Name:', financialData.companyName],
    ['Ticker Symbol:', financialData.ticker],
    ['Report Date:', new Date().toLocaleDateString()],
    [],
    ['Market Data'],
  ], r);

  // Market data with numeric values
  r = writeRows(ws1, [
    ['Current Stock Price:', financialData.currentStockPrice],
    ['Shares Outstanding:', financialData.sharesOutstanding],
    ['Market Capitalization:', marketCap],
    ['Enterprise Value:', ev],
  ], r, [undefined, FMT_CURRENCY]);

  r = writeRows(ws1, [
    [],
    ['Valuation Summary'],
    [],
    ['Method', 'Equity Value ($)', 'Price/Share ($)', 'Upside/Downside (%)'],
    ['DCF Valuation', dcfValue, dcfPerShare, dcfUpside],
    ...compResults.map(cr => [cr.method, cr.value, cr.perShare, cr.upside] as (string | number)[]),
  ], r, [undefined, FMT_CURRENCY, FMT_CURRENCY, FMT_DEC2]);

  const avgFairValue = compResults.length > 0
    ? (dcfPerShare + compResults.reduce((s, cr) => s + cr.perShare, 0)) / (compResults.length + 1)
    : dcfPerShare;

  r = writeRows(ws1, [
    [],
    ['Average Fair Value:', avgFairValue],
    [],
    ['Currency:', ccy],
    ['CAPM Method:', assumptions.capmMethod === 'B' ? 'B \u2014 USD Build-Up' : 'A \u2014 Local Currency'],
    [],
    ['Investment Recommendation'],
    [dcfUpside > 10 ? 'UNDERVALUED - BUY' : dcfUpside < -10 ? 'OVERVALUED - SELL' : 'FAIRLY VALUED - HOLD'],
    [],
    ['Financial Health & Quality'],
    ['Quality Score:', `${qualityResult.grade} (${qualityResult.totalScore}/40)`],
  ], r, [undefined, FMT_CURRENCY]);

  ws1['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 16 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Executive Summary');

  // ============================================
  // SHEET 2: INCOME STATEMENT
  // ============================================
  const ws2 = newSheet();
  r = 0;
  const rev = incomeStatement.revenue || 1; // avoid div by 0

  r = writeRows(ws2, [
    ['INCOME STATEMENT'],
    [],
    ['', 'Amount ($)', '% of Revenue'],
    ['Revenue', incomeStatement.revenue, 1],
    ['Cost of Goods Sold', -incomeStatement.costOfGoodsSold, incomeStatement.costOfGoodsSold / rev],
    ['Gross Profit', incomeStatement.grossProfit, incomeStatement.grossProfit / rev],
    [],
    ['Operating Expenses', -incomeStatement.operatingExpenses, incomeStatement.operatingExpenses / rev],
    ['Operating Income (EBIT)', incomeStatement.operatingIncome, incomeStatement.operatingIncome / rev],
    [],
    ['Depreciation', incomeStatement.depreciation, incomeStatement.depreciation / rev],
    ['Amortization', incomeStatement.amortization, incomeStatement.amortization / rev],
    ['EBITDA', ebitda, ebitda / rev],
    [],
    ['Interest Expense', -incomeStatement.interestExpense, incomeStatement.interestExpense / rev],
    ['Tax Expense', -incomeStatement.taxExpense, incomeStatement.taxExpense / rev],
    ['Net Income', incomeStatement.netIncome, incomeStatement.netIncome / rev],
    [],
    ['Earnings Per Share (EPS)', incomeStatement.netIncome / financialData.sharesOutstanding],
  ], r, [undefined, FMT_CURRENCY, '0.00%']);

  ws2['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Income Statement');

  // ============================================
  // SHEET 3: BALANCE SHEET
  // ============================================
  const ws3 = newSheet();
  r = 0;

  r = writeRows(ws3, [
    ['BALANCE SHEET'],
    [],
    ['ASSETS', 'Amount ($)'],
    [],
    ['Current Assets'],
    ['Cash & Cash Equivalents', balanceSheet.cash],
    ['Accounts Receivable', balanceSheet.accountsReceivable],
    ['Inventory', balanceSheet.inventory],
    ['Total Current Assets', balanceSheet.totalCurrentAssets],
    [],
    ['Non-Current Assets'],
    ['Property, Plant & Equipment', balanceSheet.propertyPlantEquipment],
    ['Intangible Assets', balanceSheet.intangibleAssets],
    [],
    ['TOTAL ASSETS', balanceSheet.totalAssets],
    [],
    ['LIABILITIES'],
    [],
    ['Current Liabilities'],
    ['Accounts Payable', balanceSheet.accountsPayable],
    ['Short-Term Debt', balanceSheet.shortTermDebt],
    ['Total Current Liabilities', balanceSheet.totalCurrentLiabilities],
    [],
    ['Non-Current Liabilities'],
    ['Long-Term Debt', balanceSheet.longTermDebt],
    [],
    ['TOTAL LIABILITIES', balanceSheet.totalLiabilities],
    [],
    ['EQUITY'],
    ['Total Shareholders Equity', balanceSheet.totalEquity],
    [],
    ['TOTAL LIABILITIES + EQUITY', balanceSheet.totalLiabilities + balanceSheet.totalEquity],
    [],
    ['Key Ratios'],
    ['Net Debt', totalDebt - balanceSheet.cash],
    ['Debt-to-Equity Ratio', balanceSheet.totalEquity !== 0 ? totalDebt / balanceSheet.totalEquity : 0],
    ['Current Ratio', balanceSheet.totalCurrentLiabilities !== 0 ? balanceSheet.totalCurrentAssets / balanceSheet.totalCurrentLiabilities : 0],
  ], r, [undefined, FMT_CURRENCY]);

  // Override format for ratio rows (last 2 rows)
  const lastRow3 = r - 1;
  setCell(ws3, lastRow3, 1, balanceSheet.totalCurrentLiabilities !== 0 ? balanceSheet.totalCurrentAssets / balanceSheet.totalCurrentLiabilities : 0, FMT_RATIO);
  setCell(ws3, lastRow3 - 1, 1, balanceSheet.totalEquity !== 0 ? totalDebt / balanceSheet.totalEquity : 0, FMT_RATIO);

  ws3['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Balance Sheet');

  // ============================================
  // SHEET 4: CASH FLOW STATEMENT
  // ============================================
  const ws4 = newSheet();
  r = 0;

  r = writeRows(ws4, [
    ['CASH FLOW STATEMENT'],
    [],
    ['', 'Amount ($)'],
    [],
    ['Operating Activities'],
    ['Operating Cash Flow', cashFlowStatement.operatingCashFlow],
    [],
    ['Investing Activities'],
    ['Capital Expenditures', -cashFlowStatement.capitalExpenditures],
    [],
    ['Free Cash Flow', cashFlowStatement.freeCashFlow],
    [],
    ['Financing Activities'],
    ['Dividends Paid', -cashFlowStatement.dividendsPaid],
    [],
    ['Net Change in Cash', cashFlowStatement.netChangeInCash],
    [],
    ['Key Metrics'],
  ], r, [undefined, FMT_CURRENCY]);

  r = writeRows(ws4, [
    ['FCF Margin', rev !== 0 ? cashFlowStatement.freeCashFlow / rev : 0],
    ['FCF Yield', marketCap !== 0 ? cashFlowStatement.freeCashFlow / marketCap : 0],
    ['FCF per Share', financialData.sharesOutstanding !== 0 ? cashFlowStatement.freeCashFlow / financialData.sharesOutstanding : 0],
    ['Dividend Yield', marketCap !== 0 ? cashFlowStatement.dividendsPaid / marketCap : 0],
  ], r, [undefined, '0.00%']);

  ws4['!cols'] = [{ wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws4, 'Cash Flow');

  // ============================================
  // SHEET 5: DCF VALUATION
  // ============================================
  const ws5 = newSheet();
  r = 0;

  r = writeRows(ws5, [
    ['DISCOUNTED CASH FLOW VALUATION'],
    [],
    ['Assumptions'],
    ['Currency', ccy],
    ['CAPM Method', assumptions.capmMethod === 'B' ? 'B \u2014 USD Build-Up' : 'A \u2014 Local Currency'],
    ['Discount Rate (WACC)', assumptions.discountRate / 100],
    ['Calculated WACC', wacc / 100],
    ['Terminal Growth Rate', assumptions.terminalGrowthRate / 100],
    ['Projection Years', assumptions.projectionYears],
    ['Revenue Growth Rate', assumptions.revenueGrowthRate / 100],
    ['EBITDA Margin', assumptions.ebitdaMargin / 100],
    ['D&A (% of Revenue)', assumptions.daPercent / 100],
    ['CapEx (% of Revenue)', assumptions.capexPercent / 100],
    ['\u0394WC (% of Revenue)', assumptions.deltaWCPercent / 100],
    ['Tax Rate', assumptions.taxRate / 100],
    ['Risk-Free Rate', assumptions.riskFreeRate / 100],
    ['Equity Risk Premium', assumptions.marketRiskPremium / 100],
    ['Beta', assumptions.beta],
    ['Beta Type', assumptions.betaType || 'Raw'],
    ['Cost of Debt', assumptions.costOfDebt / 100],
    ['Terminal Method', assumptions.terminalMethod === 'exit_multiple' ? `Exit Multiple (${assumptions.exitMultiple}x)` : 'Gordon Growth'],
    ['Discounting Convention', assumptions.discountingConvention === 'mid_year' ? 'Mid-Year' : 'End of Year'],
  ], r, [undefined, '0.00%']);

  // Override beta cell format
  setCell(ws5, r - 1, 1, assumptions.beta, FMT_DEC2);
  // Override projection years
  setCell(ws5, r - 7, 1, assumptions.projectionYears, FMT_INT);

  r = writeRows(ws5, [
    [],
    ['Cash Flow Projections'],
    [],
    ['Year', 'Revenue ($)', 'EBITDA ($)', 'Free Cash Flow ($)', 'Discount Factor', 'Present Value ($)'],
  ], r);

  // Projection rows - raw numbers
  for (const p of projections) {
    r = writeRows(ws5, [
      [`Year ${p.year}`, p.revenue, p.ebitda, p.freeCashFlow, p.discountFactor, p.presentValue],
    ], r, [undefined, FMT_CURRENCY, FMT_CURRENCY, FMT_CURRENCY, FMT_DEC4, FMT_CURRENCY]);
  }

  const sumPV = projections.reduce((s: number, p: DCFProjection) => s + p.presentValue, 0);
  const terminalPV = dcfValue - sumPV + totalDebt - balanceSheet.cash;

  r = writeRows(ws5, [
    [],
    ['Valuation Results'],
    [],
    ['Sum of Present Values', sumPV],
    ['Terminal Value (PV)', terminalPV],
    [],
    ['Enterprise Value', dcfValue + totalDebt - balanceSheet.cash],
    ['Less: Net Debt', totalDebt - balanceSheet.cash],
    ['Equity Value', dcfValue],
    [],
    ['Shares Outstanding', financialData.sharesOutstanding],
    ['Intrinsic Value per Share', dcfPerShare],
    ['Current Stock Price', financialData.currentStockPrice],
    ['Upside / Downside', dcfUpside / 100],
  ], r, [undefined, FMT_CURRENCY]);

  // Override shares outstanding format and upside format
  setCell(ws5, r - 4, 1, financialData.sharesOutstanding, FMT_INT);
  setCell(ws5, r - 1, 1, dcfUpside / 100, '0.00%');

  ws5['!cols'] = [{ wch: 25 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws5, 'DCF Valuation');

  // ============================================
  // SHEET 6: COMPARABLE COMPANIES
  // ============================================
  const ws6 = newSheet();
  r = 0;
  const avgPE = comparables.length > 0 ? comparables.reduce((s, c) => s + c.peRatio, 0) / comparables.length : 0;
  const avgEV = comparables.length > 0 ? comparables.reduce((s, c) => s + c.evEbitda, 0) / comparables.length : 0;
  const avgPS = comparables.length > 0 ? comparables.reduce((s, c) => s + c.psRatio, 0) / comparables.length : 0;
  const avgPB = comparables.length > 0 ? comparables.reduce((s, c) => s + c.pbRatio, 0) / comparables.length : 0;

  r = writeRows(ws6, [
    ['COMPARABLE COMPANIES ANALYSIS'],
    [],
    ['Peer Company Multiples'],
    [],
    ['Company', 'P/E Ratio', 'EV/EBITDA', 'P/S Ratio', 'P/B Ratio'],
    ...comparables.map(c => [c.name, c.peRatio, c.evEbitda, c.psRatio, c.pbRatio] as (string | number)[]),
    [],
    ['Average', avgPE, avgEV, avgPS, avgPB],
  ], r, [undefined, FMT_RATIO, FMT_RATIO, FMT_RATIO, FMT_RATIO]);

  r = writeRows(ws6, [
    [],
    [],
    ['Implied Valuations'],
    [],
    ['Method', 'Comparable Multiple', 'Company Metric ($)', 'Implied Value ($)', 'Per Share ($)', 'Upside (%)'],
    ...compResults.map(cr => {
      const mult = cr.method.includes('P/E') ? avgPE :
        cr.method.includes('EV/EBITDA') ? avgEV :
          cr.method.includes('P/S') ? avgPS : avgPB;
      const metric = cr.method.includes('P/E') ? incomeStatement.netIncome :
        cr.method.includes('EV/EBITDA') ? ebitda :
          cr.method.includes('P/S') ? incomeStatement.revenue : balanceSheet.totalEquity;
      return [cr.method, mult, metric, cr.value, cr.perShare, cr.upside] as (string | number)[];
    }),
  ], r, [undefined, FMT_RATIO, FMT_CURRENCY, FMT_CURRENCY, FMT_CURRENCY, FMT_DEC2]);

  ws6['!cols'] = [{ wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws6, 'Comparable Analysis');

  // ============================================
  // SHEET 7: KEY METRICS
  // ============================================
  const ws7 = newSheet();
  r = 0;
  const grossMargin = incomeStatement.grossProfit / rev;
  const operatingMargin = incomeStatement.operatingIncome / rev;
  const netMargin = incomeStatement.netIncome / rev;
  const ebitdaMargin = ebitda / rev;
  const roe = balanceSheet.totalEquity !== 0 ? incomeStatement.netIncome / balanceSheet.totalEquity : 0;
  const roa = balanceSheet.totalAssets !== 0 ? incomeStatement.netIncome / balanceSheet.totalAssets : 0;
  const currentRatio = balanceSheet.totalCurrentLiabilities !== 0 ? balanceSheet.totalCurrentAssets / balanceSheet.totalCurrentLiabilities : 0;
  const debtToEquity = balanceSheet.totalEquity !== 0 ? totalDebt / balanceSheet.totalEquity : 0;
  const investedCapital = balanceSheet.totalEquity + totalDebt - balanceSheet.cash;
  const roic = investedCapital !== 0 ? (incomeStatement.operatingIncome * (1 - assumptions.taxRate / 100)) / investedCapital : 0;

  r = writeRows(ws7, [
    ['KEY FINANCIAL METRICS'],
    [],
    ['PROFITABILITY METRICS', 'Value', 'Description'],
    ['Gross Margin', grossMargin, 'Gross Profit / Revenue'],
    ['Operating Margin', operatingMargin, 'Operating Income / Revenue'],
    ['Net Margin', netMargin, 'Net Income / Revenue'],
    ['EBITDA Margin', ebitdaMargin, 'EBITDA / Revenue'],
    ['Return on Equity (ROE)', roe, 'Net Income / Equity'],
    ['Return on Assets (ROA)', roa, 'Net Income / Assets'],
    ['ROIC', roic, 'NOPAT / Invested Capital'],
  ], r, [undefined, '0.00%', undefined]);

  r = writeRows(ws7, [
    [],
    ['VALUATION METRICS', 'Value', 'Description'],
    ['P/E Ratio', incomeStatement.netIncome !== 0 ? marketCap / incomeStatement.netIncome : 0, 'Market Cap / Net Income'],
    ['EV/EBITDA', ebitda !== 0 ? ev / ebitda : 0, 'Enterprise Value / EBITDA'],
    ['P/S Ratio', rev !== 0 ? marketCap / rev : 0, 'Market Cap / Revenue'],
    ['P/B Ratio', balanceSheet.totalEquity !== 0 ? marketCap / balanceSheet.totalEquity : 0, 'Market Cap / Book Value'],
    ['EPS', financialData.sharesOutstanding !== 0 ? incomeStatement.netIncome / financialData.sharesOutstanding : 0, 'Net Income / Shares'],
  ], r, [undefined, FMT_RATIO, undefined]);

  // Override EPS format
  setCell(ws7, r - 1, 1, financialData.sharesOutstanding !== 0 ? incomeStatement.netIncome / financialData.sharesOutstanding : 0, FMT_CURRENCY);

  r = writeRows(ws7, [
    [],
    ['FINANCIAL HEALTH', 'Value', 'Description'],
    ['Current Ratio', currentRatio, 'Current Assets / Current Liabilities'],
    ['Debt-to-Equity', debtToEquity, 'Total Debt / Equity'],
    ['Debt-to-EBITDA', ebitda !== 0 ? totalDebt / ebitda : 0, 'Total Debt / EBITDA'],
    ['Interest Coverage', incomeStatement.interestExpense !== 0 ? incomeStatement.operatingIncome / incomeStatement.interestExpense : 0, 'EBIT / Interest Expense'],
    ['FCF Yield', marketCap !== 0 ? cashFlowStatement.freeCashFlow / marketCap : 0, 'FCF / Market Cap'],
  ], r, [undefined, FMT_RATIO, undefined]);

  // Override FCF Yield format
  setCell(ws7, r - 1, 1, marketCap !== 0 ? cashFlowStatement.freeCashFlow / marketCap : 0, '0.00%');

  ws7['!cols'] = [{ wch: 25 }, { wch: 14 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws7, 'Key Metrics');

  // ============================================
  // SHEET 8: HOW TO BUILD THIS APP
  // ============================================
  const guideRows: string[][] = [
    ['HOW TO BUILD WOLF VALUATION ENGINE'],
    ['A Step-by-Step Guide for Beginners'],
    [''],
    ['STEP 1: LEARN THE FUNDAMENTALS'],
    [''],
    ['1. HTML/CSS Basics (2-4 weeks)'],
    ['   - Learn HTML structure and semantic elements'],
    ['   - Understand CSS styling, flexbox, and grid'],
    ['   - Free resources: freeCodeCamp, MDN Web Docs, W3Schools'],
    [''],
    ['2. JavaScript Fundamentals (4-8 weeks)'],
    ['   - Variables, functions, arrays, objects'],
    ['   - DOM manipulation'],
    ['   - Async programming (Promises, async/await)'],
    ['   - Free resources: JavaScript.info, Eloquent JavaScript'],
    [''],
    ['3. React.js (4-6 weeks)'],
    ['   - Components and JSX'],
    ['   - State management with useState'],
    ['   - Props and component communication'],
    ['   - useEffect for side effects'],
    ['   - Free: React official docs, Scrimba React course'],
    [''],
    ['STEP 2: SET UP YOUR DEVELOPMENT ENVIRONMENT'],
    [''],
    ['1. Install Node.js from nodejs.org'],
    ['2. Install VS Code (code editor)'],
    ['3. Create a new project:'],
    ['   npm create vite@latest my-valuation-app -- --template react-ts'],
    ['4. Install Tailwind CSS:'],
    ['   npm install -D tailwindcss postcss autoprefixer'],
    ['5. Install additional packages:'],
    ['   npm install recharts lucide-react xlsx'],
    [''],
    ['STEP 3: PROJECT STRUCTURE'],
    [''],
    ['my-valuation-app/'],
    ['├── src/'],
    ['│   ├── components/     (UI components)'],
    ['│   ├── utils/          (calculation logic)'],
    ['│   ├── types/          (TypeScript types)'],
    ['│   ├── data/           (sample data)'],
    ['│   ├── App.tsx         (main component)'],
    ['│   └── main.tsx        (entry point)'],
    ['├── package.json'],
    ['└── index.html'],
    [''],
    ['STEP 4: BUILD CORE FEATURES'],
    [''],
    ['1. Define TypeScript types for financial data'],
    ['2. Create valuation calculation functions:'],
    ['   - DCF (Discounted Cash Flow)'],
    ['   - Comparable company multiples'],
    ['   - WACC calculation'],
    ['3. Build input forms for financial statements'],
    ['4. Create results display components'],
    ['5. Add charts with Recharts library'],
    ['6. Implement Excel export with xlsx library'],
    [''],
    ['STEP 5: LEARN FINANCIAL CONCEPTS'],
    [''],
    ['Key valuation concepts to understand:'],
    ['- Income Statement, Balance Sheet, Cash Flow'],
    ['- EBITDA and Free Cash Flow'],
    ['- Discounted Cash Flow (DCF) methodology'],
    ['- Comparable company analysis'],
    ['- WACC (Weighted Average Cost of Capital)'],
    ['- Terminal value calculation'],
    [''],
    ['Resources:'],
    ['- Investopedia (free articles)'],
    ['- Aswath Damodaran YouTube channel'],
    ["- \"Investment Valuation\" book by Damodaran"],
    [''],
    ['STEP 6: DEPLOYMENT'],
    [''],
    ['Free hosting options:'],
    ['- Vercel (vercel.com) - easiest for React'],
    ['- Netlify (netlify.com)'],
    ['- GitHub Pages'],
    [''],
    ['Commands to deploy on Vercel:'],
    ['1. npm install -g vercel'],
    ['2. vercel login'],
    ['3. vercel (in project folder)'],
    [''],
    ['RECOMMENDED LEARNING PATH'],
    [''],
    ['Month 1-2: HTML, CSS, JavaScript basics'],
    ['Month 3-4: React.js fundamentals'],
    ['Month 5: TypeScript basics'],
    ['Month 6: Build your first project'],
    ['Month 7+: Add advanced features, learn finance'],
    [''],
    ['HELPFUL TOOLS & LIBRARIES USED'],
    [''],
    ['- React: UI library'],
    ['- TypeScript: Type-safe JavaScript'],
    ['- Tailwind CSS: Utility-first CSS'],
    ['- Recharts: Chart library'],
    ['- Lucide React: Icon library'],
    ['- xlsx: Excel file generation'],
    ['- Vite: Fast build tool'],
    [''],
    ['TIPS FOR SUCCESS'],
    [''],
    ['1. Build projects, not just tutorials'],
    ['2. Read documentation'],
    ['3. Join communities (Discord, Reddit, Twitter)'],
    ['4. Practice consistently (1-2 hours daily)'],
    ["5. Don't be afraid to copy code, then modify"],
    ['6. Debug errors - they teach you the most!'],
  ];

  const guideWs = XLSX.utils.aoa_to_sheet(guideRows);
  guideWs['!cols'] = [{ wch: 70 }];
  XLSX.utils.book_append_sheet(wb, guideWs, 'How To Build This');

  // Generate and download the file
  const fileName = `WOLF_${financialData.ticker}_Report_${new Date().toISOString().split('T')[0]}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
