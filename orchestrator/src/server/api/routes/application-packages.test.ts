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

describe.sequential("F3-6A application package live-gate API", () => {
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

  it("returns authoritative closed evidence and does not leak another candidate's posting", async () => {
    const owner = await signup(baseUrl, "package-owner");
    const other = await signup(baseUrl, "package-other");
    const { db, schema } = await import("@server/db");

    const now = "2026-10-04T13:00:00.000Z";
    const marketPostingId = "market-posting-live-gate";

    await db.insert(schema.marketPostings).values({
      id: marketPostingId,
      identityKey: "requisition:req-live-gate",
      canonicalUrl: "https://example.com/jobs/req-live-gate",
      officialRequisitionId: "REQ-LIVE-GATE",
      employer: "Example",
      title: "Field Service Engineer",
      location: "Toronto, ON",
      description: "Test role",
      contentFingerprint: "posting-fingerprint",
      canonicalAuthority: "official",
      status: "closed",
      firstObservedAt: now,
      lastObservedAt: now,
      lastLiveCheckedAt: now,
      closedAt: now,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.marketPostingObservations).values({
      id: "official-observation",
      marketPostingId,
      source: "official-ats",
      authority: "official",
      sourceJobId: "REQ-LIVE-GATE",
      sourceUrl: "https://example.com/jobs/req-live-gate",
      observationKey: "official-ats:req-live-gate",
      observedAt: now,
      sourceUpdatedAt: now,
      isLive: false,
      payloadFingerprint: "observation-fingerprint",
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.candidateMarketPostings).values({
      id: "owner-candidate-posting",
      tenantId: owner.user.workspaceId,
      userId: owner.user.id,
      marketPostingId,
      firstSeenAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    });

    const ownerResponse = await fetch(
      `${baseUrl}/api/application-packages/postings/${marketPostingId}/live-gate`,
      { headers: { Authorization: `Bearer ${owner.token}` } },
    );
    const ownerBody = await ownerResponse.json();

    expect(ownerResponse.status, JSON.stringify(ownerBody)).toBe(200);
    expect(ownerBody.data).toMatchObject({
      state: "closed",
      blocksGeneration: true,
      requiresReview: false,
      reason: "authoritative_closed_evidence",
      evidence: {
        source: "official-ats",
        authority: "official",
        isLive: false,
      },
    });

    const otherResponse = await fetch(
      `${baseUrl}/api/application-packages/postings/${marketPostingId}/live-gate`,
      { headers: { Authorization: `Bearer ${other.token}` } },
    );

    expect(otherResponse.status).toBe(404);
  });
});
