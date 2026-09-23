/**
 * Egyptian Accounting Standards panel: factual references only, generated from the
 * statement lines present in the company data. No generic compliance claims.
 */
import type { CompanyData } from '../domain/company';
import { latestYear } from '../domain/company';

export interface EasReference {
  standard: string;
  topic: string;
  text: string;
}

const egp = (x: number) => `EGP ${Math.round(x).toLocaleString('en-US')}`;

export function easReferences(c: CompanyData): EasReference[] {
  const y = latestYear(c);
  const b = y.balance;
  const i = y.income;
  const at = `at ${y.periodEnd}`;
  const out: EasReference[] = [];
  const fin = b.fvtplSecurities + b.amortizedCostCurrent + b.amortizedCostNonCurrent;
  if (fin > 0 || i.eclReversal !== 0) {
    const parts = [
      b.fvtplSecurities ? `FVTPL securities ${egp(b.fvtplSecurities)}` : '',
      b.amortizedCostCurrent + b.amortizedCostNonCurrent ? `amortized-cost investments ${egp(b.amortizedCostCurrent + b.amortizedCostNonCurrent)}` : '',
      i.eclReversal ? `expected credit loss ${i.eclReversal > 0 ? 'reversal' : 'charge'} ${egp(Math.abs(i.eclReversal))} in FY${y.fiscalYear}` : '',
    ].filter(Boolean);
    out.push({
      standard: 'EAS 47',
      topic: 'Financial instruments',
      text: `The statements report ${parts.join('; ')} ${at}. Investments are added in the equity bridge; the ECL movement is removed in normalization.`,
    });
  }
  if (b.customerAdvances > 0) {
    out.push({
      standard: 'EAS 48',
      topic: 'Revenue from contracts with customers',
      text: `Customer advances (contract liabilities) of ${egp(b.customerAdvances)} ${at} are treated as operating working capital.`,
    });
  }
  const leases = b.leaseCurrent + b.leaseNonCurrent;
  if (leases > 0 || b.rightOfUseAssets > 0) {
    out.push({
      standard: 'EAS 49',
      topic: 'Leases',
      text: `Lease liabilities of ${egp(leases)} and right-of-use assets of ${egp(b.rightOfUseAssets)} ${at}; lease interest ${egp(-i.financeCostLease)} in FY${y.fiscalYear}. Lease liabilities are deducted in the equity bridge and lease interest is used for the cost of debt.`,
    });
  }
  return out;
}
