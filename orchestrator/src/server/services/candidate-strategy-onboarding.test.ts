import type { AppSettings } from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEffectiveSettings: vi.fn(),
  createCandidateStrategyDraft: vi.fn(),
}));

vi.mock("./settings", () => ({
  getEffectiveSettings: mocks.getEffectiveSettings,
}));

vi.mock("@server/repositories/candidate-strategy", () => ({
  createCandidateStrategyDraft: mocks.createCandidateStrategyDraft,
}));

import {
  createCandidateStrategyOnboardingDraft,
  deriveCandidateStrategyOnboardingDraft,
  deriveCandidateStrategyQuestions,
} from "./candidate-strategy-onboarding";

const effectiveAt = "2026-10-04T05:00:00.000Z";

function settings(): AppSettings {
  return {
    jobspyCountryIndeed: { value: "canada" },
    searchTerms: { value: ["legacy role"] },
    searchCities: { value: "Toronto, ON|Calgary, AB" },
    workplaceTypes: { value: ["onsite", "hybrid"] },
    locationSearchMode: { value: "cities" },
    locationRadiusMiles: { value: 50 },
    locationSearchScope: { value: "selected_only" },
    locationMatchStrictness: { value: "flexible" },
    blockedCompanyKeywords: { value: [] },
    scoringInstructions: { value: "preserve legacy scoring context" },
    penalizeMissingSalary: { value: false },
    missingSalaryPenalty: { value: 0 },
    autoSkipScoreThreshold: { value: null },
    showSponsorInfo: { value: true },
  } as unknown as AppSettings;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("candidate strategy onboarding", () => {
  it("asks only for missing decision dimensions", () => {
    expect(
      deriveCandidateStrategyQuestions({}).map((question) => question.id),
    ).toEqual([
      "target_roles",
      "compensation_floor",
      "us_travel",
      "career_priority",
    ]);

    expect(
      deriveCandidateStrategyQuestions({
        targetRoleFamilies: ["field service"],
        compensationFloorCadAnnual: null,
        usTravel: null,
        careerPriority: null,
      }),
    ).toEqual([]);
  });

  it("maps explicit onboarding answers into versioned strategy data without inventing unknowns", () => {
    const draft = deriveCandidateStrategyOnboardingDraft({
      settings: settings(),
      effectiveAt,
      answers: {
        targetRoleFamilies: [
          " Field Service ",
          "Commissioning",
          "Field Service",
        ],
        excludedRoleFamilies: ["door-to-door sales"],
        compensationFloorCadAnnual: 75000,
        usTravel: "avoid",
        careerPriority: "Prefer stable higher income and growth.",
      },
    });

    expect(draft.targetMarkets).toEqual(["canada"]);
    expect(draft.targetRoleFamilies).toEqual([
      "Field Service",
      "Commissioning",
    ]);
    expect(draft.excludedRoleFamilies).toEqual(["door-to-door sales"]);
    expect(draft.freeformNotes).toBe("Prefer stable higher income and growth.");
    expect(draft.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: "search_geography",
          kind: "hard",
        }),
        expect.objectContaining({
          key: "requires_employer_sponsorship",
          kind: "hard",
          value: true,
          source: "candidate",
        }),
        expect.objectContaining({
          key: "minimum_compensation_cad_annual",
          kind: "hard",
          value: 75000,
        }),
        expect.objectContaining({
          key: "us_travel",
          kind: "hard",
          value: false,
        }),
        expect.objectContaining({
          key: "legacy_scoring_instructions",
          kind: "contextual",
          value: "preserve legacy scoring context",
        }),
      ]),
    );
  });

  it("keeps skipped optional answers unknown instead of turning them into hard constraints", () => {
    const draft = deriveCandidateStrategyOnboardingDraft({
      settings: {
        ...settings(),
        showSponsorInfo: { value: false },
      } as AppSettings,
      effectiveAt,
      answers: {
        targetRoleFamilies: ["field service"],
        compensationFloorCadAnnual: null,
        usTravel: null,
        careerPriority: null,
      },
    });

    expect(
      draft.constraints.some(
        (constraint) => constraint.key === "minimum_compensation_cad_annual",
      ),
    ).toBe(false);
    expect(
      draft.constraints.some((constraint) => constraint.key === "us_travel"),
    ).toBe(false);
    expect(
      draft.constraints.some(
        (constraint) => constraint.key === "requires_employer_sponsorship",
      ),
    ).toBe(false);
  });

  it("creates a draft only and leaves activation for explicit confirmation", async () => {
    const appSettings = settings();
    mocks.getEffectiveSettings.mockResolvedValueOnce(appSettings);
    mocks.createCandidateStrategyDraft.mockImplementationOnce(
      async (input) => ({
        id: "strategy-draft-1",
        version: 1,
        status: "draft",
        createdAt: effectiveAt,
        activatedAt: null,
        ...input,
      }),
    );

    const result = await createCandidateStrategyOnboardingDraft({
      targetRoleFamilies: ["field service"],
      compensationFloorCadAnnual: null,
      usTravel: null,
      careerPriority: "income first",
    });

    expect(result.status).toBe("draft");
    expect(mocks.createCandidateStrategyDraft).toHaveBeenCalledTimes(1);
    expect(mocks.createCandidateStrategyDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        targetRoleFamilies: ["field service"],
        freeformNotes: "income first",
      }),
    );
  });
});
