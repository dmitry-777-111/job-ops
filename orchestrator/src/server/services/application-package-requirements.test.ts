import type { ResumeProfile } from "@shared/types";
import { describe, expect, it } from "vitest";
import {
  buildProfileEvidenceAtoms,
  extractApplicationRequirements,
  mapApplicationRequirementsToEvidence,
} from "./application-package-requirements";

const profile: ResumeProfile = {
  basics: {
    headline: "Industrial Electromechanic",
  },
  sections: {
    skills: {
      items: [
        {
          id: "skill-plc",
          name: "PLC",
          description: "PLC troubleshooting",
          level: 3,
          keywords: ["PLC", "troubleshooting"],
          visible: true,
        },
        {
          id: "skill-pneumatics",
          name: "Pneumatics",
          description: "",
          level: 3,
          keywords: [],
          visible: true,
        },
      ],
    },
    experience: {
      items: [
        {
          id: "exp-fiera",
          company: "Fiera",
          position: "Electromechanic",
          location: "Toronto",
          date: "2024-present",
          summary: "Industrial maintenance and troubleshooting.",
          visible: true,
        },
      ],
    },
  },
};

describe("F3-6B application requirements and evidence mapping", () => {
  it("extracts only explicit required/preferred statements with stable keys", () => {
    const description = [
      "You will support customer equipment.",
      "PLC knowledge is required.",
      "A 309A licence is preferred.",
      "Must be legally authorized to work in Canada.",
    ].join("\n");
    const first = extractApplicationRequirements(description);
    const second = extractApplicationRequirements(description);

    expect(first).toHaveLength(3);
    expect(first.map((item) => item.category)).toEqual([
      "skill",
      "licence",
      "work_authorization",
    ]);
    expect(first.map((item) => item.mandatory)).toEqual([true, false, true]);
    expect(first.map((item) => item.key)).toEqual(
      second.map((item) => item.key),
    );
  });

  it("builds profile evidence with stable source references", () => {
    const atoms = buildProfileEvidenceAtoms(profile);
    expect(atoms).toContainEqual({
      ref: "sections.skills.skill-plc.name",
      text: "PLC",
      kind: "skill",
    });
    expect(atoms).toContainEqual({
      ref: "sections.experience.exp-fiera.summary",
      text: "Industrial maintenance and troubleshooting.",
      kind: "experience",
    });
  });

  it("maps only conservative verified skill evidence and leaves unsupported facts as gaps", () => {
    const requirements = extractApplicationRequirements(
      [
        "PLC knowledge is required.",
        "Five years of PLC programming experience is required.",
        "A 309A licence is required.",
      ].join("\n"),
    );

    const result = mapApplicationRequirementsToEvidence({
      requirements,
      profile,
    });

    expect(result.evidenceMap).toHaveLength(1);
    expect(result.evidenceMap[0]).toMatchObject({
      requirementText: "PLC knowledge is required.",
      evidenceSource: "profile",
      evidenceRef: "sections.skills.skill-plc.name",
      evidenceText: "PLC",
      confidence: 1,
    });

    expect(result.gaps).toHaveLength(2);
    expect(result.gaps.map((gap) => gap.requirementText)).toEqual([
      "Five years of PLC programming experience is required.",
      "A 309A licence is required.",
    ]);
    expect(result.gaps.every((gap) => gap.severity === "hard_gap")).toBe(true);
  });

  it("never infers licence or work-authorization facts from unrelated resume text", () => {
    const requirements = extractApplicationRequirements(
      [
        "Canadian citizenship is required.",
        "A valid driver's licence is required.",
      ].join("\n"),
    );

    const result = mapApplicationRequirementsToEvidence({
      requirements,
      profile: {
        ...profile,
        basics: {
          summary:
            "Worked in Canada on industrial equipment and regularly drove to customer sites.",
        },
      },
    });

    expect(result.evidenceMap).toEqual([]);
    expect(result.gaps).toHaveLength(2);
  });
});
