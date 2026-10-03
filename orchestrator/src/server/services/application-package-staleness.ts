import type { ApplicationPackage } from "@shared/types";

export const APPLICATION_PACKAGE_STALE_REASONS = [
  "posting_changed",
  "profile_changed",
  "strategy_changed",
  "generation_policy_changed",
] as const;
export type ApplicationPackageStaleReason =
  (typeof APPLICATION_PACKAGE_STALE_REASONS)[number];

export function deriveApplicationPackageStaleReasons(
  applicationPackage: ApplicationPackage,
  current: {
    marketPostingVersionId: string;
    profileVersionId: string;
    strategyVersionId: string | null;
    generationPolicyVersion: string;
  },
): ApplicationPackageStaleReason[] {
  const reasons: ApplicationPackageStaleReason[] = [];
  if (
    applicationPackage.marketPostingVersionId !== current.marketPostingVersionId
  ) {
    reasons.push("posting_changed");
  }
  if (applicationPackage.profileVersionId !== current.profileVersionId) {
    reasons.push("profile_changed");
  }
  if (applicationPackage.strategyVersionId !== current.strategyVersionId) {
    reasons.push("strategy_changed");
  }
  if (
    applicationPackage.generationPolicyVersion !==
    current.generationPolicyVersion
  ) {
    reasons.push("generation_policy_changed");
  }
  return reasons;
}
