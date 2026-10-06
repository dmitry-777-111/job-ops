import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getJobById: vi.fn(),
  getStageEvents: vi.fn(),
  createConfiguredLlmService: vi.fn(),
  resolveLlmModel: vi.fn(),
  callJson: vi.fn(),
}));

vi.mock("@server/repositories/jobs", () => ({
  getJobById: mocks.getJobById,
}));

vi.mock("@server/services/applicationTracking", () => ({
  getStageEvents: mocks.getStageEvents,
}));

vi.mock("@server/services/modelSelection", () => ({
  createConfiguredLlmService: mocks.createConfiguredLlmService,
  resolveLlmModel: mocks.resolveLlmModel,
}));

import { analyzeInterviewEvent } from "./interview-advice";

const advice = {
  summary:
    "The interview showed customer-service strength with one unresolved work-authorization question.",
  employerSignals: ["Weekend availability was discussed."],
  strengths: ["Clear customer-conflict example."],
  risks: [
    {
      signal: "Work authorization may need clarification.",
      confidence: "medium" as const,
      evidence: "The user reports that the employer asked about it twice.",
    },
  ],
  nextSteps: ["Prepare a concise work-authorization explanation."],
  practiceAnswer:
    "I am authorized to work under my current permit and can explain the employer-change process.",
  profileWording: [
    "Customer-focused problem solving in fast-paced environments",
  ],
  caveat: "The employer's real decision reason is not known yet.",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createConfiguredLlmService.mockResolvedValue({
    callJson: mocks.callJson,
  });
  mocks.resolveLlmModel.mockResolvedValue("test-model");
  mocks.getJobById.mockResolvedValue({
    id: "job-1",
    title: "Retail Associate",
    employer: "Example Retail",
    jobDescription:
      "Serve customers, solve problems, and work flexible shifts.",
    outcome: null,
  });
});

describe("analyzeInterviewEvent", () => {
  it("requires a user debrief before spending an AI call", async () => {
    mocks.getStageEvents.mockResolvedValue([
      {
        id: "evt-1",
        applicationId: "job-1",
        title: "Recruiter Screen",
        groupId: null,
        fromStage: "applied",
        toStage: "recruiter_screen",
        occurredAt: 1_700_000_000,
        metadata: {
          eventType: "interview_log",
          evidence: {
            kind: "interview",
            sourceType: "manual_verified",
            verifiedBy: "user",
            note: "Verified phone screen",
          },
        },
        outcome: null,
      },
    ]);

    await expect(analyzeInterviewEvent("job-1", "evt-1")).rejects.toThrow(
      /debrief is required/i,
    );
    expect(mocks.callJson).not.toHaveBeenCalled();
  });

  it("uses the debrief plus later outcome evidence and returns structured advice", async () => {
    mocks.getStageEvents.mockResolvedValue([
      {
        id: "evt-1",
        applicationId: "job-1",
        title: "Recruiter Screen",
        groupId: null,
        fromStage: "applied",
        toStage: "recruiter_screen",
        occurredAt: 1_700_000_000,
        metadata: {
          eventType: "interview_log",
          interviewDebrief:
            "They asked twice about work authorization and about handling an angry customer.",
          evidence: {
            kind: "interview",
            sourceType: "manual_verified",
            verifiedBy: "user",
            note: "Verified phone screen",
          },
        },
        outcome: null,
      },
      {
        id: "evt-2",
        applicationId: "job-1",
        title: "Rejected",
        groupId: null,
        fromStage: "recruiter_screen",
        toStage: "closed",
        occurredAt: 1_700_000_100,
        metadata: {
          reasonCode: "Visa",
          evidence: {
            kind: "rejection",
            sourceType: "manual_verified",
            verifiedBy: "user",
            note: "Employer rejection email",
          },
        },
        outcome: "rejected",
      },
    ]);
    mocks.callJson.mockResolvedValue({ success: true, data: advice });

    const result = await analyzeInterviewEvent("job-1", "evt-1");

    expect(result).toEqual({ eventId: "evt-1", jobId: "job-1", advice });
    expect(mocks.callJson).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "test-model",
        jobId: "job-1",
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringMatching(/work authorization/i),
          }),
        ]),
      }),
    );
    const payload = mocks.callJson.mock.calls[0]?.[0];
    expect(payload.messages[1].content).toContain(
      "EXPLICIT LATER REASON\nVisa",
    );
    expect(payload.messages[1].content).toContain(
      "Do not assume the candidate is technical",
    );
  });
});
