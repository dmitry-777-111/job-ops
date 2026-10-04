import { logger } from "@infra/logger";
import { runPipeline } from "@server/pipeline";
import {
  claimPipelineRunRequest,
  finishPipelineRunRequest,
  getOutstandingPipelineRunRequest,
  type PipelineRunRequest,
} from "@server/repositories/pipeline-run-requests";

export type CandidateQueueDrainResult =
  | { status: "idle"; request: null }
  | { status: "deferred"; request: PipelineRunRequest }
  | { status: "completed"; request: PipelineRunRequest }
  | { status: "failed"; request: PipelineRunRequest };

/**
 * Drain at most one request for the active candidate scope.
 *
 * This deliberately does not loop. A global scheduler/dispatcher may call it
 * once per candidate in round-robin order, which prevents one candidate from
 * monopolizing the worker and keeps retries bounded.
 */
export async function drainOneCandidatePipelineRunRequest(): Promise<CandidateQueueDrainResult> {
  const outstanding = await getOutstandingPipelineRunRequest();
  if (!outstanding) return { status: "idle", request: null };

  if (outstanding.status === "claimed") {
    return { status: "deferred", request: outstanding };
  }

  const claimed = await claimPipelineRunRequest(outstanding.id);
  if (!claimed) return { status: "deferred", request: outstanding };

  try {
    const result = await runPipeline(claimed.requestedConfig);
    const finished = await finishPipelineRunRequest({
      requestId: claimed.id,
      status: result.success ? "completed" : "failed",
      errorMessage: result.error ?? null,
    });
    if (!finished) {
      throw new Error(`Claimed pipeline request ${claimed.id} disappeared.`);
    }
    return {
      status: result.success ? "completed" : "failed",
      request: finished,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error("Queued candidate pipeline run failed", {
      requestId: claimed.id,
      error: message,
    });
    const failed = await finishPipelineRunRequest({
      requestId: claimed.id,
      status: "failed",
      errorMessage: message,
    });
    if (!failed) throw error;
    return { status: "failed", request: failed };
  }
}
