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

async function expectOkJson(response: Response) {
  const body = await response.json();
  expect(response.ok, JSON.stringify(body)).toBe(true);
  expect(body.ok).toBe(true);
  return body;
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

  it("signs up and becomes search-ready through product APIs without config/source edits", async () => {
    const signup = await expectOkJson(
      await fetch(`${baseUrl}/api/auth/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "freshcandidate",
          displayName: "Fresh Candidate",
          password: "fresh-candidate-secret",
        }),
      }),
    );
    const token = signup.data.token as string;
    expect(signup.data.user).toMatchObject({
      username: "freshcandidate",
      isSystemAdmin: false,
      workspaceId: "tenant_default",
    });

    const initialStatus = await expectOkJson(
      await fetch(`${baseUrl}/api/onboarding/status`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(initialStatus.data.complete).toBe(false);

    const profileStatus = await expectOkJson(
      await fetch(`${baseUrl}/api/onboarding/actions/profile`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          country: "canada",
          cities: ["Toronto"],
          workplaceTypes: ["onsite", "hybrid"],
          requiresVisaSponsorship: true,
        }),
      }),
    );
    expect(
      profileStatus.data.requirements.find(
        (requirement: { id: string }) => requirement.id === "profile",
      ),
    ).toMatchObject({ status: "ready" });

    const strategyDraft = await expectOkJson(
      await fetch(`${baseUrl}/api/onboarding/actions/strategy/draft`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          targetRoleFamilies: [
            "Field Service Engineer",
            "Commissioning",
            "Customer Technical Support",
          ],
          excludedRoleFamilies: ["maintenance-only"],
          compensationFloorCadAnnual: 70000,
          usTravel: "avoid",
          careerPriority:
            "Prefer higher income and customer-facing technical work.",
        }),
      }),
    );
    expect(strategyDraft.data.preview.draft.status).toBe("draft");
    expect(strategyDraft.data.preview.remainingQuestions).toEqual([]);

    const strategyVersionId = strategyDraft.data.preview.draft.id as string;
    const strategyStatus = await expectOkJson(
      await fetch(`${baseUrl}/api/onboarding/actions/strategy/activate`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ versionId: strategyVersionId }),
      }),
    );
    expect(
      strategyStatus.data.requirements.find(
        (requirement: { id: string }) => requirement.id === "strategy",
      ),
    ).toMatchObject({ status: "ready" });

    const resumeJson = buildDefaultReactiveResumeDocument();
    (resumeJson.basics as Record<string, unknown>).name = "Fresh Candidate";
    const imported = await expectOkJson(
      await fetch(`${baseUrl}/api/design-resume/import/file`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          fileName: "fresh-candidate.json",
          mediaType: "application/json",
          dataBase64: Buffer.from(JSON.stringify(resumeJson), "utf8").toString(
            "base64",
          ),
        }),
      }),
    );
    const source = `local:${imported.data.id as string}`;

    const resumeConfirmed = await expectOkJson(
      await fetch(`${baseUrl}/api/onboarding/actions/resume/confirm`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({ source }),
      }),
    );
    expect(resumeConfirmed.data).toMatchObject({
      complete: false,
      nextRequirementId: "job_profiles",
    });

    const completed = await expectOkJson(
      await fetch(`${baseUrl}/api/onboarding/actions/job-profiles`, {
        method: "POST",
        headers: authHeaders(token),
        body: JSON.stringify({
          urls: ["https://www.linkedin.com/in/fresh-hosted-candidate"],
        }),
      }),
    );
    expect(completed.data).toMatchObject({
      complete: true,
      nextRequirementId: null,
    });

    const activeProfile = await expectOkJson(
      await fetch(`${baseUrl}/api/candidate/profile/active`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(activeProfile.data).toMatchObject({
      status: "active",
      sourceRef: source,
    });

    const activeStrategy = await expectOkJson(
      await fetch(`${baseUrl}/api/candidate/strategy/active`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(activeStrategy.data).toMatchObject({
      id: strategyVersionId,
      status: "active",
    });

    const readiness = await expectOkJson(
      await fetch(`${baseUrl}/api/candidate/readiness`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(readiness.data).toMatchObject({
      profileReady: true,
      strategyReady: true,
      searchReady: true,
      applicationPackageReady: true,
    });
    expect(readiness.data.nextActions).not.toContain("add_profile");
    expect(readiness.data.nextActions).not.toContain("confirm_strategy");
  });
});
