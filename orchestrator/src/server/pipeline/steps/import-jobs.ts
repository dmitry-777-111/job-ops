import { logger } from "@infra/logger";
import * as jobsRepo from "@server/repositories/jobs";
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
  let runItemsAttached = 0;
  if (args.pipelineRunId) {
    const jobIds = await jobsRepo.getJobIdsByUrls(
      dedupedJobs.map((job) => job.jobUrl),
    );
    runItemsAttached = await ensurePipelineRunItems({
      pipelineRunId: args.pipelineRunId,
      jobIds,
    });
  }

  logger.info("Import step complete", {
    discovered: args.discoveredJobs.length,
    fuzzyMerged,
    created,
    skipped,
    runItemsAttached,
  });

  progressHelpers.importComplete(created, skipped + fuzzyMerged);

  return { created, skipped, fuzzyMerged, runItemsAttached };
}
