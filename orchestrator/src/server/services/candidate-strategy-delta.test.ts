import type { CandidateStrategyProfile } from "@shared/types";
import { describe, expect, it } from "vitest";
import { deriveCandidateStrategyDelta } from "./candidate-strategy-delta";

function strategy(
  overrides: Partial<CandidateStrategyProfile> = {},
): CandidateStrategyProfile {
  return {
    id: "strategy-1",
    version: 1,
    status: "active",
    targetMarkets: ["canada"],
    targetRoleFamilies: ["field_service"],
    excludedRoleFamilies: [],
    constraints: [],
    freeformNotes: null,
    createdAt: "2026-10-03T20:00:00.000Z",
    activatedAt: "2026-10-03T20:00:00.000Z",
    ...overrides,
  };
}

describe("deriveCandidateStrategyDelta", () => {
  it("reports only actual structured changes", () => {
    const before = strategy({
      constraints: [
        {
          id: "geo",
          key: "geography",
          kind: "hard",
          value: ["Ontario"],
          source: "candidate",
          confidence: 1,
          effectiveAt: "2026-10-03T20:00:00.000Z",
        },
      ],
    });
    const after = strategy({
      id: "strategy-2",
      version: 2,
      status: "draft",
      targetMarkets: ["canada", "usa"],
      constraints: [
        {
          ...before.constraints[0],
          value: ["Ontario", "Alberta"],
        },
      ],
    });

    const delta = deriveCandidateStrategyDelta(before, after);
    expect(delta.previousVersion).toBe(1);
    expect(delta.nextVersion).toBe(2);
    expect(delta.changed).toHaveLength(1);
    expect(delta.added).toHaveLength(0);
    expect(delta.removedConstraintIds).toEqual([]);
    expect(delta.likelySearchImpact).toEqual(
      expect.arrayContaining(["target_markets_changed", "constraints_changed"]),
    );
  });

  it("uses null previousVersion for first strategy", () => {
    const delta = deriveCandidateStrategyDelta(null, strategy());
    expect(delta.previousVersion).toBeNull();
    expect(delta.nextVersion).toBe(1);
  });
});
