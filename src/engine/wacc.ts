/** Cost of capital (METHODOLOGY section 4). Pure; all macro inputs come from the RateReader. */
import type { CompanyData } from '../domain/company';
import { dilutedShares, latestYear, priorYear } from '../domain/company';
import type { CostOfCapitalAssumptions, RiskFreeSource } from '../domain/assumptions';
import type { EngineMessage, WaccResult } from '../domain/result';
import type { RateReader } from './rates';
import type { CoreOverrides } from './forecast';

export interface IndustryBetaRow {
  industry: string;
  unleveredBetaCorrectedForCash: number;
  firms: number;
}

export interface SpreadRow {
  coverageAbove: number;
  coverageUpTo: number;
  rating: string;
  spread: number;
}

export const RF_LABELS: Record<RiskFreeSource, string> = {
  eg_10y_secondary: 'EGP 10Y government bond, secondary-market YTM',
  cbe_auction: 'CBE T-bond auction yield',
  damodaran_egp: 'Damodaran inflation-based EGP riskfree rate',
  fisher_us10y: 'US 10Y converted to EGP with expected inflation (Fisher)',
};

export const isCleanRf = (s: RiskFreeSource) => s === 'damodaran_egp' || s === 'fisher_us10y';

export interface RiskFree {
  id: string;
  value: number; // percent
  asOf: string;
  status: string;
}

export function riskFree(r: RateReader, cc: CostOfCapitalAssumptions): RiskFree {
  const from = (id: string): RiskFree => {
    const v = r.num(id);
    const e = r.entry(id);
    return { id, value: v, asOf: e.asOf, status: e.status };
  };
  switch (cc.rfSource) {
    case 'eg_10y_secondary':
      return from('eg.bond10ySecondary');
    case 'cbe_auction':
      return from(cc.auctionTenorId);
    case 'damodaran_egp':
      return from('damodaran.rf.egp');
    case 'fisher_us10y': {
      const us = r.pct('us.treasury10y');
      const pe = r.pct('damodaran.expectedInflation.egp');
      const pu = r.pct('damodaran.expectedInflation.usd');
      const e = r.entry('us.treasury10y');
      return { id: 'us.treasury10y (Fisher)', value: ((1 + us) * (1 + pe) / (1 + pu) - 1) * 100, asOf: e.asOf, status: e.status };
    }
  }
}

export function interestBearingDebt(c: CompanyData, which: 'latest' | 'prior' = 'latest'): number {
  const y = which === 'latest' ? latestYear(c) : priorYear(c);
  if (!y) return NaN;
  const b = y.balance;
  return b.bankDebtCurrent + b.bankDebtNonCurrent + b.bondsNonCurrent + b.leaseCurrent + b.leaseNonCurrent;
}

export function debtAndLeaseInterest(c: CompanyData): number {
  const i = latestYear(c).income;
  return -(i.financeCostDebt + i.financeCostLease);
}

/** Row with the largest lower bound not above the coverage (Excel MATCH type 1); no interest → top row. */
export function syntheticRating(table: SpreadRow[], coverage: number): SpreadRow {
  const rows = [...table].sort((a, b) => a.coverageAbove - b.coverageAbove);
  if (!Number.isFinite(coverage)) return rows[rows.length - 1];
  let pick = rows[0];
  for (const row of rows) if (row.coverageAbove <= coverage) pick = row;
  return pick;
}

