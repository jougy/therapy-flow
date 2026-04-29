#!/usr/bin/env node

import { execFile } from "node:child_process";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { promisify } from "node:util";
import { createClient } from "@supabase/supabase-js";
import {
  buildPatientCreatePayload,
  buildPatientUpdatePayload,
  buildSelectedAccountMenuOptions,
  MAIN_MENU_OPTIONS,
} from "./account-admin-cli-lib.mjs";
import {
  ADMIN_ACCOUNT_STATUSES,
  classifyManagedAccount,
  computePublicKeyFingerprint,
  DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN,
  deriveAdminAccountStatus,
  filterAccounts,
  hasTrustedLocalAdminKeyMaterial,
  normalizeOwnerClinicDocumentOrThrow,
  normalizeConcurrentAccessLimitOrThrow,
  matchesAccountIdentifier,
  resolveConcurrentAccessLimitFromClinic,
  sanitizeDigits,
  verifyLocalAdminKeyChallenge,
  sortAccountsForDisplay,
} from "./account-admin-lib.mjs";

const SUPPORTED_ADMIN_PLATFORMS = new Set(["darwin", "linux"]);
const ADMIN_MODE = process.env.THERAPY_FLOW_ADMIN_MODE === "prod" ? "prod" : "local";
const DEFAULT_LOCAL_CLI_NAME = process.platform === "linux"
  ? "./scripts/ops/account-admin-linux.sh"
  : "./scripts/ops/account-admin-local.sh";
const CLI_NAME =
  process.env.THERAPY_FLOW_ADMIN_CLI_NAME ||
  (ADMIN_MODE === "prod" ? "./scripts/ops/account-admin-prod.sh" : DEFAULT_LOCAL_CLI_NAME);
const SUPPORT_PLATFORM = ADMIN_MODE === "prod" ? "Pronto Health - Fisio · Production" : "Pronto Health - Fisio";
const MACHINE_LABEL = process.platform === "darwin" ? "neste Mac" : "nesta máquina";
const resolveLocalAdminDir = () => {
  if (process.env.PRONTO_HEALTH_FISIO_ADMIN_HOME) {
    return process.env.PRONTO_HEALTH_FISIO_ADMIN_HOME;
  }

  if (process.env.THERAPY_FLOW_ADMIN_HOME) {
    return process.env.THERAPY_FLOW_ADMIN_HOME;
  }

  const newDir = join(homedir(), ADMIN_MODE === "prod" ? ".pronto-health-fisio-admin-prod" : ".pronto-health-fisio-admin");
  const legacyDir = join(homedir(), ADMIN_MODE === "prod" ? ".therapy-flow-admin-prod" : ".therapy-flow-admin");

  if (existsSync(newDir)) {
    return newDir;
  }

  if (existsSync(legacyDir)) {
    return legacyDir;
  }

  return newDir;
};

const LOCAL_ADMIN_DIR = resolveLocalAdminDir();
const LOCAL_ADMIN_KEY_PATH = join(LOCAL_ADMIN_DIR, "id_ed25519.pem");
const LOCAL_ADMIN_PUBLIC_KEY_PATH = join(LOCAL_ADMIN_DIR, "id_ed25519.pub.pem");
const LOCAL_ADMIN_FINGERPRINT_PATH = join(LOCAL_ADMIN_DIR, "trusted_fingerprint");
const PROD_ENV_PATH = process.env.THERAPY_FLOW_ADMIN_PROD_ENV || join(LOCAL_ADMIN_DIR, "supabase.env");
const execFileAsync = promisify(execFile);

const print = (message = "") => output.write(`${message}\n`);

const readOptionalFile = (filePath) => {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
};

const loadLocalAdminKeyMaterial = () => ({
  fingerprint: readOptionalFile(LOCAL_ADMIN_FINGERPRINT_PATH),
  privateKey: readOptionalFile(LOCAL_ADMIN_KEY_PATH),
  publicKey: readOptionalFile(LOCAL_ADMIN_PUBLIC_KEY_PATH),
});

const initializeLocalAdminKey = ({ overwrite = false } = {}) => {
  const current = loadLocalAdminKeyMaterial();

  if (!overwrite && hasTrustedLocalAdminKeyMaterial(current)) {
    return {
      created: false,
      fingerprint: current.fingerprint.trim(),
    };
  }

  mkdirSync(LOCAL_ADMIN_DIR, { recursive: true, mode: 0o700 });

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

  writeFileSync(LOCAL_ADMIN_KEY_PATH, `${privateKey.trim()}\n`, { encoding: "utf8", mode: 0o600 });
  writeFileSync(LOCAL_ADMIN_PUBLIC_KEY_PATH, `${publicKey.trim()}\n`, { encoding: "utf8", mode: 0o644 });
  writeFileSync(LOCAL_ADMIN_FINGERPRINT_PATH, `${fingerprint}\n`, { encoding: "utf8", mode: 0o600 });

  return {
    created: true,
    fingerprint,
  };
};

const assertTrustedLocalAdminAccess = () => {
  const keyMaterial = loadLocalAdminKeyMaterial();

  if (!hasTrustedLocalAdminKeyMaterial(keyMaterial)) {
    throw new Error(
      `Chave local administrativa ausente ou inválida. Rode ${CLI_NAME} init-key ${MACHINE_LABEL} antes de usar o gerenciador.`
    );
  }

  const challenge = `pronto-health-fisio-local-admin:${randomUUID()}`;

  if (!verifyLocalAdminKeyChallenge({ ...keyMaterial, challenge })) {
    throw new Error(`Não foi possível validar a chave local administrativa ${MACHINE_LABEL}.`);
  }

  return {
    fingerprint: keyMaterial.fingerprint.trim(),
  };
};

