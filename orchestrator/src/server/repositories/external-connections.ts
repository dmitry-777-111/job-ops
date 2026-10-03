import { randomUUID } from "node:crypto";
import type {
  ExternalConnectionKind,
  ExternalConnectionStatus,
  ExternalConnectionSummary,
} from "@shared/types";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";
import {
  deleteCredentialSecret,
  getCredentialSecret,
  putCredentialSecret,
} from "./credential-secrets";

const { externalConnections } = schema;
const SECRET_OWNER_TYPE = "external_connection";
const SECRET_NAME = "credentials";

function scopeFilter() {
  return privateDataScopeFilter(externalConnections);
}

function mapRow(
  row: typeof externalConnections.$inferSelect,
): ExternalConnectionSummary {
  return {
    id: row.id,
    providerId: row.providerId,
    kind: row.kind as ExternalConnectionKind,
    accountKey: row.accountKey,
    displayName: row.displayName,
    status: row.status as ExternalConnectionStatus,
    scopes: (row.scopes as string[]) ?? [],
    capabilities: (row.capabilities as string[]) ?? [],
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    lastConnectedAt: row.lastConnectedAt,
    lastSyncedAt: row.lastSyncedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listExternalConnections(): Promise<
  ExternalConnectionSummary[]
> {
  const rows = await db.select().from(externalConnections).where(scopeFilter());
  return rows.map(mapRow);
}

export async function getExternalConnection(
  providerId: string,
  accountKey = "default",
): Promise<ExternalConnectionSummary | null> {
  const [row] = await db
    .select()
    .from(externalConnections)
    .where(
      and(
        scopeFilter(),
        eq(externalConnections.providerId, providerId),
        eq(externalConnections.accountKey, accountKey),
      ),
    )
    .limit(1);
  return row ? mapRow(row) : null;
}

export async function upsertExternalConnection(input: {
  providerId: string;
  kind: ExternalConnectionKind;
  accountKey?: string;
  displayName?: string | null;
  status?: ExternalConnectionStatus;
  scopes?: string[];
  capabilities?: string[];
  metadata?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
}): Promise<ExternalConnectionSummary> {
  const scope = getPrivateDataScope();
  const accountKey = input.accountKey?.trim() || "default";
  const existing = await getExternalConnection(input.providerId, accountKey);
  const now = new Date().toISOString();
  const id = existing?.id ?? randomUUID();

  if (input.credentials) {
    await putCredentialSecret({
      ownerType: SECRET_OWNER_TYPE,
      ownerId: id,
      secretName: SECRET_NAME,
      payload: input.credentials,
    });
  }

  if (existing) {
    await db
      .update(externalConnections)
      .set({
        kind: input.kind,
        displayName: input.displayName ?? existing.displayName,
        status: input.status ?? existing.status,
        scopes: input.scopes ?? existing.scopes,
        capabilities: input.capabilities ?? existing.capabilities,
        metadata: input.metadata ?? existing.metadata,
        ...(input.status === "connected" ? { lastConnectedAt: now } : {}),
        lastError: input.status === "connected" ? null : existing.lastError,
        updatedAt: now,
      })
      .where(and(scopeFilter(), eq(externalConnections.id, existing.id)));
  } else {
    await db.insert(externalConnections).values({
      id,
      tenantId: scope.tenantId,
      userId: scope.userId,
      providerId: input.providerId.trim(),
      kind: input.kind,
      accountKey,
      displayName: input.displayName ?? null,
      status: input.status ?? "disconnected",
      scopes: input.scopes ?? [],
      capabilities: input.capabilities ?? [],
      metadata: input.metadata ?? {},
      lastConnectedAt: input.status === "connected" ? now : null,
      createdAt: now,
      updatedAt: now,
    });
  }

  const result = await getExternalConnection(input.providerId, accountKey);
  if (!result) throw new Error("Failed to load external connection.");
  return result;
}

/** Server-only: secrets never belong in candidate-facing connection summaries. */
export async function getExternalConnectionCredentials(
  connectionId: string,
): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select({ id: externalConnections.id })
    .from(externalConnections)
    .where(and(scopeFilter(), eq(externalConnections.id, connectionId)))
    .limit(1);
  if (!row) return null;
  return getCredentialSecret({
    ownerType: SECRET_OWNER_TYPE,
    ownerId: row.id,
    secretName: SECRET_NAME,
  });
}

export async function disconnectExternalConnection(
  connectionId: string,
): Promise<ExternalConnectionSummary | null> {
  const [row] = await db
    .select()
    .from(externalConnections)
    .where(and(scopeFilter(), eq(externalConnections.id, connectionId)))
    .limit(1);
  if (!row) return null;

  await deleteCredentialSecret({
    ownerType: SECRET_OWNER_TYPE,
    ownerId: row.id,
    secretName: SECRET_NAME,
  });
  const now = new Date().toISOString();
  await db
    .update(externalConnections)
    .set({ status: "disconnected", lastError: null, updatedAt: now })
    .where(and(scopeFilter(), eq(externalConnections.id, row.id)));

  const [updated] = await db
    .select()
    .from(externalConnections)
    .where(and(scopeFilter(), eq(externalConnections.id, row.id)))
    .limit(1);
  return updated ? mapRow(updated) : null;
}
