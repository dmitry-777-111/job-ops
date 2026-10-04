import type {
  MarketPosting,
  MarketPostingObservation,
  ResumeProfile,
} from "@shared/types";
import { describe, expect, it } from "vitest";
import { buildApplicationPackagePreparation } from "./application-package-preparation";

const posting: MarketPosting = {
  id: "posting-1",
  identityKey: "req:1",
  canonicalUrl: "https://example.com/jobs/1",
  officialRequisitionId: "REQ-1",
  employer: "Example",
  title: "Field Service Engineer",
  location: "Toronto",
  description: [
    "PLC knowledge is required.",
    "A 309A licence is preferred.",
  ].join("\n"),
  datePosted: null,
  deadline: null,
  salaryText: null,
  salaryCurrency: "CAD",
  contentFingerprint: "fp",
  canonicalAuthority: "official",
  status: "live",
  firstObservedAt: "2026-10-04T10:00:00.000Z",
  lastObservedAt: "2026-10-04T12:00:00.000Z",
  lastLiveCheckedAt: "2026-10-04T12:00:00.000Z",
  closedAt: null,
  createdAt: "2026-10-04T10:00:00.000Z",
  updatedAt: "2026-10-04T12:00:00.000Z",
};

const profile: ResumeProfile = {
  sections: {
    skills: {
      items: [
        {
          id: "plc",
          name: "PLC",
          description: "",
          level: 3,
          keywords: [],
          visible: true,
        },
      ],
    },
  },
};

function observation(
  isLive: boolean | null,
  authority: MarketPostingObservation["authority"] = "official",
): MarketPostingObservation {
  return {
    id: "obs",
    marketPostingId: posting.id,
    source: "official-ats",
    authority,
    sourceJobId: "REQ-1",
    sourceUrl: "https://example.com/jobs/1",
    observationKey: "obs-key",
    observedAt: "2026-10-04T12:00:00.000Z",
    sourceUpdatedAt: null,
    isLive,
    payloadFingerprint: "fp",
    createdAt: "2026-10-04T12:00:00.000Z",
    updatedAt: "2026-10-04T12:00:00.000Z",
  };
}

describe("F3-6 application package preparation", () => {
  it("creates a preparation-ready evidence map only when live evidence is authoritative", () => {
    const result = buildApplicationPackagePreparation({
      posting,
      observations: [observation(true)],
      profile,
    });

    expect(result.canCreateDraft).toBe(true);
    expect(result.requiresLiveStateAcknowledgement).toBe(false);
    expect(result.requirements).toHaveLength(2);
    expect(result.evidenceMap).toHaveLength(1);
    expect(result.gaps).toHaveLength(1);
  });

  it("blocks preparation when authoritative evidence says closed", () => {
    const result = buildApplicationPackagePreparation({
      posting,
      observations: [observation(false)],
      profile,
    });

    expect(result.liveGate.state).toBe("closed");
    expect(result.canCreateDraft).toBe(false);
    expect(result.requiresLiveStateAcknowledgement).toBe(false);
  });

  it("requires explicit acknowledgement for unknown live state", () => {
    const unknown = buildApplicationPackagePreparation({
      posting,
      observations: [observation(null, "aggregator")],
      profile,
    });
    expect(unknown.liveGate.state).toBe("unknown");
    expect(unknown.canCreateDraft).toBe(false);
    expect(unknown.requiresLiveStateAcknowledgement).toBe(true);

    const acknowledged = buildApplicationPackagePreparation({
      posting,
      observations: [observation(null, "aggregator")],
      profile,
      acknowledgeUnknownLiveState: true,
    });
    expect(acknowledged.canCreateDraft).toBe(true);
    expect(acknowledged.requiresLiveStateAcknowledgement).toBe(false);
  });
});
