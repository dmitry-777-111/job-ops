import {
  activateCandidateStrategyVersion,
  createCandidateStrategyDraft,
  getActiveCandidateStrategy,
} from "@server/repositories/candidate-strategy";
import type { AppSettings, CandidateConstraint } from "@shared/types";
import { getEffectiveSettings } from "./settings";

export type LegacyCandidateStrategySnapshot = {
  country: string;
  searchTerms: string[];
  searchCities: string;
  workplaceTypes: Array<"remote" | "hybrid" | "onsite">;
  locationSearchMode: string;
  locationRadiusMiles: number;
  locationSearchScope: string;
  locationMatchStrictness: string;
  blockedCompanyKeywords: string[];
  scoringInstructions: string;
  penalizeMissingSalary: boolean;
  missingSalaryPenalty: number;
  autoSkipScoreThreshold: number | null;
};

export function snapshotLegacyCandidateStrategySettings(
  settings: AppSettings,
): LegacyCandidateStrategySnapshot {
  return {
    country: settings.jobspyCountryIndeed.value,
    searchTerms: settings.searchTerms.value,
    searchCities: settings.searchCities.value,
    workplaceTypes: settings.workplaceTypes.value,
    locationSearchMode: settings.locationSearchMode.value,
    locationRadiusMiles: settings.locationRadiusMiles.value,
    locationSearchScope: settings.locationSearchScope.value,
    locationMatchStrictness: settings.locationMatchStrictness.value,
    blockedCompanyKeywords: settings.blockedCompanyKeywords.value,
    scoringInstructions: settings.scoringInstructions.value,
    penalizeMissingSalary: settings.penalizeMissingSalary.value,
    missingSalaryPenalty: settings.missingSalaryPenalty.value,
    autoSkipScoreThreshold: settings.autoSkipScoreThreshold.value,
  };
}

function uniqueNonEmpty(values: string[]): string[] {
  return Array.from(
    new Set(
      values.map((value) => value.trim()).filter((value) => value.length > 0),
    ),
  );
}

export type CandidateStrategyBehaviorProjection = {
  country: string | null;
  searchTerms: string[];
  cities: string[];
  workplaceTypes: string[];
  locationSearchMode: string | null;
  locationRadiusMiles: number | null;
  locationSearchScope: string | null;
  locationMatchStrictness: string | null;
  blockedCompanyKeywords: string[];
  scoringInstructions: string;
  penalizeMissingSalary: boolean;
  missingSalaryPenalty: number | null;
  autoSkipScoreThreshold: number | null;
};

