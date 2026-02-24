// WOLF Valuation Engine - Stock API Service
// Uses Financial Modeling Prep NEW Stable API (2026 format)
// Endpoints: https://financialmodelingprep.com/stable/

import { FinancialData } from '../types/financial';

const BASE_URL = 'https://financialmodelingprep.com/stable';

// ============================================
// API RESPONSE INTERFACES
// ============================================

interface FMPProfile {
  symbol: string;
  companyName: string;
  price: number;
  mktCap: number;
  beta?: number;
  sharesOutstanding?: number;
  marketCap?: number;
  industry?: string;
  sector?: string;
  currency?: string;
}

interface FMPIncomeStatement {
  date: string;
  symbol: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  operatingExpenses: number;
  operatingIncome: number;
  interestExpense: number;
  incomeBeforeTax: number;
  incomeTaxExpense: number;
  netIncome: number;
  eps: number;
  epsdiluted: number;
  depreciationAndAmortization: number;
  ebitda: number;
}

interface FMPBalanceSheet {
  date: string;
  symbol: string;
  cashAndCashEquivalents: number;
  shortTermInvestments: number;
  netReceivables: number;
  inventory: number;
  totalCurrentAssets: number;
  propertyPlantEquipmentNet: number;
  longTermInvestments: number;
  goodwill: number;
  intangibleAssets: number;
  otherNonCurrentAssets: number;
  totalAssets: number;
  accountPayables: number;
  shortTermDebt: number;
  totalCurrentLiabilities: number;
  longTermDebt: number;
  totalDebt: number;
  totalLiabilities: number;
  totalStockholdersEquity: number;
  totalEquity: number;
}

interface FMPCashFlow {
  date: string;
  symbol: string;
  netIncome: number;
  depreciationAndAmortization: number;
  operatingCashFlow: number;
  capitalExpenditure: number;
  freeCashFlow: number;
  // FMP uses multiple field names for dividends across API versions
  dividendsPaid?: number;
  commonDividendsPaid?: number;   // Primary FMP field (negative = outflow)
  netDividendsPaid?: number;      // Alternative FMP field
  commonStockRepurchased?: number; // Buybacks (negative = outflow)
  netChangeInCash: number;
}

// ============================================
// HELPER: Generic Fetch with Error Handling
// ============================================

