import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe.sequential("candidate evaluation idempotency", () => {
  let tempDir: string;
  let db: Awaited<typeof import("../db/index")>["db"];
  let schema: Awaited<typeof import("../db/index")>["schema"];
  let repo: Awaited<typeof import("./candidate-evaluations")>;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-candidate-eval-"));
    process.env.DATA_DIR = tempDir;
    process.env.NODE_ENV = "test";

    await import("../db/migrate");
    ({ db, schema } = await import("../db/index"));
    repo = await import("./candidate-evaluations");

    const now = "2026-10-04T00:00:00.000Z";
    await db.insert(schema.marketPostings).values({
      id: "posting-1",
      identityKey: "source:test:posting-1",
      employer: "Acme",
      title: "Maintenance Technician",
      contentFingerprint: "content-v1",
      firstObservedAt: now,
      lastObservedAt: now,
    });
    await db.insert(schema.marketPostingVersions).values({
      id: "posting-v1",
      marketPostingId: "posting-1",
      version: 1,
      contentFingerprint: "content-v1",
      snapshot: {},
    });
    await db.insert(schema.marketPostingVersions).values({
      id: "posting-v2",
      marketPostingId: "posting-1",
      version: 2,
      contentFingerprint: "content-v2",
      snapshot: { salary: "$42/hour" },
    });
    await db.insert(schema.candidateProfileVersions).values({
      id: "profile-v1",
      version: 1,
      status: "active",
      profileJson: {},
      source: "manual",
    });
    await db.insert(schema.candidateStrategyVersions).values({
      id: "strategy-v1",
      version: 1,
      status: "active",
      targetMarkets: ["canada"],
      targetRoleFamilies: ["field_service"],
      excludedRoleFamilies: [],
      constraints: [],
    });
  });

  afterEach(async () => {
    const { closeDb } = await import("../db/index");
    closeDb();
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  const baseInput = {
    marketPostingId: "posting-1",
    marketPostingVersionId: "posting-v1",
    profileVersionId: "profile-v1",
    strategyVersionId: "strategy-v1",
    scoringPolicyVersion: "policy-v1",
  };

  it("reuses the immutable input tuple instead of creating repeated work", async () => {
    const first = await repo.ensureCandidateEvaluation(baseInput);
    const second = await repo.ensureCandidateEvaluation(baseInput);

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.evaluation.id).toBe(first.evaluation.id);

    const rows = await db.select().from(schema.candidateEvaluations);
    expect(rows).toHaveLength(1);
  });

  it("creates new work when decision-relevant posting content changes", async () => {
    const first = await repo.ensureCandidateEvaluation(baseInput);
    const changed = await repo.ensureCandidateEvaluation({
      ...baseInput,
      marketPostingVersionId: "posting-v2",
    });

    expect(first.created).toBe(true);
    expect(changed.created).toBe(true);
    expect(changed.evaluation.id).not.toBe(first.evaluation.id);
  });

  it("coalesces concurrent attempts for the same immutable tuple", async () => {
    const results = await Promise.all([
      repo.ensureCandidateEvaluation(baseInput),
      repo.ensureCandidateEvaluation(baseInput),
    ]);

    expect(results.filter((result) => result.created)).toHaveLength(1);
    expect(new Set(results.map((result) => result.evaluation.id))).toHaveLength(
      1,
    );

    const rows = await db.select().from(schema.candidateEvaluations);
    expect(rows).toHaveLength(1);
  });
});
