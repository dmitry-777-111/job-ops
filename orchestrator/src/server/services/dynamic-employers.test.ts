import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe.sequential("dynamic employer discovery", () => {
  const originalEnv = { ...process.env };
  let tempDir: string;
  let closeDb: (() => void) | null = null;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-dynamic-employer-"));
    vi.resetModules();
    process.env = {
      ...originalEnv,
      DATA_DIR: tempDir,
      NODE_ENV: "test",
      JOBOPS_TEST_AUTH_BYPASS: "0",
    };
    await import("@server/db/migrate");
    ({ closeDb } = await import("@server/db"));
    await createUser("user-a");
  });

  afterEach(async () => {
    closeDb?.();
    closeDb = null;
    process.env = { ...originalEnv };
    await rm(tempDir, { recursive: true, force: true });
  });

  async function createUser(id: string): Promise<void> {
    const { db, schema } = await import("@server/db");
    await db.insert(schema.users).values({
      id,
      username: id,
      displayName: id,
      passwordHash: "hash",
      passwordSalt: "salt",
    });
    await db.insert(schema.tenantMemberships).values({
      id: `membership-${id}`,
      userId: id,
      tenantId: "tenant_default",
      role: "member",
    });
  }

  async function withUser<T>(fn: () => Promise<T>): Promise<T> {
    const { runWithRequestContext } = await import("@infra/request-context");
    return runWithRequestContext(
      {
        requestId: "dynamic-employer-test",
        tenantId: "tenant_default",
        userId: "user-a",
        username: "user-a",
      },
      fn,
    );
  }

  it("promotes a selected Workday employer into active direct monitoring", async () => {
    const service = await import("./dynamic-employers");
    const watchlist = await import("@server/repositories/watchlist");
    const job = {
      employer: "Acme Industrial Inc.",
      source: "indeed" as const,
      jobUrl: "https://ca.indeed.com/viewjob?jk=123",
      applicationLink:
        "https://acme.wd1.myworkdayjobs.com/en-US/External/job/Toronto/Service-Technician_R123",
    };

    const observed = await withUser(() =>
      service.observeDynamicEmployerFromJob(job),
    );
    expect(observed).toMatchObject({
      normalizedName: "acme industrial",
      status: "candidate",
      sourceType: "workday",
      careersUrl: "https://acme.wd1.myworkdayjobs.com/External",
      observationCount: 1,
    });

    const active = await withUser(() =>
      service.activateDynamicEmployerFromJob(job),
    );
    expect(active).toMatchObject({
      status: "active",
      sourceType: "workday",
      careersUrl: "https://acme.wd1.myworkdayjobs.com/External",
      observationCount: 2,
    });

    const selected = await withUser(() =>
      watchlist.listWatchlistSelectedSources(),
    );
    expect(selected).toEqual([
      expect.objectContaining({
        label: "Acme Industrial Inc.",
        sourceType: "workday",
        careersUrl: "https://acme.wd1.myworkdayjobs.com/External",
        isCustom: true,
      }),
    ]);

    const events = await withUser(() =>
      service.listDynamicEmployerEvents(active!.id),
    );
    expect(events.map((event) => event.eventType)).toEqual([
      "candidate",
      "active",
    ]);
  });

  it("retains unsupported ATS employers without activating them", async () => {
    const service = await import("./dynamic-employers");
    const watchlist = await import("@server/repositories/watchlist");
    const job = {
      employer: "Beta Robotics",
      source: "linkedin" as const,
      jobUrl: "https://www.linkedin.com/jobs/view/123",
      applicationLink: "https://jobs.lever.co/betarobotics/abc-123",
    };

    const observed = await withUser(() =>
      service.observeDynamicEmployerFromJob(job),
    );
    expect(observed).toMatchObject({
      status: "ats_detected",
      sourceType: "lever",
      careersUrl: "https://jobs.lever.co/betarobotics",
    });

    const afterActivationAttempt = await withUser(() =>
      service.activateDynamicEmployerFromJob(job),
    );
    expect(afterActivationAttempt?.status).toBe("ats_detected");
    await expect(
      withUser(() => watchlist.listWatchlistSelectedSources()),
    ).resolves.toEqual([]);
  });

  it("flags an ATS source change instead of silently replacing the active source", async () => {
    const service = await import("./dynamic-employers");
    const workdayJob = {
      employer: "Gamma Automation Ltd.",
      source: "indeed" as const,
      jobUrl: "https://ca.indeed.com/viewjob?jk=gamma",
      applicationLink:
        "https://gamma.wd1.myworkdayjobs.com/External/job/Calgary/Tech_R1",
    };
    const greenhouseJob = {
      employer: "Gamma Automation",
      source: "jobbank" as const,
      jobUrl: "https://www.jobbank.gc.ca/jobsearch/jobposting/123456",
      applicationLink: "https://job-boards.greenhouse.io/gamma/jobs/1234567",
    };

    await withUser(() => service.activateDynamicEmployerFromJob(workdayJob));
    const changed = await withUser(() =>
      service.observeDynamicEmployerFromJob(greenhouseJob),
    );

    expect(changed).toMatchObject({
      status: "source_changed",
      sourceType: "greenhouse",
      careersUrl: "https://job-boards.greenhouse.io/gamma",
    });
    const events = await withUser(() =>
      service.listDynamicEmployerEvents(changed!.id),
    );
    expect(events.at(-1)).toMatchObject({
      eventType: "source_changed",
      fromStatus: "active",
      toStatus: "source_changed",
    });
  });

  it("keeps retired employers retired on later observations", async () => {
    const service = await import("./dynamic-employers");
    const watchlist = await import("@server/repositories/watchlist");
    const job = {
      employer: "Delta Systems",
      source: "indeed" as const,
      jobUrl: "https://example.com/delta",
      applicationLink: "https://delta.bamboohr.com/careers/42",
    };

    const active = await withUser(() =>
      service.activateDynamicEmployerFromJob(job),
    );
    const retired = await withUser(() =>
      service.retireDynamicEmployer(active!.id, "Strategy changed."),
    );
    expect(retired?.status).toBe("retired");
    await expect(
      withUser(() => watchlist.listWatchlistSelectedSources()),
    ).resolves.toEqual([]);

    const observedAgain = await withUser(() =>
      service.observeDynamicEmployerFromJob(job),
    );
    expect(observedAgain?.status).toBe("retired");
  });

  it("seeds existing Watchlist sources into the dynamic registry", async () => {
    const service = await import("./dynamic-employers");
    const watchlist = await import("@server/repositories/watchlist");

    await withUser(() =>
      service.observeDynamicEmployerFromJob({
        employer: "Seed Manufacturing",
        source: "jobbank",
        jobUrl: "https://www.jobbank.gc.ca/jobsearch/jobposting/987654",
      }),
    );
    await withUser(() =>
      watchlist.ensureWatchlistSelectedSource({
        sourceType: "bamboohr",
        label: "Seed Manufacturing",
        careersUrl: "https://seedmfg.bamboohr.com/careers",
      }),
    );
    await withUser(() => service.syncWatchlistSeedsToDynamicEmployers());

    const employers = await withUser(() => service.listDynamicEmployers());
    expect(employers).toEqual([
      expect.objectContaining({
        displayName: "Seed Manufacturing",
        status: "active",
        sourceType: "bamboohr",
        careersUrl: "https://seedmfg.bamboohr.com/careers",
        observationCount: 0,
      }),
    ]);
  });
});
