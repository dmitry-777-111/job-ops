import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startServer, stopServer } from "./test-utils";

describe.sequential("G4 Human Bridge", () => {
  let server: Server;
  let baseUrl: string;
  let closeDb: () => void;
  let tempDir: string;

  beforeEach(async () => {
    vi.clearAllMocks();
    ({ server, baseUrl, closeDb, tempDir } = await startServer());
  });

  afterEach(async () => {
    await stopServer({ server, closeDb, tempDir });
  });

  async function createJob(
    title: string,
    employer = "Known Industrial Co",
    suffix = title.toLowerCase().replace(/\s+/g, "-"),
  ) {
    const { createJob: create } = await import("@server/repositories/jobs");
    return create({
      source: "manual",
      title,
      employer,
      jobUrl: `https://example.com/jobs/${suffix}`,
      jobDescription: "Human Bridge acceptance fixture",
    });
  }

  it("creates Vacancy -> Company -> Person with neutral B0/0 state", async () => {
    const job = await createJob("Field Service Specialist");

    const initial = await fetch(`${baseUrl}/api/jobs/${job.id}/human-bridge`);
    expect(initial.status).toBe(200);
    const initialBody = await initial.json();
    expect(initialBody.data.company.name).toBe("Known Industrial Co");
    expect(initialBody.data.contacts).toEqual([]);

    const created = await fetch(
      `${baseUrl}/api/jobs/${job.id}/human-bridge/contacts`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Alex Recruiter",
          role: "Recruiter",
          influenceScore: 0,
          bridgeLevel: "B0",
          outcome: "identified",
          linkToJob: true,
        }),
      },
    );
    expect(created.status).toBe(200);
    const createdBody = await created.json();
    expect(createdBody.data).toMatchObject({
      name: "Alex Recruiter",
      influenceScore: 0,
      bridgeLevel: "B0",
      outcome: "identified",
      jobId: job.id,
    });
  });

  it("requires evidence before positive Influence or Bridge claims", async () => {
    const job = await createJob("Commissioning Specialist");

    const rejected = await fetch(
      `${baseUrl}/api/jobs/${job.id}/human-bridge/contacts`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Jordan Manager",
          influenceScore: 2,
          bridgeLevel: "B2",
        }),
      },
    );
    expect(rejected.status).toBe(400);

    const accepted = await fetch(
      `${baseUrl}/api/jobs/${job.id}/human-bridge/contacts`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Jordan Manager",
          role: "Service Manager",
          linkedinUrl: "https://www.linkedin.com/in/jordan-manager",
          influenceScore: 2,
          bridgeLevel: "B2",
          bridgeEvidence: "Direct reply confirmed by user on 2026-10-02.",
          lastContactAt: 1790956800000,
          outcome: "replied",
        }),
      },
    );
    expect(accepted.status).toBe(200);
    const acceptedBody = await accepted.json();
    expect(acceptedBody.data.bridgeEvidence).toContain("Direct reply");
    expect(acceptedBody.data.bridgeLevel).toBe("B2");
    expect(acceptedBody.data.influenceScore).toBe(2);
  });

  it("shares a company person across vacancies but keeps vacancy link optional", async () => {
    const first = await createJob(
      "Service Coordinator",
      "Shared Employer",
      "shared-1",
    );
    const second = await createJob(
      "Field Technician",
      "Shared Employer",
      "shared-2",
    );

    const created = await fetch(
      `${baseUrl}/api/jobs/${first.id}/human-bridge/contacts`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Taylor Hiring",
          role: "Hiring Manager",
          influenceScore: 1,
          bridgeLevel: "B1",
          bridgeEvidence: "Verified LinkedIn connection and reply.",
          outcome: "follow-up",
          linkToJob: false,
        }),
      },
    );
    expect(created.status).toBe(200);
    expect((await created.json()).data.jobId).toBeNull();

    const secondContext = await fetch(
      `${baseUrl}/api/jobs/${second.id}/human-bridge`,
    ).then((res) => res.json());
    expect(secondContext.data.company.name).toBe("Shared Employer");
    expect(secondContext.data.contacts).toHaveLength(1);
    expect(secondContext.data.contacts[0].name).toBe("Taylor Hiring");
    expect(secondContext.data.contacts[0].jobId).toBeNull();
  });

  it("preserves evidence guardrails on updates", async () => {
    const job = await createJob("Maintenance Supervisor");
    const created = await fetch(
      `${baseUrl}/api/jobs/${job.id}/human-bridge/contacts`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Morgan HR" }),
      },
    ).then((res) => res.json());

    const rejected = await fetch(
      `${baseUrl}/api/jobs/${job.id}/human-bridge/contacts/${created.data.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bridgeLevel: "B3" }),
      },
    );
    expect(rejected.status).toBe(400);

    const updated = await fetch(
      `${baseUrl}/api/jobs/${job.id}/human-bridge/contacts/${created.data.id}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bridgeLevel: "B3",
          influenceScore: 3,
          bridgeEvidence: "User verified referral to hiring manager.",
          outcome: "referred",
        }),
      },
    );
    expect(updated.status).toBe(200);
    expect((await updated.json()).data).toMatchObject({
      bridgeLevel: "B3",
      influenceScore: 3,
      outcome: "referred",
    });
  });
  it("represents complete Human Bridge state for five companies", async () => {
    for (let index = 1; index <= 5; index += 1) {
      const employer = `Known Company ${index}`;
      const job = await createJob(
        `Acceptance Role ${index}`,
        employer,
        `known-company-${index}`,
      );
      const created = await fetch(
        `${baseUrl}/api/jobs/${job.id}/human-bridge/contacts`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: `Contact ${index}`,
            role: "Hiring contact",
            influenceScore: 1,
            bridgeLevel: "B1",
            bridgeEvidence: `Verified acceptance evidence ${index}.`,
            lastContactAt: 1790956800000 + index,
            outcome: "outreach-planned",
            linkToJob: true,
          }),
        },
      );
      expect(created.status).toBe(200);

      const context = await fetch(
        `${baseUrl}/api/jobs/${job.id}/human-bridge`,
      ).then((res) => res.json());
      expect(context.data.company.name).toBe(employer);
      expect(context.data.contacts).toHaveLength(1);
      expect(context.data.contacts[0]).toMatchObject({
        name: `Contact ${index}`,
        bridgeLevel: "B1",
        influenceScore: 1,
        outcome: "outreach-planned",
        jobId: job.id,
      });
      expect(context.data.contacts[0].bridgeEvidence).toContain(
        "Verified acceptance evidence",
      );
    }
  });
});
