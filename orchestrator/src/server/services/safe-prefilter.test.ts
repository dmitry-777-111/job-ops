import type { CandidateStrategyProfile, JobVerifiedFact } from "@shared/types";
import { describe, expect, it } from "vitest";
import {
  evaluateSafePrefilter,
  SAFE_PREFILTER_RULE_VERSION,
  summarizeSafePrefilterShadow,
} from "./safe-prefilter";

const at = "2026-10-04T02:00:00.000Z";

function strategy(
  constraints: CandidateStrategyProfile["constraints"] = [],
): CandidateStrategyProfile {
  return {
    id: "strategy-v1",
    version: 1,
    status: "active",
    targetMarkets: ["canada"],
    targetRoleFamilies: ["field service"],
    excludedRoleFamilies: [],
    constraints,
    freeformNotes: null,
    createdAt: at,
    activatedAt: at,
  };
}

function verifiedFact(factKey: JobVerifiedFact["factKey"]): JobVerifiedFact {
  return {
    id: `fact-${factKey}`,
    jobId: "job-1",
    factKey,
    evidence: {
      kind: factKey,
      sourceType: "manual_verified",
      verifiedBy: "user",
      note: "verified evidence",
    },
    createdAt: at,
    updatedAt: at,
  };
}

describe("safe prefilter shadow rules", () => {
  it("safe-rejects only an explicit hard geography mismatch", () => {
    const result = evaluateSafePrefilter({
      job: {
        location: "New York, NY, United States",
        locationEvidence: { country: "United States" },
      },
      strategy: strategy([
        {
          id: "geo",
          key: "search_geography",
          kind: "hard",
          value: {
            country: "canada",
            cities: ["Toronto, ON", "Calgary, AB"],
            workplaceTypes: ["onsite"],
            scope: "selected_only",
            matchStrictness: "flexible",
          },
          source: "candidate",
          confidence: 1,
          effectiveAt: "2026-10-01T00:00:00.000Z",
        },
      ]),
      evaluatedAt: at,
    });

    expect(result).toEqual(
      expect.objectContaining({
        disposition: "safe_reject",
        hardGateOutcome: "fail",
        ruleVersion: SAFE_PREFILTER_RULE_VERSION,
      }),
    );
  });

  it("does not safe-reject ambiguous multi-location text without explicit country evidence", () => {
    const result = evaluateSafePrefilter({
      job: { location: "Surrey, BC/Saskatoon, SK/Lively, ON" },
      strategy: strategy([
        {
          id: "geo",
          key: "search_geography",
          kind: "hard",
          value: {
            country: "canada",
            cities: ["Toronto, ON", "Calgary, AB"],
            workplaceTypes: ["onsite"],
            scope: "selected_only",
            matchStrictness: "flexible",
          },
          source: "candidate",
          confidence: 1,
          effectiveAt: "2026-10-01T00:00:00.000Z",
        },
      ]),
      evaluatedAt: at,
    });

    expect(result.disposition).toBe("uncertain_to_ai");
    expect(result.hardGateOutcome).toBe("unknown");
  });

  it("routes missing hard-geography evidence to AI instead of rejecting", () => {
    const result = evaluateSafePrefilter({
      job: { location: null },
      strategy: strategy([
        {
          id: "geo",
          key: "search_geography",
          kind: "hard",
          value: { country: "canada", scope: "selected_only" },
          source: "candidate",
          confidence: 1,
          effectiveAt: "2026-10-01T00:00:00.000Z",
        },
      ]),
      evaluatedAt: at,
    });

    expect(result.disposition).toBe("uncertain_to_ai");
    expect(result.hardGateOutcome).toBe("unknown");
  });

  it("safe-rejects a verified no-sponsorship conflict", () => {
    const result = evaluateSafePrefilter({
      job: { location: "Toronto, Ontario, Canada" },
      strategy: strategy([
        {
          id: "sponsorship",
          key: "requires_employer_sponsorship",
          kind: "hard",
          value: true,
          source: "candidate",
          confidence: 1,
          effectiveAt: "2026-10-01T00:00:00.000Z",
        },
      ]),
      verifiedFacts: [verifiedFact("no_sponsorship")],
      evaluatedAt: at,
    });

    expect(result.disposition).toBe("safe_reject");
    expect(result.evidence).toContain("verified:no_sponsorship");
  });

  it("safe-rejects only configured market evidence signals", () => {
    const hardSignalStrategy = strategy([
      {
        id: "eligibility",
        key: "reject_evidence_signals",
        kind: "hard",
        value: ["canada.citizenship_required"],
        source: "candidate",
        confidence: 1,
        effectiveAt: "2026-10-01T00:00:00.000Z",
      },
    ]);

    const rejected = evaluateSafePrefilter({
      job: { location: "Ottawa, Ontario, Canada" },
      strategy: hardSignalStrategy,
      evidenceSignals: ["canada.citizenship_required"],
      evaluatedAt: at,
    });
    const notConfigured = evaluateSafePrefilter({
      job: { location: "Ottawa, Ontario, Canada" },
      strategy: hardSignalStrategy,
      evidenceSignals: ["canada.passport_required"],
      evaluatedAt: at,
    });

    expect(rejected.disposition).toBe("safe_reject");
    expect(notConfigured.disposition).toBe("pass_to_ai");
  });

  it("does not convert missing sponsorship evidence into a failure", () => {
    const result = evaluateSafePrefilter({
      job: { location: "Toronto, Ontario, Canada" },
      strategy: strategy([
        {
          id: "sponsorship",
          key: "requires_employer_sponsorship",
          kind: "hard",
          value: true,
          source: "candidate",
          confidence: 1,
          effectiveAt: "2026-10-01T00:00:00.000Z",
        },
      ]),
      evaluatedAt: at,
    });

    expect(result.disposition).toBe("pass_to_ai");
  });

  it("ignores expired hard constraints", () => {
    const result = evaluateSafePrefilter({
      job: { location: "New York, NY, United States" },
      strategy: strategy([
        {
          id: "geo-old",
          key: "search_geography",
          kind: "hard",
          value: { country: "canada", scope: "selected_only" },
          source: "candidate",
          confidence: 1,
          effectiveAt: "2026-09-01T00:00:00.000Z",
          expiresAt: "2026-10-03T00:00:00.000Z",
        },
      ]),
      evaluatedAt: at,
    });

    expect(result.disposition).toBe("pass_to_ai");
  });

  it("summarizes shadow savings without changing decisions", () => {
    const summary = summarizeSafePrefilterShadow([
      {
        disposition: "pass_to_ai",
        hardGateOutcome: "pass",
        ruleVersion: SAFE_PREFILTER_RULE_VERSION,
        reason: "pass",
        evidence: [],
      },
      {
        disposition: "uncertain_to_ai",
        hardGateOutcome: "unknown",
        ruleVersion: SAFE_PREFILTER_RULE_VERSION,
        reason: "unknown",
        evidence: [],
      },
      {
        disposition: "safe_reject",
        hardGateOutcome: "fail",
        ruleVersion: SAFE_PREFILTER_RULE_VERSION,
        reason: "reject",
        evidence: [],
      },
    ]);

    expect(summary).toEqual({
      total: 3,
      passToAi: 1,
      uncertainToAi: 1,
      safeReject: 1,
      estimatedAiCallsAvoided: 1,
      estimatedSavingsRate: 1 / 3,
    });
  });
});
