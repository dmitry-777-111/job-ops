import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  CANADA_HARD_REQUIREMENT_SIGNALS,
  extractCanadaHardRequirementSignals,
} from "@server/markets/canada-hard-requirements";
import type { CandidateStrategyProfile } from "@shared/types";
import { describe, expect, it } from "vitest";
import {
  evaluateSafePrefilter,
  summarizeSafePrefilterShadow,
} from "./safe-prefilter";

const at = "2026-10-04T02:00:00.000Z";
const R0_TOTAL = 1274;

type CandidateRow = {
  id: string;
  title: string;
  employer: string;
  job_description: string;
  suitability_score: number | null;
  status: string;
};

async function loadCandidates(): Promise<CandidateRow[]> {
  const path = resolve(
    process.cwd(),
    "../docs/career-os/evidence/R0_CANADA_HARD_REQUIREMENT_CANDIDATES.json",
  );
  const raw = JSON.parse(await readFile(path, "utf8")) as {
    r0_total: number;
    items: CandidateRow[];
  };
  expect(raw.r0_total).toBe(R0_TOTAL);
  return raw.items;
}

function shadowStrategy(): CandidateStrategyProfile {
  return {
    id: "strategy-f3-3-shadow",
    version: 1,
    status: "active",
    targetMarkets: ["canada"],
    targetRoleFamilies: [],
    excludedRoleFamilies: [],
    constraints: [
      {
        id: "current-eligibility-hard-rejects",
        key: "reject_evidence_signals",
        kind: "hard",
        value: Object.values(CANADA_HARD_REQUIREMENT_SIGNALS),
        source: "candidate",
        confidence: 1,
        explanation:
          "Shadow-only typed representation of explicit current eligibility exclusions.",
        effectiveAt: at,
        recheckTrigger: "candidate_strategy_change",
      },
    ],
    freeformNotes: null,
    createdAt: at,
    activatedAt: at,
  };
}

describe("F3-3 Canada hard-requirement shadow on R0", () => {
  it("produces measurable savings with no selected or score>=50 false reject", async () => {
    const rows = await loadCandidates();
    expect(rows).toHaveLength(25);

    const strategy = shadowStrategy();
    const evaluated = rows.map((row) => ({
      row,
      signals: extractCanadaHardRequirementSignals(row.job_description),
      decision: evaluateSafePrefilter({
        job: {},
        strategy,
        evidenceSignals: extractCanadaHardRequirementSignals(
          row.job_description,
        ),
        evaluatedAt: at,
      }),
    }));
    const rejected = evaluated.filter(
      ({ decision }) => decision.disposition === "safe_reject",
    );

    expect(rejected).toHaveLength(10);
    expect(rejected.filter(({ row }) => row.status === "ready")).toEqual([]);
    expect(
      rejected.filter(({ row }) => (row.suitability_score ?? 0) >= 50),
    ).toEqual([]);

    const fullShadowSummary = summarizeSafePrefilterShadow([
      ...rejected.map(({ decision }) => decision),
      ...Array.from({ length: R0_TOTAL - rejected.length }, () => ({
        disposition: "pass_to_ai" as const,
        hardGateOutcome: "pass" as const,
        ruleVersion: "freeze3-shadow-v1",
        reason: "No hard Canada eligibility signal in broad-candidate audit.",
        evidence: [],
      })),
    ]);

    expect(fullShadowSummary.total).toBe(R0_TOTAL);
    expect(fullShadowSummary.safeReject).toBe(10);
    expect(fullShadowSummary.estimatedSavingsRate).toBeCloseTo(10 / R0_TOTAL);
    console.info(
      `F3-3 Canada hard-evidence summary total=${R0_TOTAL} safeReject=${rejected.length} savingsRate=${fullShadowSummary.estimatedSavingsRate.toFixed(6)} maxRejectedScore=${Math.max(...rejected.map(({ row }) => row.suitability_score ?? -1))}`,
    );
  });
});