async function fetchEndpoint<T>(
  endpoint: string,
  ticker: string,
  apiKey: string,
  additionalParams: string = ''
): Promise<T | null> {
  // NEW 2026 FORMAT: Use query parameters instead of path parameters
  const url = `${BASE_URL}/${endpoint}?symbol=${ticker.toUpperCase()}${additionalParams}&apikey=${apiKey}`;

  console.log(`[WOLF API] Fetching ${endpoint} from: ${url.replace(apiKey, 'API_KEY_HIDDEN')}`);

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[WOLF API] ❌ HTTP Error ${response.status}: ${errorText}`);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    // Check for API error messages
    if (data && typeof data === 'object' && 'Error Message' in data) {
      console.error(`[WOLF API] ❌ API Error: ${data['Error Message']}`);
      throw new Error(data['Error Message']);
    }

    // Check for legacy endpoint error
    if (data && typeof data === 'string' && data.includes('Legacy')) {
      console.error(`[WOLF API] ❌ Legacy Endpoint Error: ${data}`);
      throw new Error(data);
    }

    // Check for empty response
    if (!data || (Array.isArray(data) && data.length === 0)) {
      console.error(`[WOLF API] ❌ Empty response for ${endpoint}`);
      throw new Error(`No data found for ${ticker}`);
    }

    console.log(`[WOLF API] ✅ ${endpoint} loaded successfully`);
    return data as T;

  } catch (error) {
    console.error(`[WOLF API] ❌ Fetch failed for ${endpoint}:`, error);
    throw error;
  }
}

// ============================================
// FETCH: Company Profile
// ============================================

async function fetchProfile(ticker: string, apiKey: string): Promise<FMPProfile | null> {
  console.log(`[WOLF API] 📊 Fetching company profile...`);

  const data = await fetchEndpoint<FMPProfile[]>('profile', ticker, apiKey);

  if (data && Array.isArray(data) && data.length > 0) {
    const profile = data[0];
    console.log(`[WOLF API] Company: ${profile.companyName}`);
    console.log(`[WOLF API] Price: $${profile.price}`);
    console.log(`[WOLF API] Market Cap: $${(profile.mktCap / 1e9).toFixed(2)}B`);
    console.log(`[WOLF API] Beta: ${profile.beta || 'N/A'}`);
    return profile;
  }

  // Try single object response
  if (data && !Array.isArray(data)) {
    const profile = data as unknown as FMPProfile;
    console.log(`[WOLF API] Company: ${profile.companyName}`);
    return profile;
  }

  return null;
}

// ============================================
// FETCH: Income Statement (Annual)
// ============================================

async function fetchIncomeStatement(ticker: string, apiKey: string): Promise<FMPIncomeStatement | null> {
  console.log(`[WOLF API] 📈 Fetching income statement (annual)...`);

  // Request annual data with limit=1 to get most recent year
  const data = await fetchEndpoint<FMPIncomeStatement[]>(
    'income-statement',
    ticker,
    apiKey,
    '&period=annual&limit=1'
  );

  if (data && Array.isArray(data) && data.length > 0) {
    const statement = data[0];
    console.log(`[WOLF API] Period: ${statement.date}`);
    console.log(`[WOLF API] Revenue: $${(statement.revenue / 1e9).toFixed(2)}B`);
    console.log(`[WOLF API] Net Income: $${(statement.netIncome / 1e9).toFixed(2)}B`);
    return statement;
  }

  return null;
}

// ============================================
// FETCH: Balance Sheet (Annual)
// ============================================

async function fetchBalanceSheet(ticker: string, apiKey: string): Promise<FMPBalanceSheet | null> {
  console.log(`[WOLF API] 🏦 Fetching balance sheet (annual)...`);

  const data = await fetchEndpoint<FMPBalanceSheet[]>(
    'balance-sheet-statement',
    ticker,
    apiKey,
    '&period=annual&limit=1'
  );

  if (data && Array.isArray(data) && data.length > 0) {
    const statement = data[0];
    console.log(`[WOLF API] Period: ${statement.date}`);
    console.log(`[WOLF API] Total Assets: $${(statement.totalAssets / 1e9).toFixed(2)}B`);
    console.log(`[WOLF API] Total Debt: $${(statement.totalDebt / 1e9).toFixed(2)}B`);
    console.log(`[WOLF API] Equity: $${(statement.totalStockholdersEquity / 1e9).toFixed(2)}B`);
    return statement;
  }

  return null;
}

// ============================================
// FETCH: Cash Flow Statement (Annual)
// ============================================

async function fetchCashFlow(ticker: string, apiKey: string): Promise<FMPCashFlow | null> {
  console.log(`[WOLF API] 💵 Fetching cash flow statement (annual)...`);

  const data = await fetchEndpoint<FMPCashFlow[]>(
    'cash-flow-statement',
    ticker,
    apiKey,
    '&period=annual&limit=1'
  );

  if (data && Array.isArray(data) && data.length > 0) {
    const statement = data[0];
    console.log(`[WOLF API] Period: ${statement.date}`);
    console.log(`[WOLF API] Operating CF: $${(statement.operatingCashFlow / 1e9).toFixed(2)}B`);
    console.log(`[WOLF API] Free Cash Flow: $${(statement.freeCashFlow / 1e9).toFixed(2)}B`);
    return statement;
  }

  return null;
}

// Extended financial data with beta for assumptions auto-fill
export interface ExtendedFinancialData extends FinancialData {
  beta?: number;
}

// ============================================
// MAIN: Fetch All Stock Data
// ============================================

export async function fetchFromAPI(
  ticker: string,
  apiKey: string
): Promise<{ success: boolean; data?: ExtendedFinancialData; error?: string }> {

  console.log(`\n${'='.repeat(50)}`);
  console.log(`[WOLF API] 🐺 Starting data fetch for: ${ticker.toUpperCase()}`);
  console.log(`[WOLF API] Using NEW Stable API format (2026)`);
  console.log(`${'='.repeat(50)}\n`);

  try {
    // Fetch all data in parallel for speed
    const [profile, incomeStatement, balanceSheet, cashFlow] = await Promise.all([
      fetchProfile(ticker, apiKey),
      fetchIncomeStatement(ticker, apiKey),
      fetchBalanceSheet(ticker, apiKey),
      fetchCashFlow(ticker, apiKey),
    ]);

    // Validate we got at least profile data
    if (!profile) {
      throw new Error(`Could not fetch profile for ${ticker}. Check if the ticker is valid.`);
    }

    // Calculate shares outstanding - CRITICAL: Get accurate value from API
    // Priority: 1. Direct from profile, 2. Calculate from market cap / price
    let sharesOutstanding = 0;

    if (profile.sharesOutstanding && profile.sharesOutstanding > 0) {
      sharesOutstanding = profile.sharesOutstanding;
      console.log(`[WOLF API] ✓ Shares Outstanding from profile: ${(sharesOutstanding / 1e9).toFixed(2)}B`);
    } else if (profile.mktCap && profile.price && profile.price > 0) {
      sharesOutstanding = Math.round(profile.mktCap / profile.price);
      console.log(`[WOLF API] ✓ Shares Outstanding calculated (mktCap/price): ${(sharesOutstanding / 1e9).toFixed(2)}B`);
    } else if (profile.marketCap && profile.price && profile.price > 0) {
      sharesOutstanding = Math.round(profile.marketCap / profile.price);
      console.log(`[WOLF API] ✓ Shares Outstanding calculated (marketCap/price): ${(sharesOutstanding / 1e9).toFixed(2)}B`);
    } else {
      // Fallback - use a reasonable default based on typical company size
      sharesOutstanding = 1000000000; // 1 billion as fallback
      console.log(`[WOLF API] ⚠ Shares Outstanding fallback: ${(sharesOutstanding / 1e9).toFixed(2)}B (API did not provide)`);
    }

    // Map API data to our FinancialData format (matching the type structure)
    const financialData: ExtendedFinancialData = {
      companyName: profile.companyName || ticker,
      ticker: ticker.toUpperCase(),
      currentStockPrice: profile.price || 0,
      sharesOutstanding: sharesOutstanding,
      beta: profile.beta,
      lastReportedDate: incomeStatement?.date,
      sector: profile.sector,
      dividendsPerShare: (() => {
        const divPaid = Math.abs(
          cashFlow?.commonDividendsPaid ?? cashFlow?.netDividendsPaid ?? cashFlow?.dividendsPaid ?? 0
        );
        return sharesOutstanding > 0 ? divPaid / sharesOutstanding : 0;
      })(),

      // Income Statement (nested object)
      incomeStatement: {
        revenue: incomeStatement?.revenue || 0,
        costOfGoodsSold: incomeStatement?.costOfRevenue || 0,
        grossProfit: incomeStatement?.grossProfit || 0,
        operatingExpenses: incomeStatement?.operatingExpenses || 0,
        operatingIncome: incomeStatement?.operatingIncome || 0,
        // FIX: If API reports 0 interest but there IS debt, assume ~2.8% cost of debt
        interestExpense: (incomeStatement?.interestExpense === 0 && (balanceSheet?.totalDebt || 0) > 0)
          ? (balanceSheet?.totalDebt || 0) * 0.028
          : (incomeStatement?.interestExpense || 0),
        taxExpense: incomeStatement?.incomeTaxExpense || 0,
        netIncome: incomeStatement?.netIncome || 0,
        depreciation: incomeStatement?.depreciationAndAmortization || 0,
        amortization: 0,
      },

      // Bank-specific fix: if sector is Financial and COGS is 0, use Interest Expense as cost of revenue
      ...((() => {
        const isFinancial = (profile.sector || '').toLowerCase().includes('financial') ||
          (profile.industry || '').toLowerCase().includes('bank');
        const cogs = incomeStatement?.costOfRevenue || 0;
        const interest = incomeStatement?.interestExpense || 0;
        if (isFinancial && cogs === 0 && interest > 0) {
          console.log(`[WOLF API] 🏦 Financial sector detected — recalculating Gross Profit as Revenue - Interest Expense`);
          return {
            incomeStatement: {
              revenue: incomeStatement?.revenue || 0,
              costOfGoodsSold: interest, // Interest Expense serves as COGS for banks
              grossProfit: (incomeStatement?.revenue || 0) - interest,
              operatingExpenses: incomeStatement?.operatingExpenses || 0,
              operatingIncome: incomeStatement?.operatingIncome || 0,
              interestExpense: interest,
              taxExpense: incomeStatement?.incomeTaxExpense || 0,
              netIncome: incomeStatement?.netIncome || 0,
              depreciation: incomeStatement?.depreciationAndAmortization || 0,
              amortization: 0,
            },
          };
        }
        return {};
      })()),

      // Balance Sheet (nested object)
      balanceSheet: {
        cash: balanceSheet?.cashAndCashEquivalents || 0,
        marketableSecurities: balanceSheet?.shortTermInvestments || 0,
        accountsReceivable: balanceSheet?.netReceivables || 0,
        inventory: balanceSheet?.inventory || 0,
        otherCurrentAssets: Math.max(0, (balanceSheet?.totalCurrentAssets || 0) - (balanceSheet?.cashAndCashEquivalents || 0) - (balanceSheet?.shortTermInvestments || 0) - (balanceSheet?.netReceivables || 0) - (balanceSheet?.inventory || 0)),
        totalCurrentAssets: balanceSheet?.totalCurrentAssets || 0,
        propertyPlantEquipment: balanceSheet?.propertyPlantEquipmentNet || 0,
        longTermInvestments: (() => {
          const apiLTI = balanceSheet?.longTermInvestments || 0;
          if (apiLTI > 0) return apiLTI;
          // Heuristic: If API reports 0 for longTermInvestments but otherNonCurrentAssets
          // is disproportionately large (e.g., Apple's ~$161B), it likely contains
          // non-current marketable securities that should be classified as investments.
          const ppe = balanceSheet?.propertyPlantEquipmentNet || 0;
          const gw = balanceSheet?.goodwill || 0;
          const ia = balanceSheet?.intangibleAssets || 0;
          const apiOther = balanceSheet?.otherNonCurrentAssets || 0;
          const nonCurrentTotal = (balanceSheet?.totalAssets || 0) - (balanceSheet?.totalCurrentAssets || 0);
          const identifiedNonCurrent = ppe + gw + ia;
          const unclassified = Math.max(0, nonCurrentTotal - identifiedNonCurrent);
          // If unclassified non-current assets are >40% of total non-current, reclassify as investments
          if (nonCurrentTotal > 0 && unclassified / nonCurrentTotal > 0.4) {
            // Use the API's otherNonCurrentAssets if available, otherwise use computed residual
            const reclassifyAmount = apiOther > 0 ? apiOther : unclassified;
            console.log(`[WOLF API] ⚡ Reclassifying ${(reclassifyAmount / 1e9).toFixed(1)}B of Other Non-Current Assets as Long-term Investments`);
            return reclassifyAmount;
          }
          return 0;
        })(),
        goodwill: balanceSheet?.goodwill || 0,
        intangibleAssets: balanceSheet?.intangibleAssets || 0,
        otherNonCurrentAssets: (() => {
          const ppe = balanceSheet?.propertyPlantEquipmentNet || 0;
          const gw = balanceSheet?.goodwill || 0;
          const ia = balanceSheet?.intangibleAssets || 0;
          const apiLTI = balanceSheet?.longTermInvestments || 0;
          const nonCurrentTotal = (balanceSheet?.totalAssets || 0) - (balanceSheet?.totalCurrentAssets || 0);
          const identifiedNonCurrent = ppe + gw + ia;
          const unclassified = Math.max(0, nonCurrentTotal - identifiedNonCurrent);
          // If we reclassified investments, subtract them from the residual
          if (apiLTI > 0) {
            return Math.max(0, unclassified - apiLTI);
          }
          // If heuristic reclassification happened (>40% unclassified), residual is 0
          if (nonCurrentTotal > 0 && unclassified / nonCurrentTotal > 0.4) {
            return 0;
          }
          return unclassified;
        })(),
        totalAssets: balanceSheet?.totalAssets || 0,
        accountsPayable: balanceSheet?.accountPayables || 0,
        shortTermDebt: balanceSheet?.shortTermDebt || 0,
        otherCurrentLiabilities: Math.max(0, (balanceSheet?.totalCurrentLiabilities || 0) - (balanceSheet?.accountPayables || 0) - (balanceSheet?.shortTermDebt || 0)),
        totalCurrentLiabilities: balanceSheet?.totalCurrentLiabilities || 0,
        longTermDebt: balanceSheet?.longTermDebt || 0,
        otherNonCurrentLiabilities: Math.max(0, (balanceSheet?.totalLiabilities || 0) - (balanceSheet?.totalCurrentLiabilities || 0) - (balanceSheet?.longTermDebt || 0)),
        totalLiabilities: balanceSheet?.totalLiabilities || 0,
        totalEquity: balanceSheet?.totalStockholdersEquity || balanceSheet?.totalEquity || 0,
      },

      // Cash Flow Statement (nested object)
      // FMP convention: outflows are NEGATIVE (dividends, capex, buybacks)
      // Our internal format: store as POSITIVE values
      cashFlowStatement: {
        operatingCashFlow: cashFlow?.operatingCashFlow || 0,
        capitalExpenditures: Math.abs(cashFlow?.capitalExpenditure || 0),
        freeCashFlow: cashFlow?.freeCashFlow || 0,
        // FMP returns dividends as 'commonDividendsPaid' (negative), fallback chain:
        dividendsPaid: Math.abs(
          cashFlow?.commonDividendsPaid
          ?? cashFlow?.netDividendsPaid
          ?? cashFlow?.dividendsPaid
          ?? 0
        ),
        netChangeInCash: cashFlow?.netChangeInCash || 0,
      },
    };

    console.log(`\n${'='.repeat(50)}`);
    console.log(`[WOLF API] ✅ SUCCESS! Data loaded for ${profile.companyName}`);
    console.log(`${'='.repeat(50)}`);
    console.log(`[WOLF API] 📊 Summary:`);
    console.log(`  • Company: ${financialData.companyName}`);
    console.log(`  • Price: $${financialData.currentStockPrice.toFixed(2)}`);
    console.log(`  • Shares Outstanding: ${(financialData.sharesOutstanding / 1e9).toFixed(2)}B shares`);
    console.log(`  • Beta: ${financialData.beta?.toFixed(2) || 'N/A'}`);
    console.log(`  • Revenue: $${(financialData.incomeStatement.revenue / 1e9).toFixed(2)}B`);
    console.log(`  • Net Income: $${(financialData.incomeStatement.netIncome / 1e9).toFixed(2)}B`);
    console.log(`  • Free Cash Flow: $${(financialData.cashFlowStatement.freeCashFlow / 1e9).toFixed(2)}B`);
    console.log(`  • Dividends Paid: $${(financialData.cashFlowStatement.dividendsPaid / 1e9).toFixed(2)}B`);
    console.log(`  • Total Assets: $${(financialData.balanceSheet.totalAssets / 1e9).toFixed(2)}B`);
    console.log(`  • Total Debt: $${((financialData.balanceSheet.shortTermDebt + financialData.balanceSheet.longTermDebt) / 1e9).toFixed(2)}B`);
    console.log(`${'='.repeat(50)}\n`);

    return { success: true, data: financialData };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

    console.error(`\n${'='.repeat(50)}`);
    console.error(`[WOLF API] ❌ FAILED to fetch data for ${ticker}`);
    console.error(`[WOLF API] Error: ${errorMessage}`);
    console.error(`${'='.repeat(50)}\n`);

    return { success: false, error: errorMessage };
  }
}



// ============================================
// FETCH: Comparable Companies Multiples
// Auto-fetch peer company valuation multiples
// ============================================

export interface ComparableMultiples {
  symbol: string;
  companyName: string;
  peRatio: number;
  evEbitda: number;
  psRatio: number;
  pbRatio: number;
  revenueGrowth?: number;
  operatingMargin?: number;
}

export async function fetchComparableMultiples(
  tickers: string[],
  apiKey: string
): Promise<ComparableMultiples[]> {
  console.log(`[WOLF API] 📊 Fetching comparable company multiples...`);
  console.log(`[WOLF API] Peers: ${tickers.join(', ')}`);

  const results: ComparableMultiples[] = [];

  for (const ticker of tickers) {
    try {
      // Fetch key metrics for valuation ratios
      const metricsUrl = `${BASE_URL}/ratios-ttm?symbol=${ticker.toUpperCase()}&apikey=${apiKey}`;
      const profileUrl = `${BASE_URL}/profile?symbol=${ticker.toUpperCase()}&apikey=${apiKey}`;

      const [metricsResponse, profileResponse] = await Promise.all([
        fetch(metricsUrl),
        fetch(profileUrl),
      ]);

      if (!metricsResponse.ok || !profileResponse.ok) {
        console.warn(`[WOLF API] ⚠ Could not fetch data for ${ticker}`);
        continue;
      }

      const metricsData = await metricsResponse.json();
      const profileData = await profileResponse.json();

      const metrics = Array.isArray(metricsData) ? metricsData[0] : metricsData;
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;

      if (metrics && profile) {
        results.push({
          symbol: ticker.toUpperCase(),
          companyName: profile.companyName || ticker,
          peRatio: metrics.peRatioTTM || metrics.priceEarningsRatioTTM || 0,
          evEbitda: metrics.enterpriseValueOverEBITDATTM || 0,
          psRatio: metrics.priceToSalesRatioTTM || 0,
          pbRatio: metrics.priceToBookRatioTTM || 0,
          revenueGrowth: metrics.revenueGrowth || 0,
          operatingMargin: metrics.operatingProfitMargin || 0,
        });
        console.log(`[WOLF API] ✓ ${ticker}: P/E ${metrics.peRatioTTM?.toFixed(1) || 'N/A'}, EV/EBITDA ${metrics.enterpriseValueOverEBITDATTM?.toFixed(1) || 'N/A'}`);
      }
    } catch (error) {
      console.warn(`[WOLF API] ⚠ Failed to fetch ${ticker}:`, error);
    }
  }

  console.log(`[WOLF API] ✅ Loaded ${results.length}/${tickers.length} comparable companies`);
  return results;
}

// Industry peer groups for auto-suggestion
export const INDUSTRY_PEERS: Record<string, string[]> = {
  // Technology
  AAPL: ['MSFT', 'GOOGL', 'AMZN', 'META'],
  MSFT: ['AAPL', 'GOOGL', 'AMZN', 'ORCL'],
  GOOGL: ['META', 'MSFT', 'AMZN', 'NFLX'],
  META: ['GOOGL', 'SNAP', 'PINS', 'TWTR'],
  AMZN: ['WMT', 'COST', 'TGT', 'EBAY'],
  NVDA: ['AMD', 'INTC', 'QCOM', 'AVGO'],
  // Auto
  TSLA: ['F', 'GM', 'RIVN', 'NIO'],
  // Finance
  JPM: ['BAC', 'WFC', 'C', 'GS'],
  // Default tech peers
  DEFAULT: ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META'],
};

// Egyptian industry peer groups
export const EGYPTIAN_INDUSTRY_PEERS: Record<string, string[]> = {
  // Egyptian Banks
  'COMI.CA': ['QNBA.CA', 'ADIB.CA', 'FAISAL.CA', 'SAIB.CA'],
  'CIB.CA': ['QNBA.CA', 'ADIB.CA', 'FAISAL.CA', 'SAIB.CA'],
  'QNBA.CA': ['COMI.CA', 'ADIB.CA', 'FAISAL.CA'],
  // Egyptian Telecom
  'ETEL.CA': ['VODAFONE.CA', 'ORANGE.CA'],
  'TELECOM EGYPT': ['VODAFONE.CA', 'ORANGE.CA'],
  // Egyptian Food & Consumer
  'EFID.CA': ['JUFO.CA', 'DOMTY.CA', 'ISPH.CA'],
  'EAST.CA': ['EFID.CA', 'JUFO.CA', 'DOMTY.CA'],
  // Egyptian Real Estate
  'TMGH.CA': ['PHDC.CA', 'EMFD.CA', 'MNHD.CA'],
  'PHDC.CA': ['TMGH.CA', 'EMFD.CA', 'MNHD.CA'],
  // Default Egyptian peers (major EGX companies)
  'DEFAULT_EG': ['COMI.CA', 'ETEL.CA', 'EFID.CA', 'EAST.CA', 'TMGH.CA'],
};

// Get suggested peers for a ticker (handles both US and Egyptian markets)
export function getSuggestedPeers(ticker: string, market: 'USA' | 'Egypt' = 'USA'): string[] {
  const upperTicker = ticker.toUpperCase();

  if (market === 'Egypt' || upperTicker.endsWith('.CA')) {
    return EGYPTIAN_INDUSTRY_PEERS[upperTicker] || EGYPTIAN_INDUSTRY_PEERS['DEFAULT_EG'];
  }

  return INDUSTRY_PEERS[upperTicker] || INDUSTRY_PEERS.DEFAULT;
}

// ============================================
// PEER COMPANY DATA FOR COMPARABLES TABLE
// ============================================

export interface PeerCompanyData {
  ticker: string;
  name: string;
  marketCap: number;
  price: number;
  peRatio: number;
  evEbitda: number;
  psRatio: number;
  pbRatio: number;
  revenueGrowth: number;
  operatingMargin: number;
  revenue: number;
  netIncome: number;
  ebitda: number;
}

// Fetch full peer company data from API
export async function fetchPeerCompanyData(ticker: string, apiKey: string): Promise<PeerCompanyData | null> {
  console.log(`[WOLF API] 📊 Fetching peer data for ${ticker}...`);

  try {
    // Fetch profile and income statement in parallel
    const [profileRes, incomeRes] = await Promise.all([
      fetch(`${BASE_URL}/profile?symbol=${ticker.toUpperCase()}&apikey=${apiKey}`),
      fetch(`${BASE_URL}/income-statement?symbol=${ticker.toUpperCase()}&period=annual&limit=2&apikey=${apiKey}`)
    ]);

    if (!profileRes.ok) {
      console.warn(`[WOLF API] ⚠️ Could not fetch profile for ${ticker}`);
      return null;
    }

    const profileData = await profileRes.json();
    const incomeData = await incomeRes.json();

    const profile = Array.isArray(profileData) ? profileData[0] : profileData;
    const currentIncome = Array.isArray(incomeData) && incomeData.length > 0 ? incomeData[0] : null;
    const prevIncome = Array.isArray(incomeData) && incomeData.length > 1 ? incomeData[1] : null;

    if (!profile) {
      return null;
    }

    // Calculate revenue growth
    let revenueGrowth = 0;
    if (currentIncome && prevIncome && prevIncome.revenue > 0) {
      revenueGrowth = ((currentIncome.revenue - prevIncome.revenue) / prevIncome.revenue) * 100;
    }

    // Calculate operating margin
    let operatingMargin = 0;
    if (currentIncome && currentIncome.revenue > 0) {
      operatingMargin = (currentIncome.operatingIncome / currentIncome.revenue) * 100;
    }

    const revenue = currentIncome?.revenue || 0;
    const netIncome = currentIncome?.netIncome || 0;
    const ebitda = currentIncome?.ebitda || currentIncome?.operatingIncome || 0;
    const marketCap = profile.mktCap || profile.marketCap || 0;
    const price = profile.price || 0;

    // Calculate multiples
    const peRatio = netIncome > 0 ? marketCap / netIncome : 0;
    const evEbitda = ebitda > 0 ? (marketCap + (profile.totalDebt || 0) - (profile.cash || 0)) / ebitda : 0;
    const psRatio = revenue > 0 ? marketCap / revenue : 0;
    const pbRatio = profile.bookValuePerShare > 0 ? price / profile.bookValuePerShare : 0;

    const result: PeerCompanyData = {
      ticker: ticker.toUpperCase(),
      name: profile.companyName || ticker,
      marketCap,
      price,
      peRatio: Math.max(0, peRatio),
      evEbitda: Math.max(0, evEbitda),
      psRatio: Math.max(0, psRatio),
      pbRatio: Math.max(0, pbRatio),
      revenueGrowth,
      operatingMargin,
      revenue,
      netIncome,
      ebitda
    };

    console.log(`[WOLF API] ✅ ${ticker}: P/E=${result.peRatio.toFixed(1)}x, EV/EBITDA=${result.evEbitda.toFixed(1)}x`);
    return result;

  } catch (error) {
    console.error(`[WOLF API] ❌ Error fetching ${ticker}:`, error);
    return null;
  }
}

// Fetch all peer companies for comparables table
export async function fetchAllPeerData(tickers: string[], apiKey: string | null): Promise<PeerCompanyData[]> {
  console.log(`[WOLF API] 🔄 Fetching data for ${tickers.length} peer companies...`);

  // If no API key, cannot fetch peer data
  if (!apiKey) {
    console.warn('[WOLF API] ⚠ No API key — cannot fetch peer data');
    return [];
  }

  const results: PeerCompanyData[] = [];

  for (const ticker of tickers) {
    const data = await fetchPeerCompanyData(ticker, apiKey);
    if (data) {
      results.push(data);
    }
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log(`[WOLF API] ✅ Successfully fetched ${results.length}/${tickers.length} peer companies`);
  return results;
}

// Calculate median of an array
function calculateMedian(arr: number[]): number {
  const validArr = arr.filter(n => n > 0);
  if (validArr.length === 0) return 0;
  const sorted = [...validArr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Calculate peer statistics (median values)
export function calculatePeerMedians(peers: PeerCompanyData[]): PeerCompanyData {
  return {
    ticker: 'MEDIAN',
    name: 'Peer Median',
    marketCap: calculateMedian(peers.map(p => p.marketCap)),
    price: calculateMedian(peers.map(p => p.price)),
    peRatio: calculateMedian(peers.map(p => p.peRatio)),
    evEbitda: calculateMedian(peers.map(p => p.evEbitda)),
    psRatio: calculateMedian(peers.map(p => p.psRatio)),
    pbRatio: calculateMedian(peers.map(p => p.pbRatio)),
    revenueGrowth: calculateMedian(peers.map(p => p.revenueGrowth)),
    operatingMargin: calculateMedian(peers.map(p => p.operatingMargin)),
    revenue: calculateMedian(peers.map(p => p.revenue)),
    netIncome: calculateMedian(peers.map(p => p.netIncome)),
    ebitda: calculateMedian(peers.map(p => p.ebitda))
  };
}
