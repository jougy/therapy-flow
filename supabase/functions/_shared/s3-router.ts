import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

export interface StorageProviderRecord {
  id: string;
  provider_key: string;
  driver: "s3" | "supabase_storage";
  bucket_name: string;
  endpoint: string;
  region: string;
  secret_prefix: string;
  quota_bytes: number;
  used_bytes: number;
  is_writable: boolean;
  is_active: boolean;
  priority: number;
}

export interface ResolvedS3Config {
  provider: StorageProviderRecord;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
  region: string;
}

export interface StorageRouteInput {
  entityType: "patient_file" | "session_archive" | "audit_archive" | "backup_snapshot";
  entityId: string;
  clinicId?: string | null;
  providerId: string;
  objectKey: string;
  compression?: "none" | "zstd";
  originalSizeBytes?: number;
  storedSizeBytes?: number;
  checksumSha256?: string | null;
}

/**
 * Resolve credenciais S3 a partir do prefixo configurado no Pulumi ESC / env.
 * Ex.: secret_prefix = "B2" -> B2_APPLICATION_KEY_ID / B2_APPLICATION_KEY (ou B2_ACCESS_KEY_ID / B2_SECRET_ACCESS_KEY).
 * Ex.: secret_prefix = "R2_01" -> R2_01_ACCESS_KEY_ID / R2_01_SECRET_ACCESS_KEY.
 */
export const resolveProviderCredentials = (
  provider: StorageProviderRecord,
): { accessKeyId: string; secretAccessKey: string } => {
  const prefix = provider.secret_prefix.trim();

  const accessKeyId =
    Deno.env.get(`${prefix}_ACCESS_KEY_ID`) ??
    Deno.env.get(`${prefix}_APPLICATION_KEY_ID`);

  const secretAccessKey =
    Deno.env.get(`${prefix}_SECRET_ACCESS_KEY`) ??
    Deno.env.get(`${prefix}_APPLICATION_KEY`);

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      `Credenciais ausentes para provedor '${provider.provider_key}' (prefixo '${prefix}' no Pulumi ESC / env).`,
    );
  }

  return { accessKeyId, secretAccessKey };
};

/**
 * Seleciona o provedor de escrita ativo com maior prioridade (menor numero)
 * que ainda possua espaco disponivel abaixo da cota configurada.
 */
export const selectWritableProvider = async (
  supabaseAdmin: SupabaseClient,
  requiredBytes = 0,
  preferredProviderKey?: string,
): Promise<ResolvedS3Config> => {
  let query = supabaseAdmin
    .from("storage_providers")
    .select("*")
    .eq("is_active", true)
    .eq("is_writable", true)
    .order("priority", { ascending: true });

  if (preferredProviderKey) {
    query = query.eq("provider_key", preferredProviderKey);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Falha ao consultar storage_providers: ${error.message}`);
  }

  const providers = (data ?? []) as StorageProviderRecord[];
  const selected = providers.find((p) => p.used_bytes + requiredBytes <= p.quota_bytes);

  if (!selected) {
    throw new Error(
      providers.length === 0
        ? "Nenhum provedor de storage ativo e gravavel encontrado em storage_providers."
        : "Todos os provedores de storage ativos atingiram a cota configurada.",
    );
  }

  const { accessKeyId, secretAccessKey } = resolveProviderCredentials(selected);
  return {
    provider: selected,
    accessKeyId,
    secretAccessKey,
    bucket: selected.bucket_name,
    endpoint: selected.endpoint,
    region: selected.region,
  };
};

/**
 * Registra ou atualiza a rota de um objeto na tabela de roteamento.
 */
export const registerObjectRoute = async (
  supabaseAdmin: SupabaseClient,
  input: StorageRouteInput,
): Promise<void> => {
  const { error } = await supabaseAdmin
    .from("storage_object_routes")
    .upsert(
      {
        entity_type: input.entityType,
        entity_id: input.entityId,
        clinic_id: input.clinicId ?? null,
        provider_id: input.providerId,
        object_key: input.objectKey,
        compression: input.compression ?? "none",
        original_size_bytes: input.originalSizeBytes ?? 0,
        stored_size_bytes: input.storedSizeBytes ?? 0,
        checksum_sha256: input.checksumSha256 ?? null,
        archived_at: input.compression === "zstd" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "provider_id,object_key" },
    );

  if (error) {
    throw new Error(`Falha ao registrar rota em storage_object_routes: ${error.message}`);
  }
};
