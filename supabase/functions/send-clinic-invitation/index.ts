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

const normalizeToken = (value: unknown) => String(value ?? "").replace(/[^a-f0-9]/gi, "").slice(0, 128);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    const bearer = authorization?.replace(/^Bearer\s+/i, "");
    if (!bearer) return json({ error: "Token ausente." }, 401);

    const body = await req.json().catch(() => ({}));
    const token = normalizeToken(body.token);
    const inviteUrl = String(body.inviteUrl ?? "").trim();

    if (!token || !inviteUrl) {
      return json({ error: "Convite inválido." }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${bearer}` } },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(bearer);
    if (authError || !authData.user) return json({ error: "Usuário não autenticado." }, 401);

    const { data: invitation, error: invitationError } = await admin.rpc("get_clinic_collaborator_invitation", { _token: token });
    if (invitationError) throw new Error(invitationError.message);

    const clinicId = String(invitation?.clinic_id ?? "");
    const email = String(invitation?.email ?? "").trim().toLowerCase();
    const existingUser = Boolean(invitation?.existing_user);
    const status = String(invitation?.status ?? "");

    if (!clinicId || !email || status !== "pending") {
      return json({ error: "Convite não está pendente." }, 400);
    }

    if (existingUser) {
      return json({ skipped: true, reason: "existing_user" });
    }

    const { data: canManage, error: permissionError } = await userClient.rpc("current_user_can", {
      _capability: "subaccounts.manage",
      _clinic_id: clinicId,
    });
    if (permissionError) throw new Error(permissionError.message);
    if (canManage !== true) return json({ error: "Você não tem permissão para enviar este convite." }, 403);

    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo: inviteUrl,
    });

    if (inviteError) throw new Error(inviteError.message);

    return json({ sent: true, email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao enviar convite.";
    return json({ error: message }, 400);
  }
});
