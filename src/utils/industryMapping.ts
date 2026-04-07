/**
 * Maps stock tickers to their industry sector for selecting
 * appropriate default valuation multiples.
 *
 * Updated April 2026: 30+ EGX stocks, expanded sector betas and ticker mappings.
 */
import { DEFAULT_INDUSTRY_MULTIPLES, EGYPTIAN_INDUSTRY_MULTIPLES } from '../constants/marketDefaults';

// ============================================
// EGX SECTOR BETA DATABASE (vs EGX 30) — April 2026
// ============================================
export const EGX_SECTOR_BETAS: Record<string, number> = {
  banking: 0.85,
  real_estate: 1.10,
  telecom: 0.90,
  consumer_fmcg: 0.95,
  industrial: 1.15,
  healthcare: 0.80,
  energy_oil_gas: 1.30,
  construction_materials: 1.20,
  food_beverages: 0.85,
  technology: 1.25,
  chemicals: 1.10,
  media_entertainment: 1.40,
  transportation: 1.05,
  utilities: 0.70,
  financial_services: 1.00,
  tourism_hospitality: 1.35,
  default: 1.20,
};

// ============================================
// KEY EGX TICKERS FOR AUTO-POPULATE (30+ stocks)
// Covers EGX 30 constituents + major mid-caps
// ============================================
export interface EGXStock {
  /** FMP-compatible ticker (without .CA suffix) */
  ticker: string;
  /** Company display name */
  name: string;
  /** Sector classification key (matches EGX_SECTOR_BETAS) */
  sector: string;
  /** Estimated beta vs EGX 30 */
  beta: number;
}

