import { AppError } from "@infra/errors";
import * as jobsRepo from "@server/repositories/jobs";
import { getStageEvents } from "@server/services/applicationTracking";
import {
  createConfiguredLlmService,
  resolveLlmModel,
} from "@server/services/modelSelection";
import type {
  InterviewAdvice,
  InterviewAdviceResponse,
  StageEvent,
} from "@shared/types";
import { z } from "zod";

const adviceSchema = z.object({
  summary: z.string().min(1),
  employerSignals: z.array(z.string()).max(8),
  strengths: z.array(z.string()).max(8),
  risks: z
    .array(
      z.object({
        signal: z.string().min(1),
        confidence: z.enum(["low", "medium", "high"]),
        evidence: z.string().min(1),
      }),
    )
    .max(8),
  nextSteps: z.array(z.string()).min(1).max(8),
  practiceAnswer: z.string().nullable(),
  profileWording: z.array(z.string()).max(6),
  caveat: z.string().min(1),
});

function findInterviewEvent(events: StageEvent[], eventId: string): StageEvent {
  const event = events.find((candidate) => candidate.id === eventId);
  if (!event) {
    throw new AppError({
      status: 404,
      code: "NOT_FOUND",
      message: "Interview event not found",
    });
  }
  if (!event.metadata?.interviewDebrief?.trim()) {
    throw new AppError({
      status: 400,
      code: "INVALID_REQUEST",
      message: "Interview debrief is required before AI analysis",
    });
  }
  return event;
}

function buildPrompt(args: {
  title: string;
  employer: string;
  jobDescription: string | null;
  event: StageEvent;
  laterEvents: StageEvent[];
  currentOutcome: string | null;
}) {
  const laterOutcome =
    args.laterEvents.find((event) => event.outcome)?.outcome ??
    args.currentOutcome ??
    null;
  const laterReason =
    [...args.laterEvents].reverse().find((event) => event.metadata?.reasonCode)
      ?.metadata?.reasonCode ?? null;

  return [
    "You are a career interview coach inside The JobAgent.",
    "Analyze only the evidence provided. Separate facts from hypotheses.",
    "Do not assume the candidate is technical, professional, white-collar, or continuing in the same occupation.",
    "The candidate may be changing countries, occupations, seniority or industries.",
    "Do not infer a rejection cause merely because a topic appeared in the interview.",
    "Use high confidence only for direct evidence or a repeated explicit employer signal.",
    "Recommendations for LinkedIn, Indeed or other job-platform profiles must be wording suggestions only; the user edits profiles manually.",
    "Do not recommend changing career direction from one interview.",
    "",
    "ROLE",
    args.title,
    "EMPLOYER",
    args.employer,
    "JOB DESCRIPTION",
    (args.jobDescription ?? "Not available").slice(0, 8000),
    "INTERVIEW STAGE",
    args.event.toStage,
    "USER DEBRIEF",
    args.event.metadata?.interviewDebrief?.trim() ?? "",
    "LATER OUTCOME",
    laterOutcome ?? "Unknown / pending",
    "EXPLICIT LATER REASON",
    laterReason ?? "None recorded",
    "",
    "Return concise, practical advice. The caveat must explicitly say when the real cause is still uncertain.",
  ].join("\n");
}

export async function analyzeInterviewEvent(
  jobId: string,
  eventId: string,
): Promise<InterviewAdviceResponse> {
  const [job, events] = await Promise.all([
    jobsRepo.getJobById(jobId),
    getStageEvents(jobId),
  ]);
  if (!job) {
    throw new AppError({
      status: 404,
      code: "NOT_FOUND",
      message: "Job not found",
    });
  }

  const event = findInterviewEvent(events, eventId);
  const laterEvents = events.filter(
    (candidate) => candidate.occurredAt > event.occurredAt,
  );

  const [llm, model] = await Promise.all([
    createConfiguredLlmService("default"),
    resolveLlmModel("default"),
  ]);

  const result = await llm.callJson<InterviewAdvice>({
    model,
    jobId,
    maxRetries: 1,
    messages: [
      {
        role: "system",
        content:
          "You provide evidence-based career interview analysis. Never claim to know an employer's hidden reason.",
      },
      {
        role: "user",
        content: buildPrompt({
          title: job.title,
          employer: job.employer,
          jobDescription: job.jobDescription,
          event,
          laterEvents,
          currentOutcome: job.outcome,
        }),
      },
    ],
    jsonSchema: {
      name: "interview_advice",
      schema: {
        type: "object",
        additionalProperties: false,
        required: [
          "summary",
          "employerSignals",
          "strengths",
          "risks",
          "nextSteps",
          "practiceAnswer",
          "profileWording",
          "caveat",
        ],
        properties: {
          summary: { type: "string" },
          employerSignals: { type: "array", items: { type: "string" } },
          strengths: { type: "array", items: { type: "string" } },
          risks: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["signal", "confidence", "evidence"],
              properties: {
                signal: { type: "string" },
                confidence: {
                  type: "string",
                  enum: ["low", "medium", "high"],
                },
                evidence: { type: "string" },
              },
            },
          },
          nextSteps: { type: "array", items: { type: "string" } },
          practiceAnswer: { anyOf: [{ type: "string" }, { type: "null" }] },
          profileWording: { type: "array", items: { type: "string" } },
          caveat: { type: "string" },
        },
      },
    },
  });

  if (!result.success) {
    throw new Error("AI interview analysis failed: " + result.error);
  }

  return {
    eventId,
    jobId,
    advice: adviceSchema.parse(result.data),
  };
}
