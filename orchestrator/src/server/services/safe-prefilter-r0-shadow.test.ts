import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CandidateStrategyProfile } from "@shared/types";
import { describe, expect, it } from "vitest";
import {
  deriveLegacyCandidateStrategyDraft,
  type LegacyCandidateStrategySnapshot,
} from "./candidate-strategy-bootstrap";
import {
  evaluateSafePrefilter,
  summarizeSafePrefilterShadow,
} from "./safe-prefilter";

const effectiveAt = "2026-10-04T01:00:00.000Z";
const evaluatedAt = "2026-10-04T02:00:00.000Z";

const currentSnapshot: LegacyCandidateStrategySnapshot = {
  country: "canada",
  searchTerms: [
    "field service technician",
    "field service engineer",
    "commissioning technician",
    "electromechanical technician",
    "industrial electrician",
    "industrial maintenance technician",
    "installation technician",
    "technical support specialist",
    "service coordinator",
    "maintenance supervisor",
    "service supervisor",
    "product specialist",
  ],
  searchCities:
    "Toronto, ON|Mississauga, ON|Hamilton, ON|Ottawa, ON|Sudbury, ON|Thunder Bay, ON|Calgary, AB|Edmonton, AB|Red Deer, AB",
  workplaceTypes: ["remote", "hybrid", "onsite"],
  locationSearchMode: "cities",
  locationRadiusMiles: 50,
  locationSearchScope: "selected_only",
  locationMatchStrictness: "flexible",
  blockedCompanyKeywords: [],
  scoringInstructions: "preserved elsewhere",
  penalizeMissingSalary: false,
  missingSalaryPenalty: 0,
  autoSkipScoreThreshold: null,
};

type R0Row = {
  id: string;
  location: string | null;
  suitability_score: number | null;
  status: string;
};

async function loadR0Rows(): Promise<R0Row[]> {
  const path = resolve(
    process.cwd(),
    "../docs/career-os/evidence/R0_PREFILTER_SHADOW.jsonl",
  );
  const raw = await readFile(path, "utf8");
  return raw
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as R0Row);
}

function currentStrategy(): CandidateStrategyProfile {
  const draft = deriveLegacyCandidateStrategyDraft(
    currentSnapshot,
    effectiveAt,
  );
  return {
    id: "strategy-r0-shadow",
    version: 1,
    status: "active",
    ...draft,
    createdAt: effectiveAt,
    activatedAt: effectiveAt,
  };
}

describe("F3-3 safe prefilter R0 shadow", () => {
  it("measures shadow savings without rejecting any known selected R0 job", async () => {
    const rows = await loadR0Rows();
    expect(rows).toHaveLength(1274);

    const strategy = currentStrategy();
    const decisions = rows.map((row) => ({
      row,
      decision: evaluateSafePrefilter({
        job: { location: row.location },
        strategy,
        evaluatedAt,
      }),
    }));
    const summary = summarizeSafePrefilterShadow(
      decisions.map(({ decision }) => decision),
    );

    const selectedRejected = decisions.filter(
      ({ row, decision }) =>
        row.status === "ready" && decision.disposition === "safe_reject",
    );
    expect(selectedRejected).toEqual([]);

    const scoredRejected = decisions.filter(
      ({ row, decision }) =>
        row.suitability_score !== null &&
        decision.disposition === "safe_reject",
    );
    const highValueRejected = scoredRejected.filter(
      ({ row }) => (row.suitability_score ?? 0) >= 50,
    );
    expect(highValueRejected).toEqual([]);

    console.info(
      `F3-3 shadow summary total=${summary.total} safeReject=${summary.safeReject} uncertain=${summary.uncertainToAi} pass=${summary.passToAi} estimatedSavingsRate=${summary.estimatedSavingsRate.toFixed(6)}`,
    );
  });
});
