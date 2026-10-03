import type {
  CandidateConstraint,
  CandidateStrategyDelta,
  CandidateStrategyProfile,
} from "@shared/types";

function byId(
  constraints: CandidateConstraint[],
): Map<string, CandidateConstraint> {
  return new Map(constraints.map((constraint) => [constraint.id, constraint]));
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

function equalConstraint(
  a: CandidateConstraint,
  b: CandidateConstraint,
): boolean {
  return stableJson(a) === stableJson(b);
}

export function deriveCandidateStrategyDelta(
  previous: CandidateStrategyProfile | null,
  next: CandidateStrategyProfile,
): CandidateStrategyDelta {
  const beforeById = byId(previous?.constraints ?? []);
  const afterById = byId(next.constraints);
  const added: CandidateConstraint[] = [];
  const changed: CandidateStrategyDelta["changed"] = [];

  for (const constraint of next.constraints) {
    const before = beforeById.get(constraint.id);
    if (!before) {
      added.push(constraint);
      continue;
    }
    if (!equalConstraint(before, constraint)) {
      changed.push({ constraintId: constraint.id, before, after: constraint });
    }
  }

  const removedConstraintIds = [...beforeById.keys()].filter(
    (id) => !afterById.has(id),
  );

  const likelySearchImpact: string[] = [];
  if (
    stableJson(previous?.targetMarkets ?? []) !== stableJson(next.targetMarkets)
  ) {
    likelySearchImpact.push("target_markets_changed");
  }
  if (
    stableJson(previous?.targetRoleFamilies ?? []) !==
    stableJson(next.targetRoleFamilies)
  ) {
    likelySearchImpact.push("target_roles_changed");
  }
  if (
    stableJson(previous?.excludedRoleFamilies ?? []) !==
    stableJson(next.excludedRoleFamilies)
  ) {
    likelySearchImpact.push("role_exclusions_changed");
  }
  if (added.length || changed.length || removedConstraintIds.length) {
    likelySearchImpact.push("constraints_changed");
  }

  return {
    previousVersion: previous?.version ?? null,
    nextVersion: next.version,
    added,
    removedConstraintIds,
    changed,
    likelySearchImpact,
  };
}
