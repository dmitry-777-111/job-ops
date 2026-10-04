import type { MarketPosting, ResumeProfile } from "@shared/types";
import { describe, expect, it } from "vitest";
import { buildTruthConstrainedApplicationDraft } from "./application-package-generation";
import {
  extractApplicationRequirements,
  mapApplicationRequirementsToEvidence,
} from "./application-package-requirements";

const profile: ResumeProfile = {
  basics: {
    name: "Candidate",
    summary:
      "Industrial electromechanic working in Canada with maintenance and troubleshooting experience.",
  },
  sections: {
    skills: {
      items: [
        {
          id: "plc",
          name: "PLC",
          description: "PLC troubleshooting",
          level: 3,
          keywords: ["PLC", "troubleshooting"],
          visible: true,
        },
        {
          id: "pneumatics",
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
          id: "current",
          company: "Example",
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

const posting: MarketPosting = {
  id: "truth-posting",
  identityKey: "truth:posting",
  canonicalUrl: "https://example.com/truth",
  officialRequisitionId: "TRUTH-1",
  employer: "Example OEM",
  title: "Field Service Engineer",
  location: "Toronto",
  description: [
    "PLC knowledge is required.",
    "A valid 309A licence is required.",
    "Canadian citizenship is required.",
    "Fluent French is required.",
    "Seven years of PLC programming experience is required.",
    "SAP proficiency is required.",
    "A documented 20% downtime reduction achievement is required.",
  ].join("\n"),
  datePosted: null,
  deadline: null,
  salaryText: null,
  salaryCurrency: "CAD",
  contentFingerprint: "truth-fp",
  canonicalAuthority: "official",
  status: "live",
  firstObservedAt: "2026-10-04T12:00:00.000Z",
  lastObservedAt: "2026-10-04T12:00:00.000Z",
  lastLiveCheckedAt: "2026-10-04T12:00:00.000Z",
  closedAt: null,
  createdAt: "2026-10-04T12:00:00.000Z",
  updatedAt: "2026-10-04T12:00:00.000Z",
};

describe("F3-6F truth regression corpus", () => {
  it("keeps unsupported high-risk candidate claims as gaps and never writes them into generated documents", () => {
    const requirements = extractApplicationRequirements(posting.description);
    const mapped = mapApplicationRequirementsToEvidence({
      requirements,
      profile,
    });

    expect(mapped.evidenceMap).toHaveLength(1);
    expect(mapped.evidenceMap[0]).toMatchObject({
      requirementText: "PLC knowledge is required.",
      evidenceText: "PLC",
    });

    const unsupported = mapped.gaps.map((gap) => gap.requirementText);
    expect(unsupported).toEqual([
      "A valid 309A licence is required.",
      "Canadian citizenship is required.",
      "Fluent French is required.",
      "Seven years of PLC programming experience is required.",
      "SAP proficiency is required.",
      "A documented 20% downtime reduction achievement is required.",
    ]);

    const generated = buildTruthConstrainedApplicationDraft({
      posting,
      profile,
      evidenceMap: mapped.evidenceMap,
      gaps: mapped.gaps,
    });

    const generatedText = JSON.stringify(generated).toLowerCase();
    for (const forbiddenClaim of [
      "309a",
      "canadian citizenship",
      "fluent french",
      "seven years",
      "sap",
      "20% downtime",
    ]) {
      expect(generatedText).not.toContain(forbiddenClaim);
    }
  });

  it("does not promote working in Canada into citizenship or work authorization evidence", () => {
    const requirements = extractApplicationRequirements(
      [
        "Canadian citizenship is required.",
        "A valid open work permit is required.",
      ].join("\n"),
    );

    const mapped = mapApplicationRequirementsToEvidence({
      requirements,
      profile,
    });

    expect(mapped.evidenceMap).toEqual([]);
    expect(mapped.gaps).toHaveLength(2);
    expect(mapped.gaps.every((gap) => gap.severity === "hard_gap")).toBe(true);
  });

  it("does not promote basic PLC troubleshooting into years of programming experience", () => {
    const requirements = extractApplicationRequirements(
      "Seven years of PLC programming experience is required.",
    );

    expect(requirements).toHaveLength(1);
    expect(requirements[0].category).toBe("experience");

    const mapped = mapApplicationRequirementsToEvidence({
      requirements,
      profile,
    });

    expect(mapped.evidenceMap).toEqual([]);
    expect(mapped.gaps).toHaveLength(1);
  });
});
