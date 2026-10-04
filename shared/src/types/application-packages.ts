export const APPLICATION_PACKAGE_STATUSES = [
  "draft",
  "review",
  "approved",
  "exported",
  "stale",
] as const;
export type ApplicationPackageStatus =
  (typeof APPLICATION_PACKAGE_STATUSES)[number];

export const APPLICATION_REQUIREMENT_CATEGORIES = [
  "skill",
  "experience",
  "education",
  "licence",
  "language",
  "work_authorization",
  "travel",
  "other",
] as const;
export type ApplicationRequirementCategory =
  (typeof APPLICATION_REQUIREMENT_CATEGORIES)[number];

export interface ApplicationRequirementItem {
  key: string;
  text: string;
  category: ApplicationRequirementCategory;
  mandatory: boolean | null;
  sourceText: string;
}

export interface ApplicationEvidenceItem {
  requirementKey: string;
  requirementText: string;
  evidenceSource: "profile" | "resume" | "candidate_confirmed";
  evidenceRef: string;
  evidenceText: string;
  confidence: number;
}

export interface ApplicationGapItem {
  requirementKey: string;
  requirementText: string;
  severity: "info" | "warning" | "hard_gap";
  explanation: string;
}

export interface ApplicationPackage {
  id: string;
  version: number;
  status: ApplicationPackageStatus;
  marketPostingId: string;
  marketPostingVersionId: string;
  profileVersionId: string;
  strategyVersionId: string | null;
  generationPolicyVersion: string;
  evidenceMap: ApplicationEvidenceItem[];
  gaps: ApplicationGapItem[];
  targetedCvJson: Record<string, unknown> | null;
  coverLetter: string | null;
  formAnswers: Record<string, string>;
  approvedAt: string | null;
  exportedAt: string | null;
  staleReason: string | null;
  createdAt: string;
  updatedAt: string;
}
