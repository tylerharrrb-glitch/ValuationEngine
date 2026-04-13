/**
 * Financial data state management hook.
 * Wraps financialData, assumptions, and comparables with history-integrated updaters.
 */
import { useState, useCallback, useEffect } from 'react';
import { FinancialData, ValuationAssumptions, ComparableCompany, MarketRegion } from '../types/financial';
import { MARKET_DEFAULTS } from '../constants/marketDefaults';
import { useHistory } from './useHistory';
import { calculateWACC } from '../utils/valuation';

export interface UseFinancialDataReturn {
  financialData: FinancialData;
  assumptions: ValuationAssumptions;
  comparables: ComparableCompany[];
  updateFinancialData: (updater: (prev: FinancialData) => FinancialData) => void;
  updateAssumptions: (updater: (prev: ValuationAssumptions) => ValuationAssumptions) => void;
  updateComparables: (newComparables: ComparableCompany[]) => void;
  handleStockDataFetched: (data: FinancialData & { beta?: number }, marketRegion: MarketRegion, setMarketRegion: (r: MarketRegion) => void) => void;
  handleLoadValuation: (data: { financialData: FinancialData; assumptions: ValuationAssumptions; comparables: ComparableCompany[] }) => void;
  setFinancialData: React.Dispatch<React.SetStateAction<FinancialData>>;
  setAssumptions: React.Dispatch<React.SetStateAction<ValuationAssumptions>>;
  setComparables: React.Dispatch<React.SetStateAction<ComparableCompany[]>>;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  historyIndex: number;
  historyLength: number;
  lastSaved: string | null;
}

/**
 * Manages all financial data state with history-integrated setters.
 */
