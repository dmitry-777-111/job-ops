import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe.sequential("candidate profile and strategy versioning", () => {
  let tempDir: string;
  let profileRepo: Awaited<typeof import("./candidate-profile")>;
  let strategyRepo: Awaited<typeof import("./candidate-strategy")>;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-candidate-domain-"));
    process.env.DATA_DIR = tempDir;
    process.env.NODE_ENV = "test";
    process.env.JOBOPS_APP_MODE = "local";

    await import("../db/migrate");
    profileRepo = await import("./candidate-profile");
    strategyRepo = await import("./candidate-strategy");
  });

  afterEach(async () => {
    const { closeDb } = await import("../db/index");
    closeDb();
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("increments master career profile versions and keeps one active version", async () => {
    const first = await profileRepo.createMasterCareerProfileDraft({
      profile: { basics: { name: "Candidate", label: "Technician" } },
      source: "manual",
      provenance: { migration: "test-v1" },
    });
    const second = await profileRepo.createMasterCareerProfileDraft({
      profile: { basics: { name: "Candidate", label: "Field Service" } },
      source: "manual",
      provenance: { migration: "test-v2" },
    });

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);

    await profileRepo.activateMasterCareerProfileVersion(first.id);
    await profileRepo.activateMasterCareerProfileVersion(second.id);

    const versions = await profileRepo.listMasterCareerProfileVersions();
    expect(versions).toHaveLength(2);
    expect(versions.find((version) => version.id === first.id)?.status).toBe(
      "superseded",
    );
    expect(versions.find((version) => version.id === second.id)?.status).toBe(
      "active",
    );
    expect((await profileRepo.getActiveMasterCareerProfile())?.id).toBe(
      second.id,
    );
  });

  it("increments strategy versions and preserves constraint lifecycle metadata", async () => {
    const first = await strategyRepo.createCandidateStrategyDraft({
      targetMarkets: ["canada"],
      targetRoleFamilies: ["field service"],
      constraints: [
        {
          id: "travel-us",
          key: "us_travel",
          kind: "hard",
          value: "temporarily_reject",
          source: "candidate",
          confidence: 1,
          effectiveAt: "2026-10-04T00:00:00.000Z",
          expiresAt: null,
          recheckTrigger: "candidate_lifts_restriction",
        },
      ],
    });
    const second = await strategyRepo.createCandidateStrategyDraft({
      targetMarkets: ["canada"],
      targetRoleFamilies: ["field service", "commissioning"],
      constraints: first.constraints,
    });

    expect(first.version).toBe(1);
    expect(second.version).toBe(2);
    expect(second.constraints[0]).toEqual(
      expect.objectContaining({
        kind: "hard",
        effectiveAt: "2026-10-04T00:00:00.000Z",
        expiresAt: null,
        recheckTrigger: "candidate_lifts_restriction",
      }),
    );

    await strategyRepo.activateCandidateStrategyVersion(first.id);
    await strategyRepo.activateCandidateStrategyVersion(second.id);

    const versions = await strategyRepo.listCandidateStrategyVersions();
    expect(versions).toHaveLength(2);
    expect(versions.find((version) => version.id === first.id)?.status).toBe(
      "superseded",
    );
    expect(versions.find((version) => version.id === second.id)?.status).toBe(
      "active",
    );
    expect((await strategyRepo.getActiveCandidateStrategy())?.id).toBe(
      second.id,
    );
  });
});
