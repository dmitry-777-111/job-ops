import { randomUUID } from "node:crypto";
import { logger } from "@infra/logger";
import { sealCredentialPayload } from "@server/security/credential-vault";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { db, schema } from "../db";

const { credentialSecrets, postApplicationIntegrations } = schema;
const OWNER_TYPE = "post_application_integration";
const SECRET_NAME = "credentials";

type LegacyCredentials = Record<string, unknown>;

function asLegacyCredentials(value: unknown): LegacyCredentials | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as LegacyCredentials;
}

/**
 * One-way startup migration for v3: move any legacy plaintext integration
 * credentials into the encrypted credential vault, then clear the old column.
 * If plaintext credentials exist and the server master key is unavailable,
 * sealing throws and startup must not continue with an insecure fallback.
 */
export async function migrateLegacyIntegrationCredentialsToVault(): Promise<{
  migrated: number;
}> {
  const legacyRows = await db
    .select()
    .from(postApplicationIntegrations)
    .where(isNotNull(postApplicationIntegrations.credentials));

  let migrated = 0;

  for (const row of legacyRows) {
    const credentials = asLegacyCredentials(row.credentials);
    if (!credentials) {
      throw new Error(
        `Legacy integration credentials are invalid for integration ${row.id}.`,
      );
    }

    const sealed = sealCredentialPayload(credentials, {
      tenantId: row.tenantId,
      userId: row.userId,
      ownerType: OWNER_TYPE,
      ownerId: row.id,
      secretName: SECRET_NAME,
    });
    const now = new Date().toISOString();

    db.transaction((tx) => {
      const existing = tx
        .select({ id: credentialSecrets.id })
        .from(credentialSecrets)
        .where(
          and(
            eq(credentialSecrets.tenantId, row.tenantId),
            row.userId === null
              ? isNull(credentialSecrets.userId)
              : eq(credentialSecrets.userId, row.userId),
            eq(credentialSecrets.ownerType, OWNER_TYPE),
            eq(credentialSecrets.ownerId, row.id),
            eq(credentialSecrets.secretName, SECRET_NAME),
          ),
        )
        .get();

      if (existing) {
        tx.update(credentialSecrets)
          .set({
            ciphertext: sealed.ciphertext,
            iv: sealed.iv,
            authTag: sealed.authTag,
            keyVersion: sealed.keyVersion,
            updatedAt: now,
          })
          .where(eq(credentialSecrets.id, existing.id))
          .run();
      } else {
        tx.insert(credentialSecrets)
          .values({
            id: randomUUID(),
            tenantId: row.tenantId,
            userId: row.userId,
            ownerType: OWNER_TYPE,
            ownerId: row.id,
            secretName: SECRET_NAME,
            ciphertext: sealed.ciphertext,
            iv: sealed.iv,
            authTag: sealed.authTag,
            keyVersion: sealed.keyVersion,
            createdAt: now,
            updatedAt: now,
          })
          .run();
      }

      tx.update(postApplicationIntegrations)
        .set({ credentials: null, updatedAt: now })
        .where(eq(postApplicationIntegrations.id, row.id))
        .run();
    });

    migrated += 1;
  }

  if (migrated > 0) {
    logger.info("Credential vault legacy migration completed", { migrated });
  }

  return { migrated };
}
