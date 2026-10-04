import type {
  CandidateEvaluation,
  CandidateStrategyProfile,
  CreateJobInput,
  Job,
  MarketPostingVersion,
  MasterCareerProfileVersion,
} from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveMasterCareerProfile: vi.fn(),
  getActiveCandidateStrategy: vi.fn(),
  getDiscoveredJobsForPipelineRun: vi.fn(),
  getCandidateMarketPostingIdForLegacyJob: vi.fn(),
  getLatestMarketPostingVersionId: vi.fn(),
  getMarketPostingVersion: vi.fn(),
  ensureCandidateEvaluation: vi.fn(),
  updateCandidateEvaluation: vi.fn(),
}));

vi.mock("@server/repositories/candidate-profile", () => ({
  getActiveMasterCareerProfile: mocks.getActiveMasterCareerProfile,
}));
vi.mock("@server/repositories/candidate-strategy", () => ({
  getActiveCandidateStrategy: mocks.getActiveCandidateStrategy,
}));
vi.mock("@server/repositories/jobs", () => ({
  getDiscoveredJobsForPipelineRun: mocks.getDiscoveredJobsForPipelineRun,
}));
vi.mock("@server/repositories/market-inventory", () => ({
  getCandidateMarketPostingIdForLegacyJob:
    mocks.getCandidateMarketPostingIdForLegacyJob,
  getLatestMarketPostingVersionId: mocks.getLatestMarketPostingVersionId,
  getMarketPostingVersion: mocks.getMarketPostingVersion,
}));
vi.mock("@server/repositories/candidate-evaluations", () => ({
  ensureCandidateEvaluation: mocks.ensureCandidateEvaluation,
  updateCandidateEvaluation: mocks.updateCandidateEvaluation,
}));

import { marketPostingInputFromJob } from "@server/market-inventory/from-job";
import { buildMarketPostingContentFingerprint } from "@server/market-inventory/identity";
import {
  buildScoringPolicyVersion,
  prepareVersionedScoringBatch,
} from "./versioned-delta-scoring";

const jobInput: CreateJobInput = {
  source: "linkedin",
  sourceJobId: "src-1",
  title: "Field Service Engineer",
  employer: "Example",
  jobUrl: "https://example.com/jobs/1",
  applicationLink: "https://example.com/jobs/1",
  location: "Toronto, ON",
  jobDescription: "PLC knowledge is required.",
};

const job = {
  id: "job-1",
  ...jobInput,
  datePosted: null,
  deadline: null,
  salary: null,
  salaryMinAmount: null,
  salaryMaxAmount: null,
  salaryCurrency: null,
  status: "discovered",
  suitabilityScore: 82,
  suitabilityReason: "legacy verified score",
} as unknown as Job;

const profile = {
  id: "profile-v1",
  version: 1,
  status: "active",
  profile: { basics: { name: "Candidate" } },
  source: "manual",
  sourceRef: null,
  provenance: null,
  createdAt: "2026-10-04T10:00:00.000Z",
  activatedAt: "2026-10-04T10:01:00.000Z",
  supersededAt: null,
} satisfies MasterCareerProfileVersion;

const strategy = {
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
} satisfies CandidateStrategyProfile;

function postingVersion(
  description = job.jobDescription,
): MarketPostingVersion {
  const snapshot = {
    ...marketPostingInputFromJob(jobInput),
    description,
  };
  return {
    id: "posting-v1",
    marketPostingId: "posting-1",
    version: 1,
    contentFingerprint: buildMarketPostingContentFingerprint(snapshot),
    snapshot,
    createdAt: "2026-10-04T12:00:00.000Z",
  };
}

function evaluation(
  status: CandidateEvaluation["status"] = "pending",
): CandidateEvaluation {
  return {
    id: "eval-1",
    marketPostingId: "posting-1",
    marketPostingVersionId: "posting-v1",
    profileVersionId: profile.id,
    strategyVersionId: strategy.id,
    scoringPolicyVersion: buildScoringPolicyVersion(),
    prefilterDisposition: "not_evaluated",
    prefilterRuleVersion: null,
    prefilterReason: null,
    hardGateOutcome: "unknown",
    status,
    suitabilityScore: status === "scored" ? 82 : null,
    suitabilityReason: status === "scored" ? "legacy verified score" : null,
    factualFit: null,
    careerValue: null,
    compensationAssessment: null,
    workAuthorizationAssessment: null,
    locationTravelAssessment: null,
    uncertainties: [],
    createdAt: "2026-10-04T12:00:00.000Z",
    updatedAt: "2026-10-04T12:00:00.000Z",
  };
}

describe("F3-7 versioned delta scoring preparation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getActiveMasterCareerProfile.mockResolvedValue(profile);
    mocks.getActiveCandidateStrategy.mockResolvedValue(strategy);
    mocks.getDiscoveredJobsForPipelineRun.mockResolvedValue([job]);
    mocks.getCandidateMarketPostingIdForLegacyJob.mockResolvedValue(
      "posting-1",
    );
    mocks.getLatestMarketPostingVersionId.mockResolvedValue("posting-v1");
    mocks.getMarketPostingVersion.mockResolvedValue(postingVersion());
    mocks.ensureCandidateEvaluation.mockResolvedValue({
      evaluation: evaluation("pending"),
      created: true,
    });
    mocks.updateCandidateEvaluation.mockResolvedValue(evaluation("scored"));
  });

  it("bootstraps an identical version from a legacy score without AI work", async () => {
    const batch = await prepareVersionedScoringBatch({
      pipelineRunId: "run-1",
    });

    expect(batch).toMatchObject({
      seededFromLegacy: 1,
      reusedCompleted: 0,
      targets: [],
    });
    expect(mocks.updateCandidateEvaluation).toHaveBeenCalledWith(
      "eval-1",
      expect.objectContaining({
        status: "scored",
        suitabilityScore: 82,
        suitabilityReason: "legacy verified score",
      }),
    );
  });

  it("schedules only a materially changed posting and feeds the new content", async () => {
    mocks.getMarketPostingVersion.mockResolvedValue(
      postingVersion("PLC and commissioning experience are required."),
    );

    const batch = await prepareVersionedScoringBatch({
      pipelineRunId: "run-1",
    });

    expect(batch?.seededFromLegacy).toBe(0);
    expect(batch?.targets).toHaveLength(1);
    expect(batch?.targets[0]?.job.jobDescription).toBe(
      "PLC and commissioning experience are required.",
    );
    expect(batch?.targets[0]?.job.suitabilityScore).toBeNull();
    expect(batch?.targets[0]?.job.suitabilityReason).toBeNull();
    expect(mocks.updateCandidateEvaluation).not.toHaveBeenCalled();
  });

  it("reuses an already scored immutable tuple", async () => {
    mocks.ensureCandidateEvaluation.mockResolvedValue({
      evaluation: evaluation("scored"),
      created: false,
    });

    const batch = await prepareVersionedScoringBatch({
      pipelineRunId: "run-1",
    });

    expect(batch).toMatchObject({
      seededFromLegacy: 0,
      reusedCompleted: 1,
      targets: [],
    });
  });

  it("changes the scoring policy version when instructions change", () => {
    expect(buildScoringPolicyVersion("policy A")).not.toBe(
      buildScoringPolicyVersion("policy B"),
    );
    expect(buildScoringPolicyVersion(" policy A ")).toBe(
      buildScoringPolicyVersion("policy A"),
    );
  });
});
