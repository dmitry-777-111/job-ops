import { conflict, notFound } from "@infra/errors";
import {
  type ApplicationPackage,
  createApplicationPackageDraft,
} from "@server/repositories/application-packages";
import { getActiveMasterCareerProfile } from "@server/repositories/candidate-profile";
import { getActiveCandidateStrategy } from "@server/repositories/candidate-strategy";
import {
  getCandidateMarketPostingLiveContext,
  getLatestMarketPostingVersionId,
} from "@server/repositories/market-inventory";
import { buildApplicationPackagePreparation } from "./application-package-preparation";

export const APPLICATION_PACKAGE_GENERATION_POLICY_VERSION = "freeze3-mvp-v1";

export async function prepareApplicationPackageDraft(input: {
  marketPostingId: string;
  acknowledgeUnknownLiveState?: boolean;
}): Promise<{
  applicationPackage: ApplicationPackage;
  preparation: ReturnType<typeof buildApplicationPackagePreparation>;
}> {
  const context = await getCandidateMarketPostingLiveContext(
    input.marketPostingId,
  );
  if (!context) throw notFound("Candidate market posting not found.");

  const [profile, strategy, marketPostingVersionId] = await Promise.all([
    getActiveMasterCareerProfile(),
    getActiveCandidateStrategy(),
    getLatestMarketPostingVersionId(input.marketPostingId),
  ]);

  if (!profile) {
    throw conflict(
      "An active Master Career Profile is required before preparing an application.",
    );
  }
  if (!strategy) {
    throw conflict(
      "An active candidate strategy is required before preparing an application.",
    );
  }
  if (!marketPostingVersionId) {
    throw conflict(
      "The vacancy has no versioned snapshot and cannot be used for an application package.",
    );
  }

  const preparation = buildApplicationPackagePreparation({
    posting: context.posting,
    observations: context.observations,
    profile: profile.profile,
    acknowledgeUnknownLiveState: input.acknowledgeUnknownLiveState,
  });

  if (preparation.liveGate.state === "closed") {
    throw conflict(
      "The vacancy is closed. Application package creation is blocked.",
    );
  }
  if (preparation.requiresLiveStateAcknowledgement) {
    throw conflict(
      "The vacancy live state is unknown. Explicit acknowledgement is required before preparing an application.",
    );
  }

  const applicationPackage = await createApplicationPackageDraft({
    marketPostingId: input.marketPostingId,
    marketPostingVersionId,
    profileVersionId: profile.id,
    strategyVersionId: strategy.id,
    generationPolicyVersion: APPLICATION_PACKAGE_GENERATION_POLICY_VERSION,
    evidenceMap: preparation.evidenceMap,
    gaps: preparation.gaps,
  });

  return {
    applicationPackage,
    preparation,
  };
}
