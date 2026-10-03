import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, stopServer } from "./test-utils";

vi.mock("@server/repositories/candidate-profile", () => ({
  activateMasterCareerProfileVersion: vi.fn(),
  createMasterCareerProfileDraft: vi.fn(),
  getActiveMasterCareerProfile: vi.fn(),
  listMasterCareerProfileVersions: vi.fn(),
}));

vi.mock("@server/repositories/candidate-strategy", () => ({
  activateCandidateStrategyVersion: vi.fn(),
  createCandidateStrategyDraft: vi.fn(),
  getActiveCandidateStrategy: vi.fn(),
  listCandidateStrategyVersions: vi.fn(),
}));

describe.sequential("Candidate v3 API", () => {
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

  it("reuses an already active master profile during bootstrap", async () => {
    const profileRepo = await import("@server/repositories/candidate-profile");
    vi.mocked(profileRepo.getActiveMasterCareerProfile).mockResolvedValueOnce({
      id: "profile-v1",
      version: 1,
      status: "active",
      profile: {},
      source: "manual",
      sourceRef: null,
      provenance: null,
      createdAt: "2026-10-03T20:00:00.000Z",
      activatedAt: "2026-10-03T20:00:00.000Z",
      supersededAt: null,
    });

    const res = await fetch(
      `${baseUrl}/api/candidate/profile/bootstrap-current`,
      {
        method: "POST",
      },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.created).toBe(false);
    expect(body.data.profile.id).toBe("profile-v1");
    expect(profileRepo.createMasterCareerProfileDraft).not.toHaveBeenCalled();
  });

  it("creates a structured strategy draft without activating it", async () => {
    const strategyRepo = await import(
      "@server/repositories/candidate-strategy"
    );
    vi.mocked(strategyRepo.createCandidateStrategyDraft).mockResolvedValueOnce({
      id: "strategy-v2",
      version: 2,
      status: "draft",
      targetMarkets: ["canada"],
      targetRoleFamilies: ["field_service"],
      excludedRoleFamilies: [],
      constraints: [],
      freeformNotes: null,
      createdAt: "2026-10-03T20:00:00.000Z",
      activatedAt: null,
    });

    const res = await fetch(`${baseUrl}/api/candidate/strategy/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetMarkets: ["canada"],
        targetRoleFamilies: ["field_service"],
      }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data.status).toBe("draft");
    expect(strategyRepo.createCandidateStrategyDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        targetMarkets: ["canada"],
        targetRoleFamilies: ["field_service"],
        constraints: [],
      }),
    );
  });

  it("rejects invalid constraint confidence before persistence", async () => {
    const strategyRepo = await import(
      "@server/repositories/candidate-strategy"
    );
    const res = await fetch(`${baseUrl}/api/candidate/strategy/versions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        constraints: [
          {
            id: "geo-1",
            key: "geography",
            kind: "hard",
            value: ["Ontario"],
            source: "candidate",
            confidence: 2,
            effectiveAt: "2026-10-03T20:00:00.000Z",
          },
        ],
      }),
    });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(strategyRepo.createCandidateStrategyDraft).not.toHaveBeenCalled();
  });
});
