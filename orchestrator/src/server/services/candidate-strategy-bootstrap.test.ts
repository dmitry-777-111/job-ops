import type { AppSettings, CandidateStrategyProfile } from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  bootstrapCurrentCandidateStrategy,
  deriveLegacyCandidateStrategyDraft,
  type LegacyCandidateStrategySnapshot,
  projectLegacyCandidateStrategyBehavior,
  projectMigratedCandidateStrategyBehavior,
} from "./candidate-strategy-bootstrap";

const mocks = vi.hoisted(() => ({
  getActiveCandidateStrategy: vi.fn(),
  createCandidateStrategyDraft: vi.fn(),
  activateCandidateStrategyVersion: vi.fn(),
  getEffectiveSettings: vi.fn(),
}));

vi.mock("@server/repositories/candidate-strategy", () => ({
  getActiveCandidateStrategy: mocks.getActiveCandidateStrategy,
  createCandidateStrategyDraft: mocks.createCandidateStrategyDraft,
  activateCandidateStrategyVersion: mocks.activateCandidateStrategyVersion,
}));

vi.mock("./settings", () => ({
  getEffectiveSettings: mocks.getEffectiveSettings,
}));

const base: LegacyCandidateStrategySnapshot = {
  country: "canada",
  searchTerms: ["field service technician", "commissioning technician"],
  searchCities: "Toronto, ON|Calgary, AB",
  workplaceTypes: ["remote", "hybrid", "onsite"],
  locationSearchMode: "cities",
  locationRadiusMiles: 50,
  locationSearchScope: "selected_only",
  locationMatchStrictness: "flexible",
  blockedCompanyKeywords: [],
  scoringInstructions: "Preserve these current scoring rules exactly.",
  penalizeMissingSalary: false,
  missingSalaryPenalty: 0,
  autoSkipScoreThreshold: null,
};

