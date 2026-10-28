import type {
  ApplicationPackage,
  MarketPosting,
  ResumeProfile,
} from "@shared/types";
import {
  editorialCoverMatches,
  normalizeEditorialText,
  retargetExplicitSummary,
} from "./application-package-editorial";
import {
  applicationTarget,
  buildEvidenceBoundedCoverLetter,
} from "./application-package-generation";
import type { ApplicationVacancyLiveState } from "./application-package-live-gate";
import { buildProfileEvidenceAtoms } from "./application-package-requirements";
import {
  type ApplicationPackageStaleReason,
  deriveApplicationPackageStaleReasons,
} from "./application-package-staleness";

export const APPLICATION_PACKAGE_QA_BLOCKING_ISSUES = [
  "missing_targeted_cv",
  "targeted_cv_changes_candidate_facts",
  "targeted_cv_wrong_requisition",
  "missing_cover_letter",
  "cover_letter_not_evidence_bounded",
  "unresolved_hard_requirements",
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
  // Normalize presentation only in prose; identity, dates, credentials, skill
  // levels and every other structured value remain exact and mandatory.
  const normalize = (value: unknown): void => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (
        typeof child === "string" &&
        ["summary", "description", "content"].includes(key)
      ) {
        (value as Record<string, unknown>)[key] = normalizeEditorialText(child);
      } else normalize(child);
    }
  };
  normalize(clone);
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
  posting: MarketPosting,
): boolean {
  const targeted = canonicalizeProfileForTruthComparison(
    targetedCvJson as ResumeProfile,
  );
  if (
    JSON.stringify(targeted) ===
    JSON.stringify(canonicalizeProfileForTruthComparison(profile))
  )
    return true;
  const source = structuredClone(profile);
  const target = applicationTarget(posting);
  if (source.basics?.summary)
    source.basics.summary = retargetExplicitSummary(
      source.basics.summary,
      target,
    );
  if (source.sections?.summary?.content)
    source.sections.summary.content = retargetExplicitSummary(
      source.sections.summary.content,
      target,
    );
  const master = canonicalizeProfileForTruthComparison(source);
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
      input.posting,
    )
  ) {
    blockingIssues.push("targeted_cv_changes_candidate_facts");
  }

  // An unchanged source can still be an application for another requisition.
  // Inspect explicit target paragraphs only, never historical employment text.
  const cv = input.applicationPackage.targetedCvJson as ResumeProfile | null;
  const targetTexts = [cv?.basics?.summary, cv?.sections?.summary?.content];
  const requisition = input.posting.officialRequisitionId?.trim().toLowerCase();
  if (
    requisition &&
    targetTexts.some((text) => {
      if (!text) return false;
      const declared = normalizeEditorialText(text).match(
        /\bTarget position\s+.{0,400}?\bRequisition\s*#?\s*([\w-]+)/i,
      )?.[1];
      return declared !== undefined && declared.toLowerCase() !== requisition;
    })
  ) {
    blockingIssues.push("targeted_cv_wrong_requisition");
  }

  if (!input.applicationPackage.coverLetter) {
    blockingIssues.push("missing_cover_letter");
  } else {
    const expectedCoverLetter = buildEvidenceBoundedCoverLetter({
      posting: input.posting,
      profile: input.profile,
      evidenceMap: input.applicationPackage.evidenceMap,
    });
    const atoms = buildProfileEvidenceAtoms(input.profile);
    const evidenceAnchored = input.applicationPackage.evidenceMap.every(
      (evidence) =>
        evidence.evidenceSource === "profile" &&
        atoms.some(
          (atom) =>
            atom.ref === evidence.evidenceRef &&
            atom.text === evidence.evidenceText,
        ),
    );
    if (
      !evidenceAnchored ||
      !editorialCoverMatches(
        input.applicationPackage.coverLetter,
        expectedCoverLetter,
      )
    ) {
      blockingIssues.push("cover_letter_not_evidence_bounded");
    }
  }

  if (
    input.applicationPackage.gaps.some((gap) => gap.severity === "hard_gap")
  ) {
    blockingIssues.push("unresolved_hard_requirements");
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
