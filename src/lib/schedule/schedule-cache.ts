// src/lib/schedule/schedule-cache.ts
/**
 * Módulo de Cache e Isolamento de Agenda (Frontend / Edge / Workers)
 * Consome Upstash Redis REST API com fallback graceful para Supabase RPC.
 */

import { supabase } from "@/integrations/supabase/client";

export interface AvailableSlotsCacheConfig {
  redisRestUrl?: string;
  redisRestToken?: string;
  defaultTtlSeconds?: number;
}

function getUpstashEnv(): { url: string | undefined; token: string | undefined } {
  const url =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_UPSTASH_REDIS_REST_URL
      ? String(import.meta.env.VITE_UPSTASH_REDIS_REST_URL)
      : typeof process !== "undefined" && process.env?.VITE_UPSTASH_REDIS_REST_URL
      ? process.env.VITE_UPSTASH_REDIS_REST_URL
      : undefined;

  const token =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_UPSTASH_REDIS_REST_TOKEN
      ? String(import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN)
      : typeof process !== "undefined" && process.env?.VITE_UPSTASH_REDIS_REST_TOKEN
      ? process.env.VITE_UPSTASH_REDIS_REST_TOKEN
      : undefined;

  return { url, token };
}

export function buildSlotCacheKey(clinicId: string, providerId: string | null | undefined, date: string): string {
  const safeProvider = providerId || "all";
  return `schedule:slots:${clinicId}:${safeProvider}:${date}`;
}

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
    const formattedUrl = url.endsWith("/") ? url : `${url}/`;
    const res = await fetch(formattedUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
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

export async function getAvailableSlotsCached(
  clinicId: string,
  providerId: string | null | undefined,
  date: string,
  config?: AvailableSlotsCacheConfig
): Promise<{ slots: string[]; fromCache: boolean }> {
  const cacheKey = buildSlotCacheKey(clinicId, providerId, date);
  const ttl = config?.defaultTtlSeconds || 120;

  // 1. Tenta ler do Redis (Cache HIT)
  const cachedValue = await executeUpstashCommand(["GET", cacheKey], config);
  if (typeof cachedValue === "string" && cachedValue.length > 0) {
    try {
      const parsed = JSON.parse(cachedValue);
      if (Array.isArray(parsed)) {
        return { slots: parsed as string[], fromCache: true };
      }
    } catch {
      // Ignora erro de parse
    }
  }

  // 2. Cache MISS: Consulta RPC no Supabase
  const { data: dbSlots, error: rpcError } = await (supabase.rpc as any)("rpc_get_available_slots", {
    _clinic_id: clinicId,
    _provider_id: providerId || null,
    _date: date,
  });

  if (rpcError) {
    console.error("[schedule-cache] Erro ao invocar rpc_get_available_slots:", rpcError);
    return { slots: [], fromCache: false };
  }

  const slotsArray = Array.isArray(dbSlots) ? (dbSlots as string[]) : [];

  if (slotsArray.length > 0) {
    void executeUpstashCommand(["SET", cacheKey, JSON.stringify(slotsArray), "EX", ttl], config);
  }

  return { slots: slotsArray, fromCache: false };
}

export async function invalidateSlotCache(
  clinicId: string,
  providerId: string | null | undefined,
  date: string,
  config?: AvailableSlotsCacheConfig
): Promise<boolean> {
  const cacheKey = buildSlotCacheKey(clinicId, providerId, date);
  const result = await executeUpstashCommand(["DEL", cacheKey], config);

  if (providerId) {
    const allKey = buildSlotCacheKey(clinicId, "all", date);
    void executeUpstashCommand(["DEL", allKey], config);
  }

  return result !== null;
}
