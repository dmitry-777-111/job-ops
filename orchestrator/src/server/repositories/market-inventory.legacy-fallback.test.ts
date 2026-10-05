import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe.sequential("market inventory legacy compatibility fallback", () => {
  let tempDir: string;
  let jobsRepo: Awaited<typeof import("./jobs")>;
  let marketRepo: Awaited<typeof import("./market-inventory")>;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-market-inventory-"));
    process.env.DATA_DIR = tempDir;
    process.env.NODE_ENV = "test";
    process.env.JOBOPS_APP_MODE = "local";

    await import("../db/migrate");
    jobsRepo = await import("./jobs");
    marketRepo = await import("./market-inventory");
  });

  afterEach(async () => {
    const { closeDb } = await import("../db/index");
    closeDb();
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("resolves an older legacy job through its observation when a canonical posting pointer moved to another legacy job", async () => {
    const firstJob = await jobsRepo.createJob({
      source: "indeed",
      sourceJobId: "in-first",
      title: "Business Development Specialist - Mineral Processing",
      employer: "Bradken",
      jobUrl: "https://ca.indeed.test/viewjob?jk=first",
    });
    const secondJob = await jobsRepo.createJob({
      source: "indeed",
      sourceJobId: "in-second",
      title: "Business Development Specialist - Mineral Processing",
      employer: "Bradken Atchison",
      jobUrl: "https://ca.indeed.test/viewjob?jk=second",
    });

    const first = await marketRepo.recordMarketPostingObservation({
      source: "indeed",
      sourceJobId: "in-first",
      sourceUrl: firstJob.jobUrl,
      canonicalUrl: "https://employer.test/jobs/business-development",
      employer: "Bradken",
      title: firstJob.title,
    });
    await marketRepo.attachMarketPostingToCandidate({
      marketPostingId: first.posting.id,
      legacyJobId: firstJob.id,
    });

    const second = await marketRepo.recordMarketPostingObservation({
      source: "indeed",
      sourceJobId: "in-second",
      sourceUrl: secondJob.jobUrl,
      canonicalUrl: "https://employer.test/jobs/business-development",
      employer: "Bradken Atchison",
      title: secondJob.title,
    });
    expect(second.posting.id).toBe(first.posting.id);

    await marketRepo.attachMarketPostingToCandidate({
      marketPostingId: second.posting.id,
      legacyJobId: secondJob.id,
    });

    expect(
      await marketRepo.getCandidateMarketPostingIdForLegacyJob(secondJob.id),
    ).toBe(first.posting.id);
    expect(
      await marketRepo.getCandidateMarketPostingIdForLegacyJob(firstJob.id),
    ).toBe(first.posting.id);
  });
});
