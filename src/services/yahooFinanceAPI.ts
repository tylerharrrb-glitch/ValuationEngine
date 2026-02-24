// WOLF Valuation Engine - Yahoo Finance Fallback for Egyptian Market
// Uses Yahoo Finance v8 API via CORS proxy for browser compatibility

import { FinancialData } from '../types/financial';

// CORS proxy fallback chain — try multiple proxies in order
const CORS_PROXIES = [
  { name: 'allorigins', url: 'https://api.allorigins.win/raw?url=', encode: true },
  { name: 'codetabs', url: 'https://api.codetabs.com/v1/proxy?quest=', encode: false },
  { name: 'corsproxy', url: 'https://corsproxy.io/?', encode: true },
];
const YAHOO_BASE = 'https://query1.finance.yahoo.com';

// ============================================
// Yahoo Finance Response Interfaces
// ============================================

interface YahooQuoteSummary {
  quoteSummary?: {
    result?: YahooResult[];
    error?: { code: string; description: string };
  };
}

interface YahooResult {
  price?: {
    symbol?: string;
    shortName?: string;
    longName?: string;
    regularMarketPrice?: { raw: number };
    marketCap?: { raw: number };
    sharesOutstanding?: { raw: number };
    currency?: string;
  };
  defaultKeyStatistics?: {
    beta?: { raw: number };
    sharesOutstanding?: { raw: number };
  };
  incomeStatementHistory?: {
    incomeStatementHistory?: YahooIncomeStatement[];
  };
  balanceSheetHistory?: {
    balanceSheetStatements?: YahooBalanceSheet[];
  };
  cashflowStatementHistory?: {
    cashflowStatements?: YahooCashFlow[];
  };
}

interface YahooIncomeStatement {
  totalRevenue?: { raw: number };
  costOfRevenue?: { raw: number };
  grossProfit?: { raw: number };
  totalOperatingExpenses?: { raw: number };
  operatingIncome?: { raw: number };
  interestExpense?: { raw: number };
  incomeTaxExpense?: { raw: number };
  netIncome?: { raw: number };
  ebitda?: { raw: number };
  endDate?: { raw: number; fmt: string };
}

interface YahooBalanceSheet {
  cash?: { raw: number };
  shortTermInvestments?: { raw: number };
  netReceivables?: { raw: number };
  inventory?: { raw: number };
  totalCurrentAssets?: { raw: number };
  propertyPlantEquipment?: { raw: number };
  longTermInvestments?: { raw: number };
  goodWill?: { raw: number };
  intangibleAssets?: { raw: number };
  otherAssets?: { raw: number };
  totalAssets?: { raw: number };
  accountsPayable?: { raw: number };
  shortLongTermDebt?: { raw: number };
  totalCurrentLiabilities?: { raw: number };
  longTermDebt?: { raw: number };
  totalLiab?: { raw: number };
  totalStockholderEquity?: { raw: number };
  endDate?: { raw: number; fmt: string };
}

interface YahooCashFlow {
  totalCashFromOperatingActivities?: { raw: number };
  capitalExpenditures?: { raw: number };
  dividendsPaid?: { raw: number };
  changeInCash?: { raw: number };
  endDate?: { raw: number; fmt: string };
}

// ============================================
// Helper: Extract raw value from Yahoo Finance field
// ============================================
function raw(field?: { raw: number }): number {
  return field?.raw || 0;
}

