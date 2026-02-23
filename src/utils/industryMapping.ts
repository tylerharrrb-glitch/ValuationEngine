/**
 * Maps stock tickers to their industry sector for selecting
 * appropriate default valuation multiples.
 */
import { DEFAULT_INDUSTRY_MULTIPLES, EGYPTIAN_INDUSTRY_MULTIPLES } from '../constants/marketDefaults';

/** Map US tickers to industry sectors */
export const getIndustryForTicker = (ticker: string): keyof typeof DEFAULT_INDUSTRY_MULTIPLES => {
  const techTickers = ['AAPL', 'MSFT', 'GOOGL', 'META', 'NVDA', 'AMD', 'INTC', 'CRM', 'ORCL', 'ADBE'];
  const financeTickers = ['JPM', 'BAC', 'WFC', 'GS', 'MS', 'C', 'BLK', 'AXP'];
  const consumerTickers = ['AMZN', 'WMT', 'COST', 'HD', 'NKE', 'SBUX', 'MCD'];
  const healthcareTickers = ['JNJ', 'UNH', 'PFE', 'MRK', 'ABBV', 'LLY'];
  
  const upper = ticker.toUpperCase();
  if (techTickers.includes(upper)) return 'TECH';
  if (financeTickers.includes(upper)) return 'FINANCE';
  if (consumerTickers.includes(upper)) return 'CONSUMER';
  if (healthcareTickers.includes(upper)) return 'HEALTHCARE';
  return 'DEFAULT';
};

/** Map Egyptian tickers to industry sectors */
export const getEgyptianIndustryForTicker = (ticker: string): keyof typeof EGYPTIAN_INDUSTRY_MULTIPLES => {
  const upper = ticker.toUpperCase();
  const bankTickers = ['COMI.CA', 'CIB.CA', 'QNBA.CA', 'ADIB.CA', 'FAISAL.CA', 'SAIB.CA'];
  const telecomTickers = ['ETEL.CA', 'VODAFONE.CA', 'ORANGE.CA'];
  const consumerTickers = ['EFID.CA', 'EAST.CA', 'JUFO.CA', 'DOMTY.CA', 'ISPH.CA'];
  const realEstateTickers = ['TMGH.CA', 'PHDC.CA', 'EMFD.CA', 'MNHD.CA'];
  
  if (bankTickers.includes(upper)) return 'BANKING';
  if (telecomTickers.includes(upper)) return 'TELECOM';
  if (consumerTickers.includes(upper)) return 'CONSUMER';
  if (realEstateTickers.includes(upper)) return 'REAL_ESTATE';
  return 'DEFAULT';
};
