/** Blended value and verdict band (METHODOLOGY section 12). */
import type { BlendWeights } from '../domain/assumptions';
import type { EngineMessage, VerdictBand } from '../domain/result';

export type MethodId = keyof BlendWeights;

export const METHOD_LABELS: Record<MethodId, string> = {
  dcf: 'DCF (FCFF)',
  ddm: 'Dividend discount model',
  comps: 'Trading comparables',
  precedents: 'Precedent transactions',
  sotp: 'Sum of the parts',
};

export interface MethodValue {
  id: MethodId;
  /** Value per share, or null when the method has no valid inputs. */
  value: number | null;
  reason?: string;
}

export interface BlendRow {
  id: MethodId;
  label: string;
  value: number | null;
  enteredWeight: number;
  effectiveWeight: number;
  included: boolean;
  note: string;
}

export interface BlendResult {
  rows: BlendRow[];
  enteredSum: number;
  blendedValue: number;
  verdict: VerdictBand;
  messages: EngineMessage[];
}

export function verdictBand(value: number, price: number): VerdictBand {
  const upside = value / price - 1;
  const band: VerdictBand['band'] = Math.abs(upside) <= 0.1 ? 'In line with market price' : upside > 0 ? 'Above market price' : 'Below market price';
  const sign = upside >= 0 ? '' : '-';
  return { upside, band, text: `Implied upside ${sign}${Math.abs(upside * 100).toFixed(1)}%` };
}

export function blend(weights: BlendWeights, values: MethodValue[], price: number): BlendResult {
  const messages: EngineMessage[] = [];
  const enteredSum = (Object.keys(weights) as MethodId[]).reduce((s, k) => s + weights[k], 0);
  if (Math.abs(enteredSum - 100) > 1e-9) {
    messages.push({ severity: 'error', code: 'blend_sum', text: `Blend weights sum to ${enteredSum}%, not 100%.` });
  }
  const byId = new Map(values.map((v) => [v.id, v]));
  const ids = Object.keys(weights) as MethodId[];
  const valid = (id: MethodId) => {
    const v = byId.get(id)?.value;
    return v !== null && v !== undefined && Number.isFinite(v);
  };
  const includedSum = ids.filter((id) => weights[id] > 0 && valid(id)).reduce((s, id) => s + weights[id], 0);
  const rows: BlendRow[] = ids.map((id) => {
    const v = byId.get(id);
    const ok = valid(id);
    const included = weights[id] > 0 && ok;
    let note = '';
    if (weights[id] > 0 && !ok) {
      note = `Excluded: ${v?.reason ?? 'no valid inputs'}.`;
      messages.push({ severity: 'warning', code: `blend_excluded_${id}`, text: `${METHOD_LABELS[id]} has weight ${weights[id]}% but ${v?.reason ?? 'no valid inputs'}; it is excluded and the remaining weights are rescaled.` });
    }
    return {
      id,
      label: METHOD_LABELS[id],
      value: ok ? v!.value : null,
      enteredWeight: weights[id],
      effectiveWeight: included && includedSum > 0 ? (weights[id] / includedSum) * 100 : 0,
      included,
      note,
    };
  });
  const blendedValue = includedSum > 0 ? rows.reduce((s, r) => s + (r.included ? (r.effectiveWeight / 100) * (r.value as number) : 0), 0) : NaN;
  return { rows, enteredSum, blendedValue, verdict: verdictBand(blendedValue, price), messages };
}
