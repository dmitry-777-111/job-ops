import type {
  ApplicationPackage,
  MarketPosting,
  ResumeProfile,
} from "@shared/types";
import { describe, expect, it } from "vitest";
import { buildTruthConstrainedApplicationDraft } from "./application-package-generation";
import { evaluateApplicationPackageQa } from "./application-package-qa";

const profile: ResumeProfile = {
  basics: { name: "Candidate", summary: "Industrial technician." },
  sections: {
    skills: {
      items: [
        {
          id: "pneumatics",
          name: "Pneumatics",
          description: "",
          level: 3,
          keywords: [],
          visible: true,
        },
        {
          id: "plc",
          name: "PLC",
          description: "",
          level: 3,
          keywords: [],
          visible: true,
        },
      ],
    },
  },
};

const posting = {
  id: "posting-1",
  identityKey: "req:1",
  canonicalUrl: "https://example.com/1",
  officialRequisitionId: "REQ-1",
  employer: "Example",
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

const evidenceMap = [
  {
    requirementKey: "plc",
    requirementText: "PLC knowledge is required.",
    evidenceSource: "profile" as const,
    evidenceRef: "sections.skills.plc.name",
    evidenceText: "PLC",
    confidence: 1,
  },
];

function buildPackage(): ApplicationPackage {
  const generated = buildTruthConstrainedApplicationDraft({
    posting,
    profile,
    evidenceMap,
    gaps: [],
  });
  return {
    id: "package-1",
    version: 1,
    status: "draft",
    marketPostingId: posting.id,
    marketPostingVersionId: "posting-v1",
    profileVersionId: "profile-v1",
    strategyVersionId: "strategy-v1",
    generationPolicyVersion: "freeze3-mvp-v1",
    evidenceMap,
    gaps: [],
    targetedCvJson: generated.targetedCvJson,
    coverLetter: generated.coverLetter,
    formAnswers: generated.formAnswers,
    approvedAt: null,
    exportedAt: null,
    staleReason: null,
    createdAt: "2026-10-04T12:00:00.000Z",
    updatedAt: "2026-10-04T12:00:00.000Z",
  };
}

const currentVersions = {
  marketPostingVersionId: "posting-v1",
  profileVersionId: "profile-v1",
  strategyVersionId: "strategy-v1",
  generationPolicyVersion: "freeze3-mvp-v1",
};

describe("F3-6D application package QA truth gate", () => {
  it("passes a current deterministic evidence-bounded package", () => {
    const result = evaluateApplicationPackageQa({
      applicationPackage: buildPackage(),
      posting,
      profile,
      currentVersions,
      liveState: "live",
    });
    expect(result).toEqual({
      pass: true,
      blockingIssues: [],
      staleReasons: [],
      gapCount: 0,
      hardGapCount: 0,
    });
  });

  it("blocks candidate-fact mutations in the targeted CV", () => {
    const applicationPackage = buildPackage();
    const targeted = applicationPackage.targetedCvJson as ResumeProfile;
    targeted.basics = {
      ...targeted.basics,
      summary: "Licensed 309A electrician with ten years of PLC programming.",
    };

    const result = evaluateApplicationPackageQa({
      applicationPackage,
      posting,
      profile,
      currentVersions,
      liveState: "live",
    });

    expect(result.pass).toBe(false);
    expect(result.blockingIssues).toContain(
      "targeted_cv_changes_candidate_facts",
    );
  });

  it("blocks cover-letter claims that were not generated from verified evidence", () => {
    const applicationPackage = buildPackage();
    applicationPackage.coverLetter = `${applicationPackage.coverLetter}\nI hold a 309A licence.`;

    const result = evaluateApplicationPackageQa({
      applicationPackage,
      posting,
      profile,
      currentVersions,
      liveState: "live",
    });

    expect(result.blockingIssues).toContain(
      "cover_letter_not_evidence_bounded",
    );
  });

  it("blocks stale, closed, unknown-unacknowledged, and unsupported form-answer states", () => {
    const applicationPackage = buildPackage();
    applicationPackage.formAnswers = {
      workAuthorization: "I am a Canadian citizen.",
    };

    const stale = evaluateApplicationPackageQa({
      applicationPackage,
      posting,
      profile,
      currentVersions: {
        ...currentVersions,
        profileVersionId: "profile-v2",
      },
      liveState: "closed",
    });
    expect(stale.blockingIssues).toEqual(
      expect.arrayContaining([
        "unsupported_form_answers",
        "vacancy_closed",
        "package_stale",
      ]),
    );
    expect(stale.staleReasons).toContain("profile_changed");

    const unknown = evaluateApplicationPackageQa({
      applicationPackage: buildPackage(),
      posting,
      profile,
      currentVersions,
      liveState: "unknown",
    });
    expect(unknown.blockingIssues).toContain("vacancy_unknown_unacknowledged");

    const acknowledged = evaluateApplicationPackageQa({
      applicationPackage: buildPackage(),
      posting,
      profile,
      currentVersions,
      liveState: "unknown",
      acknowledgeUnknownLiveState: true,
    });
    expect(acknowledged.pass).toBe(true);
  });

  it("reports hard gaps without converting them into invented positive claims", () => {
    const applicationPackage = buildPackage();
    applicationPackage.gaps = [
      {
        requirementKey: "licence",
        requirementText: "309A licence is required.",
        severity: "hard_gap",
        explanation: "No verified evidence.",
      },
    ];

    const result = evaluateApplicationPackageQa({
      applicationPackage,
      posting,
      profile,
      currentVersions,
      liveState: "live",
    });

    expect(result.pass).toBe(true);
    expect(result.hardGapCount).toBe(1);
    expect(result.gapCount).toBe(1);
  });
});
