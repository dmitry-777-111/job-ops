import type { EvidenceKind, StageEvidence } from "@shared/types";

export function evidenceKindForStage(stage: string): EvidenceKind | null {
  if (stage === "applied") return "submission";
  if (stage === "rejected") return "rejection";
  if (
    [
      "recruiter_screen",
      "assessment",
      "hiring_manager_screen",
      "technical_interview",
      "onsite",
    ].includes(stage)
  )
    return "interview";
  return null;
}

export function requestManualEvidence(kind: EvidenceKind): StageEvidence {
  const note = window
    .prompt(
      `Verified ${kind} evidence required. Describe the confirmation you personally checked, including its source and date. AI classifications are not evidence.`,
    )
    ?.trim();
  if (!note)
    throw new Error("Transition cancelled: verified evidence is required.");
  return { kind, sourceType: "manual_verified", note, verifiedBy: "user" };
}
