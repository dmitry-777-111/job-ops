import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";

it("preserves confirmed document facts through versioning, draft persistence and QA", async () => {
  vi.resetModules();
  const directory = await mkdtemp(join(tmpdir(), "application-source-flow-"));
  process.env.DATA_DIR = directory;
  process.env.NODE_ENV = "test";
  process.env.JOBOPS_APP_MODE = "local";
  await import("../db/migrate");
  let { closeDb } = await import("../db/index");
  try {
    const profileRepo = await import("../repositories/candidate-profile");
    const old = await profileRepo.createMasterCareerProfileDraft({
      profile: { basics: { name: "Old test profile" } },
      source: "manual",
    });
    await profileRepo.activateMasterCareerProfileVersion(old.id);
    const { buildDefaultReactiveResumeDocument } = await import(
      "./rxresume/document"
    );
    const design = await import("./design-resume");
    const document = process.env.D_GATE_REPLAY_INPUT
      ? JSON.parse(await readFile(process.env.D_GATE_REPLAY_INPUT, "utf8"))
          .resumeJson
      : buildDefaultReactiveResumeDocument();
    if (!process.env.D_GATE_REPLAY_INPUT) {
      document.basics.name = "Test Candidate";
      document.sections.experience.items = [
        {
          id: "work",
          hidden: false,
          company: "Factory",
          position: "Mechanic",
          location: "",
          period: "Aug 2020 - May 2023",
          website: { url: "", label: "" },
          description: "Equipment installation",
          roles: [],
        },
      ];
    }
    const saved = await design.replaceCurrentDesignResumeDocument({
      resumeJson: document,
      sourceMode: null,
      sourceResumeId: null,
      importedAt: new Date().toISOString(),
    });
    const { confirmOnboardingResumeAction } = await import(
      "./onboarding-status"
    );
    await confirmOnboardingResumeAction({ source: `local:${saved.id}` });
    const active = await profileRepo.getActiveMasterCareerProfile();
    expect(active?.id).not.toBe(old.id);
    expect(active?.sourceRef).toBe(`local:${saved.id}`);
    expect(active?.profile).toEqual(
      await design.designResumeToProfile(saved.resumeJson),
    );
    expect(
      (await profileRepo.getMasterCareerProfileVersion(old.id))?.status,
    ).toBe("superseded");
    expect(
      active?.profile.sections?.experience?.items?.map((x) => x.date),
    ).toEqual(saved.resumeJson.sections.experience.items.map((x) => x.period));
    const strategyRepo = await import("../repositories/candidate-strategy");
    const strategy = await strategyRepo.createCandidateStrategyDraft({
      targetMarkets: ["canada"],
      targetRoleFamilies: ["maintenance"],
    });
    await strategyRepo.activateCandidateStrategyVersion(strategy.id);
    const market = await import("../repositories/market-inventory");
    const { posting } = await market.recordMarketPostingObservation({
      source: "isolated-test",
      authority: "official",
      sourceUrl: "https://example.com/test-vacancy",
      employer: "Test Employer",
      title: "Mechanic",
      description: "**Required Skills**\n- PLC knowledge",
      isLive: true,
    });
    await market.attachMarketPostingToCandidate({
      marketPostingId: posting.id,
    });
    const { prepareApplicationPackageDraft } = await import(
      "./application-package-draft"
    );
    const { applicationPackage } = await prepareApplicationPackageDraft({
      marketPostingId: posting.id,
    });
    const packages = await import("../repositories/application-packages");
    expect(await packages.getApplicationPackage(applicationPackage.id)).toEqual(
      applicationPackage,
    );
    expect(applicationPackage.profileVersionId).toBe(active?.id);
    expect(applicationPackage.targetedCvJson?.sections).toEqual(
      active?.profile.sections,
    );
    expect(applicationPackage.approvedAt).toBeNull();
    const { evaluateStoredApplicationPackageQa } = await import(
      "./application-package-approval"
    );
    const { qa } = await evaluateStoredApplicationPackageQa({
      applicationPackageId: applicationPackage.id,
    });
    expect(qa.blockingIssues).not.toContain(
      "targeted_cv_changes_candidate_facts",
    );
    const { exportApplicationPackage } = await import(
      "./application-package-export"
    );
    await expect(
      exportApplicationPackage({ applicationPackageId: applicationPackage.id }),
    ).rejects.toThrow("approved before export");
    closeDb();
    vi.resetModules();
    ({ closeDb } = await import("../db/index"));
    const reopened = await import("../repositories/application-packages");
    expect(await reopened.getApplicationPackage(applicationPackage.id)).toEqual(
      applicationPackage,
    );
    if (process.env.D_GATE_REPLAY_OUTPUT)
      await writeFile(
        process.env.D_GATE_REPLAY_OUTPUT,
        JSON.stringify(
          {
            at: new Date().toISOString(),
            isolatedReplay: true,
            realVacancyAcceptance: false,
            profile: active,
            package: applicationPackage,
            qa,
            readbackEqual: true,
            unapprovedExportBlocked: true,
          },
          null,
          2,
        ),
      );
  } finally {
    closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);
