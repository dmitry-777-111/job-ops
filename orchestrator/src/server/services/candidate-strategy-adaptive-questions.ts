import { getActiveMasterCareerProfile } from "@server/repositories/candidate-profile";
import {
  type CandidateStrategyOnboardingAnswers,
  type CandidateStrategyQuestion,
  type CandidateStrategyQuestionId,
  deriveCandidateStrategyQuestions,
} from "./candidate-strategy-onboarding";
import { LlmService } from "./llm/service";
import type { JsonSchemaDefinition } from "./llm/types";
import { resolveLlmRuntimeSettings } from "./modelSelection";

export type CandidateStrategyAdaptiveQuestions = {
  questions: CandidateStrategyQuestion[];
  source: "ai" | "deterministic";
};

type AiQuestionPayload = {
  questions: Array<{
    id: string;
    prompt: string;
    reason: string;
  }>;
};

const adaptiveQuestionSchema: JsonSchemaDefinition = {
  name: "candidate_strategy_adaptive_questions",
  schema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            id: { type: "string" },
            prompt: { type: "string" },
            reason: { type: "string" },
          },
          required: ["id", "prompt", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  },
};

function compactProfileContext(profile: unknown): string {
  if (!profile) return "No active career profile is available yet.";
  const serialized = JSON.stringify(profile);
  return serialized.length <= 8_000
    ? serialized
    : `${serialized.slice(0, 8_000)}...[truncated]`;
}

function isQuestionId(value: string): value is CandidateStrategyQuestionId {
  return [
    "target_roles",
    "compensation_floor",
    "us_travel",
    "career_priority",
  ].includes(value);
}

export function mergeAdaptiveCandidateStrategyQuestions(
  fallback: CandidateStrategyQuestion[],
  proposed: AiQuestionPayload,
): CandidateStrategyQuestion[] {
  const proposedById = new Map<
    CandidateStrategyQuestionId,
    { prompt: string; reason: string }
  >();

  for (const question of proposed.questions) {
    if (!isQuestionId(question.id)) continue;
    const prompt = question.prompt.trim();
    const reason = question.reason.trim();
    if (!prompt || !reason) continue;
    proposedById.set(question.id, { prompt, reason });
  }

  return fallback.map((question) => {
    const adapted = proposedById.get(question.id);
    if (!adapted) return question;
    return {
      ...question,
      prompt: adapted.prompt,
      reason: adapted.reason,
    };
  });
}

export async function generateCandidateStrategyAdaptiveQuestions(
  answers: Partial<CandidateStrategyOnboardingAnswers>,
): Promise<CandidateStrategyAdaptiveQuestions> {
  const fallback = deriveCandidateStrategyQuestions(answers);
  if (fallback.length === 0) {
    return { questions: [], source: "deterministic" };
  }

  try {
    const [runtime, profile] = await Promise.all([
      resolveLlmRuntimeSettings("default"),
      getActiveMasterCareerProfile(),
    ]);
    const llm = new LlmService({
      provider: runtime.provider,
      baseUrl: runtime.baseUrl,
      apiKey: runtime.apiKey,
      allowEnvironmentCredentials: runtime.allowEnvironmentCredentials,
      allowCliProviders: runtime.allowCliProviders,
    });

    const result = await llm.callJson<AiQuestionPayload>({
      model: runtime.model,
      maxRetries: 0,
      messages: [
        {
          role: "system",
          content:
            "Rewrite only the unresolved candidate-strategy onboarding questions so they are concise and relevant to the supplied career profile. Never infer an answer, constraint, salary floor, travel rule, or exclusion. Never add or remove question IDs. Unknown stays unknown. Return JSON only.",
        },
        {
          role: "user",
          content: JSON.stringify({
            unresolvedQuestions: fallback.map(({ id, prompt, reason }) => ({
              id,
              prompt,
              reason,
            })),
            currentAnswers: answers,
            careerProfile: compactProfileContext(profile?.profile ?? null),
          }),
        },
      ],
      jsonSchema: adaptiveQuestionSchema,
    });

    if (!result.success) {
      return { questions: fallback, source: "deterministic" };
    }

    return {
      questions: mergeAdaptiveCandidateStrategyQuestions(fallback, result.data),
      source: "ai",
    };
  } catch {
    return { questions: fallback, source: "deterministic" };
  }
}
