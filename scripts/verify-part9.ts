/**
 * Gate for Part 9 (UI): production build passes; no emoji or banned marketing words in src/ui
 * (the owner's own credential on the About page is the only allowed use of "certified");
 * no per-section rainbow colours; Playwright smoke test (load MOPCO, run, open audit panel,
 * export Excel and PDF) passes.
 */
import { execSync, spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { Gate } from './lib/gate';

const g = new Gate('verify-part9');
const build = spawnSync('npx', ['vite', 'build'], { encoding: 'utf8', shell: true });
g.check('vite build passes', build.status === 0, (build.stdout + build.stderr).split('\n').filter((l) => /built in|error/i.test(l)).join(' ').trim());
try {
  execSync('npx tsc --noEmit -p tsconfig.json', { stdio: 'pipe' });
  g.check('tsc --noEmit clean', true);
} catch (e: any) {
  g.check('tsc --noEmit clean', false, String(e.stdout).slice(0, 400));
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}
const uiFiles = [...walk('src/ui'), 'src/index.css', 'index.html'];
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/u;
const BANNED = ['institutional-grade', 'comprehensive', 'robust', 'cutting-edge', 'seamless', 'powerful', 'state-of-the-art', 'ai-powered', 'certified'];
const emojiHits: string[] = [];
const bannedHits: string[] = [];
for (const f of uiFiles) {
  const text = readFileSync(f, 'utf8');
  text.split('\n').forEach((line, i) => {
    if (EMOJI.test(line)) emojiHits.push(`${f}:${i + 1}`);
    const low = line.toLowerCase();
    for (const w of BANNED) {
      if (!low.includes(w)) continue;
      const allowed = w === 'certified' && f.endsWith('DocsPages.tsx') && line.includes('FMVA');
      if (!allowed) bannedHits.push(`${f}:${i + 1} "${w}"`);
    }
  });
}
g.check('no emoji characters in src/ui, index.css, index.html', emojiHits.length === 0, emojiHits.join(', ') || `${uiFiles.length} files scanned`);
g.check('no banned words in UI text (About-page credential excepted)', bannedHits.length === 0, bannedHits.join(', ') || 'none');
const css = readFileSync('src/index.css', 'utf8');
const rainbow = /(purple|violet|fuchsia|pink|orange|cyan|teal)/i.test(css) || uiFiles.some((f) => /bg-(purple|red|green|blue|orange)-\d{3}/.test(readFileSync(f, 'utf8')));
g.check('no per-section colour classes (single neutral section style)', !rainbow);
const fonts = new Set([...css.matchAll(/@fontsource\/([a-z-]+)/g)].map((m) => m[1]));
g.check('at most two type families, self-hosted', fonts.size <= 2 && !/fonts\.googleapis/.test(readFileSync('index.html', 'utf8')), [...fonts].join(', '));

const e2e = spawnSync('npx', ['playwright', 'test'], { encoding: 'utf8', shell: true, env: { ...process.env, WOLF_E2E_OUT: 'test-results/e2e' } });
const e2eOut = (e2e.stdout + e2e.stderr).trim().split('\n').filter((l) => /passed|failed|✓|✘|Error/.test(l)).join(' | ');
g.check('Playwright smoke: load MOPCO, run valuation, open audit panel, export Excel and PDF', e2e.status === 0, e2eOut);
g.finish();
