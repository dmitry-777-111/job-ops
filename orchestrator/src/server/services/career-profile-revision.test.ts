import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getActiveMasterCareerProfile: vi.fn(),
  createConfiguredLlmService: vi.fn(),
  resolveLlmModel: vi.fn(),
  callJson: vi.fn(),
}));

vi.mock("@server/repositories/candidate-profile", () => ({
  getActiveMasterCareerProfile: mocks.getActiveMasterCareerProfile,
}));

vi.mock("@server/services/modelSelection", () => ({
  createConfiguredLlmService: mocks.createConfiguredLlmService,
  resolveLlmModel: mocks.resolveLlmModel,
}));

import { suggestCareerProfileRevision } from "./career-profile-revision";

const snapshot = {
  stage: "market_entry" as const,
  confidence: "moderate" as const,
  target: "profile" as const,
  title: "Positioning needs review",
  evidence: "Response rate is low across qualified applications.",
  recommendation: "Test clearer customer-facing positioning.",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createConfiguredLlmService.mockResolvedValue({
    callJson: mocks.callJson,
  });
  mocks.resolveLlmModel.mockResolvedValue("test-model");
});

describe("suggestCareerProfileRevision", () => {
  it("requires an active profile before making an AI call", async () => {
    mocks.getActiveMasterCareerProfile.mockResolvedValue(null);

    await expect(
      suggestCareerProfileRevision({
        recommendationKey: "market-entry-low-response",
        snapshot,
      }),
    ).rejects.toThrow(/active career profile/i);

    expect(mocks.callJson).not.toHaveBeenCalled();
  });

  it("uses professional evidence without sending contact details", async () => {
    mocks.getActiveMasterCareerProfile.mockResolvedValue({
      id: "profile-v1",
      version: 1,
      status: "active",
      profile: {
        basics: {
          name: "Candidate",
          email: "private@example.com",
          phone: "555-0100",
          label: "Teacher",
          headline: "Educator",
          summary: "Teaching background.",
        },
        sections: {
          experience: {
            items: [
              {
                id: "exp-1",
                company: "School",
                position: "Teacher",
                location: "Moscow",
                date: "2020-2025",
                summary: "Handled communication and conflict resolution.",
                visible: true,
              },
            ],
          },
          skills: {
            items: [
              {
                id: "skill-1",
                name: "Communication",
                description: "Customer-facing communication",
                level: 3,
                keywords: ["communication"],
                visible: true,
              },
            ],
          },
        },
      },
      source: "manual",
      sourceRef: null,
      provenance: null,
      createdAt: "2026-10-01T00:00:00.000Z",
      activatedAt: "2026-10-01T00:00:00.000Z",
      supersededAt: null,
    });
    mocks.callJson.mockResolvedValue({
      success: true,
      data: {
        label: "Retail Associate",
        headline: "Customer-focused retail candidate",
        summary:
          "Transferable communication and conflict-resolution experience.",
        rationale: ["Uses existing communication evidence."],
        caveat: "Verify wording before activating a new profile version.",
      },
    });

    const result = await suggestCareerProfileRevision({
      recommendationKey: "market-entry-low-response",
      snapshot,
    });

    expect(result.label).toBe("Retail Associate");
    const payload = mocks.callJson.mock.calls[0]?.[0];
    const userPrompt = payload.messages[1].content as string;
    expect(userPrompt).toContain(
      "Handled communication and conflict resolution",
    );
    expect(userPrompt).not.toContain("private@example.com");
    expect(userPrompt).not.toContain("555-0100");
    expect(payload.messages[0].content).toContain(
      "Do not assume the candidate is technical",
    );
  });
});
