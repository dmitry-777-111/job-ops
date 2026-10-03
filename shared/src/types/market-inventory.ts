export const MARKET_POSTING_STATUSES = [
  "unknown",
  "live",
  "closed",
  "stale",
] as const;
export type MarketPostingStatus = (typeof MARKET_POSTING_STATUSES)[number];

export const MARKET_OBSERVATION_AUTHORITIES = [
  "unknown",
  "aggregator",
  "board",
  "manual",
  "official",
] as const;
export type MarketObservationAuthority =
  (typeof MARKET_OBSERVATION_AUTHORITIES)[number];

export interface MarketPosting {
  id: string;
  identityKey: string;
  canonicalUrl: string | null;
  officialRequisitionId: string | null;
  employer: string;
  title: string;
  location: string | null;
  description: string | null;
  datePosted: string | null;
  deadline: string | null;
  salaryText: string | null;
  salaryCurrency: string | null;
  contentFingerprint: string;
  canonicalAuthority: MarketObservationAuthority;
  status: MarketPostingStatus;
  firstObservedAt: string;
  lastObservedAt: string;
  lastLiveCheckedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MarketPostingVersion {
  id: string;
  marketPostingId: string;
  version: number;
  contentFingerprint: string;
  snapshot: MarketPostingInput;
  createdAt: string;
}

export interface MarketPostingObservation {
  id: string;
  marketPostingId: string;
  source: string;
  authority: MarketObservationAuthority;
  sourceJobId: string | null;
  sourceUrl: string;
  observationKey: string;
  observedAt: string;
  sourceUpdatedAt: string | null;
  isLive: boolean | null;
  payloadFingerprint: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketPostingInput {
  source: string;
  authority?: MarketObservationAuthority;
  sourceJobId?: string | null;
  sourceUrl: string;
  canonicalUrl?: string | null;
  officialRequisitionId?: string | null;
  employer: string;
  title: string;
  location?: string | null;
  description?: string | null;
  datePosted?: string | null;
  deadline?: string | null;
  salaryText?: string | null;
  salaryCurrency?: string | null;
  sourceUpdatedAt?: string | null;
  isLive?: boolean | null;
}
