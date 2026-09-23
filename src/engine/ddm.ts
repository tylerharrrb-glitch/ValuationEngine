/** Dividend discount model: two-stage (headline) and H-model (METHODOLOGY section 7). Pure. */
import type { CompanyData } from '../domain/company';
import { latestYear, priorYear } from '../domain/company';
import type { DdmAssumptions } from '../domain/assumptions';
import type { EngineMessage } from '../domain/result';

export interface DdmResult {
  applicable: boolean;
  dps0: number;
  dpsSource: string;
  ke: number;
  highGrowth: number;
  highGrowthYears: number;
  stableGrowth: number;
  dividends: { year: number; dps: number; pv: number }[];
  pvHighGrowth: number;
  terminalValue: number;
  pvTerminal: number;
  twoStage: number;
  hModel: number;
  roe: number;
  payout: number;
  sustainableGrowth: number;
  messages: EngineMessage[];
}

/** Shareholder DPS from the cash flow statement. Employee and board distributions are never included. */
export function shareholderDps(c: CompanyData): number {
  return -latestYear(c).cashFlow.dividendsToShareholders / c.shares.basic;
}

export function runDdm(c: CompanyData, d: DdmAssumptions, kePct: number): DdmResult {
  const messages: EngineMessage[] = [];
  const y = latestYear(c);
  const p = priorYear(c);
  const dps0 = d.dpsOverride ?? shareholderDps(c);
  const dpsSource = d.dpsOverride === null
    ? `Dividends paid to shareholders FY${y.fiscalYear} (${(-y.cashFlow.dividendsToShareholders).toLocaleString('en-US')}) ÷ ${c.shares.basic.toLocaleString('en-US')} shares`
    : 'Analyst override';
  const ke = kePct / 100;
  const gH = d.highGrowth.value / 100;
  const gS = d.stableGrowth.value / 100;
  const n = d.highGrowthYears;
  const np0 = y.income.netProfit;
  const avgEquity = p ? (p.balance.totalEquity + y.balance.totalEquity) / 2 : y.balance.totalEquity;
  const roe = np0 / avgEquity;
  const payout = -y.cashFlow.dividendsToShareholders / np0;
  const sustainableGrowth = roe * (1 - payout);

  const applicable = dps0 > 0 && ke > gS;
  if (!(dps0 > 0)) messages.push({ severity: 'info', code: 'ddm_no_dividend', text: 'No dividends to shareholders in the base year; DDM not applicable.' });
  if (!(ke > gS)) messages.push({ severity: 'error', code: 'ddm_ke_g', text: `Cost of equity ${kePct.toFixed(2)}% is not above stable growth ${d.stableGrowth.value.toFixed(2)}%.` });
  if (gS > sustainableGrowth) {
    messages.push({ severity: 'warning', code: 'ddm_sustainability', text: `Stable growth ${(gS * 100).toFixed(2)}% exceeds ROE × retention = ${(roe * 100).toFixed(2)}% × ${((1 - payout) * 100).toFixed(2)}% = ${(sustainableGrowth * 100).toFixed(2)}%.` });
  }
  if (payout > 1) messages.push({ severity: 'warning', code: 'ddm_payout', text: `Dividends paid are ${(payout * 100).toFixed(1)}% of FY${y.fiscalYear} net profit (above 100%).` });

  const dividends: DdmResult['dividends'] = [];
  let pvHigh = 0;
  for (let t = 1; t <= n; t++) {
    const dps = dps0 * Math.pow(1 + gH, t);
    const pv = dps / Math.pow(1 + ke, t);
    dividends.push({ year: t, dps, pv });
    pvHigh += pv;
  }
  const dn = n > 0 ? dividends[n - 1].dps : dps0;
  const terminalValue = applicable ? (dn * (1 + gS)) / (ke - gS) : NaN;
  const pvTerminal = terminalValue / Math.pow(1 + ke, n);
  const twoStage = applicable ? pvHigh + pvTerminal : NaN;
  const H = n / 2;
  const hModel = applicable ? (dps0 * (1 + gS)) / (ke - gS) + (dps0 * H * (gH - gS)) / (ke - gS) : NaN;
  return {
    applicable, dps0, dpsSource, ke: kePct, highGrowth: d.highGrowth.value, highGrowthYears: n, stableGrowth: d.stableGrowth.value,
    dividends, pvHighGrowth: pvHigh, terminalValue, pvTerminal, twoStage, hModel, roe, payout, sustainableGrowth, messages,
  };
}
