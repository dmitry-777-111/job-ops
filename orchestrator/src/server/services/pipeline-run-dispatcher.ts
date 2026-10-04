import { runWithRequestContext } from "@infra/request-context";
import { listReadyPipelineRunRequestOwners } from "@server/repositories/pipeline-run-requests";
import {
  type CandidateQueueDrainResult,
  drainOneCandidatePipelineRunRequest,
} from "./pipeline-run-queue";

export interface CandidateDispatchResult {
  tenantId: string;
  userId: string | null;
  result: CandidateQueueDrainResult;
}

/**
 * Fairness boundary for the small multi-user target (<=5 candidates): select
 * each candidate at most once, then drain one request under that candidate's
 * explicit tenant/user context. No candidate can monopolize one dispatcher pass.
 */
export async function dispatchReadyCandidateRunRequests(
  maxCandidates = 5,
): Promise<CandidateDispatchResult[]> {
  const owners = await listReadyPipelineRunRequestOwners(
    Math.max(1, Math.min(5, maxCandidates)),
  );

  const results: CandidateDispatchResult[] = [];
  for (const owner of owners) {
    const result = await runWithRequestContext(
      {
        requestId: `pipeline-dispatch:${owner.tenantId}:${owner.userId ?? "tenant"}`,
        tenantId: owner.tenantId,
        ...(owner.userId ? { userId: owner.userId } : {}),
        isSystemAdmin: true,
      },
      () => drainOneCandidatePipelineRunRequest(),
    );
    results.push({ ...owner, result });
  }
  return results;
}
