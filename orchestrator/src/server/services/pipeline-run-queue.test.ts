import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@server/pipeline", () => ({
  runPipeline: vi.fn(),
}));

vi.mock("@server/repositories/pipeline-run-requests", () => ({
  getOutstandingPipelineRunRequest: vi.fn(),
  claimPipelineRunRequest: vi.fn(),
  finishPipelineRunRequest: vi.fn(),
}));

vi.mock("@infra/logger", () => ({
  logger: { error: vi.fn() },
}));

import { runPipeline } from "@server/pipeline";
import {
  claimPipelineRunRequest,
  finishPipelineRunRequest,
  getOutstandingPipelineRunRequest,
} from "@server/repositories/pipeline-run-requests";
import { drainOneCandidatePipelineRunRequest } from "./pipeline-run-queue";

const queued = {
  id: "request-1",
  status: "queued" as const,
  trigger: "daily",
  requestedConfig: { topN: 10 },
  priority: 0,
  availableAt: "2026-10-03T20:00:00.000Z",
  claimedAt: null,
  pipelineRunId: null,
  completedAt: null,
  errorMessage: null,
  createdAt: "2026-10-03T20:00:00.000Z",
  updatedAt: "2026-10-03T20:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("candidate pipeline request queue", () => {
  it("does nothing when the active candidate has no outstanding request", async () => {
    vi.mocked(getOutstandingPipelineRunRequest).mockResolvedValueOnce(null);
    await expect(drainOneCandidatePipelineRunRequest()).resolves.toEqual({
      status: "idle",
      request: null,
    });
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it("does not execute an already claimed request twice", async () => {
    const claimed = { ...queued, status: "claimed" as const };
    vi.mocked(getOutstandingPipelineRunRequest).mockResolvedValueOnce(claimed);
    await expect(drainOneCandidatePipelineRunRequest()).resolves.toEqual({
      status: "deferred",
      request: claimed,
    });
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it("claims and completes exactly one queued request", async () => {
    const claimed = {
      ...queued,
      status: "claimed" as const,
      claimedAt: "2026-10-03T20:01:00.000Z",
    };
    const completed = {
      ...claimed,
      status: "completed" as const,
      completedAt: "2026-10-03T20:02:00.000Z",
    };
    vi.mocked(getOutstandingPipelineRunRequest).mockResolvedValueOnce(queued);
    vi.mocked(claimPipelineRunRequest).mockResolvedValueOnce(claimed);
    vi.mocked(runPipeline).mockResolvedValueOnce({
      success: true,
      jobsDiscovered: 2,
      jobsProcessed: 1,
    });
    vi.mocked(finishPipelineRunRequest).mockResolvedValueOnce(completed);

    await expect(drainOneCandidatePipelineRunRequest()).resolves.toEqual({
      status: "completed",
      request: completed,
    });
    expect(runPipeline).toHaveBeenCalledTimes(1);
    expect(runPipeline).toHaveBeenCalledWith({ topN: 10 });
    expect(finishPipelineRunRequest).toHaveBeenCalledWith({
      requestId: "request-1",
      status: "completed",
      errorMessage: null,
    });
  });

  it("marks the request failed when the pipeline throws", async () => {
    const claimed = { ...queued, status: "claimed" as const };
    const failed = {
      ...claimed,
      status: "failed" as const,
      errorMessage: "boom",
      completedAt: "2026-10-03T20:02:00.000Z",
    };
    vi.mocked(getOutstandingPipelineRunRequest).mockResolvedValueOnce(queued);
    vi.mocked(claimPipelineRunRequest).mockResolvedValueOnce(claimed);
    vi.mocked(runPipeline).mockRejectedValueOnce(new Error("boom"));
    vi.mocked(finishPipelineRunRequest).mockResolvedValueOnce(failed);

    await expect(drainOneCandidatePipelineRunRequest()).resolves.toEqual({
      status: "failed",
      request: failed,
    });
    expect(finishPipelineRunRequest).toHaveBeenCalledWith({
      requestId: "request-1",
      status: "failed",
      errorMessage: "boom",
    });
  });
});
