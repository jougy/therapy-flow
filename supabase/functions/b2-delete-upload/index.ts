import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { createPresignedS3Url } from "../_shared/b2-s3.ts";
import { checkRateLimits, rateLimitExceededResponse, type RateLimitOptions } from "../_shared/rate-limit.ts";
import { reportError } from "../_shared/error-dedup.ts";

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
const b2Region = requiredEnv("B2_REGION");
const b2Endpoint = requiredEnv("B2_S3_ENDPOINT");
const b2KeyId = requiredEnv("B2_APPLICATION_KEY_ID");
const b2ApplicationKey = requiredEnv("B2_APPLICATION_KEY");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const getBearer = (authorization: string | null) => authorization?.replace(/^Bearer\s+/i, "") ?? "";
const normalizeUuid = (value: unknown) => {
  const text = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : "";
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const token = getBearer(req.headers.get("Authorization"));
    if (!token) return json({ error: "Sessão ausente." }, 401);

    const body = await req.json().catch(() => ({}));
    const uploadId = normalizeUuid(body.uploadId);
    if (!uploadId) return json({ error: "Arquivo inválido." }, 400);

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Usuário não autenticado." }, 401);

    const { data: upload, error: uploadError } = await userClient
      .from("patient_file_uploads")
      .select("id, clinic_id, bucket_name, object_key, status")
      .eq("id", uploadId)
      .maybeSingle();
    if (uploadError) throw new Error(uploadError.message);
    if (!upload) return json({ error: "Arquivo não encontrado." }, 404);

    const rlChecks: RateLimitOptions[] = [
      {
        preset: "b2_write_user",
        identifier: userData.user.id,
        service: "b2-delete-upload",
        route: "b2-delete-upload",
        vipOverride: {
          userId: userData.user.id,
          lookupOverride: async () => {
            const [{ data: ov }, { data: gr }] = await Promise.all([
              admin.from("user_governance_overrides").select("max_actions, time_window_minutes").eq("user_id", userData.user!.id).maybeSingle(),
              admin.from("governance_rules").select("value").eq("key", "rate_limit_config").maybeSingle(),
            ]);
            if (!ov?.max_actions) return null;
            const cfg = (gr?.value as { max_actions?: number; time_window_minutes?: number } | null) || {};
            const baseRate = Math.max(1, Number(cfg.max_actions || 80)) / Math.max(1, Number(cfg.time_window_minutes || 5));
            const vipRate = Number(ov.max_actions) / Math.max(1, Number(ov.time_window_minutes || 5));
            return vipRate > baseRate ? vipRate / baseRate : null;
          },
        },
      },
    ];
    if (upload.clinic_id) {
      rlChecks.push({ preset: "b2_write_clinic", identifier: String(upload.clinic_id), service: "b2-delete-upload", route: "b2-delete-upload" });
    }
    const rl = await checkRateLimits(rlChecks);
    if (!rl.allowed) return rateLimitExceededResponse(rl, corsHeaders);

    const { data: canWrite, error: permissionError } = await userClient.rpc("current_user_can", {
      _capability: "patients.write",
      _clinic_id: upload.clinic_id,
    });
    if (permissionError) throw new Error(permissionError.message);
    if (canWrite !== true) return json({ error: "Você não tem permissão para descartar este arquivo." }, 403);

    const deleteUrl = await createPresignedS3Url({
      accessKeyId: b2KeyId,
      bucket: upload.bucket_name,
      endpoint: b2Endpoint,
      expiresIn: 120,
      key: upload.object_key,
      method: "DELETE",
      region: b2Region,
      secretAccessKey: b2ApplicationKey,
    });

    const deleteResponse = await fetch(deleteUrl, { method: "DELETE" });
    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      const detail = await deleteResponse.text().catch(() => "");
      return json({ error: `Storage recusou a exclusão (${deleteResponse.status}).`, detail }, 409);
    }

    const { error: deleteRecordError } = await admin
      .from("patient_file_uploads")
      .delete()
      .eq("id", uploadId);
    if (deleteRecordError) throw new Error(deleteRecordError.message);

    return json({ deleted: true, uploadId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao descartar arquivo.";
    await reportError({
      service: "b2-delete-upload",
      code: "b2_delete_upload_error",
      route: "b2-delete-upload",
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return json({ error: message }, 400);
  }
});
