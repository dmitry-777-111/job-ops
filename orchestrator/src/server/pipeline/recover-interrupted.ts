import { promises as fs } from "node:fs";
import { join } from "node:path";
import { logger } from "@infra/logger";
import { getDataDir } from "@server/config/dataDir";
import * as jobsRepo from "@server/repositories/jobs";
import { listPipelineRunItems } from "@server/repositories/pipeline-run-items";
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

type RecoveryCheckpoint = {
  selectedJobIds: string[];
};

function recoveryCheckpointPath(pipelineRunId: string): string {
  return join(getDataDir(), `pipeline-recovery-${pipelineRunId}.json`);
}

async function readRecoveryCheckpoint(
  pipelineRunId: string,
): Promise<RecoveryCheckpoint | null> {
  try {
    const parsed = JSON.parse(
      await fs.readFile(recoveryCheckpointPath(pipelineRunId), "utf8"),
    ) as Partial<RecoveryCheckpoint>;
    return Array.isArray(parsed.selectedJobIds)
      ? {
          selectedJobIds: parsed.selectedJobIds.filter(
            (id) => typeof id === "string",
          ),
        }
      : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeRecoveryCheckpoint(
  pipelineRunId: string,
  checkpoint: RecoveryCheckpoint,
): Promise<void> {
  const path = recoveryCheckpointPath(pipelineRunId);
  const tempPath = `${path}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(checkpoint), "utf8");
  await fs.rename(tempPath, path);
}

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

  const runItems = await listPipelineRunItems({ pipelineRunId });
  const hasRunMembership = runItems.length > 0;
  const discoveredForRun = hasRunMembership
    ? await jobsRepo.getDiscoveredJobsForPipelineRun(pipelineRunId)
    : await jobsRepo.getUnscoredDiscoveredJobs();
  const remainingBefore = discoveredForRun.filter(
    (job) => typeof job.suitabilityScore !== "number",
  ).length;
  const pipelineLogger = logger.child({ pipelineRunId });
  pipelineLogger.info(
    "Recovering interrupted pipeline from persisted scoring state",
    {
      remainingBefore,
      jobsDiscovered: run.jobsDiscovered,
    },
  );

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
      ...(hasRunMembership ? { pipelineRunId } : {}),
    });

    const allScored = (hasRunMembership
      ? (await jobsRepo.getDiscoveredJobsForPipelineRun(pipelineRunId)).filter(
          (job): job is ScoredJob => typeof job.suitabilityScore === "number",
        )
      : ((await jobsRepo.getScoredDiscoveredJobs()) as ScoredJob[]));
    const existingCheckpoint = await readRecoveryCheckpoint(pipelineRunId);
    let selectedJobIds = existingCheckpoint?.selectedJobIds ?? null;
    let selectedJobs: ScoredJob[];

    if (selectedJobIds) {
      const selectedRows = await Promise.all(
        selectedJobIds.map((jobId) => jobsRepo.getJobById(jobId)),
      );
      selectedJobs = selectedRows.filter(
        (job): job is ScoredJob =>
          Boolean(job) && typeof job?.suitabilityScore === "number",
      );
    } else {
      selectedJobs = await selectJobsStep({
        scoredJobs: allScored,
        mergedConfig,
      });
      selectedJobIds = selectedJobs.map((job) => job.id);
      await writeRecoveryCheckpoint(pipelineRunId, { selectedJobIds });
    }

    const jobsToProcess = selectedJobs.filter((job) => job.status !== "ready");

    try {
      await activateDynamicEmployersFromJobs(selectedJobs);
    } catch (error) {
      pipelineLogger.warn(
        "Dynamic employer activation failed during recovery",
        {
          error,
        },
      );
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
      selected: selectedJobIds.length,
      processed: processedCount,
    });

    return {
      success: true,
      remainingBefore,
      totalScored: allScored.length,
      selected: selectedJobIds.length,
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
      totalScored: hasRunMembership
        ? (await jobsRepo.getDiscoveredJobsForPipelineRun(pipelineRunId)).filter(
            (job) => typeof job.suitabilityScore === "number",
          ).length
        : (await jobsRepo.getScoredDiscoveredJobs()).length,
      selected: 0,
      processed: 0,
      error: message,
    };
  }
}
