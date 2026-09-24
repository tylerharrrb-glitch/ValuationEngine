/**
 * Top-level valuation: every module on one frozen rates snapshot.
 * UI, PDF and Excel consume this result; none of them recompute formulas.
 */
import type { CompanyData } from '../domain/company';
import type { Assumptions } from '../domain/assumptions';
import type { RatesSnapshot } from '../domain/rates';
import type { EngineMessage } from '../domain/result';
import { runCore, type CoreRun } from './core';
import { runUsdCheck, type UsdCheckResult } from './usdCheck';
import { runDdm, type DdmResult } from './ddm';
import { runScenarios, type ScenariosResult } from './scenarios';
import { runSensitivity, type Grid } from './sensitivity';
import { runReverseDcf, type ReverseDcfResult } from './reverseDcf';
import { runMonteCarlo, type MonteCarloResult } from './montecarlo';
import { blend, type BlendResult, type MethodValue } from './blend';
import { companyChecks, companyFacts, validateCompany, type CompanyFacts, type TieCheck } from './company';
import type { RateUse } from './rates';
import type { SecondaryInputs } from '../domain/secondary';
import { EMPTY_SECONDARY } from '../domain/secondary';
import { runComps, runPrecedents, runSotp, brokerBand, type CompsResult, type PrecedentsResult, type SotpResult, type BrokerBand } from './relative';
import { piotroski, altmanZem, dupont, creditMetrics, type PiotroskiResult, type ZScoreResult, type DupontResult, type CreditMetrics } from './scores';
import { runFxSensitivity, type FxSensitivityResult } from './fx';
import { easReferences, type EasReference } from './eas';

export interface ValuationOptions {
  /** Skip Monte Carlo (10,000 full runs) when not needed, e.g. inside sensitivity loops. */
  monteCarlo?: boolean;
  monteCarloRuns?: number;
  secondary?: SecondaryInputs;
}

export interface ValuationResult {
  company: { name: string; ticker: string; price: number; priceDate: string; valuationDate: string };
  snapshotId: string;
  facts: CompanyFacts;
  statementChecks: TieCheck[];
  core: CoreRun;
  usd: UsdCheckResult;
  ddm: DdmResult;
  scenarios: ScenariosResult;
  sensitivity: Grid[];
  reverse: ReverseDcfResult;
  monteCarlo: MonteCarloResult | null;
  blend: BlendResult;
  comps: CompsResult;
  precedents: PrecedentsResult;
  sotp: SotpResult;
  brokers: BrokerBand | null;
  piotroski: PiotroskiResult;
  zScores: ZScoreResult[];
  dupont: DupontResult;
  credit: CreditMetrics;
  fx: FxSensitivityResult;
  eas: EasReference[];
  secondary: SecondaryInputs;
  ratesUsed: RateUse[];
  messages: EngineMessage[];
}

export function runValuation(c: CompanyData, a: Assumptions, snapshot: RatesSnapshot, opt: ValuationOptions = {}): ValuationResult {
  const issues = validateCompany(c);
  if (issues.length) throw new Error(`Company data incomplete: ${issues.map((i) => i.text).join(' ')}`);
  const core = runCore(c, a, snapshot);
  const usd = runUsdCheck(a, core.forecast, core.timeline, core.wacc, core.dcf, core.rates, core.growth);
  const ddm = runDdm(c, a.ddm, core.wacc.ke);
  const scenarios = runScenarios(c, a, snapshot);
  const sensitivity = runSensitivity(c, a, snapshot, core);
  const reverse = runReverseDcf(c, a, snapshot, core);
  const monteCarlo = opt.monteCarlo === false ? null : runMonteCarlo(c, a, snapshot, core, opt.monteCarloRuns);
  const sec = opt.secondary ?? EMPTY_SECONDARY;
  const comps = runComps(c, sec.peers, core.norm, core.forecast, core.dcf.bridge);
  const precedents = runPrecedents(c, sec.transactions, core.norm, core.dcf.bridge);
  const sotp = runSotp(c, sec.segments, core.dcf.bridge);
  const values: MethodValue[] = [
    { id: 'dcf', value: Number.isFinite(core.dcf.perShare) ? core.dcf.perShare : null, reason: 'DCF value is undefined' },
    { id: 'ddm', value: ddm.applicable ? ddm.twoStage : null, reason: 'DDM not applicable' },
    comps.methodValue,
    precedents.methodValue,
    sotp.methodValue,
  ];
  const bl = blend(a.blend, values, c.price);
  const ratesUsed = [...core.rates.used.values()];
  // The risk-free rate status is already reported by the WACC module.
  const stale = ratesUsed.filter((u) => u.status !== 'ok' && u.id !== core.wacc.rfId);
  const messages: EngineMessage[] = [
    ...core.wacc.messages,
    ...core.dcf.messages,
    ...ddm.messages,
    ...scenarios.messages,
    ...bl.messages,
    ...stale.map((u) => ({ severity: 'warning' as const, code: `rate_${u.id}`, text: `${u.label} (${u.id}) is ${u.status}, as of ${u.asOf}.` })),
  ];
  return {
    company: { name: c.name, ticker: c.ticker, price: c.price, priceDate: c.priceDate, valuationDate: a.valuationDate },
    snapshotId: snapshot.snapshotId,
    facts: companyFacts(c),
    statementChecks: companyChecks(c),
    core,
    usd,
    ddm,
    scenarios,
    sensitivity,
    reverse,
    monteCarlo,
    blend: bl,
    comps,
    precedents,
    sotp,
    brokers: brokerBand(sec.brokers),
    piotroski: piotroski(c),
    zScores: c.years.map(altmanZem),
    dupont: dupont(c),
    credit: creditMetrics(c),
    fx: runFxSensitivity(c, a, snapshot, core.dcf.perShare),
    eas: easReferences(c),
    secondary: sec,
    ratesUsed,
    messages,
  };
}
