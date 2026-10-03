import { randomBytes } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import {
  CREDENTIAL_VAULT_KEY_ENV,
  CredentialVaultConfigurationError,
  openCredentialPayload,
  sealCredentialPayload,
} from "./credential-vault";

const originalKey = process.env[CREDENTIAL_VAULT_KEY_ENV];
const scope = {
  tenantId: "tenant-a",
  userId: "user-a",
  ownerType: "post_application_integration",
  ownerId: "integration-a",
  secretName: "credentials",
};

afterEach(() => {
  if (originalKey === undefined) delete process.env[CREDENTIAL_VAULT_KEY_ENV];
  else process.env[CREDENTIAL_VAULT_KEY_ENV] = originalKey;
});

describe("credential vault", () => {
  it("round-trips credentials without storing plaintext", () => {
    process.env[CREDENTIAL_VAULT_KEY_ENV] = randomBytes(32).toString("base64url");
    const payload = { refreshToken: "secret-token", email: "a@example.com" };
    const sealed = sealCredentialPayload(payload, scope);
    expect(sealed.ciphertext).not.toContain("secret-token");
    expect(openCredentialPayload(sealed, scope)).toEqual(payload);
  });

  it("binds ciphertext to tenant/user/owner through authenticated data", () => {
    process.env[CREDENTIAL_VAULT_KEY_ENV] = randomBytes(32).toString("base64url");
    const sealed = sealCredentialPayload({ refreshToken: "secret" }, scope);
    expect(() => openCredentialPayload(sealed, { ...scope, userId: "other-user" })).toThrow();
  });

  it("requires a server-held master key", () => {
    delete process.env[CREDENTIAL_VAULT_KEY_ENV];
    expect(() => sealCredentialPayload({ token: "secret" }, scope)).toThrow(CredentialVaultConfigurationError);
  });
});
