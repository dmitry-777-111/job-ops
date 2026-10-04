import type {
  ApplicationPackage,
  MarketPosting,
  MasterCareerProfileVersion,
} from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApplicationPackage: vi.fn(),
  updateApplicationPackage: vi.fn(),
  getActiveMasterCareerProfile: vi.fn(),
  getMasterCareerProfileVersion: vi.fn(),
  getActiveCandidateStrategy: vi.fn(),
  getCandidateMarketPostingLiveContext: vi.fn(),
  getLatestMarketPostingVersionId: vi.fn(),
}));

vi.mock("@server/repositories/application-packages", () => ({
  getApplicationPackage: mocks.getApplicationPackage,
  updateApplicationPackage: mocks.updateApplicationPackage,
}));
vi.mock("@server/repositories/candidate-profile", () => ({
  getActiveMasterCareerProfile: mocks.getActiveMasterCareerProfile,
  getMasterCareerProfileVersion: mocks.getMasterCareerProfileVersion,
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
  approveApplicationPackage,
  evaluateStoredApplicationPackageQa,
} from "./application-package-approval";
import { APPLICATION_PACKAGE_GENERATION_POLICY_VERSION } from "./application-package-draft";
import { buildTruthConstrainedApplicationDraft } from "./application-package-generation";

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

const evidenceMap = [
  {
    requirementKey: "plc",
    requirementText: "PLC knowledge is required.",
    evidenceSource: "profile" as const,
    evidenceRef: "sections.skills.plc.name",
    evidenceText: "PLC",
    confidence: 1,
  },
];

function packageDraft(): ApplicationPackage {
  const generated = buildTruthConstrainedApplicationDraft({
    posting,
    profile: profile.profile,
    evidenceMap,
    gaps: [],
  });
  return {
    id: "package-1",
    version: 1,
    status: "draft",
    marketPostingId: posting.id,
    marketPostingVersionId: "posting-v1",
    profileVersionId: profile.id,
    strategyVersionId: "strategy-v1",
    generationPolicyVersion: APPLICATION_PACKAGE_GENERATION_POLICY_VERSION,
    evidenceMap,
    gaps: [],
    targetedCvJson: generated.targetedCvJson,
    coverLetter: generated.coverLetter,
    formAnswers: generated.formAnswers,
    approvedAt: null,
    exportedAt: null,
    staleReason: null,
    createdAt: "2026-10-04T12:00:00.000Z",
    updatedAt: "2026-10-04T12:00:00.000Z",
  };
}

function liveObservation(isLive: boolean | null) {
  return {
    id: "obs",
    marketPostingId: posting.id,
    source: "official-ats",
    authority: "official" as const,
    sourceJobId: "REQ-1",
    sourceUrl: "https://example.com/jobs/1",
    observationKey: "obs",
    observedAt: "2026-10-04T12:00:00.000Z",
    sourceUpdatedAt: null,
    isLive,
    payloadFingerprint: "fp",
    createdAt: "2026-10-04T12:00:00.000Z",
    updatedAt: "2026-10-04T12:00:00.000Z",
  };
}

describe("F3-6D application package approval orchestration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApplicationPackage.mockResolvedValue(packageDraft());
    mocks.getMasterCareerProfileVersion.mockResolvedValue(profile);
    mocks.getActiveMasterCareerProfile.mockResolvedValue(profile);
    mocks.getActiveCandidateStrategy.mockResolvedValue({
      id: "strategy-v1",
    });
    mocks.getLatestMarketPostingVersionId.mockResolvedValue("posting-v1");
    mocks.getCandidateMarketPostingLiveContext.mockResolvedValue({
      posting,
      observations: [liveObservation(true)],
    });
    mocks.updateApplicationPackage.mockImplementation(
      async (_id: string, patch: Partial<ApplicationPackage>) => ({
        ...packageDraft(),
        ...patch,
        approvedAt:
          patch.status === "approved" ? "2026-10-04T13:00:00.000Z" : null,
      }),
    );
  });

  it("returns a passing QA result for a current evidence-bounded package", async () => {
    const result = await evaluateStoredApplicationPackageQa({
      applicationPackageId: "package-1",
    });
    expect(result.qa.pass).toBe(true);
    expect(result.qa.blockingIssues).toEqual([]);
  });

  it("approves only after the truth/staleness/live gate passes", async () => {
    const result = await approveApplicationPackage({
      applicationPackageId: "package-1",
    });

    expect(result.qa.pass).toBe(true);
    expect(mocks.updateApplicationPackage).toHaveBeenCalledWith("package-1", {
      status: "approved",
      staleReason: null,
    });
    expect(result.applicationPackage.status).toBe("approved");
  });

  it("marks a changed package stale instead of approving it", async () => {
    mocks.getActiveMasterCareerProfile.mockResolvedValue({
      ...profile,
      id: "profile-v2",
      version: 2,
    });

    await expect(
      approveApplicationPackage({ applicationPackageId: "package-1" }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    expect(mocks.updateApplicationPackage).toHaveBeenCalledWith("package-1", {
      status: "stale",
      staleReason: "profile_changed",
    });
    expect(mocks.updateApplicationPackage).not.toHaveBeenCalledWith(
      "package-1",
      expect.objectContaining({ status: "approved" }),
    );
  });

  it("blocks a closed vacancy and allows unknown only with explicit acknowledgement", async () => {
    mocks.getCandidateMarketPostingLiveContext.mockResolvedValue({
      posting,
      observations: [liveObservation(false)],
    });

    await expect(
      approveApplicationPackage({ applicationPackageId: "package-1" }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    mocks.getCandidateMarketPostingLiveContext.mockResolvedValue({
      posting,
      observations: [],
    });

    await expect(
      approveApplicationPackage({ applicationPackageId: "package-1" }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });

    await expect(
      approveApplicationPackage({
        applicationPackageId: "package-1",
        acknowledgeUnknownLiveState: true,
      }),
    ).resolves.toMatchObject({
      applicationPackage: { status: "approved" },
      qa: { pass: true },
    });
  });
});
