import type {
  CandidateStrategyProfile,
  ExternalConnectionSummary,
  MasterCareerProfileVersion,
} from "@shared/types";
import { describe, expect, it } from "vitest";
import { deriveCandidateReadiness } from "./candidate-readiness";

const profile = {
  id: "profile-1",
  version: 1,
  status: "active",
  profile: {},
  source: "manual",
  sourceRef: null,
  provenance: null,
  createdAt: "2026-10-03T20:00:00.000Z",
  activatedAt: "2026-10-03T20:00:00.000Z",
  supersededAt: null,
} satisfies MasterCareerProfileVersion;

const strategy = {
  id: "strategy-1",
  version: 1,
  status: "active",
  targetMarkets: ["canada"],
  targetRoleFamilies: ["field_service"],
  excludedRoleFamilies: [],
  constraints: [],
  freeformNotes: null,
  createdAt: "2026-10-03T20:00:00.000Z",
  activatedAt: "2026-10-03T20:00:00.000Z",
} satisfies CandidateStrategyProfile;

const gmail = {
  id: "connection-1",
  providerId: "gmail",
  kind: "email",
  accountKey: "default",
  displayName: "Gmail",
  status: "connected",
  scopes: ["gmail.readonly"],
  capabilities: ["read_job_related_mail"],
  metadata: {},
  lastConnectedAt: null,
  lastSyncedAt: null,
  lastError: null,
  createdAt: "2026-10-03T20:00:00.000Z",
  updatedAt: "2026-10-03T20:00:00.000Z",
} satisfies ExternalConnectionSummary;

describe("candidate readiness", () => {
  it("allows search with profile+strategy even before email connection", () => {
    const readiness = deriveCandidateReadiness({
      profile,
      strategy,
      connections: [],
    });
    expect(readiness.searchReady).toBe(true);
    expect(readiness.emailConnected).toBe(false);
    expect(readiness.nextActions).toContain("connect_email");
  });

  it("reports a fully configured candidate", () => {
    const readiness = deriveCandidateReadiness({
      profile,
      strategy,
      connections: [gmail],
    });
    expect(readiness.searchReady).toBe(true);
    expect(readiness.applicationPackageReady).toBe(true);
    expect(readiness.nextActions).toEqual([]);
  });

  it("does not call a candidate search-ready without confirmed strategy", () => {
    const readiness = deriveCandidateReadiness({
      profile,
      strategy: null,
      connections: [gmail],
    });
    expect(readiness.searchReady).toBe(false);
    expect(readiness.nextActions).toContain("confirm_strategy");
  });
});
