/**
 * Drivers Multicloud de Telemetria e Observabilidade
 * Suporte a Upstash Redis (Serverless Key-Value) e Axiom Cloud Ingestion com fallback para Supabase.
 */

import { supabase } from "@/integrations/supabase/client";
import type { PageDwellMatrix } from "./canonical-matrix";

export type MetricsDriverType = "local_buffer" | "supabase_optimized" | "upstash_redis";
export type ErrorLogsDriverType = "local_buffer" | "supabase_optimized" | "axiom";

export interface ObservabilityMulticloudConfig {
  metricsDriver: MetricsDriverType;
  errorLogsDriver: ErrorLogsDriverType;
  samplingRatePercent: number; // 1 a 100
  upstashRestUrl?: string;
  upstashRestToken?: string;
  axiomDataset?: string;
  axiomToken?: string;
}

const CONFIG_STORAGE_KEY = "therapy-flow.observabilityConfig";

const isTestEnv =
  (typeof process !== "undefined" && process.env?.NODE_ENV === "test") ||
  (typeof import.meta !== "undefined" && import.meta.env?.MODE === "test");

let inMemoryConfig: ObservabilityMulticloudConfig | null = null;

/**
 * Retorna a configuração atual dos drivers multicloud de observabilidade.
 */
export function getObservabilityMulticloudConfig(): ObservabilityMulticloudConfig {
  if (inMemoryConfig) {
    return inMemoryConfig;
  }

  const envUrl =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_UPSTASH_REDIS_REST_URL
      ? String(import.meta.env.VITE_UPSTASH_REDIS_REST_URL)
      : undefined;

  const envToken =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_UPSTASH_REDIS_REST_TOKEN
      ? String(import.meta.env.VITE_UPSTASH_REDIS_REST_TOKEN)
      : undefined;

  const envAxiomDataset =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_AXIOM_DATASET
      ? String(import.meta.env.VITE_AXIOM_DATASET)
      : undefined;

  const envAxiomToken =
    typeof import.meta !== "undefined" && import.meta.env?.VITE_AXIOM_TOKEN
      ? String(import.meta.env.VITE_AXIOM_TOKEN)
      : undefined;

  let stored: Partial<ObservabilityMulticloudConfig> = {};
  if (typeof window !== "undefined" && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(CONFIG_STORAGE_KEY);
      if (raw) {
        stored = JSON.parse(raw);
      }
    } catch {
      // Ignora falha de parse
    }
  }

  inMemoryConfig = {
    metricsDriver: stored.metricsDriver || "upstash_redis",
    errorLogsDriver: stored.errorLogsDriver || (isTestEnv ? "supabase_optimized" : "axiom"),
    samplingRatePercent: stored.samplingRatePercent ?? 100,
    upstashRestUrl: stored.upstashRestUrl || envUrl,
    upstashRestToken: stored.upstashRestToken || envToken,
    axiomDataset: stored.axiomDataset || envAxiomDataset,
    axiomToken: stored.axiomToken || envAxiomToken,
  };

  return inMemoryConfig;
}

/**
 * Atualiza e persiste parcialmente a configuração de observabilidade.
 */
export function setObservabilityMulticloudConfig(
  partial: Partial<ObservabilityMulticloudConfig>
): ObservabilityMulticloudConfig {
  const current = getObservabilityMulticloudConfig();
  inMemoryConfig = {
    ...current,
    ...partial,
  };

  if (typeof window !== "undefined" && window.localStorage) {
    try {
      window.localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(inMemoryConfig));
    } catch (e) {
      console.warn("[MulticloudDrivers] Erro ao persistir config no localStorage:", e);
    }
  }

  return inMemoryConfig;
}

/**
 * Despacha incremento de métricas e permanência para Upstash Redis via Edge Function segura `platform-observability`.
 */
export async function dispatchMatrixToUpstash(
  userId: string,
  clinicId: string | null,
  matrix: PageDwellMatrix,
  counters: Record<string, number>
): Promise<boolean> {
  const hasMatrix = Object.values(matrix).some((v) => typeof v === "number" && v > 0);
  const hasCounters = Object.values(counters).some((v) => typeof v === "number" && v > 0);
  if (!hasMatrix && !hasCounters) {
    return true;
  }

  // Rota exclusiva via Edge Function segura (Pulumi ESC secrets no servidor, zero tokens no browser)
  try {
    const { data, error } = await supabase.functions.invoke("platform-observability", {
      body: {
        action: "ingest_telemetry",
        clinicId,
        matrix,
        counters,
      },
    });
    return Boolean(!error && data?.ok);
  } catch {
    return false;
  }
}

/**
 * Despacha log de erro estruturado para Axiom via Edge Function segura `platform-observability`.
 */
export async function dispatchErrorToAxiom(payload: Record<string, unknown>): Promise<boolean> {
  try {
    const { data, error } = await supabase.functions.invoke("platform-observability", {
      body: {
        action: "ingest_error",
        ...payload,
      },
    });
    return Boolean(!error && data?.ok);
  } catch {
    return false;
  }
}
