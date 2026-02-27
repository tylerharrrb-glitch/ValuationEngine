import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinancialData, ValuationAssumptions, ComparableCompany, DCFProjection, MarketRegion } from '../types/financial';
import { formatNumber, formatPercent, formatCurrency, CurrencyCode } from './formatters';
import { calculateWACC } from './valuation';
import { SCENARIO_PARAMS } from './constants/scenarioParams';
import { calcScenarioPrice } from './calculations/scenarios';
import { calculateQualityScorecard, calculateReverseDCF } from './advancedAnalysis';

interface PDFExportParams {
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  comparables: ComparableCompany[];
  dcfProjections: DCFProjection[];
  dcfValue: number;
  comparableValue: number;
  scenario: 'bear' | 'base' | 'bull';
  lastReportedDate?: string;
  marketRegion?: MarketRegion;
}

export const exportToPDF = ({
  financialData,
  assumptions,
  comparables,
  dcfProjections,
  dcfValue,
  comparableValue,
  scenario,
  lastReportedDate,
  marketRegion = 'Egypt',
}: PDFExportParams): void => {
  const doc = new jsPDF();
  const ccy: CurrencyCode = marketRegion === 'Egypt' ? 'EGP' : 'USD';
  const fmtCcy = (v: number, d: number = 0) => formatCurrency(v, d, ccy);
  const pageWidth = doc.internal.pageSize.getWidth();

  // Colors
  const redColor: [number, number, number] = [220, 38, 38];
  const darkColor: [number, number, number] = [24, 24, 27];
  const grayColor: [number, number, number] = [113, 113, 122];

  let yPos = 20;

  // Helper function to add page if needed
  const checkNewPage = (requiredSpace: number = 30) => {
    if (yPos > 270 - requiredSpace) {
      doc.addPage();
      yPos = 20;
    }
  };

  // Header
  doc.setFillColor(...darkColor);
  doc.rect(0, 0, pageWidth, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('WOLF', 15, 22);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Valuation Engine', 15, 29);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`${financialData.companyName} (${financialData.ticker})`, pageWidth - 15, 22, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const scenarioLabels = { bear: 'Bear Case', base: 'Base Case', bull: 'Bull Case' };
  doc.text(`${scenarioLabels[scenario]} Analysis`, pageWidth - 15, 29, { align: 'right' });

  yPos = 45;

  // Executive Summary
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('EXECUTIVE SUMMARY', 15, yPos);
  yPos += 10;

  const blendedValue = dcfValue * 0.6 + comparableValue * 0.4;
  const currentPrice = financialData.currentStockPrice;
  const upside = ((blendedValue - currentPrice) / currentPrice) * 100;

  // Section 7 verdict: ±10% bands
  let recommendation = '';
  if (upside > 10) recommendation = 'BUY';
  else if (upside >= -10) recommendation = 'HOLD';
  else recommendation = 'SELL';

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Currency', ccy],
      ['CAPM Method', assumptions.capmMethod === 'B' ? 'B — USD Build-Up' : 'A — Local Currency'],
      ['Current Price', fmtCcy(currentPrice, 2)],
      ['DCF Fair Value', fmtCcy(dcfValue, 2)],
      ['Comparable Fair Value', fmtCcy(comparableValue, 2)],
      ['Blended Fair Value (60/40)', fmtCcy(blendedValue, 2)],
      ['Upside / (Downside)', `${upside >= 0 ? '+' : ''}${formatPercent(upside)}`],
      ['Recommendation', recommendation],
    ],
    theme: 'striped',
    headStyles: { fillColor: redColor, textColor: [255, 255, 255] },
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage();

  // Income Statement
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('INCOME STATEMENT', 15, yPos);
  yPos += 10;

  const { incomeStatement } = financialData;
  const grossMargin = ((incomeStatement.revenue - incomeStatement.costOfGoodsSold) / incomeStatement.revenue) * 100;
  const opMargin = (incomeStatement.operatingIncome / incomeStatement.revenue) * 100;
  const netMargin = (incomeStatement.netIncome / incomeStatement.revenue) * 100;

  autoTable(doc, {
    startY: yPos,
    head: [['Item', 'Amount', 'Margin']],
    body: [
      ['Revenue', formatNumber(incomeStatement.revenue), '100.00%'],
      ...(incomeStatement.costOfGoodsSold !== 0 ? [['Cost of Goods Sold', `(${formatNumber(incomeStatement.costOfGoodsSold)})`, '']] : []),
      ['Gross Profit', formatNumber(incomeStatement.grossProfit), formatPercent(grossMargin)],
      ...(incomeStatement.operatingExpenses !== 0 ? [['Operating Expenses', `(${formatNumber(incomeStatement.operatingExpenses)})`, '']] : []),
      ['Operating Income', formatNumber(incomeStatement.operatingIncome), formatPercent(opMargin)],
      ...(incomeStatement.interestExpense !== 0 ? [['Interest Expense', `(${formatNumber(incomeStatement.interestExpense)})`, '']] : []),
      ...(incomeStatement.taxExpense !== 0 ? [['Tax Expense', `(${formatNumber(incomeStatement.taxExpense)})`, '']] : []),
      ['Net Income', formatNumber(incomeStatement.netIncome), formatPercent(netMargin)],
    ],
    theme: 'striped',
    headStyles: { fillColor: redColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'right' } },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage(80);

  // Balance Sheet - COMPLETE with all line items
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('BALANCE SHEET', 15, yPos);
  yPos += 10;

  const { balanceSheet } = financialData;

  // Helper: only include a balance sheet row if value is non-zero
  const bsRow = (label: string, value: number): [string, string][] =>
    value !== 0 ? [[label, formatNumber(value)]] : [];

  // Assets table — zero-value rows are filtered out
  autoTable(doc, {
    startY: yPos,
    head: [['Assets', 'Amount']],
    body: [
      // Current Assets
      [{ content: 'CURRENT ASSETS', styles: { fontStyle: 'bold', fillColor: [39, 39, 42] as [number, number, number], textColor: [248, 113, 113] as [number, number, number] } }, ''],
      ...bsRow('Cash & Cash Equivalents', balanceSheet.cash),
      ...bsRow('Marketable Securities', balanceSheet.marketableSecurities),
      ...bsRow('Accounts Receivable', balanceSheet.accountsReceivable),
      ...bsRow('Inventory', balanceSheet.inventory),
      ...bsRow('Other Current Assets', balanceSheet.otherCurrentAssets),
      [{ content: 'Total Current Assets', styles: { fontStyle: 'bold' } }, { content: formatNumber(balanceSheet.totalCurrentAssets), styles: { fontStyle: 'bold' } }],
      // Non-Current Assets
      [{ content: 'NON-CURRENT ASSETS', styles: { fontStyle: 'bold', fillColor: [39, 39, 42] as [number, number, number], textColor: [251, 146, 60] as [number, number, number] } }, ''],
      ...bsRow('PP&E (Net)', balanceSheet.propertyPlantEquipment),
      ...bsRow('Long-term Investments', balanceSheet.longTermInvestments),
      ...bsRow('Goodwill', balanceSheet.goodwill),
      ...bsRow('Intangible Assets', balanceSheet.intangibleAssets),
      ...bsRow('Other Non-Current Assets', balanceSheet.otherNonCurrentAssets),
      [{ content: 'TOTAL ASSETS', styles: { fontStyle: 'bold' } }, { content: formatNumber(balanceSheet.totalAssets), styles: { fontStyle: 'bold' } }],
    ],
    theme: 'striped',
    headStyles: { fillColor: redColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 100 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 5;
  checkNewPage(60);

  // Liabilities & Equity table — zero-value rows filtered
  autoTable(doc, {
    startY: yPos,
    head: [['Liabilities & Equity', 'Amount']],
    body: [
      // Current Liabilities
      [{ content: 'CURRENT LIABILITIES', styles: { fontStyle: 'bold', fillColor: [39, 39, 42] as [number, number, number], textColor: [250, 204, 21] as [number, number, number] } }, ''],
      ...bsRow('Accounts Payable', balanceSheet.accountsPayable),
      ...bsRow('Short-Term Debt', balanceSheet.shortTermDebt),
      ...bsRow('Other Current Liabilities', balanceSheet.otherCurrentLiabilities),
      [{ content: 'Total Current Liabilities', styles: { fontStyle: 'bold' } }, { content: formatNumber(balanceSheet.totalCurrentLiabilities), styles: { fontStyle: 'bold' } }],
      // Non-Current Liabilities
      [{ content: 'NON-CURRENT LIABILITIES', styles: { fontStyle: 'bold', fillColor: [39, 39, 42] as [number, number, number], textColor: [250, 204, 21] as [number, number, number] } }, ''],
      ...bsRow('Long-Term Debt', balanceSheet.longTermDebt),
      ...bsRow('Other Non-Current Liabilities', balanceSheet.otherNonCurrentLiabilities),
      [{ content: 'TOTAL LIABILITIES', styles: { fontStyle: 'bold' } }, { content: formatNumber(balanceSheet.totalLiabilities), styles: { fontStyle: 'bold' } }],
      // Equity
      [{ content: 'EQUITY', styles: { fontStyle: 'bold', fillColor: [39, 39, 42] as [number, number, number], textColor: [74, 222, 128] as [number, number, number] } }, ''],
      [{ content: 'Total Shareholders\' Equity', styles: { fontStyle: 'bold' } }, { content: formatNumber(balanceSheet.totalEquity), styles: { fontStyle: 'bold' } }],
      [{ content: 'TOTAL LIABILITIES + EQUITY', styles: { fontStyle: 'bold' } }, { content: formatNumber(balanceSheet.totalLiabilities + balanceSheet.totalEquity), styles: { fontStyle: 'bold' } }],
    ],
    theme: 'striped',
    headStyles: { fillColor: redColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 100 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 5;

  // Balance Sheet Footnote
  doc.setFontSize(7);
  doc.setTextColor(...grayColor);
  doc.text(
    'Note: Cash & Equivalents represents highly liquid assets only. Marketable Securities (short-term investments) are shown separately per EAS / IFRS standards.',
    15, yPos + 3
  );

  yPos += 15;
  checkNewPage();

  // Cash Flow Statement
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CASH FLOW STATEMENT', 15, yPos);
  yPos += 10;

  const { cashFlowStatement } = financialData;

  autoTable(doc, {
    startY: yPos,
    head: [['Item', 'Amount']],
    body: [
      ['Operating Cash Flow', formatNumber(cashFlowStatement.operatingCashFlow)],
      ['Capital Expenditures', `(${formatNumber(cashFlowStatement.capitalExpenditures)})`],
      [{ content: 'Free Cash Flow', styles: { fontStyle: 'bold' } }, { content: formatNumber(cashFlowStatement.freeCashFlow), styles: { fontStyle: 'bold' } }],
      ['Dividends Paid', `(${formatNumber(cashFlowStatement.dividendsPaid)})`],
      ['Net Change in Cash', formatNumber(cashFlowStatement.netChangeInCash)],
    ],
    theme: 'striped',
    headStyles: { fillColor: redColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 100 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage();

  // DCF Projections
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DCF PROJECTIONS', 15, yPos);
  yPos += 10;

  // Derive base year from last reported date, or from financialData, or fall back to current year - 1
  const baseYear = (() => {
    const dateStr = lastReportedDate || financialData.lastReportedDate;
    if (dateStr) {
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) return parsed.getFullYear();
    }
    // Fall back: assume data is from the last completed fiscal year
    return new Date().getFullYear() - 1;
  })();
  const projectionHeaders = ['Metric', ...dcfProjections.map((_, i) => `${baseYear + i + 1}`)];

  autoTable(doc, {
    startY: yPos,
    head: [projectionHeaders],
    body: [
      ['Revenue', ...dcfProjections.map(p => formatNumber(p.revenue))],
      ['EBITDA', ...dcfProjections.map(p => formatNumber(p.ebitda))],
      ['D\u0026A', ...dcfProjections.map(p => formatNumber(p.dAndA))],
      ['EBIT', ...dcfProjections.map(p => formatNumber(p.ebit))],
      ['NOPAT', ...dcfProjections.map(p => formatNumber(p.nopat))],
      ['CapEx', ...dcfProjections.map(p => formatNumber(p.capex))],
      ['Change in WC', ...dcfProjections.map(p => formatNumber(p.deltaWC))],
      ['FCFF', ...dcfProjections.map(p => formatNumber(p.freeCashFlow))],
      ['Discount Factor', ...dcfProjections.map(p => p.discountFactor.toFixed(3))],
      ['PV of FCFF', ...dcfProjections.map(p => formatNumber(p.presentValue))],
    ],
    theme: 'striped',
    headStyles: { fillColor: redColor, textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // FIX S6: Terminal Value and EV-to-Equity Bridge Breakdown
  const totalDebtForBridge = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const sumPV = dcfProjections.reduce((s, p) => s + p.presentValue, 0);
  const lastFCFF = dcfProjections[dcfProjections.length - 1]?.freeCashFlow || 0;
  const waccDec = assumptions.discountRate / 100;
  const termGrowthDec = assumptions.terminalGrowthRate / 100;
  let tvGordon = 0;
  if (waccDec > termGrowthDec) {
    tvGordon = (lastFCFF * (1 + termGrowthDec)) / (waccDec - termGrowthDec);
  }
  const pvTV = tvGordon / Math.pow(1 + waccDec, assumptions.projectionYears);
  const evCalc = sumPV + pvTV;
  const equityVal = evCalc - totalDebtForBridge + balanceSheet.cash;
  const dcfPerShareCalc = equityVal / financialData.sharesOutstanding;

  autoTable(doc, {
    startY: yPos,
    head: [['Valuation Build-Up', 'Value']],
    body: [
      ['Sum of PV(FCFF) Years 1-' + assumptions.projectionYears, formatNumber(sumPV)],
      [`Terminal Value (Gordon Growth, g=${formatPercent(assumptions.terminalGrowthRate)})`, formatNumber(tvGordon)],
      ['PV of Terminal Value', formatNumber(pvTV)],
      ['Enterprise Value', formatNumber(evCalc)],
      ['Less: Total Debt', `(${formatNumber(totalDebtForBridge)})`],
      ['Plus: Cash', formatNumber(balanceSheet.cash)],
      [{ content: 'Equity Value', styles: { fontStyle: 'bold' } }, { content: formatNumber(equityVal), styles: { fontStyle: 'bold' } }],
      ['Shares Outstanding', formatNumber(financialData.sharesOutstanding)],
      [{ content: 'DCF Fair Value per Share', styles: { fontStyle: 'bold' } }, { content: fmtCcy(dcfPerShareCalc, 2), styles: { fontStyle: 'bold' } }],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 100 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  // Valuation Summary
  autoTable(doc, {
    startY: yPos,
    head: [['Valuation Summary', 'Value']],
    body: [
      ['DCF Fair Value (per share)', fmtCcy(dcfValue, 2)],
      ['Comparable Fair Value (per share)', fmtCcy(comparableValue, 2)],
      ['Blended Value (60/40)', fmtCcy(blendedValue, 2)],
      ['Current Stock Price', fmtCcy(currentPrice, 2)],
      ['Upside / (Downside)', `${upside >= 0 ? '+' : ''}${formatPercent(upside)}`],
      ['WOLF Recommendation', recommendation],
    ],
    theme: 'striped',
    headStyles: { fillColor: redColor, textColor: [255, 255, 255] },
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 100 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage();

  // Bull / Bear / Base Scenarios
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SCENARIO ANALYSIS', 15, yPos);
  yPos += 10;

  // S1: Use shared scenario function for exact consistency with Engine/Excel
  const bearResult = calcScenarioPrice(financialData, assumptions, 'bear');
  const bullResult = calcScenarioPrice(financialData, assumptions, 'bull');
  const bearPrice = bearResult.price;
  const bullPrice = bullResult.price;

  const bearGrowth = bearResult.growth.toFixed(1);
  const bearWACCVal = bearResult.wacc.toFixed(1);
  const bullGrowth = bullResult.growth.toFixed(1);
  const bullWACCVal = bullResult.wacc.toFixed(1);

  autoTable(doc, {
    startY: yPos,
    head: [['Scenario', 'Implied Price', 'vs. Current', 'Key Assumptions']],
    body: [
      ['BEAR CASE', fmtCcy(bearPrice, 2), `${((bearPrice - currentPrice) / currentPrice * 100).toFixed(1)}%`, `Growth: ${bearGrowth}%, WACC: ${bearWACCVal}%`],
      ['BASE CASE', fmtCcy(dcfValue, 2), `${((dcfValue - currentPrice) / currentPrice * 100).toFixed(1)}%`, `Growth: ${assumptions.revenueGrowthRate.toFixed(1)}%, WACC: ${assumptions.discountRate.toFixed(1)}%`],
      ['BULL CASE', fmtCcy(bullPrice, 2), `${((bullPrice - currentPrice) / currentPrice * 100).toFixed(1)}%`, `Growth: ${bullGrowth}%, WACC: ${bullWACCVal}%`],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage();

  // DCF Assumptions
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('KEY ASSUMPTIONS', 15, yPos);
  yPos += 10;

  autoTable(doc, {
    startY: yPos,
    head: [['Assumption', 'Value']],
    body: [
      ['CAPM Method', assumptions.capmMethod === 'B' ? 'B — USD Build-Up' : 'A — Local Currency'],
      ['WACC (Discount Rate)', formatPercent(assumptions.discountRate)],
      ['Terminal Growth Rate', formatPercent(assumptions.terminalGrowthRate)],
      ['Revenue Growth Rate', formatPercent(assumptions.revenueGrowthRate)],
      ['EBITDA Margin', formatPercent(assumptions.ebitdaMargin)],
      ['D&A (% of Revenue)', formatPercent(assumptions.daPercent)],
      ['CapEx (% of Revenue)', formatPercent(assumptions.capexPercent)],
      ['Change in WC (% of Revenue Change)', formatPercent(assumptions.deltaWCPercent)],
      ['Projection Years', assumptions.projectionYears.toString()],
      ['Tax Rate', formatPercent(assumptions.taxRate)],
      ['Risk-Free Rate', formatPercent(assumptions.riskFreeRate)],
      ['Equity Risk Premium', formatPercent(assumptions.marketRiskPremium)],
      ['Beta', assumptions.beta.toFixed(2)],
      ['Beta Type', assumptions.betaType || 'Raw'],
      ['Cost of Debt', formatPercent(assumptions.costOfDebt)],
      ['Terminal Method', assumptions.terminalMethod === 'exit_multiple' ? `Exit Multiple (${assumptions.exitMultiple}x)` : 'Gordon Growth'],
      ['Discounting', assumptions.discountingConvention === 'mid_year' ? 'Mid-Year' : 'End of Year'],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 100 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage();

  // Comparable Companies
  if (comparables.length > 0) {
    doc.setTextColor(...redColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('COMPARABLE COMPANIES ANALYSIS', 15, yPos);
    yPos += 10;

    autoTable(doc, {
      startY: yPos,
      head: [['Company', 'P/E', 'EV/EBITDA', 'P/S', 'P/B']],
      body: [
        ...comparables.map(c => [c.name, `${c.peRatio.toFixed(1)}x`, `${c.evEbitda.toFixed(1)}x`, `${c.psRatio.toFixed(1)}x`, `${c.pbRatio.toFixed(1)}x`]),
        ['Average',
          `${(comparables.reduce((sum, c) => sum + c.peRatio, 0) / comparables.length).toFixed(1)}x`,
          `${(comparables.reduce((sum, c) => sum + c.evEbitda, 0) / comparables.length).toFixed(1)}x`,
          `${(comparables.reduce((sum, c) => sum + c.psRatio, 0) / comparables.length).toFixed(1)}x`,
          `${(comparables.reduce((sum, c) => sum + c.pbRatio, 0) / comparables.length).toFixed(1)}x`,
        ],
      ],
      theme: 'striped',
      headStyles: { fillColor: redColor, textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      margin: { left: 15, right: 15 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  checkNewPage();

  // Key Ratios
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('KEY FINANCIAL RATIOS', 15, yPos);
  yPos += 10;

  const totalDebt = balanceSheet.shortTermDebt + balanceSheet.longTermDebt;
  const roe = (incomeStatement.netIncome / balanceSheet.totalEquity) * 100;
  const roa = (incomeStatement.netIncome / balanceSheet.totalAssets) * 100;
  const currentRatio = balanceSheet.totalCurrentAssets / balanceSheet.totalCurrentLiabilities;
  const debtToEquity = totalDebt / balanceSheet.totalEquity;

  autoTable(doc, {
    startY: yPos,
    head: [['Profitability', 'Value', 'Financial Health', 'Value']],
    body: [
      ['Gross Margin', formatPercent(grossMargin), 'Current Ratio', `${currentRatio.toFixed(2)}x`],
      ['Operating Margin', formatPercent(opMargin), 'Debt/Equity', `${debtToEquity.toFixed(2)}x`],
      ['Net Margin', formatPercent(netMargin), 'Total Debt', formatNumber(totalDebt)],
      ['Return on Equity', formatPercent(roe), 'Total Equity', formatNumber(balanceSheet.totalEquity)],
      ['Return on Assets', formatPercent(roa), 'Cash Position', formatNumber(balanceSheet.cash + balanceSheet.marketableSecurities)],
    ],
    theme: 'striped',
    headStyles: { fillColor: redColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage();

  // S4: WACC BREAKDOWN
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('WACC BREAKDOWN', 15, yPos);
  yPos += 10;

  const ke = assumptions.riskFreeRate + assumptions.beta * assumptions.marketRiskPremium;
  const waccCalc = calculateWACC(financialData, assumptions);
  const equityWeight = (financialData.currentStockPrice * financialData.sharesOutstanding) /
    ((financialData.currentStockPrice * financialData.sharesOutstanding) + totalDebt);
  const debtWeight = 1 - equityWeight;

  autoTable(doc, {
    startY: yPos,
    head: [['Component', 'Value']],
    body: [
      ['Risk-Free Rate', formatPercent(assumptions.riskFreeRate)],
      ['Equity Risk Premium', formatPercent(assumptions.marketRiskPremium)],
      ['Beta', assumptions.beta.toFixed(2)],
      ['Cost of Equity (Ke)', formatPercent(ke)],
      ['Cost of Debt (Pre-Tax)', formatPercent(assumptions.costOfDebt)],
      ['Tax Rate', formatPercent(assumptions.taxRate)],
      ['Cost of Debt (After-Tax)', formatPercent(assumptions.costOfDebt * (1 - assumptions.taxRate / 100))],
      ['Equity Weight', formatPercent(equityWeight * 100)],
      ['Debt Weight', formatPercent(debtWeight * 100)],
      ['WACC', formatPercent(waccCalc)],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 100 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage();

  // S4: ALTMAN Z-SCORE
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ALTMAN Z-SCORE', 15, yPos);
  yPos += 10;

  const wcPdf = balanceSheet.totalCurrentAssets - balanceSheet.totalCurrentLiabilities;
  const marketCapPdf = financialData.currentStockPrice * financialData.sharesOutstanding;
  const totalLiab = balanceSheet.totalLiabilities || 1;
  const taPdf = balanceSheet.totalAssets || 1;
  const x1 = wcPdf / taPdf;
  const x2 = balanceSheet.totalEquity / taPdf;
  const x3 = incomeStatement.operatingIncome / taPdf;
  const x4 = marketCapPdf / totalLiab;
  const x5 = incomeStatement.revenue / taPdf;
  const zScore = 1.2 * x1 + 1.4 * x2 + 3.3 * x3 + 0.6 * x4 + x5;
  const zZone = zScore > 2.99 ? 'Safe Zone' : zScore > 1.81 ? 'Grey Zone' : 'Distress Zone';

  autoTable(doc, {
    startY: yPos,
    head: [['Factor', 'Formula', 'Value', 'Weighted']],
    body: [
      ['X1 (WC/TA)', 'Working Capital / Total Assets', x1.toFixed(3), (1.2 * x1).toFixed(3)],
      ['X2 (RE/TA)', 'Retained Earnings / Total Assets', x2.toFixed(3), (1.4 * x2).toFixed(3)],
      ['X3 (EBIT/TA)', 'EBIT / Total Assets', x3.toFixed(3), (3.3 * x3).toFixed(3)],
      ['X4 (MCap/TL)', 'Market Cap / Total Liabilities', x4.toFixed(3), (0.6 * x4).toFixed(3)],
      ['X5 (Rev/TA)', 'Revenue / Total Assets', x5.toFixed(3), x5.toFixed(3)],
      ['Z-Score', '', '', zScore.toFixed(2)],
      ['Assessment', '', '', zZone],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage();

  // S4: DUPONT DECOMPOSITION
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('DUPONT DECOMPOSITION', 15, yPos);
  yPos += 10;

  const npmPdf = incomeStatement.netIncome / (incomeStatement.revenue || 1);
  const atPdf = incomeStatement.revenue / taPdf;
  const emPdf = taPdf / (balanceSheet.totalEquity || 1);
  const duPontROE = npmPdf * atPdf * emPdf * 100;

  autoTable(doc, {
    startY: yPos,
    head: [['Component', 'Formula', 'Value']],
    body: [
      ['Net Profit Margin', 'Net Income / Revenue', formatPercent(npmPdf * 100)],
      ['Asset Turnover', 'Revenue / Total Assets', `${atPdf.toFixed(2)}x`],
      ['Equity Multiplier', 'Total Assets / Total Equity', `${emPdf.toFixed(2)}x`],
      ['DuPont ROE', 'NPM × AT × EM', formatPercent(duPontROE)],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 100 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage();

  // S4: CASH CONVERSION CYCLE
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('CASH CONVERSION CYCLE', 15, yPos);
  yPos += 10;

  const cogsPdf = incomeStatement.costOfGoodsSold || 1;
  const dsoPdf = balanceSheet.accountsReceivable > 0 ? 365 / (incomeStatement.revenue / balanceSheet.accountsReceivable) : 0;
  const dioPdf = balanceSheet.inventory > 0 ? 365 / (cogsPdf / balanceSheet.inventory) : 0;
  const dpoPdf = balanceSheet.accountsPayable > 0 ? 365 / (cogsPdf / balanceSheet.accountsPayable) : 0;
  const cccPdf = dsoPdf + dioPdf - dpoPdf;

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Formula', 'Days']],
    body: [
      ['DSO (Days Sales Outstanding)', 'AR × 365 / Revenue', `${dsoPdf.toFixed(1)} days`],
      ['DIO (Days Inventory Outstanding)', 'Inventory × 365 / COGS', `${dioPdf.toFixed(1)} days`],
      ['DPO (Days Payable Outstanding)', 'AP × 365 / COGS', `${dpoPdf.toFixed(1)} days`],
      ['CCC (Cash Conversion Cycle)', 'DSO + DIO - DPO', `${cccPdf.toFixed(1)} days`],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 100 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage();
  const keForDDM = assumptions.riskFreeRate + assumptions.beta * assumptions.marketRiskPremium;
  // C1 Fix: Calculate DPS from actual dividends paid
  const dividendsPaidAbs = Math.abs(financialData.cashFlowStatement.dividendsPaid || 0);
  const dpsVal = dividendsPaidAbs > 0
    ? dividendsPaidAbs / financialData.sharesOutstanding
    : (financialData.dividendsPerShare || 0);
  const gStableDDM = (assumptions.ddmStableGrowth || assumptions.terminalGrowthRate) / 100;
  const gHighDDM = (assumptions.ddmHighGrowth || assumptions.revenueGrowthRate) / 100;
  const keDec = keForDDM / 100;
  const ddmHighYears = assumptions.ddmHighGrowthYears || 5;

  if (dpsVal > 0 && keDec > gStableDDM) {
    doc.setTextColor(...redColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DDM VALUATION', 15, yPos);
    yPos += 10;

    // Gordon Growth
    const gordonPrice = (dpsVal * (1 + gStableDDM)) / (keDec - gStableDDM);

    // Two-Stage DDM
    let pvDivs = 0;
    let lastDiv = dpsVal;
    for (let t = 1; t <= ddmHighYears; t++) {
      lastDiv = dpsVal * Math.pow(1 + gHighDDM, t);
      pvDivs += lastDiv / Math.pow(1 + keDec, t);
    }
    const termDiv = lastDiv * (1 + gStableDDM);
    const tvDDM = termDiv / (keDec - gStableDDM);
    const pvTVDDM = tvDDM / Math.pow(1 + keDec, ddmHighYears);
    const twoStagePrice = pvDivs + pvTVDDM;

    autoTable(doc, {
      startY: yPos,
      head: [['DDM Method', 'Value']],
      body: [
        ['DPS (Current)', fmtCcy(dpsVal, 2)],
        ['Cost of Equity (Ke)', formatPercent(keForDDM)],
        ['Stable Growth Rate', formatPercent((assumptions.ddmStableGrowth || assumptions.terminalGrowthRate))],
        ['High Growth Rate', formatPercent((assumptions.ddmHighGrowth || assumptions.revenueGrowthRate))],
        ['Gordon Growth (Single-Stage)', fmtCcy(gordonPrice, 2)],
        [`Two-Stage DDM (${formatPercent((assumptions.ddmHighGrowth || assumptions.revenueGrowthRate))} -> ${formatPercent((assumptions.ddmStableGrowth || assumptions.terminalGrowthRate))})`, fmtCcy(twoStagePrice, 2)],
        ['DDM vs DCF spread', fmtCcy(gordonPrice - dcfValue, 2)],
      ],
      theme: 'striped',
      headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' } },
      margin: { left: 15, right: 100 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // S4: Quality Scorecard
  checkNewPage(60);
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('QUALITY SCORECARD', 15, yPos);
  yPos += 10;

  const scorecard = (() => {
    try {
      return calculateQualityScorecard(financialData);
    } catch { return null; }
  })();

  if (scorecard) {
    autoTable(doc, {
      startY: yPos,
      head: [['Component', 'Score', 'Weight']],
      body: [
        ['Overall Quality Score', `${scorecard.totalScore}/${scorecard.maxTotalScore} (Grade ${scorecard.grade})`, ''],
        ['Economic Moat', `${scorecard.economicMoat.score}/${scorecard.economicMoat.maxScore}`, '25%'],
        ['Financial Health', `${scorecard.financialHealth.score}/${scorecard.financialHealth.maxScore}`, '25%'],
        ['Growth & Profitability', `${scorecard.growthProfile.score}/${scorecard.growthProfile.maxScore}`, '25%'],
        ['Capital Allocation', `${scorecard.capitalAllocation.score}/${scorecard.capitalAllocation.maxScore}`, '25%'],
        ['Quality Premium Applied', `+${scorecard.qualityPremium?.toFixed(1) ?? 0}%`, ''],
      ],
      theme: 'striped',
      headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' } },
      margin: { left: 15, right: 100 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // S5: Reverse DCF Analysis
  checkNewPage(40);
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('REVERSE DCF ANALYSIS', 15, yPos);
  yPos += 10;

  const reverseDCF = (() => {
    try {
      return calculateReverseDCF(financialData, assumptions);
    } catch { return null; }
  })();

  if (reverseDCF) {
    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: [
        ['Market Implied Growth Rate', `${reverseDCF.impliedGrowthRate?.toFixed(1) ?? 'N/A'}%`],
        ['WOLF Fundamental Estimate', `${reverseDCF.baseGrowthRate?.toFixed(1) ?? formatPercent(assumptions.revenueGrowthRate)}%`],
        ['Growth Gap', `${reverseDCF.growthGap >= 0 ? '+' : ''}${reverseDCF.growthGap?.toFixed(1) ?? 'N/A'}pp`],
        ['Assessment', reverseDCF.narrative || 'N/A'],
      ],
      theme: 'striped',
      headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' } },
      margin: { left: 15, right: 100 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // Footer
  const pageCount = (doc as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text(
      `WOLF Valuation Engine V2.7 | ${financialData.companyName} | Generated: ${new Date().toLocaleDateString()}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, 290, { align: 'right' });
  }

  // Save
  const fileName = `WOLF_${financialData.ticker}_Investment_Memo_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

export default exportToPDF;
