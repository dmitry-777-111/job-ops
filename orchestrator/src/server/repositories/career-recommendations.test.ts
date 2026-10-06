import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe.sequential("career recommendation decisions", () => {
  let tempDir: string;
  let repo: Awaited<typeof import("./career-recommendations")>;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-career-recommendation-"));
    process.env.DATA_DIR = tempDir;
    process.env.NODE_ENV = "test";
    process.env.JOBOPS_APP_MODE = "local";

    await import("../db/migrate");
    repo = await import("./career-recommendations");
  });

  afterEach(async () => {
    const { closeDb } = await import("../db");
    closeDb();
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("persists and updates one decision per recommendation key", async () => {
    const snapshot = {
      stage: "screening" as const,
      confidence: "moderate" as const,
      target: "interview_behavior" as const,
      title: "Screening conversion is weak",
      evidence: "1 of 5 screens advanced.",
      recommendation: "Review repeated screening questions.",
    };

    const accepted = await repo.decideCareerRecommendation({
      key: "screening-low-conversion",
      snapshot,
      status: "accepted",
    });
    expect(accepted.status).toBe("accepted");

    const rejected = await repo.decideCareerRecommendation({
      key: "screening-low-conversion",
      snapshot,
      status: "rejected",
    });
    expect(rejected.status).toBe("rejected");

    const rows = await repo.listCareerRecommendationDecisions();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      key: "screening-low-conversion",
      status: "rejected",
      snapshot,
    });
  });
});
