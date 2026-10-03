import type { CreateJobInput } from "@shared/types";
import { describe, expect, it, vi } from "vitest";
import { importJobsStep } from "./import-jobs";

vi.mock("@infra/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

vi.mock("@server/repositories/jobs", () => ({
  createJobs: vi.fn(async () => ({ created: 1, skipped: 0 })),
  getJobIdMapByUrls: vi.fn(
    async (urls: string[]) =>
      new Map(urls.map((url, index) => [url, `job-${index + 1}`])),
  ),
}));

vi.mock("@server/repositories/market-inventory", () => ({
  recordMarketPostingObservation: vi.fn(async () => ({
    posting: { id: "market-1" },
    canonicalContentChanged: true,
  })),
  attachMarketPostingToCandidate: vi.fn(async () => "candidate-market-1"),
}));

vi.mock("../progress", () => ({
  progressHelpers: {
    importingJob: vi.fn(),
    importComplete: vi.fn(),
  },
}));

describe("importJobsStep", () => {
  it("publishes the job currently being imported", async () => {
    const jobsRepo = await import("@server/repositories/jobs");
    const { progressHelpers } = await import("../progress");
    const job: CreateJobInput = {
      source: "linkedin",
      title: "Frontend Engineer",
      employer: "Monzo",
      jobUrl: "https://example.com/jobs/1",
    };

    await importJobsStep({ discoveredJobs: [job] });

    const onProgress = vi.mocked(jobsRepo.createJobs).mock.calls[0]?.[1];
    expect(onProgress).toBeTypeOf("function");
    onProgress?.(job, 1, 1);

    expect(progressHelpers.importingJob).toHaveBeenCalledWith(1, 1, {
      id: job.jobUrl,
      title: job.title,
      employer: job.employer,
    });
  });
});
