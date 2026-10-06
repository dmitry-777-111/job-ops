import type { JobListItem, StageEvent } from "@shared/types.js";
import { describe, expect, it } from "vitest";
import { buildCareerLearningInsights } from "./career-learning";

function job(id: string, score = 80): JobListItem {
  return {
    id,
    source: "test",
    sourceJobId: null,
    title: "Role " + id,
    employer: "Employer",
    jobUrl: "https://example.com/" + id,
    applicationLink: null,
    datePosted: null,
    deadline: null,
    salary: null,
    location: null,
    status: "applied",
    outcome: null,
    closedAt: null,
    suitabilityScore: score,
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
  debrief?: string,
): StageEvent {
  return {
    id,
    applicationId: id.split("-")[0] ?? id,
    title: stage,
    groupId: null,
    fromStage: "applied",
    toStage: stage,
    occurredAt: 1_700_000_000,
    metadata: debrief ? { interviewDebrief: debrief } : null,
    outcome: null,
  };
}

describe("buildCareerLearningInsights", () => {
  it("does not overreact to a small sample", () => {
    const input = Array.from({ length: 4 }, (_, i) => ({
      job: job("j" + i),
      events: [],
    }));
    expect(buildCareerLearningInsights(input)).toEqual([]);
  });

  it("flags weak market-entry conversion only after enough qualified applications", () => {
    const input = Array.from({ length: 10 }, (_, i) => ({
      job: job("j" + i),
      events: i === 0 ? [event("j0-e1", "recruiter_screen")] : [],
    }));
    const insights = buildCareerLearningInsights(input);
    expect(insights[0]).toMatchObject({
      stage: "market_entry",
      confidence: "moderate",
    });
  });

  it("separates screening friction from interview friction", () => {
    const input = Array.from({ length: 6 }, (_, i) => ({
      job: job("j" + i),
      events:
        i < 5
          ? [
              event("j" + i + "-s", "recruiter_screen"),
              ...(i === 0
                ? [event("j0-i", "technical_interview", "PLC question")]
                : []),
            ]
          : [],
    }));
    const insights = buildCareerLearningInsights(input);
    expect(insights.some((item) => item.stage === "screening")).toBe(true);
    expect(insights.some((item) => item.stage === "interview")).toBe(false);
  });

  it("uses interview debrief evidence before suggesting interview review", () => {
    const input = Array.from({ length: 3 }, (_, i) => ({
      job: job("j" + i),
      events: [
        event(
          "j" + i + "-i",
          "technical_interview",
          "Repeated PLC and travel questions",
        ),
      ],
    }));
    const [insight] = buildCareerLearningInsights(input);
    expect(insight).toMatchObject({
      stage: "interview",
      confidence: "moderate",
    });
    expect(insight?.recommendation).toMatch(/debriefs/i);
  });
});
