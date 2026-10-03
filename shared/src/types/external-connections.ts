export const EXTERNAL_CONNECTION_KINDS = [
  "email",
  "job_board",
  "professional_profile",
  "cloud_storage",
  "calendar",
  "other",
] as const;
export type ExternalConnectionKind = (typeof EXTERNAL_CONNECTION_KINDS)[number];

export const EXTERNAL_CONNECTION_STATUSES = [
  "disconnected",
  "connected",
  "requires_action",
  "error",
] as const;
export type ExternalConnectionStatus =
  (typeof EXTERNAL_CONNECTION_STATUSES)[number];

export interface ExternalConnectionSummary {
  id: string;
  providerId: string;
  kind: ExternalConnectionKind;
  accountKey: string;
  displayName: string | null;
  status: ExternalConnectionStatus;
  scopes: string[];
  capabilities: string[];
  metadata: Record<string, unknown>;
  lastConnectedAt: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}
