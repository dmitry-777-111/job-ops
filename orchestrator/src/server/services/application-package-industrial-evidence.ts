import { normalizeEditorialText } from "./application-package-editorial";

// This bounded rule proves only industrial equipment repair tenure. It does
// not equate equipment types, infer licences, or turn a skill into experience.
export function industrialRepairYearsRequired(text: string): number | null {
  const match = text.match(
    /^(\d+)\+? years?'? (?:of )?experience repairing industrial (?:processing|production) equipment in an industrial environment(?: or in the military)?\.?$/i,
  );
  return match ? Number(match[1]) : null;
}

export function completedExperienceMonths(date: string): number | null {
  const match = date
    .trim()
    .match(/^([A-Za-z]{3}) (\d{4})\s*[-–—]\s*([A-Za-z]{3}) (\d{4})$/);
  if (!match) return null;
  const months = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];
  const startMonth = months.indexOf(match[1].toLowerCase());
  const endMonth = months.indexOf(match[3].toLowerCase());
  if (startMonth < 0 || endMonth < 0) return null;
  const start = Number(match[2]) * 12 + startMonth;
  const end = Number(match[4]) * 12 + endMonth;
  const now = new Date();
  if (end >= now.getUTCFullYear() * 12 + now.getUTCMonth() || end <= start)
    return null;
  // Unknown day-of-month: count only the fully enclosed months, never round up.
  // Ongoing, year-only and overlapping roles are deliberately not aggregated.
  return end - start - 1;
}

export function hasIndustrialRepairDuties(summary: string): boolean {
  const text = normalizeEditorialText(summary);
  // Ambiguous/negative duties need explicit review, not a keyword-based pass.
  if (
    /\b(?:no|not|never|without|only|observed|shadowed|training)\b|n['’]t\b/i.test(
      text,
    )
  )
    return false;
  return (
    /\b(?:manufacturing (?:facility|environment|plant)|industrial (?:environment|plant|facility))\b/i.test(
      text,
    ) &&
    /\b(?:production|processing) equipment\b/i.test(text) &&
    /\b(?:maintained|repaired)\b[^.!?]{0,180}\b(?:equipment|conveyors|motors|pumps|machines)\b/i.test(
      text,
    ) &&
    /\b(?:performed|completed)\b[^.!?]{0,180}\b(?:repairs|component replacement)\b/i.test(
      text,
    )
  );
}
