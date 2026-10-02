import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer } from "./test-utils";

describe.sequential("G3 Canada immigration profile API", () => {
  let server: Server;
  let baseUrl: string;
  let closeDb: () => void;
  let tempDir: string;
  let jobId: string;

  beforeEach(async () => {
    ({ server, baseUrl, closeDb, tempDir } = await startServer());
    const { createJob } = await import("@server/repositories/jobs");
    jobId = (
      await createJob({
        source: "manual",
        title: "G3 disposable",
        employer: "Example Industries Inc.",
        jobUrl: "https://example.com/g3-disposable",
      })
    ).id;
  });

  afterEach(async () => {
    await stopServer({ server, closeDb, tempDir });
  });

  const profileUrl = () =>
    baseUrl + "/api/jobs/" + jobId + "/immigration-profile";
  it("persists Canada context while keeping G2 hard facts separate", async () => {
    const evidence = [
      {
        sourceType: "url",
        sourceUrl: "https://example.com/original-posting",
        note: "Personally verified employer support wording in the original posting.",
        verifiedBy: "user",
      },
    ];

    const put = await fetch(profileUrl(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nocCode: "72422",
        employerSupportStatus: "possible",
        workPermitRequirement:
          "Employer-specific work permit support must be confirmed.",
        usTravelRequired: false,
        wageHourlyCad: 40,
        wageAnnualCad: 83200,
        immigrationNotes: "G3 disposable note",
        evidence,
      }),
    });
    expect(put.status).toBe(200);
    const saved = (await put.json()).data;
    expect(saved.nocCode).toBe("72422");
    expect(saved.employerSupportStatus).toBe("possible");
    expect(saved.usTravelRequired).toBe(false);
    expect(saved.wageHourlyCad).toBe(40);
    expect(saved.evidence).toEqual(evidence);
    const factEvidence = {
      kind: "mandatory_license",
      sourceType: "url",
      sourceUrl: "https://example.com/original-posting",
      note: "Personally verified mandatory Canadian licence wording.",
      verifiedBy: "user",
    };
    const fact = await fetch(
      baseUrl + "/api/jobs/" + jobId + "/verified-facts/mandatory_license",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidence: factEvidence }),
      },
    );
    expect(fact.status).toBe(200);

    const get = await fetch(profileUrl());
    expect(get.status).toBe(200);
    const context = (await get.json()).data;
    expect(context.profile.nocCode).toBe("72422");
    expect(context.verifiedFacts).toHaveLength(1);
    expect(context.verifiedFacts[0].factKey).toBe("mandatory_license");
    expect(context.profile).not.toHaveProperty("mandatoryLicense");
  });

  it("gates critical immigration conclusions on persisted user-verified evidence", async () => {
    const put = async (body: unknown) =>
      fetch(profileUrl(), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    expect((await put({ employerSupportStatus: "confirmed" })).status).toBe(
      400,
    );
    expect((await put({ employerSupportStatus: "not_available" })).status).toBe(
      400,
    );
    expect((await put({ usTravelRequired: true })).status).toBe(400);

    const evidence = [
      {
        sourceType: "url",
        sourceUrl: "https://example.com/original-posting",
        note: "Personally verified the original employer wording.",
        verifiedBy: "user",
      },
    ];

    expect(
      (
        await put({
          employerSupportStatus: "confirmed",
          usTravelRequired: true,
          evidence,
        })
      ).status,
    ).toBe(200);
    expect(
      (await put({ immigrationNotes: "Evidence already persisted." })).status,
    ).toBe(200);
    expect((await put({ evidence: [] })).status).toBe(400);
  });

  it("rejects unverified or incomplete supporting evidence", async () => {
    const unverified = await fetch(profileUrl(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employerSupportStatus: "confirmed",
        evidence: [
          {
            sourceType: "manual_verified",
            note: "AI inferred employer support",
            verifiedBy: "system",
          },
        ],
      }),
    });
    expect(unverified.status).toBe(400);

    const missingSource = await fetch(profileUrl(), {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        evidence: [
          {
            sourceType: "gmail_message",
            note: "Personally verified recruiter email",
            verifiedBy: "user",
          },
        ],
      }),
    });
    expect(missingSource.status).toBe(400);
  });
});
