export const CANDIDATE_CONSTRAINT_KINDS = [
  "hard",
  "soft",
  "contextual",
] as const;
export type CandidateConstraintKind =
  (typeof CANDIDATE_CONSTRAINT_KINDS)[number];

export const CANDIDATE_CONSTRAINT_SOURCES = [
  "candidate",
  "resume",
  "connected_profile",
  "derived",
  "admin",
] as const;
export type CandidateConstraintSource =
  (typeof CANDIDATE_CONSTRAINT_SOURCES)[number];

export interface CandidateConstraint<T = unknown> {
  id: string;
  key: string;
  kind: CandidateConstraintKind;
  value: T;
  source: CandidateConstraintSource;
  confidence: number;
  explanation?: string | null;
  effectiveAt: string;
  expiresAt?: string | null;
  recheckTrigger?: string | null;
}

export interface CandidateStrategyProfile {
  id: string;
  version: number;
  status: "draft" | "active" | "superseded";
  targetMarkets: string[];
  targetRoleFamilies: string[];
  excludedRoleFamilies: string[];
  constraints: CandidateConstraint[];
  freeformNotes?: string | null;
  createdAt: string;
  activatedAt?: string | null;
}

export interface CandidateStrategyDelta {
  previousVersion: number | null;
  nextVersion: number;
  added: CandidateConstraint[];
  removedConstraintIds: string[];
  changed: Array<{
    constraintId: string;
    before: CandidateConstraint;
    after: CandidateConstraint;
  }>;
  likelySearchImpact: string[];
}

export type CareerLearningStage =
  | "market_entry"
  | "screening"
  | "interview"
  | "final";

export type CareerRecommendationConfidence = "emerging" | "moderate" | "strong";

export type CareerRecommendationTarget =
  | "strategy"
  | "profile"
  | "interview_behavior"
  | "job_platform_profile"
  | "mixed";

export type CareerRecommendationStatus = "proposed" | "accepted" | "rejected";

export interface CareerRecommendationSnapshot {
  stage: CareerLearningStage;
  confidence: CareerRecommendationConfidence;
  target: CareerRecommendationTarget;
  title: string;
  evidence: string;
  recommendation: string;
}

export interface CareerRecommendationDecision {
  id: string;
  key: string;
  snapshot: CareerRecommendationSnapshot;
  status: CareerRecommendationStatus;
  createdAt: string;
  decidedAt?: string | null;
  updatedAt: string;
}

export interface CareerProfileRevisionSuggestion {
  label: string | null;
  headline: string | null;
  summary: string | null;
  rationale: string[];
  caveat: string;
}

export const CANDIDATE_PROFILE_VERSION_STATUSES = [
  "draft",
  "active",
  "superseded",
] as const;
export type CandidateProfileVersionStatus =
  (typeof CANDIDATE_PROFILE_VERSION_STATUSES)[number];

export const CANDIDATE_PROFILE_SOURCES = [
  "design_resume",
  "rxresume",
  "upload",
  "connected_profile",
  "manual",
  "legacy_current_profile",
  "ai_normalized",
] as const;
export type CandidateProfileSource = (typeof CANDIDATE_PROFILE_SOURCES)[number];

export interface MasterCareerProfileVersion {
  id: string;
  version: number;
  status: CandidateProfileVersionStatus;
  profile: import("./settings").ResumeProfile;
  source: CandidateProfileSource;
  sourceRef?: string | null;
  provenance?: Record<string, unknown> | null;
  createdAt: string;
  activatedAt?: string | null;
  supersededAt?: string | null;
}
