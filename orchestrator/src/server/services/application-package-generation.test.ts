import type {
  ApplicationEvidenceItem,
  MarketPosting,
  ResumeProfile,
} from "@shared/types";
import { describe, expect, it } from "vitest";
import {
  buildEvidenceBoundedCoverLetter,
  buildTruthConstrainedApplicationDraft,
} from "./application-package-generation";

const profile: ResumeProfile = {
  basics: {
    name: "Candidate Name",
    headline: "Industrial Electromechanic",
    summary: "Industrial maintenance technician.",
  },
  sections: {
    skills: {
      items: [
        {
          id: "pneumatics",
          name: "Pneumatics",
          description: "Pneumatic troubleshooting",
          level: 3,
          keywords: ["valves"],
          visible: true,
        },
        {
          id: "plc",
          name: "PLC",
          description: "PLC troubleshooting",
          level: 3,
          keywords: ["PLC"],
          visible: true,
        },
      ],
    },
    experience: {
      items: [
        {
          id: "exp-1",
          company: "Example Plant",
          position: "Electromechanic",
          location: "Toronto",
          date: "2024-present",
          summary: "Maintain industrial production equipment.",
          visible: true,
        },
      ],
    },
  },
};

const posting = {
  id: "posting-1",
  identityKey: "req:1",
  canonicalUrl: "https://example.com/jobs/1",
  officialRequisitionId: "REQ-1",
  employer: "Example OEM",
  title: "Field Service Engineer",
  location: "Toronto",
  description: "PLC knowledge is required.",
  datePosted: null,
  deadline: null,
  salaryText: null,
  salaryCurrency: "CAD",
  contentFingerprint: "fp",
  canonicalAuthority: "official",
  status: "live",
  firstObservedAt: "2026-10-04T10:00:00.000Z",
  lastObservedAt: "2026-10-04T12:00:00.000Z",
  lastLiveCheckedAt: "2026-10-04T12:00:00.000Z",
  closedAt: null,
  createdAt: "2026-10-04T10:00:00.000Z",
  updatedAt: "2026-10-04T12:00:00.000Z",
} satisfies MarketPosting;

const evidence: ApplicationEvidenceItem[] = [
  {
    requirementKey: "req-plc",
    requirementText: "PLC knowledge is required.",
    evidenceSource: "profile",
    evidenceRef: "sections.skills.plc.name",
    evidenceText: "PLC",
    confidence: 1,
  },
];

describe("F3-6C truth-constrained application generation", () => {
  it("creates a targeted CV only by reordering unchanged master-profile facts", () => {
    const result = buildTruthConstrainedApplicationDraft({
      posting,
      profile,
      evidenceMap: evidence,
      gaps: [],
    });

    const targeted = result.targetedCvJson as ResumeProfile;
    expect(targeted.sections?.skills?.items?.map((item) => item.id)).toEqual([
      "plc",
      "pneumatics",
    ]);
    expect(
      targeted.sections?.skills?.items?.find((item) => item.id === "plc"),
    ).toEqual(profile.sections?.skills?.items?.[1]);
    expect(targeted.sections?.experience).toEqual(profile.sections?.experience);
    expect(targeted.basics).toEqual(profile.basics);
    expect(profile.sections?.skills?.items?.map((item) => item.id)).toEqual([
      "pneumatics",
      "plc",
    ]);
    expect(result.changedFromMaster).toEqual([
      "sections.skills.items: reordered by verified vacancy relevance",
    ]);
  });

  it("builds cover-letter candidate facts only from exact verified evidence text", () => {
    const letter = buildEvidenceBoundedCoverLetter({
      posting,
      profile,
      evidenceMap: evidence,
    });

    expect(letter).toContain("Field Service Engineer");
    expect(letter).toContain("Example OEM");
    expect(letter).toContain("- PLC");
    expect(letter).toContain("Candidate Name");
    expect(letter).not.toContain("five years");
    expect(letter).not.toContain("309A");
    expect(letter).not.toContain("authorized to work");
  });

  it("does not convert unsupported gaps into positive claims", () => {
    const result = buildTruthConstrainedApplicationDraft({
      posting,
      profile,
      evidenceMap: [],
      gaps: [
        {
          requirementKey: "licence",
          requirementText: "309A licence is required.",
          severity: "hard_gap",
          explanation: "No verified candidate evidence was found.",
        },
      ],
    });

    expect(result.coverLetter).not.toContain("309A");
    expect(result.coverLetter).not.toContain("licence");
    expect(result.formAnswers).toEqual({});
  });

  it("does not rewrite master summary, experience, skills, or achievements", () => {
    const result = buildTruthConstrainedApplicationDraft({
      posting,
      profile,
      evidenceMap: evidence,
      gaps: [],
    });
    const targeted = result.targetedCvJson as ResumeProfile;

    expect(targeted.basics?.summary).toBe(profile.basics?.summary);
    expect(targeted.sections?.experience).toEqual(profile.sections?.experience);
    expect(targeted.sections?.skills?.items).toEqual([
      profile.sections?.skills?.items?.[1],
      profile.sections?.skills?.items?.[0],
    ]);
  });
});
