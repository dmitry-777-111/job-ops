import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const TENANT_ID = "tenant_default";
const VAULT_KEY = "11".repeat(32);

describe.sequential("hosted candidate private-domain isolation", () => {
  let tempDir: string;
  let closeDb: () => void;
  let runWithRequestContext: typeof import("@infra/request-context").runWithRequestContext;
  let aliceId: string;
  let bobId: string;

  beforeEach(async () => {
    vi.resetModules();
    tempDir = await mkdtemp(join(tmpdir(), "job-ops-private-domain-"));
    process.env.DATA_DIR = tempDir;
    process.env.NODE_ENV = "test";
    process.env.JOBOPS_APP_MODE = "hosted";
    process.env.JOBOPS_HOSTED_TENANT_ID = TENANT_ID;
    process.env.CAREER_OS_CREDENTIAL_MASTER_KEY = VAULT_KEY;

    await import("../db/migrate");
    ({ closeDb } = await import("../db/index"));
    ({ runWithRequestContext } = await import("@infra/request-context"));
    const { createHostedTenantUser } = await import("./users");
    const alice = await createHostedTenantUser({
      username: "alice",
      password: "alice-secret",
      tenantId: TENANT_ID,
    });
    const bob = await createHostedTenantUser({
      username: "bob",
      password: "bob-secret",
      tenantId: TENANT_ID,
    });
    if (!alice || !bob) throw new Error("Failed to create hosted test users");
    aliceId = alice.id;
    bobId = bob.id;
  });

  afterEach(async () => {
    closeDb();
    await rm(tempDir, { recursive: true, force: true });
    delete process.env.CAREER_OS_CREDENTIAL_MASTER_KEY;
    delete process.env.JOBOPS_HOSTED_TENANT_ID;
    delete process.env.JOBOPS_APP_MODE;
    vi.clearAllMocks();
  });

  function asUser<T>(userId: string, fn: () => T): T {
    return runWithRequestContext(
      {
        requestId: `isolation-${userId}`,
        tenantId: TENANT_ID,
        userId,
      },
      fn,
    );
  }

  it("does not leak profile, strategy, connection status, or credentials between candidates", async () => {
    const profileRepo = await import("./candidate-profile");
    const strategyRepo = await import("./candidate-strategy");
    const connectionRepo = await import("./external-connections");
    const { db, schema } = await import("../db/index");

    const aliceCreated = await asUser(aliceId, async () => {
      const profile = await profileRepo.createMasterCareerProfileDraft({
        profile: { basics: { name: "Alice", label: "Field Service" } },
        source: "manual",
      });
      await profileRepo.activateMasterCareerProfileVersion(profile.id);
      const strategy = await strategyRepo.createCandidateStrategyDraft({
        targetMarkets: ["canada"],
        targetRoleFamilies: ["field service"],
        freeformNotes: "alice-only-strategy",
      });
      await strategyRepo.activateCandidateStrategyVersion(strategy.id);
      const connection = await connectionRepo.upsertExternalConnection({
        providerId: "gmail",
        kind: "email",
        status: "connected",
        displayName: "Alice Gmail",
        credentials: { accessToken: "alice-access-token" },
      });
      return { profile, strategy, connection };
    });

    await asUser(bobId, async () => {
      expect(await profileRepo.getActiveMasterCareerProfile()).toBeNull();
      expect(await strategyRepo.getActiveCandidateStrategy()).toBeNull();
      expect(await connectionRepo.listExternalConnections()).toEqual([]);
      expect(
        await connectionRepo.getExternalConnectionCredentials(
          aliceCreated.connection.id,
        ),
      ).toBeNull();
      expect(
        await profileRepo.activateMasterCareerProfileVersion(
          aliceCreated.profile.id,
        ),
      ).toBeNull();
      expect(
        await strategyRepo.activateCandidateStrategyVersion(
          aliceCreated.strategy.id,
        ),
      ).toBeNull();
    });

    const bobCreated = await asUser(bobId, async () => {
      const profile = await profileRepo.createMasterCareerProfileDraft({
        profile: { basics: { name: "Bob", label: "Commissioning" } },
        source: "manual",
      });
      await profileRepo.activateMasterCareerProfileVersion(profile.id);
      const strategy = await strategyRepo.createCandidateStrategyDraft({
        targetMarkets: ["canada"],
        targetRoleFamilies: ["commissioning"],
        freeformNotes: "bob-only-strategy",
      });
      await strategyRepo.activateCandidateStrategyVersion(strategy.id);
      const connection = await connectionRepo.upsertExternalConnection({
        providerId: "gmail",
        kind: "email",
        status: "connected",
        displayName: "Bob Gmail",
        credentials: { accessToken: "bob-access-token" },
      });
      return { profile, strategy, connection };
    });

    await asUser(aliceId, async () => {
      expect((await profileRepo.getActiveMasterCareerProfile())?.id).toBe(
        aliceCreated.profile.id,
      );
      expect((await strategyRepo.getActiveCandidateStrategy())?.id).toBe(
        aliceCreated.strategy.id,
      );
      expect(await connectionRepo.listExternalConnections()).toEqual([
        expect.objectContaining({
          id: aliceCreated.connection.id,
          displayName: "Alice Gmail",
          status: "connected",
        }),
      ]);
      expect(
        await connectionRepo.getExternalConnectionCredentials(
          aliceCreated.connection.id,
        ),
      ).toEqual({ accessToken: "alice-access-token" });
      expect(
        await connectionRepo.getExternalConnectionCredentials(
          bobCreated.connection.id,
        ),
      ).toBeNull();
    });

    const secretRows = await db.select().from(schema.credentialSecrets);
    expect(secretRows).toHaveLength(2);
    expect(secretRows.map((row) => row.userId).sort()).toEqual(
      [aliceId, bobId].sort(),
    );
    for (const row of secretRows) {
      expect(row.ciphertext).not.toContain("access-token");
      expect(row.ciphertext).not.toContain("alice");
      expect(row.ciphertext).not.toContain("bob");
    }
  });
});
