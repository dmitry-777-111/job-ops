import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./pipeline-run-dispatcher", () => ({
  dispatchReadyCandidateRunRequests: vi.fn(),
}));

import { dispatchReadyCandidateRunRequests } from "./pipeline-run-dispatcher";
import {
  isPipelineRunDispatcherRunning,
  runPipelineDispatcherTick,
  startPipelineRunDispatcher,
  stopPipelineRunDispatcher,
} from "./pipeline-run-dispatcher-runtime";

beforeEach(() => {
  vi.clearAllMocks();
  stopPipelineRunDispatcher();
});

afterEach(() => {
  stopPipelineRunDispatcher();
  vi.useRealTimers();
});

describe("pipeline dispatcher runtime", () => {
  it("does not overlap a second tick while the first is still running", async () => {
    let release: (() => void) | null = null;
    vi.mocked(dispatchReadyCandidateRunRequests).mockImplementationOnce(
      async () =>
        await new Promise((resolve) => {
          release = () => resolve([]);
        }),
    );

    const first = runPipelineDispatcherTick();
    const second = await runPipelineDispatcherTick();
    expect(second).toEqual({ skipped: true, dispatched: 0 });

    release?.();
    await expect(first).resolves.toEqual({ skipped: false, dispatched: 0 });
    expect(dispatchReadyCandidateRunRequests).toHaveBeenCalledTimes(1);
  });

  it("starts idempotently with one interval owner", () => {
    vi.useFakeTimers();
    vi.mocked(dispatchReadyCandidateRunRequests).mockResolvedValue([]);

    startPipelineRunDispatcher({ intervalMs: 10_000 });
    startPipelineRunDispatcher({ intervalMs: 10_000 });

    expect(isPipelineRunDispatcherRunning()).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(dispatchReadyCandidateRunRequests).toHaveBeenCalledTimes(1);
  });

  it("can stop cleanly", () => {
    vi.useFakeTimers();
    startPipelineRunDispatcher({ intervalMs: 10_000 });
    expect(isPipelineRunDispatcherRunning()).toBe(true);
    stopPipelineRunDispatcher();
    expect(isPipelineRunDispatcherRunning()).toBe(false);
  });
});
