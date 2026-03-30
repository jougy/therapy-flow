import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";

export const sanitizeDigits = (value = "") => String(value).replace(/\D/g, "");
export const ADMIN_ACCOUNT_STATUSES = ["active", "payment_pending", "temporarily_paused", "banned"];

export const normalizeText = (value = "") =>
  String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const normalizeAdminAccountStatus = (value) => {
  const normalized = normalizeText(value);
  return ADMIN_ACCOUNT_STATUSES.includes(normalized) ? normalized : null;
};

export const deriveAdminAccountStatus = (account) => {
  const explicitStatus = normalizeAdminAccountStatus(account.admin_status);

  if (explicitStatus) {
    return explicitStatus;
  }

  if (account.is_active && account.membership_status === "active") {
    return "active";
  }

  if (account.membership_status === "inactive") {
    return "payment_pending";
  }

  if (account.membership_status === "suspended") {
    return "temporarily_paused";
  }

  return "banned";
};

export const classifyManagedAccount = (account) => {
  if (account.subscription_plan === "solo") {
    return "solo_owner";
  }

  if (account.account_role === "account_owner") {
    return "clinic_owner";
  }

  return "clinic_subaccount";
};

export const matchesAccountIdentifier = (account, identifier) => {
  const normalizedIdentifier = normalizeText(identifier);

  return (
    normalizeText(account.user_id) === normalizedIdentifier ||
    normalizeText(account.email) === normalizedIdentifier
  );
};

export const filterAccounts = (accounts, filters = {}) => {
  const query = normalizeText(filters.query ?? "");
  const plan = normalizeText(filters.plan ?? "");
  const role = normalizeText(filters.role ?? "");
  const status = normalizeText(filters.status ?? "");
  const clinic = normalizeText(filters.clinic ?? "");

  return accounts.filter((account) => {
    if (query) {
      const haystack = [
        account.email,
        account.full_name,
        account.clinic_name,
        account.cnpj,
        account.public_code,
        account.user_id,
      ]
        .map((item) => normalizeText(item ?? ""))
        .join(" ");

      if (!haystack.includes(query)) {
        return false;
      }
    }

    if (plan && normalizeText(account.subscription_plan ?? "") !== plan) {
      return false;
    }

    if (role && normalizeText(account.operational_role ?? "") !== role) {
      return false;
    }

    if (status && deriveAdminAccountStatus(account) !== status) {
      return false;
    }

    if (clinic) {
      const normalizedClinicDigits = sanitizeDigits(clinic);
      const clinicMatches =
        normalizeText(account.clinic_id ?? "") === clinic ||
        normalizeText(account.clinic_name ?? "") === clinic ||
        (normalizedClinicDigits && sanitizeDigits(account.cnpj ?? "") === normalizedClinicDigits);

      if (!clinicMatches) {
        return false;
      }
    }

    return true;
  });
};

export const sortAccountsForDisplay = (accounts) =>
  [...accounts].sort((left, right) => {
    const leftOwnerWeight = left.account_role === "account_owner" ? 0 : 1;
    const rightOwnerWeight = right.account_role === "account_owner" ? 0 : 1;

    if (leftOwnerWeight !== rightOwnerWeight) {
      return leftOwnerWeight - rightOwnerWeight;
    }

    return normalizeText(left.email).localeCompare(normalizeText(right.email));
  });

const normalizePem = (value = "") => String(value).trim();

export const computePublicKeyFingerprint = (publicKey) => {
  const normalizedPublicKey = normalizePem(publicKey);

  if (!normalizedPublicKey) {
    return "";
  }

  const der = createPublicKey(normalizedPublicKey).export({
    format: "der",
    type: "spki",
  });

  return `SHA256:${createHash("sha256").update(der).digest("base64").replace(/=+$/u, "")}`;
};

export const hasTrustedLocalAdminKeyMaterial = ({ fingerprint, privateKey, publicKey }) => {
  const normalizedFingerprint = String(fingerprint ?? "").trim();
  const normalizedPrivateKey = normalizePem(privateKey);
  const normalizedPublicKey = normalizePem(publicKey);

  if (!normalizedFingerprint || !normalizedPrivateKey || !normalizedPublicKey) {
    return false;
  }

  return computePublicKeyFingerprint(normalizedPublicKey) === normalizedFingerprint;
};

export const verifyLocalAdminKeyChallenge = ({ challenge, fingerprint, privateKey, publicKey }) => {
  if (!hasTrustedLocalAdminKeyMaterial({ fingerprint, privateKey, publicKey })) {
    return false;
  }

  try {
    const challengeBuffer = Buffer.from(String(challenge ?? ""), "utf8");
    const privateKeyObject = createPrivateKey(normalizePem(privateKey));
    const publicKeyObject = createPublicKey(normalizePem(publicKey));
    const signature = sign(null, challengeBuffer, privateKeyObject);

    return verify(null, challengeBuffer, publicKeyObject, signature);
  } catch {
    return false;
  }
};
