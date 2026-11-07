import type {
  ApplicationPackage,
  MarketPosting,
  ResumeProfile,
} from "@shared/types";
import { describe, expect, it } from "vitest";
import {
  buildEvidenceBoundedCoverLetter,
  buildTruthConstrainedApplicationDraft,
} from "./application-package-generation";
import { evaluateApplicationPackageQa } from "./application-package-qa";
import {
  buildProfileEvidenceAtoms,
  extractApplicationRequirements,
  mapApplicationRequirementsToEvidence,
} from "./application-package-requirements";

const requirement =
  "2+ years' experience repairing industrial processing equipment in an industrial environment or in the military";
// Synthetic source; no candidate identity or employer history.
const summary =
  "<p>Worked in a manufacturing facility on production equipment and lines.</p><p>Maintained conveyors, motors and packaging machines. Performed mechanical and electrical troubleshooting and component replacement.</p>";
function profile(date = "Feb 2018 - Nov 2020", text = summary): ResumeProfile {
  return {
    sections: {
      experience: {
        items: [
          {
            id: "work",
            company: "Test factory",
            position: "Technician",
            location: "",
            date,
            summary: text,
            visible: true,
          },
        ],
      },
    },
  };
}
function map(candidate: ResumeProfile, text = requirement) {
  return mapApplicationRequirementsToEvidence({
    profile: candidate,
    requirements: extractApplicationRequirements(`Required\n* ${text}`),
  });
}

describe("dated industrial repair evidence", () => {
  it("keeps the other five mandatory gaps blocking QA while generating an anchored substantive cover", () => {
    const candidate = profile();
    const requirements = extractApplicationRequirements(
      `Required\n* ${requirement}\n* Ability to read maintenance literature printed in English\n* Experience with and ability to read a blueprint\n* Basic Microsoft Office computer skills\n* Ability to stand for up to 7 hours in an 8 hour shift\n* High School Diploma/GED`,
    );
    const mapped = mapApplicationRequirementsToEvidence({
      profile: candidate,
      requirements,
    });
    expect(mapped.evidenceMap).toHaveLength(1);
    expect(mapped.gaps).toHaveLength(5);
    const posting = {
      id: "test-posting",
      title: "Technician",
      employer: "Test factory",
      officialRequisitionId: null,
    } as MarketPosting;
    const generated = buildTruthConstrainedApplicationDraft({
      posting,
      profile: candidate,
      ...mapped,
    });
    const currentVersions = {
      marketPostingVersionId: "posting-v1",
      profileVersionId: "profile-v1",
      strategyVersionId: "strategy-v1",
      generationPolicyVersion: "freeze3-mvp-v1",
    };
    const applicationPackage: ApplicationPackage = {
      id: "test-package",
      version: 1,
      status: "draft",
      marketPostingId: posting.id,
      ...currentVersions,
      ...mapped,
      ...generated,
      approvedAt: null,
      exportedAt: null,
      staleReason: null,
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    };
    const check = () =>
      evaluateApplicationPackageQa({
        applicationPackage,
        posting,
        profile: candidate,
        currentVersions,
        liveState: "live",
      });
    expect(check()).toMatchObject({
      pass: false,
      hardGapCount: 5,
      blockingIssues: ["unresolved_hard_requirements"],
    });
    expect(generated.targetedCvJson).toEqual(candidate);
    applicationPackage.evidenceMap[0].evidenceText =
      "Invented repair experience";
    applicationPackage.coverLetter = buildEvidenceBoundedCoverLetter({
      posting,
      profile: candidate,
      evidenceMap: applicationPackage.evidenceMap,
    });
    expect(check().blockingIssues).toContain(
      "cover_letter_not_evidence_bounded",
    );
  });
  it("links completed industrial repair experience with its dates and exact source, without changing the profile", () => {
    const candidate = profile();
    const before = structuredClone(candidate);
    const result = map(candidate);
    expect(result.gaps).toEqual([]);
    expect(result.evidenceMap).toHaveLength(1);
    const evidence = result.evidenceMap[0];
    expect(evidence.evidenceRef).toBe("sections.experience.work.datedSummary");
    expect(evidence.evidenceText).toContain("Feb 2018 - Nov 2020");
    expect(evidence.evidenceText).toContain("component replacement");
    expect(buildProfileEvidenceAtoms(candidate)).toContainEqual({
      ref: evidence.evidenceRef,
      text: evidence.evidenceText,
      kind: "experience",
    });
    expect(
      buildEvidenceBoundedCoverLetter({
        posting: { title: "Technician", employer: "Test employer" },
        profile: candidate,
        evidenceMap: result.evidenceMap,
      }),
    ).toContain(evidence.evidenceText);
    expect(candidate).toEqual(before);
  });

  it.each([
    "Feb 2019 - Nov 2020",
    "2018 - 2021",
    "Feb 2018 - Present",
    "Nov 2020 - Feb 2018",
    "Feb 2018 - Feb 2020",
    "Feb 2090 - Nov 2093",
  ])("does not invent sufficient elapsed experience from %s", (date) => {
    expect(map(profile(date)).evidenceMap).toEqual([]);
    expect(map(profile(date)).gaps[0].severity).toBe("hard_gap");
  });
  it.each([
    "Worked in a manufacturing facility on production equipment. Observed component replacement and troubleshooting.",
    "Maintained office equipment; performed troubleshooting and component replacement.",
    "Worked in a manufacturing facility on production equipment. Did not perform repairs or component replacement.",
    "Worked in a manufacturing facility on production equipment. Maintained inventory records.",
  ])("rejects incomplete or negative source evidence", (text) => {
    expect(map(profile(undefined, text)).evidenceMap).toEqual([]);
  });
  it("does not transfer evidence between candidate profiles or combine unrelated roles", () => {
    expect(map(profile()).evidenceMap).toHaveLength(1);
    expect(map({ basics: {} }).evidenceMap).toEqual([]);
    const a = profile("Feb 2018 - Nov 2019");
    const b = profile("Feb 2018 - Nov 2019");
    const other = b.sections?.experience?.items?.[0];
    if (!other) throw new Error("Missing test experience");
    other.id = "other";
    a.sections?.experience?.items?.push(other);
    expect(map(a).evidenceMap).toEqual([]);
  });
  it.each([
    `${requirement} and PLC programming`,
    requirement.replace("industrial processing equipment", "forklifts"),
    "Ability to read maintenance literature printed in English",
    "Experience with and ability to read a blueprint",
    "Basic Microsoft Office computer skills",
    "Ability to stand for up to 7 hours in an 8 hour shift",
    "High School Diploma/GED",
    "A valid 309A licence",
    "Work authorization for this employer",
  ])("does not infer unrelated or additional qualifications: %s", (text) => {
    expect(map(profile(), text).evidenceMap).toEqual([]);
    expect(map(profile(), text).gaps).toHaveLength(1);
  });
});
