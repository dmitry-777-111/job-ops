import { createHash } from "node:crypto";
import { marketPostingInputFromJob } from "@server/market-inventory/from-job";
import { buildMarketPostingContentFingerprint } from "@server/market-inventory/identity";
import {
  ensureCandidateEvaluation,
  hasCandidateEvaluationForMarketPosting,
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
import type { CreateJobInput, Job } from "@shared/types";

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

function toCreateJobInput(job: Job): CreateJobInput {
  return {
    source: job.source,
    sourceJobId: job.sourceJobId ?? undefined,
    title: job.title,
    employer: job.employer,
    employerUrl: job.employerUrl ?? undefined,
    jobUrl: job.jobUrl,
    applicationLink: job.applicationLink ?? undefined,
    deadline: job.deadline ?? undefined,
    salary: job.salary ?? undefined,
    location: job.location ?? undefined,
    jobDescription: job.jobDescription ?? undefined,
    jobUrlDirect: job.jobUrlDirect ?? undefined,
    datePosted: job.datePosted ?? undefined,
    jobType: job.jobType ?? undefined,
    salarySource: job.salarySource ?? undefined,
    salaryInterval: job.salaryInterval ?? undefined,
    salaryMinAmount: job.salaryMinAmount ?? undefined,
    salaryMaxAmount: job.salaryMaxAmount ?? undefined,
    salaryCurrency: job.salaryCurrency ?? undefined,
    isRemote: job.isRemote ?? undefined,
    jobLevel: job.jobLevel ?? undefined,
    jobFunction: job.jobFunction ?? undefined,
    listingType: job.listingType ?? undefined,
    emails: job.emails ?? undefined,
    companyIndustry: job.companyIndustry ?? undefined,
    companyLogo: job.companyLogo ?? undefined,
    companyUrlDirect: job.companyUrlDirect ?? undefined,
    companyAddresses: job.companyAddresses ?? undefined,
    companyNumEmployees: job.companyNumEmployees ?? undefined,
    companyRevenue: job.companyRevenue ?? undefined,
    companyDescription: job.companyDescription ?? undefined,
    skills: job.skills ?? undefined,
    experienceRange: job.experienceRange ?? undefined,
    companyRating: job.companyRating ?? undefined,
    companyReviewsCount: job.companyReviewsCount ?? undefined,
    vacancyCount: job.vacancyCount ?? undefined,
    workFromHomeType: job.workFromHomeType ?? undefined,
  };
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
    // A fresh immutable evaluation tuple must never inherit the legacy cached
    // score. The prior result remains auditable in candidate_evaluations.
    suitabilityScore: null,
    suitabilityReason: null,
    jobBrief: null,
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

    const hadPriorEvaluation =
      await hasCandidateEvaluationForMarketPosting(marketPostingId);
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
      marketPostingInputFromJob(toCreateJobInput(legacyJob)),
    );
    const hasLegacyScore =
      typeof legacyJob.suitabilityScore === "number" &&
      !Number.isNaN(legacyJob.suitabilityScore);

    if (
      ensured.created &&
      !hadPriorEvaluation &&
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
