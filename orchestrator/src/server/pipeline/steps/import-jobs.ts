import { logger } from "@infra/logger";
import { sanitizeUnknown } from "@infra/sanitize";
import { marketPostingInputFromJob } from "@server/market-inventory/from-job";
import * as jobsRepo from "@server/repositories/jobs";
import {
  attachMarketPostingToCandidate,
  recordMarketPostingObservation,
} from "@server/repositories/market-inventory";
import { ensurePipelineRunItems } from "@server/repositories/pipeline-run-items";
import { deduplicateJobsByTitleAndEmployer } from "@shared/job-matching.js";
import type { CreateJobInput } from "@shared/types";
import { progressHelpers } from "../progress";

export async function importJobsStep(args: {
  discoveredJobs: CreateJobInput[];
  pipelineRunId?: string;
}): Promise<{
  created: number;
  skipped: number;
  fuzzyMerged: number;
  runItemsAttached: number;
  marketInventoryRecorded: number;
  marketInventoryErrors: number;
}> {
  logger.info("Importing discovered jobs", {
    discovered: args.discoveredJobs.length,
  });

  const dedupedJobs = deduplicateJobsByTitleAndEmployer(args.discoveredJobs);
  const fuzzyMerged = args.discoveredJobs.length - dedupedJobs.length;

  if (fuzzyMerged > 0) {
    logger.info("Fuzzy-deduped discovered jobs before import", {
      original: args.discoveredJobs.length,
      dedupedCount: dedupedJobs.length,
      fuzzyMerged,
    });
  }

  const { created, skipped } = await jobsRepo.createJobs(
    dedupedJobs,
    (job, index, total) =>
      progressHelpers.importingJob(index, total, {
        id: job.jobUrl,
        title: job.title,
        employer: job.employer,
      }),
  );
  const jobIdByUrl = await jobsRepo.getJobIdMapByUrls(
    dedupedJobs.map((job) => job.jobUrl),
  );
  let marketInventoryRecorded = 0;
  let marketInventoryErrors = 0;
  for (const job of dedupedJobs) {
    try {
      const { posting } = await recordMarketPostingObservation(
        marketPostingInputFromJob(job),
      );
      await attachMarketPostingToCandidate({
        marketPostingId: posting.id,
        legacyJobId: jobIdByUrl.get(job.jobUrl) ?? null,
      });
      marketInventoryRecorded += 1;
    } catch (error) {
      marketInventoryErrors += 1;
      logger.warn("Market inventory shadow write failed", {
        source: job.source,
        sourceJobId: job.sourceJobId ?? null,
        jobUrl: job.jobUrl,
        error: sanitizeUnknown(error),
      });
    }
  }

  let runItemsAttached = 0;
  if (args.pipelineRunId) {
    runItemsAttached = await ensurePipelineRunItems({
      pipelineRunId: args.pipelineRunId,
      jobIds: [...jobIdByUrl.values()],
    });
  }

  logger.info("Import step complete", {
    discovered: args.discoveredJobs.length,
    fuzzyMerged,
    created,
    skipped,
    runItemsAttached,
    marketInventoryRecorded,
    marketInventoryErrors,
  });

  progressHelpers.importComplete(created, skipped + fuzzyMerged);

  return {
    created,
    skipped,
    fuzzyMerged,
    runItemsAttached,
    marketInventoryRecorded,
    marketInventoryErrors,
  };
}
