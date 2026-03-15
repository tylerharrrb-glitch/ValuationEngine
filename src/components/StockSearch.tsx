import React, { useState } from 'react';
import { Search, Loader2, AlertCircle, CheckCircle, TrendingUp } from 'lucide-react';
import { fetchFromAPI, ExtendedFinancialData } from '../services/stockAPI';
import { fetchFromYahoo } from '../services/yahooFinanceAPI';

interface StockSearchProps {
  onDataFetched: (data: ExtendedFinancialData) => void;
  isDarkMode: boolean;
  market?: 'USA' | 'Egypt';
}

// Popular US stocks for quick access
const POPULAR_TICKERS = ['AAPL', 'NVDA', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', 'META', 'JPM'];

// Popular Egyptian stocks for quick access
const EGYPTIAN_TICKERS = ['COMI.CA', 'ETEL.CA', 'EAST.CA', 'EFID.CA', 'TMGH.CA'];

export const StockSearch: React.FC<StockSearchProps> = ({ onDataFetched, isDarkMode, market = 'USA' }) => {
  const [ticker, setTicker] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTicker, setLoadingTicker] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchStock = async (inputTicker: string) => {
    const upperTicker = inputTicker.trim().toUpperCase();
    if (!upperTicker) return;

    setLoading(true);
    setLoadingTicker(upperTicker);
    setError(null);
    setSuccess(null);

    // === EGYPTIAN MARKET (Yahoo Finance) ===
    if (market === 'Egypt') {
      const yahooTicker = upperTicker.endsWith('.CA') ? upperTicker : `${upperTicker}.CA`;
      console.log(`[WOLF] 🇪🇬 Fetching Egyptian stock via Yahoo: ${yahooTicker}`);

      const yahooResult = await fetchFromYahoo(yahooTicker);

      if (yahooResult.success && yahooResult.data) {
        onDataFetched(yahooResult.data);
        setSuccess(`✓ Data from Yahoo Finance for ${yahooResult.data.companyName} (${yahooResult.data.ticker}) • ${new Date().toLocaleString()}`);
        setLoading(false);
        setLoadingTicker(null);
        return;
      }

      console.warn(`[WOLF] ⚠ Yahoo Finance failed: ${yahooResult.error}`);

      // NO demo data fallback — show clear error
      setError(`Real-time data for ${upperTicker} is not available. Yahoo Finance error: ${yahooResult.error}. Verify the ticker symbol is correct, or try a US stock (AAPL, MSFT, GOOGL). You can also enter financial data manually.`);
      setLoading(false);
      setLoadingTicker(null);
      return;
    }

    // === US MARKET (Financial Modeling Prep) ===
    const apiKey = localStorage.getItem('fmp_api_key');

    if (apiKey) {
      console.log(`[WOLF] 🇺🇸 Fetching US stock via FMP API: ${upperTicker}`);
      const result = await fetchFromAPI(upperTicker, apiKey);

      if (result.success && result.data) {
        // Successfully fetched from API
        onDataFetched(result.data);
        setSuccess(`✓ Data from Financial Modeling Prep for ${result.data.companyName} (${result.data.ticker}) • ${new Date().toLocaleString()}`);
        setLoading(false);
        setLoadingTicker(null);
        return;
      } else {
        // API failed — NO demo data fallback, show clear error
        console.error(`[WOLF] ❌ API failed: ${result.error}`);
        setError(`Could not fetch data for ${upperTicker}: ${result.error}. Check your API key or try another ticker.`);
        setLoading(false);
        setLoadingTicker(null);
        return;
      }
    }

    // No API key — show error, no demo data fallback
    setError(`No API key configured. Add a Financial Modeling Prep API key to fetch live data for ${upperTicker}. Get a free key at financialmodelingprep.com.`);
    setLoading(false);
    setLoadingTicker(null);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      fetchStock(ticker);
    }
  };

  const handleQuickSelect = (t: string) => {
    // Trigger LIVE API fetch for this ticker
    fetchStock(t);
  };

  // Check if API key is set
  const hasApiKey = !!localStorage.getItem('fmp_api_key');

  return (
    <div className={`p-4 rounded-xl border ${'bg-[var(--bg-card)] border-[var(--border)]'}`}>
      <div className="flex items-center gap-2 mb-3">
        <Search size={18} className="text-red-500" />
        <span className={`font-medium ${'text-[var(--text-primary)]'}`}>
          Fetch Stock Data
        </span>
        {hasApiKey ? (
          <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 flex items-center gap-1">
            <TrendingUp size={12} />
            LIVE API Connected
          </span>
        ) : (
          <span className={`text-xs px-2 py-0.5 rounded ${isDarkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-600'}`}>
            API Key Required — Add key for live data
          </span>
        )}
      </div>
      
      <div className="flex gap-2">
        <input
          type="text"
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          onKeyPress={handleKeyPress}
          placeholder={market === 'Egypt' ? "Enter ticker (e.g., COMI.CA)" : "Enter ticker (e.g., AAPL)"}
          className={`flex-1 px-4 py-2.5 rounded-lg border focus:ring-2 focus:ring-red-500 focus:border-transparent ${ 
            isDarkMode 
              ? 'bg-zinc-800 border-zinc-700 text-white placeholder-gray-500'
              : 'bg-gray-50 border-gray-300 text-gray-900 placeholder-gray-400'
          }`}
        />
        <button
          onClick={() => fetchStock(ticker)}
          disabled={loading}
          className="px-6 py-2.5 btn-gold text-white rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50 font-medium"
        >
          {loading && loadingTicker === ticker.toUpperCase() ? (
            <>
              <Loader2 size={18} className="animate-spin" />
              Fetching...
            </>
          ) : (
            <>
              <Search size={18} />
              Fetch
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg">
          <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="mt-3 flex items-center gap-2 text-green-400 text-sm bg-green-500/10 p-2 rounded-lg">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Quick Access Buttons — Now trigger LIVE fetch */}
      <div className="mt-4">
        <div className="flex items-center gap-2 mb-2">
          <span className={`text-xs font-medium ${'text-[var(--text-secondary)]'}`}>
            {market === 'Egypt' ? '🇪🇬 Egyptian Stocks' : '🇺🇸 US Stocks'} {hasApiKey ? '(Live Data)' : '(API Key Required)'}:
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {(market === 'Egypt' ? EGYPTIAN_TICKERS : POPULAR_TICKERS).map(t => (
              <button
                key={t}
                onClick={() => handleQuickSelect(t)}
                disabled={loading}
                className={`text-xs px-3 py-1.5 rounded-lg transition-all flex items-center gap-1 ${
                  loadingTicker === t 
                    ? 'bg-[var(--accent-gold)] text-[var(--bg-primary)]'
                    : isDarkMode 
                      ? 'bg-zinc-800 text-gray-300 hover:bg-[var(--accent-gold)]/20 hover:text-[var(--accent-gold)] border border-zinc-700 hover:border-[var(--accent-gold)]'
                      : 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600 border border-gray-200 hover:border-red-300'
                } ${loading && loadingTicker !== t ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loadingTicker === t ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Loading...
                  </>
                ) : (
                  <span className="font-medium">{t}</span>
                )}
              </button>
            ))}
        </div>
      </div>

      {/* Market indicator */}
      {market === 'Egypt' && (
        <div className={`mt-3 p-2 rounded-lg ${isDarkMode ? 'bg-green-500/10 border border-green-500/20' : 'bg-green-50 border border-green-200'}`}>
          <div className="flex items-center gap-2 text-green-500 text-xs">
            <TrendingUp size={14} />
            <span>Egyptian market selected. Data via Yahoo Finance. Tickers use .CA suffix (Cairo Stock Exchange, e.g., COMI → COMI.CA).</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default StockSearch;
