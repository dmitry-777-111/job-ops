import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe.sequential("Application Tracking Service", () => {
  let tempDir: string;
  let db: any;
  let schema: any;
  let applicationTracking: any;
  let jobsRepo: any;

  function evidence(kind: "submission" | "interview" | "rejection") {
    return {
      kind,
      sourceType: "manual_verified",
      note: `Verified ${kind} in test`,
      verifiedBy: "user",
    } as const;
  }

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-service-test-"));
    process.env.DATA_DIR = tempDir;
    process.env.NODE_ENV = "test";

    // Run migrations
    await import("../db/migrate");

    // Import modules after env is set
    const dbModule = await import("../db/index");
    db = dbModule.db;
    schema = dbModule.schema;

    applicationTracking = await import("./applicationTracking");
    jobsRepo = await import("../repositories/jobs");
  });

  afterEach(async () => {
    const { closeDb } = await import("../db/index");
    closeDb();
    await rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("transitions stage and updates job status", async () => {
    const job = await jobsRepo.createJob({
      source: "manual",
      title: "Test Developer",
      employer: "Tech Corp",
      jobUrl: "https://example.com/job/1",
    });

    // 1. Initial Transition (Applied)
    const event1 = applicationTracking.transitionStage(
      job.id,
      "applied",
      undefined,
      { evidence: evidence("submission") },
    );

    expect(event1.toStage).toBe("applied");

    // Check Job Status
    const jobAfter1 = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, job.id))
      .get();
    expect(jobAfter1?.status).toBe("applied");
    expect(jobAfter1?.appliedAt).toBeTruthy();

    // 2. Next Transition (Recruiter Screen)
    const event2 = applicationTracking.transitionStage(
      job.id,
      "recruiter_screen",
      undefined,
      { evidence: evidence("interview") },
    );
    expect(event2.fromStage).toBe("applied");
    expect(event2.toStage).toBe("recruiter_screen");

    // Check Job Status (moves to in_progress beyond applied stage)
    const jobAfter2 = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, job.id))
      .get();
    expect(jobAfter2?.status).toBe("in_progress");
  });

  it("sets readyAt the first time a job moves to ready and does not overwrite it", async () => {
    const job = await jobsRepo.createJob({
      source: "manual",
      title: "Full Stack Engineer",
      employer: "Ready Corp",
      jobUrl: "https://example.com/job/ready",
    });

    const firstReady = await jobsRepo.updateJob(job.id, { status: "ready" });
    expect(firstReady?.readyAt).toBeTruthy();

    const originalReadyAt = firstReady?.readyAt ?? null;

    const movedApplied = await jobsRepo.updateJob(job.id, {
      status: "applied",
    });
    expect(movedApplied?.readyAt).toBe(originalReadyAt);

    const movedReadyAgain = await jobsRepo.updateJob(job.id, {
      status: "ready",
    });
    expect(movedReadyAgain?.readyAt).toBe(originalReadyAt);
  });

  it("updates stage event and reflects in job status if latest", async () => {
    const job = await jobsRepo.createJob({
      source: "manual",
      title: "Frontend Engineer",
      employer: "Web Co",
      jobUrl: "https://example.com/job/2",
    });

    const now = Math.floor(Date.now() / 1000);
    applicationTracking.transitionStage(job.id, "applied", now - 100, {
      evidence: evidence("submission"),
    });
    const event2 = applicationTracking.transitionStage(
      job.id,
      "recruiter_screen",
      now,
      { evidence: evidence("interview") },
    );

    // Update event2 (latest) to 'offer'
    applicationTracking.updateStageEvent(event2.id, { toStage: "offer" });

    // Verify Event Updated
    const events = await applicationTracking.getStageEvents(job.id);
    const updatedEvent2 = events.find((e: any) => e.id === event2.id);
    expect(updatedEvent2?.toStage).toBe("offer");

    // Verify Job Status Updated
    const jobUpdated = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, job.id))
      .get();
    expect(jobUpdated?.status).toBe("in_progress");
    expect(jobUpdated?.outcome).toBe("offer_accepted");
  });

  it("deletes stage event and reverts job status", async () => {
    const job = await jobsRepo.createJob({
      source: "manual",
      title: "Backend Engineer",
      employer: "Server Co",
      jobUrl: "https://example.com/job/3",
    });

    const now = Math.floor(Date.now() / 1000);
    applicationTracking.transitionStage(job.id, "applied", now - 100, {
      evidence: evidence("submission"),
    }); // event1

    // Simulate UI sending outcome for rejection
    const event2 = applicationTracking.transitionStage(
      job.id,
      "closed",
      now,
      { reasonCode: "Skills", evidence: evidence("rejection") },
      "rejected",
    ); // event2

    // Verify job is closed/rejected
    let jobCheck = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, job.id))
      .get();
    expect(jobCheck?.status).toBe("in_progress");
    expect(jobCheck?.outcome).toBe("rejected");

    // Delete event2
    applicationTracking.deleteStageEvent(event2.id);

    // Verify job status reverted to event1 (applied)
    jobCheck = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, job.id))
      .get();
    expect(jobCheck?.status).toBe("applied");
    expect(jobCheck?.outcome).toBeNull();
  });

  it('handles "no_change" transitions (notes)', async () => {
    const job = await jobsRepo.createJob({
      source: "manual",
      title: "DevOps",
      employer: "Cloud Inc",
      jobUrl: "https://example.com/job/4",
    });

    applicationTracking.transitionStage(job.id, "applied", undefined, {
      evidence: evidence("submission"),
    });
    const noteEvent = applicationTracking.transitionStage(
      job.id,
      "no_change",
      undefined,
      {
        note: "Just checking in",
      },
    );

    expect(noteEvent.toStage).toBe("applied");

    const events = await applicationTracking.getStageEvents(job.id);
    expect(events).toHaveLength(2);
    expect(events[1].metadata?.note).toBe("Just checking in");
  });

  it("updates closedAt when outcome changes via event update/delete", async () => {
    const job = await jobsRepo.createJob({
      source: "manual",
      title: "QA Engineer",
      employer: "Test Labs",
      jobUrl: "https://example.com/job/5",
    });

    const now = Math.floor(Date.now() / 1000);
    applicationTracking.transitionStage(job.id, "applied", now - 100, {
      evidence: evidence("submission"),
    });
    const event2 = applicationTracking.transitionStage(
      job.id,
      "closed",
      now,
      { reasonCode: "Other", evidence: evidence("rejection") },
      "rejected",
    );

    let jobCheck = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, job.id))
      .get();
    expect(jobCheck?.outcome).toBe("rejected");
    expect(jobCheck?.closedAt).toBe(now);

    // 1. Update event2 to not be a closure
    applicationTracking.updateStageEvent(event2.id, {
      toStage: "technical_interview",
      metadata: { evidence: evidence("interview") },
    });
    jobCheck = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, job.id))
      .get();
    expect(jobCheck?.outcome).toBeNull();
    expect(jobCheck?.closedAt).toBeNull();

    // 2. Update event2 back to a closure
    applicationTracking.updateStageEvent(event2.id, { toStage: "offer" });
    jobCheck = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, job.id))
      .get();
    expect(jobCheck?.outcome).toBe("offer_accepted");
    expect(jobCheck?.closedAt).toBe(now);

    // 3. Delete the closure event
    applicationTracking.deleteStageEvent(event2.id);
    jobCheck = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, job.id))
      .get();
    expect(jobCheck?.outcome).toBeNull();
    expect(jobCheck?.closedAt).toBeNull();
  });

  it("sets closedAt when a closed stage event is logged without outcome", async () => {
    const job = await jobsRepo.createJob({
      source: "manual",
      title: "Platform Engineer",
      employer: "Infra Co",
      jobUrl: "https://example.com/job/7",
    });

    const now = Math.floor(Date.now() / 1000);
    applicationTracking.transitionStage(job.id, "applied", now - 100, {
      evidence: evidence("submission"),
    });
    applicationTracking.transitionStage(job.id, "closed", now);

    const jobCheck = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, job.id))
      .get();
    expect(jobCheck?.status).toBe("in_progress");
    expect(jobCheck?.outcome).toBeNull();
    expect(jobCheck?.closedAt).toBe(now);
  });

  it("preserves explicit outcome when updating metadata", async () => {
    const job = await jobsRepo.createJob({
      source: "manual",
      title: "Support Engineer",
      employer: "Helpdesk Co",
      jobUrl: "https://example.com/job/6",
    });

    const now = Math.floor(Date.now() / 1000);
    applicationTracking.transitionStage(job.id, "applied", now - 100, {
      evidence: evidence("submission"),
    });
    const closedEvent = applicationTracking.transitionStage(
      job.id,
      "closed",
      now,
      { reasonCode: "Other" },
      "withdrawn",
    );

    applicationTracking.updateStageEvent(closedEvent.id, {
      metadata: { note: "Withdrew after offer" },
    });

    const jobCheck = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, job.id))
      .get();
    expect(jobCheck?.outcome).toBe("withdrawn");
    expect(jobCheck?.closedAt).toBe(now);
  });

  it("rejects critical transitions without matching evidence", async () => {
    const job = await jobsRepo.createJob({
      source: "manual",
      title: "Evidence Guardrail",
      employer: "Guardrail Co",
      jobUrl: "https://example.com/job/evidence-guardrail",
    });

    expect(() =>
      applicationTracking.transitionStage(job.id, "applied"),
    ).toThrow(/submission evidence is required/i);

    applicationTracking.transitionStage(job.id, "applied", undefined, {
      evidence: evidence("submission"),
    });

    expect(() =>
      applicationTracking.transitionStage(job.id, "assessment"),
    ).toThrow(/interview evidence is required/i);

    expect(() =>
      applicationTracking.transitionStage(
        job.id,
        "closed",
        undefined,
        null,
        "rejected",
      ),
    ).toThrow(/rejection evidence is required/i);
  });

  it("does not allow updateStageEvent to bypass evidence requirements", async () => {
    const job = await jobsRepo.createJob({
      source: "manual",
      title: "Evidence Update Guardrail",
      employer: "Guardrail Co",
      jobUrl: "https://example.com/job/evidence-update-guardrail",
    });

    const applied = applicationTracking.transitionStage(
      job.id,
      "applied",
      undefined,
      { evidence: evidence("submission") },
    );

    expect(() =>
      applicationTracking.updateStageEvent(applied.id, {
        toStage: "technical_interview",
      }),
    ).toThrow(/interview evidence is required/i);

    applicationTracking.updateStageEvent(applied.id, {
      toStage: "technical_interview",
      metadata: { evidence: evidence("interview") },
    });

    const events = await applicationTracking.getStageEvents(job.id);
    expect(events[0]?.toStage).toBe("technical_interview");
    expect(events[0]?.metadata?.evidence?.kind).toBe("interview");
  });
  it("blocks model actors, evidence replacement and no-change rejection bypasses", async () => {
    const job = await jobsRepo.createJob({
      source: "manual",
      title: "Guard",
      employer: "Fixture employer",
      jobUrl: "https://example.com/guard",
    });
    expect(() =>
      applicationTracking.transitionStage(job.id, "applied", undefined, {
        actor: "system",
        evidence: evidence("submission"),
      }),
    ).toThrow();
    expect(() =>
      applicationTracking.transitionStage(
        job.id,
        "no_change",
        undefined,
        null,
        "rejected",
      ),
    ).toThrow();
    const event = applicationTracking.transitionStage(
      job.id,
      "applied",
      undefined,
      { evidence: evidence("submission") },
    );
    expect(() =>
      applicationTracking.updateStageEvent(event.id, {
        metadata: { evidence: evidence("interview") },
      }),
    ).toThrow();
    applicationTracking.updateStageEvent(event.id, {
      metadata: { note: "New annotation" },
    });
    expect(
      (await applicationTracking.getStageEvents(job.id))[0].metadata.evidence,
    ).toEqual(evidence("submission"));
  });

  it("does not infer rejection from a reason or turn an edited note into Applied", async () => {
    const job = await jobsRepo.createJob({
      source: "manual",
      title: "Note",
      employer: "Fixture employer",
      jobUrl: "https://example.com/note",
    });
    const note = applicationTracking.transitionStage(
      job.id,
      "no_change",
      undefined,
      { eventType: "note", note: "AI suggestion only" },
    );
    applicationTracking.updateStageEvent(note.id, {
      metadata: { note: "Annotation" },
    });
    expect((await jobsRepo.getJobById(job.id)).status).toBe("discovered");
    applicationTracking.deleteStageEvent(note.id);
    expect((await jobsRepo.getJobById(job.id)).status).toBe("discovered");
    const closed = applicationTracking.transitionStage(
      job.id,
      "closed",
      undefined,
      { reasonCode: "AI classified rejection" },
    );
    applicationTracking.updateStageEvent(closed.id, {
      metadata: { note: "Still unverified" },
    });
    expect((await jobsRepo.getJobById(job.id)).outcome).toBeNull();
  });
});
