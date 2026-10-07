import { AppError } from "@infra/errors";
import { getActiveMasterCareerProfile } from "@server/repositories/candidate-profile";
import {
  createConfiguredLlmService,
  resolveLlmModel,
} from "@server/services/modelSelection";
import type {
  CareerProfileRevisionSuggestion,
  CareerRecommendationSnapshot,
  ResumeProfile,
} from "@shared/types";
import { z } from "zod";

const suggestionSchema = z.object({
  label: z.string().nullable(),
  headline: z.string().nullable(),
  summary: z.string().nullable(),
  rationale: z.array(z.string()).max(6),
  caveat: z.string().min(1),
});

function professionalContext(profile: ResumeProfile) {
  return {
    currentLabel: profile.basics?.label ?? null,
    currentHeadline: profile.basics?.headline ?? null,
    currentSummary:
      profile.basics?.summary ?? profile.sections?.summary?.content ?? null,
    skills:
      profile.sections?.skills?.items?.slice(0, 30).map((item) => ({
        name: item.name,
        description: item.description,
        keywords: item.keywords,
      })) ?? [],
    experience:
      profile.sections?.experience?.items?.slice(0, 20).map((item) => ({
        company: item.company,
        position: item.position,
        date: item.date,
        summary: item.summary,
      })) ?? [],
  };
}

export async function suggestCareerProfileRevision(input: {
  recommendationKey: string;
  snapshot: CareerRecommendationSnapshot;
}): Promise<CareerProfileRevisionSuggestion> {
  const active = await getActiveMasterCareerProfile();
  if (!active) {
    throw new AppError({
      status: 400,
      code: "INVALID_REQUEST",
      message:
        "An active career profile is required before generating a revision.",
    });
  }

  const [llm, model] = await Promise.all([
    createConfiguredLlmService("default"),
    resolveLlmModel("default"),
  ]);

  const result = await llm.callJson<CareerProfileRevisionSuggestion>({
    model,
    maxRetries: 1,
    messages: [
      {
        role: "system",
        content: [
          "You are a career positioning editor inside TJAgent.",
          "Suggest only wording for professional label, headline and summary.",
          "Never invent experience, credentials, licenses, skills, languages, authorization, achievements, dates or responsibilities.",
          "Do not assume the candidate is technical, white-collar, or staying in the same occupation.",
          "The candidate may be changing country, occupation, industry or seniority.",
          "Use only facts present in the supplied career profile.",
          "If evidence is insufficient, preserve current wording or return null rather than inventing.",
          "LinkedIn, Indeed and other external profiles are not edited automatically; wording can later be copied by the user.",
        ].join("\n"),
      },
      {
        role: "user",
        content: [
          "RECOMMENDATION KEY",
          input.recommendationKey,
          "RECOMMENDATION",
          JSON.stringify(input.snapshot),
          "CURRENT PROFESSIONAL PROFILE",
          JSON.stringify(professionalContext(active.profile)),
          "",
          "Produce concise replacement wording. Rationale must explain why each proposed change is supported by the recommendation evidence. Caveat must state that the user should verify wording before activating the new profile version.",
        ].join("\n"),
      },
    ],
    jsonSchema: {
      name: "career_profile_revision_suggestion",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["label", "headline", "summary", "rationale", "caveat"],
        properties: {
          label: { anyOf: [{ type: "string" }, { type: "null" }] },
          headline: { anyOf: [{ type: "string" }, { type: "null" }] },
          summary: { anyOf: [{ type: "string" }, { type: "null" }] },
          rationale: { type: "array", items: { type: "string" } },
          caveat: { type: "string" },
        },
      },
    },
  });

  if (!result.success) {
    throw new Error(`AI career profile revision failed: ${result.error}`);
  }

  return suggestionSchema.parse(result.data);
}
