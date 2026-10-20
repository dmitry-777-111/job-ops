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
  it.each([
    ["Work authorization in Canada is required.", "work_authorization"],
    [
      "Must be authorised to work in Canada with PLC knowledge.",
      "work_authorization",
    ],
    ["The right to work in Canada is required.", "work_authorization"],
    ["Must be legally entitled to work in Canada.", "work_authorization"],
    ["Must travel to the USA for PLC training.", "travel"],
    ["A visa for travel to the United States is required.", "travel"],
    ["Travel to the U.S. is required.", "travel"],
  ])("keeps eligibility unsupported: %s", (text, category) => {
    const requirements = extractApplicationRequirements(text);
    expect(requirements).toHaveLength(1);
    expect(requirements[0]).toMatchObject({
      category,
      mandatory: true,
      sourceText: text,
    });
    for (const candidate of [
      profile,
      { basics: { summary: "Worked in Canada and visited the USA." } },
    ]) {
      const result = mapApplicationRequirementsToEvidence({
        requirements,
        profile: candidate,
      });
      expect(result.evidenceMap).toEqual([]);
      expect(result.gaps).toHaveLength(1);
      expect(result.gaps[0]?.explanation).toContain(
        "No verified candidate evidence",
      );
    }
  });

  it.each([
    "Travel to the USA is not required.",
    "Travel to the USA is not mandatory.",
    "Work authorization is not required.",
    "We serve customers in the USA and Canada.",
  ])("does not invent an eligibility requirement: %s", (text) => {
    expect(extractApplicationRequirements(text)).toEqual([]);
  });

  it("preserves independent mandatory authorization and optional USA travel", () => {
    const requirements = extractApplicationRequirements(
      "Work authorization in Canada is required; travel to the USA is preferred but not mandatory.",
    );
    expect(
      requirements.map(({ category, mandatory }) => ({ category, mandatory })),
    ).toEqual([
      { category: "work_authorization", mandatory: true },
      { category: "travel", mandatory: false },
    ]);
    expect(
      mapApplicationRequirementsToEvidence({ requirements, profile }).gaps.map(
        (gap) => gap.severity,
      ),
    ).toEqual(["hard_gap", "warning"]);
  });

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

  it("does not treat preferred but explicitly non-required qualifications as hard gaps", () => {
    const requirements = extractApplicationRequirements(
      "A 309A licence is preferred but not required.",
    );
    expect(requirements).toHaveLength(1);
    expect(requirements[0]?.mandatory).toBe(false);
    const result = mapApplicationRequirementsToEvidence({
      requirements,
      profile,
    });
    expect(result.gaps).toHaveLength(1);
    expect(result.gaps[0]?.severity).toBe("warning");
  });

  it("extracts Unicode bulleted requirements separately", () => {
    const requirements = extractApplicationRequirements(
      "• PLC knowledge is required.\n● 309A licence is preferred.\n▪ English is mandatory.",
    );
    expect(requirements).toHaveLength(3);
    expect(requirements.map((item) => item.mandatory)).toEqual([
      true,
      false,
      true,
    ]);
  });

  it("does not erase a mandatory clause when another qualification is optional", () => {
    const requirements = extractApplicationRequirements(
      "Must know PLC systems; 309A licence is preferred but not required.",
    );
    expect(requirements).toHaveLength(2);
    expect(requirements.map((item) => item.mandatory)).toEqual([true, false]);
    expect(requirements.map((item) => item.category)).toEqual([
      "skill",
      "licence",
    ]);
    const mapped = mapApplicationRequirementsToEvidence({
      requirements,
      profile,
    });
    expect(
      mapped.gaps.find((gap) => gap.requirementText.includes("309A"))?.severity,
    ).toBe("warning");
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
