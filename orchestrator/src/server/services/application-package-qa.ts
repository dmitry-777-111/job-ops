import type {
  ApplicationPackage,
  MarketPosting,
  ResumeProfile,
} from "@shared/types";
import { buildEvidenceBoundedCoverLetter } from "./application-package-generation";
import type { ApplicationVacancyLiveState } from "./application-package-live-gate";
import {
  type ApplicationPackageStaleReason,
  deriveApplicationPackageStaleReasons,
} from "./application-package-staleness";

export const APPLICATION_PACKAGE_QA_BLOCKING_ISSUES = [
  "missing_targeted_cv",
  "targeted_cv_changes_candidate_facts",
  "missing_cover_letter",
  "cover_letter_not_evidence_bounded",
  "unsupported_form_answers",
  "vacancy_closed",
  "vacancy_unknown_unacknowledged",
  "package_stale",
] as const;

export type ApplicationPackageQaBlockingIssue =
  (typeof APPLICATION_PACKAGE_QA_BLOCKING_ISSUES)[number];

export interface ApplicationPackageQaResult {
  pass: boolean;
  blockingIssues: ApplicationPackageQaBlockingIssue[];
  staleReasons: ApplicationPackageStaleReason[];
  gapCount: number;
  hardGapCount: number;
}

function canonicalizeProfileForTruthComparison(
  profile: ResumeProfile,
): ResumeProfile {
  const clone = JSON.parse(JSON.stringify(profile)) as ResumeProfile;
  const skillSection = clone.sections?.skills;
  const skills = skillSection?.items;
  if (skillSection && skills) {
    skillSection.items = [...skills].sort((left, right) =>
      left.id.localeCompare(right.id),
    );
  }
  return clone;
}

function targetedCvPreservesMasterFacts(
  targetedCvJson: Record<string, unknown>,
  profile: ResumeProfile,
): boolean {
  const targeted = canonicalizeProfileForTruthComparison(
    targetedCvJson as ResumeProfile,
  );
  const master = canonicalizeProfileForTruthComparison(profile);
  return JSON.stringify(targeted) === JSON.stringify(master);
}

export function evaluateApplicationPackageQa(input: {
  applicationPackage: ApplicationPackage;
  posting: MarketPosting;
  profile: ResumeProfile;
  currentVersions: {
    marketPostingVersionId: string;
    profileVersionId: string;
    strategyVersionId: string | null;
    generationPolicyVersion: string;
  };
  liveState: ApplicationVacancyLiveState;
  acknowledgeUnknownLiveState?: boolean;
}): ApplicationPackageQaResult {
  const blockingIssues: ApplicationPackageQaBlockingIssue[] = [];
  const staleReasons = deriveApplicationPackageStaleReasons(
    input.applicationPackage,
    input.currentVersions,
  );

  if (!input.applicationPackage.targetedCvJson) {
    blockingIssues.push("missing_targeted_cv");
  } else if (
    !targetedCvPreservesMasterFacts(
      input.applicationPackage.targetedCvJson,
      input.profile,
    )
  ) {
    blockingIssues.push("targeted_cv_changes_candidate_facts");
  }

  if (!input.applicationPackage.coverLetter) {
    blockingIssues.push("missing_cover_letter");
  } else {
    const expectedCoverLetter = buildEvidenceBoundedCoverLetter({
      posting: input.posting,
      profile: input.profile,
      evidenceMap: input.applicationPackage.evidenceMap,
    });
    if (input.applicationPackage.coverLetter !== expectedCoverLetter) {
      blockingIssues.push("cover_letter_not_evidence_bounded");
    }
  }

  if (Object.keys(input.applicationPackage.formAnswers).length > 0) {
    blockingIssues.push("unsupported_form_answers");
  }

  if (input.liveState === "closed") {
    blockingIssues.push("vacancy_closed");
  }
  if (input.liveState === "unknown" && !input.acknowledgeUnknownLiveState) {
    blockingIssues.push("vacancy_unknown_unacknowledged");
  }
  if (staleReasons.length > 0) {
    blockingIssues.push("package_stale");
  }

  return {
    pass: blockingIssues.length === 0,
    blockingIssues,
    staleReasons,
    gapCount: input.applicationPackage.gaps.length,
    hardGapCount: input.applicationPackage.gaps.filter(
      (gap) => gap.severity === "hard_gap",
    ).length,
  };
}
