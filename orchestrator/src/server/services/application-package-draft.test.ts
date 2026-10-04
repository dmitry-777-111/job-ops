import type {
  ApplicationPackage,
  CandidateStrategyProfile,
  MarketPosting,
  MarketPostingObservation,
  MasterCareerProfileVersion,
} from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createApplicationPackageDraft: vi.fn(),
  getActiveMasterCareerProfile: vi.fn(),
  getActiveCandidateStrategy: vi.fn(),
  getCandidateMarketPostingLiveContext: vi.fn(),
  getLatestMarketPostingVersionId: vi.fn(),
}));

vi.mock("@server/repositories/application-packages", () => ({
  createApplicationPackageDraft: mocks.createApplicationPackageDraft,
}));
vi.mock("@server/repositories/candidate-profile", () => ({
  getActiveMasterCareerProfile: mocks.getActiveMasterCareerProfile,
}));
vi.mock("@server/repositories/candidate-strategy", () => ({
  getActiveCandidateStrategy: mocks.getActiveCandidateStrategy,
}));
vi.mock("@server/repositories/market-inventory", () => ({
  getCandidateMarketPostingLiveContext:
    mocks.getCandidateMarketPostingLiveContext,
  getLatestMarketPostingVersionId: mocks.getLatestMarketPostingVersionId,
}));

import {
  APPLICATION_PACKAGE_GENERATION_POLICY_VERSION,
  prepareApplicationPackageDraft,
} from "./application-package-draft";

const posting: MarketPosting = {
  id: "posting-1",
  identityKey: "req:1",
  canonicalUrl: "https://example.com/jobs/1",
  officialRequisitionId: "REQ-1",
  employer: "Example",
  title: "Field Service Engineer",
  location: "Toronto",
  description: "PLC knowledge is required.",
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

function observation(isLive: boolean | null): MarketPostingObservation {
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
    isLive,
    payloadFingerprint: "fp",
    createdAt: "2026-10-04T12:00:00.000Z",
    updatedAt: "2026-10-04T12:00:00.000Z",
  };
}

const profile: MasterCareerProfileVersion = {
  id: "profile-v1",
  version: 1,
  status: "active",
  profile: {
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
  },
  source: "manual",
  sourceRef: null,
  provenance: null,
  createdAt: "2026-10-04T10:00:00.000Z",
  activatedAt: "2026-10-04T10:01:00.000Z",
  supersededAt: null,
};

const strategy: CandidateStrategyProfile = {
  id: "strategy-v1",
  version: 1,
  status: "active",
  targetMarkets: ["canada"],
  targetRoleFamilies: ["field service"],
  excludedRoleFamilies: [],
  constraints: [],
  freeformNotes: null,
  createdAt: "2026-10-04T10:00:00.000Z",
  activatedAt: "2026-10-04T10:01:00.000Z",
};

const draft: ApplicationPackage = {
  id: "package-1",
  version: 1,
  status: "draft",
  marketPostingId: posting.id,
  marketPostingVersionId: "posting-v1",
  profileVersionId: profile.id,
  strategyVersionId: strategy.id,
  generationPolicyVersion: APPLICATION_PACKAGE_GENERATION_POLICY_VERSION,
  evidenceMap: [],
  gaps: [],
  targetedCvJson: null,
  coverLetter: null,
  formAnswers: {},
  approvedAt: null,
  exportedAt: null,
  staleReason: null,
  createdAt: "2026-10-04T12:00:00.000Z",
  updatedAt: "2026-10-04T12:00:00.000Z",
};

describe("F3-6D application package draft orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCandidateMarketPostingLiveContext.mockResolvedValue({
      posting,
      observations: [observation(true)],
    });
    mocks.getActiveMasterCareerProfile.mockResolvedValue(profile);
    mocks.getActiveCandidateStrategy.mockResolvedValue(strategy);
    mocks.getLatestMarketPostingVersionId.mockResolvedValue("posting-v1");
    mocks.createApplicationPackageDraft.mockResolvedValue(draft);
  });

  it("pins posting/profile/strategy/policy versions and persists verified evidence/gaps", async () => {
    const result = await prepareApplicationPackageDraft({
      marketPostingId: posting.id,
    });

    expect(result.applicationPackage).toBe(draft);
    expect(mocks.createApplicationPackageDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        marketPostingId: posting.id,
        marketPostingVersionId: "posting-v1",
        profileVersionId: profile.id,
        strategyVersionId: strategy.id,
        generationPolicyVersion: APPLICATION_PACKAGE_GENERATION_POLICY_VERSION,
      }),
    );

    const call = mocks.createApplicationPackageDraft.mock.calls[0][0];
    expect(call.evidenceMap).toHaveLength(1);
    expect(call.gaps).toEqual([]);
  });

  it("blocks a closed vacancy before any package is persisted", async () => {
    mocks.getCandidateMarketPostingLiveContext.mockResolvedValue({
      posting,
      observations: [observation(false)],
    });

    await expect(
      prepareApplicationPackageDraft({ marketPostingId: posting.id }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    expect(mocks.createApplicationPackageDraft).not.toHaveBeenCalled();
  });

  it("requires explicit acknowledgement when the vacancy live state is unknown", async () => {
    mocks.getCandidateMarketPostingLiveContext.mockResolvedValue({
      posting,
      observations: [],
    });

    await expect(
      prepareApplicationPackageDraft({ marketPostingId: posting.id }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    expect(mocks.createApplicationPackageDraft).not.toHaveBeenCalled();

    await expect(
      prepareApplicationPackageDraft({
        marketPostingId: posting.id,
        acknowledgeUnknownLiveState: true,
      }),
    ).resolves.toMatchObject({ applicationPackage: draft });
    expect(mocks.createApplicationPackageDraft).toHaveBeenCalledTimes(1);
  });

  it("requires active profile and strategy before persisting a draft", async () => {
    mocks.getActiveMasterCareerProfile.mockResolvedValue(null);

    await expect(
      prepareApplicationPackageDraft({ marketPostingId: posting.id }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    mocks.getActiveMasterCareerProfile.mockResolvedValue(profile);
    mocks.getActiveCandidateStrategy.mockResolvedValue(null);

    await expect(
      prepareApplicationPackageDraft({ marketPostingId: posting.id }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    expect(mocks.createApplicationPackageDraft).not.toHaveBeenCalled();
  });
});
