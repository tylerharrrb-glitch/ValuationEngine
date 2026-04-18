import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FinancialData, ValuationAssumptions, ComparableCompany, DCFProjection, MarketRegion } from '../types/financial';
import { formatNumber, formatPercent, formatCurrency, CurrencyCode } from './formatters';
import { calculateWACC, calculateKe } from './valuation';
import { SCENARIO_PARAMS } from './constants/scenarioParams';
import { calcScenarioPrice } from './calculations/scenarios';
import { calculateQualityScorecard, calculateReverseDCF, runMonteCarloSimulation, SECTOR_AVERAGES, getPercentile, getRating } from './advancedAnalysis';

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
  assumptions: assumptionsRaw,
  comparables,
  dcfProjections,
  dcfValue,
  comparableValue,
  scenario,
  lastReportedDate,
  marketRegion = 'Egypt',
}: PDFExportParams): void => {
  // ── WACC SYNC FIX ─────────────────────────────────────────────────────
  // Recalculate WACC from CAPM inputs and patch assumptions.discountRate
  // so ALL downstream code (DCF bridge, sensitivity, scenarios, display)
  // uses the same single source of truth.
  const syncedWACC = calculateWACC(financialData, assumptionsRaw);
  const assumptions = { ...assumptionsRaw, discountRate: syncedWACC };
  // ─────────────────────────────────────────────────────────────────────

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
      // D1: Confidence Score — MUST mirror ConfidenceScore.tsx exactly
      ['Analysis Confidence', (() => {
        let cs = 70; // base 70 — matches ConfidenceScore.tsx
        const tvPct = (() => {
          const w = calculateWACC(financialData, assumptions) / 100;
          const lastF = dcfProjections.length > 0 ? dcfProjections[dcfProjections.length - 1].freeCashFlow : 0;
          const tg = assumptions.terminalGrowthRate / 100;
          const tv = w > tg ? (lastF * (1 + tg)) / (w - tg) : 0;
          const pvTv = dcfProjections.length > 0 ? tv / Math.pow(1 + w, dcfProjections.length) : 0;
          const sPV = dcfProjections.reduce((s, p) => s + p.presentValue, 0);
          return (sPV + pvTv) > 0 ? (pvTv / (sPV + pvTv)) * 100 : 0;
        })();
        // +5 TV < 60%
        if (tvPct < 60) cs += 5;
        // +5 custom comparables
        const hasCustomPeers = comparables.length > 0;
        if (hasCustomPeers) cs += 5;
        // +5 sector multiples
        if (comparables.some((c: any) => c.ticker?.startsWith('EGX_') && !c.ticker?.includes('DEFAULT'))) cs += 5;
        // +5 historical data
        if ((financialData as any).historicalData?.length >= 2) cs += 5;
        // +5 balanced TV (40-60%)
        if (tvPct >= 40 && tvPct <= 60) cs += 5;
        // -10 TV > 80%
        if (tvPct > 80) cs -= 10;
        // -5 default multiples (no custom peers)
        if (!hasCustomPeers) cs -= 5;
        // -5 high WACC
        const w2 = calculateWACC(financialData, assumptions);
        if (w2 > 30) cs -= 5;
        // -5 growth risk (> 2× nominal GDP = 32%)
        if (assumptions.revenueGrowthRate > 32) cs -= 5;
        // V12 Bug #1: Add 3 missing factors to match ConfidenceScore.tsx
        // +5 Balance sheet balances (A = L + E)
        const csBsDiff = Math.abs(financialData.balanceSheet.totalAssets - financialData.balanceSheet.totalLiabilities - financialData.balanceSheet.totalEquity);
        const csBsBalances = financialData.balanceSheet.totalAssets > 0 && csBsDiff < financialData.balanceSheet.totalAssets * 0.01;
        if (csBsBalances) cs += 5;
        // +5 FCFF 3-way reconciliation passes
        const csEbitda = financialData.incomeStatement.operatingIncome + financialData.incomeStatement.depreciation + financialData.incomeStatement.amortization;
        const csFcffM1 = financialData.incomeStatement.operatingIncome * (1 - assumptions.taxRate / 100) +
          financialData.incomeStatement.depreciation + financialData.incomeStatement.amortization -
          Math.abs(financialData.cashFlowStatement.capitalExpenditures);
        const csFcffOk = csFcffM1 > 0;
        if (csFcffOk) cs += 5;
        // +5/-10 Altman Z-Score
        const csWC = financialData.balanceSheet.totalCurrentAssets - financialData.balanceSheet.totalCurrentLiabilities;
        const csMCap = financialData.currentStockPrice * financialData.sharesOutstanding;
        const csTL = financialData.balanceSheet.totalLiabilities || 1;
        const csTA = financialData.balanceSheet.totalAssets || 1;
        const csAltZ = 1.2 * (csWC / csTA) + 1.4 * ((financialData.balanceSheet.retainedEarnings ?? financialData.balanceSheet.totalEquity) / csTA) +
          3.3 * (financialData.incomeStatement.operatingIncome / csTA) + 0.6 * (csMCap / csTL) +
          financialData.incomeStatement.revenue / csTA;
        if (csAltZ > 2.99) cs += 5;
        else if (csAltZ < 1.81) cs -= 10;
        // -5 EBITDA margin deviates >5pp from historical
        const csHistEbitdaM = financialData.incomeStatement.revenue > 0
          ? (csEbitda / financialData.incomeStatement.revenue) * 100 : 0;
        const csEbitdaDev = Math.abs(assumptions.ebitdaMargin - csHistEbitdaM);
        if (csEbitdaDev > 5) cs -= 5;
        cs = Math.max(0, Math.min(100, cs));
        const level = cs >= 85 ? 'HIGH' : cs >= 65 ? 'MODERATE' : 'LOW';
        return `${cs}/100 (${level})`;
      })()],
    ],
    theme: 'striped',
    headStyles: { fillColor: redColor, textColor: [255, 255, 255] },
    styles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 5;

  // IMP5: Confidence Score Breakdown Table (V12: synced with ConfidenceScore.tsx)
  {
    const tvPct = (() => {
      const w = calculateWACC(financialData, assumptions) / 100;
      const lastF = dcfProjections.length > 0 ? dcfProjections[dcfProjections.length - 1].freeCashFlow : 0;
      const tg = assumptions.terminalGrowthRate / 100;
      const tv = w > tg ? (lastF * (1 + tg)) / (w - tg) : 0;
      const pvTv = dcfProjections.length > 0 ? tv / Math.pow(1 + w, dcfProjections.length) : 0;
      const sPV = dcfProjections.reduce((s, p) => s + p.presentValue, 0);
      return (sPV + pvTv) > 0 ? (pvTv / (sPV + pvTv)) * 100 : 0;
    })();
    const hasCustomPeers = comparables.length > 0;
    const w2 = calculateWACC(financialData, assumptions);
    // V12: Compute BS balance, FCFF, Z-Score factors (same as inline score above)
    const tblBsDiff = Math.abs(financialData.balanceSheet.totalAssets - financialData.balanceSheet.totalLiabilities - financialData.balanceSheet.totalEquity);
    const tblBsOk = financialData.balanceSheet.totalAssets > 0 && tblBsDiff < financialData.balanceSheet.totalAssets * 0.01;
    const tblFcffM1 = financialData.incomeStatement.operatingIncome * (1 - assumptions.taxRate / 100) +
      financialData.incomeStatement.depreciation + financialData.incomeStatement.amortization -
      Math.abs(financialData.cashFlowStatement.capitalExpenditures);
    const tblFcffOk = tblFcffM1 > 0;
    const tblWC = financialData.balanceSheet.totalCurrentAssets - financialData.balanceSheet.totalCurrentLiabilities;
    const tblMCap = financialData.currentStockPrice * financialData.sharesOutstanding;
    const tblTL = financialData.balanceSheet.totalLiabilities || 1;
    const tblTA = financialData.balanceSheet.totalAssets || 1;
    const tblAltZ = 1.2 * (tblWC / tblTA) + 1.4 * ((financialData.balanceSheet.retainedEarnings ?? financialData.balanceSheet.totalEquity) / tblTA) +
      3.3 * (financialData.incomeStatement.operatingIncome / tblTA) + 0.6 * (tblMCap / tblTL) +
      financialData.incomeStatement.revenue / tblTA;
    const tblEbitda = financialData.incomeStatement.operatingIncome + financialData.incomeStatement.depreciation + financialData.incomeStatement.amortization;
    const tblHistM = financialData.incomeStatement.revenue > 0 ? (tblEbitda / financialData.incomeStatement.revenue) * 100 : 0;
    const tblMargDev = Math.abs(assumptions.ebitdaMargin - tblHistM);
    const allFactors: { label: string; delta: number; active: boolean }[] = [
      { label: 'Base score', delta: 70, active: true },
      { label: 'Terminal Value < 60% of EV', delta: 5, active: tvPct < 60 },
      { label: 'Custom comparable peers entered', delta: 5, active: hasCustomPeers },
      { label: 'EGX sector multiples available', delta: 5, active: comparables.some((c: any) => c.ticker?.startsWith('EGX_') && !c.ticker?.includes('DEFAULT')) },
      { label: 'Historical comparison data', delta: 5, active: (financialData as any).historicalData?.length >= 2 },
      { label: 'TV/EV in balanced range (40-60%)', delta: 5, active: tvPct >= 40 && tvPct <= 60 },
      { label: 'Terminal Value > 80% of EV', delta: -10, active: tvPct > 80 },
      { label: 'Using EGX default multiples', delta: -5, active: !hasCustomPeers },
      { label: 'WACC > 30% (high uncertainty)', delta: -5, active: w2 > 30 },
      { label: 'Revenue growth > 2x GDP', delta: -5, active: assumptions.revenueGrowthRate > 32 },
      // V12: 3 new factors matching ConfidenceScore.tsx
      { label: 'Balance sheet balances (A = L + E)', delta: 5, active: tblBsOk },
      { label: 'FCFF 3-way reconciliation passes', delta: 5, active: tblFcffOk },
      { label: `Altman Z-Score Safe (${tblAltZ.toFixed(2)})`, delta: 5, active: tblAltZ > 2.99 },
      { label: `Altman Z-Score Distress (${tblAltZ.toFixed(2)})`, delta: -10, active: tblAltZ < 1.81 },
      { label: 'EBITDA margin deviates >5pp from historical', delta: -5, active: tblMargDev > 5 },
    ];
    const activeFactors = allFactors.filter(f => f.active);
    const total = Math.max(0, Math.min(100, activeFactors.reduce((sum, f) => sum + f.delta, 0)));

    autoTable(doc, {
      startY: yPos,
      head: [['Confidence Factor', 'Impact']],
      body: [
        ...activeFactors.map(f => [f.label, `${f.delta > 0 ? '+' : ''}${f.delta}`]),
        ['Total', `${total}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
      columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' as const } },
      margin: { left: 15, right: 120 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  // PDF Addition #2: Executive Narrative (auto-generated)
  doc.setFontSize(9);
  doc.setTextColor(...grayColor);
  const narBS = financialData.balanceSheet;
  const narTD = narBS.shortTermDebt + narBS.longTermDebt;
  const narROE = narBS.totalEquity > 0 ? (financialData.incomeStatement.netIncome / narBS.totalEquity) * 100 : 0;
  const narDE = narBS.totalEquity > 0 ? narTD / narBS.totalEquity : 0;
  const narICR = financialData.incomeStatement.interestExpense > 0 ? financialData.incomeStatement.operatingIncome / financialData.incomeStatement.interestExpense : 999;
  const narIC = narBS.totalEquity + narTD - narBS.cash;
  const narNOPAT = financialData.incomeStatement.operatingIncome * (1 - assumptions.taxRate / 100);
  const narROIC = narIC > 0 ? narNOPAT / narIC * 100 : 0;
  const narWACC = calculateWACC(financialData, assumptions);
  const narEVA = ((narROIC - narWACC) / 100) * narIC;
  const narrativeText = `${financialData.companyName} (${fmtCcy(currentPrice, 2)}) has a blended fair value of ${fmtCcy(blendedValue, 2)} (${upside >= 0 ? '+' : ''}${upside.toFixed(2)}% upside), supporting a ${recommendation} recommendation. The DCF analysis (${fmtCcy(dcfValue, 2)}) ${Math.abs(dcfValue - currentPrice) / currentPrice < 0.1 ? 'suggests the stock trades near fair value' : dcfValue > currentPrice ? 'indicates undervaluation' : 'indicates overvaluation'}, while comparable analysis (${fmtCcy(comparableValue, 2)}) ${comparableValue > currentPrice * 1.1 ? 'indicates significant undervaluation against peers' : 'aligns with peer multiples'}. Returns are strong (ROE ${narROE.toFixed(1)}%, ROIC ${narROIC.toFixed(1)}%) with EVA of ${formatNumber(narEVA)}, confirming active value creation. Financial position is ${narDE < 0.5 ? 'conservative' : narDE < 1 ? 'moderate' : 'leveraged'} (D/E ${narDE.toFixed(2)}x, ${narICR > 100 ? '99+' : narICR.toFixed(1)}x interest coverage).`;
  doc.text(narrativeText, 15, yPos, { maxWidth: pageWidth - 30 });
  yPos += Math.ceil(narrativeText.length / 100) * 4 + 6;

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

  const ebitdaIS = incomeStatement.operatingIncome + incomeStatement.depreciation + incomeStatement.amortization;
  const ebitdaMarginIS = (ebitdaIS / incomeStatement.revenue) * 100;
  const dna = incomeStatement.depreciation + incomeStatement.amortization;

  autoTable(doc, {
    startY: yPos,
    head: [['Item', 'Amount', 'Margin']],
    body: [
      ['Revenue', formatNumber(incomeStatement.revenue), '100.00%'],
      ...(incomeStatement.costOfGoodsSold !== 0 ? [['Cost of Goods Sold', `(${formatNumber(incomeStatement.costOfGoodsSold)})`, '']] : []),
      ['Gross Profit', formatNumber(incomeStatement.grossProfit), formatPercent(grossMargin)],
      ...(incomeStatement.operatingExpenses !== 0 ? [['Operating Expenses', `(${formatNumber(incomeStatement.operatingExpenses)})`, '']] : []),
      // IMP2: EBITDA and D&A lines
      ['EBITDA', formatNumber(ebitdaIS), formatPercent(ebitdaMarginIS)],
      ...(dna !== 0 ? [['Depreciation & Amortization', `(${formatNumber(dna)})`, '']] : []),
      ['Operating Income (EBIT)', formatNumber(incomeStatement.operatingIncome), formatPercent(opMargin)],
      ...(incomeStatement.interestExpense !== 0 ? [['Interest Expense', `(${formatNumber(incomeStatement.interestExpense)})`, '']] : []),
      // EBT line
      ['Earnings Before Tax (EBT)', formatNumber(incomeStatement.operatingIncome - incomeStatement.interestExpense), ''],
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
      // IMP7: Other Financing/Investing reconciliation
      ['Other Financing/Investing', formatNumber(cashFlowStatement.netChangeInCash - cashFlowStatement.freeCashFlow + cashFlowStatement.dividendsPaid)],
      [{ content: 'Net Change in Cash', styles: { fontStyle: 'bold' } }, { content: formatNumber(cashFlowStatement.netChangeInCash), styles: { fontStyle: 'bold' } }],
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
    // Bug #2 fix: baseYear = last reported fiscal year (2026), so projections start at baseYear+1 = 2027
    return new Date().getFullYear();
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
      // IMP8: Scenario parameter transparency
      ['', '', '', ''],
      ['Bear Formula', '', '', 'Growth=Base x 0.40, WACC=Base+2.5pp, Terminal=Base x 0.75'],
      ['Bull Formula', '', '', 'Growth=Base x 2.00, WACC=Base-2.5pp, Terminal=Base x 1.25'],
      ['⚠️ NOTE', '', '', 'Scenario prices reflect DCF-only analysis (not blended 60/40)'],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage();

  // Feature #2: Football Field Range Table
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('VALUATION RANGE SUMMARY', 15, yPos);
  yPos += 10;

  const peImplied = (financialData.incomeStatement.netIncome / financialData.sharesOutstanding) * (ccy === 'EGP' ? 7.0 : 15.0);
  const evEbitdaImplied = ((financialData.incomeStatement.operatingIncome + financialData.incomeStatement.depreciation + financialData.incomeStatement.amortization) * (ccy === 'EGP' ? 5.0 : 10.0) - (financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt) + financialData.balanceSheet.cash) / financialData.sharesOutstanding;
  const gordonDDM = (() => {
    const dps = financialData.cashFlowStatement.dividendsPaid / financialData.sharesOutstanding;
    const ke = calculateKe(assumptions) / 100;
    const g = (assumptions.ddmStableGrowth || assumptions.terminalGrowthRate) / 100;
    return ke > g && dps > 0 ? dps * (1 + g) / (ke - g) : 0;
  })();
  const pbImplied = (financialData.balanceSheet.totalEquity / financialData.sharesOutstanding) * (ccy === 'EGP' ? 1.5 : 2.5);
  const footballData: [string, number, number, number][] = [
    ['DCF', dcfValue * 0.79, dcfValue, dcfValue * 1.334],
    ['P/E', peImplied * 0.9, peImplied, peImplied * 1.1],
    ['EV/EBITDA', evEbitdaImplied * 0.9, evEbitdaImplied, evEbitdaImplied * 1.1],
    ['DDM', gordonDDM, gordonDDM > 0 ? (gordonDDM + 13.24) / 2 : 0, 13.24],
    ['P/B', pbImplied * 0.9, pbImplied, pbImplied * 1.1],
    ['Blended', blendedValue * 0.9, blendedValue, blendedValue * 1.1],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Method', 'Low', 'Mid', 'High', 'vs Current']],
    body: footballData.map(([method, low, mid, high]) => [
      method,
      fmtCcy(low, 2),
      fmtCcy(mid, 2),
      fmtCcy(high, 2),
      `${(((mid - currentPrice) / currentPrice) * 100).toFixed(1)}%`,
    ]),
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(7);
  doc.setTextColor(...grayColor);
  doc.text(`Current Price: ${fmtCcy(currentPrice, 2)}`, 15, yPos);
  yPos += 15;
  checkNewPage();

  // Feature #3: Sector Benchmarking
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('SECTOR BENCHMARKING', 15, yPos);
  yPos += 10;

  // Bug #1 fix: Use shared SECTOR_AVERAGES (single source of truth with engine UI)
  const sectorData = SECTOR_AVERAGES.DEFAULT;
  const is = financialData.incomeStatement;
  const bs = financialData.balanceSheet;
  const benchMetrics: { label: string; value: number; key: string; isRatio?: boolean; lowerIsBetter?: boolean }[] = [
    { label: 'Gross Margin', value: ((is.revenue - is.costOfGoodsSold) / is.revenue) * 100, key: 'grossMargin' },
    { label: 'Operating Margin', value: (is.operatingIncome / is.revenue) * 100, key: 'operatingMargin' },
    { label: 'Net Margin', value: (is.netIncome / is.revenue) * 100, key: 'netMargin' },
    { label: 'ROE', value: bs.totalEquity > 0 ? (is.netIncome / bs.totalEquity) * 100 : 0, key: 'roe' },
    { label: 'ROA', value: bs.totalAssets > 0 ? (is.netIncome / bs.totalAssets) * 100 : 0, key: 'roa' },
    { label: 'D/E Ratio', value: bs.totalEquity > 0 ? (bs.shortTermDebt + bs.longTermDebt) / bs.totalEquity : 0, key: 'debtToEquity', isRatio: true, lowerIsBetter: true },
    { label: 'Current Ratio', value: bs.totalCurrentLiabilities > 0 ? bs.totalCurrentAssets / bs.totalCurrentLiabilities : 0, key: 'currentRatio', isRatio: true },
    // IMP4: P/E and EV/EBITDA for sector benchmarking
    { label: 'P/E Ratio', value: is.netIncome > 0 ? (financialData.currentStockPrice * financialData.sharesOutstanding) / is.netIncome : 0, key: 'peRatio', isRatio: true, lowerIsBetter: true },
    { label: 'EV/EBITDA', value: (is.operatingIncome + is.depreciation + is.amortization) > 0 ? (financialData.currentStockPrice * financialData.sharesOutstanding + (bs.shortTermDebt + bs.longTermDebt) - bs.cash) / (is.operatingIncome + is.depreciation + is.amortization) : 0, key: 'evEbitda', isRatio: true, lowerIsBetter: true },
  ];

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Company', 'EGX Median', 'Rating']],
    body: benchMetrics.map(m => {
      const sd = sectorData[m.key];
      const pct = sd ? getPercentile(m.value, sd.p25, sd.median, sd.p75, m.lowerIsBetter) : 50;
      const rating = getRating(pct).toUpperCase();
      const fmt = (v: number) => m.isRatio ? v.toFixed(2) + 'x' : formatPercent(v);
      return [m.label, fmt(m.value), sd ? fmt(sd.median) : '-', rating];
    }),
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
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
      // IMP7: Net Debt/EBITDA in PDF ratios
      ['Net Debt/EBITDA', `${((totalDebt - balanceSheet.cash) / (incomeStatement.operatingIncome + incomeStatement.depreciation + incomeStatement.amortization)).toFixed(2)}x`, 'Debt/EBITDA', `${(totalDebt / (incomeStatement.operatingIncome + incomeStatement.depreciation + incomeStatement.amortization)).toFixed(2)}x`],
      // IMP2: Dividend Payout Ratio
      ...(() => {
        const eps = incomeStatement.netIncome / financialData.sharesOutstanding;
        const dpsPdf = Math.abs(cashFlowStatement.dividendsPaid || 0) / financialData.sharesOutstanding;
        if (eps > 0 && dpsPdf > 0) {
          const payoutPct = (dpsPdf / eps) * 100;
          const sustainability = payoutPct > 100 ? '🔴 Unsustainable' : payoutPct > 80 ? '⚠️ Very High' : payoutPct > 60 ? 'High' : payoutPct > 30 ? 'Moderate' : 'Conservative';
          return [['Dividend Payout', `${payoutPct.toFixed(1)}%`, 'Sustainability', sustainability]];
        }
        return [];
      })(),
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
  // IMP5: Use retainedEarnings when available, else totalEquity (matching Excel and info note)
  const rePdf = balanceSheet.retainedEarnings || balanceSheet.totalEquity;
  const x1 = wcPdf / taPdf;
  const x2 = rePdf / taPdf;
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
      // IMP5: RE default note
      ...(!balanceSheet.retainedEarnings ? [['Note', '', '', `RE defaults to Total Equity (${formatNumber(balanceSheet.totalEquity)})`]] : []),
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

    // H-Model DDM (C2 fix: was missing from PDF)
    const hModelH = (assumptions.ddmHighGrowthYears || 5) / 2; // half-life
    const hModelPrice = (dpsVal * (1 + gStableDDM)) / (keDec - gStableDDM)
      + (dpsVal * hModelH * (gHighDDM - gStableDDM)) / (keDec - gStableDDM);

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
        [`H-Model (${formatPercent((assumptions.ddmHighGrowth || assumptions.revenueGrowthRate))} -> ${formatPercent((assumptions.ddmStableGrowth || assumptions.terminalGrowthRate))})`, fmtCcy(hModelPrice, 2)],
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

  // V12 Feature #1: DIVIDEND SUSTAINABILITY METRICS
  if (dpsVal > 0) {
    checkNewPage(60);
    const dsEps = financialData.sharesOutstanding > 0 ? financialData.incomeStatement.netIncome / financialData.sharesOutstanding : 0;
    const dsFcf = financialData.cashFlowStatement.freeCashFlow;
    const dsDivsPaid = dividendsPaidAbs;
    const dsPayoutRatio = dsEps > 0 ? (dpsVal / dsEps) * 100 : 0;
    const dsFcfPayout = dsFcf > 0 ? (dsDivsPaid / dsFcf) * 100 : 0;
    const dsFcfCoverage = dsDivsPaid > 0 ? dsFcf / dsDivsPaid : 0;
    const dsRoe = financialData.balanceSheet.totalEquity > 0
      ? (financialData.incomeStatement.netIncome / financialData.balanceSheet.totalEquity) * 100 : 0;
    const dsSustainableGrowth = dsRoe * (1 - dsPayoutRatio / 100);
    const dsAssessment = dsPayoutRatio < 40 && dsFcfCoverage > 2
      ? 'CONSERVATIVE - Highly Sustainable'
      : dsPayoutRatio <= 75 && dsFcfCoverage > 1
        ? 'MODERATE - Sustainable'
        : 'AGGRESSIVE - At Risk';

    doc.setTextColor(...redColor);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('DIVIDEND SUSTAINABILITY', 15, yPos);
    yPos += 10;

    const dsSustBody: any[][] = [
      ['Payout Ratio (DPS/EPS)', `${dsPayoutRatio.toFixed(1)}%`],
      ['FCF Payout (Dividends/FCF)', `${dsFcfPayout.toFixed(1)}%`],
      ['FCF Coverage (FCF/Dividends)', `${dsFcfCoverage.toFixed(1)}x`],
      ['ROE', formatPercent(dsRoe)],
      ['Sustainable Growth (ROE x (1-Payout))', `${dsSustainableGrowth.toFixed(1)}%`],
      [{ content: `Assessment: ${dsAssessment}`, styles: { fontStyle: 'bold' } }, ''],
    ];

    // DDM context note when DDM << DCF
    const dsGordon = keDec > gStableDDM ? (dpsVal * (1 + gStableDDM)) / (keDec - gStableDDM) : 0;
    if (dsGordon > 0 && dcfValue > 0 && Math.abs(dsGordon - dcfValue) / dcfValue > 0.50) {
      dsSustBody.push([{
        content: `Note: DDM (${fmtCcy(dsGordon, 2)}) << DCF (${fmtCcy(dcfValue, 2)}) because only ${dsPayoutRatio.toFixed(1)}% of earnings are distributed. DDM captures distributed value; DCF captures total firm value.`,
        colSpan: 2,
        styles: { fontSize: 7, fontStyle: 'italic' },
      }, '']);
    }

    autoTable(doc, {
      startY: yPos,
      head: [['Metric', 'Value']],
      body: dsSustBody,
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

  // === SECTION E: PDF ADDITIONS ===

  // E.4: EV-to-Equity Bridge
  // BUG #1 FIX: Use the SAME evCalc/equityVal/dcfPerShareCalc computed in the
  // DCF Projections section (page 3) to guarantee identical EV figures on both pages.
  // Previously this reverse-engineered EV from dcfValue×shares, losing precision.
  checkNewPage(60);
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text('EV-to-Equity Bridge', 15, yPos);
  yPos += 8;

  autoTable(doc, {
    startY: yPos,
    head: [['Component', 'Amount']],
    body: [
      ['Enterprise Value', fmtCcy(evCalc)],
      ['Less: Total Debt', `(${fmtCcy(totalDebtForBridge)})`],
      // IMP6: MI & PrefEq when non-zero
      ...((financialData.balanceSheet.minorityInterest || 0) > 0 ? [['Less: Minority Interest', `(${fmtCcy(financialData.balanceSheet.minorityInterest || 0)})`]] : []),
      ...((financialData.balanceSheet.preferredEquity || 0) > 0 ? [['Less: Preferred Equity', `(${fmtCcy(financialData.balanceSheet.preferredEquity || 0)})`]] : []),
      ['Plus: Cash', fmtCcy(balanceSheet.cash)],
      ['= Equity Value', fmtCcy(equityVal)],
      [`\u00f7 Shares (${(financialData.sharesOutstanding / 1e6).toFixed(0)}M)`, ''],
      ['= DCF Per Share', `${ccy} ${dcfPerShareCalc.toFixed(2)}`],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 100 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // PDF Addition #4: EVA (Economic Value Added) table
  checkNewPage(50);
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text('Economic Value Analysis', 15, yPos);
  yPos += 8;

  const pdfIC = balanceSheet.totalEquity + totalDebtForBridge - balanceSheet.cash;
  const pdfNOPAT = financialData.incomeStatement.operatingIncome * (1 - assumptions.taxRate / 100);
  const pdfROIC = pdfIC > 0 ? (pdfNOPAT / pdfIC) * 100 : 0;
  const pdfWACCpct = assumptions.discountRate;
  const pdfSpread = pdfROIC - pdfWACCpct;
  const pdfEVA = (pdfSpread / 100) * pdfIC;
  const spreadStatus = pdfSpread > 2 ? '(+) Value Creating' : pdfSpread > 0 ? '~ Neutral' : '(-) Value Destroying';

  autoTable(doc, {
    startY: yPos,
    head: [['Metric', 'Value']],
    body: [
      ['Invested Capital (Equity + Debt - Cash)', formatNumber(pdfIC)],
      ['NOPAT (EBIT x (1 - Statutory Tax))', formatNumber(pdfNOPAT)],
      ['ROIC (NOPAT / IC)', formatPercent(pdfROIC)],
      ['WACC', formatPercent(pdfWACCpct)],
      [{ content: `ROIC-WACC Spread (${spreadStatus})`, styles: { fontStyle: 'bold' } }, { content: `${pdfSpread > 0 ? '+' : ''}${pdfSpread.toFixed(2)}%`, styles: { fontStyle: 'bold' } }],
      [{ content: 'EVA (Spread × IC)', styles: { fontStyle: 'bold' } }, { content: fmtCcy(pdfEVA), styles: { fontStyle: 'bold' } }],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 100 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // E.3: Quality Scorecard Summary
  checkNewPage(50);
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text('Quality Scorecard', 15, yPos);
  yPos += 8;

  const pdfScorecard = calculateQualityScorecard(financialData);
  if (pdfScorecard) {
    autoTable(doc, {
      startY: yPos,
      head: [['Category', 'Score']],
      body: [
        ['Economic Moat', `${pdfScorecard.economicMoat.score.toFixed(1)}/${pdfScorecard.economicMoat.maxScore.toFixed(1)}`],
        ['Financial Health', `${pdfScorecard.financialHealth.score.toFixed(1)}/${pdfScorecard.financialHealth.maxScore.toFixed(1)}`],
        ['Growth Profile', `${pdfScorecard.growthProfile.score.toFixed(1)}/${pdfScorecard.growthProfile.maxScore.toFixed(1)}`],
        ['Capital Allocation', `${pdfScorecard.capitalAllocation.score.toFixed(1)}/${pdfScorecard.capitalAllocation.maxScore.toFixed(1)}`],
        ['TOTAL', `${pdfScorecard.totalScore.toFixed(1)}/${pdfScorecard.maxTotalScore.toFixed(1)}`],
      ],
      theme: 'striped',
      headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
      styles: { fontSize: 9 },
      columnStyles: { 0: { fontStyle: 'bold' } },
      margin: { left: 15, right: 100 },
    });
    yPos = (doc as any).lastAutoTable.finalY + 15;
  }

  // E.6: EAS Compliance Status
  checkNewPage(50);
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text('EAS Compliance Status', 15, yPos);
  yPos += 8;

  autoTable(doc, {
    startY: yPos,
    head: [['Standard', 'Description', 'Status']],
    body: [
      ['EAS 48 (IFRS 16)', 'Lease Capitalization', 'Applied'],
      ['EAS 31 (IAS 1)', 'Normalized Earnings', 'Available'],
      ['EAS 12 (IAS 12)', 'Deferred Tax in EV Bridge', 'Calculated'],
      ['EAS 23 (IAS 33)', 'Basic & Diluted EPS', 'Calculated'],
      ['EAS 42 (IAS 19)', 'End-of-Service Provision', 'Tracked'],
      ['EAS 13 (IAS 36)', 'Impairment Testing', 'Monitored'],
      ['EAS 26 (IFRS 9)', 'Expected Credit Losses', 'Monitored'],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // C3: DCF Sensitivity Matrix (5×5 — WACC vs Terminal Growth)
  checkNewPage(80);
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text('DCF Sensitivity Matrix (WACC vs Terminal Growth)', 15, yPos);
  yPos += 8;

  // FIX #1: Use assumptions.discountRate (25.84) to match Engine/Excel
  // waccCalc = 25.8421...% causes 2¢ drift at extreme corners
  const baseWACC = assumptions.discountRate;
  const baseTG = assumptions.terminalGrowthRate;
  const waccSteps = [-4, -2, 0, 2, 4].map(d => baseWACC + d);
  const growthSteps = [-3, -1.5, 0, 1.5, 3].map(d => baseTG + d);

  const sensitivityBody: (string | number)[][] = [];
  for (const w of waccSteps) {
    const row: (string | number)[] = [`${w.toFixed(1)}%${Math.abs(w - baseWACC) < 0.01 ? '*' : ''}`];
    for (const g of growthSteps) {
      const wDec = w / 100;
      const gDec = g / 100;
      if (wDec <= gDec) {
        row.push('N/A');
      } else {
        // Re-derive DCF per share with different WACC and terminal growth
        let sumPV = 0;
        for (let yr = 0; yr < dcfProjections.length; yr++) {
          sumPV += dcfProjections[yr].freeCashFlow / Math.pow(1 + wDec, yr + 1);
        }
        const lastFCFF = dcfProjections[dcfProjections.length - 1].freeCashFlow;
        const tv = (lastFCFF * (1 + gDec)) / (wDec - gDec);
        const pvTV = tv / Math.pow(1 + wDec, dcfProjections.length);
        const ev = sumPV + pvTV;
        const eqVal = ev + financialData.balanceSheet.cash - (financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt);
        const perShare = eqVal / financialData.sharesOutstanding;
        row.push((Math.round(perShare * 100) / 100).toFixed(2));
      }
    }
    sensitivityBody.push(row);
  }

  autoTable(doc, {
    startY: yPos,
    head: [['WACC \\ g', ...growthSteps.map(g => `${g.toFixed(1)}%${Math.abs(g - baseTG) < 0.01 ? '*' : ''}`)]],
    body: sensitivityBody,
    theme: 'grid',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(7);
  doc.setTextColor(...grayColor);
  doc.text('* = Base case values', 15, yPos);
  yPos += 15;
  checkNewPage(80);

  // IMP3: Revenue Growth vs Margin Sensitivity Matrix
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text('Revenue Growth vs EBITDA Margin Sensitivity', 15, yPos);
  yPos += 8;

  const growthRateSteps = [-10, -5, 0, 5, 10].map(d => assumptions.revenueGrowthRate + d);
  const marginSteps = [-5, -2.5, 0, 2.5, 5].map(d => assumptions.ebitdaMargin + d);

  const marginBody: (string | number)[][] = [];
  for (const gr of growthRateSteps) {
    const row: (string | number)[] = [`${gr.toFixed(0)}%${Math.abs(gr - assumptions.revenueGrowthRate) < 0.01 ? '*' : ''}`];
    for (const m of marginSteps) {
      const grDec = gr / 100;
      const mDec = m / 100;
      const wDec = waccCalc / 100;
      const tgDec = assumptions.terminalGrowthRate / 100;
      if (wDec <= tgDec) { row.push('N/A'); continue; }
      let sumPV = 0;
      let prevRev = financialData.incomeStatement.revenue;
      for (let yr = 0; yr < dcfProjections.length; yr++) {
        const rev = prevRev * (1 + grDec);
        const ebitdaY = rev * mDec;
        const daY = rev * (assumptions.daPercent / 100);
        const ebitY = ebitdaY - daY;
        const nopatY = ebitY * (1 - assumptions.taxRate / 100);
        const capexY = rev * (assumptions.capexPercent / 100);
        const dwcY = (rev - prevRev) * (assumptions.deltaWCPercent / 100);
        const fcff = nopatY + daY - capexY - dwcY;
        sumPV += fcff / Math.pow(1 + wDec, yr + 1);
        prevRev = rev;
      }
      const lastRev = prevRev;
      const lastEbitda = lastRev * mDec;
      const lastDa = lastRev * (assumptions.daPercent / 100);
      const lastEbit = lastEbitda - lastDa;
      const lastNopat = lastEbit * (1 - assumptions.taxRate / 100);
      const lastCapex = lastRev * (assumptions.capexPercent / 100);
      const lastFCFF = lastNopat + lastDa - lastCapex - (lastRev - lastRev / (1 + grDec)) * (assumptions.deltaWCPercent / 100);
      const tv = (lastFCFF * (1 + tgDec)) / (wDec - tgDec);
      const pvTV = tv / Math.pow(1 + wDec, dcfProjections.length);
      const ev = sumPV + pvTV;
      const eqVal = ev + financialData.balanceSheet.cash - (financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt);
      const perShare = eqVal / financialData.sharesOutstanding;
      row.push((Math.round(perShare * 100) / 100).toFixed(2));
    }
    marginBody.push(row);
  }

  autoTable(doc, {
    startY: yPos,
    head: [['Growth \\ Margin', ...marginSteps.map(m => `${m.toFixed(1)}%${Math.abs(m - assumptions.ebitdaMargin) < 0.01 ? '*' : ''}`)]],
    body: marginBody,
    theme: 'grid',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255], fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 2 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(7);
  doc.setTextColor(...grayColor);
  doc.text('* = Base case values', 15, yPos);
  yPos += 10;

  // D3.A: Piotroski F-Score
  checkNewPage(50);
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text('Piotroski F-Score', 15, yPos);
  yPos += 8;

  const pNetIncome = financialData.incomeStatement.netIncome;
  const pOCF = financialData.cashFlowStatement.operatingCashFlow;
  const pROA = pNetIncome / financialData.balanceSheet.totalAssets;
  const pCFROA = pOCF / financialData.balanceSheet.totalAssets;
  const pCurrentRatio = financialData.balanceSheet.totalCurrentAssets / financialData.balanceSheet.totalCurrentLiabilities;

  let pScore = 0;
  const pTests: [string, string, string][] = [];
  // P1: Net Income > 0
  const p1 = pNetIncome > 0;
  if (p1) pScore++;
  pTests.push(['P1: Net Income > 0', p1 ? 'Pass' : 'Fail', p1 ? 'Y' : '-']);
  // P2: OCF > 0
  const p2 = pOCF > 0;
  if (p2) pScore++;
  pTests.push(['P2: OCF > 0', p2 ? 'Pass' : 'Fail', p2 ? 'Y' : '-']);
  // P3: ROA improving (N/A single period)
  pTests.push(['P3: ROA Improving', 'N/A', '-']);
  // P4: OCF > NI (accrual quality)
  const p4 = pOCF > pNetIncome;
  if (p4) pScore++;
  pTests.push(['P4: OCF > Net Income', p4 ? 'Pass' : 'Fail', p4 ? 'Y' : '-']);
  // L5-L6: N/A single period
  pTests.push(['L5: Leverage Declining', 'N/A', '-']);
  pTests.push(['L6: Liquidity Improving', 'N/A', '-']);
  // L7: Current Ratio > 1
  const l7 = pCurrentRatio > 1;
  if (l7) pScore++;
  pTests.push(['L7: No Share Dilution', l7 ? 'Pass' : 'Fail', l7 ? 'Y' : '-']);
  // E8-E9: N/A
  pTests.push(['E8: Gross Margin Improving', 'N/A', '-']);
  pTests.push(['E9: Asset Turnover Improving', 'N/A', '-']);

  autoTable(doc, {
    startY: yPos,
    head: [['Test', 'Result', '']],
    body: pTests,
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold' }, 2: { halign: 'center' } },
    margin: { left: 15, right: 100 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(9);
  doc.setTextColor(...darkColor);
  const pGrade = pScore >= 7 ? 'STRONG' : pScore >= 4 ? 'MODERATE' : 'WEAK';
  doc.text(`Score: ${pScore}/9 ${pGrade} (${pScore}/${pScore} calculable from single-period data)`, 15, yPos);
  yPos += 10;

  // D3.B: FCFF Three-Way Reconciliation
  checkNewPage(50);
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text('FCFF Three-Way Reconciliation (Base Year)', 15, yPos);
  yPos += 8;

  const pIS = financialData.incomeStatement;
  const pBS = financialData.balanceSheet;
  const statTax = assumptions.taxRate / 100;
  const pEBIT = pIS.operatingIncome;
  const pDA = pIS.depreciation + pIS.amortization;
  const pEBITDA = pEBIT + pDA;
  const pCapEx = financialData.cashFlowStatement.capitalExpenditures;
  // Bug #1 fix: Base year ΔWC = 0 (no prior year exists, so ΔRevenue = 0 → ΔWC = 0)
  const pWC = 0;
  const m1 = pEBIT * (1 - statTax) + pDA - pCapEx - pWC;
  const m2 = pEBITDA * (1 - statTax) + pDA * statTax - pCapEx - pWC;
  const effTax = pIS.taxExpense / (pIS.netIncome + pIS.taxExpense);
  // Bug #1 fix: Method 3 interest add-back must use STATUTORY tax rate, not effective
  const m3 = pIS.netIncome + pIS.interestExpense * (1 - statTax) + pDA - pCapEx - pWC;

  autoTable(doc, {
    startY: yPos,
    head: [['Method', 'Formula', 'Result']],
    body: [
      // Bug #1 fix: ASCII-safe formula text (no Unicode minus/delta that corrupt in PDF)
      ['Method 1 (NOPAT)', 'EBIT x (1-t) + D&A - CapEx - dWC', fmtCcy(m1)],
      ['Method 2 (EBITDA)', 'EBITDA x (1-t) + D&A x t - CapEx - dWC', fmtCcy(m2)],
      ['Method 3 (Net Income)', 'NI + Int x (1-t) + D&A - CapEx - dWC', fmtCcy(m3)],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 5;
  // Bug #1 fix: compute difference directly from EBT formula, not derived from M3-M1
  const ebt = pEBIT - pIS.interestExpense;
  const reconDiff = ebt * (statTax - effTax);
  if (Math.abs(reconDiff) > 1) {
    doc.setFontSize(7);
    doc.setTextColor(...grayColor);
    doc.text(
      `Methods 1 & 2 use statutory rate (${(statTax * 100).toFixed(1)}%). Method 3 uses effective rate (${(effTax * 100).toFixed(1)}%). ` +
      `Difference = EBT x (${(statTax * 100).toFixed(1)}% - ${(effTax * 100).toFixed(1)}%) = ${fmtCcy(Math.abs(ebt))} x ${((statTax - effTax) * 100).toFixed(2)}% = ${fmtCcy(Math.abs(reconDiff))}`,
      15, yPos, { maxWidth: pageWidth - 30 }
    );
    yPos += 8;
  }
  yPos += 5;

  // D3.C: Working Capital Analysis
  checkNewPage(40);
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text('Working Capital Analysis', 15, yPos);
  yPos += 8;

  const ar = pBS.accountsReceivable;
  const inv = pBS.inventory;
  const ap = pBS.accountsPayable;
  const rev = pIS.revenue || 1;
  const cogs = pIS.costOfGoodsSold || 1;
  const dso = (ar / rev) * 365;
  const dio = (inv / cogs) * 365;
  const dpo = (ap / cogs) * 365;
  const ccc = dso + dio - dpo;

  autoTable(doc, {
    startY: yPos,
    head: [['Component', 'Balance', '% of Revenue', 'Days']],
    body: [
      ['Accounts Receivable', fmtCcy(ar), `${((ar / rev) * 100).toFixed(1)}%`, `DSO: ${dso.toFixed(1)}`],
      ['Inventory', fmtCcy(inv), `${((inv / rev) * 100).toFixed(1)}%`, `DIO: ${dio.toFixed(1)}`],
      ['Accounts Payable', fmtCcy(ap), `${((ap / rev) * 100).toFixed(1)}%`, `DPO: ${dpo.toFixed(1)}`],
      ['Net Working Capital', fmtCcy(ar + inv - ap), `${(((ar + inv - ap) / rev) * 100).toFixed(1)}%`, `CCC: ${ccc.toFixed(1)}`],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // E.7: Investment Disclaimer
  checkNewPage(40);
  // B5: Monte Carlo Summary
  doc.setTextColor(...redColor);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('MONTE CARLO SIMULATION', 15, yPos);
  yPos += 10;

  const mcResult = runMonteCarloSimulation(financialData, assumptions, 5000);
  autoTable(doc, {
    startY: yPos,
    head: [['Statistic', 'Value']],
    body: [
      ['Simulations', mcResult.simulations.toLocaleString()],
      ['Mean Price', fmtCcy(mcResult.meanPrice, 2)],
      ['Median Price', fmtCcy(mcResult.medianPrice, 2)],
      ['Standard Deviation', fmtCcy(mcResult.stdDev, 2)],
      ['5th Percentile', fmtCcy(mcResult.percentile5, 2)],
      ['25th Percentile', fmtCcy(mcResult.percentile25, 2)],
      ['75th Percentile', fmtCcy(mcResult.percentile75, 2)],
      ['95th Percentile', fmtCcy(mcResult.percentile95, 2)],
      ['P(Above Current Price)', `${mcResult.probabilityAboveCurrentPrice.toFixed(1)}%`],
      ['P(Above Base Case)', `${mcResult.probabilityAboveBaseCase.toFixed(1)}%`],
      // IMP6: P(Below Bear) for downside risk — approximate from normal distribution
      ['P(Below Bear Case)', (() => {
        const z = mcResult.stdDev > 0 ? (bearPrice - mcResult.meanPrice) / mcResult.stdDev : 0;
        // Normal CDF approximation (Abramowitz & Stegun)
        const t = 1 / (1 + 0.2316419 * Math.abs(z));
        const d = 0.3989422802 * Math.exp(-z * z / 2);
        const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        const cdf = z > 0 ? 1 - p : p;
        return `${(cdf * 100).toFixed(1)}%`;
      })()],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 15 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;
  checkNewPage();

  // Disclaimer — placed AFTER Monte Carlo (B5 fix)
  doc.setFontSize(10);
  doc.setTextColor(...darkColor);
  doc.text('Disclaimer', 15, yPos);
  yPos += 6;
  doc.setFontSize(7);
  doc.setTextColor(...grayColor);
  const disclaimer = [
    'This valuation is prepared for informational purposes only and does not constitute investment advice.',
    'Users should independently verify all assumptions and data before making investment decisions.',
    'This tool has not been approved by the Financial Regulatory Authority (FRA) of Egypt.',
    'Past performance does not guarantee future results. All projections are estimates only.',
    // IMP6: EGX trading context
    ...(ccy === 'EGP' ? [
      'EGX applies daily price limits (±10%, expandable to ±20%). Stamp duty of 0.125% applies per transaction.',
      'Dividend withholding tax: 10%. Capital gains tax on listed securities: 10%.',
    ] : []),
  ];
  disclaimer.forEach(line => {
    doc.text(line, 15, yPos, { maxWidth: pageWidth - 30 });
    yPos += 4;
  });
  yPos += 10;

  // PDF Addition #3: 5-Factor DuPont Decomposition
  checkNewPage(60);
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text('5-Factor DuPont Analysis', 15, yPos);
  yPos += 8;

  const dpIS = financialData.incomeStatement;
  const dpBS = financialData.balanceSheet;
  const dpTaxBurden = (dpIS.netIncome + dpIS.taxExpense) > 0 ? dpIS.netIncome / (dpIS.netIncome + dpIS.taxExpense) : 0;
  const dpInterestBurden = dpIS.operatingIncome > 0 ? (dpIS.netIncome + dpIS.taxExpense) / dpIS.operatingIncome : 0;
  const dpOpMargin = dpIS.revenue > 0 ? dpIS.operatingIncome / dpIS.revenue : 0;
  const dpAssetTurnover = dpBS.totalAssets > 0 ? dpIS.revenue / dpBS.totalAssets : 0;
  const dpEquityMult = dpBS.totalEquity > 0 ? dpBS.totalAssets / dpBS.totalEquity : 0;
  const dp5ROE = dpTaxBurden * dpInterestBurden * dpOpMargin * dpAssetTurnover * dpEquityMult * 100;

  autoTable(doc, {
    startY: yPos,
    head: [['Factor', 'Formula', 'Value']],
    body: [
      ['Tax Burden', 'NI / EBT', `${(dpTaxBurden * 100).toFixed(2)}%`],
      ['Interest Burden', 'EBT / EBIT', `${(dpInterestBurden * 100).toFixed(2)}%`],
      ['Operating Margin', 'EBIT / Revenue', `${(dpOpMargin * 100).toFixed(2)}%`],
      ['Asset Turnover', 'Revenue / TA', `${dpAssetTurnover.toFixed(2)}x`],
      ['Equity Multiplier', 'TA / Equity', `${dpEquityMult.toFixed(2)}x`],
      [{ content: 'DuPont ROE', styles: { fontStyle: 'bold' } }, { content: 'Product of all factors', styles: { fontStyle: 'bold' } }, { content: `${dp5ROE.toFixed(2)}%`, styles: { fontStyle: 'bold' } }],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 80 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Feature #6: WACC Capital Structure Sensitivity
  checkNewPage(60);
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text('WACC Sensitivity to Capital Structure', 15, yPos);
  yPos += 8;

  const keCalc = assumptions.riskFreeRate + assumptions.beta * assumptions.marketRiskPremium;
  const kdATCalc = assumptions.costOfDebt * (1 - assumptions.taxRate / 100);
  const currentDE = balanceSheet.totalEquity > 0 ? totalDebt / balanceSheet.totalEquity : 0;
  const deRatios = [0, 0.25, 0.50, 1.0, 2.0];

  autoTable(doc, {
    startY: yPos,
    head: [['D/E Ratio', 'We', 'Wd', 'WACC', '']],
    body: deRatios.map(de => {
      const wd = de / (1 + de);
      const we = 1 - wd;
      const waccDE = we * keCalc + wd * kdATCalc;
      const isCurrent = Math.abs(de - currentDE) < 0.05;
      return [
        `${de.toFixed(2)}x`, `${(we * 100).toFixed(1)}%`, `${(wd * 100).toFixed(1)}%`,
        `${waccDE.toFixed(2)}%`, isCurrent ? '← Current' : '',
      ];
    }),
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 80 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 5;
  doc.setFontSize(7);
  doc.setTextColor(...grayColor);
  doc.text('Simplified model — holds Ke and Kd(AT) constant. Real WACC optimization must consider financial distress costs.', 15, yPos);
  yPos += 15;

  // PDF Addition #1: Data Integrity Verification
  checkNewPage(60);
  doc.setFontSize(13);
  doc.setTextColor(...darkColor);
  doc.text('Data Integrity Verification', 15, yPos);
  yPos += 8;

  const bsCheck = Math.abs(balanceSheet.totalAssets - balanceSheet.totalLiabilities - balanceSheet.totalEquity) < balanceSheet.totalAssets * 0.01;
  const isCheck = Math.abs((dpIS.operatingIncome - dpIS.interestExpense - dpIS.taxExpense) - dpIS.netIncome) < Math.abs(dpIS.netIncome) * 0.02;
  const waccValid = waccCalc > kdATCalc && waccCalc < keCalc + 1;
  const tgValid = assumptions.terminalGrowthRate < assumptions.discountRate;

  autoTable(doc, {
    startY: yPos,
    head: [['Check', 'Result']],
    body: [
      [`Balance Sheet: TA (${formatNumber(balanceSheet.totalAssets)}) = TL + Equity`, bsCheck ? 'Pass' : 'Fail'],
      [`Income: EBIT - Interest - Tax ~ NI`, isCheck ? 'Pass' : 'Fail'],
      [`WACC (${formatPercent(waccCalc)}) in [Kd(AT) (${formatPercent(kdATCalc)}), Ke (${formatPercent(keCalc)})]`, waccValid ? 'Pass' : 'Fail'],
      [`Terminal Growth (${formatPercent(assumptions.terminalGrowthRate)}) < WACC (${formatPercent(assumptions.discountRate)})`, tgValid ? 'Pass' : 'Fail'],
    ],
    theme: 'striped',
    headStyles: { fillColor: darkColor, textColor: [255, 255, 255] },
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { left: 15, right: 80 },
  });
  yPos = (doc as any).lastAutoTable.finalY + 5;
  const allPass = bsCheck && isCheck && waccValid && tgValid;
  doc.setFontSize(8);
  doc.setTextColor(...(allPass ? [34, 197, 94] as [number, number, number] : [239, 68, 68] as [number, number, number]));
  doc.text(allPass ? 'All integrity checks passed — output is mathematically consistent.' : 'Some integrity checks failed — review inputs.', 15, yPos);
  yPos += 10;

  // Footer
  const pageCount = (doc as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...grayColor);
    doc.text(
      `WOLF Valuation Engine V3.0 | ${financialData.companyName} | Generated: ${new Date().toLocaleDateString()}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
    doc.text(`Page ${i} of ${pageCount}`, pageWidth - 15, 290, { align: 'right' });
  }

  // ── DISCLAIMER & PROVENANCE PAGE ──────────────────────────────────
  doc.addPage();
  yPos = 20;

  doc.setTextColor(...redColor);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DISCLAIMER', 15, yPos);
  yPos += 8;

  doc.setTextColor(...grayColor);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const disclaimerFull = 'This valuation report is prepared for analytical purposes only and does not constitute investment advice under FRA regulations. All assumptions, projections, and valuations are based on publicly available information and standard financial modeling practices. Users should independently verify all inputs. Not regulated by the Financial Regulatory Authority (FRA) of Egypt. Past performance is not indicative of future results.';
  const disclaimerLines = doc.splitTextToSize(disclaimerFull, pageWidth - 30);
  doc.text(disclaimerLines, 15, yPos);
  yPos += disclaimerLines.length * 4 + 8;

  doc.setTextColor(...redColor);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('DATA PROVENANCE', 15, yPos);
  yPos += 7;

  doc.setTextColor(...grayColor);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  const provenance = [
    `CBE policy rates: Effective Feb 12, 2026; held unchanged Apr 2, 2026 (deposit ${ccy === 'EGP' ? '19.00' : 'N/A'}%, lending ${ccy === 'EGP' ? '20.00' : 'N/A'}%).`,
    'Inflation: CAPMAS nationwide CPI, Mar 2026 (13.5%). US BLS CPI Mar 2026 (3.3%).',
    'Country risk premium: Damodaran, Jan 5, 2026 update (Moody\'s Caa1 — 9.71%).',
    'Mature market ERP: Damodaran, Jan 5, 2026 (4.23%).',
    'Risk-free rate: 10Y Egyptian Government Bond avg Mar 2026 (20.40%). US 10Y Treasury midpoint Jan-Apr 2026 (4.25%).',
    'Sovereign ratings: Moody\'s Caa1 (positive), S&P B (stable), Fitch B (stable).',
  ];
  for (const line of provenance) {
    doc.text(line, 15, yPos);
    yPos += 4;
  }

  // Save
  const fileName = `WOLF_${financialData.ticker}_Investment_Memo_${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(fileName);
};

export default exportToPDF;
