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
const bucketName = requiredEnv("B2_BUCKET_NAME");
const b2Region = requiredEnv("B2_REGION");
const b2Endpoint = requiredEnv("B2_S3_ENDPOINT");
const b2KeyId = requiredEnv("B2_APPLICATION_KEY_ID");
const b2ApplicationKey = requiredEnv("B2_APPLICATION_KEY");
const maxUploadBytes = Number(Deno.env.get("B2_MAX_UPLOAD_BYTES") ?? 52_428_800);

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const allowedCategories = new Set(["anamnesis", "exam", "image", "document", "other"]);
const allowedStorageEncodings = new Set(["gzip", "deflate"]);
const allowedContentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

const getBearer = (authorization: string | null) => authorization?.replace(/^Bearer\s+/i, "") ?? "";
const normalizeUuid = (value: unknown) => {
  const text = String(value ?? "").trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : "";
};
const normalizeText = (value: unknown, max = 160) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const normalizeContentType = (value: unknown) => String(value ?? "").split(";")[0].trim().toLowerCase();
const normalizePositiveInteger = (value: unknown, max: number) => {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 && number <= max ? number : null;
};
const normalizeSha256 = (value: unknown) => {
  const text = String(value ?? "").trim().toLowerCase();
  return /^[a-f0-9]{64}$/.test(text) ? text : null;
};
const sanitizeFilename = (value: string) => {
  const fallback = "arquivo";
  const withoutPath = value.split(/[\\/]/).pop() ?? fallback;
  const sanitized = withoutPath
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return sanitized || fallback;
};
const todayPrefix = () => new Date().toISOString().slice(0, 10).replace(/-/g, "/");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const token = getBearer(req.headers.get("Authorization"));
    if (!token) return json({ error: "Sessão ausente." }, 401);

    const body = await req.json().catch(() => ({}));
    const clinicId = normalizeUuid(body.clinicId);
    const patientId = normalizeUuid(body.patientId);
    const sessionId = normalizeUuid(body.sessionId);
    const originalFilename = normalizeText(body.filename, 180);
    const contentType = normalizeContentType(body.contentType);
    const originalContentType = normalizeContentType(body.originalContentType) || contentType;
    const storedContentType = normalizeContentType(body.storedContentType) || contentType;
    const byteSize = Number(body.byteSize);
    const originalByteSize = Number(body.originalByteSize ?? byteSize);
    const storedByteSize = Number(body.storedByteSize ?? byteSize);
    const checksumSha256 = normalizeSha256(body.checksumSha256);
    const category = allowedCategories.has(String(body.category)) ? String(body.category) : "other";
    const storageEncoding = allowedStorageEncodings.has(String(body.storageEncoding)) ? String(body.storageEncoding) : null;
    const compressionProfile = normalizeText(body.compressionProfile, 80) || "original";
    const imageWidth = normalizePositiveInteger(body.imageWidth, 20_000);
    const imageHeight = normalizePositiveInteger(body.imageHeight, 20_000);
    const pageCount = normalizePositiveInteger(body.pageCount, 20_000);

    if (!clinicId || !patientId || !originalFilename) {
      return json({ error: "Informe clínica, paciente e nome do arquivo." }, 400);
    }

    if (!allowedContentTypes.has(contentType) || !allowedContentTypes.has(originalContentType) || !allowedContentTypes.has(storedContentType)) {
      return json({ error: "Envie apenas PDF ou imagens nos formatos JPEG, PNG, WebP, HEIC ou HEIF." }, 400);
    }

    if (!Number.isFinite(byteSize) || byteSize <= 0 || byteSize > maxUploadBytes) {
      return json({ error: "Arquivo acima do limite permitido para upload." }, 400);
    }

    if (!Number.isFinite(originalByteSize) || originalByteSize <= 0 || !Number.isFinite(storedByteSize) || storedByteSize <= 0 || storedByteSize > maxUploadBytes) {
      return json({ error: "Metadados de tamanho do arquivo inválidos." }, 400);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user) return json({ error: "Usuário não autenticado." }, 401);

    const { data: canWrite, error: permissionError } = await userClient.rpc("current_user_can", {
      _capability: "patients.write",
      _clinic_id: clinicId,
    });
    if (permissionError) throw new Error(permissionError.message);
    if (canWrite !== true) return json({ error: "Você não tem permissão para anexar arquivos neste paciente." }, 403);

    const { data: patient, error: patientError } = await userClient
      .from("patients")
      .select("id")
      .eq("id", patientId)
      .eq("clinic_id", clinicId)
      .maybeSingle();
    if (patientError) throw new Error(patientError.message);
    if (!patient) return json({ error: "Paciente não encontrado nesta clínica." }, 404);

    if (sessionId) {
      const { data: session, error: sessionError } = await userClient
        .from("sessions")
        .select("id")
        .eq("id", sessionId)
        .eq("patient_id", patientId)
        .eq("clinic_id", clinicId)
        .maybeSingle();
      if (sessionError) throw new Error(sessionError.message);
      if (!session) return json({ error: "Atendimento não encontrado para este paciente." }, 404);
    }

    const uploadId = crypto.randomUUID();
    const filename = sanitizeFilename(originalFilename);
    const sessionSegment = sessionId || "general";
    const objectKey = `clinics/${clinicId}/patients/${patientId}/sessions/${sessionSegment}/files/${todayPrefix()}/${uploadId}-${filename}`;
    const expiresIn = 900;
    const uploadExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const uploadUrl = await createPresignedS3Url({
      accessKeyId: b2KeyId,
      bucket: bucketName,
      endpoint: b2Endpoint,
      expiresIn,
      key: objectKey,
      method: "PUT",
      region: b2Region,
      secretAccessKey: b2ApplicationKey,
    });

    const { data: upload, error: insertError } = await admin
      .from("patient_file_uploads")
      .insert({
        bucket_name: bucketName,
        byte_size: storedByteSize,
        category,
        checksum_sha256: checksumSha256,
        clinic_id: clinicId,
        compression_profile: compressionProfile,
        content_type: storedContentType,
        id: uploadId,
        image_height: imageHeight,
        image_width: imageWidth,
        metadata: {
          presigned_method: "PUT",
          original_filename: originalFilename,
        },
        object_key: objectKey,
        original_filename: originalFilename,
        original_byte_size: originalByteSize,
        original_content_type: originalContentType,
        page_count: pageCount,
        patient_id: patientId,
        session_id: sessionId || null,
        status: "pending",
        storage_encoding: storageEncoding,
        stored_byte_size: storedByteSize,
        stored_content_type: storedContentType,
        upload_expires_at: uploadExpiresAt,
        uploaded_by_user_id: userData.user.id,
      })
      .select("id, object_key, upload_expires_at")
      .single();
    if (insertError) throw new Error(insertError.message);

    return json({
      bucket: bucketName,
      contentType: storedContentType,
      expiresIn,
      headers: {
        "content-type": storedContentType,
      },
      objectKey: upload.object_key,
      uploadId: upload.id,
      uploadUrl,
      uploadExpiresAt: upload.upload_expires_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro ao preparar upload.";
    return json({ error: message }, 400);
  }
});
