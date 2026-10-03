import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, stopServer } from "../api/routes/test-utils";

describe.sequential("G5 minimal legacy migration", () => {
  let server: Server;
  let baseUrl: string;
  let closeDb: () => void;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ server, baseUrl, closeDb, tempDir } = await startServer());
    void baseUrl;
  });

  afterEach(async () => {
    await stopServer({ server, closeDb, tempDir });
  });

  const evidence = (
    kind:
      | "submission"
      | "interview"
      | "rejection"
      | "no_sponsorship"
      | "mandatory_license"
      | "us_authorization_required",
  ) => ({
    kind,
    sourceType: "manual_verified" as const,
    note: `Verified legacy evidence for ${kind}`,
    verifiedBy: "user" as const,
  });

  function manifest() {
    return {
      version: 1 as const,
      sourceTitle: "Job Application Tracker",
      sourceUrl: "https://docs.google.com/spreadsheets/d/test/edit",
      exportedAt: "2026-10-02T18:30:00.000Z",
      jobs: [
        {
          legacyId: "active-1",
          title: "Field Service Technician",
          employer: "Target OEM",
          jobUrl: "https://example.com/jobs/active-1",
          state: "active" as const,
          nextAction:
            "Verify current posting and apply if hard gates are clear.",
          nextActionReason: "Current actionable vacancy retained by G5.",
          hardFacts: [],
        },
        {
          legacyId: "applied-1",
          title: "Commissioning Specialist",
          employer: "Applied OEM",
          jobUrl: "https://example.com/jobs/applied-1",
          state: "applied" as const,
          appliedAt: "2026-09-07T14:00:00.000Z",
          applicationEvidence: evidence("submission"),
          nextAction: "Monitor employer response.",
          nextActionReason:
            "Submission is confirmed and duplicate application is blocked.",
          hardFacts: [],
          immigration: {
            nocCode: "22310",
            employerSupportStatus: "unknown" as const,
            wageHourlyCad: 40,
            evidence: [
              {
                sourceType: "document" as const,
                sourceUrl: "https://example.com/jobs/applied-1",
                note: "Official posting evidence reviewed by user.",
                verifiedBy: "user" as const,
              },
            ],
          },
        },
        {
          legacyId: "interview-1",
          title: "Service Technician II",
          employer: "Interview OEM",
          jobUrl: "https://example.com/jobs/interview-1",
          state: "interview" as const,
          appliedAt: "2026-08-01T14:00:00.000Z",
          applicationEvidence: evidence("submission"),
          interviewStage: "recruiter_screen" as const,
          interviewAt: 1786200000,
          interviewEvidence: evidence("interview"),
          nextAction: "Wait for a policy or authorization trigger.",
          nextActionReason:
            "A real recruiter contact exists but transition is blocked.",
          hardFacts: [
            {
              factKey: "no_sponsorship" as const,
              evidence: evidence("no_sponsorship"),
            },
          ],
        },
        {
          legacyId: "rejected-1",
          title: "Mechanical Field Representative",
          employer: "Closed OEM",
          jobUrl: "https://example.com/jobs/rejected-1",
          state: "rejected" as const,
          appliedAt: "2026-09-07T14:00:00.000Z",
          applicationEvidence: evidence("submission"),
          interviewStage: "recruiter_screen" as const,
          interviewAt: 1789000000,
          interviewEvidence: evidence("interview"),
          rejectedAt: 1790265600,
          rejectionEvidence: evidence("rejection"),
          nextAction: "No action on this requisition.",
          nextActionReason: "Employer rejection is confirmed.",
          hardFacts: [],
        },
      ],
      targetCompanies: [
        "Target OEM",
        "Applied OEM",
        "Priority Automation Inc.",
      ],
      contacts: [
        {
          jobLegacyId: "interview-1",
          name: "Verified Recruiter",
          role: "Recruiter",
          influenceScore: 1,
          bridgeLevel: "B1" as const,
          bridgeEvidence: "Direct recruiter contact confirmed by user.",
          outcome: "contacted",
        },
      ],
    };
  }

  it("rejects unsupported legacy noise and unverified state claims", async () => {
    const { legacyCareerOsManifestSchema } = await import(
      "@server/services/legacy-career-os-migration"
    );
    const base = manifest();
    expect(() =>
      legacyCareerOsManifestSchema.parse({
        ...base,
        jobs: [
          {
            ...base.jobs[0],
            legacyScore: 99,
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      legacyCareerOsManifestSchema.parse({
        ...base,
        jobs: [
          {
            ...base.jobs[1],
            applicationEvidence: undefined,
          },
        ],
      }),
    ).toThrow();

    expect(() =>
      legacyCareerOsManifestSchema.parse({
        ...base,
        contacts: [
          {
            jobLegacyId: "interview-1",
            name: "Unsupported Bridge",
            influenceScore: 2,
            bridgeLevel: "B2",
          },
        ],
      }),
    ).toThrow();
  });

  it("migrates only compact decision state with evidence", async () => {
    const { migrateLegacyCareerOs } = await import(
      "@server/services/legacy-career-os-migration"
    );
    const { db, schema } = await import("@server/db/index");
    const jobsRepo = await import("@server/repositories/jobs");
    const { getStageEvents } = await import(
      "@server/services/applicationTracking"
    );
    const result = await migrateLegacyCareerOs(manifest());
    expect(result).toEqual({
      jobsProcessed: 4,
      activeJobs: 1,
      applications: 3,
      interviews: 2,
      rejections: 1,
      targetCompanies: 3,
      contacts: 1,
    });

    const applied = await jobsRepo.getJobByUrl(
      "https://example.com/jobs/applied-1",
    );
    expect(applied?.status).toBe("applied");
    expect((await jobsRepo.listJobNotes(applied!.id))[0]?.content).toContain(
      "Next action: Monitor employer response.",
    );

    const interview = await jobsRepo.getJobByUrl(
      "https://example.com/jobs/interview-1",
    );
    expect(interview?.status).toBe("in_progress");
    expect(
      (await getStageEvents(interview!.id)).map((event) => event.toStage),
    ).toEqual(["applied", "recruiter_screen"]);

    const rejected = await jobsRepo.getJobByUrl(
      "https://example.com/jobs/rejected-1",
    );
    expect(rejected?.outcome).toBe("rejected");

    const facts = await db.select().from(schema.jobVerifiedFacts);
    expect(facts).toHaveLength(1);
    expect(facts[0]?.factKey).toBe("no_sponsorship");

    const profiles = await db.select().from(schema.jobImmigrationProfiles);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]?.nocCode).toBe("22310");

    const companies = await db.select().from(schema.humanBridgeCompanies);
    expect(companies.map((row) => row.name).sort()).toEqual([
      "Applied OEM",
      "Interview OEM",
      "Priority Automation Inc.",
      "Target OEM",
    ]);

    const contacts = await db.select().from(schema.humanBridgeContacts);
    expect(contacts).toHaveLength(1);
    expect(contacts[0]?.name).toBe("Verified Recruiter");
  });

  it("is idempotent when the same manifest is resumed after interruption", async () => {
    const { migrateLegacyCareerOs } = await import(
      "@server/services/legacy-career-os-migration"
    );
    const { db, schema } = await import("@server/db/index");
    const jobsRepo = await import("@server/repositories/jobs");
    const { getStageEvents } = await import(
      "@server/services/applicationTracking"
    );
    await migrateLegacyCareerOs(manifest());
    await migrateLegacyCareerOs(manifest());

    expect(await db.select().from(schema.jobs)).toHaveLength(4);
    expect(await db.select().from(schema.humanBridgeContacts)).toHaveLength(1);

    const rejected = await jobsRepo.getJobByUrl(
      "https://example.com/jobs/rejected-1",
    );
    expect(
      (await getStageEvents(rejected!.id)).map((event) => event.toStage),
    ).toEqual(["applied", "recruiter_screen", "closed"]);
    expect(await jobsRepo.listJobNotes(rejected!.id)).toHaveLength(1);
  });
});
