// supabase/functions/_shared/schedule-cache.ts
/**
 * Módulo de Cache e Isolamento de Agenda via Upstash Redis REST API
 * Implementa padrão Read-Through com TTL de 120s e Invalidação Imediata (DEL)
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

export interface AvailableSlotsCacheConfig {
  redisRestUrl?: string;
  redisRestToken?: string;
  defaultTtlSeconds?: number;
}

/**
 * Retorna as variáveis de ambiente do Upstash Redis no Deno Edge Runtime ou Node.
 */
function getUpstashEnv(): { url: string | undefined; token: string | undefined } {
  const url =
    (typeof Deno !== 'undefined' ? Deno.env.get('UPSTASH_REDIS_REST_URL') : undefined) ||
    (typeof process !== 'undefined' && process.env ? process.env.UPSTASH_REDIS_REST_URL || process.env.VITE_UPSTASH_REDIS_REST_URL : undefined);

  const token =
    (typeof Deno !== 'undefined' ? Deno.env.get('UPSTASH_REDIS_REST_TOKEN') : undefined) ||
    (typeof process !== 'undefined' && process.env ? process.env.UPSTASH_REDIS_REST_TOKEN || process.env.VITE_UPSTASH_REDIS_REST_TOKEN : undefined);

  return { url, token };
}

/**
 * Constrói a chave padrão de cache para slots da clínica/profissional/data.
 */
export function buildSlotCacheKey(clinicId: string, providerId: string | null | undefined, date: string): string {
  const safeProvider = providerId || 'all';
  return `schedule:slots:${clinicId}:${safeProvider}:${date}`;
}

/**
 * Executa comando REST direto no Upstash Redis com fail-safe (retorna null se offline).
 */
export async function executeUpstashCommand(
  command: (string | number)[],
  config?: AvailableSlotsCacheConfig
): Promise<unknown | null> {
  const env = getUpstashEnv();
  const url = config?.redisRestUrl || env.url;
  const token = config?.redisRestToken || env.token;

  if (!url || !token) {
    return null;
  }

  try {
    const formattedUrl = url.endsWith('/') ? url : `${url}/`;
    const res = await fetch(formattedUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    });

    if (!res.ok) {
      console.warn(`[schedule-cache] Upstash HTTP ${res.status} no comando ${command[0]}`);
      return null;
    }

    const json = await res.json();
    return json?.result ?? null;
  } catch (err) {
    console.warn(`[schedule-cache] Erro de rede ao conectar com Upstash Redis (${command[0]}):`, err);
    return null;
  }
}

/**
 * Consulta horários disponíveis usando Cache Read-Through no Upstash Redis (TTL 120s).
 * Se houver Cache Miss ou Upstash indisponível, chama a RPC isolada public.rpc_get_available_slots no Supabase.
 */
export async function getAvailableSlotsCached(
  supabase: SupabaseClient,
  clinicId: string,
  providerId: string | null | undefined,
  date: string,
  config?: AvailableSlotsCacheConfig
): Promise<{ slots: string[]; fromCache: boolean }> {
  const cacheKey = buildSlotCacheKey(clinicId, providerId, date);
  const ttl = config?.defaultTtlSeconds || 120;

  // 1. Tenta ler do Redis (Cache HIT)
  const cachedValue = await executeUpstashCommand(['GET', cacheKey], config);
  if (typeof cachedValue === 'string' && cachedValue.length > 0) {
    try {
      const parsed = JSON.parse(cachedValue);
      if (Array.isArray(parsed)) {
        return { slots: parsed as string[], fromCache: true };
      }
    } catch {
      // Ignora erro de parse e busca do banco
    }
  }

  // 2. Cache MISS: Consulta a RPC isolada no Supabase
  const { data: dbSlots, error: rpcError } = await supabase.rpc('rpc_get_available_slots', {
    _clinic_id: clinicId,
    _provider_id: providerId || null,
    _date: date,
  });

  if (rpcError) {
    console.error('[schedule-cache] Erro ao invocar rpc_get_available_slots:', rpcError);
    return { slots: [], fromCache: false };
  }

  const slotsArray = Array.isArray(dbSlots) ? (dbSlots as string[]) : [];

  // 3. Salva no Upstash Redis com TTL de 120 segundos (Fail-safe, não trava o fluxo se o Redis falhar)
  if (slotsArray.length > 0) {
    void executeUpstashCommand(['SET', cacheKey, JSON.stringify(slotsArray), 'EX', ttl], config);
  }

  return { slots: slotsArray, fromCache: false };
}

/**
 * Invalida imediatamente a chave de slots de horários no Upstash Redis (DEL).
 * Chamada logo após criação, cancelamento ou remarcação de agendamentos.
 */
export async function invalidateSlotCache(
  clinicId: string,
  providerId: string | null | undefined,
  date: string,
  config?: AvailableSlotsCacheConfig
): Promise<boolean> {
  const cacheKey = buildSlotCacheKey(clinicId, providerId, date);
  const result = await executeUpstashCommand(['DEL', cacheKey], config);
  
  // Também invalida a chave agregada 'all' do provider para garantir consistência
  if (providerId) {
    const allKey = buildSlotCacheKey(clinicId, 'all', date);
    void executeUpstashCommand(['DEL', allKey], config);
  }

  return result !== null;
}
