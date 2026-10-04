import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./pipeline-run-dispatcher", () => ({
  dispatchReadyCandidateRunRequests: vi.fn(async () => []),
}));

import {
  isPipelineRunDispatcherRunning,
  startPipelineRunDispatcher,
  stopPipelineRunDispatcher,
} from "./pipeline-run-dispatcher-runtime";

afterEach(() => {
  stopPipelineRunDispatcher();
  delete process.env.CAREER_OS_PIPELINE_DISPATCH_INTERVAL_MS;
});

describe("pipeline dispatcher runtime config", () => {
  it("uses the configured interval but never below the safety minimum", () => {
    vi.useFakeTimers();
    process.env.CAREER_OS_PIPELINE_DISPATCH_INTERVAL_MS = "1";
    startPipelineRunDispatcher();
    expect(isPipelineRunDispatcherRunning()).toBe(true);
    vi.advanceTimersByTime(9_999);
    expect(vi.getTimerCount()).toBe(1);
    vi.useRealTimers();
  });
});
