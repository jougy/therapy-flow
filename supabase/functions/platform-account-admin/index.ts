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
const plans = new Set(["solo", "clinic"]);

const normalizeEmail = (value: unknown) => String(value ?? "").trim().toLowerCase();
const normalizeText = (value: unknown, max = 500) => {
  const normalized = String(value ?? "").replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, max) : null;
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
  return plan as "solo" | "clinic";
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

const requirePlatformOwner = async (authorization: string | null) => {
  const token = authorization?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Token ausente.");

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser(token);
  if (userError || !userData.user) throw new Error("Usuário não autenticado.");

  const { data, error } = await userClient.rpc("is_platform_owner_mfa_verified");
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error("Acesso master exige platform_owner com 2FA validado.");

  return { user: userData.user, userClient };
};

const logAudit = async (
  userClient: ReturnType<typeof createClient>,
  eventType: string,
  clinicId: string | null,
  reason: string | null,
  metadata: Record<string, unknown>
) => {
  const { error } = await userClient.rpc("log_platform_audit_event", {
    _clinic_id: clinicId,
    _event_type: eventType,
    _metadata: metadata,
    _reason: reason,
  });
  if (error) throw new Error(error.message);
};

const getClinic = async (clinicIdOrDocument: unknown) => {
  const raw = String(clinicIdOrDocument ?? "").trim();
  const doc = digits(raw);
  let query = admin.from("clinics").select("*").limit(1);
  query = doc.length ? query.eq("cnpj", doc) : query.eq("id", raw);
  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Clínica não encontrada.");
  return data;
};

const getAccountProfile = async (identifier: unknown) => {
  const value = String(identifier ?? "").trim();
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

const setAdminStatus = async (userId: string, status: string) => {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw new Error(error.message);
  const appMetadata = {
    ...(data.user?.app_metadata ?? {}),
    admin_status: status,
  };
  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    app_metadata: appMetadata,
  });
  if (updateError) throw new Error(updateError.message);
};

const updateAuthAccess = async (userId: string, payload: Record<string, unknown>) => {
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
  const { error } = await admin.auth.admin.updateUserById(userId, next);
  if (error) throw new Error(error.message);
};

const createOwnerAccount = async (payload: Record<string, unknown>) => {
  const email = normalizeEmail(payload.email);
  const password = normalizePassword(payload.password);
  const document = normalizeDocument(payload.cnpj);
  const plan = normalizePlan(payload.plan);
  const status = normalizeStatus(payload.status);
  const concurrentLimit = plan === "clinic" ? normalizeLimit(payload.concurrentAccessLimit, 4) : 1;

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

    if (plan === "clinic") {
      const { error: clinicError } = await admin
        .from("clinics")
        .update({ concurrent_access_limit: concurrentLimit, subaccount_limit: Math.max(concurrentLimit, 4) })
        .eq("account_owner_user_id", userId);
      if (clinicError) throw new Error(clinicError.message);
    }
  } catch (error) {
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }

  return { user_id: userId, email, plan };
};

