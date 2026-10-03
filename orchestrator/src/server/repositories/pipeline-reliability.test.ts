import { describe, expect, it } from "vitest";
import { derivePipelineCoverageSummary } from "./pipeline-reliability";

describe("derivePipelineCoverageSummary", () => {
  it.each([
    [[], "failed"],
    [["complete"], "complete"],
    [["complete", "complete_with_fallback"], "complete_with_fallback"],
    [["complete", "degraded"], "degraded"],
    [["complete", "pending"], "degraded"],
    [["complete", "running"], "degraded"],
    [["complete", "retry"], "degraded"],
    [["complete", "failed"], "failed"],
  ] as const)("derives %j as %s", (statuses, expectedStatus) => {
    expect(derivePipelineCoverageSummary([...statuses]).status).toBe(
      expectedStatus,
    );
  });
});
