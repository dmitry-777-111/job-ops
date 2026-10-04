import { matchJobLocationIntent } from "@shared/job-matching";
import { createLocationIntentFromLegacyInputs } from "@shared/location-domain";
import type {
  CandidateConstraint,
  CandidateStrategyProfile,
  JobVerifiedFact,
  PrefilterDisposition,
} from "@shared/types";

export const SAFE_PREFILTER_RULE_VERSION = "freeze3-shadow-v1";

type PrefilterJob = {
  location?: string | null;
  locationEvidence?: {
    location?: string | null;
    country?: string | null;
    city?: string | null;
    workplaceType?: "remote" | "hybrid" | "onsite" | null;
  } | null;
  isRemote?: boolean | null;
};

export type SafePrefilterDecision = {
  disposition: PrefilterDisposition;
  hardGateOutcome: "pass" | "fail" | "unknown";
  ruleVersion: string;
  reason: string;
  evidence: string[];
};

function isConstraintEffective(
  constraint: CandidateConstraint,
  at: string,
): boolean {
  if (constraint.effectiveAt && constraint.effectiveAt > at) return false;
  if (constraint.expiresAt && constraint.expiresAt <= at) return false;
  return true;
}

function getEffectiveHardConstraint(
  strategy: CandidateStrategyProfile,
  key: string,
  at: string,
): CandidateConstraint | undefined {
  return strategy.constraints.find(
    (constraint) =>
      constraint.kind === "hard" &&
      constraint.key === key &&
      isConstraintEffective(constraint, at),
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function hasAnyLocationEvidence(job: PrefilterJob): boolean {
  return Boolean(
    job.location?.trim() ||
      job.locationEvidence?.location?.trim() ||
      job.locationEvidence?.country?.trim() ||
      job.locationEvidence?.city?.trim(),
  );
}

function evaluateHardGeography(
  job: PrefilterJob,
  strategy: CandidateStrategyProfile,
  at: string,
): SafePrefilterDecision | null {
  const constraint = getEffectiveHardConstraint(
    strategy,
    "search_geography",
    at,
  );
  if (!constraint) return null;

  if (!hasAnyLocationEvidence(job)) {
    return {
      disposition: "uncertain_to_ai",
      hardGateOutcome: "unknown",
      ruleVersion: SAFE_PREFILTER_RULE_VERSION,
      reason: "Hard geography exists but job location evidence is missing.",
      evidence: [constraint.id],
    };
  }

  const value = asRecord(constraint.value);
  const country = typeof value.country === "string" ? value.country : null;
  const cities = asStringArray(value.cities);
  const workplaceTypes = asStringArray(value.workplaceTypes);
  const searchScope = typeof value.scope === "string" ? value.scope : null;
  const matchStrictness =
    typeof value.matchStrictness === "string" ? value.matchStrictness : null;

  const intent = createLocationIntentFromLegacyInputs({
    selectedCountry: country,
    cityLocations: cities,
    workplaceTypes,
    searchScope,
    matchStrictness,
  });
  const match = matchJobLocationIntent(job, intent);
  if (!match.matched) {
    // A free-form location can be incomplete or multi-location (for example,
    // several Canadian provinces without the country token). That is not
    // strong enough evidence for an irreversible reject. Only a structured
    // explicit country mismatch may become SAFE_REJECT.
    const explicitCountry = job.locationEvidence?.country?.trim() ?? "";
    if (!explicitCountry || !country) {
      return {
        disposition: "uncertain_to_ai",
        hardGateOutcome: "unknown",
        ruleVersion: SAFE_PREFILTER_RULE_VERSION,
        reason:
          "Location does not match the hard geography, but country evidence is not explicit enough for safe rejection.",
        evidence: [constraint.id, match.reasonCode],
      };
    }

    const explicitCountryIntent = createLocationIntentFromLegacyInputs({
      selectedCountry: country,
      searchScope: searchScope,
      matchStrictness,
    });
    const explicitCountryMatch = matchJobLocationIntent(
      { location: explicitCountry },
      explicitCountryIntent,
    );
    if (!explicitCountryMatch.matched) {
      return {
        disposition: "safe_reject",
        hardGateOutcome: "fail",
        ruleVersion: SAFE_PREFILTER_RULE_VERSION,
        reason:
          "Explicit structured country evidence conflicts with hard geography.",
        evidence: [constraint.id, `country:${explicitCountry}`],
      };
    }

    return {
      disposition: "uncertain_to_ai",
      hardGateOutcome: "unknown",
      ruleVersion: SAFE_PREFILTER_RULE_VERSION,
      reason:
        "Structured country matches, but the remaining location evidence is ambiguous.",
      evidence: [constraint.id, match.reasonCode],
    };
  }
  return null;
}

function hasVerifiedFact(
  facts: JobVerifiedFact[],
  factKey: JobVerifiedFact["factKey"],
): boolean {
  return facts.some((fact) => fact.factKey === factKey);
}

function evaluateVerifiedHardFacts(
  strategy: CandidateStrategyProfile,
  facts: JobVerifiedFact[],
  at: string,
): SafePrefilterDecision | null {
  const sponsorship = getEffectiveHardConstraint(
    strategy,
    "requires_employer_sponsorship",
    at,
  );
  if (sponsorship?.value === true && hasVerifiedFact(facts, "no_sponsorship")) {
    return {
      disposition: "safe_reject",
      hardGateOutcome: "fail",
      ruleVersion: SAFE_PREFILTER_RULE_VERSION,
      reason:
        "Verified vacancy evidence says no sponsorship while the candidate has a hard sponsorship requirement.",
      evidence: [sponsorship.id, "verified:no_sponsorship"],
    };
  }

  const usAuthorization = getEffectiveHardConstraint(
    strategy,
    "us_authorization",
    at,
  );
  if (
    usAuthorization?.value === false &&
    hasVerifiedFact(facts, "us_authorization_required")
  ) {
    return {
      disposition: "safe_reject",
      hardGateOutcome: "fail",
      ruleVersion: SAFE_PREFILTER_RULE_VERSION,
      reason:
        "Verified vacancy evidence requires US work authorization while the candidate has a hard no-US-authorization constraint.",
      evidence: [usAuthorization.id, "verified:us_authorization_required"],
    };
  }

  return null;
}

export function evaluateSafePrefilter(input: {
  job: PrefilterJob;
  strategy: CandidateStrategyProfile;
  verifiedFacts?: JobVerifiedFact[];
  evidenceSignals?: string[];
  evaluatedAt?: string;
}): SafePrefilterDecision {
  const evaluatedAt = input.evaluatedAt ?? new Date().toISOString();
  const verifiedFacts = input.verifiedFacts ?? [];

  const geography = evaluateHardGeography(
    input.job,
    input.strategy,
    evaluatedAt,
  );
  if (geography) return geography;

  const verifiedHardFact = evaluateVerifiedHardFacts(
    input.strategy,
    verifiedFacts,
    evaluatedAt,
  );
  if (verifiedHardFact) return verifiedHardFact;

  const rejectSignals = getEffectiveHardConstraint(
    input.strategy,
    "reject_evidence_signals",
    evaluatedAt,
  );
  const configuredSignals = asStringArray(rejectSignals?.value);
  const matchedSignal = (input.evidenceSignals ?? []).find((signal) =>
    configuredSignals.includes(signal),
  );
  if (rejectSignals && matchedSignal) {
    return {
      disposition: "safe_reject",
      hardGateOutcome: "fail",
      ruleVersion: SAFE_PREFILTER_RULE_VERSION,
      reason:
        "Explicit market evidence matches a candidate hard-reject signal.",
      evidence: [rejectSignals.id, `signal:${matchedSignal}`],
    };
  }

  return {
    disposition: "pass_to_ai",
    hardGateOutcome: "pass",
    ruleVersion: SAFE_PREFILTER_RULE_VERSION,
    reason: "No evidence-backed hard rejection rule fired.",
    evidence: [],
  };
}

export function summarizeSafePrefilterShadow(
  decisions: SafePrefilterDecision[],
): {
  total: number;
  passToAi: number;
  uncertainToAi: number;
  safeReject: number;
  estimatedAiCallsAvoided: number;
  estimatedSavingsRate: number;
} {
  const passToAi = decisions.filter(
    (decision) => decision.disposition === "pass_to_ai",
  ).length;
  const uncertainToAi = decisions.filter(
    (decision) => decision.disposition === "uncertain_to_ai",
  ).length;
  const safeReject = decisions.filter(
    (decision) => decision.disposition === "safe_reject",
  ).length;
  const total = decisions.length;
  return {
    total,
    passToAi,
    uncertainToAi,
    safeReject,
    estimatedAiCallsAvoided: safeReject,
    estimatedSavingsRate: total === 0 ? 0 : safeReject / total,
  };
}
