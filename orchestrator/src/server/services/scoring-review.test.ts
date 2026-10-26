import { createJob } from "@shared/testing/factories";
import { beforeEach, describe, expect, it, vi } from "vitest";
import listings from "./fixtures/scoring-listings.json";
import { REVIEW_DOMAINS, validateScoringReview } from "./scoring-review";

const { callJson } = vi.hoisted(() => ({ callJson: vi.fn() }));
vi.mock("./modelSelection", () => ({
  resolveLlmModel: async () => "test-model",
  createConfiguredLlmService: async () => ({ callJson }),
}));
vi.mock("./settings", () => ({
  getEffectiveSettings: async () => ({
    penalizeMissingSalary: { value: false },
    missingSalaryPenalty: { value: 10 },
    scoringInstructions: { value: "Use only supplied evidence." },
  }),
}));
vi.mock("./resumeProjects", () => ({
  filterProfileProjectsForAi: async (profile: unknown) => profile,
}));

import { ScoringUnavailableError, scoreJobSuitability } from "./scorer";

const brief = {
  role_summary: "Test role",
  they_want: [],
  specifics: [],
  company_offers: [],
  practical_details: [],
  missing_or_unclear: [],
  repeated_signals: [],
};
function review(listing: string) {
  return {
    score: 51,
    reason: "Corrected fit assessment",
    jobBrief: structuredClone(brief),
    jobWarnings: [] as string[],
    checks: REVIEW_DOMAINS.map((domain) => ({
      domain,
      supported: true,
      explanation: "Controlled reviewer response, not a live model evaluation",
      evidence: [listing],
    })),
  };
}

describe("critical fact review contract (controlled responses)", () => {
  it.each([
    "night shift premium for eligible hours worked between 5:00 p.m. and 8:00 a.m.",
    "Drug Policy before being considered eligible for hire.",
  ])("does not treat non-immigration eligibility as work authorization: %s", (text) => {
    const output = review(text);
    output.checks[2].evidence = [];
    expect(() => validateScoringReview(output, text)).not.toThrow();
  });
  it.each([
    "Authorized to work in Canada, without the need for current or future visa sponsorship",
    "Must be eligible to work in Canada",
    "A work permit is required",
  ])("requires evidence for actual authorization: %s", (text) => {
    const output = review(text);
    output.checks[2].evidence = [];
    expect(() => validateScoringReview(output, text)).toThrow(/omitted/);
  });
  beforeEach(() => {
    callJson.mockReset();
  });
  it.each(
    listings,
  )("accepts exact source excerpts for $employer and rejects fabricated evidence", (fixture) => {
    const output = review(fixture.jobDescription);
    expect(validateScoringReview(output, fixture.jobDescription).score).toBe(
      51,
    );
    output.checks[0].evidence = [
      "Unrestricted work authorization is guaranteed.",
    ];
    expect(() => validateScoringReview(output, fixture.jobDescription)).toThrow(
      /evidence/,
    );
  });
  it("rejects absent, duplicate and unsupported checks", () => {
    const text = listings[0].jobDescription;
    const output = review(text);
    expect(() =>
      validateScoringReview({ ...output, checks: [] }, text),
    ).toThrow();
    output.checks[1] = output.checks[0];
    expect(() => validateScoringReview(output, text)).toThrow(/Incomplete/);
    const failed = review(text);
    failed.checks[0].supported = false;
    expect(() => validateScoringReview(failed, text)).toThrow(/did not pass/);
  });
  it("rejects skipped compensation evidence, missing sources and invalid scores", () => {
    const text = listings[0].jobDescription;
    const output = review(text);
    output.checks[1].evidence = [];
    expect(() => validateScoringReview(output, text)).toThrow(/omitted/);
    expect(() => validateScoringReview(review(text), "")).toThrow(
      /unavailable/,
    );
    for (const score of [NaN, Infinity, 101, -1, 50.5]) {
      expect(() =>
        validateScoringReview({ ...review(text), score }, text),
      ).toThrow();
    }
  });
  it("replaces the draft score and false claims, persists warnings and labels the new version", async () => {
    const fixture = listings[1];
    const corrected = review(fixture.jobDescription);
    const warning =
      "The listing both allows certification within six months and lists certifications as required.";
    corrected.jobWarnings = [warning];
    corrected.reason =
      "Certification requirements conflict; guaranteed base pay is not established.";
    callJson
      .mockResolvedValueOnce({
        success: true,
        data: {
          score: 90,
          reason: "All certifications are optional and pay is guaranteed.",
          jobWarnings: [],
        },
      })
      .mockResolvedValueOnce({ success: true, data: corrected });
    const job = createJob({
      jobDescription: fixture.jobDescription,
      suitabilityScore: 72,
    });
    const result = await scoreJobSuitability(
      job,
      {},
      { skipHostedUsage: true },
    );
    expect(result.score).toBe(51);
    expect(result.reason).toContain("[critical-facts-v1]");
    expect(result.reason).toContain(warning);
    expect(result.reason).not.toContain("All certifications are optional");
    expect(JSON.parse(result.jobBrief ?? "{}").missing_or_unclear).toContain(
      warning,
    );
    expect(job.suitabilityScore).toBe(72);
    expect(callJson).toHaveBeenCalledTimes(2);
  });
  it("does not return a numeric result if review fails or is unavailable", async () => {
    const text = listings[0].jobDescription;
    const unsupported = review(text);
    unsupported.checks[3].supported = false;
    for (const response of [
      { success: false, error: "timeout" },
      { success: true, data: unsupported },
      { success: true, data: {} },
    ]) {
      callJson
        .mockResolvedValueOnce({
          success: true,
          data: { score: 99, reason: "Draft" },
        })
        .mockResolvedValueOnce(response);
      await expect(
        scoreJobSuitability(
          createJob({ jobDescription: text }),
          {},
          { skipHostedUsage: true },
        ),
      ).rejects.toBeInstanceOf(ScoringUnavailableError);
    }
  });
  it("reviews rejected patches and keeps concurrent candidate inputs isolated", async () => {
    const text = listings[0].jobDescription;
    const requests: string[] = [];
    callJson.mockImplementation(async (request) => {
      if (request.jsonSchema.name === "job_suitability_score")
        return {
          success: true,
          data: {
            score: 80,
            reason: "Draft",
            jobPatches: [
              {
                field: "salaryMinAmount",
                value: 999999,
                confidence: "high",
                evidence: "Fabricated salary",
              },
            ],
          },
        };
      requests.push(request.messages[1].content);
      return { success: true, data: review(text) };
    });
    const results = await Promise.all(
      ["Tenant A", "Tenant B"].map((summary) =>
        scoreJobSuitability(
          createJob({ jobDescription: text }),
          { basics: { summary, email: "private@example.com" } },
          { skipHostedUsage: true },
        ),
      ),
    );
    expect(
      results.every(
        (result) => Object.keys(result.jobUpdates ?? {}).length === 0,
      ),
    ).toBe(true);
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(
        request.includes("Tenant A") !== request.includes("Tenant B"),
      ).toBe(true);
      expect(request).not.toContain("private@example.com");
      expect(request).toContain("evidence_not_in_job_description");
    }
  });
});