export const EGX_MAJOR_STOCKS: EGXStock[] = [
  // ── Banking ────────────────────────────────────────
  { ticker: 'COMI', name: 'Commercial International Bank (CIB)', sector: 'banking', beta: 0.85 },
  { ticker: 'QNBA', name: 'Qatar National Bank Alahli', sector: 'banking', beta: 0.80 },
  { ticker: 'ADIB', name: 'Abu Dhabi Islamic Bank Egypt', sector: 'banking', beta: 0.75 },
  { ticker: 'FAISAL', name: 'Faisal Islamic Bank', sector: 'banking', beta: 0.70 },
  { ticker: 'SAIB', name: 'Société Arabe Internationale de Banque', sector: 'banking', beta: 0.80 },
  { ticker: 'AIBC', name: 'Arab Investment Bank', sector: 'banking', beta: 0.90 },

  // ── Financial Services ─────────────────────────────
  { ticker: 'HRHO', name: 'EFG Hermes Holding', sector: 'financial_services', beta: 1.15 },
  { ticker: 'CCAP', name: 'CI Capital Holding', sector: 'financial_services', beta: 1.10 },
  { ticker: 'EFIH', name: 'EFG Hermes (Investment)', sector: 'financial_services', beta: 1.05 },

  // ── Real Estate ────────────────────────────────────
  { ticker: 'TMGH', name: 'Talaat Mostafa Group Holding', sector: 'real_estate', beta: 1.15 },
  { ticker: 'PHDC', name: 'Palm Hills Development', sector: 'real_estate', beta: 1.20 },
  { ticker: 'EMFD', name: 'Emaar Misr for Development', sector: 'real_estate', beta: 1.10 },
  { ticker: 'MNHD', name: 'Medinet Nasr Housing', sector: 'real_estate', beta: 1.05 },
  { ticker: 'HELI', name: 'Heliopolis Housing', sector: 'real_estate', beta: 0.95 },
  { ticker: 'MDEV', name: 'Mountain View (DMG)', sector: 'real_estate', beta: 1.25 },
  { ticker: 'OCDI', name: 'Orascom Development', sector: 'real_estate', beta: 1.30 },

  // ── Telecom ────────────────────────────────────────
  { ticker: 'ETEL', name: 'Telecom Egypt', sector: 'telecom', beta: 0.90 },

  // ── Industrial ─────────────────────────────────────
  { ticker: 'SWDY', name: 'El Sewedy Electrometer Group', sector: 'industrial', beta: 1.10 },
  { ticker: 'ORWE', name: 'Oriental Weavers', sector: 'industrial', beta: 1.05 },
  { ticker: 'ALCN', name: 'Aluminium Company of Egypt', sector: 'industrial', beta: 1.20 },
  { ticker: 'ESRS', name: 'Ezz Steel', sector: 'industrial', beta: 1.35 },
  { ticker: 'IRON', name: 'Ezz Dekheila Steel (EZDK)', sector: 'industrial', beta: 1.30 },

  // ── Construction Materials ─────────────────────────
  { ticker: 'SVCE', name: 'Suez Cement (Heidelberg)', sector: 'construction_materials', beta: 1.15 },
  { ticker: 'ARCC', name: 'Arabian Cement Company', sector: 'construction_materials', beta: 1.10 },

  // ── Energy / Oil & Gas ─────────────────────────────
  { ticker: 'AMOC', name: 'Alexandria Mineral Oils (AMOC)', sector: 'energy_oil_gas', beta: 1.25 },
  { ticker: 'SKPC', name: 'Sidi Kerir Petrochemicals (SIDPEC)', sector: 'energy_oil_gas', beta: 1.20 },

  // ── Consumer / FMCG ────────────────────────────────
  { ticker: 'JUFO', name: 'Juhayna Food Industries', sector: 'consumer_fmcg', beta: 0.85 },
  { ticker: 'EAST', name: 'Eastern Company (Tobacco)', sector: 'consumer_fmcg', beta: 0.75 },
  { ticker: 'EFID', name: 'Edita Food Industries', sector: 'consumer_fmcg', beta: 0.90 },
  { ticker: 'DOMTY', name: 'Arabian Food Industries (Domty)', sector: 'consumer_fmcg', beta: 0.95 },
  { ticker: 'CLHO', name: 'Cairo Poultry (Koki)', sector: 'consumer_fmcg', beta: 1.00 },
  { ticker: 'ARMC', name: 'Americana Restaurants', sector: 'consumer_fmcg', beta: 0.80 },

  // ── Healthcare / Pharma ────────────────────────────
  { ticker: 'PHAR', name: 'Pharos Holding (Pharma)', sector: 'healthcare', beta: 0.85 },
  { ticker: 'EPHA', name: 'Egyptian Pharmaceutical (EIPICO)', sector: 'healthcare', beta: 0.80 },
  { ticker: 'ISPH', name: 'Ibnsina Pharma', sector: 'healthcare', beta: 0.90 },

  // ── Tourism / Hospitality ──────────────────────────
  { ticker: 'ORHD', name: 'Orascom Hotels & Development', sector: 'tourism_hospitality', beta: 1.35 },
];

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
  const upper = ticker.toUpperCase().replace('.CA', '');

  // Look up in EGX_MAJOR_STOCKS first for canonical mapping
  const stock = EGX_MAJOR_STOCKS.find(s => s.ticker === upper);
  if (stock) {
    const sectorMap: Record<string, keyof typeof EGYPTIAN_INDUSTRY_MULTIPLES> = {
      banking: 'BANKING',
      financial_services: 'BANKING', // group with banking for multiples
      real_estate: 'REAL_ESTATE',
      telecom: 'TELECOM',
      consumer_fmcg: 'CONSUMER',
      food_beverages: 'CONSUMER',
      industrial: 'INDUSTRIAL',
      construction_materials: 'INDUSTRIAL',
      energy_oil_gas: 'ENERGY',
      chemicals: 'ENERGY',
      healthcare: 'HEALTHCARE',
      tourism_hospitality: 'CONSUMER',
    };
    return sectorMap[stock.sector] || 'DEFAULT';
  }

  // Legacy fallback for tickers not in the database
  const bankTickers = ['COMI', 'CIB', 'QNBA', 'ADIB', 'FAISAL', 'SAIB', 'EFIH', 'AIBC'];
  const telecomTickers = ['ETEL', 'VODAFONE', 'ORANGE'];
  const consumerTickers = ['EFID', 'EAST', 'JUFO', 'DOMTY', 'ISPH', 'CLHO', 'ARMC'];
  const realEstateTickers = ['TMGH', 'PHDC', 'EMFD', 'MNHD', 'HELI', 'MDEV', 'OCDI'];
  const industrialTickers = ['ORWE', 'ALCN', 'SWDY', 'ESRS', 'IRON', 'SVCE', 'ARCC'];
  const energyTickers = ['AMOC', 'SKPC'];
  const healthcareTickers = ['PHAR', 'EPHA'];
  
  if (bankTickers.includes(upper)) return 'BANKING';
  if (telecomTickers.includes(upper)) return 'TELECOM';
  if (consumerTickers.includes(upper)) return 'CONSUMER';
  if (realEstateTickers.includes(upper)) return 'REAL_ESTATE';
  if (industrialTickers.includes(upper)) return 'INDUSTRIAL';
  if (energyTickers.includes(upper)) return 'ENERGY';
  if (healthcareTickers.includes(upper)) return 'HEALTHCARE';
  return 'DEFAULT';
};

/**
 * Get the EGX sector beta for a given sector string.
 * Falls back to default beta (1.20) if sector not found.
 */
export const getEGXSectorBeta = (sector: string): number => {
  const key = sector.toLowerCase().replace(/[\s/]+/g, '_');
  return EGX_SECTOR_BETAS[key] ?? EGX_SECTOR_BETAS.default;
};

/**
 * Search EGX stocks by ticker or name substring.
 * Used by the ticker auto-complete feature (Task #18).
 */
export const searchEGXStocks = (query: string): EGXStock[] => {
  if (!query || query.length < 1) return EGX_MAJOR_STOCKS;
  const q = query.toUpperCase();
  return EGX_MAJOR_STOCKS.filter(
    s => s.ticker.includes(q) || s.name.toUpperCase().includes(q) || s.sector.toUpperCase().includes(q)
  );
};

