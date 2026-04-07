/**
 * SOTP (Sum-of-the-Parts) Valuation Engine — Phase 4, Task #20
 *
 * Allows users to define business segments with individual
 * revenue, EBITDA margin, and applicable multiples, then
 * aggregates to a consolidated enterprise/equity value.
 */

export interface SOTPSegment {
  /** Segment name (e.g., "Consumer Banking", "Cement", "Real Estate") */
  name: string;
  /** Segment revenue */
  revenue: number;
  /** Segment EBITDA margin (%) */
  ebitdaMargin: number;
  /** Applicable EV/EBITDA multiple */
  evEbitdaMultiple: number;
  /** Optional: applicable P/E multiple (0 = not used) */
  peMultiple: number;
  /** Optional: segment net income (for P/E approach) */
  netIncome: number;
}

export interface SOTPResult {
  segments: SOTPSegmentResult[];
  /** Sum of all segment EVs */
  totalEV: number;
  /** Less: Corporate overhead (holding company discount) */
  holdingDiscount: number;
  /** Net Debt */
  netDebt: number;
  /** Implied equity value */
  equityValue: number;
  /** Implied per-share value */
  perShareValue: number;
  /** Upside vs current price (%) */
  upside: number;
}

export interface SOTPSegmentResult {
  name: string;
  revenue: number;
  ebitda: number;
  multiple: string;
  impliedEV: number;
  /** % contribution to total EV */
  contribution: number;
}

export const DEFAULT_SOTP_SEGMENTS: SOTPSegment[] = [
  { name: 'Segment A', revenue: 0, ebitdaMargin: 25, evEbitdaMultiple: 10, peMultiple: 0, netIncome: 0 },
  { name: 'Segment B', revenue: 0, ebitdaMargin: 20, evEbitdaMultiple: 8, peMultiple: 0, netIncome: 0 },
];

export function calculateSOTP(
  segments: SOTPSegment[],
  netDebt: number,
  sharesOutstanding: number,
  currentPrice: number,
  holdingDiscountPct: number = 10,
): SOTPResult {
  const segmentResults: SOTPSegmentResult[] = segments.map(seg => {
    const ebitda = seg.revenue * (seg.ebitdaMargin / 100);
    // Prefer EV/EBITDA; fallback to P/E if EV/EBITDA multiple is 0
    let impliedEV: number;
    let multipleLabel: string;
    if (seg.evEbitdaMultiple > 0 && ebitda > 0) {
      impliedEV = ebitda * seg.evEbitdaMultiple;
      multipleLabel = `${seg.evEbitdaMultiple.toFixed(1)}x EV/EBITDA`;
    } else if (seg.peMultiple > 0 && seg.netIncome > 0) {
      impliedEV = seg.netIncome * seg.peMultiple;
      multipleLabel = `${seg.peMultiple.toFixed(1)}x P/E`;
    } else {
      impliedEV = 0;
      multipleLabel = 'N/A';
    }
    return {
      name: seg.name,
      revenue: seg.revenue,
      ebitda,
      multiple: multipleLabel,
      impliedEV,
      contribution: 0, // computed below
    };
  });

  const totalEV = segmentResults.reduce((sum, s) => sum + s.impliedEV, 0);
  // Set contribution %
  segmentResults.forEach(s => {
    s.contribution = totalEV > 0 ? (s.impliedEV / totalEV) * 100 : 0;
  });

  const holdingDiscount = totalEV * (holdingDiscountPct / 100);
  const equityValue = totalEV - holdingDiscount - netDebt;
  const perShareValue = sharesOutstanding > 0 ? Math.max(0, equityValue / sharesOutstanding) : 0;
  const upside = currentPrice > 0 ? ((perShareValue - currentPrice) / currentPrice) * 100 : 0;

  return {
    segments: segmentResults,
    totalEV,
    holdingDiscount,
    netDebt,
    equityValue,
    perShareValue,
    upside,
  };
}
