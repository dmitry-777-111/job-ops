import type {
  ApplicationEvidenceItem,
  ApplicationGapItem,
  MarketPosting,
  ResumeProfile,
} from "@shared/types";

export interface TruthConstrainedApplicationDraft {
  targetedCvJson: Record<string, unknown>;
  coverLetter: string;
  formAnswers: Record<string, string>;
  changedFromMaster: string[];
}

function deepCloneProfile(profile: ResumeProfile): ResumeProfile {
  return JSON.parse(JSON.stringify(profile)) as ResumeProfile;
}

function extractSkillId(evidenceRef: string): string | null {
  const match = evidenceRef.match(/^sections\.skills\.([^.]+)\./);
  return match?.[1] ?? null;
}

function prioritizeVerifiedSkills(
  profile: ResumeProfile,
  evidenceMap: ApplicationEvidenceItem[],
): ResumeProfile {
  const clone = deepCloneProfile(profile);
  const items = clone.sections?.skills?.items;
  if (!items?.length) return clone;

  const priority = new Map<string, number>();
  for (const evidence of evidenceMap) {
    if (evidence.evidenceSource !== "profile") continue;
    const skillId = extractSkillId(evidence.evidenceRef);
    if (!skillId || priority.has(skillId)) continue;
    priority.set(skillId, priority.size);
  }

  if (priority.size === 0) return clone;

  const skillSection = clone.sections?.skills;
  if (!skillSection) return clone;

  skillSection.items = [...items].sort((left, right) => {
    const leftRank = priority.get(left.id);
    const rightRank = priority.get(right.id);
    if (leftRank === undefined && rightRank === undefined) return 0;
    if (leftRank === undefined) return 1;
    if (rightRank === undefined) return -1;
    return leftRank - rightRank;
  });

  return clone;
}

function uniqueEvidenceTexts(evidenceMap: ApplicationEvidenceItem[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const evidence of evidenceMap) {
    const value = evidence.evidenceText.replace(/\s+/g, " ").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

export function buildEvidenceBoundedCoverLetter(input: {
  posting: Pick<MarketPosting, "employer" | "title">;
  profile: ResumeProfile;
  evidenceMap: ApplicationEvidenceItem[];
}): string {
  const candidateName = input.profile.basics?.name?.trim();
  const evidenceTexts = uniqueEvidenceTexts(input.evidenceMap);

  const lines = [
    "Dear Hiring Team,",
    "",
    `I am applying for the ${input.posting.title} position at ${input.posting.employer}.`,
  ];

  if (evidenceTexts.length > 0) {
    lines.push(
      "",
      "Verified experience and skills relevant to the posted requirements:",
      ...evidenceTexts.map((text) => `- ${text}`),
    );
  }

  lines.push(
    "",
    "I would welcome the opportunity to discuss how this verified background relates to the role.",
    "",
    "Sincerely,",
    candidateName || "Candidate",
  );

  return lines.join("\n");
}

export function buildTruthConstrainedApplicationDraft(input: {
  posting: MarketPosting;
  profile: ResumeProfile;
  evidenceMap: ApplicationEvidenceItem[];
  gaps: ApplicationGapItem[];
}): TruthConstrainedApplicationDraft {
  const targetedProfile = prioritizeVerifiedSkills(
    input.profile,
    input.evidenceMap,
  );

  const originalSkillIds =
    input.profile.sections?.skills?.items?.map((item) => item.id) ?? [];
  const targetedSkillIds =
    targetedProfile.sections?.skills?.items?.map((item) => item.id) ?? [];
  const skillsReordered =
    originalSkillIds.length === targetedSkillIds.length &&
    originalSkillIds.some((id, index) => id !== targetedSkillIds[index]);

  return {
    targetedCvJson: targetedProfile as Record<string, unknown>,
    coverLetter: buildEvidenceBoundedCoverLetter({
      posting: input.posting,
      profile: input.profile,
      evidenceMap: input.evidenceMap,
    }),
    formAnswers: {},
    changedFromMaster: skillsReordered
      ? ["sections.skills.items: reordered by verified vacancy relevance"]
      : [],
  };
}
