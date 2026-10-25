/** Complete controlled response for transport/model-selection tests. */
export function scoringResponse(score: number, reason: string) {
  return {
    score,
    reason,
    jobBrief: {
      role_summary: "Test role",
      they_want: [],
      specifics: [],
      company_offers: [],
      practical_details: [],
      missing_or_unclear: [],
      repeated_signals: [],
    },
    jobPatches: [],
    jobWarnings: [],
    checks: ["requirements", "compensation", "authorization", "score"].map(
      (domain) => ({
        domain,
        supported: true,
        explanation: "Controlled test response",
        evidence: [],
      }),
    ),
  };
}