function constraintById(
  constraints: CandidateConstraint[],
  id: string,
): CandidateConstraint | undefined {
  return constraints.find((constraint) => constraint.id === id);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function projectLegacyCandidateStrategyBehavior(
  snapshot: LegacyCandidateStrategySnapshot,
): CandidateStrategyBehaviorProjection {
  return {
    country: snapshot.country.trim().toLowerCase() || null,
    searchTerms: uniqueNonEmpty(snapshot.searchTerms),
    cities: uniqueNonEmpty(snapshot.searchCities.split("|")),
    workplaceTypes: [...snapshot.workplaceTypes],
    locationSearchMode: snapshot.locationSearchMode,
    locationRadiusMiles: snapshot.locationRadiusMiles,
    locationSearchScope: snapshot.locationSearchScope,
    locationMatchStrictness: snapshot.locationMatchStrictness,
    blockedCompanyKeywords: uniqueNonEmpty(snapshot.blockedCompanyKeywords),
    scoringInstructions: snapshot.scoringInstructions.trim(),
    penalizeMissingSalary: snapshot.penalizeMissingSalary,
    missingSalaryPenalty: snapshot.penalizeMissingSalary
      ? snapshot.missingSalaryPenalty
      : null,
    autoSkipScoreThreshold: snapshot.autoSkipScoreThreshold,
  };
}

export function projectMigratedCandidateStrategyBehavior(input: {
  targetMarkets: string[];
  targetRoleFamilies: string[];
  constraints: CandidateConstraint[];
  freeformNotes: string | null;
}): CandidateStrategyBehaviorProjection {
  const geography = objectValue(
    constraintById(input.constraints, "legacy-search-geography")?.value,
  );
  const blocked = constraintById(
    input.constraints,
    "legacy-blocked-company-keywords",
  );
  const salaryPenalty = constraintById(
    input.constraints,
    "legacy-missing-salary-penalty",
  );
  const autoSkip = constraintById(
    input.constraints,
    "legacy-auto-skip-score-threshold",
  );
  const scoring = constraintById(
    input.constraints,
    "legacy-scoring-instructions",
  );

  return {
    country:
      typeof geography.country === "string"
        ? geography.country
        : (input.targetMarkets[0] ?? null),
    searchTerms: [...input.targetRoleFamilies],
    cities: stringArray(geography.cities),
    workplaceTypes: stringArray(geography.workplaceTypes),
    locationSearchMode:
      typeof geography.mode === "string" ? geography.mode : null,
    locationRadiusMiles:
      typeof geography.radiusMiles === "number" ? geography.radiusMiles : null,
    locationSearchScope:
      typeof geography.scope === "string" ? geography.scope : null,
    locationMatchStrictness:
      typeof geography.matchStrictness === "string"
        ? geography.matchStrictness
        : null,
    blockedCompanyKeywords: stringArray(blocked?.value),
    scoringInstructions:
      typeof scoring?.value === "string"
        ? scoring.value
        : (input.freeformNotes?.trim() ?? ""),
    penalizeMissingSalary: Boolean(salaryPenalty),
    missingSalaryPenalty:
      typeof salaryPenalty?.value === "number" ? salaryPenalty.value : null,
    autoSkipScoreThreshold:
      typeof autoSkip?.value === "number" ? autoSkip.value : null,
  };
}

export function deriveLegacyCandidateStrategyDraft(
  snapshot: LegacyCandidateStrategySnapshot,
  effectiveAt: string,
): {
  targetMarkets: string[];
  targetRoleFamilies: string[];
  excludedRoleFamilies: string[];
  constraints: CandidateConstraint[];
  freeformNotes: string | null;
} {
  const country = snapshot.country.trim().toLowerCase();
  const cities = uniqueNonEmpty(snapshot.searchCities.split("|"));
  const targetRoleFamilies = uniqueNonEmpty(snapshot.searchTerms);
  const constraints: CandidateConstraint[] = [];

  if (country || cities.length > 0) {
    constraints.push({
      id: "legacy-search-geography",
      key: "search_geography",
      kind:
        snapshot.locationSearchScope === "selected_only"
          ? "hard"
          : "contextual",
      value: {
        country: country || null,
        cities,
        workplaceTypes: snapshot.workplaceTypes,
        mode: snapshot.locationSearchMode,
        radiusMiles: snapshot.locationRadiusMiles,
        scope: snapshot.locationSearchScope,
        matchStrictness: snapshot.locationMatchStrictness,
      },
      source: "derived",
      confidence: 1,
      explanation:
        "Migrated from the active legacy discovery geography settings.",
      effectiveAt,
      recheckTrigger: "legacy_settings_change",
    });
  }

  const blockedCompanyKeywords = uniqueNonEmpty(
    snapshot.blockedCompanyKeywords,
  );
  if (blockedCompanyKeywords.length > 0) {
    constraints.push({
      id: "legacy-blocked-company-keywords",
      key: "blocked_company_keywords",
      kind: "hard",
      value: blockedCompanyKeywords,
      source: "derived",
      confidence: 1,
      explanation: "Migrated from the active legacy company exclusion filter.",
      effectiveAt,
      recheckTrigger: "legacy_settings_change",
    });
  }

  if (snapshot.penalizeMissingSalary) {
    constraints.push({
      id: "legacy-missing-salary-penalty",
      key: "missing_salary_penalty",
      kind: "soft",
      value: snapshot.missingSalaryPenalty,
      source: "derived",
      confidence: 1,
      explanation: "Migrated from the active legacy scoring penalty.",
      effectiveAt,
      recheckTrigger: "legacy_settings_change",
    });
  }

  if (snapshot.autoSkipScoreThreshold !== null) {
    constraints.push({
      id: "legacy-auto-skip-score-threshold",
      key: "auto_skip_score_threshold",
      kind: "hard",
      value: snapshot.autoSkipScoreThreshold,
      source: "derived",
      confidence: 1,
      explanation: "Migrated from the active legacy automatic score threshold.",
      effectiveAt,
      recheckTrigger: "legacy_settings_change",
    });
  }

  const scoringInstructions = snapshot.scoringInstructions.trim();
  if (scoringInstructions) {
    constraints.push({
      id: "legacy-scoring-instructions",
      key: "legacy_scoring_instructions",
      kind: "contextual",
      value: scoringInstructions,
      source: "derived",
      confidence: 1,
      explanation:
        "Preserved verbatim during Freeze 3 migration so current scoring behavior is not silently reinterpreted.",
      effectiveAt,
      recheckTrigger: "strategy_review",
    });
  }

  return {
    targetMarkets: country ? [country] : [],
    targetRoleFamilies,
    excludedRoleFamilies: [],
    constraints,
    freeformNotes: scoringInstructions || null,
  };
}

export async function bootstrapCurrentCandidateStrategy(): Promise<{
  strategy: Awaited<ReturnType<typeof getActiveCandidateStrategy>>;
  created: boolean;
}> {
  const active = await getActiveCandidateStrategy();
  if (active) return { strategy: active, created: false };

  const settings = await getEffectiveSettings();
  const effectiveAt = new Date().toISOString();
  const draftInput = deriveLegacyCandidateStrategyDraft(
    snapshotLegacyCandidateStrategySettings(settings),
    effectiveAt,
  );
  const draft = await createCandidateStrategyDraft(draftInput);
  const activated = await activateCandidateStrategyVersion(draft.id);
  if (!activated) {
    throw new Error("Failed to activate bootstrapped candidate strategy.");
  }
  return { strategy: activated, created: true };
}
