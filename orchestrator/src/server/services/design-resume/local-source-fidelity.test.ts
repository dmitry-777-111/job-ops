import { expect, it } from "vitest";
import { buildLocalTextFallbackResume as parse } from "./import-file";

it("retains separate pipe-delimited work and education records without borrowing dates as contact details", () => {
  const r = parse(
    `TEST CANDIDATE
Technician
PROFESSIONAL PROFILE
No PLC programming expertise.
PROFESSIONAL EXPERIENCE
Mechanic | Example & Co | Toronto | Nov 2024 - Present
Repair pumps <5 kW.
EARLIER TECHNICAL EXPERIENCE
Technician | Earlier Co | 2019 - 2020
Maintained equipment.
EDUCATION
Degree | University | Canada | Completed
Diploma | College | Canada | Completed
LICENCES AND CREDENTIALS
309A assessment approved; examination stage.
TECHNICAL CAPABILITIES
PLC fault diagnostics and resets | HMI interfaces`,
    "test.docx",
  );
  expect(r.basics.phone).toBe("");
  expect(r.sections.experience.items).toHaveLength(2);
  expect(r.sections.experience.items[0]).toMatchObject({
    company: "Example & Co",
    position: "Mechanic",
    period: "Nov 2024 - Present",
  });
  expect(r.sections.experience.items[0].description).toContain("&lt;5");
  expect(r.sections.education.items.map((x) => x.school)).toEqual([
    "University",
    "College",
  ]);
  expect(r.summary.content).toContain("examination stage");
  expect(r.summary.content).not.toContain("Repair pumps");
  expect(r.sections.skills.items).toHaveLength(2);
});