const parseArgs = (argv) => {
  const [command, ...rest] = argv;
  const options = {};

  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const next = rest[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return { command, options };
};

const normalizeEnvValue = (value = "") => {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
};

const parseEnvBlock = (block) =>
  Object.fromEntries(
    block
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), normalizeEnvValue(line.slice(separator + 1))];
      })
  );

const loadEnvFile = (filePath) => {
  const raw = readOptionalFile(filePath);
  if (!raw.trim()) {
    throw new Error(`Arquivo de ambiente não encontrado ou vazio: ${filePath}`);
  }

  return parseEnvBlock(raw);
};

const loadRuntimeEnv = async () => {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return {
      supabaseUrl: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  if (ADMIN_MODE === "prod") {
    const env = loadEnvFile(PROD_ENV_PATH);

    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error(
        `Arquivo de ambiente de produção incompleto. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY em ${PROD_ENV_PATH}.`
      );
    }

    return {
      supabaseUrl: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  const { stdout: envOutput } = await execFileAsync(
    "npx",
    ["supabase", "status", "-o", "env"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NPM_CONFIG_PREFIX: "",
        NPM_CONFIG_GLOBALCONFIG: "/dev/null",
      },
    }
  );
  const env = parseEnvBlock(envOutput);

  if (!env.API_URL || !env.SERVICE_ROLE_KEY) {
    throw new Error("Não foi possível localizar o ambiente do Supabase local.");
  }

  return {
    supabaseUrl: env.API_URL,
    serviceRoleKey: env.SERVICE_ROLE_KEY,
  };
};

const createAdminClient = async () => {
  const env = await loadRuntimeEnv();

  return createClient(env.supabaseUrl, env.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const listAllUsers = async (client) => {
  const allUsers = [];
  let page = 1;
  const perPage = 500;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);

    const users = data?.users ?? [];
    allUsers.push(...users);

    if (users.length < perPage) {
      break;
    }

    page += 1;
  }

  return allUsers;
};

const chooseMembership = (memberships) =>
  [...memberships].sort((left, right) => {
    const leftOwner = left.account_role === "account_owner" ? 0 : 1;
    const rightOwner = right.account_role === "account_owner" ? 0 : 1;

    if (leftOwner !== rightOwner) {
      return leftOwner - rightOwner;
    }

    return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
  })[0] ?? null;

const boolFromStatus = (status) => status === "active";

const toMembershipStatus = (status) => {
  switch (status) {
    case "active":
      return "active";
    case "payment_pending":
      return "inactive";
    case "temporarily_paused":
    case "banned":
      return "suspended";
    default:
      throw new Error(`Status administrativo inválido: ${status}`);
  }
};

const normalizeStatusOrThrow = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!ADMIN_ACCOUNT_STATUSES.includes(normalized)) {
    throw new Error(`Status inválido. Use: ${ADMIN_ACCOUNT_STATUSES.join(", ")}`);
  }
  return normalized;
};

const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase();

const normalizeClinicDocumentOrThrow = (value) => normalizeOwnerClinicDocumentOrThrow(value);

const isMissingConcurrentAccessLimitColumnError = (error) => {
  const message = String(error?.message ?? "").toLowerCase();

  return (
    message.includes("concurrent_access_limit") &&
    (message.includes("clinics") || message.includes("schema cache") || message.includes("column"))
  );
};

const fetchClinicsWithFallback = async (client) => {
  const primaryRes = await client
    .from("clinics")
    .select("id, cnpj, name, subscription_plan, subaccount_limit, concurrent_access_limit, account_owner_user_id");

  if (!primaryRes.error) {
    return {
      clinics: primaryRes.data ?? [],
      supportsConcurrentAccessLimit: true,
    };
  }

  if (!isMissingConcurrentAccessLimitColumnError(primaryRes.error)) {
    throw new Error(primaryRes.error.message);
  }

  const fallbackRes = await client
    .from("clinics")
    .select("id, cnpj, name, subscription_plan, subaccount_limit, account_owner_user_id");

  if (fallbackRes.error) {
    throw new Error(fallbackRes.error.message);
  }

  return {
    clinics: (fallbackRes.data ?? []).map((clinic) => ({
      ...clinic,
      concurrent_access_limit: resolveConcurrentAccessLimitFromClinic(clinic),
    })),
    supportsConcurrentAccessLimit: false,
  };
};

