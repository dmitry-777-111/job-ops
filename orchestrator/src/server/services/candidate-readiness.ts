import type {
  CandidateStrategyProfile,
  ExternalConnectionSummary,
  MasterCareerProfileVersion,
} from "@shared/types";

export interface CandidateReadiness {
  profileReady: boolean;
  strategyReady: boolean;
  emailConnected: boolean;
  searchReady: boolean;
  applicationPackageReady: boolean;
  nextActions: Array<"add_profile" | "confirm_strategy" | "connect_email">;
}

export function deriveCandidateReadiness(input: {
  profile: MasterCareerProfileVersion | null;
  strategy: CandidateStrategyProfile | null;
  connections: ExternalConnectionSummary[];
}): CandidateReadiness {
  const profileReady = input.profile?.status === "active";
  const strategyReady = input.strategy?.status === "active";
  const emailConnected = input.connections.some(
    (connection) =>
      connection.kind === "email" && connection.status === "connected",
  );

  const nextActions: CandidateReadiness["nextActions"] = [];
  if (!profileReady) nextActions.push("add_profile");
  if (!strategyReady) nextActions.push("confirm_strategy");
  if (!emailConnected) nextActions.push("connect_email");

  return {
    profileReady,
    strategyReady,
    emailConnected,
    // Discovery can run without mailbox access; Gmail is an important inbound
    // channel but must not block market search.
    searchReady: profileReady && strategyReady,
    applicationPackageReady: profileReady,
    nextActions,
  };
}
