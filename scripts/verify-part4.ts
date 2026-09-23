/**
 * Gate for Part 4: the MOPCO fixture loads, every total ties to the pound,
 * and the derived facts assert exactly.
 */
import { Gate } from './lib/gate';
import { loadMopco } from '../tests/lib/fixtures';
import { companyChecks, companyFacts, validateCompany } from '../src/engine/company';

const g = new Gate('verify-part4');
const c = (() => {
  try {
    return loadMopco();
  } catch (e) {
    g.check('fixture tests/fixtures/mopco-fy2025.json loads', false, String(e));
    return g.finish();
  }
})();
g.check('fixture tests/fixtures/mopco-fy2025.json loads', true, `${c.name}, ${c.years.map((y) => y.fiscalYear).join('/')}`);
const issues = validateCompany(c);
g.check('mandatory fields present (valuation date, price, price date, shares)', issues.length === 0, issues.map((i) => i.text).join('; '));
g.check('historical years 2021-2023 left empty (not filled)', c.years.every((y) => y.fiscalYear >= 2024) && c.years.length === 2);

for (const t of companyChecks(c)) {
  const d = t.computed - t.expected;
  g.check(t.label, t.pass, `expected ${t.expected.toLocaleString('en-US')}, computed ${t.computed.toLocaleString('en-US')}${d !== 0 ? `, DIFFERENCE ${d} EGP` : ''}`);
}

const f = companyFacts(c);
const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 6 });
g.check('market cap at 36.00 = 103,253,049,468', f.marketCap === 103_253_049_468, fmt(f.marketCap));
g.check('shareholder DPS paid in 2025 = 7,277,190,123 / 2,868,140,263 = 2.5373', f.shareholderDps.toFixed(4) === '2.5373', f.shareholderDps.toFixed(6));
g.check('employee & board distributions / prior-year net profit = 10.22%', f.distributionsToPriorYearProfit !== null && (f.distributionsToPriorYearProfit * 100).toFixed(2) === '10.22', ((f.distributionsToPriorYearProfit ?? 0) * 100).toFixed(4) + '%');
g.check('unrestricted cash & financial investments = 16,938,579,826', f.unrestrictedCashAndInvestments === 16_938_579_826, fmt(f.unrestrictedCashAndInvestments));
g.check('interest-bearing debt (leases) = 149,970,052', f.interestBearingDebt === 149_970_052 && f.bankDebtAndBonds === 0, fmt(f.interestBearingDebt));
g.check('reported EBITDA = 15,279,059,550', f.reportedEbitda === 15_279_059_550, fmt(f.reportedEbitda));
g.check('export share of sales = 79.97%', f.exportShare !== null && (f.exportShare * 100).toFixed(2) === '79.97', ((f.exportShare ?? 0) * 100).toFixed(4) + '%');
g.check('restricted (pledged) deposits = 1,010,115,488', f.restrictedCash === 1_010_115_488, fmt(f.restrictedCash));
g.check('FY2025 effective tax rate = 19.47%', (f.effectiveTaxRate * 100).toFixed(2) === '19.47', (f.effectiveTaxRate * 100).toFixed(4) + '%');
const y24 = c.years[0].income;
g.check('FY2024 effective tax rate = 20.67%', ((-y24.totalTax / y24.profitBeforeTax) * 100).toFixed(2) === '20.67');
g.check('EPS FY2025 = 3.94 on 2,868,140,263 shares', (c.years[1].income.netProfit / c.shares.basic).toFixed(2) === '3.94');
g.check('EPS FY2024 = 5.27 on 2,868,140,263 shares', (c.years[0].income.netProfit / c.shares.basic).toFixed(2) === '5.27');
g.check('pre-v2 DPS 3.08 reproduced only when employee/board distributions are wrongly included',
  ((7_277_190_123 + 1_545_237_364) / c.shares.basic).toFixed(2) === '3.08' && f.shareholderDps.toFixed(2) !== '3.08');
g.finish();
