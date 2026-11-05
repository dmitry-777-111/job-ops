import { describe, expect, it } from "vitest";
import {
  extractApplicationRequirements,
  mapApplicationRequirementsToEvidence,
} from "./application-package-requirements";

// Qualification section and administrative notices from stored requisition 236963.
const required = [
  "2+ years' experience repairing industrial processing equipment in an industrial environment or in the military",
  "Ability to read maintenance literature printed in English",
  "Experience with and ability to read a blueprint",
  "Basic Microsoft Office computer skills",
  "Ability to stand for up to 7 hours in an 8 hour shift",
  "High School Diploma/GED",
];
const preferred = [
  "Boiler knowledge",
  "HVAC experience",
  "Experience and ability to perform welding activities including MIG, TIG, ARC, cutting and brazing",
];
const description = [
  "**Skills/Qualifications**",
  "Required",
  "",
  ...required.map((text) => `* ${text}`),
  "",
  "**Preferred**",
  "",
  ...preferred.map((text) => `* ${text}`),
  "**Benefits**",
  "* Paid Vacation and Holidays",
  "In accordance with applicable laws (including human rights and accessibility legislation), accommodations will be provided in all parts of the hiring process. Applicants are required to make their needs known in advance.",
  "This job posting will remain open for at least five (5) days.",
].join("\n");

describe("stored Cintas qualification structure", () => {
  it("retains all six mandatory and three preferred qualifications, excluding headings and administrative notices", () => {
    const rows = extractApplicationRequirements(description);
    expect(rows.map((row) => row.text)).toEqual([...required, ...preferred]);
    expect(rows.map((row) => row.mandatory)).toEqual([
      ...required.map(() => true),
      ...preferred.map(() => false),
    ]);
    const mapped = mapApplicationRequirementsToEvidence({
      requirements: rows,
      profile: { basics: {} },
    });
    expect(mapped.evidenceMap).toEqual([]);
    expect(
      mapped.gaps.filter((gap) => gap.severity === "hard_gap"),
    ).toHaveLength(6);
    expect(
      mapped.gaps.filter((gap) => gap.severity === "warning"),
    ).toHaveLength(3);
  });

  it("preserves explicit mandatory conditions inside preferred sections and outside qualification lists", () => {
    const rows = extractApplicationRequirements(
      [
        description,
        "**Preferred**",
        "* Work authorization in Canada is required.",
        "* Certification is not required.",
        "**Other conditions**",
        "Applicants are required to hold a valid driver's licence.",
        "Must be available for at least five days per week.",
      ].join("\n"),
    );
    expect(rows.slice(9).map((row) => [row.text, row.mandatory])).toEqual([
      ["Work authorization in Canada is required.", true],
      ["Applicants are required to hold a valid driver's licence.", true],
      ["Must be available for at least five days per week.", true],
    ]);
  });
});
