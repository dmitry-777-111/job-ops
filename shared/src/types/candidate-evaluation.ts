export const PREFILTER_DISPOSITIONS = [
  "not_evaluated",
  "pass_to_ai",
  "safe_reject",
  "uncertain_to_ai",
] as const;
export type PrefilterDisposition = (typeof PREFILTER_DISPOSITIONS)[number];

export const HARD_GATE_OUTCOMES = ["pass", "fail", "unknown"] as const;
export type HardGateOutcome = (typeof HARD_GATE_OUTCOMES)[number];

export const CANDIDATE_EVALUATION_STATUSES = [
  "pending",
  "scored",
  "failed_retryable",
  "failed_terminal",
] as const;
export type CandidateEvaluationStatus =
  (typeof CANDIDATE_EVALUATION_STATUSES)[number];

export interface CandidateEvaluation {
  id: string;
  marketPostingId: string;
  marketPostingVersionId: string;
  profileVersionId: string;
  strategyVersionId: string;
  scoringPolicyVersion: string;
  prefilterDisposition: PrefilterDisposition;
  prefilterRuleVersion: string | null;
  prefilterReason: string | null;
  hardGateOutcome: HardGateOutcome;
  status: CandidateEvaluationStatus;
  suitabilityScore: number | null;
  suitabilityReason: string | null;
  factualFit: string | null;
  careerValue: string | null;
  compensationAssessment: string | null;
  workAuthorizationAssessment: string | null;
  locationTravelAssessment: string | null;
  uncertainties: string[];
  createdAt: string;
  updatedAt: string;
}
