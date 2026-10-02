import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer } from "./test-utils";

describe.sequential("G2 disposable API acceptance", () => {
  let server: Server;
  let baseUrl: string;
  let closeDb: () => void;
  let tempDir: string;
  let jobId: string;
  const proof = (kind: string) => ({
    kind,
    sourceType: "manual_verified",
    verifiedBy: "user",
    note: `Personally verified ${kind} from original confirmation dated 2026-10-01`,
  });
  const request = (path: string, body: unknown, method = "POST") =>
    fetch(`${baseUrl}/api/jobs/${jobId}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  beforeEach(async () => {
    ({ server, baseUrl, closeDb, tempDir } = await startServer());
    const { createJob } = await import("@server/repositories/jobs");
    jobId = (
      await createJob({
        source: "manual",
        title: "G2 disposable",
        employer: "Fixture only",
        jobUrl: "https://example.com/g2-disposable",
      })
    ).id;
  });
  afterEach(async () => {
    await stopServer({ server, closeDb, tempDir });
  });

  it.each([
    ["applied", null, "submission"],
    ["recruiter_screen", null, "interview"],
    ["assessment", null, "interview"],
    ["hiring_manager_screen", null, "interview"],
    ["technical_interview", null, "interview"],
    ["onsite", null, "interview"],
    ["closed", "rejected", "rejection"],
  ])("denies unsupported %s and persists verified evidence", async (toStage, outcome, kind) => {
    const input = { toStage, outcome };
    for (const evidence of [
      undefined,
      { ...proof(kind ?? ""), note: " " },
      { ...proof(kind ?? ""), sourceType: "model" },
      {
        ...proof(kind ?? ""),
        sourceType: "url",
        sourceUrl: "https://example.com/model",
        verifiedBy: "system",
      },
    ]) {
      const res = await request("/stages", {
        ...input,
        metadata: { evidence },
      });
      expect([400, 409]).toContain(res.status);
    }
    expect(
      (await (await fetch(`${baseUrl}/api/jobs/${jobId}/events`)).json()).data,
    ).toHaveLength(0);
    const evidence = proof(kind ?? "");
    const allowed = await request("/stages", {
      ...input,
      metadata: { evidence },
    });
    expect(allowed.status).toBe(200);
    const event = (await allowed.json()).data;
    expect(event.metadata.evidence).toEqual(evidence);
    expect(
      (
        await request(
          `/events/${event.id}`,
          { metadata: { note: "Updated note" } },
          "PATCH",
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          `/events/${event.id}`,
          { metadata: { evidence: null } },
          "PATCH",
        )
      ).status,
    ).toBe(409);
    expect(
      (await (await fetch(`${baseUrl}/api/jobs/${jobId}/events`)).json())
        .data[0].metadata.evidence,
    ).toEqual(evidence);
  });

  it("denies alternate Applied/Rejected paths and missing Gmail sources", async () => {
    expect((await request("/apply", {})).status).toBe(409);
    expect((await request("", { status: "applied" }, "PATCH")).status).toBe(
      409,
    );
    expect((await request("", { outcome: "rejected" }, "PATCH")).status).toBe(
      409,
    );
    expect(
      (await request("/outcome", { outcome: "rejected" }, "PATCH")).status,
    ).toBe(409);
    expect(
      (await request("/stages", { toStage: "no_change", outcome: "rejected" }))
        .status,
    ).toBe(409);
    expect(
      (
        await request("/stages", {
          toStage: "applied",
          outcome: "rejected",
          metadata: { evidence: proof("submission") },
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await request("/stages", {
          toStage: "applied",
          metadata: {
            evidence: {
              ...proof("submission"),
              sourceType: "gmail_message",
              sourceId: "nonexistent",
            },
          },
        })
      ).status,
    ).toBe(400);
    expect(
      (await request("/apply", { evidence: proof("submission") })).status,
    ).toBe(200);
    expect(
      (
        await request("/stages", {
          toStage: "technical_interview",
          metadata: {
            evidence: {
              ...proof("interview"),
              sourceType: "calendar_event",
              sourceId: "user-calendar-event-20261001",
            },
          },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await request(
          "/outcome",
          { outcome: "rejected", evidence: proof("rejection") },
          "PATCH",
        )
      ).status,
    ).toBe(200);
  });

  it.each([
    "no_sponsorship",
    "mandatory_license",
    "us_authorization_required",
  ])("requires and preserves source for %s", async (factKey) => {
    const path = `/verified-facts/${factKey}`;
    expect((await request(path, {}, "PUT")).status).toBe(400);
    expect(
      (
        await request(
          path,
          { evidence: { ...proof(factKey), sourceType: "url" } },
          "PUT",
        )
      ).status,
    ).toBe(400);
    expect(
      (
        await request(
          path,
          { evidence: { ...proof(factKey), verifiedBy: "system" } },
          "PUT",
        )
      ).status,
    ).toBe(400);
    const evidence = {
      ...proof(factKey),
      sourceType: "url",
      sourceUrl: "https://example.com/original-job-posting",
    };
    expect((await request(path, { evidence }, "PUT")).status).toBe(200);
    const saved = (
      await (await fetch(`${baseUrl}/api/jobs/${jobId}/verified-facts`)).json()
    ).data;
    expect(saved).toHaveLength(1);
    expect(saved[0].evidence).toEqual(evidence);
  });
});