const createSubaccount = async (payload: Record<string, unknown>) => {
  const clinic = await getClinic(payload.clinicId ?? payload.clinic);
  if (clinic.subscription_plan !== "clinic") throw new Error("A clínica selecionada precisa estar no plano clinic.");

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
    await admin.auth.admin.deleteUser(userId);
    throw error;
  }

  return { clinic_id: clinic.id, user_id: userId, email, role };
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

  const clinicUpdate: Record<string, unknown> = {
    access_status: status,
  };

  if (payload.concurrentAccessLimit !== undefined) {
    const limit = normalizeLimit(payload.concurrentAccessLimit, 4);
    clinicUpdate.concurrent_access_limit = limit;
    clinicUpdate.subaccount_limit = Math.max(limit, clinic.subscription_plan === "clinic" ? 4 : 0);
  }

  if (payload.subaccountLimit !== undefined) {
    clinicUpdate.subaccount_limit = normalizeLimit(payload.subaccountLimit, clinic.subaccount_limit ?? 4);
  }

  const { error: clinicError } = await admin.from("clinics").update(clinicUpdate).eq("id", clinic.id);
  if (clinicError) throw new Error(clinicError.message);

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
  for (const userId of userIds) {
    await setAdminStatus(String(userId), status);
  }

  return { clinic_id: clinic.id, status, affected_users: userIds.length };
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
  for (const userId of userIds) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
    if (deleteError) throw new Error(deleteError.message);
  }
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
  const { error } = await admin.auth.admin.deleteUser(account.id);
  if (error) throw new Error(error.message);
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

  // Se o contexto tiver o userClient autenticado, podemos tentar executar via RPC
  // Mas como fallback ou primário robusto com service role:
  let rpcSuccess = false;
  let data: Record<string, unknown> | null = null;

  if (context?.userClient) {
    try {
      const res = await context.userClient.rpc("resend_clinic_collaborator_invitation", {
        _invitation_id: invitationId,
      });
      if (!res.error && res.data) {
        data = res.data as Record<string, unknown>;
        rpcSuccess = true;
      }
    } catch {
      // Se falhar no userClient, prossegue com service role
    }
  }

  if (!rpcSuccess) {
    // Buscar o convite pendente por ID ou e-mail com service role admin
    let query = admin.from("clinic_collaborator_invitations").select("*").limit(1);
    if (invitationId.includes("@")) {
      query = query.eq("email", invitationId.toLowerCase()).eq("status", "pending");
    } else {
      query = query.eq("id", invitationId);
    }
    const { data: invitation, error: invError } = await query.maybeSingle();
    if (invError) throw new Error(invError.message);
    if (!invitation) throw new Error("Convite não encontrado.");
    if (invitation.status !== "pending") throw new Error("Apenas convites pendentes podem ser reenviados.");

    // Rate limiting check de 30 segundos
    if (invitation.last_resent_at) {
      const diffMs = Date.now() - new Date(invitation.last_resent_at).getTime();
      if (diffMs < 30000) {
        const remaining = Math.ceil((30000 - diffMs) / 1000);
        throw new Error(`Aguarde ${remaining} segundos antes de reenviar o convite novamente.`);
      }
    }

    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
    // md5 token hash via subtle crypto ou digest
    const encoder = new TextEncoder();
    const dataBuf = encoder.encode(token);
    // Use SHA-256 for secure tokens, but let's check what SQL expects: md5(_token)
    // Deno supports crypto.subtle.digest("SHA-256", ...)
    // Or we can just run a quick direct RPC with userClient if possible, or update clinic_collaborator_invitations directly:
    // Em Postgres a função usou md5(_token). Podemos calcular md5 em js ou atualizar com md5 via sql, ou hash:
    const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuf);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const tokenHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const { error: updateErr } = await admin
      .from("clinic_collaborator_invitations")
      .update({
        token_hash: tokenHash,
        last_resent_at: nowIso,
        updated_at: nowIso,
        expires_at: expiresIso,
      })
      .eq("id", invitation.id);

    if (updateErr) throw new Error(updateErr.message);

    data = {
      id: invitation.id,
      email: invitation.email,
      clinic_id: invitation.clinic_id,
      token,
      path: `/convite/${token}`,
    };
  }

  const email = String(data?.email ?? "");
  const path = String(data?.path ?? "");
  const token = String(data?.token ?? "");

  // Gerar link de convite oficial do Supabase Auth
  let actionLink: string | null = null;
  try {
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: path },
    });
    actionLink = linkData?.properties?.action_link ?? null;
  } catch {
    // Se o usuário já tiver cadastro em auth.users, tenta magiclink ou recovery
    try {
      const { data: magicData } = await admin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo: path },
      });
      actionLink = magicData?.properties?.action_link ?? null;
    } catch {
      // Ignora se não conseguir gerar link auth direto
    }
  }

  return {
    action_link: actionLink,
    clinic_id: data?.clinic_id,
    email,
    invitation_id: data?.id ?? invitationId,
    path,
    remaining_cooldown: 30,
    token,
  };
};

const confirmUserEmailManually = async (payload: Record<string, unknown>) => {
  const identifier = String(payload.identifier ?? payload.userId ?? payload.email ?? "").trim();
  if (!identifier) throw new Error("Identificador do usuário ou e-mail é obrigatório.");

  const isEmail = identifier.includes("@");
  let userId = identifier;
  let email = identifier;

  if (isEmail) {
    const { data: userList, error: listError } = await admin.auth.admin.listUsers();
    if (listError) throw new Error(listError.message);
    const found = userList.users.find((u) => u.email?.toLowerCase() === identifier.toLowerCase());
    if (!found) throw new Error("Usuário não encontrado no sistema de autenticação.");
    userId = found.id;
    email = found.email ?? identifier;
  } else {
    const { data: userData, error: userError } = await admin.auth.admin.getUserById(userId);
    if (userError || !userData.user) throw new Error("Usuário não encontrado.");
    email = userData.user.email ?? "";
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
    email_confirm: true,
  });
  if (updateError) throw new Error(updateError.message);

  await admin.from("profiles").update({ updated_at: new Date().toISOString() }).eq("id", userId);

  return { confirmed: true, email, user_id: userId };
};

