import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, stopServer } from "./test-utils";

vi.mock("@server/repositories/external-connections", () => ({
  listExternalConnections: vi.fn(),
  disconnectExternalConnection: vi.fn(),
}));

describe.sequential("External connections API", () => {
  let server: Server;
  let baseUrl: string;
  let closeDb: () => void;
  let tempDir: string;

  beforeEach(async () => {
    ({ server, baseUrl, closeDb, tempDir } = await startServer());
  });

  afterEach(async () => {
    await stopServer({ server, closeDb, tempDir });
    vi.clearAllMocks();
  });

  it("returns provider catalog without pretending planned job boards are enabled", async () => {
    const res = await fetch(`${baseUrl}/api/connections/providers`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.providers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "gmail", enabled: true }),
        expect.objectContaining({ id: "linkedin", enabled: false }),
        expect.objectContaining({ id: "jobbank", enabled: false }),
        expect.objectContaining({ id: "indeed", enabled: false }),
      ]),
    );
  });

  it("returns safe summaries and no credentials", async () => {
    const { listExternalConnections } = await import(
      "@server/repositories/external-connections"
    );
    vi.mocked(listExternalConnections).mockResolvedValueOnce([
      {
        id: "connection-1",
        providerId: "gmail",
        kind: "email",
        accountKey: "primary",
        displayName: "Candidate Gmail",
        status: "connected",
        scopes: ["gmail.readonly"],
        capabilities: ["read_job_related_mail"],
        metadata: { email: "candidate@example.com" },
        lastConnectedAt: "2026-10-03T20:00:00.000Z",
        lastSyncedAt: null,
        lastError: null,
        createdAt: "2026-10-03T20:00:00.000Z",
        updatedAt: "2026-10-03T20:00:00.000Z",
      },
    ]);

    const res = await fetch(`${baseUrl}/api/connections`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.connections).toHaveLength(1);
    expect(JSON.stringify(body)).not.toMatch(
      /refreshToken|accessToken|password|cookie/i,
    );
  });

  it("disconnects through the tenant-scoped repository", async () => {
    const { disconnectExternalConnection } = await import(
      "@server/repositories/external-connections"
    );
    vi.mocked(disconnectExternalConnection).mockResolvedValueOnce({
      id: "connection-1",
      providerId: "gmail",
      kind: "email",
      accountKey: "primary",
      displayName: "Candidate Gmail",
      status: "disconnected",
      scopes: [],
      capabilities: [],
      metadata: {},
      lastConnectedAt: null,
      lastSyncedAt: null,
      lastError: null,
      createdAt: "2026-10-03T20:00:00.000Z",
      updatedAt: "2026-10-03T20:01:00.000Z",
    });

    const res = await fetch(`${baseUrl}/api/connections/connection-1`, {
      method: "DELETE",
    });

    expect(res.status).toBe(200);
    expect(disconnectExternalConnection).toHaveBeenCalledWith("connection-1");
  });
});
