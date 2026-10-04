import { createHash } from "node:crypto";
import { marketPostingInputFromJob } from "@server/market-inventory/from-job";
import { buildMarketPostingContentFingerprint } from "@server/market-inventory/identity";
import {
  ensureCandidateEvaluation,
  updateCandidateEvaluation,
} from "@server/repositories/candidate-evaluations";
import { getActiveMasterCareerProfile } from "@server/repositories/candidate-profile";
import { getActiveCandidateStrategy } from "@server/repositories/candidate-strategy";
import * as jobsRepo from "@server/repositories/jobs";
import {
  getCandidateMarketPostingIdForLegacyJob,
  getLatestMarketPostingVersionId,
  getMarketPostingVersion,
} from "@server/repositories/market-inventory";
import type { Job } from "@shared/types";

export interface VersionedScoringTarget {
  job: Job;
  evaluationId: string;
}

export interface VersionedScoringBatch {
  profile: Record<string, unknown>;
  scoringPolicyVersion: string;
  targets: VersionedScoringTarget[];
  seededFromLegacy: number;
  reusedCompleted: number;
}

export function buildScoringPolicyVersion(
  scoringInstructions?: string,
): string {
  const normalized = scoringInstructions?.trim() ?? "";
  const digest = createHash("sha256").update(normalized).digest("hex");
  return `freeze3-score-${digest.slice(0, 16)}`;
}

function jobWithPostingSnapshot(
  job: Job,
  snapshot: {
    title: string;
    employer: string;
    location?: string | null;
    description?: string | null;
    datePosted?: string | null;
    deadline?: string | null;
    sourceUrl: string;
  },
): Job {
  return {
    ...job,
    title: snapshot.title || job.title,
    employer: snapshot.employer || job.employer,
    location: snapshot.location ?? job.location,
    jobDescription: snapshot.description ?? job.jobDescription,
    datePosted: snapshot.datePosted ?? job.datePosted,
    deadline: snapshot.deadline ?? job.deadline,
    applicationLink: snapshot.sourceUrl || job.applicationLink,
  };
}

/**
 * Resolve the run's scoring work through immutable posting/profile/strategy/policy
 * tuples. Existing legacy scores are used only to bootstrap an identical
 * posting-version tuple; changed posting content must create fresh scoring work.
 */
export async function prepareVersionedScoringBatch(input: {
  pipelineRunId: string;
  scoringInstructions?: string;
}): Promise<VersionedScoringBatch | null> {
  const [profileVersion, strategyVersion] = await Promise.all([
    getActiveMasterCareerProfile(),
    getActiveCandidateStrategy(),
  ]);
  if (!profileVersion || !strategyVersion) return null;

  const scoringPolicyVersion = buildScoringPolicyVersion(
    input.scoringInstructions,
  );
  const runJobs = await jobsRepo.getDiscoveredJobsForPipelineRun(
    input.pipelineRunId,
  );

  const targets: VersionedScoringTarget[] = [];
  let seededFromLegacy = 0;
  let reusedCompleted = 0;

  for (const legacyJob of runJobs) {
    const marketPostingId = await getCandidateMarketPostingIdForLegacyJob(
      legacyJob.id,
    );
    if (!marketPostingId) continue;

    const marketPostingVersionId =
      await getLatestMarketPostingVersionId(marketPostingId);
    if (!marketPostingVersionId) continue;

    const postingVersion = await getMarketPostingVersion(
      marketPostingVersionId,
    );
    if (!postingVersion) continue;

    const ensured = await ensureCandidateEvaluation({
      marketPostingId,
      marketPostingVersionId,
      profileVersionId: profileVersion.id,
      strategyVersionId: strategyVersion.id,
      scoringPolicyVersion,
    });

    if (ensured.evaluation.status === "scored") {
      reusedCompleted += 1;
      continue;
    }

    const legacyFingerprint = buildMarketPostingContentFingerprint(
      marketPostingInputFromJob(legacyJob),
    );
    const hasLegacyScore =
      typeof legacyJob.suitabilityScore === "number" &&
      !Number.isNaN(legacyJob.suitabilityScore);

    if (
      ensured.created &&
      hasLegacyScore &&
      legacyFingerprint === postingVersion.contentFingerprint
    ) {
      await updateCandidateEvaluation(ensured.evaluation.id, {
        status: "scored",
        suitabilityScore: legacyJob.suitabilityScore,
        suitabilityReason: legacyJob.suitabilityReason ?? null,
      });
      seededFromLegacy += 1;
      continue;
    }

    targets.push({
      evaluationId: ensured.evaluation.id,
      job: jobWithPostingSnapshot(legacyJob, postingVersion.snapshot),
    });
  }

  return {
    profile: profileVersion.profile as unknown as Record<string, unknown>,
    scoringPolicyVersion,
    targets,
    seededFromLegacy,
    reusedCompleted,
  };
}
