import {
  createCandidateStrategyDraft,
  getActiveCandidateStrategy,
} from "@server/repositories/candidate-strategy";
import type {
  AppSettings,
  CandidateConstraint,
  CandidateStrategyDelta,
  CandidateStrategyProfile,
} from "@shared/types";
import {
  deriveLegacyCandidateStrategyDraft,
  snapshotLegacyCandidateStrategySettings,
} from "./candidate-strategy-bootstrap";
import { deriveCandidateStrategyDelta } from "./candidate-strategy-delta";
import { getEffectiveSettings } from "./settings";

export type CandidateStrategyQuestionId =
  | "target_roles"
  | "compensation_floor"
  | "us_travel"
  | "career_priority";

export type CandidateStrategyQuestion = {
  id: CandidateStrategyQuestionId;
  prompt: string;
  required: boolean;
  reason: string;
};

export type CandidateStrategyOnboardingAnswers = {
  targetRoleFamilies: string[];
  excludedRoleFamilies?: string[];
  compensationFloorCadAnnual?: number | null;
  usTravel?: "open" | "limited" | "avoid" | null;
  careerPriority?: string | null;
};

function uniqueNonEmpty(values: string[] | undefined): string[] {
  return Array.from(
    new Set(
      (values ?? [])
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  );
}

export function deriveCandidateStrategyQuestions(
  answers: Partial<CandidateStrategyOnboardingAnswers>,
): CandidateStrategyQuestion[] {
  const questions: CandidateStrategyQuestion[] = [];

  if (uniqueNonEmpty(answers.targetRoleFamilies).length === 0) {
    questions.push({
      id: "target_roles",
      prompt: "Which roles or role families should Job Ops prioritize?",
      required: true,
      reason:
        "At least one target role is needed to build a candidate strategy.",
    });
  }
  if (answers.compensationFloorCadAnnual === undefined) {
    questions.push({
      id: "compensation_floor",
      prompt:
        "Do you have a minimum annual compensation floor in CAD? You can leave this unknown.",
      required: false,
      reason:
        "A stated floor can prevent time being spent on clearly underpaid roles.",
    });
  }
  if (answers.usTravel === undefined) {
    questions.push({
      id: "us_travel",
      prompt:
        "How should Job Ops treat roles that require travel to the United States?",
      required: false,
      reason:
        "Travel constraints can materially change which roles are viable.",
    });
  }
  if (answers.careerPriority === undefined) {
    questions.push({
      id: "career_priority",
      prompt:
        "What matters most in your next move? Add any career priority or context Job Ops should keep in mind.",
      required: false,
      reason:
        "Freeform priorities help preserve context that does not belong in a hard filter.",
    });
  }

  return questions;
}

export function deriveCandidateStrategyOnboardingDraft(args: {
  settings: AppSettings;
  answers: CandidateStrategyOnboardingAnswers;
  effectiveAt: string;
}): {
  targetMarkets: string[];
  targetRoleFamilies: string[];
  excludedRoleFamilies: string[];
  constraints: CandidateConstraint[];
  freeformNotes: string | null;
} {
  const legacy = deriveLegacyCandidateStrategyDraft(
    snapshotLegacyCandidateStrategySettings(args.settings),
    args.effectiveAt,
  );
  const targetRoleFamilies = uniqueNonEmpty(args.answers.targetRoleFamilies);
  if (targetRoleFamilies.length === 0) {
    throw new Error("At least one target role family is required.");
  }

  const constraints = [...legacy.constraints];

  if (args.settings.showSponsorInfo.value) {
    constraints.push({
      id: "candidate-requires-employer-sponsorship",
      key: "requires_employer_sponsorship",
      kind: "hard",
      value: true,
      source: "candidate",
      confidence: 1,
      explanation:
        "Candidate explicitly said employer sponsorship is required during onboarding.",
      effectiveAt: args.effectiveAt,
      recheckTrigger: "candidate_work_authorization_change",
    });
  }

  if (
    typeof args.answers.compensationFloorCadAnnual === "number" &&
    Number.isFinite(args.answers.compensationFloorCadAnnual)
  ) {
    constraints.push({
      id: "candidate-compensation-floor-cad-annual",
      key: "minimum_compensation_cad_annual",
      kind: "hard",
      value: args.answers.compensationFloorCadAnnual,
      source: "candidate",
      confidence: 1,
      explanation:
        "Candidate explicitly supplied a minimum annual compensation floor in CAD.",
      effectiveAt: args.effectiveAt,
      recheckTrigger: "candidate_compensation_change",
    });
  }

  if (args.answers.usTravel === "avoid") {
    constraints.push({
      id: "candidate-us-travel",
      key: "us_travel",
      kind: "hard",
      value: false,
      source: "candidate",
      confidence: 1,
      explanation:
        "Candidate explicitly asked to avoid roles that require United States travel.",
      effectiveAt: args.effectiveAt,
      recheckTrigger: "candidate_travel_change",
    });
  } else if (args.answers.usTravel === "limited") {
    constraints.push({
      id: "candidate-us-travel",
      key: "us_travel",
      kind: "soft",
      value: "limited",
      source: "candidate",
      confidence: 1,
      explanation:
        "Candidate said United States travel is possible only on a limited basis.",
      effectiveAt: args.effectiveAt,
      recheckTrigger: "candidate_travel_change",
    });
  }

  return {
    targetMarkets: legacy.targetMarkets,
    targetRoleFamilies,
    excludedRoleFamilies: uniqueNonEmpty(args.answers.excludedRoleFamilies),
    constraints,
    freeformNotes: args.answers.careerPriority?.trim() || null,
  };
}

export async function createCandidateStrategyOnboardingDraft(
  answers: CandidateStrategyOnboardingAnswers,
): Promise<CandidateStrategyProfile> {
  const settings = await getEffectiveSettings();
  return createCandidateStrategyDraft(
    deriveCandidateStrategyOnboardingDraft({
      settings,
      answers,
      effectiveAt: new Date().toISOString(),
    }),
  );
}

export type CandidateStrategyOnboardingPreview = {
  draft: CandidateStrategyProfile;
  delta: CandidateStrategyDelta;
  remainingQuestions: CandidateStrategyQuestion[];
};

export async function createCandidateStrategyOnboardingPreview(
  answers: CandidateStrategyOnboardingAnswers,
): Promise<CandidateStrategyOnboardingPreview> {
  const [active, draft] = await Promise.all([
    getActiveCandidateStrategy(),
    createCandidateStrategyOnboardingDraft(answers),
  ]);

  return {
    draft,
    delta: deriveCandidateStrategyDelta(active, draft),
    remainingQuestions: deriveCandidateStrategyQuestions(answers),
  };
}
