import { logger } from "@infra/logger";
import * as jobsRepo from "@server/repositories/jobs";
import * as pipelineRepo from "@server/repositories/pipeline";
import * as settingsRepo from "@server/repositories/settings";
import { activateDynamicEmployersFromJobs } from "@server/services/dynamic-employers";
import type { PipelineConfig } from "@shared/types";
import { processJob } from "./orchestrator";
import {
  loadProfileStep,
  processJobsStep,
  scoreJobsStep,
  selectJobsStep,
} from "./steps";
import type { ScoredJob } from "./steps/types";

export async function recoverInterruptedPipelineRun(
  pipelineRunId: string,
): Promise<{
  success: boolean;
  remainingBefore: number;
  totalScored: number;
  selected: number;
  processed: number;
  error?: string;
}> {
  const run = await pipelineRepo.getPipelineRunById(pipelineRunId);
  if (!run) {
    throw new Error(`Pipeline run ${pipelineRunId} was not found.`);
  }
  if (run.status !== "running") {
    throw new Error(
      `Pipeline run ${pipelineRunId} is ${run.status}; only stale running runs can be recovered.`,
    );
  }
  if (!run.configSnapshot) {
    throw new Error(
      `Pipeline run ${pipelineRunId} has no config snapshot and cannot be recovered safely.`,
    );
  }

  const remainingBefore = (await jobsRepo.getUnscoredDiscoveredJobs()).length;
  const pipelineLogger = logger.child({ pipelineRunId });
  pipelineLogger.info("Recovering interrupted pipeline from persisted scoring state", {
    remainingBefore,
    jobsDiscovered: run.jobsDiscovered,
  });

  try {
    const profile = await loadProfileStep();
    const settings = await settingsRepo.getAllSettings();
    const snapshot = run.configSnapshot;
    const mergedConfig = {
      topN: snapshot.topN,
      minSuitabilityScore: snapshot.minSuitabilityScore,
      sources: snapshot.sources,
      locationIntent: snapshot.locationIntent,
    } as PipelineConfig;

    await scoreJobsStep({
      profile,
      scoringInstructions: settings.scoringInstructions,
      visaSponsorCountryKey: snapshot.locationIntent?.selectedCountry ?? null,
      hostedUsageReserved: false,
    });

    const allScored = (await jobsRepo.getScoredDiscoveredJobs()) as ScoredJob[];
    const jobsToProcess = await selectJobsStep({
      scoredJobs: allScored,
      mergedConfig,
    });

    try {
      await activateDynamicEmployersFromJobs(jobsToProcess);
    } catch (error) {
      pipelineLogger.warn("Dynamic employer activation failed during recovery", {
        error,
      });
    }

    const { processedCount } = await processJobsStep({
      jobsToProcess,
      processJob,
    });

    await pipelineRepo.updatePipelineRun(pipelineRunId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      jobsProcessed: processedCount,
    });

    pipelineLogger.info("Interrupted pipeline recovery completed", {
      remainingBefore,
      totalScored: allScored.length,
      selected: jobsToProcess.length,
      processed: processedCount,
    });

    return {
      success: true,
      remainingBefore,
      totalScored: allScored.length,
      selected: jobsToProcess.length,
      processed: processedCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await pipelineRepo.updatePipelineRun(pipelineRunId, {
      errorMessage: `Recovery attempt failed: ${message}`,
    });
    pipelineLogger.error("Interrupted pipeline recovery failed", error);
    return {
      success: false,
      remainingBefore,
      totalScored: (await jobsRepo.getScoredDiscoveredJobs()).length,
      selected: 0,
      processed: 0,
      error: message,
    };
  }
}
