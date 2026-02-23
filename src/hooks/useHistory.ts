/**
 * Undo/Redo history management hook.
 * Maintains a stack of states with configurable max depth.
 */
import { useState, useCallback } from 'react';
import { FinancialData, ValuationAssumptions, ComparableCompany, HistoryState } from '../types/financial';

export interface UseHistoryReturn {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => { financialData: FinancialData; assumptions: ValuationAssumptions; comparables: ComparableCompany[] } | null;
  redo: () => { financialData: FinancialData; assumptions: ValuationAssumptions; comparables: ComparableCompany[] } | null;
  saveToHistory: (financialData: FinancialData, assumptions: ValuationAssumptions, comparables: ComparableCompany[]) => void;
  historyIndex: number;
  historyLength: number;
}

/**
 * Manages undo/redo state for financial data, assumptions, and comparables.
 * Keeps up to 50 states in the history stack.
 */
export function useHistory(
  initialFinancialData: FinancialData,
  initialAssumptions: ValuationAssumptions,
  initialComparables: ComparableCompany[]
): UseHistoryReturn {
  const [history, setHistory] = useState<HistoryState[]>([
    { financialData: initialFinancialData, assumptions: initialAssumptions, comparables: initialComparables }
  ]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Save state to history
  const saveToHistory = useCallback((newFinancialData: FinancialData, newAssumptions: ValuationAssumptions, newComparables: ComparableCompany[]) => {
    const newState = { financialData: newFinancialData, assumptions: newAssumptions, comparables: newComparables };
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newState);
    // Keep only last 50 states
    if (newHistory.length > 50) newHistory.shift();
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo - returns the previous state or null
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      return history[newIndex];
    }
    return null;
  }, [historyIndex, history]);

  // Redo - returns the next state or null
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      return history[newIndex];
    }
    return null;
  }, [historyIndex, history]);

  return {
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
    undo,
    redo,
    saveToHistory,
    historyIndex,
    historyLength: history.length,
  };
}
