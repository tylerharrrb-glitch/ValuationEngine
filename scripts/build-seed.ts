/**
 * Builds data/rates.seed.json and the initial data/rates.manual.json.
 *
 * Owner-verified values (research of 23-Sep-2026, spec 3.3) are written as given.
 * Damodaran values are parsed from the recorded workbooks in tests/fixtures/sources/
 * (downloaded 23-Sep-2026) with the same adapters the Worker uses.
 *
 * Run: npx tsx scripts/build-seed.ts            (writes both files)
 *      npx tsx scripts/build-seed.ts --seed-only
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { RateEntry, RatesRegistry } from '../src/domain/rates';
import {
  parseCountryPremium, parseIndustryBetas, parseSyntheticRatings, parseCurrencyRiskfree, DAMODARAN_URLS,
} from '../src/data/sources/damodaran';
import { validateRegistry } from '../src/data/registry/registry';

const VERIFIED = '2026-09-23';
const fx = (f: string) => readFileSync(`tests/fixtures/sources/${f}`);

type E = Omit<RateEntry, 'verifiedAt' | 'method' | 'status'> & Partial<Pick<RateEntry, 'verifiedAt' | 'method' | 'status'>>;
const entry = (e: E): RateEntry => ({ verifiedAt: VERIFIED, method: 'manual', status: 'ok', ...e });

const CBE_HOME = 'https://www.cbe.org.eg/en/';
const PCT: [number, number] = [0, 60];

const owner: RateEntry[] = [
  entry({ id: 'cbe.overnightDeposit', label: 'CBE overnight deposit rate', value: 19.0, unit: 'pct', nature: 'official', sourceName: 'Central Bank of Egypt', sourceUrl: CBE_HOME, asOf: '2026-08-20', updateCycle: 'mpc', bounds: PCT, notes: 'MPC 20-Aug-2026: rates held. Next MPC 24-Sep-2026; must be re-verified after that meeting.' }),
  entry({ id: 'cbe.overnightLending', label: 'CBE overnight lending rate', value: 20.0, unit: 'pct', nature: 'official', sourceName: 'Central Bank of Egypt', sourceUrl: CBE_HOME, asOf: '2026-08-20', updateCycle: 'mpc', bounds: PCT }),
  entry({ id: 'cbe.mainOperation', label: 'CBE main operation rate', value: 19.5, unit: 'pct', nature: 'official', sourceName: 'Central Bank of Egypt', sourceUrl: CBE_HOME, asOf: '2026-08-20', updateCycle: 'mpc', bounds: PCT }),
  entry({ id: 'cbe.discountRate', label: 'CBE discount rate', value: 19.5, unit: 'pct', nature: 'official', sourceName: 'Central Bank of Egypt', sourceUrl: 'https://www.cbe.org.eg/en/monetary-policy/mpc-meetings-schedule', asOf: '2026-08-20', updateCycle: 'mpc', bounds: PCT }),
  entry({ id: 'cbe.inflationTarget', label: 'CBE inflation target', value: '7% ±2pp, Q4 2026 (CBE guidance now points to 2H 2027)', unit: 'text', nature: 'official', sourceName: 'Central Bank of Egypt', sourceUrl: 'https://www.cbe.org.eg/en/monetary-policy/inflation-target', asOf: '2026-08-20', updateCycle: 'event', bounds: null }),
  entry({ id: 'cbe.inflationTargetPoint', label: 'CBE inflation target (point, for USD-check inflation fade)', value: 7.0, unit: 'pct', nature: 'official', sourceName: 'Central Bank of Egypt', sourceUrl: 'https://www.cbe.org.eg/en/monetary-policy/inflation-target', asOf: '2026-08-20', updateCycle: 'event', bounds: [0, 30], notes: 'Point of the 7% ±2pp target. The CBE homepage on 23-Sep-2026 shows "7.0% (±2 percentage points) on average in 2026 Q4".' }),
  entry({ id: 'cbe.mpcCalendar', label: 'CBE MPC meeting dates', value: ['2026-08-20', '2026-09-24'], unit: 'date_list', nature: 'official', sourceName: 'Central Bank of Egypt, MPC meetings schedule', sourceUrl: 'https://www.cbe.org.eg/en/monetary-policy/mpc-meetings-schedule', asOf: VERIFIED, updateCycle: 'event', bounds: null, status: 'unconfirmed', notes: '20-Aug-2026 confirmed by the CBE homepage news item "MPC decides to keep key policy rates unchanged". 24-Sep-2026 from owner research. The CBE schedule page renders dates with JavaScript and could not be read on 23-Sep-2026; remaining 2026 and 2027 dates are unconfirmed.' }),
  entry({ id: 'eg.cpiUrbanHeadline', label: 'Urban headline CPI inflation, y/y', value: 14.5, unit: 'pct', nature: 'official', sourceName: 'CAPMAS (reported by CBE)', sourceUrl: 'https://www.cbe.org.eg/en/monetary-policy/inflation', asOf: '2026-08-31', updateCycle: 'monthly', bounds: [-10, 100], notes: 'August 2026, released 10-Sep-2026.' }),
  entry({ id: 'eg.cpiCore', label: 'Core CPI inflation, y/y', value: 14.9, unit: 'pct', nature: 'official', sourceName: 'Central Bank of Egypt', sourceUrl: 'https://www.cbe.org.eg/en/monetary-policy/inflation', asOf: '2026-08-31', updateCycle: 'monthly', bounds: [-10, 100] }),
  entry({ id: 'eg.cpiNationwide', label: 'Nationwide CPI inflation, y/y', value: 12.7, unit: 'pct', nature: 'official', sourceName: 'CAPMAS', sourceUrl: 'TO_VERIFY', asOf: '2026-08-31', updateCycle: 'monthly', bounds: [-10, 100] }),
  entry({ id: 'eg.usdEgp', label: 'USD/EGP', value: 51.9, unit: 'EGP_per_USD', nature: 'market_quote', sourceName: 'Market close (owner research)', sourceUrl: 'TO_VERIFY', asOf: '2026-09-21', updateCycle: 'daily', bounds: [1, 500], notes: 'Approximate market close 21-Sep-2026. The Worker replaces it with the CBE official rate (https://www.cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates).' }),
  entry({ id: 'eg.bond10ySecondary', label: 'EGP 10Y government bond, secondary-market YTM', value: 21.58, unit: 'pct', nature: 'market_quote', sourceName: 'Cbonds', sourceUrl: 'TO_VERIFY', asOf: '2026-05-21', updateCycle: 'daily', bounds: PCT, status: 'stale', notes: 'Last quote available to the owner is 21-May-2026. Manual refresh required.' }),
  entry({ id: 'eg.tbondAuction.3y', label: 'EGP T-bond auction, 3y fixed coupon (accepted weighted average yield)', value: 23.147, unit: 'pct', nature: 'official', sourceName: 'Central Bank of Egypt, T-bond auction results', sourceUrl: 'https://www.cbe.org.eg/en/auctions/egp-t-bonds-fixed-coupon', asOf: '2026-07-13', updateCycle: 'monthly', bounds: PCT, notes: 'Auction of 13-Jul-2026. Recent auctions were 2Y and 3Y only.' }),
  entry({ id: 'us.treasury10y', label: 'US Treasury 10Y', value: 5.1, unit: 'pct', nature: 'market_quote', sourceName: 'US Treasury (intraday, owner research)', sourceUrl: 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve', asOf: '2026-09-23', updateCycle: 'daily', bounds: [0, 20], notes: 'Approximate intraday level 23-Sep-2026. The Worker replaces it with the Treasury daily par yield (10-year).' }),
  entry({ id: 'eg.rating.moodys', label: "Egypt sovereign rating, Moody's", value: 'Caa1 (positive)', unit: 'rating', nature: 'official', sourceName: "Moody's Ratings", sourceUrl: 'https://ratings.moodys.com/ratings-news/462631', asOf: '2026-04-03', updateCycle: 'event', bounds: null }),
  entry({ id: 'eg.rating.sp', label: 'Egypt sovereign rating, S&P', value: 'B (stable)', unit: 'rating', nature: 'official', sourceName: 'S&P Global Ratings press release; secondary: Ahram Online 11-Apr-2026', sourceUrl: 'TO_VERIFY', asOf: '2026-04-11', updateCycle: 'event', bounds: null, notes: 'Affirmation at B/B, stable. Candidate primary URL from a search index, not opened (HTTP 403 on 23-Sep-2026): https://www.spglobal.com/ratings/en/regulatory/article/-/view/type/HTML/id/3544107. The pre-v2 engine showed "B-", which is wrong.' }),
  entry({ id: 'eg.rating.fitch', label: 'Egypt sovereign rating, Fitch', value: 'B (stable)', unit: 'rating', nature: 'official', sourceName: 'Fitch Ratings (via Ahram Online, 11-Oct-2025)', sourceUrl: 'https://english.ahram.org.eg/News/554751.aspx', asOf: '2025-10-11', updateCycle: 'event', bounds: null, status: 'unconfirmed', notes: 'Last confirmed action Oct-2025. No 2026 Fitch action found on 23-Sep-2026; fitchratings.com not checked successfully.' }),
  entry({ id: 'eg.cit', label: 'Corporate income tax rate', value: 22.5, unit: 'pct', nature: 'statutory', sourceName: 'Income Tax Law 91/2005', sourceUrl: 'TO_VERIFY', asOf: '2026-09-23', updateCycle: 'event', bounds: [0, 60] }),
  entry({ id: 'eg.dividendWht.listed', label: 'Dividend withholding tax, EGX-listed', value: 5.0, unit: 'pct', nature: 'statutory', sourceName: 'Law 151 of 2026', sourceUrl: 'TO_VERIFY', asOf: '2026-07-29', updateCycle: 'event', bounds: [0, 50], notes: 'Effective 29-Jul-2026.' }),
  entry({ id: 'eg.dividendWht.unlisted', label: 'Dividend withholding tax, unlisted', value: 10.0, unit: 'pct', nature: 'statutory', sourceName: 'Law 151 of 2026', sourceUrl: 'TO_VERIFY', asOf: '2026-07-29', updateCycle: 'event', bounds: [0, 50] }),
  entry({ id: 'eg.participationExemption', label: 'Participation exemption', value: '100% exempt if holding ≥25% for ≥2 years', unit: 'text', nature: 'statutory', sourceName: 'Law 151 of 2026', sourceUrl: 'TO_VERIFY', asOf: '2026-07-29', updateCycle: 'event', bounds: null }),
  entry({ id: 'eg.stampDuty.perSide', label: 'EGX stamp duty per side', value: 0.05, unit: 'pct', nature: 'statutory', sourceName: 'Law 151 of 2026', sourceUrl: 'TO_VERIFY', asOf: '2026-07-29', updateCycle: 'event', bounds: [0, 5], notes: '0.05% per side on EGX trades; 0.025% per side for same-session trades; withheld by MCDR from the 29-Jul-2026 session. The pre-v2 engine used 0.125%, which is wrong.' }),
  entry({ id: 'eg.cgt.listedShares', label: 'Capital gains tax, listed shares', value: 'Exempt (replaced by stamp duty)', unit: 'text', nature: 'statutory', sourceName: 'Law 151 of 2026', sourceUrl: 'TO_VERIFY', asOf: '2026-07-29', updateCycle: 'event', bounds: null }),
];

// Damodaran, parsed from the recorded workbooks.
const cp = parseCountryPremium(fx('damodaran-ctrypremJuly26.xlsx'));
const cr = parseCurrencyRiskfree(fx('damodaran-DiffInflationRiskfree26.xlsx'));
const betas = parseIndustryBetas(fx('damodaran-betaemerg.xls'));
const syn = parseSyntheticRatings(fx('damodaran-ratings.xls'));
const JULY = '2026-07-01';
const dam = (e: Omit<E, 'nature' | 'updateCycle' | 'sourceName'> & Partial<Pick<E, 'updateCycle' | 'sourceName'>>) =>
  entry({ nature: 'estimate', updateCycle: 'semiannual', sourceName: 'Damodaran Online (NYU Stern)', ...e } as E);

const damodaran: RateEntry[] = [
  dam({ id: 'damodaran.matureErp', label: 'Mature-market equity risk premium', value: cp.matureErp, unit: 'pct', sourceUrl: DAMODARAN_URLS.ctryPremJuly26, asOf: JULY, bounds: [2, 10], notes: `Workbook "ERPs by country"!E3 = ${cp.matureErp / 100}. Secondary sources conflict (4.17% vs 4.20%); the workbook value is used.` }),
  dam({ id: 'damodaran.volatilityScalar', label: 'Equity / bond volatility scalar', value: cp.volatilityScalar, unit: 'ratio', sourceUrl: DAMODARAN_URLS.ctryPremJuly26, asOf: JULY, bounds: [0.5, 4], notes: 'Workbook "ERPs by country"!E6 (from "Relative Equity Volatility"!D7).' }),
  dam({ id: 'damodaran.egypt.rating', label: 'Egypt rating used by Damodaran', value: cp.moodysRating, unit: 'rating', sourceUrl: DAMODARAN_URLS.ctryPremJuly26, asOf: JULY, bounds: null, notes: "Moody's rating column." }),
  dam({ id: 'damodaran.egypt.defaultSpread', label: 'Egypt rating-based default spread', value: cp.defaultSpread, unit: 'pct', sourceUrl: DAMODARAN_URLS.ctryPremJuly26, asOf: JULY, bounds: [0, 30] }),
  dam({ id: 'damodaran.egypt.crp', label: 'Egypt country risk premium', value: cp.crp, unit: 'pct', sourceUrl: DAMODARAN_URLS.ctryPremJuly26, asOf: JULY, bounds: [0, 30] }),
  dam({ id: 'damodaran.egypt.totalErp', label: 'Egypt total equity risk premium', value: cp.totalErp, unit: 'pct', sourceUrl: DAMODARAN_URLS.ctryPremJuly26, asOf: JULY, bounds: [2, 40] }),
  dam({ id: 'damodaran.rf.egp', label: 'Inflation-based riskfree rate, EGP', value: cr.riskfree, unit: 'pct', sourceUrl: DAMODARAN_URLS.currencyRiskfreeJuly26, asOf: JULY, bounds: [0, 60], notes: 'Damodaran "Inflation-based riskfree rates, by currency - July 2026": USD riskfree adjusted for the expected inflation differential (2026-2031).' }),
  dam({ id: 'damodaran.rf.usd', label: 'Riskfree rate, USD (Damodaran, July 2026)', value: cr.usdRiskfree, unit: 'pct', sourceUrl: DAMODARAN_URLS.currencyRiskfreeJuly26, asOf: JULY, bounds: [0, 20] }),
  dam({ id: 'damodaran.expectedInflation.egp', label: 'Expected inflation 2026-2031, Egypt', value: cr.expectedInflation, unit: 'pct', sourceUrl: DAMODARAN_URLS.currencyRiskfreeJuly26, asOf: JULY, bounds: [-5, 100] }),
  dam({ id: 'damodaran.expectedInflation.usd', label: 'Expected inflation, USD', value: cr.usdExpectedInflation, unit: 'pct', sourceUrl: DAMODARAN_URLS.currencyRiskfreeJuly26, asOf: JULY, bounds: [-5, 30] }),
  dam({ id: 'damodaran.betas.emerging', label: 'Emerging-market industry betas (unlevered, corrected for cash)', value: betas.rows as unknown as RateEntry['value'], unit: 'table', sourceUrl: DAMODARAN_URLS.betasEmerging, asOf: betas.updated, bounds: null, updateCycle: 'event', notes: `Dataset "Date updated" cell = ${betas.updated}; updated annually in January. ${betas.rows.length} industries.` }),
  dam({ id: 'damodaran.synthetic.large', label: 'Synthetic rating table, large non-financial firms', value: syn.large as unknown as RateEntry['value'], unit: 'table', sourceUrl: DAMODARAN_URLS.ratings, asOf: '2026-01-01', bounds: null, updateCycle: 'event', notes: 'ratings.html: "Data used is as of January 2026". Spreads in percent.' }),
  dam({ id: 'damodaran.synthetic.small', label: 'Synthetic rating table, smaller and riskier firms', value: syn.small as unknown as RateEntry['value'], unit: 'table', sourceUrl: DAMODARAN_URLS.ratings, asOf: '2026-01-01', bounds: null, updateCycle: 'event', notes: 'ratings.html: "Data used is as of January 2026". Spreads in percent.' }),
];

const entries = [...owner, ...damodaran];
const seed: RatesRegistry = { snapshotId: `seed-${VERIFIED}`, generatedAt: `${VERIFIED}T00:00:00Z`, entries };
const errors = validateRegistry(seed);
if (errors.length) {
  console.error('Seed failed validation:\n' + errors.join('\n'));
  process.exit(1);
}
writeFileSync('data/rates.seed.json', JSON.stringify(seed, null, 2) + '\n');
console.log(`data/rates.seed.json: ${entries.length} entries`);
if (!process.argv.includes('--seed-only')) {
  const manual: RatesRegistry = { ...seed, snapshotId: `manual-${VERIFIED}` };
  writeFileSync('data/rates.manual.json', JSON.stringify(manual, null, 2) + '\n');
  console.log(`data/rates.manual.json: ${entries.length} entries (initial state = seed)`);
}
