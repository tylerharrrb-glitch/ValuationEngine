/** DCF: present values, both terminal values, EV → equity bridge (METHODOLOGY section 5). Pure. */
import type { CompanyData } from '../domain/company';
import { dilutedShares, latestYear } from '../domain/company';
import type { Assumptions, BridgeOptions } from '../domain/assumptions';
import type { BridgeLine, DcfResult, EngineMessage, ForecastResult, NormalizationResult } from '../domain/result';
import type { Timeline } from './timeline';
import { discountFactor } from './timeline';
import { terminalGrowth, type CoreOverrides } from './forecast';

/** Every bridge line from the base-year balance sheet (METHODOLOGY 5.3). `cit` in percent. */
/** Negation without producing -0 for display. */
const neg = (x: number) => (x === 0 ? 0 : -x);

export function bridgeLines(c: CompanyData, opt: BridgeOptions, cit: number): BridgeLine[] {
  const y = latestYear(c);
  const b = y.balance;
  const bs = `Balance sheet ${y.periodEnd}`;
  const eb = b.employeeBenefitsCurrent + b.employeeBenefitsNonCurrent;
  const ebFactor = opt.taxEffectEmployeeBenefits ? 1 - cit / 100 : 1;
  const lines: BridgeLine[] = [
    { id: 'cash', label: 'Cash and cash equivalents', amount: b.cash, source: bs },
    { id: 'fvtpl', label: 'FVTPL securities', amount: b.fvtplSecurities, source: bs },
    { id: 'amortizedCurrent', label: 'Amortized-cost investments (current)', amount: b.amortizedCostCurrent, source: bs },
    { id: 'amortizedNonCurrent', label: 'Amortized-cost investments (non-current)', amount: b.amortizedCostNonCurrent, source: bs },
    {
      id: 'associates',
      label: opt.associatesFairValue === null ? 'Associates (carrying value)' : 'Associates (analyst fair value)',
      amount: opt.associatesFairValue ?? b.associates,
      source: opt.associatesFairValue === null ? bs : 'Analyst assumption',
    },
    { id: 'restricted', label: 'Restricted / pledged deposits (excluded, memo)', amount: b.restrictedCashCurrent + b.restrictedCashNonCurrent, source: bs, memo: true },
    { id: 'debt', label: 'Bank debt and bonds', amount: neg(b.bankDebtCurrent + b.bankDebtNonCurrent + b.bondsNonCurrent), source: bs },
    { id: 'leases', label: 'Lease liabilities (EAS 49)', amount: neg(b.leaseCurrent + b.leaseNonCurrent), source: bs },
  ];
  if (opt.deductEmployeeBenefits) {
    lines.push({
      id: 'employeeBenefits',
      label: opt.taxEffectEmployeeBenefits ? 'Employee benefit obligations (after tax)' : 'Employee benefit obligations',
      amount: neg(eb * ebFactor),
      source: bs,
    });
  }
  lines.push(
    { id: 'minority', label: 'Minority interest', amount: neg(b.minorityInterest), source: bs },
    { id: 'preferred', label: 'Preferred equity', amount: neg(b.preferredEquity), source: bs },
  );
  return lines;
}

export function bridgeTotal(lines: BridgeLine[]): number {
  return lines.filter((l) => !l.memo).reduce((s, l) => s + l.amount, 0);
}

export function runDcf(
  c: CompanyData,
  a: Assumptions,
  norm: NormalizationResult,
  f: ForecastResult,
  tl: Timeline,
  waccPct: number,
  cit: number,
  ov: CoreOverrides = {},
): DcfResult {
  const messages: EngineMessage[] = [];
  const w = waccPct / 100;
  const g = terminalGrowth(a, ov) / 100;
  const n = f.years.length;

  const rows = f.years.map((y, k) => {
    const p = tl.periods[k];
    const df = discountFactor(w, p.years);
    const included = y.fcff * p.fraction;
    return { period: p, fcff: y.fcff, fcffIncluded: included, discountFactor: df, pv: included * df };
  });
  const sumPv = rows.reduce((s, r) => s + r.pv, 0);

  const dfTv = discountFactor(w, tl.tvYears);
  const last = f.years[n - 1];
  const next = f.terminal;
  const gordonValid = g < w;
  if (!gordonValid) messages.push({ severity: 'error', code: 'g_ge_wacc', text: `Terminal growth ${(g * 100).toFixed(2)}% is not below WACC ${(w * 100).toFixed(2)}%; the Gordon terminal value is undefined.` });
  const gordonTv = gordonValid ? next.fcff / (w - g) : NaN;
  const multiple = ov.exitMultiple ?? a.terminal.exitMultiple.value;
  const exitTv = last.ebitda * multiple;
  const ronic = (a.terminal.ronic ?? waccPct) / 100;
  const selected = ov.terminalMethod ?? a.terminal.method;
  const terminal = {
    gordonFcffNext: next.fcff,
    gordonTv,
    gordonPv: gordonTv * dfTv,
    exitEbitda: last.ebitda,
    exitTv,
    exitPv: exitTv * dfTv,
    impliedExitMultipleFromGordon: gordonTv / last.ebitda,
    impliedGrowthFromExit: w - next.fcff / exitTv,
    ronic,
    impliedReinvestmentRate: g / ronic,
    forecastReinvestmentRate: (next.capex - next.da + next.deltaNwc) / next.nopat,
    discountYears: tl.tvYears,
    discountFactor: dfTv,
    selected,
  } as DcfResult['terminal'];
  const pvTerminal = selected === 'gordon' ? terminal.gordonPv : terminal.exitPv;
  const enterpriseValue = sumPv + pvTerminal;
  const tvShareOfEv = pvTerminal / enterpriseValue;

  if (g * 100 > a.terminal.nominalGdpProxy) {
    messages.push({ severity: 'warning', code: 'g_gdp', text: `Terminal growth ${(g * 100).toFixed(2)}% exceeds the long-run nominal GDP proxy of ${a.terminal.nominalGdpProxy.toFixed(2)}%.` });
  }
  if (tvShareOfEv > 0.85) {
    messages.push({ severity: 'warning', code: 'tv_share', text: `Terminal value is ${(tvShareOfEv * 100).toFixed(1)}% of enterprise value (above 85%).` });
  }
  if (Math.abs(terminal.impliedReinvestmentRate - terminal.forecastReinvestmentRate) > 0.05) {
    messages.push({
      severity: 'info',
      code: 'value_driver',
      text: `Terminal reinvestment rate in the forecast is ${(terminal.forecastReinvestmentRate * 100).toFixed(1)}% of NOPAT; g / RONIC implies ${(terminal.impliedReinvestmentRate * 100).toFixed(1)}%.`,
    });
  }

  const bridge = bridgeLines(c, a.bridge, cit);
  const equityValue = enterpriseValue + bridgeTotal(bridge);
  const shares = dilutedShares(c);
  const perShare = equityValue / shares;
  const i = latestYear(c).income;
  return {
    wacc: waccPct,
    rows,
    sumPv,
    terminal,
    pvTerminal,
    enterpriseValue,
    tvShareOfEv,
    bridge,
    equityValue,
    dilutedShares: shares,
    perShare,
    upside: perShare / c.price - 1,
    impliedEvEbitdaLtm: enterpriseValue / norm.normalizedEbitda,
    impliedEvEbitdaNtm: enterpriseValue / f.years[0].ebitda,
    impliedPeLtm: equityValue / i.netProfit,
    impliedPeNtm: equityValue / f.years[0].netProfit,
    messages,
  };
}