const fetchAccounts = async (client) => {
  const [users, profilesRes, membershipsRes, clinicsState] = await Promise.all([
    listAllUsers(client),
    client.from("profiles").select("id, clinic_id, email, full_name, public_code, created_at, updated_at"),
    client.from("clinic_memberships").select("id, clinic_id, user_id, account_role, operational_role, membership_status, is_active, created_at, updated_at"),
    fetchClinicsWithFallback(client),
  ]);

  if (profilesRes.error) throw new Error(profilesRes.error.message);
  if (membershipsRes.error) throw new Error(membershipsRes.error.message);

  const profileById = new Map((profilesRes.data ?? []).map((profile) => [profile.id, profile]));
  const membershipsByUserId = new Map();

  for (const membership of membershipsRes.data ?? []) {
    const list = membershipsByUserId.get(membership.user_id) ?? [];
    list.push(membership);
    membershipsByUserId.set(membership.user_id, list);
  }

  const clinicById = new Map((clinicsState.clinics ?? []).map((clinic) => [clinic.id, clinic]));

  return users
    .map((user) => {
      const profile = profileById.get(user.id) ?? null;
      const membership = chooseMembership(membershipsByUserId.get(user.id) ?? []);
      const clinic = clinicById.get(membership?.clinic_id ?? profile?.clinic_id ?? "") ?? null;

      if (!clinic || !membership) {
        return null;
      }

      const account = {
        account_role: membership.account_role ?? null,
        admin_status: user.app_metadata?.admin_status ?? null,
        app_metadata: user.app_metadata ?? {},
        clinic_id: clinic.id,
        clinic_name: clinic.name ?? null,
        concurrent_access_limit: clinic.concurrent_access_limit ?? null,
        cnpj: clinic.cnpj ?? null,
        confirmed: Boolean(user.email_confirmed_at),
        created_at: user.created_at,
        email: user.email ?? profile?.email ?? "",
        full_name: profile?.full_name ?? "",
        is_active: membership.is_active,
        last_sign_in_at: user.last_sign_in_at ?? null,
        membership_id: membership.id,
        membership_status: membership.membership_status,
        operational_role: membership.operational_role ?? null,
        public_code: profile?.public_code ?? "",
        subaccount_limit: clinic.subaccount_limit ?? null,
        subscription_plan: clinic.subscription_plan ?? null,
        user_id: user.id,
      };

      return {
        ...account,
        admin_status: deriveAdminAccountStatus(account),
        managed_kind: classifyManagedAccount(account),
      };
    })
    .filter(Boolean);
};

const printAccountsTable = (accounts) => {
  console.table(
    sortAccountsForDisplay(accounts).map((account) => ({
      clinic: account.clinic_name ?? "",
      email: account.email,
      kind: account.managed_kind,
      plan: account.subscription_plan ?? "",
      public_code: account.public_code ?? "",
      status: account.admin_status,
      user_id: account.user_id,
    }))
  );
};

const resolveAccount = (accounts, identifier) => {
  const match = accounts.find((account) => matchesAccountIdentifier(account, identifier));

  if (!match) {
    throw new Error(`Conta não encontrada para: ${identifier}`);
  }

  return match;
};

const resolveClinic = async (client, identifier) => {
  const { clinics } = await fetchClinicsWithFallback(client);

  const raw = String(identifier ?? "").trim();
  const digits = sanitizeDigits(raw);

  const clinic = clinics.find((item) => item.id === raw || sanitizeDigits(item.cnpj ?? "") === digits);

  if (!clinic) {
    throw new Error(`Clínica não encontrada para: ${identifier}`);
  }

  return clinic;
};

const requireKind = (account, expectedKind) => {
  if (account.managed_kind !== expectedKind) {
    throw new Error(`Operação inválida para ${account.managed_kind}. Esperado: ${expectedKind}.`);
  }
};

const upsertAdminStatus = async (client, account, status) => {
  const normalizedStatus = normalizeStatusOrThrow(status);

  const { error: authError } = await client.auth.admin.updateUserById(account.user_id, {
    app_metadata: {
      ...(account.app_metadata ?? {}),
      admin_status: normalizedStatus,
    },
  });
  if (authError) throw new Error(authError.message);

  const { error: membershipError } = await client
    .from("clinic_memberships")
    .update({
      is_active: boolFromStatus(normalizedStatus),
      membership_status: toMembershipStatus(normalizedStatus),
    })
    .eq("id", account.membership_id);

  if (membershipError) throw new Error(membershipError.message);
};

const updateManagedEmail = async (client, account, email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    throw new Error("E-mail é obrigatório.");
  }

  const { error: authError } = await client.auth.admin.updateUserById(account.user_id, {
    email: normalizedEmail,
  });
  if (authError) throw new Error(authError.message);

  const { error: profileError } = await client.from("profiles").update({ email: normalizedEmail }).eq("id", account.user_id);
  if (profileError) throw new Error(profileError.message);
};

const updateManagedPassword = async (client, account, password) => {
  if (!password) {
    return;
  }

  const { error } = await client.auth.admin.updateUserById(account.user_id, { password });
  if (error) throw new Error(error.message);
};

const updateManagedCnpj = async (client, account, cnpj) => {
  const normalizedCnpj = normalizeOwnerClinicDocumentOrThrow(cnpj);

  const { error } = await client.from("clinics").update({ cnpj: normalizedCnpj }).eq("id", account.clinic_id);
  if (error) throw new Error(error.message);
};

const updateConcurrentAccessLimit = async (client, account, concurrentAccessLimit) => {
  const normalizedLimit = normalizeConcurrentAccessLimitOrThrow(concurrentAccessLimit);

  const { error } = await client
    .from("clinics")
    .update({ concurrent_access_limit: normalizedLimit })
    .eq("id", account.clinic_id);

  if (!error) {
    return;
  }

  if (!isMissingConcurrentAccessLimitColumnError(error)) {
    throw new Error(error.message);
  }

  if (account.subscription_plan === "clinic") {
    const { error: legacyError } = await client
      .from("clinics")
      .update({ subaccount_limit: normalizedLimit })
      .eq("id", account.clinic_id);

    if (legacyError) {
      throw new Error(legacyError.message);
    }

    console.warn(
      "Aviso: backend remoto ainda sem concurrent_access_limit. O limite foi salvo no campo legado subaccount_limit."
    );
    return;
  }

  throw new Error(
    "O backend remoto ainda nao possui concurrent_access_limit para contas solo. Aplique a migration antes de alterar esse limite."
  );
};

