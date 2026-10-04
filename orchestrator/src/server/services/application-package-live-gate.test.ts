import type { MarketPosting, MarketPostingObservation } from "@shared/types";
import { describe, expect, it } from "vitest";
import { deriveApplicationVacancyLiveGate } from "./application-package-live-gate";

const posting: MarketPosting = {
  id: "posting-1",
  identityKey: "source:job-1",
  canonicalUrl: "https://example.com/jobs/1",
  officialRequisitionId: "REQ-1",
  employer: "Example",
  title: "Field Service Engineer",
  location: "Toronto, ON",
  description: "Role",
  datePosted: "2026-10-01",
  deadline: null,
  salaryText: null,
  salaryCurrency: "CAD",
  contentFingerprint: "fp-1",
  canonicalAuthority: "official",
  status: "live",
  firstObservedAt: "2026-10-01T12:00:00.000Z",
  lastObservedAt: "2026-10-04T12:00:00.000Z",
  lastLiveCheckedAt: "2026-10-04T12:00:00.000Z",
  closedAt: null,
  createdAt: "2026-10-01T12:00:00.000Z",
  updatedAt: "2026-10-04T12:00:00.000Z",
};

function observation(
  patch: Partial<MarketPostingObservation>,
): MarketPostingObservation {
  return {
    id: "obs-1",
    marketPostingId: posting.id,
    source: "official-ats",
    authority: "official",
    sourceJobId: "REQ-1",
    sourceUrl: "https://example.com/jobs/1",
    observationKey: "obs-key",
    observedAt: "2026-10-04T12:00:00.000Z",
    sourceUpdatedAt: null,
    isLive: true,
    payloadFingerprint: "fp",
    createdAt: "2026-10-04T12:00:00.000Z",
    updatedAt: "2026-10-04T12:00:00.000Z",
    ...patch,
  };
}

describe("deriveApplicationVacancyLiveGate", () => {
  it("allows generation when the strongest authoritative evidence says live", () => {
    const result = deriveApplicationVacancyLiveGate({
      posting,
      observations: [
        observation({
          id: "board-closed",
          authority: "board",
          isLive: false,
          observedAt: "2026-10-04T13:00:00.000Z",
        }),
        observation({
          id: "official-live",
          authority: "official",
          isLive: true,
          observedAt: "2026-10-04T12:00:00.000Z",
        }),
      ],
      now: "2026-10-04T14:00:00.000Z",
    });

    expect(result).toMatchObject({
      state: "live",
      blocksGeneration: false,
      requiresReview: false,
      reason: "authoritative_live_evidence",
      canonicalStatus: "live",
      evidence: {
        authority: "official",
        isLive: true,
      },
    });
  });

  it("blocks generation when authoritative evidence says closed", () => {
    const result = deriveApplicationVacancyLiveGate({
      posting,
      observations: [
        observation({
          isLive: false,
          observedAt: "2026-10-04T13:00:00.000Z",
        }),
      ],
    });

    expect(result).toMatchObject({
      state: "closed",
      blocksGeneration: true,
      requiresReview: false,
      reason: "authoritative_closed_evidence",
    });
  });

  it("uses the newest observation within the same authority level", () => {
    const result = deriveApplicationVacancyLiveGate({
      posting,
      observations: [
        observation({
          id: "older",
          isLive: true,
          observedAt: "2026-10-04T11:00:00.000Z",
        }),
        observation({
          id: "newer",
          isLive: false,
          observedAt: "2026-10-04T13:00:00.000Z",
        }),
      ],
    });

    expect(result.state).toBe("closed");
    expect(result.evidence?.observedAt).toBe("2026-10-04T13:00:00.000Z");
  });

  it("returns unknown instead of trusting non-authoritative or canonical status alone", () => {
    const result = deriveApplicationVacancyLiveGate({
      posting: {
        ...posting,
        status: "closed",
        closedAt: "2026-10-04T10:00:00Z",
      },
      observations: [
        observation({
          authority: "aggregator",
          isLive: false,
        }),
        observation({
          id: "manual-live",
          authority: "manual",
          isLive: true,
        }),
      ],
    });

    expect(result).toMatchObject({
      state: "unknown",
      blocksGeneration: false,
      requiresReview: true,
      reason: "no_authoritative_live_evidence",
      evidence: null,
      canonicalStatus: "closed",
    });
  });

  it("does not turn missing live evidence into a negative signal", () => {
    const result = deriveApplicationVacancyLiveGate({
      posting,
      observations: [observation({ isLive: null })],
    });

    expect(result.state).toBe("unknown");
    expect(result.blocksGeneration).toBe(false);
    expect(result.requiresReview).toBe(true);
  });
});
