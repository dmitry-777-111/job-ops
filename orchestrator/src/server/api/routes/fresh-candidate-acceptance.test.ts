import type { Server } from "node:http";
import { buildDefaultReactiveResumeDocument } from "@server/services/rxresume/document";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startServer, stopServer } from "./test-utils";

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function postJson(
  baseUrl: string,
  path: string,
  token: string,
  body: unknown,
) {
  return fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
}

describe.sequential("F3-5 fresh hosted candidate acceptance", () => {
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
        JOBOPS_HOSTED_PLATFORM_LLM_ENABLED: "true",
        JOBOPS_HOSTED_QUOTAS_ENABLED: "true",
      },
    }));
  });

  afterEach(async () => {
    await stopServer({ server, closeDb, tempDir });
  });

  it("signs up and reaches a complete candidate workspace using product APIs only", async () => {
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "freshcandidate",
        displayName: "Fresh Candidate",
        password: "fresh-candidate-secret",
      }),
    });
    expect(signupRes.status).toBe(201);
    const signupBody = await signupRes.json();
    const token = signupBody.data.token as string;
    expect(signupBody.data.user).toMatchObject({
      username: "freshcandidate",
      isSystemAdmin: false,
      workspaceId: "tenant_default",
    });

    const initialStatusRes = await fetch(`${baseUrl}/api/onboarding/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(initialStatusRes.status).toBe(200);
    const initialStatus = await initialStatusRes.json();
    expect(initialStatus.data.complete).toBe(false);

    const profileRes = await postJson(
      baseUrl,
      "/api/onboarding/actions/profile",
      token,
      {
        country: "canada",
        cities: ["Toronto"],
        workplaceTypes: ["onsite", "hybrid"],
        requiresVisaSponsorship: true,
      },
    );
    expect(profileRes.status).toBe(200);

    const draftRes = await postJson(
      baseUrl,
      "/api/onboarding/actions/strategy/draft",
      token,
      {
        targetRoleFamilies: ["field service", "commissioning"],
        excludedRoleFamilies: ["pure sales"],
        compensationFloorCadAnnual: 70000,
        usTravel: "avoid",
        careerPriority: "Higher income with customer-facing technical work.",
      },
    );
    expect(draftRes.status).toBe(201);
    const draftBody = await draftRes.json();
    const strategyVersionId = draftBody.data.preview.draft.id as string;
    expect(strategyVersionId).toBeTruthy();

    const strategyRes = await postJson(
      baseUrl,
      "/api/onboarding/actions/strategy/activate",
      token,
      { versionId: strategyVersionId },
    );
    expect(strategyRes.status).toBe(200);

    const resumeJson = buildDefaultReactiveResumeDocument();
    resumeJson.basics.name = "Fresh Candidate";
    resumeJson.basics.headline = "Field Service Technician";
    const importRes = await postJson(
      baseUrl,
      "/api/design-resume/import/file",
      token,
      {
        fileName: "fresh-candidate-resume.json",
        mediaType: "application/json",
        dataBase64: Buffer.from(JSON.stringify(resumeJson)).toString("base64"),
      },
    );
    expect(importRes.status).toBe(201);
    const importBody = await importRes.json();
    const documentId = importBody.data.id as string;
    expect(documentId).toBeTruthy();

    const confirmRes = await postJson(
      baseUrl,
      "/api/onboarding/actions/resume/confirm",
      token,
      { source: `local:${documentId}` },
    );
    expect(confirmRes.status).toBe(200);
    const confirmBody = await confirmRes.json();
    expect(confirmBody.data).toMatchObject({
      complete: true,
      nextRequirementId: null,
    });

    const [profileActiveRes, strategyActiveRes, statusRes] = await Promise.all([
      fetch(`${baseUrl}/api/candidate/profile/active`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${baseUrl}/api/candidate/strategy/active`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`${baseUrl}/api/onboarding/status`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    expect(profileActiveRes.status).toBe(200);
    expect(strategyActiveRes.status).toBe(200);
    expect(statusRes.status).toBe(200);

    const activeProfile = await profileActiveRes.json();
    const activeStrategy = await strategyActiveRes.json();
    const finalStatus = await statusRes.json();

    expect(activeProfile.data).toMatchObject({
      status: "active",
      sourceRef: `local:${documentId}`,
    });
    expect(activeStrategy.data).toMatchObject({
      id: strategyVersionId,
      status: "active",
      targetRoleFamilies: ["field service", "commissioning"],
    });
    expect(finalStatus.data).toMatchObject({
      complete: true,
      nextRequirementId: null,
    });
  });
});
