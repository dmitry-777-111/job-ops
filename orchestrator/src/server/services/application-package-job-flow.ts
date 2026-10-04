import { notFound } from "@infra/errors";
import { listApplicationPackagesForPosting } from "@server/repositories/application-packages";
import {
  getCandidateMarketPostingIdForLegacyJob,
  getCandidateMarketPostingLiveContext,
} from "@server/repositories/market-inventory";
import type { ApplicationPackage } from "@shared/types";
import { prepareApplicationPackageDraft } from "./application-package-draft";
import { deriveApplicationVacancyLiveGate } from "./application-package-live-gate";

async function resolveCandidateMarketPostingId(
  legacyJobId: string,
): Promise<string> {
  const marketPostingId =
    await getCandidateMarketPostingIdForLegacyJob(legacyJobId);
  if (!marketPostingId) {
    throw notFound("Candidate market posting not found for this job.");
  }
  return marketPostingId;
}

export async function getApplicationPackageJobFlow(input: {
  legacyJobId: string;
}): Promise<{
  legacyJobId: string;
  marketPostingId: string;
  liveGate: ReturnType<typeof deriveApplicationVacancyLiveGate>;
  applicationPackages: ApplicationPackage[];
}> {
  const marketPostingId = await resolveCandidateMarketPostingId(
    input.legacyJobId,
  );
  const context = await getCandidateMarketPostingLiveContext(marketPostingId);
  if (!context) throw notFound("Candidate market posting not found.");

  const applicationPackages =
    await listApplicationPackagesForPosting(marketPostingId);

  return {
    legacyJobId: input.legacyJobId,
    marketPostingId,
    liveGate: deriveApplicationVacancyLiveGate(context),
    applicationPackages,
  };
}

export async function prepareApplicationPackageForJob(input: {
  legacyJobId: string;
  acknowledgeUnknownLiveState?: boolean;
}) {
  const marketPostingId = await resolveCandidateMarketPostingId(
    input.legacyJobId,
  );
  return prepareApplicationPackageDraft({
    marketPostingId,
    acknowledgeUnknownLiveState: input.acknowledgeUnknownLiveState,
  });
}
