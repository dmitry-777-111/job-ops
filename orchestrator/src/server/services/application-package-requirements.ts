import { createHash } from "node:crypto";
import type {
  ApplicationEvidenceItem,
  ApplicationGapItem,
  ApplicationRequirementCategory,
  ApplicationRequirementItem,
  ResumeProfile,
} from "@shared/types";

const REQUIRED_SIGNAL =
  /\b(must|required|requirement|minimum|at least|mandatory|shall)\b/i;
const PREFERRED_SIGNAL =
  /\b(preferred|asset|nice to have|nice-to-have|desirable|would be an asset)\b/i;

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function requirementKey(text: string): string {
  return (
    "req:" +
    createHash("sha256")
      .update(normalizeText(text).toLowerCase())
      .digest("hex")
      .slice(0, 16)
  );
}

function classifyRequirement(text: string): ApplicationRequirementCategory {
  const value = text.toLowerCase();
  if (
    /\b(licen[cs]e|certification|certificate|red seal|309a|442a|driver'?s licence|driver'?s license)\b/.test(
      value,
    )
  ) {
    return "licence";
  }
  if (
    /\b(degree|diploma|college|university|bachelor|master'?s|education)\b/.test(
      value,
    )
  ) {
    return "education";
  }
  if (/\b(english|french|language|bilingual|fluent)\b/.test(value)) {
    return "language";
  }
  if (
    /\b(citizen|citizenship|permanent resident|work permit|authorized to work|eligible to work|visa|sponsorship)\b/.test(
      value,
    )
  ) {
    return "work_authorization";
  }
  if (/\b(travel|passport|overnight|relocat)\b/.test(value)) {
    return "travel";
  }
  if (
    /\b(years? of experience|experience with|experience in|experience working|hands[- ]on experience)\b/.test(
      value,
    )
  ) {
    return "experience";
  }
  if (
    /\b(skill|proficien|knowledge of|familiar with|ability to|experience using|plc|scada|electrical|mechanical|automation|software|sap|workday)\b/.test(
      value,
    )
  ) {
    return "skill";
  }
  return "other";
}

function splitRequirementCandidates(description: string): string[] {
  return description
    .split(/\r?\n|[????????????]|(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((item) => normalizeText(item.replace(/^[-*??????]\s*/, "")))
    .filter((item) => item.length >= 8 && item.length <= 500);
}

export function extractApplicationRequirements(
  description: string | null | undefined,
): ApplicationRequirementItem[] {
  if (!description?.trim()) return [];

  const seen = new Set<string>();
  const result: ApplicationRequirementItem[] = [];

  for (const candidate of splitRequirementCandidates(description)) {
    const required = REQUIRED_SIGNAL.test(candidate);
    const preferred = PREFERRED_SIGNAL.test(candidate);
    if (!required && !preferred) continue;

    const key = requirementKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);

    result.push({
      key,
      text: candidate,
      category: classifyRequirement(candidate),
      mandatory: required ? true : preferred ? false : null,
      sourceText: candidate,
    });
  }

  return result;
}

export interface ProfileEvidenceAtom {
  ref: string;
  text: string;
  kind: "skill" | "experience" | "summary" | "project";
}

function pushAtom(
  atoms: ProfileEvidenceAtom[],
  ref: string,
  text: string | undefined,
  kind: ProfileEvidenceAtom["kind"],
) {
  const normalized = normalizeText(text ?? "");
  if (normalized) atoms.push({ ref, text: normalized, kind });
}

export function buildProfileEvidenceAtoms(
  profile: ResumeProfile,
): ProfileEvidenceAtom[] {
  const atoms: ProfileEvidenceAtom[] = [];

  pushAtom(atoms, "basics.headline", profile.basics?.headline, "summary");
  pushAtom(atoms, "basics.summary", profile.basics?.summary, "summary");
  pushAtom(
    atoms,
    "sections.summary.content",
    profile.sections?.summary?.content,
    "summary",
  );

  for (const skill of profile.sections?.skills?.items ?? []) {
    pushAtom(
      atoms,
      "sections.skills." + skill.id + ".name",
      skill.name,
      "skill",
    );
    for (const [index, keyword] of (skill.keywords ?? []).entries()) {
      pushAtom(
        atoms,
        "sections.skills." + skill.id + ".keywords." + index,
        keyword,
        "skill",
      );
    }
    pushAtom(
      atoms,
      "sections.skills." + skill.id + ".description",
      skill.description,
      "skill",
    );
  }

  for (const item of profile.sections?.experience?.items ?? []) {
    pushAtom(
      atoms,
      "sections.experience." + item.id + ".position",
      item.position,
      "experience",
    );
    pushAtom(
      atoms,
      "sections.experience." + item.id + ".summary",
      item.summary,
      "experience",
    );
  }

  for (const item of profile.sections?.projects?.items ?? []) {
    pushAtom(
      atoms,
      "sections.projects." + item.id + ".name",
      item.name,
      "project",
    );
    pushAtom(
      atoms,
      "sections.projects." + item.id + ".summary",
      item.summary,
      "project",
    );
    pushAtom(
      atoms,
      "sections.projects." + item.id + ".description",
      item.description,
      "project",
    );
    for (const [index, keyword] of (item.keywords ?? []).entries()) {
      pushAtom(
        atoms,
        "sections.projects." + item.id + ".keywords." + index,
        keyword,
        "project",
      );
    }
  }

  return atoms;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findConservativeSkillEvidence(
  requirement: ApplicationRequirementItem,
  atoms: ProfileEvidenceAtom[],
): ProfileEvidenceAtom | null {
  if (requirement.category !== "skill") return null;
  const requirementText = requirement.text.toLowerCase();

  return (
    atoms.find((atom) => {
      if (atom.kind !== "skill") return false;
      const evidence = normalizeText(atom.text.toLowerCase());
      if (evidence.length < 2) return false;
      return new RegExp("\\b" + escapeRegex(evidence) + "\\b").test(
        requirementText,
      );
    }) ?? null
  );
}

export function mapApplicationRequirementsToEvidence(input: {
  requirements: ApplicationRequirementItem[];
  profile: ResumeProfile;
}): {
  evidenceMap: ApplicationEvidenceItem[];
  gaps: ApplicationGapItem[];
} {
  const atoms = buildProfileEvidenceAtoms(input.profile);
  const evidenceMap: ApplicationEvidenceItem[] = [];
  const gaps: ApplicationGapItem[] = [];

  for (const requirement of input.requirements) {
    const evidence = findConservativeSkillEvidence(requirement, atoms);
    if (evidence) {
      evidenceMap.push({
        requirementKey: requirement.key,
        requirementText: requirement.text,
        evidenceSource: "profile",
        evidenceRef: evidence.ref,
        evidenceText: evidence.text,
        confidence: 1,
      });
      continue;
    }

    gaps.push({
      requirementKey: requirement.key,
      requirementText: requirement.text,
      severity: requirement.mandatory ? "hard_gap" : "warning",
      explanation:
        "No verified candidate evidence was found. Keep this requirement unsupported until explicit evidence is provided.",
    });
  }

  return { evidenceMap, gaps };
}
