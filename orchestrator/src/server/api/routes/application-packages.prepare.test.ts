import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer } from "./test-utils";

async function signup(baseUrl: string, username: string) {
  const response = await fetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      displayName: username,
      password: "candidate-secret",
    }),
  });
  const body = await response.json();
  expect(response.status, JSON.stringify(body)).toBe(201);
  return body.data as {
    token: string;
    user: { id: string; workspaceId: string };
  };
}

describe.sequential("F3-6D application package prepare API", () => {
  let server: Server;
  let baseUrl: string;
  let closeDb: () => void;
  let tempDir: string;

  beforeEach(async () => {
    ({ server, baseUrl, closeDb, tempDir } = await startServer({
      env: {
        JOBOPS_TEST_AUTH_BYPASS: "0",
        JOBOPS_APP_MODE: "hosted",
        JOBOPS_HOSTED_SIGNUPS_ENABLED: "true",
        JOBOPS_HOSTED_TENANT_ID: "tenant_default",
      },
    }));
  });

  afterEach(async () => {
    await stopServer({ server, closeDb, tempDir });
  });

  it("creates a version-pinned draft with verified evidence for the owning candidate", async () => {
    const owner = await signup(baseUrl, "prepare-owner");
    const other = await signup(baseUrl, "prepare-other");
    const { db, schema } = await import("@server/db");

    const now = "2026-10-04T14:00:00.000Z";
    const marketPostingId = "market-posting-prepare";

    await db.insert(schema.marketPostings).values({
      id: marketPostingId,
      identityKey: "requisition:req-prepare",
      canonicalUrl: "https://example.com/jobs/req-prepare",
      officialRequisitionId: "REQ-PREPARE",
      employer: "Example",
      title: "Field Service Engineer",
      location: "Toronto, ON",
      description: "PLC knowledge is required.",
      contentFingerprint: "posting-prepare-fingerprint",
      canonicalAuthority: "official",
      status: "live",
      firstObservedAt: now,
      lastObservedAt: now,
      lastLiveCheckedAt: now,
      closedAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.marketPostingVersions).values({
      id: "posting-prepare-v1",
      marketPostingId,
      version: 1,
      contentFingerprint: "posting-prepare-fingerprint",
      snapshot: {
        source: "official-ats",
        authority: "official",
        sourceJobId: "REQ-PREPARE",
        sourceUrl: "https://example.com/jobs/req-prepare",
        canonicalUrl: "https://example.com/jobs/req-prepare",
        officialRequisitionId: "REQ-PREPARE",
        employer: "Example",
        title: "Field Service Engineer",
        location: "Toronto, ON",
        description: "PLC knowledge is required.",
        isLive: true,
      },
      createdAt: now,
    });

    await db.insert(schema.marketPostingObservations).values({
      id: "prepare-official-observation",
      marketPostingId,
      source: "official-ats",
      authority: "official",
      sourceJobId: "REQ-PREPARE",
      sourceUrl: "https://example.com/jobs/req-prepare",
      observationKey: "official-ats:req-prepare",
      observedAt: now,
      sourceUpdatedAt: now,
      isLive: true,
      payloadFingerprint: "prepare-observation-fingerprint",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.candidateMarketPostings).values({
      id: "prepare-owner-candidate-posting",
      tenantId: owner.user.workspaceId,
      userId: owner.user.id,
      marketPostingId,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.candidateProfileVersions).values({
      id: "prepare-profile-v1",
      tenantId: owner.user.workspaceId,
      userId: owner.user.id,
      version: 1,
      status: "active",
      profileJson: {
        basics: { name: "Candidate" },
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
      source: "manual",
      activatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.candidateStrategyVersions).values({
      id: "prepare-strategy-v1",
      tenantId: owner.user.workspaceId,
      userId: owner.user.id,
      version: 1,
      status: "active",
      targetMarkets: ["canada"],
      targetRoleFamilies: ["field service"],
      excludedRoleFamilies: [],
      constraints: [],
      activatedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const response = await fetch(
      `${baseUrl}/api/application-packages/postings/${marketPostingId}/prepare`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${owner.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    const body = await response.json();

    expect(response.status, JSON.stringify(body)).toBe(201);
    expect(body.data.applicationPackage).toMatchObject({
      status: "draft",
      marketPostingId,
      marketPostingVersionId: "posting-prepare-v1",
      profileVersionId: "prepare-profile-v1",
      strategyVersionId: "prepare-strategy-v1",
    });
    expect(body.data.applicationPackage.generationPolicyVersion).toBeTruthy();
    expect(body.data.applicationPackage.evidenceMap).toHaveLength(1);
    expect(body.data.applicationPackage.gaps).toEqual([]);

    const [persisted] = await db
      .select()
      .from(schema.applicationPackages)
      .where(
        (await import("drizzle-orm")).eq(
          schema.applicationPackages.id,
          body.data.applicationPackage.id,
        ),
      );

    expect(persisted).toMatchObject({
      tenantId: owner.user.workspaceId,
      userId: owner.user.id,
      marketPostingId,
      marketPostingVersionId: "posting-prepare-v1",
      profileVersionId: "prepare-profile-v1",
      strategyVersionId: "prepare-strategy-v1",
      status: "draft",
    });

    const packageId = body.data.applicationPackage.id as string;
    const reviewResponse = await fetch(
      `${baseUrl}/api/application-packages/${packageId}/review`,
      { headers: { Authorization: `Bearer ${owner.token}` } },
    );
    const reviewBody = await reviewResponse.json();
    expect(reviewResponse.status, JSON.stringify(reviewBody)).toBe(200);
    expect(reviewBody.data).toMatchObject({
      liveGate: { state: "live" },
      qa: { pass: true },
    });
    expect(reviewBody.data.requirementCoverage).toHaveLength(1);
    expect(reviewBody.data.requirementCoverage[0]).toMatchObject({
      state: "verified",
      requirement: { text: "PLC knowledge is required." },
      evidence: { evidenceText: "PLC" },
    });

    const approveResponse = await fetch(
      `${baseUrl}/api/application-packages/${packageId}/approve`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${owner.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    const approveBody = await approveResponse.json();
    expect(approveResponse.status, JSON.stringify(approveBody)).toBe(200);
    expect(approveBody.data).toMatchObject({
      qa: { pass: true },
      applicationPackage: { id: packageId, status: "approved" },
    });

    const exportResponse = await fetch(
      `${baseUrl}/api/application-packages/${packageId}/export`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${owner.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    const exportBody = await exportResponse.json();
    expect(exportResponse.status, JSON.stringify(exportBody)).toBe(200);
    expect(exportBody.data).toMatchObject({
      applicationPackage: { id: packageId, status: "exported" },
      artifact: {
        mediaType: "application/json",
        document: {
          packageId,
          marketPostingVersionId: "posting-prepare-v1",
          profileVersionId: "prepare-profile-v1",
          strategyVersionId: "prepare-strategy-v1",
        },
      },
    });

    const otherResponse = await fetch(
      `${baseUrl}/api/application-packages/postings/${marketPostingId}/prepare`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${other.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );

    expect(otherResponse.status).toBe(404);

    const otherReviewResponse = await fetch(
      `${baseUrl}/api/application-packages/${packageId}/review`,
      { headers: { Authorization: `Bearer ${other.token}` } },
    );
    expect(otherReviewResponse.status).toBe(404);

    const otherExportResponse = await fetch(
      `${baseUrl}/api/application-packages/${packageId}/export`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${other.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      },
    );
    expect(otherExportResponse.status).toBe(404);
  });
});