export function computeWacc(
  c: CompanyData,
  cc: CostOfCapitalAssumptions,
  r: RateReader,
  normalizedEbit: number,
  ov: CoreOverrides = {},
): WaccResult {
  const messages: EngineMessage[] = [];
  const rfInfo = riskFree(r, cc);
  const rf = ov.rf ?? rfInfo.value;
  const clean = isCleanRf(cc.rfSource);
  if (rfInfo.status !== 'ok') {
    messages.push({ severity: 'warning', code: 'rf_status', text: `Risk-free rate ${rfInfo.id} is ${rfInfo.status} (as of ${rfInfo.asOf}).` });
  }
  const matureErp = r.num('damodaran.matureErp');
  const crp = r.num('damodaran.egypt.crp');
  const countryDefaultSpread = r.num('damodaran.egypt.defaultSpread');
  const cit = r.num('eg.cit');

  // Beta
  const betas = r.table<IndustryBetaRow>('damodaran.betas.emerging');
  const row = betas.find((b) => b.industry === cc.betaIndustry);
  if (!row && cc.unleveredBetaOverride === null) throw new Error(`Industry "${cc.betaIndustry}" not found in the Damodaran emerging-markets beta dataset`);
  const unleveredBeta = cc.unleveredBetaOverride ?? row!.unleveredBetaCorrectedForCash;
  const equityValue = c.price * dilutedShares(c);
  const debtValue = interestBearingDebt(c);
  const debtToEquity = equityValue > 0 ? debtValue / equityValue : 0;
  const releverTaxRate = cc.releverTaxRate;
  const computedBetaL = unleveredBeta * (1 + (1 - releverTaxRate / 100) * debtToEquity);
  const leveredBeta = ov.leveredBeta ?? computedBetaL;
  const blumeBeta = (2 / 3) * leveredBeta + 1 / 3;
  const sp = cc.sizePremium.value;

  let ke: number;
  switch (cc.capmMethod) {
    case 'local_rf':
      ke = rf + leveredBeta * matureErp + sp;
      break;
    case 'A':
      ke = rf + leveredBeta * matureErp + crp + sp;
      break;
    case 'B':
      ke = rf + leveredBeta * (matureErp + crp) + sp;
      break;
    case 'C':
      ke = rf + leveredBeta * matureErp + cc.lambda * crp + sp;
      break;
  }
  if (cc.capmMethod !== 'local_rf' && !clean) {
    messages.push({ severity: 'warning', code: 'double_count', text: `CAPM method ${cc.capmMethod} adds the country risk premium to a local-currency government yield that already contains Egypt's default risk. Country risk is counted twice.` });
  }
  if (cc.capmMethod === 'local_rf' && clean) {
    messages.push({ severity: 'warning', code: 'crp_omitted', text: 'The local_rf method with a clean risk-free rate omits country risk. Use method A, B or C with a clean rate.' });
  }

  // Cost of debt
  let kdPreTax: number;
  let interestCoverage: number | null = null;
  let rating: string | null = null;
  let companySpread: number | null = null;
  const interest = debtAndLeaseInterest(c);
  switch (cc.kdMethod) {
    case 'synthetic': {
      interestCoverage = interest > 0 ? normalizedEbit / interest : Infinity;
      const table = r.table<SpreadRow>(cc.syntheticTable === 'large' ? 'damodaran.synthetic.large' : 'damodaran.synthetic.small');
      const s = syntheticRating(table, interestCoverage);
      rating = s.rating;
      companySpread = s.spread;
      kdPreTax = rf + s.spread + (clean ? countryDefaultSpread : 0);
      break;
    }
    case 'cbe_plus_spread':
      kdPreTax = r.num('cbe.overnightLending') + cc.kdSpreadOverCbe;
      break;
    case 'actual': {
      const prior = interestBearingDebt(c, 'prior');
      const avg = Number.isFinite(prior) ? (prior + debtValue) / 2 : debtValue;
      kdPreTax = avg > 0 ? (interest / avg) * 100 : NaN;
      if (!Number.isFinite(kdPreTax)) messages.push({ severity: 'error', code: 'kd_actual', text: 'Actual cost of debt is undefined: no interest-bearing debt.' });
      else if (kdPreTax < rf) messages.push({ severity: 'info', code: 'kd_below_rf', text: `Actual cost of debt ${kdPreTax.toFixed(2)}% is below the risk-free rate ${rf.toFixed(2)}% (debt interest ÷ average interest-bearing debt).` });
      break;
    }
  }
  const kdAfterTax = kdPreTax * (1 - cit / 100);

  let equityWeight: number;
  let debtWeight: number;
  if (cc.weightMethod === 'target') {
    debtWeight = cc.targetDebtWeight / 100;
    equityWeight = 1 - debtWeight;
  } else {
    const v = equityValue + debtValue;
    equityWeight = v > 0 ? equityValue / v : 1;
    debtWeight = v > 0 ? debtValue / v : 0;
  }
  let wacc = equityWeight * ke + (debtWeight > 0 ? debtWeight * kdAfterTax : 0);
  if (ov.wacc !== undefined) wacc = ov.wacc * 100;
  if (ov.waccDelta) wacc += ov.waccDelta;

  return {
    rfSource: cc.rfSource,
    rfId: rfInfo.id,
    rf,
    rfAsOf: rfInfo.asOf,
    rfStatus: rfInfo.status,
    capmMethod: cc.capmMethod,
    matureErp,
    crp,
    countryDefaultSpread,
    lambda: cc.lambda,
    betaIndustry: cc.unleveredBetaOverride === null ? cc.betaIndustry : 'Analyst override',
    unleveredBeta,
    betaDatasetDate: r.entry('damodaran.betas.emerging').asOf,
    releverTaxRate,
    debtToEquity,
    leveredBeta,
    blumeBeta,
    sizePremium: sp,
    ke,
    kdMethod: cc.kdMethod,
    interestCoverage,
    syntheticRating: rating,
    companySpread,
    kdPreTax,
    kdTaxRate: cit,
    kdAfterTax,
    equityValue,
    debtValue,
    equityWeight,
    debtWeight,
    wacc,
    messages,
  };
}
