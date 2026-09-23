/** Bear / Base / Bull explicit driver sets, each a full re-run (METHODOLOGY section 8). */
import type { CompanyData } from '../domain/company';
import type { Assumptions } from '../domain/assumptions';
import type { RatesSnapshot } from '../domain/rates';
import type { EngineMessage } from '../domain/result';
import { runCore } from './core';

export interface ScenarioResult {
  name: string;
  probability: number;
  revenueGrowthDelta: number;
  marginDelta: number;
  waccDelta: number;
  growthDelta: number;
  wacc: number;
  growth: number;
  enterpriseValue: number;
  equityValue: number;
  perShare: number;
  upside: number;
}

export interface ScenariosResult {
  rows: ScenarioResult[];
  probabilitySum: number;
  weightedPerShare: number;
  messages: EngineMessage[];
}

export function runScenarios(c: CompanyData, a: Assumptions, snapshot: RatesSnapshot): ScenariosResult {
  const messages: EngineMessage[] = [];
  const rows = a.scenarios.map((s) => {
    const r = runCore(c, a, snapshot, {
      revenueGrowthDelta: s.revenueGrowthDelta,
      marginDelta: s.marginDelta,
      waccDelta: s.waccDelta,
      growthDelta: s.growthDelta,
    });
    return {
      ...s,
      wacc: r.wacc.wacc,
      growth: r.growth,
      enterpriseValue: r.dcf.enterpriseValue,
      equityValue: r.dcf.equityValue,
      perShare: r.dcf.perShare,
      upside: r.dcf.upside,
    };
  });
  const probabilitySum = rows.reduce((s, r) => s + r.probability, 0);
  if (Math.abs(probabilitySum - 100) > 1e-9) {
    messages.push({ severity: 'error', code: 'scenario_prob', text: `Scenario probabilities sum to ${probabilitySum}%, not 100%.` });
  }
  const weightedPerShare = rows.reduce((s, r) => s + (r.probability / 100) * r.perShare, 0);
  return { rows, probabilitySum, weightedPerShare, messages };
}
