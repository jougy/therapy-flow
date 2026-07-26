import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";
import { createPresignedS3Url } from "../_shared/b2-s3.ts";

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
    if (!uploadId) return json({ error: "Upload inválido." }, 400);

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Usuário não autenticado." }, 401);

    const { data: upload, error: uploadError } = await userClient
      .from("patient_file_uploads")
      .select("id, clinic_id, bucket_name, object_key, byte_size, content_type, status, storage_encoding, stored_byte_size, stored_content_type")
      .eq("id", uploadId)
      .maybeSingle();
    if (uploadError) throw new Error(uploadError.message);
    if (!upload) return json({ error: "Registro de upload não encontrado." }, 404);

    const { data: canWrite, error: permissionError } = await userClient.rpc("current_user_can", {
      _capability: "patients.write",
      _clinic_id: upload.clinic_id,
    });
    if (permissionError) throw new Error(permissionError.message);
    if (canWrite !== true) return json({ error: "Você não tem permissão para confirmar este upload." }, 403);

    if (upload.status === "uploaded") {
      return json({ confirmed: true, uploadId, status: "uploaded" });
    }

    const headUrl = await createPresignedS3Url({
      accessKeyId: b2KeyId,
      bucket: upload.bucket_name,
      endpoint: b2Endpoint,
      expiresIn: 300,
      key: upload.object_key,
      method: "HEAD",
      region: b2Region,
      secretAccessKey: b2ApplicationKey,
    });
    const head = await fetch(headUrl, { method: "HEAD" });
    if (!head.ok) return json({ error: "Arquivo ainda não encontrado no storage." }, 409);

    const uploadedSize = Number(head.headers.get("content-length") ?? 0);
    const uploadedType = String(head.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const expectedSize = Number(upload.stored_byte_size ?? upload.byte_size);
    const expectedType = String(upload.stored_content_type ?? upload.content_type).split(";")[0].trim().toLowerCase();

    if (uploadedSize !== expectedSize) {
      await admin.from("patient_file_uploads").update({ status: "failed" }).eq("id", uploadId);
      return json({ error: "O tamanho enviado não confere com o arquivo preparado." }, 409);
    }

    if (uploadedType && uploadedType !== expectedType) {
      await admin.from("patient_file_uploads").update({ status: "failed" }).eq("id", uploadId);
      return json({ error: "O tipo do arquivo enviado não confere com o upload preparado." }, 409);
    }

    const uploadedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await admin
      .from("patient_file_uploads")
      .update({ status: "uploaded", uploaded_at: uploadedAt })
      .eq("id", uploadId)
      .select("id, status, uploaded_at")
      .single();
    if (updateError) throw new Error(updateError.message);

    return json({ confirmed: true, upload: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao confirmar upload.";
    return json({ error: message }, 400);
  }
});
