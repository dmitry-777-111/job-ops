import type { ApplicationPackage } from "@shared/types";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApplicationPackage: vi.fn(),
  updateApplicationPackage: vi.fn(),
  evaluateStoredApplicationPackageQa: vi.fn(),
}));

vi.mock("@server/repositories/application-packages", () => ({
  getApplicationPackage: mocks.getApplicationPackage,
  updateApplicationPackage: mocks.updateApplicationPackage,
}));
vi.mock("./application-package-approval", () => ({
  evaluateStoredApplicationPackageQa: mocks.evaluateStoredApplicationPackageQa,
}));

import { exportApplicationPackage } from "./application-package-export";

const approved: ApplicationPackage = {
  id: "package-1",
  version: 2,
  status: "approved",
  marketPostingId: "posting-1",
  marketPostingVersionId: "posting-v1",
  profileVersionId: "profile-v1",
  strategyVersionId: "strategy-v1",
  generationPolicyVersion: "freeze3-mvp-v1",
  evidenceMap: [],
  gaps: [],
  targetedCvJson: { basics: { name: "Candidate" } },
  coverLetter: "Verified cover letter",
  formAnswers: {},
  approvedAt: "2026-10-04T12:00:00.000Z",
  exportedAt: null,
  staleReason: null,
  createdAt: "2026-10-04T11:00:00.000Z",
  updatedAt: "2026-10-04T12:00:00.000Z",
};

describe("F3-6E application package export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getApplicationPackage.mockResolvedValue(approved);
    mocks.evaluateStoredApplicationPackageQa.mockResolvedValue({
      applicationPackage: approved,
      qa: {
        pass: true,
        blockingIssues: [],
        staleReasons: [],
        gapCount: 0,
        hardGapCount: 0,
      },
    });
    mocks.updateApplicationPackage.mockResolvedValue({
      ...approved,
      status: "exported",
      exportedAt: "2026-10-04T13:00:00.000Z",
    });
  });

  it("exports only an approved truth-checked package and marks it exported", async () => {
    const result = await exportApplicationPackage({
      applicationPackageId: approved.id,
    });

    expect(mocks.updateApplicationPackage).toHaveBeenCalledWith(approved.id, {
      status: "exported",
      staleReason: null,
    });
    expect(result.applicationPackage.status).toBe("exported");
    expect(result.artifact).toMatchObject({
      fileName: "application-package-v2.json",
      mediaType: "application/json",
      document: {
        packageId: approved.id,
        targetedCvJson: approved.targetedCvJson,
        coverLetter: approved.coverLetter,
      },
    });
  });

  it("blocks export before explicit approval", async () => {
    mocks.getApplicationPackage.mockResolvedValue({
      ...approved,
      status: "draft",
      approvedAt: null,
    });

    await expect(
      exportApplicationPackage({ applicationPackageId: approved.id }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    expect(mocks.evaluateStoredApplicationPackageQa).not.toHaveBeenCalled();
    expect(mocks.updateApplicationPackage).not.toHaveBeenCalled();
  });

  it("blocks export when current QA no longer passes", async () => {
    mocks.evaluateStoredApplicationPackageQa.mockResolvedValue({
      applicationPackage: approved,
      qa: {
        pass: false,
        blockingIssues: ["package_stale"],
        staleReasons: ["profile_changed"],
        gapCount: 0,
        hardGapCount: 0,
      },
    });

    await expect(
      exportApplicationPackage({ applicationPackageId: approved.id }),
    ).rejects.toMatchObject({ status: 409, code: "CONFLICT" });
    expect(mocks.updateApplicationPackage).not.toHaveBeenCalled();
  });

  it("keeps repeated export idempotent", async () => {
    const exported = {
      ...approved,
      status: "exported" as const,
      exportedAt: "2026-10-04T13:00:00.000Z",
    };
    mocks.getApplicationPackage.mockResolvedValue(exported);
    mocks.evaluateStoredApplicationPackageQa.mockResolvedValue({
      applicationPackage: exported,
      qa: {
        pass: true,
        blockingIssues: [],
        staleReasons: [],
        gapCount: 0,
        hardGapCount: 0,
      },
    });

    const result = await exportApplicationPackage({
      applicationPackageId: approved.id,
    });

    expect(mocks.updateApplicationPackage).not.toHaveBeenCalled();
    expect(result.applicationPackage).toEqual(exported);
  });
});
