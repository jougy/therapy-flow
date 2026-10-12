// supabase/functions/_shared/feature-flags-client.ts

/**
 * Interface genérica do Supabase Client compatível com Deno e Node.js
 */
export interface MinimalSupabaseClient {
  from(table: string): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): {
          maybeSingle(): Promise<{ data: unknown; error: unknown }>;
        };
        maybeSingle(): Promise<{ data: unknown; error: unknown }>;
      };
    };
  };
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

// Cache em memória de curta duração por flagKey (60 segundos)
const flagsMemoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000;

/**
 * Limpa o cache interno de feature flags (útil para testes unitários ou revalidação forçada)
 */
export function clearFeatureFlagsCache(): void {
  flagsMemoryCache.clear();
}

/**
 * Consulta de forma resiliente uma Feature Flag de escopo global no Supabase com fail-safe absoluto.
 *
 * Características:
 * - Cache em memória com TTL de 60 segundos para evitar sobrecarga no banco.
 * - Suporta valores booleanos primitivos, strings booleanas ("true"/"false") ou JSONB estruturado contendo a chave { enabled: boolean, ... }.
 * - Fail-safe absoluto: se o cliente for nulo, tabela feature_flags inacessível, erro no Postgres ou sem registros, retorna com segurança o `defaultValue`.
 *
 * @param supabaseClient Cliente Supabase com permissões adequadas
 * @param flagKey Chave da feature flag (ex: 'notifications_whatsapp_onboarding')
 * @param defaultValue Valor padrão de fail-safe caso a flag não exista ou haja falha de conexão
 */
export async function getGlobalFeatureFlag<T = boolean>(
  supabaseClient: MinimalSupabaseClient | unknown,
  flagKey: string,
  defaultValue: T
): Promise<T> {
  if (!flagKey || typeof flagKey !== 'string') {
    return defaultValue;
  }

  const cleanKey = flagKey.trim();
  const now = Date.now();

  // 1. Verificação no cache em memória
  const cached = flagsMemoryCache.get(cleanKey);
  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  // 2. Fail-safe antecipado: cliente Supabase inválido
  if (!supabaseClient || typeof (supabaseClient as MinimalSupabaseClient).from !== 'function') {
    return defaultValue;
  }

  try {
    const client = supabaseClient as MinimalSupabaseClient;
    const { data, error } = await client
      .from('feature_flags')
      .select('value, starts_at, expires_at')
      .eq('key', cleanKey)
      .eq('scope', 'global')
      .maybeSingle();

    if (error || !data) {
      // Se não encontrou ou erro de permissão/tabela, armazena defaultValue no cache por tempo reduzido
      flagsMemoryCache.set(cleanKey, { value: defaultValue, expiresAt: now + CACHE_TTL_MS });
      return defaultValue;
    }

    const record = data as {
      value: unknown;
      starts_at?: string | null;
      expires_at?: string | null;
    };

    // Validação de janela de vigência temporal se configurada
    if (record.starts_at && new Date(record.starts_at).getTime() > now) {
      flagsMemoryCache.set(cleanKey, { value: defaultValue, expiresAt: now + CACHE_TTL_MS });
      return defaultValue;
    }
    if (record.expires_at && new Date(record.expires_at).getTime() <= now) {
      flagsMemoryCache.set(cleanKey, { value: defaultValue, expiresAt: now + CACHE_TTL_MS });
      return defaultValue;
    }

    const rawVal = record.value;

    // Normalização de boolean flags
    if (typeof defaultValue === 'boolean') {
      let resolvedBool: boolean;
      if (rawVal !== null && typeof rawVal === 'object' && 'enabled' in (rawVal as Record<string, unknown>)) {
        resolvedBool = (rawVal as Record<string, unknown>).enabled === true;
      } else if (typeof rawVal === 'boolean') {
        resolvedBool = rawVal;
      } else if (rawVal === 'true' || rawVal === 't') {
        resolvedBool = true;
      } else if (rawVal === 'false' || rawVal === 'f') {
        resolvedBool = false;
      } else {
        resolvedBool = defaultValue;
      }

      flagsMemoryCache.set(cleanKey, { value: resolvedBool, expiresAt: now + CACHE_TTL_MS });
      return resolvedBool as unknown as T;
    }

    // Para outros tipos (objetos, configs completas, strings, números)
    let resolvedValue: T = defaultValue;
    if (rawVal !== undefined && rawVal !== null) {
      resolvedValue = rawVal as T;
    }

    flagsMemoryCache.set(cleanKey, { value: resolvedValue, expiresAt: now + CACHE_TTL_MS });
    return resolvedValue;
  } catch (err) {
    console.warn(`[feature-flags-client] Falha ao consultar flag "${cleanKey}" (fail-safe ativado):`, err);
    return defaultValue;
  }
}
