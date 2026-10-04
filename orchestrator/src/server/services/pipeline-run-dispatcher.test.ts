import { getRequestContext } from "@infra/request-context";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@server/repositories/pipeline-run-requests", () => ({
  listReadyPipelineRunRequestOwners: vi.fn(),
}));

vi.mock("./pipeline-run-queue", () => ({
  drainOneCandidatePipelineRunRequest: vi.fn(),
}));

import { listReadyPipelineRunRequestOwners } from "@server/repositories/pipeline-run-requests";
import { dispatchReadyCandidateRunRequests } from "./pipeline-run-dispatcher";
import { drainOneCandidatePipelineRunRequest } from "./pipeline-run-queue";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("pipeline run dispatcher", () => {
  it("drains at most one request per candidate under explicit owner context", async () => {
    vi.mocked(listReadyPipelineRunRequestOwners).mockResolvedValueOnce([
      { tenantId: "tenant-a", userId: "user-a" },
      { tenantId: "tenant-a", userId: "user-b" },
    ]);
    vi.mocked(drainOneCandidatePipelineRunRequest).mockImplementation(
      async () => {
        const context = getRequestContext();
        return {
          status: "completed" as const,
          request: {
            id: `${context?.tenantId}:${context?.userId}`,
            status: "completed" as const,
            trigger: "daily",
            requestedConfig: {},
            priority: 0,
            availableAt: "2026-10-03T20:00:00.000Z",
            claimedAt: "2026-10-03T20:00:01.000Z",
            pipelineRunId: null,
            completedAt: "2026-10-03T20:01:00.000Z",
            errorMessage: null,
            createdAt: "2026-10-03T20:00:00.000Z",
            updatedAt: "2026-10-03T20:01:00.000Z",
          },
        };
      },
    );

    const results = await dispatchReadyCandidateRunRequests(5);

    expect(results.map((item) => item.result.request?.id)).toEqual([
      "tenant-a:user-a",
      "tenant-a:user-b",
    ]);
    expect(drainOneCandidatePipelineRunRequest).toHaveBeenCalledTimes(2);
  });

  it("caps one dispatcher pass at five candidate owners", async () => {
    vi.mocked(listReadyPipelineRunRequestOwners).mockResolvedValueOnce([]);
    await dispatchReadyCandidateRunRequests(50);
    expect(listReadyPipelineRunRequestOwners).toHaveBeenCalledWith(5);
  });
});
