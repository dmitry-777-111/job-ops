import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it, vi } from "vitest";

it("SIMULATED ONLY: editorial review, explicit approval, export and outcome survive reopening", async () => {
  vi.resetModules();
  const directory = await mkdtemp(join(tmpdir(), "d-simulated-flow-"));
  process.env.DATA_DIR = directory;
  process.env.NODE_ENV = "test";
  process.env.JOBOPS_APP_MODE = "local";
  await import("../db/migrate");
  let { closeDb } = await import("../db/index");
  try {
    const profiles = await import("../repositories/candidate-profile");
    const profile = await profiles.createMasterCareerProfileDraft({
      source: "manual",
      profile: {
        basics: {
          name: "Synthetic Candidate",
          summary: "Industrial technician. No US travel.",
        },
        sections: {
          skills: {
            items: [
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
      },
    });
    await profiles.activateMasterCareerProfileVersion(profile.id);
    const strategies = await import("../repositories/candidate-strategy");
    const strategy = await strategies.createCandidateStrategyDraft({
      targetMarkets: ["canada"],
      targetRoleFamilies: ["maintenance"],
    });
    await strategies.activateCandidateStrategyVersion(strategy.id);
    const market = await import("../repositories/market-inventory");
    const { posting } = await market.recordMarketPostingObservation({
      source: "synthetic",
      authority: "official",
      sourceUrl: "https://example.com/simulated-only",
      employer: "Synthetic Employer",
      title: "Technician",
      description: "PLC knowledge is required.",
      isLive: true,
    });
    await market.attachMarketPostingToCandidate({
      marketPostingId: posting.id,
    });
    const jobs = await import("../repositories/jobs");
    const job = await jobs.createJob({
      source: "manual",
      title: posting.title,
      employer: posting.employer,
      jobUrl: posting.canonicalUrl ?? "https://example.com/simulated-only",
    });
    const { prepareApplicationPackageDraft } = await import(
      "./application-package-draft"
    );
    const { applicationPackage: draft } = await prepareApplicationPackageDraft({
      marketPostingId: posting.id,
    });
    const packages = await import("../repositories/application-packages");
    const reviewed = await packages.updateApplicationPackage(draft.id, {
      status: "review",
      coverLetter: (draft.coverLetter ?? "").replace(
        "Dear Hiring Team,",
        "Dear Hiring Manager,",
      ),
    });
    const { getApplicationPackageReview } = await import(
      "./application-package-review"
    );
    expect(
      (await getApplicationPackageReview({ applicationPackageId: draft.id })).qa
        .pass,
    ).toBe(true);
    const { exportApplicationPackage } = await import(
      "./application-package-export"
    );
    await expect(
      exportApplicationPackage({ applicationPackageId: draft.id }),
    ).rejects.toThrow("approved before export");
    const { approveApplicationPackage } = await import(
      "./application-package-approval"
    );
    await approveApplicationPackage({ applicationPackageId: draft.id });
    const exported = await exportApplicationPackage({
      applicationPackageId: draft.id,
    });
    expect(exported.artifact.document.coverLetter).toBe(reviewed?.coverLetter);
    expect(exported.artifact.document.targetedCvJson).toEqual(
      reviewed?.targetedCvJson,
    );
    expect(exported.applicationPackage.approvedAt).not.toBeNull();
    expect(exported.applicationPackage.exportedAt).not.toBeNull();
    const note = await jobs.createJobNote({
      jobId: job.id,
      title: "SIMULATED test review",
      content: "No real approval, application or employer response.",
    });
    const tracking = await import("./applicationTracking");
    const event = tracking.transitionStage(
      job.id,
      "closed",
      undefined,
      {
        evidence: {
          kind: "rejection",
          sourceType: "manual_verified",
          verifiedBy: "user",
          note: "SIMULATED test outcome only",
        },
      },
      "rejected",
    );
    closeDb();
    vi.resetModules();
    ({ closeDb } = await import("../db/index"));
    expect(
      await (
        await import("../repositories/application-packages")
      ).getApplicationPackage(draft.id),
    ).toEqual(exported.applicationPackage);
    const reopenedJobs = await import("../repositories/jobs");
    expect(await reopenedJobs.listJobNotes(job.id)).toEqual(
      expect.arrayContaining([note]),
    );
    expect(await reopenedJobs.getJobById(job.id)).toMatchObject({
      outcome: "rejected",
    });
    expect(
      await (await import("./applicationTracking")).getStageEvents(job.id),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: event.id, outcome: "rejected" }),
      ]),
    );
  } finally {
    closeDb();
    await rm(directory, { recursive: true, force: true });
  }
}, 60000);
