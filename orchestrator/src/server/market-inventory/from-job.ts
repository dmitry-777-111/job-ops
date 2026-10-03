import type {
  CreateJobInput,
  MarketObservationAuthority,
  MarketPostingInput,
} from "@shared/types";

export function inferMarketObservationAuthority(
  source: string,
): MarketObservationAuthority {
  const normalized = source.trim().toLowerCase();
  if (
    normalized.startsWith("workday:") ||
    normalized.startsWith("greenhouse:") ||
    normalized.startsWith("bamboohr:")
  ) {
    return "official";
  }
  if (normalized === "manual") return "manual";
  if (
    normalized === "indeed" ||
    normalized === "linkedin" ||
    normalized === "jobbank"
  ) {
    return "board";
  }
  if (
    normalized === "adzuna" ||
    normalized === "hiringcafe" ||
    normalized === "gradcracker" ||
    normalized === "ukvisajobs" ||
    normalized === "workingnomads" ||
    normalized === "startupjobs"
  ) {
    return "aggregator";
  }
  return "unknown";
}

export function marketPostingInputFromJob(
  job: CreateJobInput,
): MarketPostingInput {
  const authority = inferMarketObservationAuthority(job.source);
  const isOfficialAts = authority === "official";
  return {
    source: job.source,
    authority,
    sourceJobId: job.sourceJobId ?? null,
    sourceUrl: job.jobUrl,
    canonicalUrl:
      job.jobUrlDirect ??
      job.applicationLink ??
      (isOfficialAts ? job.jobUrl : null),
    officialRequisitionId:
      isOfficialAts && job.sourceJobId ? job.sourceJobId : null,
    employer: job.employer,
    title: job.title,
    location: job.location ?? null,
    description: job.jobDescription ?? null,
    datePosted: job.datePosted ?? null,
    deadline: job.deadline ?? null,
    salaryText: job.salary ?? null,
    salaryCurrency: job.salaryCurrency ?? null,
    isLive: null,
  };
}
