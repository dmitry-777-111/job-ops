import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const dataDir = process.env.DATA_DIR;
if (!dataDir?.startsWith("/tmp/career-os-g3-acceptance-")) {
  throw new Error("G3 acceptance requires a disposable /tmp DATA_DIR");
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
const { closeDb } = await import("../src/server/db");
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

const statePath = join(dataDir, "acceptance-state.json");

try {
  if (process.argv.includes("--verify-restart")) {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    token = (
      await api("/auth/login", {
        username: "g3-acceptance",
        password: state.password,
      })
    ).token;
    const context = await api(`/jobs/${state.jobId}/immigration-profile`);
    assert.deepEqual(context, state.context);
    assert.equal(context.profile.nocCode, "72422");
    assert.equal(context.profile.employerSupportStatus, "confirmed");
    assert.equal(context.profile.usTravelRequired, false);
    assert.equal(context.profile.wageHourlyCad, 40);
    assert.equal(context.profile.wageAnnualCad, 83200);
    assert.equal(context.verifiedFacts.length, 1);
    console.log(
      JSON.stringify({
        result: "PASS",
        phase: "fresh-process restart",
        assertions: assertions + 7,
        verifiedFacts: context.verifiedFacts.length,
      }),
    );
  } else {
    const password = randomBytes(24).toString("hex");
    token = (
      await api("/auth/setup", { username: "g3-acceptance", password }, 201)
    ).token;

    const job = await createJob({
      source: "manual",
      title: "G3 DISPOSABLE",
      employer: "Fixture employer",
      jobUrl: "https://example.com/g3-acceptance",
      jobDescription: "Synthetic fixture, not a real application",
    });
    const path = `/jobs/${job.id}`;

    const immigrationEvidence = {
      sourceType: "url",
      sourceUrl: "https://example.com/original-posting",
      note: "Personally verified employer support wording in original posting",
      verifiedBy: "user",
    };
    await api(
      `${path}/immigration-profile`,
      {
        nocCode: "72422",
        employerSupportStatus: "confirmed",
        workPermitRequirement: "Employer-specific support confirmed in fixture",
        usTravelRequired: false,
        wageHourlyCad: 40,
        wageAnnualCad: 83200,
        immigrationNotes: "Disposable G3 acceptance note",
        evidence: [immigrationEvidence],
      },
      200,
      "PUT",
    );

    await api(
      `${path}/verified-facts/mandatory_license`,
      {
        evidence: {
          kind: "mandatory_license",
          sourceType: "url",
          sourceUrl: "https://example.com/original-posting",
          note: "Personally verified licence requirement in fixture",
          verifiedBy: "user",
        },
      },
      200,
      "PUT",
    );

    const context = await api(`${path}/immigration-profile`);
    assert.equal(context.profile.nocCode, "72422");
    assert.equal(context.profile.employerSupportStatus, "confirmed");
    assert.equal(
      context.profile.workPermitRequirement,
      "Employer-specific support confirmed in fixture",
    );
    assert.equal(context.profile.usTravelRequired, false);
    assert.equal(context.profile.wageHourlyCad, 40);
    assert.equal(context.profile.wageAnnualCad, 83200);
    assert.equal(context.profile.evidence.length, 1);
    assert.equal(context.verifiedFacts.length, 1);
    assert.equal(context.verifiedFacts[0].factKey, "mandatory_license");

    await writeFile(
      statePath,
      JSON.stringify({ password, jobId: job.id, context }),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        result: "PASS",
        phase: "real HTTP API",
        assertions: assertions + 9,
        verifiedFacts: context.verifiedFacts.length,
      }),
    );
  }
} finally {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  closeDb();
}
