/**
 * Valuation session: company data, assumptions, secondary inputs and the rates snapshot
 * frozen when the session was created (spec 3.5). The engine runs in a Web Worker.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CompanyData } from '../../domain/company';
import type { Assumptions } from '../../domain/assumptions';
import type { RatesRegistry, RatesSnapshot } from '../../domain/rates';
import type { SecondaryInputs } from '../../domain/secondary';
import { EMPTY_SECONDARY } from '../../domain/secondary';
import type { ValuationResult } from '../../engine/valuation';
import { buildDefaultAssumptions } from '../../engine/defaults';
import { validateCompany } from '../../engine/company';
import { freezeSnapshot, diffSnapshots, type SnapshotDiffRow } from '../../data/registry/registry';
import type { WorkerRequest } from '../workers/valuation.worker';

export const FALLBACK_INDUSTRY = 'Total Market (without financials)';

export interface Session {
  id: string;
  name: string;
  company: CompanyData;
  assumptions: Assumptions;
  secondary: SecondaryInputs;
  snapshot: RatesSnapshot;
}

export interface SessionState {
  session: Session | null;
  result: ValuationResult | null;
  running: boolean;
  error: string | null;
  start: (company: CompanyData, registry: RatesRegistry, name?: string) => void;
  open: (s: Session) => void;
  setCompany: (c: CompanyData) => void;
  setAssumptions: (fn: (a: Assumptions) => Assumptions) => void;
  setSecondary: (fn: (s: SecondaryInputs) => SecondaryInputs) => void;
  rebuildDefaults: () => void;
  pendingRateUpdate: (registry: RatesRegistry) => SnapshotDiffRow[];
  applyRateUpdate: (registry: RatesRegistry) => void;
  close: () => void;
}

const newId = () => `v-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function defaultsFor(company: CompanyData, snapshot: RatesSnapshot): Assumptions {
  const industry = company.damodaranIndustry ?? FALLBACK_INDUSTRY;
  return buildDefaultAssumptions(company, snapshot, { betaIndustry: industry });
}

export function useSession(): SessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [result, setResult] = useState<ValuationResult | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const worker = useRef<Worker | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    const w = new Worker(new URL('../workers/valuation.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<{ id: number; result?: ValuationResult; error?: string }>) => {
      if (e.data.id !== reqId.current) return;
      setRunning(false);
      if (e.data.error) {
        setError(e.data.error);
        setResult(null);
      } else {
        setError(null);
        setResult(e.data.result ?? null);
      }
    };
    worker.current = w;
    return () => w.terminate();
  }, []);

  // Recompute (debounced) whenever the session changes.
  useEffect(() => {
    if (!session || !worker.current) return;
    const issues = validateCompany(session.company);
    if (issues.length) {
      setError(issues.map((i) => i.text).join(' '));
      setResult(null);
      return;
    }
    const t = setTimeout(() => {
      reqId.current += 1;
      setRunning(true);
      const msg: WorkerRequest = { id: reqId.current, company: session.company, assumptions: session.assumptions, snapshot: session.snapshot, secondary: session.secondary };
      worker.current!.postMessage(msg);
    }, 350);
    return () => clearTimeout(t);
  }, [session]);

  const start = useCallback((company: CompanyData, registry: RatesRegistry, name?: string) => {
    const snapshot = freezeSnapshot(registry, new Date().toISOString());
    try {
      const assumptions = defaultsFor(company, snapshot);
      setSession({ id: newId(), name: name ?? `${company.shortName || company.name} ${company.valuationDate}`, company, assumptions, secondary: { ...EMPTY_SECONDARY }, snapshot });
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const open = useCallback((s: Session) => setSession(s), []);
  const setCompany = useCallback((c: CompanyData) => setSession((s) => (s ? { ...s, company: c } : s)), []);
  const setAssumptions = useCallback((fn: (a: Assumptions) => Assumptions) => setSession((s) => (s ? { ...s, assumptions: fn(s.assumptions) } : s)), []);
  const setSecondary = useCallback((fn: (x: SecondaryInputs) => SecondaryInputs) => setSession((s) => (s ? { ...s, secondary: fn(s.secondary) } : s)), []);
  const rebuildDefaults = useCallback(() => {
    setSession((s) => {
      if (!s) return s;
      try {
        return { ...s, assumptions: defaultsFor(s.company, s.snapshot) };
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return s;
      }
    });
  }, []);
  const pendingRateUpdate = useCallback(
    (registry: RatesRegistry) => (session ? diffSnapshots(session.snapshot, freezeSnapshot(registry, new Date().toISOString())) : []),
    [session],
  );
  const applyRateUpdate = useCallback((registry: RatesRegistry) => {
    setSession((s) => (s ? { ...s, snapshot: freezeSnapshot(registry, new Date().toISOString()) } : s));
  }, []);
  const close = useCallback(() => {
    setSession(null);
    setResult(null);
  }, []);

  return { session, result, running, error, start, open, setCompany, setAssumptions, setSecondary, rebuildDefaults, pendingRateUpdate, applyRateUpdate, close };
}
