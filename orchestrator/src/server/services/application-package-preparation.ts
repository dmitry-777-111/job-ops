import type {
  ApplicationEvidenceItem,
  ApplicationGapItem,
  ApplicationRequirementItem,
  MarketPosting,
  MarketPostingObservation,
  ResumeProfile,
} from "@shared/types";
import {
  type ApplicationVacancyLiveGateResult,
  deriveApplicationVacancyLiveGate,
} from "./application-package-live-gate";
import {
  extractApplicationRequirements,
  mapApplicationRequirementsToEvidence,
} from "./application-package-requirements";

export interface ApplicationPackagePreparation {
  liveGate: ApplicationVacancyLiveGateResult;
  requirements: ApplicationRequirementItem[];
  evidenceMap: ApplicationEvidenceItem[];
  gaps: ApplicationGapItem[];
  canCreateDraft: boolean;
  requiresLiveStateAcknowledgement: boolean;
}

export function buildApplicationPackagePreparation(input: {
  posting: MarketPosting;
  observations: MarketPostingObservation[];
  profile: ResumeProfile;
  acknowledgeUnknownLiveState?: boolean;
  now?: string;
}): ApplicationPackagePreparation {
  const liveGate = deriveApplicationVacancyLiveGate({
    posting: input.posting,
    observations: input.observations,
    now: input.now,
  });

  const requirements = extractApplicationRequirements(
    input.posting.description,
  );
  const { evidenceMap, gaps } = mapApplicationRequirementsToEvidence({
    requirements,
    profile: input.profile,
  });

  const requiresLiveStateAcknowledgement =
    liveGate.state === "unknown" && !input.acknowledgeUnknownLiveState;
  const canCreateDraft =
    liveGate.state !== "closed" && !requiresLiveStateAcknowledgement;

  return {
    liveGate,
    requirements,
    evidenceMap,
    gaps,
    canCreateDraft,
    requiresLiveStateAcknowledgement,
  };
}
