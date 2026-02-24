import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinancialData, ValuationAssumptions, ComparableCompany, DCFProjection, MarketRegion } from '../types/financial';
import { formatNumber, formatPercent, formatCurrency, CurrencyCode } from './formatters';

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
    'Note: Cash & Equivalents represents highly liquid assets only. Marketable Securities (short-term investments) are shown separately per GAAP standards.',
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
      ['Free Cash Flow', ...dcfProjections.map(p => formatNumber(p.freeCashFlow))],
      ['Discount Factor', ...dcfProjections.map(p => p.discountFactor.toFixed(3))],
      ['Present Value', ...dcfProjections.map(p => formatNumber(p.presentValue))],
    ],
    theme: 'striped',
    headStyles: { fillColor: redColor, textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
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

  // Calculate scenarios
  const calcScenarioPrice = (revMult: number, waccAdd: number, termMult: number, marginAdd: number) => {
    const scenarioRevGrowth = assumptions.revenueGrowthRate * revMult;
    const scenarioWACC = Math.max(assumptions.discountRate + waccAdd, 2);
    const scenarioTermGrowth = assumptions.terminalGrowthRate * termMult;
    const baseMargin = financialData.cashFlowStatement.freeCashFlow / financialData.incomeStatement.revenue;

    let rev = financialData.incomeStatement.revenue;
    let sumPV = 0;
    let lastFCF = 0;

    for (let yr = 1; yr <= assumptions.projectionYears; yr++) {
      rev = rev * (1 + scenarioRevGrowth / 100);
      const margin = baseMargin + ((assumptions.marginImprovement + marginAdd) / 100) * yr;
      const fcf = rev * margin;
      const df = Math.pow(1 + scenarioWACC / 100, yr);
      sumPV += fcf / df;
      lastFCF = fcf;
    }

    let tv = 0;
    if (scenarioWACC > scenarioTermGrowth) {
      tv = (lastFCF * (1 + scenarioTermGrowth / 100)) / ((scenarioWACC - scenarioTermGrowth) / 100);
    } else {
      tv = lastFCF * 12;
    }
    const lastDF = Math.pow(1 + scenarioWACC / 100, assumptions.projectionYears);
    const ev = sumPV + tv / lastDF;
    const totalDebtCalc = financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt;
    const equity = Math.max(ev - totalDebtCalc + financialData.balanceSheet.cash, 0);
    return Math.max(equity / financialData.sharesOutstanding, 0);
  };

  const bearPrice = calcScenarioPrice(0.4, 2.5, 0.6, -1.5);
  const bullPrice = calcScenarioPrice(2.0, -2.5, 1.5, 2.5);

  autoTable(doc, {
    startY: yPos,
    head: [['Scenario', 'Implied Price', 'vs. Current', 'Key Assumptions']],
    body: [
      ['BEAR CASE', fmtCcy(bearPrice, 2), `${((bearPrice - currentPrice) / currentPrice * 100).toFixed(1)}%`, `Growth: ${(assumptions.revenueGrowthRate * 0.4).toFixed(1)}%, WACC: ${(assumptions.discountRate + 2.5).toFixed(1)}%`],
      ['BASE CASE', fmtCcy(dcfValue, 2), `${((dcfValue - currentPrice) / currentPrice * 100).toFixed(1)}%`, `Growth: ${assumptions.revenueGrowthRate.toFixed(1)}%, WACC: ${assumptions.discountRate.toFixed(1)}%`],
      ['BULL CASE', fmtCcy(bullPrice, 2), `+${((bullPrice - currentPrice) / currentPrice * 100).toFixed(1)}%`, `Growth: ${(assumptions.revenueGrowthRate * 2.0).toFixed(1)}%, WACC: ${Math.max(assumptions.discountRate - 2.5, 2).toFixed(1)}%`],
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
      ['ΔWC (% of Revenue)', formatPercent(assumptions.deltaWCPercent)],
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

  // Footer
  const pageCount = (doc as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text(
      `WOLF Valuation Engine | ${financialData.companyName} | Generated: ${new Date().toLocaleDateString()}`,
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
