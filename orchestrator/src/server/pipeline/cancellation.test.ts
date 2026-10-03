import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const stepState = vi.hoisted(() => {
  let resolveDiscover:
    | ((value: {
        discoveredJobs: [];
        sourceErrors: [];
        pendingChallenges: [];
      }) => void)
    | null = null;
  return {
    setResolver: (
      fn: (value: {
        discoveredJobs: [];
        sourceErrors: [];
        pendingChallenges: [];
      }) => void,
    ) => {
      resolveDiscover = fn;
    },
    resolveDiscover: () =>
      resolveDiscover?.({
        discoveredJobs: [],
        sourceErrors: [],
        pendingChallenges: [],
      }),
  };
});

vi.mock("../repositories/pipeline-run-leases", () => ({
  acquirePipelineRunLease: vi.fn(
    async ({ pipelineRunId }: { pipelineRunId: string }) => ({
      acquired: true,
      lease: {
        id: "lease-test",
        pipelineRunId,
        acquiredAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      },
    }),
  ),
  heartbeatPipelineRunLease: vi.fn(
    async ({ pipelineRunId }: { pipelineRunId: string }) => ({
      id: "lease-test",
      pipelineRunId,
      acquiredAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 120_000).toISOString(),
    }),
  ),
  releasePipelineRunLease: vi.fn(async () => undefined),
}));

vi.mock("../repositories/pipeline", () => ({
  createPipelineRun: vi.fn(async () => ({
    id: "run-cancel-1",
    startedAt: new Date().toISOString(),
    completedAt: null,
    status: "running",
    jobsDiscovered: 0,
    jobsProcessed: 0,
    errorMessage: null,
  })),
  updatePipelineRun: vi.fn(async () => undefined),
}));

vi.mock("./steps", () => ({
  loadProfileStep: vi.fn(async () => ({})),
  discoverJobsStep: vi.fn(
    () =>
      new Promise<{
        discoveredJobs: [];
        sourceErrors: [];
        pendingChallenges: [];
      }>((resolve) => {
        stepState.setResolver(resolve);
      }),
  ),
  importJobsStep: vi.fn(async () => ({
    created: 0,
    skipped: 0,
    fuzzyMerged: 0,
  })),
  scoreJobsStep: vi.fn(async () => ({ unprocessedJobs: [], scoredJobs: [] })),
  selectJobsStep: vi.fn(() => []),
  processJobsStep: vi.fn(async () => ({ processedCount: 0 })),
  notifyPipelineWebhookStep: vi.fn(async () => undefined),
}));

describe.sequential("pipeline cancellation", () => {
  let tempDir: string;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-pipeline-cancel-"));
    process.env.DATA_DIR = tempDir;
    process.env.NODE_ENV = "test";

    await import("../db/migrate");
  });

  afterEach(async () => {
    const { closeDb } = await import("../db/index");
    closeDb();
    await rm(tempDir, { recursive: true, force: true });
  });

  it("refuses a second cross-process run when the candidate lease is held", async () => {
    const leases = await import("../repositories/pipeline-run-leases");
    const pipelineRepo = await import("../repositories/pipeline");
    const pipeline = await import("./orchestrator");

    vi.mocked(leases.acquirePipelineRunLease).mockResolvedValueOnce({
      acquired: false,
      lease: {
        id: "lease-existing",
        pipelineRunId: "run-existing",
        acquiredAt: new Date().toISOString(),
        heartbeatAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      },
    });

    const result = await pipeline.runPipeline({ sources: [] });

    expect(result.success).toBe(false);
    expect(result.error).toContain("already running");
    expect(vi.mocked(pipelineRepo.updatePipelineRun)).toHaveBeenCalledWith(
      "run-cancel-1",
      expect.objectContaining({ status: "cancelled" }),
    );
    expect(pipeline.getPipelineStatus().isRunning).toBe(false);
  });

  it("marks run as cancelled at checkpoint and resets running state", async () => {
    const pipeline = await import("./orchestrator");
    const pipelineRepo = await import("../repositories/pipeline");
    const steps = await import("./steps");

    const runPromise = pipeline.runPipeline({ sources: [] });

    await Promise.resolve();

    const cancelRequest = pipeline.requestPipelineCancel();
    expect(cancelRequest.accepted).toBe(true);
    expect([null, "run-cancel-1"]).toContain(cancelRequest.pipelineRunId);
    expect(pipeline.isPipelineCancelRequested()).toBe(true);

    const duplicateRequest = pipeline.requestPipelineCancel();
    expect(duplicateRequest.accepted).toBe(true);
    expect(duplicateRequest.alreadyRequested).toBe(true);

    stepState.resolveDiscover();
    const result = await runPromise;

    expect(result.success).toBe(false);
    expect(result.error).toContain("Cancelled");
    expect(vi.mocked(steps.importJobsStep)).not.toHaveBeenCalled();
    expect(vi.mocked(pipelineRepo.updatePipelineRun)).toHaveBeenCalledWith(
      "run-cancel-1",
      expect.objectContaining({
        status: "cancelled",
      }),
    );
    expect(pipeline.getPipelineStatus().isRunning).toBe(false);
    expect(pipeline.isPipelineCancelRequested()).toBe(false);
  });
});
