import type {
  ApplicationPackage,
  MarketPosting,
  MarketPostingObservation,
  MarketPostingVersion,
  MasterCareerProfileVersion,
} from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApplicationPackage: vi.fn(),
  getMasterCareerProfileVersion: vi.fn(),
  getMarketPostingVersion: vi.fn(),
  getCandidateMarketPostingLiveContext: vi.fn(),
  evaluateStoredApplicationPackageQa: vi.fn(),
}));

vi.mock("@server/repositories/application-packages", () => ({
  getApplicationPackage: mocks.getApplicationPackage,
}));
vi.mock("@server/repositories/candidate-profile", () => ({
  getMasterCareerProfileVersion: mocks.getMasterCareerProfileVersion,
}));
vi.mock("@server/repositories/market-inventory", () => ({
  getMarketPostingVersion: mocks.getMarketPostingVersion,
  getCandidateMarketPostingLiveContext:
    mocks.getCandidateMarketPostingLiveContext,
}));
vi.mock("./application-package-approval", () => ({
  evaluateStoredApplicationPackageQa: mocks.evaluateStoredApplicationPackageQa,
}));

import { getApplicationPackageReview } from "./application-package-review";

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

const observation: MarketPostingObservation = {
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
};

const profile: MasterCareerProfileVersion = {
  id: "profile-v1",
  version: 1,
  status: "active",
  profile: {
    basics: { name: "Candidate" },
    sections: {
      skills: {
        items: [
          {
            id: "other",
            name: "Pneumatics",
            description: "",
            level: 3,
            keywords: [],
            visible: true,
          },
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
  },
  source: "manual",
  sourceRef: null,
  provenance: null,
  createdAt: "2026-10-04T10:00:00.000Z",
  activatedAt: "2026-10-04T10:01:00.000Z",
  supersededAt: null,
};

const pinnedPosting: MarketPostingVersion = {
  id: "posting-v1",
  marketPostingId: posting.id,
  version: 1,
  contentFingerprint: "fp",
  snapshot: {
    source: "official-ats",
    authority: "official",
    sourceUrl: "https://example.com/jobs/1",
    employer: "Example",
    title: "Field Service Engineer",
    location: "Toronto",
    description: posting.description,
    isLive: true,
  },
  createdAt: "2026-10-04T10:00:00.000Z",
};

const applicationPackage: ApplicationPackage = {
  id: "package-1",
  version: 1,
  status: "draft",
  marketPostingId: posting.id,
  marketPostingVersionId: pinnedPosting.id,
  profileVersionId: profile.id,
  strategyVersionId: "strategy-v1",
  generationPolicyVersion: "freeze3-mvp-v1",
  evidenceMap: [
    {
      requirementKey: "placeholder",
      requirementText: "PLC knowledge is required.",
      evidenceSource: "profile",
      evidenceRef: "sections.skills.plc.name",
      evidenceText: "PLC",
      confidence: 1,
    },
  ],
  gaps: [],
  targetedCvJson: {
    ...profile.profile,
    sections: {
      ...profile.profile.sections,
      skills: {
        ...profile.profile.sections?.skills,
        items: [
          profile.profile.sections?.skills?.items?.[1],
          profile.profile.sections?.skills?.items?.[0],
        ],
      },
    },
  } as Record<string, unknown>,
  coverLetter: "letter",
  formAnswers: {},
  approvedAt: null,
  exportedAt: null,
  staleReason: null,
  createdAt: "2026-10-04T12:00:00.000Z",
  updatedAt: "2026-10-04T12:00:00.000Z",
};

describe("F3-6E application package review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApplicationPackage.mockResolvedValue(applicationPackage);
    mocks.getMasterCareerProfileVersion.mockResolvedValue(profile);
    mocks.getMarketPostingVersion.mockResolvedValue(pinnedPosting);
    mocks.getCandidateMarketPostingLiveContext.mockResolvedValue({
      posting,
      observations: [observation],
    });
    mocks.evaluateStoredApplicationPackageQa.mockResolvedValue({
      applicationPackage,
      qa: {
        pass: true,
        blockingIssues: [],
        staleReasons: [],
        gapCount: 0,
        hardGapCount: 0,
      },
    });
  });

  it("builds a candidate review with live state, requirement coverage and change highlights", async () => {
    const result = await getApplicationPackageReview({
      applicationPackageId: applicationPackage.id,
    });

    expect(result.liveGate.state).toBe("live");
    expect(result.posting).toMatchObject({
      employer: "Example",
      title: "Field Service Engineer",
    });
    expect(result.changedFromMaster).toEqual([
      "sections.skills.items: reordered by verified vacancy relevance",
    ]);
    expect(result.requirementCoverage).toHaveLength(2);
  });

  it("uses the pinned posting version for requirement extraction", async () => {
    const result = await getApplicationPackageReview({
      applicationPackageId: applicationPackage.id,
    });

    expect(
      result.requirementCoverage.map((item) => item.requirement.text),
    ).toEqual(["PLC knowledge is required.", "A 309A licence is preferred."]);
  });

  it("rejects a mismatched pinned posting version", async () => {
    mocks.getMarketPostingVersion.mockResolvedValue({
      ...pinnedPosting,
      marketPostingId: "different-posting",
    });

    await expect(
      getApplicationPackageReview({
        applicationPackageId: applicationPackage.id,
      }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
  });
});
