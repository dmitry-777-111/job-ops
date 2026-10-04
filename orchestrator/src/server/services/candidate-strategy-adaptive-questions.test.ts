import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  callJson: vi.fn(),
  getActiveMasterCareerProfile: vi.fn(),
  resolveLlmRuntimeSettings: vi.fn(),
}));

vi.mock("@server/repositories/candidate-profile", () => ({
  getActiveMasterCareerProfile: mocks.getActiveMasterCareerProfile,
}));

vi.mock("./modelSelection", () => ({
  resolveLlmRuntimeSettings: mocks.resolveLlmRuntimeSettings,
}));

vi.mock("./llm/service", () => ({
  LlmService: class {
    callJson = mocks.callJson;
  },
}));

import {
  generateCandidateStrategyAdaptiveQuestions,
  mergeAdaptiveCandidateStrategyQuestions,
} from "./candidate-strategy-adaptive-questions";
import { deriveCandidateStrategyQuestions } from "./candidate-strategy-onboarding";

describe("candidate strategy adaptive questions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveLlmRuntimeSettings.mockResolvedValue({
      model: "test-model",
      provider: "openrouter",
      baseUrl: "https://example.test",
      apiKey: "test-key",
      allowEnvironmentCredentials: false,
      allowCliProviders: false,
    });
    mocks.getActiveMasterCareerProfile.mockResolvedValue({
      id: "profile-v1",
      version: 1,
      status: "active",
      profile: {
        basics: { name: "Candidate", label: "Field Service Technician" },
      },
      source: "manual",
      sourceRef: null,
      provenance: null,
      createdAt: "2026-10-04T00:00:00.000Z",
      activatedAt: "2026-10-04T00:00:00.000Z",
      supersededAt: null,
    });
  });

  it("preserves required/optional semantics while adapting wording", () => {
    const fallback = deriveCandidateStrategyQuestions({});
    const merged = mergeAdaptiveCandidateStrategyQuestions(fallback, {
      questions: [
        {
          id: "target_roles",
          prompt: "Which field-service or adjacent roles are you targeting?",
          reason: "Your profile shows field-service experience.",
        },
        {
          id: "unknown_id",
          prompt: "Should be ignored?",
          reason: "Unknown IDs are not permitted.",
        },
      ],
    });

    expect(merged).toHaveLength(fallback.length);
    expect(merged[0]).toMatchObject({
      id: "target_roles",
      required: true,
      prompt: "Which field-service or adjacent roles are you targeting?",
    });
    expect(merged.map((question) => question.id)).toEqual(
      fallback.map((question) => question.id),
    );
  });

  it("uses AI wording when a configured model returns valid questions", async () => {
    mocks.callJson.mockResolvedValue({
      success: true,
      data: {
        questions: [
          {
            id: "career_priority",
            prompt: "What should your next move improve most?",
            reason: "This keeps qualitative career trade-offs explicit.",
          },
        ],
      },
    });

    const result = await generateCandidateStrategyAdaptiveQuestions({
      targetRoleFamilies: ["Field Service Engineer"],
      compensationFloorCadAnnual: null,
      usTravel: null,
    });

    expect(result.source).toBe("ai");
    expect(result.questions).toEqual([
      expect.objectContaining({
        id: "career_priority",
        required: false,
        prompt: "What should your next move improve most?",
      }),
    ]);
  });

  it("falls back deterministically when the model is unavailable", async () => {
    mocks.callJson.mockResolvedValue({
      success: false,
      error: "provider unavailable",
    });

    const answers = {
      targetRoleFamilies: ["Commissioning"],
      compensationFloorCadAnnual: null,
      usTravel: null,
    };
    const result = await generateCandidateStrategyAdaptiveQuestions(answers);

    expect(result).toEqual({
      questions: deriveCandidateStrategyQuestions(answers),
      source: "deterministic",
    });
  });

  it("does not call AI when no unresolved question remains", async () => {
    const result = await generateCandidateStrategyAdaptiveQuestions({
      targetRoleFamilies: ["Commissioning"],
      compensationFloorCadAnnual: null,
      usTravel: "open",
      careerPriority: null,
    });

    expect(result).toEqual({ questions: [], source: "deterministic" });
    expect(mocks.callJson).not.toHaveBeenCalled();
  });
});
