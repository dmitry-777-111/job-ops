import type { ExternalConnectionKind } from "@shared/types";

export const EXTERNAL_CONNECTION_PROVIDERS = [
  {
    id: "gmail",
    label: "Gmail",
    kind: "email",
    connectMode: "oauth",
    enabled: true,
    capabilities: ["read_job_related_mail", "sync_recruiter_responses"],
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    kind: "professional_profile",
    connectMode: "profile_or_alerts",
    enabled: false,
    capabilities: ["profile_reference", "job_alert_ingestion"],
  },
  {
    id: "jobbank",
    label: "Job Bank",
    kind: "job_board",
    connectMode: "profile_or_alerts",
    enabled: false,
    capabilities: ["profile_reference", "job_alert_ingestion"],
  },
  {
    id: "indeed",
    label: "Indeed",
    kind: "job_board",
    connectMode: "profile_or_alerts",
    enabled: false,
    capabilities: ["profile_reference", "job_alert_ingestion"],
  },
] as const satisfies readonly Array<{
  id: string;
  label: string;
  kind: ExternalConnectionKind;
  connectMode: "oauth" | "profile_or_alerts";
  enabled: boolean;
  capabilities: ReadonlyArray<string>;
}>;

export type ExternalConnectionProviderId =
  (typeof EXTERNAL_CONNECTION_PROVIDERS)[number]["id"];

export function listExternalConnectionProviders() {
  return EXTERNAL_CONNECTION_PROVIDERS.map((provider) => ({
    ...provider,
    capabilities: [...provider.capabilities],
  }));
}
