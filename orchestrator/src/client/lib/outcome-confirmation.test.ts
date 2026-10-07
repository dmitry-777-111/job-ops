import type { JobListItem, StageEvent } from "@shared/types.js";
import { describe, expect, it } from "vitest";
import { getPendingOutcomeConfirmation } from "./outcome-confirmation";

const DAY = 24 * 60 * 60;

function job(outcome: JobListItem["outcome"] = null): JobListItem {
  return {
    id: "job-1",
    source: "test",
    sourceJobId: null,
    title: "Role",
    employer: "Employer",
    jobUrl: "https://example.com/job",
    applicationLink: null,
    datePosted: null,
    deadline: null,
    salary: null,
    location: null,
    status: "in_progress",
    outcome,
    closedAt: null,
    suitabilityScore: 85,
    sponsorMatchScore: null,
    appliedDuplicateMatch: null,
    jobType: null,
    jobFunction: null,
    pdfRegenerating: false,
    pdfFreshness: "missing",
    salaryMinAmount: null,
    salaryMaxAmount: null,
    salaryCurrency: null,
    discoveredAt: "2026-10-01T00:00:00.000Z",
    readyAt: null,
    appliedAt: "2026-10-02T00:00:00.000Z",
    updatedAt: "2026-10-02T00:00:00.000Z",
  };
}

function event(
  id: string,
  stage: StageEvent["toStage"],
  occurredAt: number,
  extra?: Partial<StageEvent>,
): StageEvent {
  return {
    id,
    applicationId: "job-1",
    title: stage,
    groupId: null,
    fromStage: "applied",
    toStage: stage,
    occurredAt,
    metadata: null,
    outcome: null,
    ...extra,
  };
}

describe("getPendingOutcomeConfirmation", () => {
  it("does not prompt when an outcome or later stage is already known", () => {
    const interview = event("i1", "technical_interview", 100);
    expect(
      getPendingOutcomeConfirmation(
        job("rejected"),
        [interview],
        100 + 20 * DAY,
      ),
    ).toBeNull();
    expect(
      getPendingOutcomeConfirmation(
        job(),
        [interview, event("i2", "onsite", 200)],
        200 + 4 * DAY,
      ),
    ).toBeNull();
  });

  it("does not prompt before the stage-aware timeout", () => {
    const interview = event("i1", "technical_interview", 100);
    expect(
      getPendingOutcomeConfirmation(job(), [interview], 100 + 4 * DAY),
    ).toBeNull();
  });

  it("prompts after timeout and identifies the expected next stage", () => {
    const interview = event("i1", "technical_interview", 100);
    expect(
      getPendingOutcomeConfirmation(job(), [interview], 100 + 5 * DAY),
    ).toMatchObject({ nextStage: "onsite", interviewEvent: interview });
  });

  it("delays the next prompt after the user confirms they are still waiting", () => {
    const interview = event("i1", "technical_interview", 100);
    const waiting = event("w1", "technical_interview", 100 + 5 * DAY, {
      metadata: { actor: "user", eventType: "note", outcomeCheck: "waiting" },
    });
    expect(
      getPendingOutcomeConfirmation(job(), [interview, waiting], 100 + 9 * DAY),
    ).toBeNull();
    expect(
      getPendingOutcomeConfirmation(
        job(),
        [interview, waiting],
        100 + 10 * DAY,
      ),
    ).toMatchObject({ lastCheckedAt: waiting.occurredAt });
  });
});
