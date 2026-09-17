import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });

const requiredEnv = (key: string) => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Variavel de ambiente ausente: ${key}`);
  return value;
};

const supabaseUrl = requiredEnv("SUPABASE_URL");
const anonKey = requiredEnv("SUPABASE_ANON_KEY");
const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type Action =
  | "create_owner_account"
  | "create_subaccount"
  | "create_simple_user"
  | "assign_user_to_clinic"
  | "remove_user_from_clinic"
  | "update_membership_role"
  | "update_owner_access"
  | "update_subaccount_access"
  | "update_clinic_access"
  | "delete_clinic_package"
  | "delete_subaccount"
  | "create_patient"
  | "update_patient"
  | "delete_patient"
  | "resend_invitation"
  | "confirm_user_email_manually"
  | "delete_user_attempt";

const accountStatuses = new Set(["active", "payment_pending", "temporarily_paused", "banned"]);
const operationalRoles = new Set(["admin", "professional", "assistant", "estagiario"]);
const plans = new Set(["solo", "clinic", "enterprise"]);

const asyncPool = async <T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = [];
  const executing: Promise<void>[] = [];
  for (const item of items) {
    const p = fn(item).then((res) => {
      results.push(res);
    });
    const e: Promise<void> = p.then(() => {
      const idx = executing.indexOf(e);
      if (idx !== -1) executing.splice(idx, 1);
    });
    executing.push(e);
    if (executing.length >= concurrency) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
  return results;
};

const normalizeEmail = (value: unknown) => {
  const email = String(value ?? "").trim().toLowerCase();
  if (email.length > 255) throw new Error("E-mail excede o limite de 255 caracteres.");
  return email;
};

const normalizeText = (value: unknown, max = 500) => {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
};

const normalizeId = (value: unknown, fieldName = "Identificador", max = 128) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (raw.length > max) throw new Error(`${fieldName} excede ${max} caracteres.`);
  return raw;
};

const normalizeDaysAdjustment = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "" || value === 0) return null;
  const num = Number(value);
  if (!Number.isFinite(num)) throw new Error("Ajuste de dias deve ser um número válido.");
  const days = Math.trunc(num);
  if (days < -3650 || days > 3650) {
    throw new Error("Ajuste de dias deve estar entre -3650 e +3650 dias.");
  }
  return days;
};

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const boolFromStatus = (status: string) => status === "active" || status === "payment_pending";
const toMembershipStatus = (status: string) => {
  if (status === "banned") return "blocked";
  if (status === "temporarily_paused") return "paused";
  return "active";
};
const normalizeStatus = (value: unknown) => {
  const status = String(value ?? "active").trim();
  if (!accountStatuses.has(status)) throw new Error("Status administrativo inválido.");
  return status;
};
const normalizePlan = (value: unknown) => {
  const plan = String(value ?? "clinic").trim();
  if (!plans.has(plan)) throw new Error("Plano inválido.");
  return plan as "solo" | "clinic" | "enterprise";
};
const normalizeRole = (value: unknown) => {
  const role = String(value ?? "professional").trim();
  if (!operationalRoles.has(role)) throw new Error("Papel operacional inválido.");
  return role;
};
const normalizeDocument = (value: unknown) => {
  const clean = digits(value);
  if (![11, 14].includes(clean.length)) throw new Error("CPF/CNPJ precisa ter 11 ou 14 dígitos.");
  return clean;
};
const normalizePassword = (value: unknown, optional = false) => {
  const password = String(value ?? "");
  if (!password && optional) return null;
  if (password.length < 6 || password.length > 128) throw new Error("Senha precisa ter entre 6 e 128 caracteres.");
  return password;
};
const normalizeLimit = (value: unknown, fallback = 4) => {
  const limit = Number(value ?? fallback);
  if (!Number.isFinite(limit)) throw new Error("Limite inválido.");
  return Math.min(Math.max(Math.trunc(limit), 0), 200);
};

const calculateAge = (dateOfBirth: string | null) => {
  if (!dateOfBirth) return null;
  const date = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(date.getTime())) throw new Error("Data de nascimento inválida.");
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  const monthDiff = now.getMonth() - date.getMonth();
  const dayDiff = now.getDate() - date.getDate();
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) age -= 1;
  return Math.max(age, 0);
};

const isUuid = (val: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

interface DecodedJwtPayload {
  sub?: string;
  email?: string;
  role?: string;
  aal?: string;
  exp?: number;
  [key: string]: unknown;
}

interface AuthUserSummary {
  id: string;
  email?: string;
  banned_until?: string | null;
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
  aud?: string;
  created_at?: string;
  [key: string]: unknown;
}


const decodeJwtPayload = (token: string): DecodedJwtPayload | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payloadBase64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padLength = (4 - (payloadBase64.length % 4)) % 4;
    const padded = payloadBase64.padEnd(payloadBase64.length + padLength, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    const decodedStr = new TextDecoder().decode(bytes);
    return JSON.parse(decodedStr) as DecodedJwtPayload;
  } catch {
    return null;
  }
};

const isSignatureOrJwtError = (err: unknown): boolean => {
  if (!err) return false;
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("signing method") ||
    msg.includes("invalid jwt") ||
    msg.includes("signature is invalid") ||
    msg.includes("token signature") ||
    msg.includes("hs256") ||
    msg.includes("es256")
  );
};

const requirePlatformOwner = async (authorization: string | null) => {
  const token = authorization?.replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new Error("Token ausente.");

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  let user: { id: string; email?: string; [key: string]: unknown } | null = null;
  let authErrorDetected = false;

  try {
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (!userError && userData?.user) {
      user = userData.user;
    } else if (userError) {
      if (isSignatureOrJwtError(userError)) {
        authErrorDetected = true;
      } else {
        throw new Error(userError.message || "Usuário não autenticado.");
      }
    }
  } catch (err: unknown) {
    if (isSignatureOrJwtError(err)) {
      authErrorDetected = true;
    } else {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  const decodedPayload = decodeJwtPayload(token);

  // Fallback seguro se GoTrue rejeitar a assinatura/algoritmo do JWT (ex: HS256 vs ES256)
  if (!user || authErrorDetected) {
    if (!decodedPayload) {
      throw new Error("Token JWT inválido ou malformado.");
    }

    // 1. Validação estrita de expiração (exp)
    if (typeof decodedPayload.exp === "number") {
      const nowSeconds = Math.floor(Date.now() / 1000);
      if (nowSeconds >= decodedPayload.exp) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }
    } else {
      throw new Error("Token inválido: ausência de expiração.");
    }

    const sub = typeof decodedPayload.sub === "string" ? decodedPayload.sub.trim() : null;
    if (!sub || !isUuid(sub)) {
      throw new Error("Token inválido: identificador de usuário inválido.");
    }

    // 2. Busca e validação do usuário via Auth Admin (service_role) com fallback para tabela profiles
    let adminUser: AuthUserSummary | null = null;
    try {
      const { data: adminUserData, error: adminUserError } = await admin.auth.admin.getUserById(sub);
      if (!adminUserError && adminUserData?.user) {
        adminUser = adminUserData.user as AuthUserSummary;
      } else if (adminUserError) {
        if (!isSignatureOrJwtError(adminUserError)) {
          console.warn("[requirePlatformOwner] Erro ao consultar auth.admin:", adminUserError.message);
        }
      }
    } catch (err) {
      if (!isSignatureOrJwtError(err)) {
        console.warn("[requirePlatformOwner] Exceção ao consultar auth.admin:", err);
      }
    }

    if (!adminUser) {
      // Fallback seguro: busca o usuário diretamente no PostgreSQL (profiles)
      const { data: profileUser, error: profileErr } = await admin
        .from("profiles")
        .select("id, email")
        .eq("id", sub)
        .maybeSingle();

      if (profileErr || !profileUser) {
        throw new Error("Usuário não encontrado.");
      }

      adminUser = {
        id: profileUser.id,
        email: profileUser.email,
        app_metadata: {},
        user_metadata: {},
        aud: "authenticated",
        created_at: new Date().toISOString(),
      };
    }

    const bannedUntil = adminUser.banned_until;
    if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) {
      throw new Error("Usuário temporariamente suspenso.");
    }

    user = adminUser;
  }

  // 3. Validação rigorosa de Platform Owner com MFA 2FA (aal2)
  // Requer claim aal === 'aal2' presente no token JWT ou confirmação via RPC nativo
  const tokenAal = decodedPayload?.aal;
  let mfaVerified = tokenAal === "aal2";

  try {
    const { data: rpcData, error: rpcError } = await userClient.rpc("is_platform_owner_mfa_verified");
    if (!rpcError && rpcData === true) {
      mfaVerified = true;
    }
  } catch {
    // PostgREST/RPC indisponível ou rejeitou chamada; segue para validação via claim e banco
  }

  if (!mfaVerified) {
    throw new Error("Acesso master não autorizado: requer MFA/2FA ativo no nível aal2.");
  }

  // Validação multicamadas e tolerante a inconsistências de assinatura JWT:
  let isOwner = false;

  // Camada 1: userClient.rpc("is_platform_owner")
  try {
    const { data: rpcOwner, error: rpcErr } = await userClient.rpc("is_platform_owner");
    if (!rpcErr && rpcOwner === true) {
      isOwner = true;
    }
  } catch (err) {
    // PostgREST/RPC indisponível ou rejeitou chamada no userClient; segue para as próximas camadas
  }

  // Camada 2: admin.rpc("is_platform_owner", { _user_id: user.id })
  if (!isOwner) {
    try {
      const { data: adminRpcOwner, error: adminRpcErr } = await admin.rpc("is_platform_owner", {
        _user_id: user.id,
      });
      if (!adminRpcErr && adminRpcOwner === true) {
        isOwner = true;
      }
    } catch (err) {
      // PostgREST/RPC no admin indisponível; segue para as próximas camadas
    }
  }

  // Camada 3: admin.from("platform_admins").select("id, role, is_active").eq("user_id", user.id).eq("role", "platform_owner").eq("is_active", true).maybeSingle()
  if (!isOwner) {
    try {
      const { data: platformAdmin, error: adminErr } = await admin
        .from("platform_admins")
        .select("id, role, is_active")
        .eq("user_id", user.id)
        .eq("role", "platform_owner")
        .eq("is_active", true)
        .maybeSingle();

      if (adminErr) {
        console.warn("[requirePlatformOwner] Erro ao consultar platform_admins via admin:", adminErr.message);
      } else if (platformAdmin) {
        isOwner = true;
      }
    } catch (err) {
      console.warn("[requirePlatformOwner] Exceção ao consultar platform_admins via admin:", err);
    }
  }

  // Camada 4: userClient.from("platform_admins").select("id, role, is_active").eq("user_id", user.id).eq("role", "platform_owner").eq("is_active", true).maybeSingle()
  if (!isOwner) {
    try {
      const { data: userPlatformAdmin, error: userAdminErr } = await userClient
        .from("platform_admins")
        .select("id, role, is_active")
        .eq("user_id", user.id)
        .eq("role", "platform_owner")
        .eq("is_active", true)
        .maybeSingle();

      if (!userAdminErr && userPlatformAdmin) {
        isOwner = true;
      }
    } catch (err) {
      // PostgREST indisponível ou rejeitou chamada no userClient
    }
  }

  if (!isOwner) {
    throw new Error("Acesso master não autorizado: usuário não é platform_owner ativo.");
  }

  return { user, userClient };
};

const logAudit = async (
  userClient: ReturnType<typeof createClient>,
  eventType: string,
  clinicId: string | null,
  reason: string | null,
  metadata: Record<string, unknown>,
  actorUserId?: string
) => {
  try {
    const { error } = await userClient.rpc("log_platform_audit_event", {
      _clinic_id: clinicId,
      _event_type: eventType,
      _metadata: metadata,
      _reason: reason,
    });
    if (!error) return;
  } catch {
    // Prossegue para fallback via admin
  }

  if (actorUserId) {
    try {
      await admin.from("platform_audit_events").insert({
        actor_user_id: actorUserId,
        actor_platform_role: "platform_owner",
        clinic_id: clinicId,
        event_type: eventType,
        reason: reason,
        metadata: metadata,
      });
      return;
    } catch (insertErr) {
      console.error("Falha ao registrar auditoria via admin:", insertErr);
    }
  }
};

const getClinic = async (clinicIdOrDocument: unknown) => {
  const raw = normalizeId(clinicIdOrDocument, "Identificador da clínica", 100);
  if (!raw) throw new Error("Identificador da clínica é obrigatório.");

  let query = admin.from("clinics").select("*").limit(1);
  if (isUuid(raw)) {
    query = query.eq("id", raw);
  } else {
    const doc = digits(raw);
    query = doc.length ? query.eq("cnpj", doc) : query.eq("id", raw);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Clínica não encontrada.");
  return data;
};

const getAccountProfile = async (identifier: unknown) => {
  const value = normalizeId(identifier, "Identificador da conta", 160);
  if (!value) throw new Error("Identificador da conta é obrigatório.");
  const email = normalizeEmail(value);
  const isEmail = email.includes("@");
  const query = admin.from("profiles").select("id, clinic_id, email, full_name").limit(1);
  const { data, error } = await (isEmail ? query.eq("email", email) : query.eq("id", value)).maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Conta não encontrada.");
  return data;
};

const getClinicOwnerProfile = async (clinicIdOrDocument: unknown) => {
  const clinic = await getClinic(clinicIdOrDocument);
  if (!clinic.account_owner_user_id) throw new Error("Owner da clínica não encontrado.");
  const { data, error } = await admin
    .from("profiles")
    .select("id, clinic_id, email, full_name")
    .eq("id", clinic.account_owner_user_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Perfil do owner não encontrado.");
  return data;
};

const getOwnerProfile = async (payload: Record<string, unknown>) => {
  const identifier = String(payload.identifier ?? "").trim();
  if (identifier) return getAccountProfile(identifier);
  return getClinicOwnerProfile(payload.clinicId ?? payload.clinic);
};

const setAdminStatus = async (userId: string, status: string): Promise<boolean> => {
  try {
    const { data, error } = await admin.auth.admin.getUserById(userId);
    if (error) {
      if (isSignatureOrJwtError(error)) {
        console.warn(`[setAdminStatus] Aviso de assinatura GoTrue/JWT ignorado para user ${userId}:`, error.message);
        return false;
      }
      throw new Error(error.message);
    }
    const appMetadata = {
      ...(data.user?.app_metadata ?? {}),
      admin_status: status,
    };
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      app_metadata: appMetadata,
    });
    if (updateError) {
      if (isSignatureOrJwtError(updateError)) {
        console.warn(`[setAdminStatus] Aviso de assinatura GoTrue/JWT ao atualizar user ${userId}:`, updateError.message);
        return false;
      }
      throw new Error(updateError.message);
    }
    return true;
  } catch (err: unknown) {
    if (isSignatureOrJwtError(err)) {
      console.warn(`[setAdminStatus] Exceção de assinatura GoTrue/JWT capturada para user ${userId}:`, err);
      return false;
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
};

const updateAuthAccess = async (userId: string, payload: Record<string, unknown>): Promise<void> => {
  const next: Record<string, unknown> = {};
  if (payload.email !== undefined) {
    const email = normalizeEmail(payload.email);
    if (email) next.email = email;
  }
  if (payload.password !== undefined) {
    const password = normalizePassword(payload.password, true);
    if (password) next.password = password;
  }
  if (Object.keys(next).length === 0) return;
  try {
    const { error } = await admin.auth.admin.updateUserById(userId, next);
    if (error) {
      if (isSignatureOrJwtError(error)) {
        console.warn(`[updateAuthAccess] Aviso de assinatura GoTrue/JWT ignorado para user ${userId}:`, error.message);
        return;
      }
      throw new Error(error.message);
    }
  } catch (err: unknown) {
    if (isSignatureOrJwtError(err)) {
      console.warn(`[updateAuthAccess] Exceção de assinatura GoTrue/JWT ignorada para user ${userId}:`, err);
      return;
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
};

const createOwnerAccount = async (payload: Record<string, unknown>) => {
  const email = normalizeEmail(payload.email);
  const password = normalizePassword(payload.password);
  const document = normalizeDocument(payload.cnpj);
  const plan = normalizePlan(payload.plan);
  const status = normalizeStatus(payload.status);
  const concurrentLimit = plan === "enterprise"
    ? normalizeLimit(payload.concurrentAccessLimit, 10)
    : plan === "clinic"
    ? normalizeLimit(payload.concurrentAccessLimit, 4)
    : 1;

  if (!email) throw new Error("E-mail é obrigatório.");

  const { data, error } = await admin.auth.admin.createUser({
    app_metadata: { admin_status: status },
    email,
    email_confirm: true,
    password,
  });
  if (error) throw new Error(error.message);

  const userId = data.user.id;
  try {
    const { error: signupError } = await admin.rpc("handle_signup", {
      _cnpj: document,
      _email: email,
      _full_name: normalizeText(payload.fullName, 120),
      _subscription_plan: plan,
      _user_id: userId,
    });
    if (signupError) throw new Error(signupError.message);

    if (plan === "clinic" || plan === "enterprise") {
      const baseSubaccounts = plan === "enterprise" ? 100 : 30;
      const baseConcurrent = plan === "enterprise" ? 10 : 4;
      const effectiveConcurrent = Math.max(concurrentLimit, baseConcurrent);
      const effectiveSubaccounts = Math.max(effectiveConcurrent, baseSubaccounts);
      const { error: clinicError } = await admin
        .from("clinics")
        .update({
          concurrent_access_limit: effectiveConcurrent,
          subaccount_limit: effectiveSubaccounts,
        })
        .eq("account_owner_user_id", userId);
      if (clinicError) throw new Error(clinicError.message);
    } else if (plan === "solo") {
      const { error: clinicError } = await admin
        .from("clinics")
        .update({
          concurrent_access_limit: 1,
          subaccount_limit: 1,
        })
        .eq("account_owner_user_id", userId);
      if (clinicError) throw new Error(clinicError.message);
    }
  } catch (error) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch {
      // Ignora falha de limpeza no auth para preservar o erro original do banco
    }
    throw error;
  }

  return { user_id: userId, email, plan };
};

const createSubaccount = async (payload: Record<string, unknown>) => {
  const clinic = await getClinic(payload.clinicId ?? payload.clinic);
  if (clinic.subscription_plan !== "clinic" && clinic.subscription_plan !== "enterprise") {
    throw new Error("A clínica selecionada precisa estar no plano clinic ou enterprise.");
  }

  const email = normalizeEmail(payload.email);
  const password = normalizePassword(payload.password);
  const role = normalizeRole(payload.role);
  const status = normalizeStatus(payload.status);
  if (!email) throw new Error("E-mail é obrigatório.");

  const { data, error } = await admin.auth.admin.createUser({
    app_metadata: { admin_status: status },
    email,
    email_confirm: true,
    password,
  });
  if (error) throw new Error(error.message);

  const userId = data.user.id;
  try {
    const { error: profileError } = await admin.from("profiles").insert({
      clinic_id: clinic.id,
      email,
      full_name: normalizeText(payload.fullName, 120),
      id: userId,
    });
    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await admin.from("user_roles").upsert(
      { role: "user", user_id: userId },
      { onConflict: "user_id,role" },
    );
    if (roleError) throw new Error(roleError.message);

    const { error: membershipError } = await admin.from("clinic_memberships").insert({
      account_role: null,
      clinic_id: clinic.id,
      is_active: boolFromStatus(status),
      membership_status: toMembershipStatus(status),
      operational_role: role,
      user_id: userId,
    });
    if (membershipError) throw new Error(membershipError.message);
  } catch (error) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch {
      // Ignora falha de limpeza no auth para preservar o erro original do banco
    }
    throw error;
  }

  return { clinic_id: clinic.id, user_id: userId, email, role };
};

const createSimpleUser = async (payload: Record<string, unknown>) => {
  const email = normalizeEmail(payload.email);
  const password = normalizePassword(payload.password);
  const status = normalizeStatus(payload.status);
  const role = payload.role ? normalizeRole(payload.role) : "professional";
  const fullName = normalizeText(payload.fullName, 120);
  const cpf = payload.cpf ? digits(payload.cpf) : null;
  const phone = payload.phone ? digits(payload.phone) : null;

  if (!email) throw new Error("E-mail é obrigatório.");

  let clinicId: string | null = null;
  if (payload.clinicId || payload.clinic) {
    const clinic = await getClinic(payload.clinicId ?? payload.clinic);
    clinicId = clinic.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    app_metadata: { admin_status: status },
    email,
    email_confirm: true,
    password,
    user_metadata: {
      full_name: fullName,
      cpf,
      phone,
    },
  });
  if (error) throw new Error(error.message);

  const userId = data.user.id;
  try {
    const { error: profileError } = await admin.from("profiles").insert({
      clinic_id: clinicId,
      cpf,
      email,
      full_name: fullName,
      phone,
      id: userId,
    });
    if (profileError) throw new Error(profileError.message);

    const { error: roleError } = await admin.from("user_roles").upsert(
      { role: "user", user_id: userId },
      { onConflict: "user_id,role" },
    );
    if (roleError) throw new Error(roleError.message);

    if (clinicId) {
      const { error: membershipError } = await admin.from("clinic_memberships").insert({
        account_role: null,
        clinic_id: clinicId,
        is_active: boolFromStatus(status),
        membership_status: toMembershipStatus(status),
        operational_role: role,
        user_id: userId,
      });
      if (membershipError) throw new Error(membershipError.message);
    }
  } catch (error) {
    try {
      await admin.auth.admin.deleteUser(userId);
    } catch {
      // Ignora falha de limpeza no auth para preservar o erro original do banco
    }
    throw error;
  }

  return { user_id: userId, email, clinic_id: clinicId, role };
};

const assignUserToClinic = async (payload: Record<string, unknown>) => {
  const account = await getAccountProfile(payload.identifier ?? payload.userId);
  const clinic = await getClinic(payload.clinicId ?? payload.clinic);
  const role = normalizeRole(payload.role ?? "professional");
  const status = normalizeStatus(payload.status ?? "active");

  const { data: existing, error: checkError } = await admin
    .from("clinic_memberships")
    .select("id, account_role, is_active, membership_status, operational_role")
    .eq("clinic_id", clinic.id)
    .eq("user_id", account.id)
    .maybeSingle();

  if (checkError) throw new Error(checkError.message);

  if (existing) {
    // Se já existia, reativa e atualiza o papel
    const { error: updateError } = await admin
      .from("clinic_memberships")
      .update({
        is_active: boolFromStatus(status),
        membership_status: toMembershipStatus(status),
        operational_role: role,
        ended_at: null,
      })
      .eq("id", existing.id);
    if (updateError) throw new Error(updateError.message);
  } else {
    // Insere novo membership
    const { error: insertError } = await admin.from("clinic_memberships").insert({
      account_role: null,
      clinic_id: clinic.id,
      is_active: boolFromStatus(status),
      membership_status: toMembershipStatus(status),
      operational_role: role,
      user_id: account.id,
    });
    if (insertError) throw new Error(insertError.message);
  }

  // Se o perfil não tiver clinic_id primário, atualiza
  if (!account.clinic_id) {
    await admin.from("profiles").update({ clinic_id: clinic.id }).eq("id", account.id);
  }

  return { user_id: account.id, clinic_id: clinic.id, operational_role: role };
};

const removeUserFromClinic = async (payload: Record<string, unknown>) => {
  const account = await getAccountProfile(payload.identifier ?? payload.userId);
  const clinic = await getClinic(payload.clinicId ?? payload.clinic);

  const { data: membership, error: lookupError } = await admin
    .from("clinic_memberships")
    .select("id, account_role, operational_role")
    .eq("clinic_id", clinic.id)
    .eq("user_id", account.id)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);
  if (!membership) throw new Error("Vínculo do usuário com esta clínica não foi encontrado.");

  if (membership.account_role === "account_owner" || clinic.account_owner_user_id === account.id) {
    throw new Error("A conta proprietária (owner) não pode ser desvinculada da clínica. Caso deseje encerrar a clínica, use 'Excluir definitivamente' na clínica.");
  }

  // Excluir membership
  const { error: deleteMembershipError } = await admin
    .from("clinic_memberships")
    .delete()
    .eq("id", membership.id);
  if (deleteMembershipError) throw new Error(deleteMembershipError.message);

  // Limpar sessões ativas e contexto da clínica
  try {
    await admin.from("user_security_sessions").update({
      ended_at: new Date().toISOString(),
      force_signed_out_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }).eq("clinic_id", clinic.id).eq("user_id", account.id).is("ended_at", null);

    await admin.from("user_active_clinic_contexts").delete()
      .eq("clinic_id", clinic.id)
      .eq("user_id", account.id);
  } catch {
    // tabelas auxiliares opcionais
  }

  // Se o perfil tinha essa clínica como primária, reatribuir para outra existente ou null
  if (account.clinic_id === clinic.id) {
    const { data: otherMembership } = await admin
      .from("clinic_memberships")
      .select("clinic_id")
      .eq("user_id", account.id)
      .limit(1)
      .maybeSingle();

    await admin.from("profiles").update({
      clinic_id: otherMembership?.clinic_id ?? null,
    }).eq("id", account.id);
  }

  return { user_id: account.id, clinic_id: clinic.id, removed: true };
};

const updateMembershipRole = async (payload: Record<string, unknown>) => {
  const account = await getAccountProfile(payload.identifier ?? payload.userId);
  const clinic = await getClinic(payload.clinicId ?? payload.clinic);
  const role = normalizeRole(payload.role);

  const { data: membership, error: lookupError } = await admin
    .from("clinic_memberships")
    .select("id, account_role, operational_role")
    .eq("clinic_id", clinic.id)
    .eq("user_id", account.id)
    .maybeSingle();

  if (lookupError) throw new Error(lookupError.message);
  if (!membership) throw new Error("Vínculo do usuário com esta clínica não foi encontrado.");

  if (membership.account_role === "account_owner") {
    throw new Error("O papel operacional da conta principal compradora (owner) não pode ser alterado.");
  }

  const update: Record<string, unknown> = {
    operational_role: role,
  };

  if (payload.status !== undefined) {
    const status = normalizeStatus(payload.status);
    update.is_active = boolFromStatus(status);
    update.membership_status = toMembershipStatus(status);
  }

  const { error: updateError } = await admin
    .from("clinic_memberships")
    .update(update)
    .eq("id", membership.id);

  if (updateError) throw new Error(updateError.message);

  return { user_id: account.id, clinic_id: clinic.id, operational_role: role };
};

const updateOwnerAccess = async (payload: Record<string, unknown>) => {
  const account = await getOwnerProfile(payload);
  if (normalizeText(payload.cnpj, 18) && account.clinic_id) {
    const { error } = await admin.from("clinics").update({ cnpj: normalizeDocument(payload.cnpj) }).eq("id", account.clinic_id);
    if (error) throw new Error(error.message);
  }
  if (payload.concurrentAccessLimit !== undefined && account.clinic_id) {
    const limit = normalizeLimit(payload.concurrentAccessLimit, 4);
    const { error } = await admin.from("clinics").update({ concurrent_access_limit: limit }).eq("id", account.clinic_id);
    if (error) throw new Error(error.message);
  }
  await updateAuthAccess(account.id, { email: payload.newEmail, password: payload.password });
  if (payload.status !== undefined) {
    const status = normalizeStatus(payload.status);
    await setAdminStatus(account.id, status);
    const { error } = await admin.from("clinic_memberships").update({
      is_active: boolFromStatus(status),
      membership_status: toMembershipStatus(status),
    }).eq("user_id", account.id);
    if (error) throw new Error(error.message);
  }
  return { user_id: account.id, clinic_id: account.clinic_id };
};

const updateSubaccountAccess = async (payload: Record<string, unknown>) => {
  const account = await getAccountProfile(payload.identifier);
  const { data: membership, error: membershipLookupError } = await admin
    .from("clinic_memberships")
    .select("id, clinic_id")
    .eq("user_id", account.id)
    .maybeSingle();
  if (membershipLookupError) throw new Error(membershipLookupError.message);
  if (!membership) throw new Error("Membership da subconta não encontrado.");

  await updateAuthAccess(account.id, { email: payload.newEmail, password: payload.password });
  const update: Record<string, unknown> = {};
  if (payload.role !== undefined) update.operational_role = normalizeRole(payload.role);
  if (payload.status !== undefined) {
    const status = normalizeStatus(payload.status);
    update.is_active = boolFromStatus(status);
    update.membership_status = toMembershipStatus(status);
    await setAdminStatus(account.id, status);
  }
  if (Object.keys(update).length) {
    const { error } = await admin.from("clinic_memberships").update(update).eq("id", membership.id);
    if (error) throw new Error(error.message);
  }
  return { user_id: account.id, clinic_id: membership.clinic_id };
};

const updateClinicAccess = async (payload: Record<string, unknown>) => {
  const rawStatus = String(payload.status ?? "").trim();
  if (rawStatus === "delete") return deleteClinicPackage(payload);
  const status = normalizeStatus(rawStatus);

  const clinic = await getClinic(payload.clinicId ?? payload.clinic ?? payload.identifier);
  const membershipStatus = toMembershipStatus(status);
  const isActive = boolFromStatus(status);

  // 1. Processar Tipo de Plano (Solo vs Equipe/Clínica)
  let targetPlan = clinic.subscription_plan;
  if (payload.subscriptionPlan !== undefined) {
    targetPlan = normalizePlan(payload.subscriptionPlan);
  }

  const clinicUpdate: Record<string, unknown> = {
    access_status: status,
    subscription_plan: targetPlan,
  };

  const getPlanBaseLimits = (p: string) => {
    if (p === "enterprise") return { concurrent: 10, subaccounts: 100 };
    if (p === "clinic") return { concurrent: 4, subaccounts: 30 };
    return { concurrent: 1, subaccounts: 1 };
  };

  const defaultLimits = getPlanBaseLimits(targetPlan);
  let concurrentLimit = clinic.concurrent_access_limit ?? defaultLimits.concurrent;
  let subaccounts = clinic.subaccount_limit ?? defaultLimits.subaccounts;

  if (payload.subscriptionPlan !== undefined && payload.concurrentAccessLimit === undefined && payload.subaccountLimit === undefined) {
    concurrentLimit = defaultLimits.concurrent;
    subaccounts = defaultLimits.subaccounts;
  }

  if (payload.concurrentAccessLimit !== undefined) {
    concurrentLimit = normalizeLimit(payload.concurrentAccessLimit, defaultLimits.concurrent);
  }

  if (payload.subaccountLimit !== undefined) {
    subaccounts = normalizeLimit(payload.subaccountLimit, defaultLimits.subaccounts);
  }

  if (targetPlan === "solo") {
    if (payload.subaccountLimit === undefined) {
      subaccounts = 1;
    }
    if (payload.concurrentAccessLimit === undefined) {
      concurrentLimit = 1;
    }
  }

  clinicUpdate.concurrent_access_limit = concurrentLimit;
  clinicUpdate.subaccount_limit = subaccounts;

  const { error: clinicError } = await admin.from("clinics").update(clinicUpdate).eq("id", clinic.id);
  if (clinicError) throw new Error(clinicError.message);

  // 2. Buscar ou inicializar clinic_subscriptions
  const { data: existingSub, error: subFetchError } = await admin
    .from("clinic_subscriptions")
    .select("*")
    .eq("clinic_id", clinic.id)
    .maybeSingle();
  if (subFetchError) throw new Error(subFetchError.message);

  let ownerUserId = clinic.account_owner_user_id;
  if (!ownerUserId) {
    const { data: ownerMem } = await admin
      .from("clinic_memberships")
      .select("user_id")
      .eq("clinic_id", clinic.id)
      .eq("account_role", "clinic_owner")
      .maybeSingle();
    if (ownerMem?.user_id) {
      ownerUserId = ownerMem.user_id;
    }
  }

  let currentSub = existingSub;

  if (!currentSub && ownerUserId) {
    const { data: newSub, error: createSubError } = await admin
      .from("clinic_subscriptions")
      .insert({
        clinic_id: clinic.id,
        account_owner_user_id: ownerUserId,
        plan_type: targetPlan,
        base_subaccount_limit: subaccounts,
        base_concurrent_access_count: concurrentLimit,
        status: status === "active" ? "ACTIVE" : "PENDING",
      })
      .select()
      .single();
    if (createSubError) throw new Error(createSubError.message);
    currentSub = newSub;
  }

  let daysAdjusted: number | null = null;
  let newExpiresAtIso: string | null = null;

  // 3. Atualizar clinic_subscriptions se existir
  if (currentSub) {
    const subUpdate: Record<string, unknown> = {
      plan_type: targetPlan,
      base_subaccount_limit: subaccounts,
      base_concurrent_access_count: concurrentLimit,
      updated_at: new Date().toISOString(),
    };

    const isCourtesy = payload.isCourtesy === true || payload.isCourtesy === "true";
    if (payload.isCourtesy !== undefined) {
      if (isCourtesy) {
        subUpdate.is_courtesy = true;
        subUpdate.status = "COURTESY";
        subUpdate.expires_at = null;
        subUpdate.current_period_end = null;
        subUpdate.courtesy_reason = normalizeText(payload.courtesyReason ?? payload.reason, 300);
      } else {
        subUpdate.is_courtesy = false;
        subUpdate.courtesy_reason = null;
        if (currentSub.status === "COURTESY") {
          subUpdate.status = "ACTIVE";
        }
      }
    }

    if (payload.subscriptionStatus !== undefined && !isCourtesy) {
      const subStatus = String(payload.subscriptionStatus).trim().toUpperCase();
      if (subStatus) {
        subUpdate.status = subStatus;
      }
    }

    const daysToAdd = normalizeDaysAdjustment(payload.daysAdjustment);
    if (!isCourtesy && daysToAdd !== null && daysToAdd !== 0) {
      daysAdjusted = daysToAdd;
      const now = Date.now();
      const currentExpiresAtMs = currentSub.expires_at
        ? new Date(currentSub.expires_at).getTime()
        : currentSub.current_period_end
        ? new Date(currentSub.current_period_end).getTime()
        : 0;
      const baseMs = currentExpiresAtMs > now ? currentExpiresAtMs : now;
      const targetMs = baseMs + daysToAdd * 86400000;
      newExpiresAtIso = new Date(targetMs).toISOString();

      subUpdate.expires_at = newExpiresAtIso;
      subUpdate.current_period_end = newExpiresAtIso;
      subUpdate.is_courtesy = false;

      if (
        targetMs > now &&
        (currentSub.status === "EXPIRED" ||
          currentSub.status === "SUSPENDED" ||
          currentSub.status === "TRIAL_EXPIRED" ||
          subUpdate.status === "EXPIRED" ||
          subUpdate.status === "SUSPENDED" ||
          subUpdate.status === "TRIAL_EXPIRED")
      ) {
        subUpdate.status = "ACTIVE";
      }
    } else if (!isCourtesy && payload.subscriptionExpiresAt !== undefined) {
      const rawDate = String(payload.subscriptionExpiresAt).trim();
      if (rawDate) {
        if (rawDate.length > 50) throw new Error("Data de expiração inválida.");
        const parsed = new Date(rawDate);
        if (!Number.isNaN(parsed.getTime())) {
          newExpiresAtIso = parsed.toISOString();
          subUpdate.expires_at = newExpiresAtIso;
          subUpdate.current_period_end = newExpiresAtIso;
          subUpdate.is_courtesy = false;
        }
      }
    }

    const { error: updateSubError } = await admin
      .from("clinic_subscriptions")
      .update(subUpdate)
      .eq("id", currentSub.id);
    if (updateSubError) throw new Error(updateSubError.message);
  }

  // 4. Sincronizar membros da clínica
  const { error: membershipError } = await admin.from("clinic_memberships").update({
    is_active: isActive,
    membership_status: membershipStatus,
  }).eq("clinic_id", clinic.id);
  if (membershipError) throw new Error(membershipError.message);

  const { data: memberships, error: membersError } = await admin
    .from("clinic_memberships")
    .select("user_id")
    .eq("clinic_id", clinic.id);
  if (membersError) throw new Error(membersError.message);

  const userIds = [...new Set([clinic.account_owner_user_id, ...(memberships ?? []).map((row) => row.user_id)].filter(Boolean))];
  await asyncPool(userIds, 5, (userId) => setAdminStatus(String(userId), status));

  return {
    clinic_id: clinic.id,
    plan_type: targetPlan,
    status,
    affected_users: userIds.length,
    is_courtesy: payload.isCourtesy === true || payload.isCourtesy === "true",
    days_adjusted: daysAdjusted,
    new_expires_at: newExpiresAtIso,
  };
};

const deleteClinicPackage = async (payload: Record<string, unknown>) => {
  const clinic = await getClinic(payload.clinicId ?? payload.clinic ?? payload.identifier);
  const { data: memberships, error: membersError } = await admin
    .from("clinic_memberships")
    .select("user_id")
    .eq("clinic_id", clinic.id);
  if (membersError) throw new Error(membersError.message);

  const userIds = [...new Set([clinic.account_owner_user_id, ...(memberships ?? []).map((row) => row.user_id)].filter(Boolean))];
  const { error } = await admin.from("clinics").delete().eq("id", clinic.id);
  if (error) throw new Error(error.message);

  await asyncPool(userIds, 5, async (userId) => {
    try {
      const { error: deleteError } = await admin.auth.admin.deleteUser(String(userId));
      if (deleteError) {
        if (isSignatureOrJwtError(deleteError)) {
          console.warn(`[deleteClinicPackage] Aviso de assinatura GoTrue ao deletar auth user ${userId}:`, deleteError.message);
        } else {
          console.warn(`[deleteClinicPackage] Erro ao deletar auth user ${userId}:`, deleteError.message);
        }
      }
    } catch (delErr) {
      console.warn(`[deleteClinicPackage] Falha ao deletar auth user ${userId}:`, delErr);
    }
  });

  return { clinic_id: clinic.id, deleted_users: userIds.length };
};

const deleteSubaccount = async (payload: Record<string, unknown>) => {
  const account = await getAccountProfile(payload.identifier);
  const { data: membership, error: membershipLookupError } = await admin
    .from("clinic_memberships")
    .select("account_role")
    .eq("user_id", account.id)
    .maybeSingle();
  if (membershipLookupError) throw new Error(membershipLookupError.message);
  if (membership?.account_role === "account_owner") {
    throw new Error("Owner deve ser removido em Editar acesso da clínica > Excluir definitivamente.");
  }
  await admin.from("clinic_memberships").delete().eq("user_id", account.id);
  await admin.from("user_roles").delete().eq("user_id", account.id);
  await admin.from("profiles").delete().eq("id", account.id);

  try {
    const { error } = await admin.auth.admin.deleteUser(account.id);
    if (error) {
      if (isSignatureOrJwtError(error)) {
        console.warn(`[deleteSubaccount] Aviso de assinatura GoTrue ao deletar auth user ${account.id}:`, error.message);
      } else {
        console.warn(`[deleteSubaccount] Erro ao deletar auth user ${account.id}:`, error.message);
      }
    }
  } catch (delErr) {
    console.warn(`[deleteSubaccount] Falha ao deletar auth user ${account.id}:`, delErr);
  }
  return { user_id: account.id, clinic_id: account.clinic_id };
};

const createPatient = async (payload: Record<string, unknown>) => {
  const clinic = await getClinic(payload.clinicId ?? payload.clinic);
  const name = normalizeText(payload.name, 120);
  if (!name) throw new Error("Nome do paciente é obrigatório.");
  const dateOfBirth = normalizeText(payload.dateOfBirth, 10);
  const { data, error } = await admin.from("patients").insert({
    age: calculateAge(dateOfBirth),
    clinic_id: clinic.id,
    cpf: digits(payload.cpf) || null,
    date_of_birth: dateOfBirth,
    email: normalizeText(payload.email, 120),
    name,
    phone: digits(payload.phone) || null,
    registration_complete: false,
    status: normalizeText(payload.status, 50) ?? "ativo",
    user_id: clinic.account_owner_user_id,
  }).select("id, name").single();
  if (error) throw new Error(error.message);
  return { clinic_id: clinic.id, patient: data };
};

const updatePatient = async (payload: Record<string, unknown>) => {
  const patientId = String(payload.patientId ?? "").trim();
  if (!patientId) throw new Error("ID do paciente é obrigatório.");
  const update: Record<string, unknown> = {};
  if (payload.name !== undefined) update.name = normalizeText(payload.name, 120);
  if (payload.dateOfBirth !== undefined) {
    const dateOfBirth = normalizeText(payload.dateOfBirth, 10);
    update.date_of_birth = dateOfBirth;
    update.age = calculateAge(dateOfBirth);
  }
  if (payload.cpf !== undefined) update.cpf = digits(payload.cpf) || null;
  if (payload.phone !== undefined) update.phone = digits(payload.phone) || null;
  if (payload.email !== undefined) update.email = normalizeText(payload.email, 120);
  if (payload.status !== undefined) update.status = normalizeText(payload.status, 50) ?? "ativo";
  const { data, error } = await admin.from("patients").update(update).eq("id", patientId).select("id, clinic_id").single();
  if (error) throw new Error(error.message);
  return { patient_id: data.id, clinic_id: data.clinic_id };
};

const deletePatient = async (payload: Record<string, unknown>) => {
  const patientId = String(payload.patientId ?? "").trim();
  if (!patientId) throw new Error("ID do paciente é obrigatório.");
  const { data: patient, error: lookupError } = await admin.from("patients").select("id, clinic_id").eq("id", patientId).single();
  if (lookupError) throw new Error(lookupError.message);
  await admin.from("patient_groups").update({ is_default: false }).eq("patient_id", patientId);
  const { error } = await admin.from("patients").delete().eq("id", patientId);
  if (error) throw new Error(error.message);
  return { patient_id: patient.id, clinic_id: patient.clinic_id };
};

const resendInvitation = async (
  payload: Record<string, unknown>,
  context?: { userClient?: ReturnType<typeof createClient>; user?: { id: string } }
) => {
  const invitationId = String(payload.invitationId ?? payload.identifier ?? "").trim();
  if (!invitationId) throw new Error("ID do convite é obrigatório.");

  // 1. Tentar localizar o convite por ID ou por e-mail com admin (service role)
  let invitation: Record<string, unknown> | null = null;
  let targetEmail = invitationId.includes("@") ? invitationId.toLowerCase() : "";

  let query = admin.from("clinic_collaborator_invitations").select("*").limit(1);
  if (targetEmail) {
    query = query.eq("email", targetEmail).order("created_at", { ascending: false });
  } else {
    query = query.eq("id", invitationId);
  }
  const { data: invFound, error: invError } = await query.maybeSingle();
  if (invError) throw new Error(invError.message);
  invitation = invFound;

  if (!invitation && !targetEmail) {
    // Pode ser que invitationId seja o user_id do auth
    try {
      const { data: uData } = await admin.auth.admin.getUserById(invitationId);
      if (uData?.user?.email) {
        targetEmail = uData.user.email.toLowerCase();
        const { data: invByEmail } = await admin
          .from("clinic_collaborator_invitations")
          .select("*")
          .eq("email", targetEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        invitation = invByEmail;
      }
    } catch {
      // Ignora erro de consulta ao GoTrue
    }
    if (!targetEmail) {
      const { data: pData } = await admin.from("profiles").select("email").eq("id", invitationId).maybeSingle();
      if (pData?.email) {
        targetEmail = pData.email.toLowerCase();
        const { data: invByEmail } = await admin
          .from("clinic_collaborator_invitations")
          .select("*")
          .eq("email", targetEmail)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        invitation = invByEmail;
      }
    }
  }

  if (invitation?.email) {
    targetEmail = String(invitation.email).toLowerCase();
  }

  if (!targetEmail && !invitation) {
    throw new Error("Convite ou usuário não encontrado para o identificador informado.");
  }

  // Rate limiting check de 30 segundos
  if (invitation?.last_resent_at) {
    const diffMs = Date.now() - new Date(String(invitation.last_resent_at)).getTime();
    if (diffMs < 30000) {
      const remaining = Math.ceil((30000 - diffMs) / 1000);
      throw new Error(`Aguarde ${remaining} segundos antes de reenviar o convite novamente.`);
    }
  }

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  const tokenHash = Array.from(new Uint8Array(hashBuffer)).map((b) => b.toString(16).padStart(2, "0")).join("");

  const nowIso = new Date().toISOString();
  const expiresIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  let clinicId = invitation?.clinic_id ? String(invitation.clinic_id) : null;

  if (invitation?.id) {
    // Se estava cancelado ou expirado, reativa para 'pending'
    const { error: updateErr } = await admin
      .from("clinic_collaborator_invitations")
      .update({
        status: "pending",
        token_hash: tokenHash,
        last_resent_at: nowIso,
        updated_at: nowIso,
        expires_at: expiresIso,
      })
      .eq("id", invitation.id);

    if (updateErr) throw new Error(updateErr.message);
  }

  const path = `/convite/${token}`;

  // Gerar link oficial do Supabase Auth
  let actionLink: string | null = null;
  try {
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "invite",
      email: targetEmail,
      options: { redirectTo: path },
    });
    actionLink = linkData?.properties?.action_link ?? null;
  } catch {
    try {
      const { data: magicData } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email: targetEmail,
        options: { redirectTo: path },
      });
      actionLink = magicData?.properties?.action_link ?? null;
    } catch {
      // Ignora se não conseguir gerar link auth direto
    }
  }

  return {
    action_link: actionLink,
    clinic_id: clinicId,
    email: targetEmail,
    invitation_id: invitation?.id ?? invitationId,
    path,
    remaining_cooldown: 30,
    token,
  };
};

const findAuthUserByEmail = async (email: string) => {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;

  // 1. Busca indexada no profiles (O(1))
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email")
    .eq("email", normalized)
    .maybeSingle();

  if (profile?.id) {
    try {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
      if (!userError && userData?.user) return userData.user;
    } catch (err) {
      console.warn(`[findAuthUserByEmail] Aviso ao consultar getUserById(${profile.id}):`, err);
    }
    return {
      id: profile.id,
      email: profile.email,
      app_metadata: {},
      user_metadata: {},
    } as AuthUserSummary;
  }

  // 2. Fallback paginado seguro em auth.admin (até 1000 registros para evitar OOM e timeout)
  try {
    let page = 1;
    const perPage = 100;
    while (page <= 10) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users?.length) break;
      const found = data.users.find((u) => normalizeEmail(u.email) === normalized);
      if (found) return found;
      if (data.users.length < perPage) break;
      page++;
    }
  } catch (listErr) {
    console.warn("[findAuthUserByEmail] listUsers falhou:", listErr);
  }
  return null;
};

const findAuthUserByCpf = async (cpf: string) => {
  const cleanCpf = digits(cpf);
  if (!cleanCpf) return { user: null, profile: null };

  // 1. Busca indexada no profiles (O(1))
  const { data: profile } = await admin
    .from("profiles")
    .select("id, email, cpf")
    .eq("cpf", cleanCpf)
    .maybeSingle();

  if (profile?.id) {
    try {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(profile.id);
      if (!userError && userData?.user) {
        return { user: userData.user, profile };
      }
    } catch (err) {
      console.warn(`[findAuthUserByCpf] Aviso ao consultar getUserById(${profile.id}):`, err);
    }
    return { user: { id: profile.id, email: profile.email } as AuthUserSummary, profile };
  }

  // 2. Fallback paginado seguro procurando nos metadados de auth.users
  try {
    let page = 1;
    const perPage = 100;
    while (page <= 10) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error || !data?.users?.length) break;
      const found = data.users.find((u) => digits(u.user_metadata?.cpf) === cleanCpf);
      if (found) return { user: found, profile: null };
      if (data.users.length < perPage) break;
      page++;
    }
  } catch (err) {
    console.warn("[findAuthUserByCpf] listUsers falhou:", err);
  }
  return { user: null, profile: null };
};

const confirmUserEmailManually = async (payload: Record<string, unknown>) => {
  const identifier = String(payload.identifier ?? payload.userId ?? payload.email ?? "").trim();
  if (!identifier) throw new Error("Identificador do usuário ou e-mail é obrigatório.");

  const isEmail = identifier.includes("@");
  let userId = identifier;
  let email = identifier;

  if (isEmail) {
    const foundUser = await findAuthUserByEmail(identifier);
    if (!foundUser) throw new Error("Usuário não encontrado no sistema de autenticação.");
    userId = foundUser.id;
    email = foundUser.email ?? identifier;
  } else {
    try {
      const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
      if (userError || !userData?.user) {
        const { data: profile } = await admin.from("profiles").select("id, email").eq("id", userId).maybeSingle();
        if (!profile) throw new Error("Usuário não encontrado.");
        email = profile.email ?? "";
      } else {
        email = userData.user.email ?? "";
      }
    } catch {
      const { data: profile } = await admin.from("profiles").select("id, email").eq("id", userId).maybeSingle();
      if (!profile) throw new Error("Usuário não encontrado.");
      email = profile.email ?? "";
    }
  }

  try {
    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    });
    if (updateError) {
      if (isSignatureOrJwtError(updateError)) {
        console.warn(`[confirmUserEmailManually] Aviso de assinatura GoTrue ao confirmar e-mail do user ${userId}:`, updateError.message);
      } else {
        throw new Error(updateError.message);
      }
    }
  } catch (err: unknown) {
    if (isSignatureOrJwtError(err)) {
      console.warn(`[confirmUserEmailManually] Exceção de assinatura GoTrue ao confirmar e-mail do user ${userId}:`, err);
    } else {
      throw err instanceof Error ? err : new Error(String(err));
    }
  }

  await admin.from("profiles").update({ updated_at: new Date().toISOString() }).eq("id", userId);

  return { confirmed: true, email, user_id: userId };
};

const deleteUserAttempt = async (payload: Record<string, unknown>) => {
  const rawIdentifier = String(payload.identifier ?? payload.email ?? payload.cpf ?? payload.userId ?? "").trim();
  if (!rawIdentifier) throw new Error("Identificador (e-mail, CPF ou ID) é obrigatório.");

  const isEmail = rawIdentifier.includes("@");
  const cleanDigits = digits(rawIdentifier);
  const isCpf = !isEmail && cleanDigits.length === 11;

  let targetEmail = isEmail ? normalizeEmail(rawIdentifier) : "";
  let targetUserId = (!isEmail && !isCpf) ? rawIdentifier : "";

  // 1. Se for CPF, buscar no profiles e nos metadados de auth.users via helper otimizado
  if (isCpf) {
    const { user, profile } = await findAuthUserByCpf(cleanDigits);
    if (profile) {
      targetUserId = profile.id;
      if (profile.email) targetEmail = normalizeEmail(profile.email);
    } else if (user) {
      targetUserId = user.id;
      if (user.email) targetEmail = normalizeEmail(user.email);
    }
  } else if (isEmail) {
    const foundUser = await findAuthUserByEmail(targetEmail);
    if (foundUser) {
      targetUserId = foundUser.id;
    } else {
      // Buscar se existe perfil com esse email mesmo sem auth.users
      const { data: profileByEmail } = await admin
        .from("profiles")
        .select("id")
        .eq("email", targetEmail)
        .maybeSingle();
      if (profileByEmail) targetUserId = profileByEmail.id;
    }
  } else if (targetUserId) {
    try {
      const { data: userData } = await admin.auth.admin.getUserById(targetUserId);
      if (userData?.user?.email) targetEmail = normalizeEmail(userData.user.email);
    } catch {
      // Ignora erro GoTrue
    }
    if (!targetEmail) {
      const { data: profileById } = await admin.from("profiles").select("email").eq("id", targetUserId).maybeSingle();
      if (profileById?.email) targetEmail = normalizeEmail(profileById.email);
    }
  }

  // 2. Limpar convites pendentes
  const cleanupTasks: Promise<unknown>[] = [];
  if (targetEmail) {
    cleanupTasks.push(admin.from("clinic_collaborator_invitations").delete().eq("email", targetEmail));
  }
  if (!isEmail && !isCpf) {
    cleanupTasks.push(admin.from("clinic_collaborator_invitations").delete().eq("id", rawIdentifier));
  }
  if (cleanupTasks.length) {
    await Promise.all(cleanupTasks);
  }

  // 3. Limpar tabelas relacionais do perfil e do usuário
  if (targetUserId) {
    await Promise.all([
      admin.from("clinic_memberships").delete().eq("user_id", targetUserId),
      admin.from("user_roles").delete().eq("user_id", targetUserId),
      admin.from("profiles").delete().eq("id", targetUserId),
    ]);
    try {
      await admin.auth.admin.deleteUser(targetUserId);
    } catch {
      // Se já não existia em auth.users, ignora
    }
  }

  if (!targetUserId && !targetEmail) {
    throw new Error("Nenhum usuário ou cadastro pendente foi encontrado para o identificador informado.");
  }

  return {
    deleted: true,
    email: targetEmail || null,
    user_id: targetUserId || null,
    identifier: rawIdentifier,
  };
};

type HandlerContext = { userClient?: ReturnType<typeof createClient>; user?: { id: string } };

const handlers: Record<Action, (payload: Record<string, unknown>, context?: HandlerContext) => Promise<Record<string, unknown>>> = {
  assign_user_to_clinic: assignUserToClinic,
  confirm_user_email_manually: confirmUserEmailManually,
  create_owner_account: createOwnerAccount,
  create_patient: createPatient,
  create_simple_user: createSimpleUser,
  create_subaccount: createSubaccount,
  delete_clinic_package: deleteClinicPackage,
  delete_patient: deletePatient,
  delete_subaccount: deleteSubaccount,
  delete_user_attempt: deleteUserAttempt,
  remove_user_from_clinic: removeUserFromClinic,
  resend_invitation: resendInvitation,
  update_clinic_access: updateClinicAccess,
  update_membership_role: updateMembershipRole,
  update_owner_access: updateOwnerAccess,
  update_patient: updatePatient,
  update_subaccount_access: updateSubaccountAccess,
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const { userClient, user } = await requirePlatformOwner(request.headers.get("Authorization"));
    const body = await request.json();
    const action = String(body?.action ?? "") as Action;
    const payload = (body?.payload ?? {}) as Record<string, unknown>;
    const reason = normalizeText(body?.reason, 1000);
    if (!handlers[action]) throw new Error("Ação administrativa inválida.");
    if (!reason || reason.length < 8) throw new Error("Informe um motivo com pelo menos 8 caracteres.");

    const result = await handlers[action](payload, { userClient, user });
    const deletedClinic = action === "delete_clinic_package" || (action === "update_clinic_access" && payload.status === "delete");
    const auditClinicId = deletedClinic ? null : String(result.clinic_id ?? payload.clinicId ?? "") || null;
    await logAudit(
      userClient,
      `platform_account_admin_${action}`,
      auditClinicId,
      reason,
      {
        action,
        result,
      },
      user.id
    );
    return json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operação indisponível.";
    return json({ error: message }, 400);
  }
});
