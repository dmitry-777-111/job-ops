import type { ApplicationPackage } from "@shared/types";
import { describe, expect, it } from "vitest";
import { deriveApplicationPackageStaleReasons } from "./application-package-staleness";

const applicationPackage: ApplicationPackage = {
  id: "package-1",
  version: 1,
  status: "draft",
  marketPostingId: "posting-1",
  marketPostingVersionId: "posting-v1",
  profileVersionId: "profile-v1",
  strategyVersionId: "strategy-v1",
  generationPolicyVersion: "package-policy-v1",
  evidenceMap: [],
  gaps: [],
  targetedCvJson: null,
  coverLetter: null,
  formAnswers: {},
  approvedAt: null,
  exportedAt: null,
  staleReason: null,
  createdAt: "2026-10-03T20:00:00.000Z",
  updatedAt: "2026-10-03T20:00:00.000Z",
};

describe("application package staleness", () => {
  it("keeps unchanged immutable inputs fresh", () => {
    expect(
      deriveApplicationPackageStaleReasons(applicationPackage, {
        marketPostingVersionId: "posting-v1",
        profileVersionId: "profile-v1",
        strategyVersionId: "strategy-v1",
        generationPolicyVersion: "package-policy-v1",
      }),
    ).toEqual([]);
  });

  it("reports only the inputs that changed", () => {
    expect(
      deriveApplicationPackageStaleReasons(applicationPackage, {
        marketPostingVersionId: "posting-v2",
        profileVersionId: "profile-v2",
        strategyVersionId: "strategy-v1",
        generationPolicyVersion: "package-policy-v1",
      }),
    ).toEqual(["posting_changed", "profile_changed"]);
  });
});