const effectiveAt = "2026-10-04T01:00:00.000Z";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("legacy candidate strategy bootstrap", () => {
  it("preserves current discovery and scoring behavior without reinterpretation", () => {
    const draft = deriveLegacyCandidateStrategyDraft(base, effectiveAt);

    expect(draft.targetMarkets).toEqual(["canada"]);
    expect(draft.targetRoleFamilies).toEqual([
      "field service technician",
      "commissioning technician",
    ]);
    expect(draft.freeformNotes).toBe(base.scoringInstructions);
    expect(draft.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "legacy-search-geography",
          kind: "hard",
          value: expect.objectContaining({
            country: "canada",
            cities: ["Toronto, ON", "Calgary, AB"],
            scope: "selected_only",
            matchStrictness: "flexible",
          }),
        }),
        expect.objectContaining({
          id: "legacy-scoring-instructions",
          kind: "contextual",
          value: base.scoringInstructions,
        }),
      ]),
    );
  });

  it("migrates legacy hard and soft filters with explicit metadata", () => {
    const draft = deriveLegacyCandidateStrategyDraft(
      {
        ...base,
        blockedCompanyKeywords: ["staffing", "recruit"],
        penalizeMissingSalary: true,
        missingSalaryPenalty: 12,
        autoSkipScoreThreshold: 35,
      },
      effectiveAt,
    );

    expect(draft.constraints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "legacy-blocked-company-keywords",
          kind: "hard",
          value: ["staffing", "recruit"],
          effectiveAt,
          recheckTrigger: "legacy_settings_change",
        }),
        expect.objectContaining({
          id: "legacy-missing-salary-penalty",
          kind: "soft",
          value: 12,
        }),
        expect.objectContaining({
          id: "legacy-auto-skip-score-threshold",
          kind: "hard",
          value: 35,
        }),
      ]),
    );
  });

  it("deduplicates legacy search terms and city values deterministically", () => {
    const draft = deriveLegacyCandidateStrategyDraft(
      {
        ...base,
        searchTerms: ["field service", " field service ", "commissioning"],
        searchCities: "Toronto, ON|Toronto, ON| Calgary, AB ",
      },
      effectiveAt,
    );

    expect(draft.targetRoleFamilies).toEqual([
      "field service",
      "commissioning",
    ]);
    const geography = draft.constraints.find(
      (constraint) => constraint.id === "legacy-search-geography",
    );
    expect(geography?.value).toEqual(
      expect.objectContaining({
        cities: ["Toronto, ON", "Calgary, AB"],
      }),
    );
  });

  it("produces an equivalent behavior projection for migrated legacy settings", () => {
    const snapshot: LegacyCandidateStrategySnapshot = {
      ...base,
      blockedCompanyKeywords: ["staffing"],
      penalizeMissingSalary: true,
      missingSalaryPenalty: 9,
      autoSkipScoreThreshold: 40,
    };
    const draft = deriveLegacyCandidateStrategyDraft(snapshot, effectiveAt);

    expect(projectMigratedCandidateStrategyBehavior(draft)).toEqual(
      projectLegacyCandidateStrategyBehavior(snapshot),
    );
  });

  it("reuses an already active strategy without reading legacy settings", async () => {
    const active: CandidateStrategyProfile = {
      id: "strategy-v1",
      version: 1,
      status: "active",
      targetMarkets: ["canada"],
      targetRoleFamilies: ["field service"],
      excludedRoleFamilies: [],
      constraints: [],
      freeformNotes: null,
      createdAt: effectiveAt,
      activatedAt: effectiveAt,
    };
    mocks.getActiveCandidateStrategy.mockResolvedValueOnce(active);

    const result = await bootstrapCurrentCandidateStrategy();

    expect(result).toEqual({ strategy: active, created: false });
    expect(mocks.getEffectiveSettings).not.toHaveBeenCalled();
    expect(mocks.createCandidateStrategyDraft).not.toHaveBeenCalled();
  });

  it("creates and activates one migrated strategy when none is active", async () => {
    mocks.getActiveCandidateStrategy.mockResolvedValueOnce(null);
    mocks.getEffectiveSettings.mockResolvedValueOnce({
      jobspyCountryIndeed: { value: "canada" },
      searchTerms: { value: ["field service technician"] },
      searchCities: { value: "Toronto, ON|Calgary, AB" },
      workplaceTypes: { value: ["onsite"] },
      locationSearchMode: { value: "cities" },
      locationRadiusMiles: { value: 50 },
      locationSearchScope: { value: "selected_only" },
      locationMatchStrictness: { value: "flexible" },
      blockedCompanyKeywords: { value: [] },
      scoringInstructions: { value: "legacy scoring" },
      penalizeMissingSalary: { value: false },
      missingSalaryPenalty: { value: 0 },
      autoSkipScoreThreshold: { value: null },
    } as unknown as AppSettings);
    const draft: CandidateStrategyProfile = {
      id: "strategy-draft",
      version: 1,
      status: "draft",
      targetMarkets: ["canada"],
      targetRoleFamilies: ["field service technician"],
      excludedRoleFamilies: [],
      constraints: [],
      freeformNotes: "legacy scoring",
      createdAt: effectiveAt,
      activatedAt: null,
    };
    const active = {
      ...draft,
      status: "active" as const,
      activatedAt: effectiveAt,
    };
    mocks.createCandidateStrategyDraft.mockResolvedValueOnce(draft);
    mocks.activateCandidateStrategyVersion.mockResolvedValueOnce(active);

    const result = await bootstrapCurrentCandidateStrategy();

    expect(result).toEqual({ strategy: active, created: true });
    expect(mocks.createCandidateStrategyDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        targetMarkets: ["canada"],
        targetRoleFamilies: ["field service technician"],
        freeformNotes: "legacy scoring",
      }),
    );
    expect(mocks.activateCandidateStrategyVersion).toHaveBeenCalledWith(
      "strategy-draft",
    );
  });
});