export function useFinancialData(
  initialFinancialData: FinancialData,
  initialAssumptions: ValuationAssumptions,
  initialComparables: ComparableCompany[]
): UseFinancialDataReturn {
  const [financialData, setFinancialData] = useState<FinancialData>(initialFinancialData);
  const [assumptions, setAssumptions] = useState<ValuationAssumptions>(initialAssumptions);
  const [comparables, setComparables] = useState<ComparableCompany[]>(initialComparables);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const history = useHistory(initialFinancialData, initialAssumptions, initialComparables);

  // Wrapped setters that save to history
  const updateFinancialData = useCallback((updater: (prev: FinancialData) => FinancialData) => {
    setFinancialData(prev => {
      const newData = updater(prev);
      setTimeout(() => history.saveToHistory(newData, assumptions, comparables), 0);
      return newData;
    });
  }, [assumptions, comparables, history.saveToHistory]);

  const updateAssumptions = useCallback((updater: (prev: ValuationAssumptions) => ValuationAssumptions) => {
    setAssumptions(prev => {
      const newData = updater(prev);
      setTimeout(() => history.saveToHistory(financialData, newData, comparables), 0);
      return newData;
    });
  }, [financialData, comparables, history.saveToHistory]);

  const updateComparables = useCallback((newComparables: ComparableCompany[]) => {
    setComparables(newComparables);
    setTimeout(() => history.saveToHistory(financialData, assumptions, newComparables), 0);
  }, [financialData, assumptions, history.saveToHistory]);

  // Handle stock data fetch - updates ALL financial inputs AND assumptions
  const handleStockDataFetched = (data: FinancialData & { beta?: number }, marketRegion: MarketRegion, setMarketRegion: (r: MarketRegion) => void) => {
    updateFinancialData(() => data);
    
    // Clear comparables when a new stock is fetched
    setComparables([]);
    
    // Auto-detect Egyptian stocks by .CA suffix and switch market region
    if (data.ticker && data.ticker.toUpperCase().endsWith('.CA')) {
      if (marketRegion !== 'Egypt') {
        console.log('[WOLF] 🇪🇬 Detected Egyptian stock (.CA suffix) - switching to Egypt market');
        setMarketRegion('Egypt');
        // Update assumptions with Egyptian defaults
        setAssumptions(prev => ({
          ...prev,
          riskFreeRate: MARKET_DEFAULTS.Egypt.riskFreeRate,
          marketRiskPremium: MARKET_DEFAULTS.Egypt.marketRiskPremium,
          terminalGrowthRate: MARKET_DEFAULTS.Egypt.terminalGrowthRate,
          taxRate: MARKET_DEFAULTS.Egypt.defaultTaxRate,
        }));
      }
    }
    
    // Also update assumptions with calculated values from API data
    updateAssumptions(prev => {
      const newAssumptions = { ...prev };
      
      // Update Beta if available
      if (data.beta && data.beta > 0) {
        newAssumptions.beta = Math.round(data.beta * 100) / 100;
        console.log('[WOLF] ✓ Updated Beta from API:', newAssumptions.beta);
      }
      
      // Calculate and update Tax Rate from Income Statement
      const incomeBeforeTax = data.incomeStatement.netIncome + data.incomeStatement.taxExpense;
      if (incomeBeforeTax > 0 && data.incomeStatement.taxExpense > 0) {
        const calculatedTaxRate = (data.incomeStatement.taxExpense / incomeBeforeTax) * 100;
        // Cap between 0% and 40%
        newAssumptions.taxRate = Math.min(40, Math.max(0, Math.round(calculatedTaxRate * 10) / 10));
        console.log('[WOLF] ✓ Calculated Tax Rate:', newAssumptions.taxRate + '%');
      }
      
      // Recalculate WACC from CAPM components (routed through dispatcher)
      const computedWACC = calculateWACC(data, newAssumptions);
      newAssumptions.discountRate = Math.round(computedWACC * 100) / 100;
      console.log('[WOLF] ✓ WACC from CAPM dispatcher:', newAssumptions.discountRate.toFixed(2) + '%');
      
      // Calculate FCF margin
      if (data.incomeStatement.revenue > 0 && data.cashFlowStatement.freeCashFlow > 0) {
        const fcfMargin = (data.cashFlowStatement.freeCashFlow / data.incomeStatement.revenue) * 100;
        console.log('[WOLF] 📊 FCF Margin:', fcfMargin.toFixed(1) + '%');
      }
      
      return newAssumptions;
    });
  };

  // Handle load valuation — strips stale persisted fields
  const handleLoadValuation = (data: {
    financialData: FinancialData;
    assumptions: ValuationAssumptions;
    comparables: ComparableCompany[]
  }) => {
    // Strip stale discountRate — will be recomputed live
    if (data.assumptions.discountRate > 0) {
      console.warn('[WOLF] Ignoring persisted discountRate:', data.assumptions.discountRate, '— WACC will be computed live');
    }
    // Strip legacy dps field — engine uses financialData.dividendsPerShare
    if ((data.assumptions as any).dps !== undefined) {
      console.warn('[WOLF] Ignoring legacy dps field:', (data.assumptions as any).dps);
      delete (data.assumptions as any).dps;
    }
    // Migration: if capmMethod is 'A' but using local bond Rf (>10%), silently remap to local_rf
    if (data.assumptions.capmMethod === 'A' && data.assumptions.riskFreeRate > 10) {
      console.warn('[WOLF] Migrating capmMethod A → local_rf (local Rf already embeds CRP)');
      data.assumptions.capmMethod = 'local_rf';
    }
    // Auto-sync DPS from Cash Flow when at default (0)
    if (
      (data.financialData.dividendsPerShare === 0 || data.financialData.dividendsPerShare === undefined) &&
      data.financialData.cashFlowStatement.dividendsPaid > 0 &&
      data.financialData.sharesOutstanding > 0
    ) {
      const derivedDPS = Math.abs(data.financialData.cashFlowStatement.dividendsPaid) / data.financialData.sharesOutstanding;
      data.financialData.dividendsPerShare = Math.round(derivedDPS * 100) / 100;
      console.info('[WOLF] Auto-synced DPS from dividendsPaid:', data.financialData.dividendsPerShare);
    }

    // Recompute WACC from components
    const computedWACC = calculateWACC(data.financialData, data.assumptions);
    data.assumptions.discountRate = computedWACC;

    setFinancialData(data.financialData);
    setAssumptions(data.assumptions);
    setComparables(data.comparables);
    history.saveToHistory(data.financialData, data.assumptions, data.comparables);
  };

  // Undo
  const undoAction = useCallback(() => {
    const prevState = history.undo();
    if (prevState) {
      setFinancialData(prevState.financialData);
      setAssumptions(prevState.assumptions);
      setComparables(prevState.comparables);
    }
  }, [history.undo]);

  // Redo
  const redoAction = useCallback(() => {
    const nextState = history.redo();
    if (nextState) {
      setFinancialData(nextState.financialData);
      setAssumptions(nextState.assumptions);
      setComparables(nextState.comparables);
    }
  }, [history.redo]);

  // ── Auto-Save Implementation ──────────────────────────────────────────
  useEffect(() => {
    // Debounce save to avoid thrashing localStorage on every keystroke
    const timeoutId = setTimeout(() => {
      const now = new Date().toISOString();
      const stateToSave = {
        financialData,
        assumptions,
        comparables,
        lastSaved: now,
      };
      try {
        localStorage.setItem('wolf_valuation_state', JSON.stringify(stateToSave));
        setLastSaved(now);
      } catch (e) {
        console.error('[WOLF] Failed to auto-save state:', e);
      }
    }, 1000); // 1 second debounce

    return () => clearTimeout(timeoutId);
  }, [financialData, assumptions, comparables]);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('wolf_valuation_state');
    if (saved) {
      try {
        JSON.parse(saved); // Just validate it parses
        // Logic to restore could be added here if desired
      } catch (e) {
        console.error('[WOLF] Failed to parse saved state:', e);
      }
    }
  }, []);

  return {
    financialData,
    assumptions,
    comparables,
    updateFinancialData,
    updateAssumptions,
    updateComparables,
    handleStockDataFetched,
    handleLoadValuation,
    setFinancialData,
    setAssumptions,
    setComparables,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo: undoAction,
    redo: redoAction,
    historyIndex: history.historyIndex,
    historyLength: history.historyLength,
    lastSaved,
  };
}
