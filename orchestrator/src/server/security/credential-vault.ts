import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const KEY_BYTES = 32;
export const CREDENTIAL_VAULT_KEY_VERSION = "v1";
export const CREDENTIAL_VAULT_KEY_ENV = "CAREER_OS_CREDENTIAL_MASTER_KEY";

export class CredentialVaultConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CredentialVaultConfigurationError";
  }
}

export type SealedCredentialPayload = {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: string;
};

function decodeMasterKey(rawValue: string): Buffer {
  const value = rawValue.trim();
  const candidates: Buffer[] = [];
  if (/^[a-fA-F0-9]{64}$/.test(value))
    candidates.push(Buffer.from(value, "hex"));
  try {
    candidates.push(Buffer.from(value, "base64url"));
  } catch {}
  try {
    candidates.push(Buffer.from(value, "base64"));
  } catch {}
  const key = candidates.find((candidate) => candidate.length === KEY_BYTES);
  if (!key) {
    throw new CredentialVaultConfigurationError(
      `${CREDENTIAL_VAULT_KEY_ENV} must decode to exactly 32 bytes (hex, base64, or base64url).`,
    );
  }
  return key;
}

export function getCredentialVaultMasterKey(): Buffer {
  const raw = process.env[CREDENTIAL_VAULT_KEY_ENV]?.trim();
  if (!raw) {
    throw new CredentialVaultConfigurationError(
      `${CREDENTIAL_VAULT_KEY_ENV} is required before storing external-account credentials.`,
    );
  }
  return decodeMasterKey(raw);
}

function buildAad(args: {
  tenantId: string;
  userId: string | null;
  ownerType: string;
  ownerId: string;
  secretName: string;
}): Buffer {
  return Buffer.from(
    [
      "career-os-credential-vault",
      CREDENTIAL_VAULT_KEY_VERSION,
      args.tenantId,
      args.userId ?? "",
      args.ownerType,
      args.ownerId,
      args.secretName,
    ].join("\u001f"),
    "utf8",
  );
}

export function sealCredentialPayload(
  payload: Record<string, unknown>,
  scope: {
    tenantId: string;
    userId: string | null;
    ownerType: string;
    ownerId: string;
    secretName: string;
  },
): SealedCredentialPayload {
  const key = getCredentialVaultMasterKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(buildAad(scope));
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64url"),
    iv: iv.toString("base64url"),
    authTag: cipher.getAuthTag().toString("base64url"),
    keyVersion: CREDENTIAL_VAULT_KEY_VERSION,
  };
}

export function openCredentialPayload(
  sealed: SealedCredentialPayload,
  scope: {
    tenantId: string;
    userId: string | null;
    ownerType: string;
    ownerId: string;
    secretName: string;
  },
): Record<string, unknown> {
  if (sealed.keyVersion !== CREDENTIAL_VAULT_KEY_VERSION) {
    throw new CredentialVaultConfigurationError(
      `Unsupported credential vault key version '${sealed.keyVersion}'.`,
    );
  }
  const decipher = createDecipheriv(
    ALGORITHM,
    getCredentialVaultMasterKey(),
    Buffer.from(sealed.iv, "base64url"),
  );
  decipher.setAAD(buildAad(scope));
  decipher.setAuthTag(Buffer.from(sealed.authTag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(sealed.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const parsed = JSON.parse(plaintext) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Credential vault payload is not an object.");
  }
  return parsed as Record<string, unknown>;
}
