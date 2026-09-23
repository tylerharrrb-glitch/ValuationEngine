/** Gate for Part 1: docs/AUDIT.md exists and contains all nine sections. */
import { existsSync, readFileSync } from 'node:fs';
import { Gate } from './lib/gate';

const g = new Gate('verify-part1');
const path = 'docs/AUDIT.md';
const exists = existsSync(path);
g.check('docs/AUDIT.md exists', exists);
const text = exists ? readFileSync(path, 'utf8') : '';
const sections = [
  '## 1. File tree',
  '## 2. Calculation functions',
  '## 3. Hardcoded macro constants',
  '## 4. Equity-value / EV-bridge',
  '## 5. Discounting convention',
  '## 6. Network calls',
  '## 7. Excel exporter',
  '## 8. Module inventory',
  '## 9. Test suite',
];
for (const s of sections) g.check(`section present: ${s}`, text.includes(s));
g.check('test suite section has verbatim vitest summary', /Tests\s+\d+ passed/.test(text));
g.finish();
