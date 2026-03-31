import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  ADMIN_ACCOUNT_STATUSES,
  classifyManagedAccount,
  computePublicKeyFingerprint,
  filterAccounts,
  hasTrustedLocalAdminKeyMaterial,
  isOwnerClinicDocumentDigits,
  matchesAccountIdentifier,
  normalizeConcurrentAccessLimitOrThrow,
  normalizeOwnerClinicDocumentOrThrow,
  normalizeAdminAccountStatus,
  OWNER_DOCUMENT_LENGTHS,
  sanitizeDigits,
  verifyLocalAdminKeyChallenge,
  sortAccountsForDisplay,
} from "../../scripts/account-admin-lib.mjs";

const accounts = [
  {
    account_role: "account_owner",
    clinic_id: "clinic-1",
    clinic_name: "Clinica Aurora",
    cnpj: "12.345.678/0001-90",
    email: "owner@aurora.test",
    full_name: "Alice Aurora",
    membership_status: "active",
    operational_role: "owner",
    public_code: "A-001",
    subscription_plan: "clinic",
    user_id: "user-owner",
    admin_status: "active",
  },
  {
    account_role: null,
    clinic_id: "clinic-1",
    clinic_name: "Clinica Aurora",
    cnpj: "12.345.678/0001-90",
    email: "professional@aurora.test",
    full_name: "Bruno Fisio",
    membership_status: "active",
    operational_role: "professional",
    public_code: "A-002",
    subscription_plan: "clinic",
    user_id: "user-professional",
    admin_status: "temporarily_paused",
  },
  {
    account_role: "account_owner",
    clinic_id: "clinic-2",
    clinic_name: "Solo Care",
    cnpj: "98.765.432/0001-10",
    email: "solo@care.test",
    full_name: "Carla Solo",
    membership_status: "active",
    operational_role: "owner",
    public_code: "S-001",
    subscription_plan: "solo",
    user_id: "user-solo",
    admin_status: "payment_pending",
  },
];

describe("account admin lib", () => {
  it("sanitizes numeric identifiers", () => {
    expect(sanitizeDigits("12.345.678/0001-90")).toBe("12345678000190");
  });

  it("accepts cpf or cnpj for the owner clinic document", () => {
    expect(OWNER_DOCUMENT_LENGTHS).toEqual([11, 14]);
    expect(isOwnerClinicDocumentDigits("123.456.789-01")).toBe(true);
    expect(isOwnerClinicDocumentDigits("12.345.678/0001-90")).toBe(true);
    expect(isOwnerClinicDocumentDigits("1234567890")).toBe(false);
  });

  it("normalizes cpf or cnpj and rejects other document lengths", () => {
    expect(normalizeOwnerClinicDocumentOrThrow("123.456.789-01")).toBe("12345678901");
    expect(normalizeOwnerClinicDocumentOrThrow("12.345.678/0001-90")).toBe("12345678000190");
    expect(() => normalizeOwnerClinicDocumentOrThrow("123")).toThrow(/11 dígitos/);
  });

  it("normalizes a valid concurrent access limit", () => {
    expect(normalizeConcurrentAccessLimitOrThrow("4")).toBe(4);
    expect(normalizeConcurrentAccessLimitOrThrow("", 2)).toBe(2);
    expect(() => normalizeConcurrentAccessLimitOrThrow("0")).toThrow(/acessos simultâneos/);
  });

  it("filters accounts by search query across multiple fields", () => {
    expect(filterAccounts(accounts, { query: "aurora" }).map((item) => item.email)).toEqual([
      "owner@aurora.test",
      "professional@aurora.test",
    ]);

    expect(filterAccounts(accounts, { query: "A-002" }).map((item) => item.email)).toEqual([
      "professional@aurora.test",
    ]);
  });

  it("filters accounts by plan, role, status and clinic", () => {
    expect(filterAccounts(accounts, { plan: "solo" }).map((item) => item.email)).toEqual([
      "solo@care.test",
    ]);

    expect(filterAccounts(accounts, { role: "professional", clinic: "12345678000190" }).map((item) => item.email)).toEqual([
      "professional@aurora.test",
    ]);

    expect(filterAccounts(accounts, { status: "payment_pending", clinic: "Solo Care" }).map((item) => item.email)).toEqual([
      "solo@care.test",
    ]);
  });

  it("matches a target account by email or user id", () => {
    expect(matchesAccountIdentifier(accounts[0], "owner@aurora.test")).toBe(true);
    expect(matchesAccountIdentifier(accounts[0], "user-owner")).toBe(true);
    expect(matchesAccountIdentifier(accounts[0], "other@test")).toBe(false);
  });

  it("sorts owners before subaccounts and then by email", () => {
    expect(sortAccountsForDisplay([accounts[1], accounts[2], accounts[0]]).map((item) => item.email)).toEqual([
      "owner@aurora.test",
      "solo@care.test",
      "professional@aurora.test",
    ]);
  });

  it("classifies managed accounts for solo, clinic owner and clinic subaccount", () => {
    expect(classifyManagedAccount(accounts[2])).toBe("solo_owner");
    expect(classifyManagedAccount(accounts[0])).toBe("clinic_owner");
    expect(classifyManagedAccount(accounts[1])).toBe("clinic_subaccount");
  });

  it("normalizes valid admin statuses and rejects unknown values", () => {
    expect(ADMIN_ACCOUNT_STATUSES).toEqual(["active", "payment_pending", "temporarily_paused", "banned"]);
    expect(normalizeAdminAccountStatus("payment_pending")).toBe("payment_pending");
    expect(normalizeAdminAccountStatus("temporarily_paused")).toBe("temporarily_paused");
    expect(normalizeAdminAccountStatus("unknown")).toBeNull();
  });

  it("builds a stable fingerprint for a local admin public key", () => {
    const fingerprint = computePublicKeyFingerprint(`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA4rWN+uV7Lx9U8n8NLb4oM0xDkXxP4nBzC5Q9u+ExK2M=
-----END PUBLIC KEY-----`);

    expect(fingerprint).toMatch(/^SHA256:/);
  });

  it("detects trusted local admin key material", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
      privateKeyEncoding: {
        format: "pem",
        type: "pkcs8",
      },
      publicKeyEncoding: {
        format: "pem",
        type: "spki",
      },
    });

    expect(
      hasTrustedLocalAdminKeyMaterial({
        fingerprint: computePublicKeyFingerprint(publicKey),
        privateKey,
        publicKey,
      })
    ).toBe(true);

    expect(
      hasTrustedLocalAdminKeyMaterial({
        fingerprint: "",
        privateKey: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----",
        publicKey: "-----BEGIN PUBLIC KEY-----\\nabc\\n-----END PUBLIC KEY-----",
      })
    ).toBe(false);
  });

  it("verifies a signed local admin challenge", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519", {
      privateKeyEncoding: {
        format: "pem",
        type: "pkcs8",
      },
      publicKeyEncoding: {
        format: "pem",
        type: "spki",
      },
    });
    const fingerprint = computePublicKeyFingerprint(publicKey);

    expect(
      verifyLocalAdminKeyChallenge({
        challenge: "pronto-health-fisio-admin-access",
        fingerprint,
        privateKey,
        publicKey,
      })
    ).toBe(true);
  });
});
