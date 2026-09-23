/** Minimal HTML-to-text helpers usable in a Cloudflare Worker (no DOM). */

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  ndash: '-',
  mdash: '-',
  plusmn: '+/-',
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

/** Visible text lines of an HTML document, trimmed, empty lines removed. */
export function htmlToLines(html: string): string[] {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  return decodeEntities(noScript.replace(/<[^>]+>/g, '\n'))
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

/** Parse "19.00%" / "19.407%" / "51.3606" / "15,000,000,000" into a number. */
export function parseNumber(s: string | undefined): number {
  if (s == null) return NaN;
  const m = /-?[\d,]*\.?\d+/.exec(s.replace(/\s/g, ''));
  return m ? Number(m[0].replace(/,/g, '')) : NaN;
}

/** Value on the line following the first line matching `label` (case-insensitive exact match). */
export function valueAfter(lines: string[], label: string, from = 0): { value: string; index: number } | null {
  const target = label.toLowerCase();
  for (let i = from; i < lines.length - 1; i++) {
    if (lines[i].toLowerCase() === target) return { value: lines[i + 1], index: i + 1 };
  }
  return null;
}

/** DD/MM/YYYY → YYYY-MM-DD. */
export function dmyToIso(s: string): string {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s);
  if (!m) throw new Error(`Not a DD/MM/YYYY date: ${s}`);
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}

const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

/** "23 Sep 2026" or "September 23, 2026" → YYYY-MM-DD. */
export function textDateToIso(s: string): string {
  let m = /(\d{1,2})\s+([A-Za-z]{3})[a-z]*\.?\s+(\d{4})/.exec(s);
  if (m) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`;
  m = /([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),\s*(\d{4})/.exec(s);
  if (m) return `${m[3]}-${MONTHS[m[1].toLowerCase()]}-${m[2].padStart(2, '0')}`;
  throw new Error(`Unrecognised date text: ${s}`);
}
