import { randomUUID } from "node:crypto";
import {
  openCredentialPayload,
  sealCredentialPayload,
} from "@server/security/credential-vault";
import { and, eq } from "drizzle-orm";
import { db, schema } from "../db";
import {
  getPrivateDataScope,
  privateDataScopeFilter,
} from "../tenancy/private-scope";

const { credentialSecrets } = schema;

function scopeFilter() {
  return privateDataScopeFilter(credentialSecrets);
}

export async function getCredentialSecret(args: {
  ownerType: string;
  ownerId: string;
  secretName: string;
}): Promise<Record<string, unknown> | null> {
  const [row] = await db
    .select()
    .from(credentialSecrets)
    .where(
      and(
        scopeFilter(),
        eq(credentialSecrets.ownerType, args.ownerType),
        eq(credentialSecrets.ownerId, args.ownerId),
        eq(credentialSecrets.secretName, args.secretName),
      ),
    )
    .limit(1);
  if (!row) return null;

  return openCredentialPayload(
    {
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.authTag,
      keyVersion: row.keyVersion,
    },
    {
      tenantId: row.tenantId,
      userId: row.userId,
      ownerType: row.ownerType,
      ownerId: row.ownerId,
      secretName: row.secretName,
    },
  );
}

export async function putCredentialSecret(args: {
  ownerType: string;
  ownerId: string;
  secretName: string;
  payload: Record<string, unknown>;
}): Promise<void> {
  const scope = getPrivateDataScope();
  const now = new Date().toISOString();
  const sealed = sealCredentialPayload(args.payload, {
    tenantId: scope.tenantId,
    userId: scope.userId,
    ownerType: args.ownerType,
    ownerId: args.ownerId,
    secretName: args.secretName,
  });

  const [existing] = await db
    .select({ id: credentialSecrets.id })
    .from(credentialSecrets)
    .where(
      and(
        scopeFilter(),
        eq(credentialSecrets.ownerType, args.ownerType),
        eq(credentialSecrets.ownerId, args.ownerId),
        eq(credentialSecrets.secretName, args.secretName),
      ),
    )
    .limit(1);

  if (existing) {
    await db
      .update(credentialSecrets)
      .set({
        ciphertext: sealed.ciphertext,
        iv: sealed.iv,
        authTag: sealed.authTag,
        keyVersion: sealed.keyVersion,
        updatedAt: now,
      })
      .where(and(scopeFilter(), eq(credentialSecrets.id, existing.id)));
    return;
  }

  await db.insert(credentialSecrets).values({
    id: randomUUID(),
    tenantId: scope.tenantId,
    userId: scope.userId,
    ownerType: args.ownerType,
    ownerId: args.ownerId,
    secretName: args.secretName,
    ciphertext: sealed.ciphertext,
    iv: sealed.iv,
    authTag: sealed.authTag,
    keyVersion: sealed.keyVersion,
    createdAt: now,
    updatedAt: now,
  });
}

export async function deleteCredentialSecret(args: {
  ownerType: string;
  ownerId: string;
  secretName: string;
}): Promise<void> {
  await db
    .delete(credentialSecrets)
    .where(
      and(
        scopeFilter(),
        eq(credentialSecrets.ownerType, args.ownerType),
        eq(credentialSecrets.ownerId, args.ownerId),
        eq(credentialSecrets.secretName, args.secretName),
      ),
    );
}
