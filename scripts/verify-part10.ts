/**
 * Gate for Part 10 (confidentiality): network log of the Playwright run contains no fixture values
 * and no cross-origin request; the only data endpoint is /api/rates; the built bundle references no
 * removed third-party endpoint; storage is IndexedDB; the clear-all control and privacy note exist.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Gate } from './lib/gate';

const g = new Gate('verify-part10');
if (!existsSync('dist/index.html')) spawnSync('npx', ['vite', 'build'], { shell: true, stdio: 'pipe' });
const e2e = spawnSync('npx', ['playwright', 'test'], { encoding: 'utf8', shell: true, env: { ...process.env, WOLF_E2E_OUT: 'test-results/e2e' } });
g.check('Playwright run completed', e2e.status === 0, (e2e.stdout + e2e.stderr).split('\n').filter((l) => /passed|failed/.test(l)).join(' ').trim());
const log = JSON.parse(readFileSync('test-results/e2e/network.json', 'utf8')) as { requests: { url: string; method: string; body: string }[] };
const hits = log.requests.filter((r) => /26844075576|MFPC/i.test(`${r.url} ${r.body}`));
g.check('no request URL or body contains "26844075576" or "MFPC"', hits.length === 0, `${log.requests.length} requests inspected${hits.length ? ': ' + hits.map((h) => h.url).join(', ') : ''}`);
const origin = 'http://127.0.0.1:4173/';
const cross = log.requests.filter((r) => !r.url.startsWith(origin) && !/^(data|blob):/.test(r.url));
g.check('no cross-origin request', cross.length === 0, cross.map((r) => r.url).join(', ') || 'all same-origin');
const dataReqs = log.requests.filter((r) => r.url.startsWith(origin) && !/\/assets\//.test(r.url) && r.url !== origin);
g.check('only data request is GET /api/rates', dataReqs.every((r) => r.method === 'GET' && new URL(r.url).pathname === '/api/rates'), dataReqs.map((r) => `${r.method} ${new URL(r.url).pathname}`).join(', '));
g.check('no request carries a body', log.requests.every((r) => !r.body));

const bundle = readdirSync('dist/assets').filter((f) => f.endsWith('.js')).map((f) => readFileSync(join('dist/assets', f), 'utf8')).join('\n');
const removed = ['api.groq.com', 'financialmodelingprep.com', 'query1.finance.yahoo.com', 'query2.finance.yahoo.com', 'corsproxy', 'allorigins', 'open.er-api.com', 'fonts.googleapis.com'];
const found = removed.filter((h) => bundle.includes(h));
g.check('built bundle references no removed third-party endpoint', found.length === 0, found.join(', ') || removed.join(', ') + ' absent');
const src = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? src(join(dir, d.name)) : [join(dir, d.name)]));
const uiCode = src('src/ui').map((f) => [f, readFileSync(f, 'utf8')] as const);
const fetches = uiCode.filter(([, t]) => /\bfetch\s*\(/.test(t)).map(([f]) => f);
g.check('the UI calls fetch only in useRates (/api/rates)', fetches.length === 1 && fetches[0].endsWith('useRates.ts') && readFileSync(fetches[0], 'utf8').includes("fetch('/api/rates'"), fetches.join(', '));
const ls = uiCode.filter(([, t]) => /localStorage\.setItem/.test(t)).map(([f]) => f);
g.check('localStorage written only for the theme', ls.length === 1 && ls[0].endsWith('App.tsx') && /localStorage\.setItem\('wolf-theme'/.test(readFileSync(ls[0], 'utf8')), ls.join(', '));
g.check('saved valuations use IndexedDB', /indexedDB\.open/.test(readFileSync('src/ui/state/storage.ts', 'utf8')));
const about = readFileSync('src/ui/pages/DocsPages.tsx', 'utf8');
g.check('"Clear all local data" control present', about.includes('Clear all local data') && about.includes('clearAllLocalData'));
g.check('privacy note states what is and is not stored', about.includes('Stored in this browser') && about.includes('never sent to a server'));
const fn = readdirSync('functions/api');
g.check('server functions: only /api/rates (no storage of user data)', fn.length === 1 && fn[0] === 'rates.ts' && !/request\.(json|text|formData)/.test(readFileSync('functions/api/rates.ts', 'utf8')), fn.join(', '));
g.finish();
