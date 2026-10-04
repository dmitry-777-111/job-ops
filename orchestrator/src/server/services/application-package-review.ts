import { conflict, notFound } from "@infra/errors";
import { getApplicationPackage } from "@server/repositories/application-packages";
import { getMasterCareerProfileVersion } from "@server/repositories/candidate-profile";
import {
  getCandidateMarketPostingLiveContext,
  getMarketPostingVersion,
} from "@server/repositories/market-inventory";
import type {
  ApplicationEvidenceItem,
  ApplicationGapItem,
  ApplicationPackage,
  ApplicationRequirementItem,
} from "@shared/types";
import { evaluateStoredApplicationPackageQa } from "./application-package-approval";
import { describeTargetedCvChangesFromMaster } from "./application-package-generation";
import { deriveApplicationVacancyLiveGate } from "./application-package-live-gate";
import { extractApplicationRequirements } from "./application-package-requirements";

export type ApplicationRequirementCoverageState =
  | "verified"
  | "gap"
  | "unmapped";

export interface ApplicationRequirementCoverage {
  requirement: ApplicationRequirementItem;
  state: ApplicationRequirementCoverageState;
  evidence: ApplicationEvidenceItem | null;
  gap: ApplicationGapItem | null;
}

function buildRequirementCoverage(input: {
  requirements: ApplicationRequirementItem[];
  evidenceMap: ApplicationEvidenceItem[];
  gaps: ApplicationGapItem[];
}): ApplicationRequirementCoverage[] {
  const evidenceByKey = new Map(
    input.evidenceMap.map((item) => [item.requirementKey, item]),
  );
  const gapsByKey = new Map(
    input.gaps.map((item) => [item.requirementKey, item]),
  );

  return input.requirements.map((requirement) => {
    const evidence = evidenceByKey.get(requirement.key) ?? null;
    const gap = gapsByKey.get(requirement.key) ?? null;
    return {
      requirement,
      state: evidence ? "verified" : gap ? "gap" : "unmapped",
      evidence,
      gap,
    };
  });
}

export async function getApplicationPackageReview(input: {
  applicationPackageId: string;
  acknowledgeUnknownLiveState?: boolean;
}): Promise<{
  applicationPackage: ApplicationPackage;
  posting: {
    employer: string;
    title: string;
    location: string | null;
    canonicalUrl: string | null;
  };
  liveGate: ReturnType<typeof deriveApplicationVacancyLiveGate>;
  qa: Awaited<ReturnType<typeof evaluateStoredApplicationPackageQa>>["qa"];
  requirementCoverage: ApplicationRequirementCoverage[];
  changedFromMaster: string[];
}> {
  const applicationPackage = await getApplicationPackage(
    input.applicationPackageId,
  );
  if (!applicationPackage) throw notFound("Application package not found.");

  const [pinnedProfile, pinnedPostingVersion, currentContext, evaluated] =
    await Promise.all([
      getMasterCareerProfileVersion(applicationPackage.profileVersionId),
      getMarketPostingVersion(applicationPackage.marketPostingVersionId),
      getCandidateMarketPostingLiveContext(applicationPackage.marketPostingId),
      evaluateStoredApplicationPackageQa(input),
    ]);

  if (!pinnedProfile) {
    throw conflict(
      "The application package references a missing Master Career Profile version.",
    );
  }
  if (
    !pinnedPostingVersion ||
    pinnedPostingVersion.marketPostingId !== applicationPackage.marketPostingId
  ) {
    throw conflict(
      "The application package references a missing or mismatched vacancy version.",
    );
  }
  if (!currentContext) {
    throw notFound("Candidate market posting not found.");
  }

  const requirements = extractApplicationRequirements(
    pinnedPostingVersion.snapshot.description,
  );
  const liveGate = deriveApplicationVacancyLiveGate({
    posting: currentContext.posting,
    observations: currentContext.observations,
  });

  return {
    applicationPackage,
    posting: {
      employer: currentContext.posting.employer,
      title: currentContext.posting.title,
      location: currentContext.posting.location,
      canonicalUrl: currentContext.posting.canonicalUrl,
    },
    liveGate,
    qa: evaluated.qa,
    requirementCoverage: buildRequirementCoverage({
      requirements,
      evidenceMap: applicationPackage.evidenceMap,
      gaps: applicationPackage.gaps,
    }),
    changedFromMaster: applicationPackage.targetedCvJson
      ? describeTargetedCvChangesFromMaster({
          profile: pinnedProfile.profile,
          targetedCvJson: applicationPackage.targetedCvJson,
        })
      : [],
  };
}
