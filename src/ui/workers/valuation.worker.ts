/// <reference lib="webworker" />
/** Runs the engine off the main thread (the Monte Carlo alone is 10,000 full re-runs). */
import { runValuation } from '../../engine/valuation';
import type { CompanyData } from '../../domain/company';
import type { Assumptions } from '../../domain/assumptions';
import type { RatesSnapshot } from '../../domain/rates';
import type { SecondaryInputs } from '../../domain/secondary';

export interface WorkerRequest {
  id: number;
  company: CompanyData;
  assumptions: Assumptions;
  snapshot: RatesSnapshot;
  secondary: SecondaryInputs;
}

self.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const { id, company, assumptions, snapshot, secondary } = e.data;
  try {
    const result = runValuation(company, assumptions, snapshot, { secondary });
    // Structured clone keeps NaN / Infinity and Maps; class instances arrive as plain data.
    (self as unknown as Worker).postMessage({ id, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