const deleteUserAttempt = async (payload: Record<string, unknown>) => {
  const rawIdentifier = String(payload.identifier ?? payload.email ?? payload.cpf ?? payload.userId ?? "").trim();
  if (!rawIdentifier) throw new Error("Identificador (e-mail, CPF ou ID) é obrigatório.");

  const isEmail = rawIdentifier.includes("@");
  const cleanDigits = rawIdentifier.replace(/\D/g, "");
  const isCpf = !isEmail && cleanDigits.length === 11;

  let targetEmail = isEmail ? rawIdentifier.toLowerCase() : "";
  let targetUserId = (!isEmail && !isCpf) ? rawIdentifier : "";

  // 1. Se for CPF, buscar no profiles e nos metadados de auth.users
  if (isCpf) {
    const { data: profileByCpf } = await admin
      .from("profiles")
      .select("id, email")
      .eq("cpf", cleanDigits)
      .maybeSingle();

    if (profileByCpf) {
      targetUserId = profileByCpf.id;
      if (profileByCpf.email) targetEmail = profileByCpf.email.toLowerCase();
    } else {
      // Procurar em auth.users via metadados
      const { data: userList } = await admin.auth.admin.listUsers();
      const found = userList?.users?.find((u) => {
        const metaCpf = String(u.user_metadata?.cpf ?? "").replace(/\D/g, "");
        return metaCpf === cleanDigits;
      });
      if (found) {
        targetUserId = found.id;
        if (found.email) targetEmail = found.email.toLowerCase();
      }
    }
  } else if (isEmail) {
    const { data: userList } = await admin.auth.admin.listUsers();
    const found = userList?.users?.find((u) => u.email?.toLowerCase() === targetEmail);
    if (found) {
      targetUserId = found.id;
    } else {
      // Buscar se existe perfil com esse email
      const { data: profileByEmail } = await admin
        .from("profiles")
        .select("id")
        .eq("email", targetEmail)
        .maybeSingle();
      if (profileByEmail) targetUserId = profileByEmail.id;
    }
  } else if (targetUserId) {
    const { data: userData } = await admin.auth.admin.getUserById(targetUserId);
    if (userData?.user?.email) targetEmail = userData.user.email.toLowerCase();
    if (!targetEmail) {
      const { data: profileById } = await admin.from("profiles").select("email").eq("id", targetUserId).maybeSingle();
      if (profileById?.email) targetEmail = profileById.email.toLowerCase();
    }
  }

  // 2. Limpar convites pendentes
  if (targetEmail) {
    await admin.from("clinic_collaborator_invitations").delete().eq("email", targetEmail);
  }
  if (!isEmail && !isCpf) {
    await admin.from("clinic_collaborator_invitations").delete().eq("id", rawIdentifier);
  }

  // 3. Limpar tabelas relacionais do perfil e do usuário
  if (targetUserId) {
    await admin.from("clinic_memberships").delete().eq("user_id", targetUserId);
    await admin.from("user_roles").delete().eq("user_id", targetUserId);
    await admin.from("profiles").delete().eq("id", targetUserId);
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
  confirm_user_email_manually: confirmUserEmailManually,
  create_owner_account: createOwnerAccount,
  create_patient: createPatient,
  create_subaccount: createSubaccount,
  delete_clinic_package: deleteClinicPackage,
  delete_patient: deletePatient,
  delete_subaccount: deleteSubaccount,
  delete_user_attempt: deleteUserAttempt,
  resend_invitation: resendInvitation,
  update_clinic_access: updateClinicAccess,
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
    await logAudit(userClient, `platform_account_admin_${action}`, auditClinicId, reason, {
      action,
      result,
    });
    return json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Operação indisponível.";
    return json({ error: message }, 400);
  }
});
