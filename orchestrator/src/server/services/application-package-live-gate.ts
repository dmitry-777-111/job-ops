import type {
  MarketObservationAuthority,
  MarketPosting,
  MarketPostingObservation,
} from "@shared/types";

export type ApplicationVacancyLiveState = "live" | "closed" | "unknown";

export interface ApplicationVacancyLiveGateEvidence {
  source: string;
  authority: MarketObservationAuthority;
  sourceUrl: string;
  observedAt: string;
  isLive: boolean;
}

export interface ApplicationVacancyLiveGateResult {
  state: ApplicationVacancyLiveState;
  blocksGeneration: boolean;
  requiresReview: boolean;
  reason:
    | "authoritative_live_evidence"
    | "authoritative_closed_evidence"
    | "no_authoritative_live_evidence";
  evidence: ApplicationVacancyLiveGateEvidence | null;
  canonicalStatus: MarketPosting["status"];
  evaluatedAt: string;
}

const AUTHORITY_RANK: Record<MarketObservationAuthority, number> = {
  unknown: 0,
  aggregator: 1,
  manual: 2,
  board: 3,
  official: 4,
};

function toTimestamp(value: string): number {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isAuthoritative(
  observation: MarketPostingObservation,
): observation is MarketPostingObservation & { isLive: boolean } {
  return (
    observation.isLive !== null &&
    (observation.authority === "official" || observation.authority === "board")
  );
}

export function deriveApplicationVacancyLiveGate(input: {
  posting: MarketPosting;
  observations: MarketPostingObservation[];
  now?: string;
}): ApplicationVacancyLiveGateResult {
  const evidence = input.observations.filter(isAuthoritative).sort((a, b) => {
    const authorityDelta =
      AUTHORITY_RANK[b.authority] - AUTHORITY_RANK[a.authority];
    if (authorityDelta !== 0) return authorityDelta;
    return toTimestamp(b.observedAt) - toTimestamp(a.observedAt);
  })[0];

  const evaluatedAt = input.now ?? new Date().toISOString();

  if (!evidence) {
    return {
      state: "unknown",
      blocksGeneration: false,
      requiresReview: true,
      reason: "no_authoritative_live_evidence",
      evidence: null,
      canonicalStatus: input.posting.status,
      evaluatedAt,
    };
  }

  const selectedEvidence: ApplicationVacancyLiveGateEvidence = {
    source: evidence.source,
    authority: evidence.authority,
    sourceUrl: evidence.sourceUrl,
    observedAt: evidence.observedAt,
    isLive: evidence.isLive,
  };

  if (evidence.isLive) {
    return {
      state: "live",
      blocksGeneration: false,
      requiresReview: false,
      reason: "authoritative_live_evidence",
      evidence: selectedEvidence,
      canonicalStatus: input.posting.status,
      evaluatedAt,
    };
  }

  return {
    state: "closed",
    blocksGeneration: true,
    requiresReview: false,
    reason: "authoritative_closed_evidence",
    evidence: selectedEvidence,
    canonicalStatus: input.posting.status,
    evaluatedAt,
  };
}
