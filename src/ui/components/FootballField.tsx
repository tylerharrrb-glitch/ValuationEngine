/** Football field: single colour, reference rows outlined, price as a vertical line. */
import type { FootballRow } from '../../engine/football';
import { fmtPerShare } from '../../export/format';

export function FootballField({ rows, price }: { rows: FootballRow[]; price: number }) {
  const vals = rows.flatMap((r) => [r.low, r.high]).concat(price).filter(Number.isFinite);
  if (!vals.length) return null;
  const lo = Math.min(...vals) * 0.9;
  const hi = Math.max(...vals) * 1.05;
  const W = 760;
  const labelW = 250;
  const plotW = W - labelW - 60;
  const X = (v: number) => labelW + ((v - lo) / (hi - lo)) * plotW;
  const rh = 30;
  const H = rows.length * rh + 34;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: 900, fontFamily: 'var(--font-ui)', fontSize: 12 }} role="img" aria-label="Football field of value per share by method">
      {rows.map((r, i) => {
        const y = i * rh + 8;
        const x0 = X(r.low);
        const x1 = X(r.high);
        return (
          <g key={r.id}>
            <text x={0} y={y + 14} fill="var(--text2)">{r.label}</text>
            <rect x={x0} y={y} width={Math.max(2, x1 - x0)} height={18} fill={r.reference ? 'none' : 'var(--text2)'} stroke="var(--text2)" />
            <text x={x0 - 4} y={y + 14} fill="var(--text2)" textAnchor="end" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPerShare(r.low)}</text>
            <text x={x1 + 4} y={y + 14} fill="var(--text2)" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmtPerShare(r.high)}</text>
            <line x1={X(r.mid)} x2={X(r.mid)} y1={y} y2={y + 18} stroke="var(--bg)" strokeWidth={2} />
          </g>
        );
      })}
      <line x1={X(price)} x2={X(price)} y1={0} y2={rows.length * rh + 6} stroke="var(--text)" strokeWidth={1.5} />
      <text x={X(price)} y={rows.length * rh + 22} fill="var(--text)" textAnchor="middle">Price {fmtPerShare(price)}</text>
    </svg>
  );
}
