/**
 * Gate for Part 12 (documentation): README, METHODOLOGY, DATA_SOURCES (generated and current),
 * RATES_RUNBOOK, CHANGELOG and CLAUDE.md exist and contain the required material.
 */
import { existsSync, readFileSync } from 'node:fs';
import { Gate } from './lib/gate';
import { renderDataSources } from './gen-data-sources';

const g = new Gate('verify-part12');
const read = (f: string) => (existsSync(f) ? readFileSync(f, 'utf8').replace(/\r\n/g, '\n') : '');
const readme = read('README.md');
g.check('README.md: what it is, how to run, architecture diagram', /## Run/.test(readme) && /## Architecture/.test(readme) && /src\/engine \(pure\)/.test(readme));
const meth = read('docs/METHODOLOGY.md');
g.check('docs/METHODOLOGY.md: formulas, conventions and references', /## 1\. Timeline/.test(meth) && /## 5\. Discounted cash flow/.test(meth) && /McKinsey/.test(meth) && /CFA Institute/.test(meth) && /Damodaran/.test(meth));
g.check('docs/DATA_SOURCES.md generated from the registry and current', read('docs/DATA_SOURCES.md') === renderDataSources());
const rb = read('docs/RATES_RUNBOOK.md');
g.check('docs/RATES_RUNBOOK.md: MPC, CPI, Damodaran, ratings, tax, manual file, manual refresh', ['MPC', 'CPI', 'Damodaran', 'Rating actions', 'Tax changes', 'rates.manual.json', 'Manual refresh'].every((s) => rb.includes(s)));
g.check('CHANGELOG.md present with golden-file history', /Golden file history/.test(read('CHANGELOG.md')));
const cl = read('CLAUDE.md');
g.check('CLAUDE.md carries the standards of Parts 0, 3, 7, 9 and 10', ['Execution rules (spec Part 0)', 'Rates (spec Part 3)', 'Excel (spec Part 7)', 'UI (spec Part 9)', 'Confidentiality (spec Part 10)'].every((s) => cl.includes(s)));
g.check('docs/PRIVACY.md and docs/PROGRESS.md present', existsSync('docs/PRIVACY.md') && existsSync('docs/PROGRESS.md'));
const banned = ['institutional-grade', 'comprehensive', 'robust', 'cutting-edge', 'seamless', 'powerful', 'state-of-the-art', 'ai-powered'];
const hits = banned.filter((w) => readme.toLowerCase().includes(w));
g.check('README uses no banned marketing words', hits.length === 0, hits.join(', '));
g.finish();
