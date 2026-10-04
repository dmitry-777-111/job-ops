import { createJob } from "@shared/testing/factories";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  writeFile: vi.fn(),
  rename: vi.fn(),
  getPipelineRunById: vi.fn(),
  updatePipelineRun: vi.fn(),
  listPipelineRunItems: vi.fn(),
  getDiscoveredJobsForPipelineRun: vi.fn(),
  getUnscoredDiscoveredJobs: vi.fn(),
  getScoredDiscoveredJobs: vi.fn(),
  getJobById: vi.fn(),
  getAllSettings: vi.fn(),
  loadProfileStep: vi.fn(),
  scoreJobsStep: vi.fn(),
  selectJobsStep: vi.fn(),
  processJobsStep: vi.fn(),
  activateDynamicEmployersFromJobs: vi.fn(),
}));

vi.mock("node:fs", () => ({
  promises: {
    readFile: mocks.readFile,
    writeFile: mocks.writeFile,
    rename: mocks.rename,
  },
}));
vi.mock("@server/config/dataDir", () => ({ getDataDir: () => "/tmp" }));
vi.mock("@infra/logger", () => ({
  logger: {
    child: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
  },
}));
vi.mock("@server/repositories/jobs", () => ({
  getDiscoveredJobsForPipelineRun: mocks.getDiscoveredJobsForPipelineRun,
  getUnscoredDiscoveredJobs: mocks.getUnscoredDiscoveredJobs,
  getScoredDiscoveredJobs: mocks.getScoredDiscoveredJobs,
  getJobById: mocks.getJobById,
}));
vi.mock("@server/repositories/pipeline", () => ({
  getPipelineRunById: mocks.getPipelineRunById,
  updatePipelineRun: mocks.updatePipelineRun,
}));
vi.mock("@server/repositories/pipeline-run-items", () => ({
  listPipelineRunItems: mocks.listPipelineRunItems,
}));
vi.mock("@server/repositories/settings", () => ({
  getAllSettings: mocks.getAllSettings,
}));
vi.mock("@server/services/dynamic-employers", () => ({
  activateDynamicEmployersFromJobs: mocks.activateDynamicEmployersFromJobs,
}));
vi.mock("./orchestrator", () => ({ processJob: vi.fn() }));
vi.mock("./steps", () => ({
  loadProfileStep: mocks.loadProfileStep,
  scoreJobsStep: mocks.scoreJobsStep,
  selectJobsStep: mocks.selectJobsStep,
  processJobsStep: mocks.processJobsStep,
}));

import { recoverInterruptedPipelineRun } from "./recover-interrupted";

beforeEach(() => {
  vi.clearAllMocks();
});

type TerminalProjection = {
  runStatus: string;
  jobsProcessed: number;
  jobs: Array<{ id: string; score: number | null; status: string }>;
};

async function runControlledScenario(
  interruptedAfterFirstScore: boolean,
): Promise<TerminalProjection> {
  const jobs = [
    createJob({
      id: "job-1",
      status: "discovered",
      suitabilityScore: interruptedAfterFirstScore ? 91 : null,
    }),
    createJob({ id: "job-2", status: "discovered", suitabilityScore: null }),
  ];
  const runState = { status: "running", jobsProcessed: 0 };

  mocks.getPipelineRunById.mockResolvedValue({
    id: "run-equivalence",
    status: "running",
    jobsDiscovered: 2,
    configSnapshot: {
      topN: 2,
      minSuitabilityScore: 0,
      sources: ["indeed"],
      locationIntent: null,
    },
  });
  mocks.listPipelineRunItems.mockResolvedValue([
    { pipelineRunId: "run-equivalence", jobId: "job-1" },
    { pipelineRunId: "run-equivalence", jobId: "job-2" },
  ]);
  mocks.getDiscoveredJobsForPipelineRun.mockImplementation(async () => jobs);
  mocks.getUnscoredDiscoveredJobs.mockImplementation(async () =>
    jobs.filter((job) => typeof job.suitabilityScore !== "number"),
  );
  mocks.getScoredDiscoveredJobs.mockImplementation(async () =>
    jobs.filter((job) => typeof job.suitabilityScore === "number"),
  );
  mocks.getJobById.mockImplementation(async (id: string) =>
    jobs.find((job) => job.id === id),
  );
  mocks.getAllSettings.mockResolvedValue({ scoringInstructions: "" });
  mocks.loadProfileStep.mockResolvedValue({});
  mocks.scoreJobsStep.mockImplementation(async () => {
    for (const job of jobs) {
      if (typeof job.suitabilityScore !== "number") {
        job.suitabilityScore = job.id === "job-1" ? 91 : 82;
      }
    }
    return { scoredJobs: jobs };
  });
  mocks.selectJobsStep.mockImplementation(async () => jobs);
  mocks.processJobsStep.mockImplementation(
    async ({ jobsToProcess }: { jobsToProcess: typeof jobs }) => {
      for (const job of jobsToProcess) job.status = "ready";
      return { processedCount: jobsToProcess.length };
    },
  );
  mocks.activateDynamicEmployersFromJobs.mockResolvedValue(undefined);
  mocks.updatePipelineRun.mockImplementation(
    async (_id: string, patch: Record<string, unknown>) => {
      if (typeof patch.status === "string") runState.status = patch.status;
      if (typeof patch.jobsProcessed === "number")
        runState.jobsProcessed = patch.jobsProcessed;
    },
  );

  if (interruptedAfterFirstScore) {
    mocks.readFile.mockResolvedValue(
      JSON.stringify({ selectedJobIds: ["job-1", "job-2"] }),
    );
  } else {
    const missing = Object.assign(new Error("missing"), { code: "ENOENT" });
    mocks.readFile.mockRejectedValue(missing);
  }
  mocks.writeFile.mockResolvedValue(undefined);
  mocks.rename.mockResolvedValue(undefined);

  const result = await recoverInterruptedPipelineRun("run-equivalence");
  expect(result.success).toBe(true);

  return {
    runStatus: runState.status,
    jobsProcessed: runState.jobsProcessed,
    jobs: jobs.map((job) => ({
      id: job.id,
      score: job.suitabilityScore,
      status: job.status,
    })),
  };
}

describe("interrupted pipeline equivalence", () => {
  it("reaches the same terminal state as the uninterrupted controlled run", async () => {
    const uninterrupted = await runControlledScenario(false);
    vi.clearAllMocks();
    const interrupted = await runControlledScenario(true);

    expect(interrupted).toEqual(uninterrupted);
    expect(interrupted).toEqual({
      runStatus: "completed",
      jobsProcessed: 2,
      jobs: [
        { id: "job-1", score: 91, status: "ready" },
        { id: "job-2", score: 82, status: "ready" },
      ],
    });
  });
});
