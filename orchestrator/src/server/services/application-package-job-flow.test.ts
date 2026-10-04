import type {
  ApplicationPackage,
  MarketPosting,
  MarketPostingObservation,
} from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCandidateMarketPostingIdForLegacyJob: vi.fn(),
  getCandidateMarketPostingLiveContext: vi.fn(),
  listApplicationPackagesForPosting: vi.fn(),
  prepareApplicationPackageDraft: vi.fn(),
}));

vi.mock("@server/repositories/market-inventory", () => ({
  getCandidateMarketPostingIdForLegacyJob:
    mocks.getCandidateMarketPostingIdForLegacyJob,
  getCandidateMarketPostingLiveContext:
    mocks.getCandidateMarketPostingLiveContext,
}));
vi.mock("@server/repositories/application-packages", () => ({
  listApplicationPackagesForPosting: mocks.listApplicationPackagesForPosting,
}));
vi.mock("./application-package-draft", () => ({
  prepareApplicationPackageDraft: mocks.prepareApplicationPackageDraft,
}));

import {
  getApplicationPackageJobFlow,
  prepareApplicationPackageForJob,
} from "./application-package-job-flow";

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

const applicationPackage = {
  id: "package-1",
  version: 1,
  status: "draft",
  marketPostingId: posting.id,
  marketPostingVersionId: "posting-v1",
  profileVersionId: "profile-v1",
  strategyVersionId: "strategy-v1",
  generationPolicyVersion: "freeze3-mvp-v1",
  evidenceMap: [],
  gaps: [],
  targetedCvJson: {},
  coverLetter: "letter",
  formAnswers: {},
  approvedAt: null,
  exportedAt: null,
  staleReason: null,
  createdAt: "2026-10-04T12:00:00.000Z",
  updatedAt: "2026-10-04T12:00:00.000Z",
} satisfies ApplicationPackage;

describe("F3-6E job-facing application package flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCandidateMarketPostingIdForLegacyJob.mockResolvedValue(posting.id);
    mocks.getCandidateMarketPostingLiveContext.mockResolvedValue({
      posting,
      observations: [observation],
    });
    mocks.listApplicationPackagesForPosting.mockResolvedValue([
      applicationPackage,
    ]);
    mocks.prepareApplicationPackageDraft.mockResolvedValue({
      applicationPackage,
      preparation: {},
    });
  });

  it("returns the live state and existing packages for a legacy job", async () => {
    const result = await getApplicationPackageJobFlow({
      legacyJobId: "job-1",
    });

    expect(result).toMatchObject({
      legacyJobId: "job-1",
      marketPostingId: posting.id,
      liveGate: { state: "live" },
    });
    expect(result.applicationPackages).toEqual([applicationPackage]);
  });

  it("prepares a package through the job-facing facade", async () => {
    await prepareApplicationPackageForJob({
      legacyJobId: "job-1",
      acknowledgeUnknownLiveState: true,
    });

    expect(mocks.prepareApplicationPackageDraft).toHaveBeenCalledWith({
      marketPostingId: posting.id,
      acknowledgeUnknownLiveState: true,
    });
  });

  it("does not expose a job without a candidate-scoped market mapping", async () => {
    mocks.getCandidateMarketPostingIdForLegacyJob.mockResolvedValue(null);

    await expect(
      getApplicationPackageJobFlow({ legacyJobId: "foreign-job" }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
    await expect(
      prepareApplicationPackageForJob({ legacyJobId: "foreign-job" }),
    ).rejects.toMatchObject({ status: 404, code: "NOT_FOUND" });
  });
});
