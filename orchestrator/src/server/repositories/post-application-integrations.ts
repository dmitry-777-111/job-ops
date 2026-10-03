import { randomUUID } from "node:crypto";
import type {
  PostApplicationIntegration,
  PostApplicationIntegrationStatus,
  PostApplicationProvider,
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

const { postApplicationIntegrations } = schema;
const CREDENTIAL_OWNER_TYPE = "post_application_integration";
const CREDENTIAL_SECRET_NAME = "credentials";

function integrationsScopeFilter() {
  return privateDataScopeFilter(postApplicationIntegrations);
}

type IntegrationCredentials = Record<string, unknown>;

type UpsertConnectedIntegrationInput = {
  provider: PostApplicationProvider;
  accountKey: string;
  displayName?: string | null;
  credentials: IntegrationCredentials;
};

type UpdatePostApplicationIntegrationSyncStateInput = {
  provider: PostApplicationProvider;
  accountKey: string;
  lastSyncedAt?: number | null;
  lastError?: string | null;
  credentials?: IntegrationCredentials | null;
  status?: PostApplicationIntegrationStatus;
};

function asCredentials(value: unknown): IntegrationCredentials | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as IntegrationCredentials;
}

async function mapRowToIntegration(
  row: typeof postApplicationIntegrations.$inferSelect,
): Promise<PostApplicationIntegration> {
  const vaultedCredentials = await getCredentialSecret({
    ownerType: CREDENTIAL_OWNER_TYPE,
    ownerId: row.id,
    secretName: CREDENTIAL_SECRET_NAME,
  });
  return {
    id: row.id,
    provider: row.provider,
    accountKey: row.accountKey,
    displayName: row.displayName,
    status: row.status as PostApplicationIntegrationStatus,
    // Legacy plaintext is read-only compatibility until the migration gate.
    credentials: vaultedCredentials ?? asCredentials(row.credentials),
    lastConnectedAt: row.lastConnectedAt,
    lastSyncedAt: row.lastSyncedAt,
    lastError: row.lastError,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getPostApplicationIntegration(
  provider: PostApplicationProvider,
  accountKey: string,
): Promise<PostApplicationIntegration | null> {
  const [row] = await db
    .select()
    .from(postApplicationIntegrations)
    .where(
      and(
        eq(postApplicationIntegrations.provider, provider),
        eq(postApplicationIntegrations.accountKey, accountKey),
        integrationsScopeFilter(),
      ),
    );

  return row ? await mapRowToIntegration(row) : null;
}

export async function upsertConnectedPostApplicationIntegration(
  input: UpsertConnectedIntegrationInput,
): Promise<PostApplicationIntegration> {
  const nowEpoch = Date.now();
  const nowIso = new Date(nowEpoch).toISOString();
  const scope = getPrivateDataScope();
  const existing = await getPostApplicationIntegration(
    input.provider,
    input.accountKey,
  );

  if (existing) {
    await putCredentialSecret({
      ownerType: CREDENTIAL_OWNER_TYPE,
      ownerId: existing.id,
      secretName: CREDENTIAL_SECRET_NAME,
      payload: input.credentials,
    });
    await db
      .update(postApplicationIntegrations)
      .set({
        displayName: input.displayName ?? existing.displayName,
        status: "connected",
        credentials: null,
        lastConnectedAt: nowEpoch,
        lastError: null,
        updatedAt: nowIso,
      })
      .where(eq(postApplicationIntegrations.id, existing.id));

    const updated = await getPostApplicationIntegration(
      input.provider,
      input.accountKey,
    );
    if (!updated) {
      throw new Error(
        `Failed to load updated integration ${input.provider}/${input.accountKey}.`,
      );
    }
    return updated;
  }

  const id = randomUUID();
  await db.insert(postApplicationIntegrations).values({
    id,
    tenantId: scope.tenantId,
    userId: scope.userId,
    provider: input.provider,
    accountKey: input.accountKey,
    displayName: input.displayName ?? null,
    status: "connected",
    credentials: null,
    lastConnectedAt: nowEpoch,
    lastError: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  try {
    await putCredentialSecret({
      ownerType: CREDENTIAL_OWNER_TYPE,
      ownerId: id,
      secretName: CREDENTIAL_SECRET_NAME,
      payload: input.credentials,
    });
  } catch (error) {
    await db
      .delete(postApplicationIntegrations)
      .where(
        and(integrationsScopeFilter(), eq(postApplicationIntegrations.id, id)),
      );
    throw error;
  }

  const created = await getPostApplicationIntegration(
    input.provider,
    input.accountKey,
  );
  if (!created) {
    throw new Error(
      `Failed to load created integration ${input.provider}/${input.accountKey}.`,
    );
  }
  return created;
}

export async function disconnectPostApplicationIntegration(
  provider: PostApplicationProvider,
  accountKey: string,
): Promise<PostApplicationIntegration | null> {
  const existing = await getPostApplicationIntegration(provider, accountKey);
  if (!existing) return null;

  const nowIso = new Date().toISOString();
  await deleteCredentialSecret({
    ownerType: CREDENTIAL_OWNER_TYPE,
    ownerId: existing.id,
    secretName: CREDENTIAL_SECRET_NAME,
  });
  await db
    .update(postApplicationIntegrations)
    .set({
      status: "disconnected",
      credentials: null,
      lastError: null,
      updatedAt: nowIso,
    })
    .where(
      and(
        integrationsScopeFilter(),
        eq(postApplicationIntegrations.id, existing.id),
      ),
    );

  return getPostApplicationIntegration(provider, accountKey);
}

export async function updatePostApplicationIntegrationSyncState(
  input: UpdatePostApplicationIntegrationSyncStateInput,
): Promise<PostApplicationIntegration | null> {
  const existing = await getPostApplicationIntegration(
    input.provider,
    input.accountKey,
  );
  if (!existing) return null;

  const nowIso = new Date().toISOString();
  if (input.credentials !== undefined) {
    if (input.credentials === null) {
      await deleteCredentialSecret({
        ownerType: CREDENTIAL_OWNER_TYPE,
        ownerId: existing.id,
        secretName: CREDENTIAL_SECRET_NAME,
      });
    } else {
      await putCredentialSecret({
        ownerType: CREDENTIAL_OWNER_TYPE,
        ownerId: existing.id,
        secretName: CREDENTIAL_SECRET_NAME,
        payload: input.credentials,
      });
    }
  }
  await db
    .update(postApplicationIntegrations)
    .set({
      ...(input.status ? { status: input.status } : {}),
      ...(input.lastSyncedAt !== undefined
        ? { lastSyncedAt: input.lastSyncedAt }
        : {}),
      ...(input.lastError !== undefined ? { lastError: input.lastError } : {}),
      ...(input.credentials !== undefined ? { credentials: null } : {}),
      updatedAt: nowIso,
    })
    .where(
      and(
        integrationsScopeFilter(),
        eq(postApplicationIntegrations.id, existing.id),
      ),
    );

  return getPostApplicationIntegration(input.provider, input.accountKey);
}
