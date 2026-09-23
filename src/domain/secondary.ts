/**
 * User-entered inputs for the secondary modules. Nothing here is ever bundled or
 * defaulted: an empty list means the module is not applicable and is flagged.
 */
import type { ISODate } from './company';

export interface PeerInput {
  name: string;
  ticker: string;
  currency: string;
  price: number;
  priceDate: ISODate;
  shares: number;
  /** Interest-bearing debt including leases. */
  debt: number;
  /** Cash and financial investments (unrestricted). */
  cash: number;
  minorityInterest: number;
  revenueLtm: number;
  ebitdaLtm: number;
  ebitdaNtm: number | null;
  netIncomeLtm: number;
  netIncomeNtm: number | null;
  bookEquity: number;
  source: string;
  sourceDate: ISODate;
}

export interface TransactionInput {
  target: string;
  acquirer: string;
  date: ISODate;
  enterpriseValue: number;
  revenue: number;
  ebitda: number;
  currency: string;
  source: string;
}

export interface SegmentInput {
  name: string;
  method: 'multiple' | 'value';
  ebitda: number;
  multiple: number;
  /** Segment enterprise value when method = 'value' (e.g. a separate DCF). */
  value: number;
  source: string;
}

export interface BrokerTarget {
  broker: string;
  target: number;
  date: ISODate;
  rating: string;
  sourceUrl: string;
}

export interface SecondaryInputs {
  peers: PeerInput[];
  transactions: TransactionInput[];
  segments: SegmentInput[];
  brokers: BrokerTarget[];
  /** Company risks typed by the user (the PDF shows a Key risks section only when non-empty). */
  risks: string[];
}

export const EMPTY_SECONDARY: SecondaryInputs = { peers: [], transactions: [], segments: [], brokers: [], risks: [] };
