/** FX sensitivity: value per share when USD/EGP moves (METHODOLOGY section 13). Full re-runs. */
import type { CompanyData } from '../domain/company';
import type { Assumptions } from '../domain/assumptions';
import type { RatesSnapshot } from '../domain/rates';
import { perShare } from './core';

export interface FxSensitivityResult {
  available: boolean;
  reason?: string;
  usdRevenueShare: number | null;
  usdCostShare: number | null;
  rows: { move: number; label: string; perShare: number; change: number }[];
}

export const FX_MOVES = [-0.2, -0.1, 0, 0.1, 0.2];

export function runFxSensitivity(c: CompanyData, a: Assumptions, snapshot: RatesSnapshot, basePerShare: number): FxSensitivityResult {
  const { usdRevenueShare, usdCostShare } = a.fx;
  if (usdRevenueShare === null || usdCostShare === null) {
    return {
      available: false,
      reason: usdCostShare === null ? 'Enter the share of costs linked to the USD (no default).' : 'Enter the share of revenue linked to the USD.',
      usdRevenueShare,
      usdCostShare,
      rows: [],
    };
  }
  const rows = FX_MOVES.map((move) => {
    const v = move === 0 ? basePerShare : perShare(c, a, snapshot, { fx: { revenueShare: usdRevenueShare, costShare: usdCostShare, move } });
    const sign = move > 0 ? '+' : move < 0 ? '−' : '';
    return {
      move,
      label: move === 0 ? 'Base' : `USD/EGP ${sign}${Math.abs(move * 100).toFixed(0)}% (EGP ${move > 0 ? 'weaker' : 'stronger'})`,
      perShare: v,
      change: v / basePerShare - 1,
    };
  });
  return { available: true, usdRevenueShare, usdCostShare, rows };
}
