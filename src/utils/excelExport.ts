import * as XLSX from 'xlsx';
import { FinancialData, ValuationAssumptions, ComparableCompany, DCFProjection, MarketRegion } from '../types/financial';
import { calculateDCF, calculateComparableValuation, calculateEBITDA, calculateEnterpriseValue, calculateWACC } from './valuation';
import { calculateQualityScorecard } from './advancedAnalysis';
import { EGYPTIAN_INDUSTRY_MULTIPLES } from './valuationEngine';
import { SCENARIO_PARAMS as SCENARIO_PARAMS_IMPORT } from './constants/scenarioParams';

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

const FMT_CURRENCY_USD = '$#,##0.00';
const FMT_CURRENCY_EGP = '#,##0.00 "EGP"';

const FMT_RATIO = '0.00"x"';
const FMT_INT = '#,##0';
const FMT_DEC2 = '#,##0.00';
const FMT_DEC4 = '0.0000';

// ─── Main Export Function ──────────────────────────────────────────

export function exportToExcel(data: ExportData): void {
  const { financialData, comparables, marketRegion = 'Egypt' } = data;
  // ── WACC SYNC FIX ─────────────────────────────────────────────────────
  // Recalculate WACC from CAPM inputs and patch assumptions.discountRate
  // so ALL downstream code uses the same single source of truth.
  const syncedWACC = calculateWACC(financialData, data.assumptions);
  const assumptions = { ...data.assumptions, discountRate: syncedWACC };
  const ccy = marketRegion === 'Egypt' ? 'EGP' : 'USD';
  const FMT_CURRENCY = marketRegion === 'Egypt' ? FMT_CURRENCY_EGP : FMT_CURRENCY_USD;
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
    ['Method', `Equity Value (${ccy})`, `Price/Share (${ccy})`, 'Upside/Downside (%)'],
    ['DCF Valuation', dcfValue, dcfPerShare, dcfUpside],
    ...compResults.map(cr => [cr.method, cr.value, cr.perShare, cr.upside] as (string | number)[]),
  ], r, [undefined, FMT_CURRENCY, FMT_CURRENCY, FMT_DEC2]);

  // FIX C3/C4: Calculate comparable value with EGX defaults fallback
  const effectiveComps = comparables.length > 0 ? comparables : [];
  let compsPerShare = 0;
  if (effectiveComps.length > 0) {
    compsPerShare = compResults.reduce((s, cr) => s + cr.perShare, 0) / compResults.length;
  } else if (marketRegion === 'Egypt') {
    // Fallback to EGX Market Average defaults (Fix C3)
    const defaults = EGYPTIAN_INDUSTRY_MULTIPLES['Default'];
    const eps = incomeStatement.netIncome / financialData.sharesOutstanding;
    const ebitdaVal = calculateEBITDA(financialData);
    const peImpl = eps > 0 ? eps * defaults.peRatio : 0;
    const evImpl = ebitdaVal > 0 ? ((ebitdaVal * defaults.evEbitda) - totalDebt + balanceSheet.cash) / financialData.sharesOutstanding : 0;
    const psImpl = incomeStatement.revenue > 0 ? (incomeStatement.revenue / financialData.sharesOutstanding) * defaults.psRatio : 0;
    const pbImpl = balanceSheet.totalEquity > 0 ? (balanceSheet.totalEquity / financialData.sharesOutstanding) * defaults.pbRatio : 0;
    compsPerShare = peImpl * 0.40 + evImpl * 0.35 + psImpl * 0.15 + pbImpl * 0.10;
  }

  // FIX C4: Blended value = 60% DCF + 40% Comps (matching engine logic)
  const blendedValue = compsPerShare > 0 ? dcfPerShare * 0.6 + compsPerShare * 0.4 : dcfPerShare;
  const blendedUpside = ((blendedValue - financialData.currentStockPrice) / financialData.currentStockPrice) * 100;
  // C4 Fix: Unified recommendation with both verdict and action
  let excelVerdict = 'FAIRLY VALUED';
  if (blendedUpside > 10) excelVerdict = 'UNDERVALUED';
  else if (blendedUpside < -10) excelVerdict = 'OVERVALUED';
  let excelRecommendation = 'HOLD';
  if (blendedUpside > 30) excelRecommendation = 'STRONG BUY';
  else if (blendedUpside > 10) excelRecommendation = 'BUY';
  else if (blendedUpside >= -10) excelRecommendation = 'HOLD';
  else if (blendedUpside >= -30) excelRecommendation = 'SELL';
  else excelRecommendation = 'STRONG SELL';

  r = writeRows(ws1, [
    [],
    ['DCF Fair Value (per share):', dcfPerShare],
    ['Comparable Fair Value (per share):', compsPerShare],
    ['Blended Fair Value (60/40):', blendedValue],
    ['Upside / (Downside):', blendedUpside / 100],
    [],
    ['Currency:', ccy],
    ['CAPM Method:', assumptions.capmMethod === 'B' ? 'B \u2014 USD Build-Up' : 'A \u2014 Local Currency'],
    [],
    ['Verdict:', excelVerdict],
    ['Investment Recommendation:', excelRecommendation],
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
    ['', `Amount (${ccy})`, '% of Revenue'],
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
    ['ASSETS', `Amount (${ccy})`],
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
    ['', `Amount (${ccy})`],
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
    ['FCFF Projections — NOPAT + D\u0026A − CapEx − ΔWC'],
    [],
    ['', ...projections.map(p => `Year ${p.year}`)],
  ], r);

  // Full FCFF build-up rows with proper component breakdown
  const fcffLabels: [string, (p: DCFProjection) => number][] = [
    [`Revenue (${ccy})`, p => p.revenue],
    [`EBITDA (${ccy})`, p => p.ebitda],
    [`D\u0026A (${ccy})`, p => p.dAndA],
    [`EBIT (${ccy})`, p => p.ebit],
    [`NOPAT (${ccy})`, p => p.nopat],
    [`CapEx (${ccy})`, p => p.capex],
    [`ΔWC (${ccy})`, p => p.deltaWC],
    [`FCFF (${ccy})`, p => p.freeCashFlow],
    ['Discount Factor', p => p.discountFactor],
    [`PV of FCFF (${ccy})`, p => p.presentValue],
  ];

  for (const [label, getter] of fcffLabels) {
    const fmt = label.includes('Discount Factor') ? FMT_DEC4 : FMT_CURRENCY;
    r = writeRows(ws5, [
      [label, ...projections.map(p => getter(p))],
    ], r, [undefined, ...projections.map(() => fmt)]);
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

  const dcfCols = [{ wch: 22 }];
  for (let i = 0; i < projections.length; i++) dcfCols.push({ wch: 16 });
  ws5['!cols'] = dcfCols;
  XLSX.utils.book_append_sheet(wb, ws5, 'DCF Valuation');

  // ============================================
  // SHEET 6: COMPARABLE COMPANIES
  // ============================================
  const ws6 = newSheet();
  r = 0;

  // FIX C3: Use EGX defaults when no peer comparables are entered
  const egxDefaults = EGYPTIAN_INDUSTRY_MULTIPLES['Default'];
  const avgPE = comparables.length > 0 ? comparables.reduce((s, c) => s + c.peRatio, 0) / comparables.length : egxDefaults.peRatio;
  const avgEV = comparables.length > 0 ? comparables.reduce((s, c) => s + c.evEbitda, 0) / comparables.length : egxDefaults.evEbitda;
  const avgPS = comparables.length > 0 ? comparables.reduce((s, c) => s + c.psRatio, 0) / comparables.length : egxDefaults.psRatio;
  const avgPB = comparables.length > 0 ? comparables.reduce((s, c) => s + c.pbRatio, 0) / comparables.length : egxDefaults.pbRatio;

  r = writeRows(ws6, [
    ['COMPARABLE COMPANIES ANALYSIS'],
    [],
    ['Peer Company Multiples'],
    [],
    ['Company', 'P/E Ratio', 'EV/EBITDA', 'P/S Ratio', 'P/B Ratio'],
    ...comparables.map(c => [c.name, c.peRatio, c.evEbitda, c.psRatio, c.pbRatio] as (string | number)[]),
    ...(comparables.length === 0 ? [['EGX Market Averages (Default)', egxDefaults.peRatio, egxDefaults.evEbitda, egxDefaults.psRatio, egxDefaults.pbRatio] as (string | number)[]] : []),
    [],
    ['Average', avgPE, avgEV, avgPS, avgPB],
  ], r, [undefined, FMT_RATIO, FMT_RATIO, FMT_RATIO, FMT_RATIO]);

  // Calculate implied valuations using weighted comps (40% P/E + 35% EV/EBITDA + 15% P/S + 10% P/B)
  const eps = incomeStatement.netIncome / financialData.sharesOutstanding;
  const peImpliedPrice = eps > 0 ? eps * avgPE : 0;
  const evImpliedEV = ebitda > 0 ? ebitda * avgEV : 0;
  const evImpliedEquity = evImpliedEV - totalDebt + balanceSheet.cash;
  const evImpliedPerShare = evImpliedEquity / financialData.sharesOutstanding;
  const psImpliedPrice = (incomeStatement.revenue / financialData.sharesOutstanding) * avgPS;
  const pbImpliedPrice = (balanceSheet.totalEquity / financialData.sharesOutstanding) * avgPB;
  const weightedCompsPrice = peImpliedPrice * 0.40 + evImpliedPerShare * 0.35 + psImpliedPrice * 0.15 + pbImpliedPrice * 0.10;

  const impliedRows: [string, number, number, number, number, number][] = [
    ['P/E (40%)', avgPE, incomeStatement.netIncome, incomeStatement.netIncome * avgPE, peImpliedPrice, ((peImpliedPrice - financialData.currentStockPrice) / financialData.currentStockPrice) * 100],
    ['EV/EBITDA (35%)', avgEV, ebitda, evImpliedEquity, evImpliedPerShare, ((evImpliedPerShare - financialData.currentStockPrice) / financialData.currentStockPrice) * 100],
    ['P/S (15%)', avgPS, incomeStatement.revenue, incomeStatement.revenue * avgPS, psImpliedPrice, ((psImpliedPrice - financialData.currentStockPrice) / financialData.currentStockPrice) * 100],
    ['P/B (10%)', avgPB, balanceSheet.totalEquity, balanceSheet.totalEquity * avgPB, pbImpliedPrice, ((pbImpliedPrice - financialData.currentStockPrice) / financialData.currentStockPrice) * 100],
  ];

  r = writeRows(ws6, [
    [],
    [],
    ['Implied Valuations (Weighted: 40% P/E + 35% EV/EBITDA + 15% P/S + 10% P/B)'],
    [],
    ['Method (Weight)', 'Multiple', `Company Metric (${ccy})`, `Implied Value (${ccy})`, `Per Share (${ccy})`, 'Upside (%)'],
    ...impliedRows.map(row => row as (string | number)[]),
    [],
    ['Weighted Comps Value', '', '', '', weightedCompsPrice, ((weightedCompsPrice - financialData.currentStockPrice) / financialData.currentStockPrice) * 100],
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
    ['ROIC (NOPAT / Invested Capital)', roic, 'NOPAT / (Equity + Debt − Cash)'],
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
  // SHEET 8: WACC MODEL
  // Full Rf → β → Ke → Kd → WACC build-up
  // ============================================
  const ws8 = newSheet();
  r = 0;

  const costOfDebt = assumptions.costOfDebt || (
    totalDebt > 0
      ? (incomeStatement.interestExpense / totalDebt) * 100
      : assumptions.riskFreeRate + 2
  );
  const afterTaxCostOfDebt = costOfDebt * (1 - assumptions.taxRate / 100);

  // Calculate Ke based on CAPM method
  let keLocal = assumptions.riskFreeRate + assumptions.beta * assumptions.marketRiskPremium;
  let keUSD: number | undefined;
  if (assumptions.capmMethod === 'B') {
    const rfUS = assumptions.rfUS || 4.5;
    const crp = assumptions.countryRiskPremium || 3.5;
    keUSD = rfUS + assumptions.beta * assumptions.marketRiskPremium + crp;
    const egInflation = (assumptions.egyptInflation || 12) / 100;
    const usInflation = (assumptions.usInflation || 2.5) / 100;
    keLocal = ((1 + keUSD / 100) * (1 + egInflation) / (1 + usInflation) - 1) * 100;
  }

  const totalCapital = marketCap + totalDebt;
  const we = totalCapital > 0 ? marketCap / totalCapital : 1;
  const wd = totalCapital > 0 ? totalDebt / totalCapital : 0;
  const calculatedWACC = we * keLocal + wd * afterTaxCostOfDebt;

  r = writeRows(ws8, [
    ['WACC MODEL — Section 3'],
    [],
    ['1. COST OF EQUITY (Ke)'],
    ['CAPM Method', assumptions.capmMethod === 'B' ? 'B — USD Build-Up' : 'A — Local Currency'],
    ['Risk-Free Rate (Rf)', assumptions.riskFreeRate / 100],
    ['Beta (β)', assumptions.beta],
    ['Beta Type', assumptions.betaType || 'Raw'],
    ['Equity Risk Premium (ERP)', assumptions.marketRiskPremium / 100],
  ], r, [undefined, '0.00%']);
  setCell(ws8, r - 3, 1, assumptions.beta, FMT_DEC4);

  if (assumptions.capmMethod === 'B') {
    r = writeRows(ws8, [
      [],
      ['USD Build-Up Details'],
      ['Rf (US Treasury)', (assumptions.rfUS || 4.5) / 100],
      ['Country Risk Premium (CRP)', (assumptions.countryRiskPremium || 3.5) / 100],
      ['Ke (USD)', keUSD !== undefined ? keUSD / 100 : 0],
      ['Egypt Inflation', (assumptions.egyptInflation || 12) / 100],
      ['US Inflation', (assumptions.usInflation || 2.5) / 100],
      ['Ke (EGP, Fisher-adjusted)', keLocal / 100],
    ], r, [undefined, '0.00%']);
  } else {
    r = writeRows(ws8, [
      ['Ke = Rf + β × ERP', keLocal / 100],
    ], r, [undefined, '0.00%']);
  }

  r = writeRows(ws8, [
    [],
    ['2. COST OF DEBT (Kd)'],
    ['Pre-Tax Cost of Debt', costOfDebt / 100],
    ['Tax Rate', assumptions.taxRate / 100],
    ['After-Tax Cost of Debt', afterTaxCostOfDebt / 100],
    [],
    ['3. CAPITAL STRUCTURE (Market Weights)'],
    ['Market Capitalization', marketCap],
    ['Total Debt', totalDebt],
    ['Total Capital (V)', totalCapital],
    ['Equity Weight (We)', we],
    ['Debt Weight (Wd)', wd],
    [],
    ['4. WACC CALCULATION'],
    ['WACC = We × Ke + Wd × Kd(1-t)', calculatedWACC / 100],
    ['User Discount Rate Override', assumptions.discountRate / 100],
  ], r, [undefined, '0.00%']);

  // Override currency cells
  setCell(ws8, r - 9, 1, marketCap, FMT_CURRENCY);
  setCell(ws8, r - 8, 1, totalDebt, FMT_CURRENCY);
  setCell(ws8, r - 7, 1, totalCapital, FMT_CURRENCY);

  ws8['!cols'] = [{ wch: 32 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws8, 'WACC Model');

  // ============================================
  // SHEET 9: FCFF CHECK (3-Method Reconciliation)
  // ============================================
  const ws9 = newSheet();
  r = 0;

  const histEBIT = incomeStatement.operatingIncome;
  const histEBITDA = ebitda;
  const histDnA = incomeStatement.depreciation + incomeStatement.amortization;
  const histCapex = cashFlowStatement.capitalExpenditures;
  const histNetIncome = incomeStatement.netIncome;
  const histInterest = incomeStatement.interestExpense;
  const taxRateDec = assumptions.taxRate / 100;

  // Method 1: NOPAT Route — EBIT(1-t) + D&A − CapEx − ΔWC
  const nopat = histEBIT * (1 - taxRateDec);
  // ΔWC approximation from cash flow: OCF − Net Income − D&A (simplified)
  const approxDeltaWC = -(cashFlowStatement.operatingCashFlow - histNetIncome - histDnA);
  const fcffM1 = nopat + histDnA - histCapex - approxDeltaWC;

  // Method 2: EBITDA Route — EBITDA(1-t) + D&A×t − CapEx − ΔWC
  const fcffM2 = histEBITDA * (1 - taxRateDec) + histDnA * taxRateDec - histCapex - approxDeltaWC;

  // Method 3: Net Income Route — NI + Interest(1-t) + D&A − CapEx − ΔWC
  const fcffM3 = histNetIncome + histInterest * (1 - taxRateDec) + histDnA - histCapex - approxDeltaWC;

  const allMatch = Math.abs(fcffM1 - fcffM2) < 0.01 && Math.abs(fcffM1 - fcffM3) < 0.01;

  r = writeRows(ws9, [
    ['FCFF THREE-WAY RECONCILIATION — Section 4'],
    [],
    ['Base Year Financial Data'],
    ['EBIT', histEBIT],
    ['EBITDA', histEBITDA],
    ['D\u0026A', histDnA],
    ['Net Income', histNetIncome],
    ['Interest Expense', histInterest],
    ['Tax Rate', assumptions.taxRate / 100],
    ['CapEx', histCapex],
    ['ΔWC (approx)', approxDeltaWC],
    [],
    ['Method 1 — NOPAT Route'],
    ['NOPAT = EBIT × (1−t)', nopat],
    ['+ D\u0026A', histDnA],
    ['− CapEx', -histCapex],
    ['− ΔWC', -approxDeltaWC],
    ['FCFF (Method 1)', fcffM1],
    [],
    ['Method 2 — EBITDA Route'],
    ['EBITDA × (1−t)', histEBITDA * (1 - taxRateDec)],
    ['+ D\u0026A × t (tax shield)', histDnA * taxRateDec],
    ['− CapEx', -histCapex],
    ['− ΔWC', -approxDeltaWC],
    ['FCFF (Method 2)', fcffM2],
    [],
    ['Method 3 — Net Income Route'],
    ['Net Income', histNetIncome],
    ['+ Interest × (1−t)', histInterest * (1 - taxRateDec)],
    ['+ D\u0026A', histDnA],
    ['− CapEx', -histCapex],
    ['− ΔWC', -approxDeltaWC],
    ['FCFF (Method 3)', fcffM3],
    [],
    ['Reconciliation Status', allMatch ? '✓ ALL METHODS MATCH' : '⚠ METHODS DIVERGE — check ΔWC assumptions'],
    ['Max Difference', Math.max(Math.abs(fcffM1 - fcffM2), Math.abs(fcffM1 - fcffM3), Math.abs(fcffM2 - fcffM3))],
  ], r, [undefined, FMT_CURRENCY]);
  setCell(ws9, 8, 1, assumptions.taxRate / 100, '0.00%');

  ws9['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws9, 'FCFF Check');

  // ============================================
  // SHEET 10: DDM (Dividend Discount Models)
  // ============================================
  const ws10 = newSheet();
  r = 0;

  const dps = financialData.dividendsPerShare || 0;
  const ke = keLocal / 100; // decimal
  const gStable = (assumptions.ddmStableGrowth || assumptions.terminalGrowthRate) / 100;
  const gHigh = (assumptions.ddmHighGrowth || assumptions.revenueGrowthRate) / 100;
  const highPhaseYrs = assumptions.ddmHighGrowthYears || 5;

  // Gordon Growth: P = DPS × (1+g) / (Ke − g)
  let gordonValue: number | null = null;
  if (dps > 0 && ke > gStable) {
    gordonValue = (dps * (1 + gStable)) / (ke - gStable);
  }

  // Two-Stage DDM
  let twoStageValue: number | null = null;
  if (dps > 0 && ke > gStable) {
    let pv = 0;
    let dividend = dps;
    for (let yr = 1; yr <= highPhaseYrs; yr++) {
      dividend *= (1 + gHigh);
      pv += dividend / Math.pow(1 + ke, yr);
    }
    const termDiv = dividend * (1 + gStable);
    const termValue = termDiv / (ke - gStable);
    pv += termValue / Math.pow(1 + ke, highPhaseYrs);
    twoStageValue = pv;
  }

  // H-Model: P = DPS × [(1+g_long) + H × (g_high − g_long)] / (Ke − g_long)
  let hModelValue: number | null = null;
  if (dps > 0 && ke > gStable) {
    const H = highPhaseYrs / 2;
    hModelValue = (dps * ((1 + gStable) + H * (gHigh - gStable))) / (ke - gStable);
  }

  r = writeRows(ws10, [
    ['DIVIDEND DISCOUNT MODELS — Section 6'],
    [],
    ['Inputs'],
    ['DPS (Current)', dps],
    ['Cost of Equity (Ke)', ke],
    ['Stable Growth Rate', gStable],
    ['High Growth Rate', gHigh],
    ['High Growth Phase (years)', highPhaseYrs],
    [],
    ['⚠ DDM discounts at Ke (NOT WACC) — equity cash flows'],
    [],
    ['1. Gordon Growth Model'],
    ['Formula', 'P = DPS₁ / (Ke − g)'],
    ['DPS₁ = DPS × (1+g)', dps * (1 + gStable)],
    ['Intrinsic Value', gordonValue !== null ? gordonValue : 'N/A — No dividends or Ke ≤ g'],
    [],
    ['2. Two-Stage DDM'],
    ['High Growth Phase', `${highPhaseYrs} years at ${(gHigh * 100).toFixed(1)}%`],
    ['Stable Phase', `Perpetuity at ${(gStable * 100).toFixed(1)}%`],
    ['Intrinsic Value', twoStageValue !== null ? twoStageValue : 'N/A'],
    [],
    ['3. H-Model'],
    ['Formula', 'P = DPS × [(1+g_l) + H×(g_h−g_l)] / (Ke − g_l)'],
    ['Half-Life (H)', highPhaseYrs / 2],
    ['Intrinsic Value', hModelValue !== null ? hModelValue : 'N/A'],
    [],
    ['Summary'],
    ['Current Stock Price', financialData.currentStockPrice],
  ], r, [undefined, FMT_CURRENCY]);

  // Override % cells
  setCell(ws10, 4, 1, ke, '0.00%');
  setCell(ws10, 5, 1, gStable, '0.00%');
  setCell(ws10, 6, 1, gHigh, '0.00%');
  setCell(ws10, 7, 1, highPhaseYrs, FMT_INT);

  ws10['!cols'] = [{ wch: 30 }, { wch: 24 }];
  XLSX.utils.book_append_sheet(wb, ws10, 'DDM');

  // ============================================
  // SHEET 11: SENSITIVITY ANALYSIS
  // Egyptian ranges: g = Base±3% (1% steps), WACC = Base±3% (1% steps)
  // ============================================
  const ws11 = newSheet();
  r = 0;

  const baseWACC = assumptions.discountRate;
  const baseG = assumptions.terminalGrowthRate;

  // Build WACC axis (7 values: base ± 3%)
  const waccAxis: number[] = [];
  for (let i = -3; i <= 3; i++) {
    waccAxis.push(Math.max(baseWACC + i, 1)); // floor at 1%
  }

  // FIX C6: Build growth axis centered on terminal growth ± 3%
  // Floor at 5% (Egypt minimum reasonable), ceiling at WACC − 1%
  const gAxis: number[] = [];
  for (let i = -3; i <= 3; i++) {
    const g = baseG + i;
    gAxis.push(Math.max(5, Math.min(baseWACC - 1, g)));
  }

  r = writeRows(ws11, [
    ['SENSITIVITY ANALYSIS — Section 5.6'],
    ['Implied Share Price at Various WACC / Terminal Growth Combinations'],
    [],
    [`WACC \\ Terminal g`, ...gAxis.map(g => `g=${g.toFixed(1)}%`)],
  ], r);

  // Calculate sensitivity matrix
  for (const waccVal of waccAxis) {
    const row: (string | number)[] = [`WACC=${waccVal.toFixed(1)}%`];
    for (const gVal of gAxis) {
      if (gVal >= waccVal) {
        row.push('N/A' as any);
      } else {
        // Quick DCF recalc for this WACC/g combo
        const tempAssumptions = { ...assumptions, discountRate: waccVal, terminalGrowthRate: gVal };
        const { value } = calculateDCF(financialData, tempAssumptions);
        row.push(value / financialData.sharesOutstanding);
      }
    }
    r = writeRows(ws11, [row], r, [undefined, ...gAxis.map(() => FMT_CURRENCY)]);
  }

  r = writeRows(ws11, [
    [],
    ['Base Case', `WACC=${baseWACC.toFixed(1)}%, g=${baseG.toFixed(1)}%`],
    ['Current Price', financialData.currentStockPrice],
    [],
    ['Color Key:'],
    ['Green = >10% upside, Yellow = ±10%, Red = >10% downside'],
    ['N/A = Terminal growth ≥ WACC (mathematically invalid)'],
  ], r, [undefined, FMT_CURRENCY]);

  ws11['!cols'] = [{ wch: 16 }, ...gAxis.map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, ws11, 'Sensitivity');

  // ============================================
  // SHEET 12: SCENARIO ANALYSIS
  // Bull / Base / Bear + probability weights
  // ============================================
  const ws12 = newSheet();
  r = 0;

  // C1 Fix: Use shared SCENARIO_PARAMS for consistency across Engine/PDF/Excel
  const SP = SCENARIO_PARAMS_IMPORT;

  // Calculate scenarios using shared function from dcf.ts
  const scenarioCalcShared = (scenario: 'bear' | 'base' | 'bull') => {
    const p = SP[scenario];
    const sa = {
      ...assumptions,
      revenueGrowthRate: assumptions.revenueGrowthRate * p.revenueGrowthMultiplier,
      discountRate: Math.max(2, assumptions.discountRate + p.waccAdjustmentPP),
      terminalGrowthRate: Math.min(
        assumptions.terminalGrowthRate * p.terminalGrowthMultiplier,
        Math.max(2, assumptions.discountRate + p.waccAdjustmentPP) - 1
      ),
    };
    // Per-year margin adjustment via custom projection
    if (p.marginAdjPerYear !== 0) {
      let rev = financialData.incomeStatement.revenue;
      let sumPV = 0, lastFCF = 0;
      const taxR = sa.taxRate / 100;
      const w = sa.discountRate / 100;
      for (let yr = 1; yr <= sa.projectionYears; yr++) {
        const prevRev = rev;
        rev *= (1 + sa.revenueGrowthRate / 100);
        const adjMargin = sa.ebitdaMargin + (p.marginAdjPerYear * 100 * yr);
        const ebitda = rev * (adjMargin / 100);
        const da = rev * (sa.daPercent / 100);
        const nopat = (ebitda - da) * (1 - taxR);
        const capex = rev * (sa.capexPercent / 100);
        const dwc = (rev - prevRev) * (sa.deltaWCPercent / 100);
        const fcf = nopat + da - capex - dwc;
        sumPV += fcf / Math.pow(1 + w, yr);
        lastFCF = fcf;
      }
      const tg = sa.terminalGrowthRate / 100;
      const tv = w > tg ? (lastFCF * (1 + tg)) / (w - tg) : lastFCF * 12;
      const ev = sumPV + tv / Math.pow(1 + w, sa.projectionYears);
      const totalDebt = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
      const equity = ev - totalDebt + financialData.balanceSheet.cash;
      return equity / financialData.sharesOutstanding;
    }
    const { value } = calculateDCF(financialData, sa);
    return value / financialData.sharesOutstanding;
  };

  const bearRevGrowth = assumptions.revenueGrowthRate * SP.bear.revenueGrowthMultiplier;
  const bearWACC = Math.max(2, assumptions.discountRate + SP.bear.waccAdjustmentPP);
  const bearTermG = Math.min(assumptions.terminalGrowthRate * SP.bear.terminalGrowthMultiplier, bearWACC - 1);
  const bearMargin = assumptions.ebitdaMargin; // margin adjusted per-year inside calc

  const baseRevGrowth = assumptions.revenueGrowthRate;
  const baseWACCVal = assumptions.discountRate;
  const baseTermG = assumptions.terminalGrowthRate;
  const baseMargin = assumptions.ebitdaMargin;

  const bullRevGrowth = assumptions.revenueGrowthRate * SP.bull.revenueGrowthMultiplier;
  const bullWACC = Math.max(2, assumptions.discountRate + SP.bull.waccAdjustmentPP);
  const bullTermG = Math.min(assumptions.terminalGrowthRate * SP.bull.terminalGrowthMultiplier, bullWACC - 1);
  const bullMargin = assumptions.ebitdaMargin; // margin adjusted per-year inside calc

  const bearPrice = scenarioCalcShared('bear');
  const basePrice = scenarioCalcShared('base');
  const bullPrice = scenarioCalcShared('bull');

  const bearProb = assumptions.bearProbability || 25;
  const baseProb = assumptions.baseProbability || 50;
  const bullProb = assumptions.bullProbability || 25;
  const weightedPrice = (bearPrice * bearProb + basePrice * baseProb + bullPrice * bullProb) / 100;

  // M2: Add vs Current % column
  const bearVsCurrent = financialData.currentStockPrice > 0 ? (bearPrice - financialData.currentStockPrice) / financialData.currentStockPrice : 0;
  const baseVsCurrent = financialData.currentStockPrice > 0 ? (basePrice - financialData.currentStockPrice) / financialData.currentStockPrice : 0;
  const bullVsCurrent = financialData.currentStockPrice > 0 ? (bullPrice - financialData.currentStockPrice) / financialData.currentStockPrice : 0;

  r = writeRows(ws12, [
    ['SCENARIO ANALYSIS — Section 5.5'],
    [],
    ['', 'Bear', 'Base', 'Bull'],
    ['Revenue Growth', bearRevGrowth / 100, baseRevGrowth / 100, bullRevGrowth / 100],
    ['EBITDA Margin', bearMargin / 100, baseMargin / 100, bullMargin / 100],
    ['Terminal Growth', bearTermG / 100, baseTermG / 100, bullTermG / 100],
    ['WACC', bearWACC / 100, baseWACCVal / 100, bullWACC / 100],
    [],
    ['Implied Share Price', bearPrice, basePrice, bullPrice],
    ['vs Current (%)', bearVsCurrent, baseVsCurrent, bullVsCurrent],
    ['Probability Weight', bearProb / 100, baseProb / 100, bullProb / 100],
    [],
    ['Probability-Weighted Value', weightedPrice],
    ['Current Stock Price', financialData.currentStockPrice],
    ['Weighted Upside (% vs Current)', financialData.currentStockPrice > 0 ? (weightedPrice - financialData.currentStockPrice) / financialData.currentStockPrice : 0],
  ], r, [undefined, '0.00%', '0.00%', '0.00%']);

  // Override price/value cells to currency
  setCell(ws12, r - 7, 1, bearPrice, FMT_CURRENCY);
  setCell(ws12, r - 7, 2, basePrice, FMT_CURRENCY);
  setCell(ws12, r - 7, 3, bullPrice, FMT_CURRENCY);
  setCell(ws12, r - 3, 1, weightedPrice, FMT_CURRENCY);
  setCell(ws12, r - 2, 1, financialData.currentStockPrice, FMT_CURRENCY);
  setCell(ws12, r - 1, 1, financialData.currentStockPrice > 0 ? (weightedPrice - financialData.currentStockPrice) / financialData.currentStockPrice : 0, '0.00%');

  ws12['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws12, 'Scenarios');

  // ============================================
  // SHEET 9: WACC BUILD-UP
  // ============================================
  const wsWACC = newSheet();
  const keVal = assumptions.riskFreeRate + assumptions.beta * assumptions.marketRiskPremium;
  const kdAT = assumptions.costOfDebt * (1 - assumptions.taxRate / 100);
  const totalDebtWACC = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
  const mkCapWACC = financialData.currentStockPrice * financialData.sharesOutstanding;
  const totalCapWACC = mkCapWACC + totalDebtWACC;
  const weWACC = totalCapWACC > 0 ? mkCapWACC / totalCapWACC : 1;
  const wdWACC = totalCapWACC > 0 ? totalDebtWACC / totalCapWACC : 0;
  const waccFinal = weWACC * keVal + wdWACC * kdAT;

  let rW = writeRows(wsWACC, [
    ['WACC BUILD-UP'],
    [''],
    ['Cost of Equity (Ke)', null],
    ['Risk-Free Rate', assumptions.riskFreeRate],
    ['Beta', assumptions.beta],
    ['Equity Risk Premium', assumptions.marketRiskPremium],
    ['Ke = Rf + β × ERP', keVal],
    [''],
    ['Cost of Debt'],
    ['Pre-Tax Kd', assumptions.costOfDebt],
    ['Tax Rate', assumptions.taxRate],
    ['After-Tax Kd', kdAT],
    [''],
    ['Capital Structure'],
    ['Market Cap', mkCapWACC],
    ['Total Debt', totalDebtWACC],
    ['Equity Weight (We)', weWACC],
    ['Debt Weight (Wd)', wdWACC],
    [''],
    ['WACC = We×Ke + Wd×Kd(AT)', waccFinal],
  ], 0, [undefined, '0.00%']);

  wsWACC['!cols'] = [{ wch: 30 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsWACC, 'WACC Build-Up');

  // ============================================
  // SHEET 10: FCFF RECONCILIATION
  // ============================================
  const wsFCFF = newSheet();
  const isXL = financialData.incomeStatement;
  const cfXL = financialData.cashFlowStatement;
  const nopatXL = isXL.operatingIncome * (1 - assumptions.taxRate / 100);
  const daXL = isXL.depreciation + isXL.amortization;
  const capexXL = Math.abs(cfXL.capitalExpenditures);
  const fcff1 = nopatXL + daXL - capexXL;
  const fcff2 = cfXL.operatingCashFlow + isXL.interestExpense * (1 - assumptions.taxRate / 100) - capexXL;

  writeRows(wsFCFF, [
    ['FCFF RECONCILIATION'],
    [''],
    ['Method 1: From NOPAT'],
    ['EBIT', isXL.operatingIncome],
    ['× (1 − Tax Rate)', 1 - assumptions.taxRate / 100],
    ['= NOPAT', nopatXL],
    ['+ D&A', daXL],
    ['− CapEx', -capexXL],
    ['= FCFF (Method 1)', fcff1],
    [''],
    ['Method 2: From Operating CF'],
    ['Operating Cash Flow', cfXL.operatingCashFlow],
    ['+ Interest × (1-t)', isXL.interestExpense * (1 - assumptions.taxRate / 100)],
    ['− CapEx', -capexXL],
    ['= FCFF (Method 2)', fcff2],
    [''],
    ['Reconciliation Difference', fcff1 - fcff2],
  ], 0, [undefined, FMT_INT]);

  wsFCFF['!cols'] = [{ wch: 28 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsFCFF, 'FCFF Reconciliation');

  // ============================================
  // SHEET 11: WORKING CAPITAL
  // ============================================
  const wsWC = newSheet();
  const bsXL = financialData.balanceSheet;
  const revXL = isXL.revenue || 1;
  const cogsXL = isXL.costOfGoodsSold || 1;
  const dso = bsXL.accountsReceivable > 0 ? 365 / (revXL / bsXL.accountsReceivable) : 0;
  const dio = bsXL.inventory > 0 ? 365 / (cogsXL / bsXL.inventory) : 0;
  const dpo = bsXL.accountsPayable > 0 ? 365 / (cogsXL / bsXL.accountsPayable) : 0;
  const ccc = dso + dio - dpo;

  writeRows(wsWC, [
    ['WORKING CAPITAL ANALYSIS'],
    [''],
    ['Current Assets', bsXL.totalCurrentAssets],
    ['Cash', bsXL.cash],
    ['Accounts Receivable', bsXL.accountsReceivable],
    ['Inventory', bsXL.inventory],
    [''],
    ['Current Liabilities', bsXL.totalCurrentLiabilities],
    ['Accounts Payable', bsXL.accountsPayable],
    ['Short-term Debt', bsXL.shortTermDebt],
    [''],
    ['Working Capital', bsXL.totalCurrentAssets - bsXL.totalCurrentLiabilities],
    ['Net Working Capital (ex-cash)', bsXL.totalCurrentAssets - bsXL.cash - bsXL.totalCurrentLiabilities + bsXL.shortTermDebt],
    [''],
    ['Cash Conversion Cycle'],
    ['DSO (Days Sales Outstanding)', dso],
    ['DIO (Days Inventory Outstanding)', dio],
    ['DPO (Days Payable Outstanding)', dpo],
    ['CCC = DSO + DIO − DPO', ccc],
  ], 0, [undefined, FMT_INT]);

  wsWC['!cols'] = [{ wch: 35 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsWC, 'Working Capital');

  // ============================================
  // SHEET 12: EVA ANALYSIS
  // ============================================
  const wsEVA = newSheet();
  const icXL = bsXL.totalEquity + totalDebtWACC - bsXL.cash;
  const roicXL = icXL > 0 ? (nopatXL / icXL) * 100 : 0;
  const spreadXL = roicXL - waccFinal;
  const evaXL = (spreadXL / 100) * icXL;
  const spreadVerdict = spreadXL > 2 ? 'VALUE CREATING' : spreadXL > 0 ? 'NEUTRAL' : 'VALUE DESTROYING';

  writeRows(wsEVA, [
    ['ECONOMIC VALUE ADDED (EVA)'],
    [''],
    ['Invested Capital = Equity + Debt − Cash', icXL],
    ['NOPAT = EBIT × (1 − Tax)', nopatXL],
    ['ROIC = NOPAT / IC', roicXL],
    ['WACC', waccFinal],
    [''],
    ['ROIC − WACC Spread', spreadXL],
    ['EVA = Spread × IC', evaXL],
    [''],
    ['Assessment', spreadVerdict],
  ], 0, [undefined, FMT_INT]);

  wsEVA['!cols'] = [{ wch: 38 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, wsEVA, 'EVA Analysis');

  // ============================================
  // SHEET 13: HOW TO BUILD THIS APP
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
