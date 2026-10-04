import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { matchJobLocationIntent } from "@shared/job-matching";
import { createLocationIntentFromLegacyInputs } from "@shared/location-domain";
import { describe, expect, it } from "vitest";
import {
  deriveLegacyCandidateStrategyDraft,
  type LegacyCandidateStrategySnapshot,
  projectMigratedCandidateStrategyBehavior,
} from "./candidate-strategy-bootstrap";

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
  scoringInstructions: "preserved-verbatim-by-separate-equivalence-test",
  penalizeMissingSalary: false,
  missingSalaryPenalty: 0,
  autoSkipScoreThreshold: null,
};

type R0Row = {
  id: string;
  location: string | null;
};

function intentFromLegacySnapshot(snapshot: LegacyCandidateStrategySnapshot) {
  return createLocationIntentFromLegacyInputs({
    selectedCountry: snapshot.country,
    searchCities: snapshot.searchCities,
    workplaceTypes: snapshot.workplaceTypes,
    searchScope: snapshot.locationSearchScope,
    matchStrictness: snapshot.locationMatchStrictness,
  });
}

function intentFromMigratedProjection(
  projection: ReturnType<typeof projectMigratedCandidateStrategyBehavior>,
) {
  return createLocationIntentFromLegacyInputs({
    selectedCountry: projection.country,
    cityLocations: projection.cities,
    workplaceTypes: projection.workplaceTypes,
    searchScope: projection.locationSearchScope,
    matchStrictness: projection.locationMatchStrictness,
  });
}

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

describe("F3-2 current-search behavior equivalence on R0", () => {
  it("keeps current search terms and R0 location decisions unchanged", async () => {
    const draft = deriveLegacyCandidateStrategyDraft(
      currentSnapshot,
      "2026-10-04T01:00:00.000Z",
    );
    const migrated = projectMigratedCandidateStrategyBehavior(draft);

    expect(migrated.searchTerms).toEqual(currentSnapshot.searchTerms);

    const legacyIntent = intentFromLegacySnapshot(currentSnapshot);
    const migratedIntent = intentFromMigratedProjection(migrated);
    expect(migratedIntent).toEqual(legacyIntent);

    const rows = await loadR0Rows();
    expect(rows).toHaveLength(1274);

    const legacyAccepted = rows
      .filter(
        (row) =>
          matchJobLocationIntent({ location: row.location }, legacyIntent)
            .matched,
      )
      .map((row) => row.id)
      .sort();
    const migratedAccepted = rows
      .filter(
        (row) =>
          matchJobLocationIntent({ location: row.location }, migratedIntent)
            .matched,
      )
      .map((row) => row.id)
      .sort();

    expect(migratedAccepted).toEqual(legacyAccepted);
    expect(legacyAccepted.length).toBeGreaterThan(0);
  });
});
