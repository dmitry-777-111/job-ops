import type {
  ApplicationEvidenceItem,
  ApplicationGapItem,
  ApplicationPackage,
  ApplicationRequirementItem,
} from "@shared/types";
import { fetchApi, withQuery } from "./core";

export type ApplicationVacancyLiveState = "live" | "closed" | "unknown";

export interface ApplicationVacancyLiveGate {
  state: ApplicationVacancyLiveState;
  blocksGeneration: boolean;
  requiresReview: boolean;
  reason: string;
  canonicalStatus: string;
  evaluatedAt: string;
  evidence: {
    source: string;
    authority: string;
    sourceUrl: string;
    observedAt: string;
    isLive: boolean;
  } | null;
}

export interface ApplicationPackageJobFlow {
  legacyJobId: string;
  marketPostingId: string;
  liveGate: ApplicationVacancyLiveGate;
  applicationPackages: ApplicationPackage[];
}

export interface ApplicationRequirementCoverage {
  requirement: ApplicationRequirementItem;
  state: "verified" | "gap" | "unmapped";
  evidence: ApplicationEvidenceItem | null;
  gap: ApplicationGapItem | null;
}

export interface ApplicationPackageQaResult {
  pass: boolean;
  blockingIssues: string[];
  staleReasons: string[];
  gapCount: number;
  hardGapCount: number;
}

export interface ApplicationPackageReview {
  applicationPackage: ApplicationPackage;
  posting: {
    employer: string;
    title: string;
    location: string | null;
    canonicalUrl: string | null;
  };
  liveGate: ApplicationVacancyLiveGate;
  qa: ApplicationPackageQaResult;
  requirementCoverage: ApplicationRequirementCoverage[];
  changedFromMaster: string[];
}

export async function getApplicationPackageJobFlow(
  legacyJobId: string,
): Promise<ApplicationPackageJobFlow> {
  return fetchApi<ApplicationPackageJobFlow>(
    withQuery("/application-packages/jobs/" + legacyJobId, { t: Date.now() }),
  );
}

export async function prepareApplicationPackageForJob(
  legacyJobId: string,
  input?: { acknowledgeUnknownLiveState?: boolean },
): Promise<{
  applicationPackage: ApplicationPackage;
  preparation: unknown;
}> {
  return fetchApi<{
    applicationPackage: ApplicationPackage;
    preparation: unknown;
  }>("/application-packages/jobs/" + legacyJobId + "/prepare", {
    method: "POST",
    body: JSON.stringify({
      acknowledgeUnknownLiveState: input?.acknowledgeUnknownLiveState === true,
    }),
  });
}

export async function getApplicationPackageReview(
  applicationPackageId: string,
  options?: { acknowledgeUnknownLiveState?: boolean },
): Promise<ApplicationPackageReview> {
  return fetchApi<ApplicationPackageReview>(
    withQuery("/application-packages/" + applicationPackageId + "/review", {
      acknowledgeUnknownLiveState:
        options?.acknowledgeUnknownLiveState === true ? "true" : undefined,
      t: Date.now(),
    }),
  );
}

export async function approveApplicationPackage(
  applicationPackageId: string,
  input?: { acknowledgeUnknownLiveState?: boolean },
): Promise<{
  applicationPackage: ApplicationPackage;
  qa: ApplicationPackageQaResult;
}> {
  return fetchApi<{
    applicationPackage: ApplicationPackage;
    qa: ApplicationPackageQaResult;
  }>("/application-packages/" + applicationPackageId + "/approve", {
    method: "POST",
    body: JSON.stringify({
      acknowledgeUnknownLiveState: input?.acknowledgeUnknownLiveState === true,
    }),
  });
}