// ============================================
// MAIN: Fetch from Yahoo Finance
// ============================================
export async function fetchFromYahoo(
  ticker: string
): Promise<{ success: boolean; data?: FinancialData; error?: string }> {
  // Ensure .CA suffix for Egyptian stocks
  const yahooTicker = ticker.toUpperCase().endsWith('.CA')
    ? ticker.toUpperCase()
    : `${ticker.toUpperCase()}.CA`;

  console.log(`\n${'='.repeat(50)}`);
  console.log(`[WOLF Yahoo] 🇪🇬 Fetching Egyptian market data for: ${yahooTicker}`);
  console.log(`${'='.repeat(50)}\n`);

  const modules = [
    'price',
    'defaultKeyStatistics',
    'incomeStatementHistory',
    'balanceSheetHistory',
    'cashflowStatementHistory',
  ].join(',');

  const targetUrl = `${YAHOO_BASE}/v10/finance/quoteSummary/${yahooTicker}?modules=${modules}`;

  try {
    console.log(`[WOLF Yahoo] 📊 Fetching quoteSummary...`);

    // Try each proxy in order until one succeeds
    let response: Response | null = null;
    let lastError = '';

    for (const proxy of CORS_PROXIES) {
      try {
        const proxyUrl = proxy.encode
          ? `${proxy.url}${encodeURIComponent(targetUrl)}`
          : `${proxy.url}${targetUrl}`;

        console.log(`[WOLF Yahoo] 🔄 Trying proxy: ${proxy.name}...`);
        const res = await fetch(proxyUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0',
          },
        });

        if (res.ok) {
          response = res;
          console.log(`[WOLF Yahoo] ✅ Proxy ${proxy.name} succeeded!`);
          break;
        } else {
          lastError = `${proxy.name}: HTTP ${res.status}`;
          console.warn(`[WOLF Yahoo] ⚠ Proxy ${proxy.name} returned HTTP ${res.status}`);
        }
      } catch (proxyErr) {
        lastError = `${proxy.name}: ${proxyErr instanceof Error ? proxyErr.message : 'failed'}`;
        console.warn(`[WOLF Yahoo] ⚠ Proxy ${proxy.name} error: ${lastError}`);
      }
    }

    if (!response) {
      throw new Error(`All CORS proxies failed. Last error: ${lastError}`);
    }

    const json: YahooQuoteSummary = await response.json();

    if (json.quoteSummary?.error) {
      throw new Error(json.quoteSummary.error.description || 'Yahoo Finance API error');
    }

    const result = json.quoteSummary?.result?.[0];
    if (!result) {
      throw new Error(`No data found for ${yahooTicker} on Yahoo Finance`);
    }

    // Extract data from modules
    const price = result.price;
    const stats = result.defaultKeyStatistics;
    const incomeStmts = result.incomeStatementHistory?.incomeStatementHistory;
    const balanceSheets = result.balanceSheetHistory?.balanceSheetStatements;
    const cashFlows = result.cashflowStatementHistory?.cashflowStatements;

    if (!price) {
      throw new Error(`No price data for ${yahooTicker}`);
    }

    // Use most recent statements (index 0)
    const income = incomeStmts?.[0];
    const bs = balanceSheets?.[0];
    const cf = cashFlows?.[0];

    const companyName = price.longName || price.shortName || yahooTicker;
    const currentPrice = raw(price.regularMarketPrice);
    const sharesOutstanding = raw(stats?.sharesOutstanding) || raw(price.sharesOutstanding) ||
      (raw(price.marketCap) > 0 && currentPrice > 0 ? Math.round(raw(price.marketCap) / currentPrice) : 1000000000);

    // Map to our FinancialData structure
    const revenue = raw(income?.totalRevenue);
    const cogs = raw(income?.costOfRevenue);
    const interestExp = raw(income?.interestExpense);
    const operatingIncome = raw(income?.operatingIncome);

    // Bank detection: Egyptian banks typically have 0 COGS but large interest expense
    const isBankTicker = /^(CIB|COMI|ALEX|FAISAL|ASGR|ADIB|QNB|HDBK)/i.test(yahooTicker.replace('.CA', ''));
    const isFinancialSector = isBankTicker || (cogs === 0 && interestExp > 0 && revenue > 0);

    // For banks: Interest Expense is the cost of revenue
    const effectiveCogs = isFinancialSector && cogs === 0 ? interestExp : cogs;
    const grossProfit = isFinancialSector && cogs === 0
      ? revenue - interestExp
      : (raw(income?.grossProfit) || (revenue - cogs));
    const operatingExpenses = revenue > 0 ? grossProfit - operatingIncome : 0;

    if (isFinancialSector) {
      console.log(`[WOLF Yahoo] \u{1F3E6} Financial sector detected \u2014 Gross Profit = Revenue - Interest Expense`);
    }

    // Balance sheet
    const cash = raw(bs?.cash);
    const shortTermInvestments = raw(bs?.shortTermInvestments);
    const netReceivables = raw(bs?.netReceivables);
    const inventory = raw(bs?.inventory);
    const totalCurrentAssets = raw(bs?.totalCurrentAssets);
    const ppe = raw(bs?.propertyPlantEquipment);
    const longTermInvestments = raw(bs?.longTermInvestments);
    const goodwill = raw(bs?.goodWill);
    const intangibleAssets = raw(bs?.intangibleAssets);
    const totalAssets = raw(bs?.totalAssets);
    const accountsPayable = raw(bs?.accountsPayable);
    const shortTermDebt = raw(bs?.shortLongTermDebt);
    const totalCurrentLiabilities = raw(bs?.totalCurrentLiabilities);
    const longTermDebt = raw(bs?.longTermDebt);
    const totalLiabilities = raw(bs?.totalLiab);
    const totalEquity = raw(bs?.totalStockholderEquity);

    // Cash flow
    const operatingCF = raw(cf?.totalCashFromOperatingActivities);
    const capex = Math.abs(raw(cf?.capitalExpenditures));
    const dividendsPaid = Math.abs(raw(cf?.dividendsPaid));
    const netChangeInCash = raw(cf?.changeInCash);
    const freeCashFlow = operatingCF - capex;

    // Compute depreciation from EBITDA if available
    const ebitda = raw(income?.ebitda);
    const depreciation = ebitda > 0 && operatingIncome > 0 ? ebitda - operatingIncome : 0;

    // Derive lastReportedDate from income statement
    const lastReportedDate = income?.endDate?.fmt || undefined;

    const financialData: FinancialData = {
      companyName,
      ticker: yahooTicker,
      currentStockPrice: currentPrice,
      sharesOutstanding,
      lastReportedDate,
      sector: isFinancialSector ? 'Financial Services' : undefined,
      dividendsPerShare: sharesOutstanding > 0 ? dividendsPaid / sharesOutstanding : 0,

      incomeStatement: {
        revenue,
        costOfGoodsSold: effectiveCogs,
        grossProfit,
        operatingExpenses: Math.max(0, operatingExpenses),
        operatingIncome,
        interestExpense: raw(income?.interestExpense),
        taxExpense: raw(income?.incomeTaxExpense),
        netIncome: raw(income?.netIncome),
        depreciation,
        amortization: 0,
      },

      balanceSheet: {
        cash,
        marketableSecurities: shortTermInvestments,
        accountsReceivable: netReceivables,
        inventory,
        otherCurrentAssets: Math.max(0, totalCurrentAssets - cash - shortTermInvestments - netReceivables - inventory),
        totalCurrentAssets,
        propertyPlantEquipment: ppe,
        longTermInvestments,
        goodwill,
        intangibleAssets,
        otherNonCurrentAssets: Math.max(0, totalAssets - totalCurrentAssets - ppe - longTermInvestments - goodwill - intangibleAssets),
        totalAssets,
        accountsPayable,
        shortTermDebt,
        otherCurrentLiabilities: Math.max(0, totalCurrentLiabilities - accountsPayable - shortTermDebt),
        totalCurrentLiabilities,
        longTermDebt,
        otherNonCurrentLiabilities: Math.max(0, totalLiabilities - totalCurrentLiabilities - longTermDebt),
        totalLiabilities,
        totalEquity,
      },

      cashFlowStatement: {
        operatingCashFlow: operatingCF,
        capitalExpenditures: capex,
        freeCashFlow,
        dividendsPaid,
        netChangeInCash,
      },
    };

    console.log(`\n${'='.repeat(50)}`);
    console.log(`[WOLF Yahoo] ✅ SUCCESS! Data loaded for ${companyName}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`  • Company: ${companyName}`);
    console.log(`  • Price: ${currentPrice} ${price.currency || 'EGP'}`);
    console.log(`  • Shares: ${(sharesOutstanding / 1e9).toFixed(2)}B`);
    console.log(`  • Revenue: ${(revenue / 1e9).toFixed(2)}B`);
    console.log(`  • Net Income: ${(raw(income?.netIncome) / 1e9).toFixed(2)}B`);
    console.log(`${'='.repeat(50)}\n`);

    return { success: true, data: financialData };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown Yahoo Finance error';

    console.error(`\n${'='.repeat(50)}`);
    console.error(`[WOLF Yahoo] ❌ FAILED for ${yahooTicker}: ${errorMessage}`);
    console.error(`${'='.repeat(50)}\n`);

    return { success: false, error: errorMessage };
  }
}
