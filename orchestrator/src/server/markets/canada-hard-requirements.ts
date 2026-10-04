export const CANADA_HARD_REQUIREMENT_SIGNALS = {
  CITIZENSHIP_REQUIRED: "canada.citizenship_required",
  CITIZEN_OR_PR_ONLY: "canada.citizen_or_pr_only",
  CANADIAN_PASSPORT_REQUIRED: "canada.passport_required",
} as const;

export type CanadaHardRequirementSignal =
  (typeof CANADA_HARD_REQUIREMENT_SIGNALS)[keyof typeof CANADA_HARD_REQUIREMENT_SIGNALS];

function normalizeDescription(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLowerCase();
}

function hasCitizenOrPrOnlyRequirement(text: string): boolean {
  const mandatoryWindow =
    /\b(?:must|require|requires|required)\b[^.]{0,140}(?:canadian citizenship|canadian citizen)[^.]{0,90}(?:permanent resident|permanent residency|permanent resident status)/i;
  const reverseWindow =
    /(?:canadian citizenship|canadian citizen)[^.]{0,90}(?:permanent resident|permanent residency|permanent resident status)[^.]{0,100}(?:required|must)/i;

  const match = text.match(mandatoryWindow) ?? text.match(reverseWindow);
  if (!match) return false;

  // If the same requirement explicitly permits a visa/work permit, it is not
  // a citizenship/PR-only gate and must not become SAFE_REJECT.
  return !/(?:visa|work permit|legally entitled|legally eligible)/i.test(
    match[0],
  );
}

function hasCitizenshipOnlyRequirement(text: string): boolean {
  return (
    /\b(?:applicant|candidate|successful candidate)?\s*must be (?:a )?canadian citizen\b/i.test(
      text,
    ) ||
    /\bcanadian citizenship\s+(?:is\s+)?(?:required|mandatory)\b/i.test(text)
  );
}

function hasCanadianPassportRequirement(text: string): boolean {
  return (
    /\bmust (?:hold|have|possess) (?:or be eligible to obtain )?(?:a )?(?:valid )?canadian passport\b/i.test(
      text,
    ) ||
    /\bvalid canadian passport\s*\(or eligibility to obtain one\)/i.test(
      text,
    ) ||
    /\bcanadian passport\s+(?:is\s+)?(?:required|mandatory)\b/i.test(text)
  );
}

/**
 * Extract only explicit, mandatory Canada-specific eligibility requirements.
 * Preference statements and lists that also allow a visa/work permit are
 * deliberately ignored. These signals are shadow evidence only until a
 * candidate strategy explicitly marks them as hard rejects.
 */
export function extractCanadaHardRequirementSignals(
  description: string | null | undefined,
): CanadaHardRequirementSignal[] {
  if (!description?.trim()) return [];
  const text = normalizeDescription(description);
  const signals = new Set<CanadaHardRequirementSignal>();

  if (hasCitizenshipOnlyRequirement(text)) {
    signals.add(CANADA_HARD_REQUIREMENT_SIGNALS.CITIZENSHIP_REQUIRED);
  }
  if (hasCitizenOrPrOnlyRequirement(text)) {
    signals.add(CANADA_HARD_REQUIREMENT_SIGNALS.CITIZEN_OR_PR_ONLY);
  }
  if (hasCanadianPassportRequirement(text)) {
    signals.add(CANADA_HARD_REQUIREMENT_SIGNALS.CANADIAN_PASSPORT_REQUIRED);
  }

  return [...signals];
}