const updateOwnerAccessData = async (client, account, { cnpj, email, password, status }) => {
  await updateOwnerAccess(client, account, {
    cnpj,
    email,
    password,
    status,
  });
};

const updateOwnerConcurrentAccessLimitOnly = async (client, account, { concurrentAccessLimit }) => {
  await updateConcurrentAccessLimit(client, account, concurrentAccessLimit);
};

const createManagedOwnerAccount = async (client, { cnpj, concurrentAccessLimit, email, password, plan, status }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedCnpj = normalizeOwnerClinicDocumentOrThrow(cnpj);
  const normalizedStatus = normalizeStatusOrThrow(status ?? "active");
  const normalizedConcurrentAccessLimit =
    plan === "clinic"
      ? normalizeConcurrentAccessLimitOrThrow(
          concurrentAccessLimit,
          DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN.clinic
        )
      : DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN.solo;

  if (!normalizedEmail || !password) {
    throw new Error("Email e senha são obrigatórios.");
  }

  const { data, error } = await client.auth.admin.createUser({
    app_metadata: {
      admin_status: normalizedStatus,
    },
    email: normalizedEmail,
    email_confirm: true,
    password,
  });
  if (error) throw new Error(error.message);

  const userId = data.user.id;
  const { error: signupError } = await client.rpc("handle_signup", {
    _cnpj: normalizedCnpj,
    _email: normalizedEmail,
    _full_name: null,
    _subscription_plan: plan,
    _user_id: userId,
  });

  if (signupError) {
    await client.auth.admin.deleteUser(userId);
    throw new Error(signupError.message);
  }

  const createdAccount = resolveAccount(await fetchAccounts(client), userId);
  await upsertAdminStatus(client, createdAccount, normalizedStatus);

  if (plan === "clinic") {
    await updateConcurrentAccessLimit(client, createdAccount, normalizedConcurrentAccessLimit);
  }

  return userId;
};

const createSubaccount = async (client, { clinic, email, password, role, status }) => {
  const resolvedClinic = await resolveClinic(client, clinic);
  const normalizedEmail = normalizeEmail(email);
  const normalizedStatus = normalizeStatusOrThrow(status ?? "active");

  if (resolvedClinic.subscription_plan !== "clinic") {
    throw new Error("A clínica selecionada precisa estar no plano clinic para receber subcontas.");
  }

  if (!normalizedEmail || !password) {
    throw new Error("Clínica, e-mail e senha são obrigatórios.");
  }

  const { data, error } = await client.auth.admin.createUser({
    app_metadata: {
      admin_status: normalizedStatus,
    },
    email: normalizedEmail,
    email_confirm: true,
    password,
  });
  if (error) throw new Error(error.message);

  const userId = data.user.id;
  const { error: profileError } = await client.from("profiles").insert({
    clinic_id: resolvedClinic.id,
    email: normalizedEmail,
    full_name: null,
    id: userId,
  });

  if (profileError) {
    await client.auth.admin.deleteUser(userId);
    throw new Error(profileError.message);
  }

  const { error: roleError } = await client.from("user_roles").upsert(
    { role: "user", user_id: userId },
    { onConflict: "user_id,role" }
  );
  if (roleError) {
    await client.auth.admin.deleteUser(userId);
    throw new Error(roleError.message);
  }

  const { error: membershipError } = await client.from("clinic_memberships").insert({
    account_role: null,
    clinic_id: resolvedClinic.id,
    is_active: boolFromStatus(normalizedStatus),
    membership_status: toMembershipStatus(normalizedStatus),
    operational_role: role || "professional",
    user_id: userId,
  });
  if (membershipError) {
    await client.auth.admin.deleteUser(userId);
    throw new Error(membershipError.message);
  }

  return userId;
};

const updateOwnerAccess = async (client, account, { cnpj, concurrentAccessLimit, email, password, status }) => {
  if (cnpj !== undefined) {
    await updateManagedCnpj(client, account, cnpj);
  }
  if (concurrentAccessLimit !== undefined && account.managed_kind === "clinic_owner") {
    await updateConcurrentAccessLimit(client, account, concurrentAccessLimit);
  }
  if (email !== undefined) {
    await updateManagedEmail(client, account, email);
  }
  if (password !== undefined) {
    await updateManagedPassword(client, account, password);
  }
  if (status !== undefined) {
    await upsertAdminStatus(client, account, status);
  }
};

const updateSubaccountAccess = async (client, account, { email, password, status }) => {
  if (email !== undefined) {
    await updateManagedEmail(client, account, email);
  }
  if (password !== undefined) {
    await updateManagedPassword(client, account, password);
  }
  if (status !== undefined) {
    await upsertAdminStatus(client, account, status);
  }
};

const deleteClinicPackage = async (client, clinic) => {
  const clinicAccounts = (await fetchAccounts(client)).filter((account) => account.clinic_id === clinic.id);
  const userIds = clinicAccounts.map((account) => account.user_id);

  const { error: clinicError } = await client.from("clinics").delete().eq("id", clinic.id);
  if (clinicError) throw new Error(clinicError.message);

  for (const userId of userIds) {
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) {
      throw new Error(error.message);
    }
  }
};

const deleteSubaccount = async (client, account) => {
  const { error } = await client.auth.admin.deleteUser(account.user_id);
  if (error) throw new Error(error.message);
};

