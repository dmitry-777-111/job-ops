import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Run with tsx and a new /tmp/career-os-g2-acceptance-* DATA_DIR.
// The real app factory, auth, migrations and routes are used; no module mocks.
// The scheduler entry point is deliberately not started in this disposable harness.
const dataDir = process.env.DATA_DIR;
if (!dataDir?.startsWith("/tmp/career-os-g2-acceptance-")) {
  throw new Error("G2 acceptance requires a disposable /tmp DATA_DIR");
}
process.env.JOBOPS_APP_MODE = "local";
process.env.JOBOPS_DISABLE_ANALYTICS = "1";
process.env.NODE_ENV = "production";
delete process.env.JOBOPS_TEST_AUTH_BYPASS;
const nativeFetch = globalThis.fetch;
globalThis.fetch = ((
  input: Parameters<typeof fetch>[0],
  init?: RequestInit,
) => {
  const url = new URL(
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : input.url,
  );
  assert.equal(
    url.hostname,
    "127.0.0.1",
    "Acceptance must not make external requests",
  );
  return nativeFetch(input, init);
}) as typeof fetch;

await import("../src/server/db/migrate");
const { db, schema, closeDb } = await import("../src/server/db");
const { createApp } = await import("../src/server/app");
const { createJob } = await import("../src/server/repositories/jobs");
const app = createApp();
const server = app.listen(0, "127.0.0.1");
await new Promise<void>((resolve) => server.once("listening", resolve));
const address = server.address();
assert(address && typeof address !== "string");
const origin = `http://127.0.0.1:${address.port}`;
let token = "";
let assertions = 0;
async function api(
  path: string,
  body?: unknown,
  expected = 200,
  method = body === undefined ? "GET" : "POST",
) {
  const res = await fetch(`${origin}/api${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await res.json();
  assert.equal(
    res.status,
    expected,
    `${method} ${path}: ${payload.error?.message ?? ""}`,
  );
  assert(res.headers.get("x-request-id"));
  assertions += 2;
  return payload.data;
}
const evidence = (kind: string) => ({
  kind,
  sourceType: "manual_verified",
  verifiedBy: "user",
  note: `Verified original ${kind} confirmation in disposable acceptance fixture`,
});
const statePath = join(dataDir, "acceptance-state.json");

try {
  if (process.argv.includes("--verify-restart")) {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    token = (
      await api("/auth/login", {
        username: "g2-acceptance",
        password: state.password,
      })
    ).token;
    assert.deepEqual(await api(`/jobs/${state.jobId}/events`), state.events);
    assert.deepEqual(
      await api(`/jobs/${state.jobId}/verified-facts`),
      state.facts,
    );
    assert.equal(
      db.select().from(schema.postApplicationMessages).all().length,
      1,
    );
    console.log(
      JSON.stringify({
        result: "PASS",
        phase: "fresh-process restart",
        assertions: assertions + 3,
        events: state.events.length,
        facts: state.facts.length,
        syntheticMessages: 1,
      }),
    );
  } else {
    const password = randomBytes(24).toString("hex");
    token = (
      await api("/auth/setup", { username: "g2-acceptance", password }, 201)
    ).token;
    const job = await createJob({
      source: "manual",
      title: "G2 DISPOSABLE",
      employer: "Fixture employer",
      jobUrl: "https://example.com/g2-acceptance",
      jobDescription: "Synthetic fixture, not a real application",
    });
    const path = `/jobs/${job.id}`;
    await api(`${path}/apply`, {}, 409);
    await api(path, { status: "applied" }, 409, "PATCH");
    await api(path, { outcome: "rejected" }, 409, "PATCH");
    assert.equal((await api(`${path}/events`)).length, 0);
    await api(`${path}/apply`, { evidence: evidence("submission") });
    await api(`${path}/stages`, { toStage: "technical_interview" }, 409);
    await api(
      `${path}/stages`,
      {
        toStage: "technical_interview",
        metadata: { actor: "system", evidence: evidence("interview") },
      },
      409,
    );
    await api(
      `${path}/stages`,
      {
        toStage: "technical_interview",
        metadata: {
          evidence: { ...evidence("interview"), sourceType: "model" },
        },
      },
      400,
    );
    db.insert(schema.postApplicationMessages)
      .values({
        id: "22222222-2222-4222-8222-222222222222",
        provider: "gmail",
        externalMessageId: "g2-synthetic-external",
        receivedAt: Date.now(),
        subject: "Synthetic interview invite",
        messageType: "interview",
        classificationLabel: "interview",
        classificationConfidence: 0.99,
        processingStatus: "pending_user",
        matchedJobId: job.id,
      })
      .run();
    assert.equal((await api(`${path}/events`)).length, 1);
    await api(
      "/post-application/inbox/22222222-2222-4222-8222-222222222222/approve",
      {
        provider: "gmail",
        accountKey: "default",
        jobId: job.id,
        stageTarget: "technical_interview",
        note: "Personally verified the original synthetic invitation",
      },
    );
    const reviewed = await api(`${path}/events`);
    const invitation = reviewed.find(
      (event: { metadata?: { evidence?: { sourceId?: string } } }) =>
        event.metadata?.evidence?.sourceId ===
        "22222222-2222-4222-8222-222222222222",
    );
    assert(invitation);
    await api(
      `${path}/events/${invitation.id}`,
      { metadata: { note: "Updated annotation" } },
      200,
      "PATCH",
    );
    await api(
      `${path}/events/${invitation.id}`,
      { metadata: { evidence: null } },
      409,
      "PATCH",
    );
    await api(`${path}/outcome`, { outcome: "rejected" }, 409, "PATCH");
    await api(
      `${path}/outcome`,
      { outcome: "rejected", evidence: evidence("rejection") },
      200,
      "PATCH",
    );
    for (const key of [
      "no_sponsorship",
      "mandatory_license",
      "us_authorization_required",
    ]) {
      await api(`${path}/verified-facts/${key}`, {}, 400, "PUT");
      await api(
        `${path}/verified-facts/${key}`,
        { evidence: { ...evidence(key), verifiedBy: "system" } },
        400,
        "PUT",
      );
      await api(
        `${path}/verified-facts/${key}`,
        {
          evidence: {
            ...evidence(key),
            sourceType: "url",
            sourceUrl: "https://example.com/original-posting",
          },
        },
        200,
        "PUT",
      );
    }
    const events = await api(`${path}/events`);
    const facts = await api(`${path}/verified-facts`);
    assert.equal(events.length, 3);
    assert.equal(facts.length, 3);
    assert.equal(
      events.find((event: { id: string }) => event.id === invitation.id)
        .metadata.evidence.sourceId,
      "22222222-2222-4222-8222-222222222222",
    );
    await writeFile(
      statePath,
      JSON.stringify({ password, jobId: job.id, events, facts }),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        result: "PASS",
        phase: "real HTTP API",
        assertions: assertions + 6,
        events: events.length,
        facts: facts.length,
        syntheticMessages: 1,
      }),
    );
  }
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  closeDb();
}
