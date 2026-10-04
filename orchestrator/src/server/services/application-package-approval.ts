import { conflict, notFound } from "@infra/errors";
import {
  getApplicationPackage,
  updateApplicationPackage,
} from "@server/repositories/application-packages";
import {
  getActiveMasterCareerProfile,
  getMasterCareerProfileVersion,
} from "@server/repositories/candidate-profile";
import { getActiveCandidateStrategy } from "@server/repositories/candidate-strategy";
import {
  getCandidateMarketPostingLiveContext,
  getLatestMarketPostingVersionId,
} from "@server/repositories/market-inventory";
import type { ApplicationPackage } from "@shared/types";
import { APPLICATION_PACKAGE_GENERATION_POLICY_VERSION } from "./application-package-draft";
import { deriveApplicationVacancyLiveGate } from "./application-package-live-gate";
import {
  type ApplicationPackageQaResult,
  evaluateApplicationPackageQa,
} from "./application-package-qa";

export async function evaluateStoredApplicationPackageQa(input: {
  applicationPackageId: string;
  acknowledgeUnknownLiveState?: boolean;
}): Promise<{
  applicationPackage: ApplicationPackage;
  qa: ApplicationPackageQaResult;
}> {
  const applicationPackage = await getApplicationPackage(
    input.applicationPackageId,
  );
  if (!applicationPackage) throw notFound("Application package not found.");

  const context = await getCandidateMarketPostingLiveContext(
    applicationPackage.marketPostingId,
  );
  if (!context) throw notFound("Candidate market posting not found.");

  const [
    pinnedProfile,
    activeProfile,
    activeStrategy,
    currentPostingVersionId,
  ] = await Promise.all([
    getMasterCareerProfileVersion(applicationPackage.profileVersionId),
    getActiveMasterCareerProfile(),
    getActiveCandidateStrategy(),
    getLatestMarketPostingVersionId(applicationPackage.marketPostingId),
  ]);

  if (!pinnedProfile) {
    throw conflict(
      "The application package references a missing Master Career Profile version.",
    );
  }
  if (!currentPostingVersionId) {
    throw conflict(
      "The selected vacancy has no current versioned snapshot for QA.",
    );
  }

  const liveGate = deriveApplicationVacancyLiveGate({
    posting: context.posting,
    observations: context.observations,
  });

  const qa = evaluateApplicationPackageQa({
    applicationPackage,
    posting: context.posting,
    profile: pinnedProfile.profile,
    currentVersions: {
      marketPostingVersionId: currentPostingVersionId,
      profileVersionId: activeProfile?.id ?? "__missing_active_profile__",
      strategyVersionId: activeStrategy?.id ?? null,
      generationPolicyVersion: APPLICATION_PACKAGE_GENERATION_POLICY_VERSION,
    },
    liveState: liveGate.state,
    acknowledgeUnknownLiveState: input.acknowledgeUnknownLiveState,
  });

  return { applicationPackage, qa };
}

export async function approveApplicationPackage(input: {
  applicationPackageId: string;
  acknowledgeUnknownLiveState?: boolean;
}): Promise<{
  applicationPackage: ApplicationPackage;
  qa: ApplicationPackageQaResult;
}> {
  const evaluated = await evaluateStoredApplicationPackageQa(input);

  if (!evaluated.qa.pass) {
    if (evaluated.qa.staleReasons.length > 0) {
      await updateApplicationPackage(input.applicationPackageId, {
        status: "stale",
        staleReason: evaluated.qa.staleReasons.join(","),
      });
    }
    throw conflict(
      `Application package QA failed: ${evaluated.qa.blockingIssues.join(", ")}`,
    );
  }

  const approved = await updateApplicationPackage(input.applicationPackageId, {
    status: "approved",
    staleReason: null,
  });
  if (!approved) throw notFound("Application package not found.");

  return {
    applicationPackage: approved,
    qa: evaluated.qa,
  };
}