const fetchPatientsByClinic = async (client, clinicId) => {
  const { data, error } = await client
    .from("patients")
    .select("id, clinic_id, user_id, name, date_of_birth, age, cpf, phone, email, status, created_at, updated_at")
    .eq("clinic_id", clinicId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
};

const printPatientsTable = (patients) => {
  console.table(
    patients.map((patient) => ({
      id: patient.id,
      name: patient.name,
      cpf: patient.cpf ?? "",
      email: patient.email ?? "",
      phone: patient.phone ?? "",
      status: patient.status ?? "",
      updated_at: patient.updated_at,
    }))
  );
};

const normalizePatientIdentifier = (value) => String(value ?? "").trim().toLowerCase();

const matchesPatientIdentifier = (patient, identifier) => {
  const normalizedIdentifier = normalizePatientIdentifier(identifier);

  return (
    normalizePatientIdentifier(patient.id) === normalizedIdentifier ||
    normalizePatientIdentifier(patient.name) === normalizedIdentifier ||
    normalizePatientIdentifier(patient.email) === normalizedIdentifier ||
    sanitizeDigits(patient.cpf ?? "") === sanitizeDigits(identifier)
  );
};

const resolvePatient = (patients, identifier) => {
  const patient = patients.find((item) => matchesPatientIdentifier(item, identifier));

  if (!patient) {
    throw new Error(`Paciente não encontrado para: ${identifier}`);
  }

  return patient;
};

const createPatientForAccount = async (client, account, fields) => {
  const payload = buildPatientCreatePayload(account, fields);

  const { data, error } = await client.from("patients").insert(payload).select("id, name").single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};

const updatePatientForAccount = async (client, account, patientId, fields) => {
  const payload = buildPatientUpdatePayload(fields);

  const { error } = await client.from("patients").update(payload).eq("id", patientId).eq("clinic_id", account.clinic_id);

  if (error) {
    throw new Error(error.message);
  }
};

const deletePatientForAccount = async (client, account, patientId) => {
  const { error: unsetDefaultGroupError } = await client
    .from("patient_groups")
    .update({ is_default: false })
    .eq("patient_id", patientId)
    .eq("clinic_id", account.clinic_id)
    .eq("is_default", true);

  if (unsetDefaultGroupError) {
    throw new Error(unsetDefaultGroupError.message);
  }

  const { error } = await client.from("patients").delete().eq("id", patientId).eq("clinic_id", account.clinic_id);

  if (error) {
    throw new Error(error.message);
  }
};

const ask = async (rl, label, defaultValue = "") => {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = await rl.question(`${label}${suffix}: `);
  return answer.trim() || defaultValue;
};

const askYesNo = async (rl, label, defaultValue = true) => {
  const suffix = defaultValue ? " [Y/n]" : " [y/N]";
  const answer = (await rl.question(`${label}${suffix}: `)).trim().toLowerCase();
  if (!answer) return defaultValue;
  return ["y", "yes", "s", "sim"].includes(answer);
};

const askStatus = async (rl, defaultValue = "active") =>
  normalizeStatusOrThrow(await ask(rl, `Status (${ADMIN_ACCOUNT_STATUSES.join("/")})`, defaultValue));

const refreshSelectedAccount = async (client, account) => resolveAccount(await fetchAccounts(client), account.user_id);

const handleSelectedAccountAccessEdit = async (client, rl, account) => {
  if (account.managed_kind === "solo_owner" || account.managed_kind === "clinic_owner") {
    print("");
    print(`Conta selecionada: ${account.email}`);
    print("1) Alterar dados cadastrais");
    print("2) Alterar limite de acessos simultâneos");
    print("0) Voltar");

    const ownerChoice = await ask(rl, "Escolha");

    if (ownerChoice === "0") {
      return;
    }

    if (ownerChoice === "1") {
      const cnpj = await ask(rl, "CPF ou CNPJ do owner", account.cnpj || "");
      const email = await ask(rl, "Email", account.email || "");
      const password = await ask(rl, "Nova senha (deixe vazio para manter)", "");
      const status = await askStatus(rl, account.admin_status);
      await updateOwnerAccessData(client, account, {
        cnpj,
        email,
        password: password || undefined,
        status,
      });
      print(`Dados cadastrais atualizados: ${account.email}`);
      return;
    }

    if (ownerChoice === "2") {
      const defaultLimit =
        account.managed_kind === "clinic_owner"
          ? String(account.concurrent_access_limit ?? DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN.clinic)
          : String(account.concurrent_access_limit ?? DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN.solo);
      const concurrentAccessLimit = await ask(rl, "Limite de acessos simultâneos", defaultLimit);
      await updateOwnerConcurrentAccessLimitOnly(client, account, { concurrentAccessLimit });
      print(`Limite de acessos simultâneos atualizado: ${account.email}`);
      return;
    }

    print("Opção inválida.");
    return;
  }

  const email = await ask(rl, "Email", account.email || "");
  const password = await ask(rl, "Nova senha (deixe vazio para manter)", "");
  const status = await askStatus(rl, account.admin_status);
  await updateSubaccountAccess(client, account, {
    email,
    password: password || undefined,
    status,
  });
  print(`Acesso atualizado: ${account.email}`);
};

const handleSelectedAccountDelete = async (client, rl, account) => {
  if (account.managed_kind === "solo_owner") {
    const confirmed = await askYesNo(rl, `Excluir o pacote solo de ${account.email}?`, false);
    if (!confirmed) {
      print("Exclusão cancelada.");
      return false;
    }
    await deleteClinicPackage(client, { id: account.clinic_id });
    print(`Pacote solo excluído: ${account.email}`);
    return true;
  }

  if (account.managed_kind === "clinic_owner") {
    const first = await askYesNo(rl, `Excluir a clínica inteira ${account.clinic_name}?`, false);
    if (!first) {
      print("Exclusão cancelada.");
      return false;
    }
    const second = await askYesNo(rl, "Confirma remover clínica, owner e todas as subcontas?", false);
    if (!second) {
      print("Exclusão cancelada.");
      return false;
    }
    await deleteClinicPackage(client, { id: account.clinic_id });
    print(`Clínica excluída: ${account.clinic_name}`);
    return true;
  }

  const confirmed = await askYesNo(rl, `Excluir a subconta ${account.email}?`, false);
  if (!confirmed) {
    print("Exclusão cancelada.");
    return false;
  }
  await deleteSubaccount(client, account);
  print(`Subconta excluída: ${account.email}`);
  return true;
};

const handleSelectedAccountPatientCrud = async (client, rl, account, choice) => {
  if (choice === "4") {
    printPatientsTable(await fetchPatientsByClinic(client, account.clinic_id));
    return;
  }

  if (choice === "5") {
    const name = await ask(rl, "Nome completo do paciente");
    const dateOfBirth = await ask(rl, "Data de nascimento (YYYY-MM-DD)", "");
    const cpf = await ask(rl, "CPF", "");
    const phone = await ask(rl, "Telefone", "");
    const email = await ask(rl, "Email", "");
    const status = await ask(rl, "Status", "ativo");
    const patient = await createPatientForAccount(client, account, {
      name,
      dateOfBirth,
      cpf,
      phone,
      email,
      status,
    });
    print(`Paciente criado: ${patient.name} (${patient.id})`);
    return;
  }

  if (choice === "6") {
    const identifier = await ask(rl, "ID, CPF, email ou nome do paciente");
    const patient = resolvePatient(await fetchPatientsByClinic(client, account.clinic_id), identifier);
    const name = await ask(rl, "Nome completo do paciente", patient.name || "");
    const dateOfBirth = await ask(rl, "Data de nascimento (YYYY-MM-DD)", patient.date_of_birth || "");
    const cpf = await ask(rl, "CPF", patient.cpf || "");
    const phone = await ask(rl, "Telefone", patient.phone || "");
    const email = await ask(rl, "Email", patient.email || "");
    const status = await ask(rl, "Status", patient.status || "ativo");
    await updatePatientForAccount(client, account, patient.id, {
      name,
      dateOfBirth,
      cpf,
      phone,
      email,
      status,
    });
    print(`Paciente atualizado: ${patient.name}`);
    return;
  }

  if (choice === "7") {
    const identifier = await ask(rl, "ID, CPF, email ou nome do paciente");
    const patient = resolvePatient(await fetchPatientsByClinic(client, account.clinic_id), identifier);
    const confirmed = await askYesNo(rl, `Excluir o paciente ${patient.name}?`, false);
    if (!confirmed) {
      print("Exclusão cancelada.");
      return;
    }
    await deletePatientForAccount(client, account, patient.id);
    print(`Paciente excluído: ${patient.name}`);
  }
};

const handleSelectedAccountMenu = async (client, rl, selectedAccount) => {
  let account = selectedAccount;

  while (true) {
    account = await refreshSelectedAccount(client, account);

    print("");
    buildSelectedAccountMenuOptions(account).forEach(print);

    const choice = await ask(rl, "Escolha");

    if (choice === "0") {
      return null;
    }

    if (choice === "1") {
      const email = await ask(rl, "Email");
      const password = await ask(rl, "Senha");
      const status = await askStatus(rl, "active");
      const role = await ask(rl, "Papel (admin/professional/assistant)", "professional");
      const userId = await createSubaccount(client, { clinic: account.clinic_id, email, password, role, status });
      print(`Subconta criada: ${email} (${userId})`);
      continue;
    }

    if (choice === "2") {
      await handleSelectedAccountAccessEdit(client, rl, account);
      continue;
    }

    if (choice === "3") {
      const deleted = await handleSelectedAccountDelete(client, rl, account);
      if (deleted) {
        return "deleted";
      }
      continue;
    }

    if (["4", "5", "6", "7"].includes(choice)) {
      await handleSelectedAccountPatientCrud(client, rl, account, choice);
      continue;
    }

    print("Opção inválida.");
  }
};

const interactiveMenu = async (client) => {
  const rl = createInterface({ input, output });

  try {
    while (true) {
      print("");
      print(`=== ${SUPPORT_PLATFORM} · Account Admin ===`);
      MAIN_MENU_OPTIONS.forEach(print);

      const choice = await ask(rl, "Escolha");
      if (choice === "0") break;

      try {
        if (choice === "1") {
          printAccountsTable(await fetchAccounts(client));
          continue;
        }

        if (choice === "2") {
          const query = await ask(rl, "Buscar por email, clínica, CPF/CNPJ, ID ou código");
          printAccountsTable(filterAccounts(await fetchAccounts(client), { query }));
          continue;
        }

        if (choice === "3") {
          const identifier = await ask(rl, "Email ou user_id da conta");
          const account = resolveAccount(await fetchAccounts(client), identifier);
          print(JSON.stringify(account, null, 2));
          continue;
        }

        if (choice === "4") {
          const cnpj = await ask(rl, "CPF ou CNPJ do owner (11 ou 14 dígitos)");
          const email = await ask(rl, "Email");
          const password = await ask(rl, "Senha");
          const status = await askStatus(rl, "active");
          const userId = await createManagedOwnerAccount(client, { cnpj, email, password, plan: "solo", status });
          print(`Conta solo criada: ${email} (${userId})`);
          continue;
        }

        if (choice === "5") {
          const cnpj = await ask(rl, "CPF ou CNPJ do owner (11 ou 14 dígitos)");
          const email = await ask(rl, "Email");
          const password = await ask(rl, "Senha");
          const status = await askStatus(rl, "active");
          const concurrentAccessLimit = await ask(
            rl,
            "Limite de acessos simultâneos",
            String(DEFAULT_CONCURRENT_ACCESS_LIMIT_BY_PLAN.clinic)
          );
          const userId = await createManagedOwnerAccount(client, {
            cnpj,
            concurrentAccessLimit,
            email,
            password,
            plan: "clinic",
            status,
          });
          print(`Conta clinic criada: ${email} (${userId})`);
          continue;
        }

        if (choice === "6") {
          const identifier = await ask(rl, "Email ou user_id da conta");
          const account = resolveAccount(await fetchAccounts(client), identifier);
          const result = await handleSelectedAccountMenu(client, rl, account);
          if (result === "deleted") {
            print("Conta removida e seleção encerrada.");
          }
          continue;
        }

        print("Opção inválida.");
      } catch (error) {
        print(`Erro: ${error.message}`);
      }
    }
  } finally {
    rl.close();
  }
};

const runListCommand = async (client, options) => {
  const accounts = await fetchAccounts(client);
  const filtered = filterAccounts(accounts, {
    clinic: options.clinic,
    plan: options.plan,
    query: options.query,
    role: options.role,
    status: options.status,
  });

  if (options.json) {
    print(JSON.stringify(sortAccountsForDisplay(filtered), null, 2));
    return;
  }

  printAccountsTable(filtered);
};

const runViewCommand = async (client, options) => {
  const identifier = options.identifier || options.email || options["user-id"];
  if (!identifier) {
    throw new Error("Use --identifier, --email ou --user-id.");
  }

  const account = resolveAccount(await fetchAccounts(client), identifier);
  print(JSON.stringify(account, null, 2));
};

const runCreateSoloCommand = async (client, options) => {
  const userId = await createManagedOwnerAccount(client, {
    cnpj: options.cnpj,
    email: options.email,
    password: options.password,
    plan: "solo",
    status: options.status ?? "active",
  });
  print(`Conta solo criada com sucesso. user_id=${userId}`);
};

const runCreateClinicCommand = async (client, options) => {
  const userId = await createManagedOwnerAccount(client, {
    cnpj: options.cnpj,
    concurrentAccessLimit: options["concurrent-limit"],
    email: options.email,
    password: options.password,
    plan: "clinic",
    status: options.status ?? "active",
  });
  print(`Conta clinic criada com sucesso. user_id=${userId}`);
};

const runCreateSubaccountCommand = async (client, options) => {
  const userId = await createSubaccount(client, {
    clinic: options.clinic,
    email: options.email,
    password: options.password,
    role: options.role,
    status: options.status ?? "active",
  });
  print(`Subconta criada com sucesso. user_id=${userId}`);
};

const runUpdateSoloAccessCommand = async (client, options) => {
  const identifier = options.identifier || options.email || options["user-id"];
  if (!identifier) throw new Error("Use --identifier, --email ou --user-id.");

  const account = resolveAccount(await fetchAccounts(client), identifier);
  requireKind(account, "solo_owner");
  await updateOwnerAccess(client, account, {
    cnpj: options.cnpj,
    email: options["new-email"],
    password: options.password,
    status: options.status,
  });
  print(`Conta solo atualizada: ${identifier}`);
};

const runUpdateClinicOwnerAccessCommand = async (client, options) => {
  const identifier = options.identifier || options.email || options["user-id"];
  if (!identifier) throw new Error("Use --identifier, --email ou --user-id.");

  const account = resolveAccount(await fetchAccounts(client), identifier);
  requireKind(account, "clinic_owner");
  await updateOwnerAccess(client, account, {
    cnpj: options.cnpj,
    concurrentAccessLimit: options["concurrent-limit"],
    email: options["new-email"],
    password: options.password,
    status: options.status,
  });
  print(`Owner clinic atualizado: ${identifier}`);
};

const runUpdateSubaccountStatusCommand = async (client, options) => {
  const identifier = options.identifier || options.email || options["user-id"];
  if (!identifier) throw new Error("Use --identifier, --email ou --user-id.");

  const account = resolveAccount(await fetchAccounts(client), identifier);
  requireKind(account, "clinic_subaccount");
  await updateSubaccountAccess(client, account, {
    email: options["new-email"],
    password: options.password,
    status: options.status,
  });
  print(`Subconta atualizada: ${identifier}`);
};

const runDeleteSoloCommand = async (client, options) => {
  const identifier = options.identifier || options.email || options["user-id"];
  if (!identifier) throw new Error("Use --identifier, --email ou --user-id.");
  if (!options.yes) throw new Error("Use --yes para confirmar a exclusão.");

  const account = resolveAccount(await fetchAccounts(client), identifier);
  requireKind(account, "solo_owner");
  await deleteClinicPackage(client, { id: account.clinic_id });
  print(`Pacote solo excluído: ${account.email}`);
};

const runDeleteClinicCommand = async (client, options) => {
  if (!options.yes || !options["confirm-clinic"]) {
    throw new Error("Use --yes --confirm-clinic para confirmar a exclusão total da clínica.");
  }

  let clinic;
  if (options.clinic) {
    clinic = await resolveClinic(client, options.clinic);
  } else {
    const identifier = options.identifier || options.email || options["user-id"];
    if (!identifier) throw new Error("Use --clinic, --identifier, --email ou --user-id.");
    const account = resolveAccount(await fetchAccounts(client), identifier);
    requireKind(account, "clinic_owner");
    clinic = await resolveClinic(client, account.clinic_id);
  }

  if (clinic.subscription_plan !== "clinic") {
    throw new Error("A clínica selecionada não está no plano clinic.");
  }

  await deleteClinicPackage(client, clinic);
  print(`Clínica excluída: ${clinic.name}`);
};

const runDeleteSubaccountCommand = async (client, options) => {
  const identifier = options.identifier || options.email || options["user-id"];
  if (!identifier) throw new Error("Use --identifier, --email ou --user-id.");
  if (!options.yes) throw new Error("Use --yes para confirmar a exclusão.");

  const account = resolveAccount(await fetchAccounts(client), identifier);
  requireKind(account, "clinic_subaccount");
  await deleteSubaccount(client, account);
  print(`Subconta excluída: ${account.email}`);
};

const printHelp = () => {
  print(`${SUPPORT_PLATFORM} · Account Admin`);
  print("");
  print("Uso:");
  print(`  ${CLI_NAME}`);
  print(`  ${CLI_NAME} init-key`);
  print(`  ${CLI_NAME} list [--query termo] [--plan solo|clinic] [--role owner|admin|professional|assistant] [--status active|payment_pending|temporarily_paused|banned] [--clinic cpf-ou-cnpj|id] [--json]`);
  print(`  ${CLI_NAME} view --identifier email|user_id`);
  print(`  ${CLI_NAME} create-solo --email ... --password ... --cnpj ... [--status active|payment_pending|temporarily_paused|banned]`);
  print(`  ${CLI_NAME} update-solo-access --identifier email|user_id [--cnpj ...] [--new-email ...] [--password ...] [--status ...]`);
  print(`  ${CLI_NAME} delete-solo --identifier email|user_id --yes`);
  print(`  ${CLI_NAME} create-clinic --email ... --password ... --cnpj ... [--concurrent-limit 4] [--status active|payment_pending|temporarily_paused|banned]`);
  print(`  ${CLI_NAME} update-clinic-owner-access --identifier email|user_id [--cnpj ...] [--new-email ...] [--password ...] [--concurrent-limit ...] [--status ...]`);
  print(`  ${CLI_NAME} delete-clinic (--clinic cpf-ou-cnpj|id | --identifier email|user_id) --yes --confirm-clinic`);
  print(`  ${CLI_NAME} create-subaccount --clinic cpf-ou-cnpj|id --email ... --password ... [--role admin|professional|assistant] [--status active|payment_pending|temporarily_paused|banned]`);
  print(`  ${CLI_NAME} update-subaccount-status --identifier email|user_id [--new-email ...] [--password ...] [--status ...]`);
  print(`  ${CLI_NAME} delete-subaccount --identifier email|user_id --yes`);
  print("");
  print("Segurança local:");
  print(`  Chave privada: ${LOCAL_ADMIN_KEY_PATH}`);
  print(`  Chave pública: ${LOCAL_ADMIN_PUBLIC_KEY_PATH}`);
  print(`  Fingerprint: ${LOCAL_ADMIN_FINGERPRINT_PATH}`);
  if (ADMIN_MODE === "prod") {
    print(`  Ambiente remoto: ${PROD_ENV_PATH}`);
  }
};

const main = async () => {
  if (!SUPPORTED_ADMIN_PLATFORMS.has(process.platform)) {
    throw new Error("Este gerenciador local foi pensado para rodar em macOS ou Linux.");
  }

  const { command, options } = parseArgs(process.argv.slice(2));

  if (!command || command === "--help" || command === "help") {
    if (!command) {
      const access = assertTrustedLocalAdminAccess();
      print(`Chave local validada: ${access.fingerprint}`);
      const client = await createAdminClient();
      await interactiveMenu(client);
      return;
    }

    printHelp();
    return;
  }

  if (command === "init-key") {
    const result = initializeLocalAdminKey();
    print(result.created ? "Chave local criada com sucesso." : `A chave local ${MACHINE_LABEL} já estava pronta.`);
    print(`Fingerprint confiável: ${result.fingerprint}`);
    print(`Diretório: ${LOCAL_ADMIN_DIR}`);
    return;
  }

  const access = assertTrustedLocalAdminAccess();
  print(`Chave local validada: ${access.fingerprint}`);

  const client = await createAdminClient();

  switch (command) {
    case "list":
    case "search":
      await runListCommand(client, options);
      break;
    case "view":
      await runViewCommand(client, options);
      break;
    case "create-solo":
      await runCreateSoloCommand(client, options);
      break;
    case "update-solo-access":
      await runUpdateSoloAccessCommand(client, options);
      break;
    case "delete-solo":
      await runDeleteSoloCommand(client, options);
      break;
    case "create-clinic":
      await runCreateClinicCommand(client, options);
      break;
    case "update-clinic-owner-access":
      await runUpdateClinicOwnerAccessCommand(client, options);
      break;
    case "delete-clinic":
      await runDeleteClinicCommand(client, options);
      break;
    case "create-subaccount":
      await runCreateSubaccountCommand(client, options);
      break;
    case "update-subaccount-status":
      await runUpdateSubaccountStatusCommand(client, options);
      break;
    case "delete-subaccount":
      await runDeleteSubaccountCommand(client, options);
      break;
    default:
      printHelp();
      throw new Error(`Comando desconhecido: ${command}`);
  }
};

main().catch((error) => {
  print(error.message);
  process.exitCode = 1;
});
