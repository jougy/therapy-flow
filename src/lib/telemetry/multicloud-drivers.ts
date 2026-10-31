/**
 * Drivers Multicloud de Telemetria e Observabilidade
 * Suporte a Upstash Redis (Serverless Key-Value) e Axiom Cloud Ingestion com fallback para Supabase.
 */

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
    metricsDriver: stored.metricsDriver || "supabase_optimized",
    errorLogsDriver: stored.errorLogsDriver || (isTestEnv ? "supabase_optimized" : "local_buffer"),
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
 * Despacha incremento de métricas e permanência para Upstash Redis via REST pipeline.
 */
export async function dispatchMatrixToUpstash(
  userId: string,
  clinicId: string | null,
  matrix: PageDwellMatrix,
  counters: Record<string, number>
): Promise<boolean> {
  const config = getObservabilityMulticloudConfig();
  const url = config.upstashRestUrl;
  const token = config.upstashRestToken;

  if (!url || !token) {
    return false;
  }

  const commands: Array<[string, ...Array<string | number>]> = [];
  const safeUserId = userId || "anonymous";

  for (const [col, seconds] of Object.entries(matrix)) {
    if (typeof seconds === "number" && seconds > 0) {
      commands.push(["HINCRBY", `telemetry:user:${safeUserId}`, col, Math.round(seconds)]);
      if (clinicId) {
        commands.push(["HINCRBY", `telemetry:clinic:${clinicId}`, col, Math.round(seconds)]);
      }
    }
  }

  for (const [key, val] of Object.entries(counters)) {
    if (typeof val === "number" && val > 0) {
      commands.push(["HINCRBY", `telemetry:user:${safeUserId}:counters`, key, Math.round(val)]);
    }
  }

  if (commands.length === 0) {
    return true;
  }

  try {
    const pipelineUrl = url.endsWith("/") ? `${url}pipeline` : `${url}/pipeline`;
    const res = await fetch(pipelineUrl, {
      method: "POST",
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    });

    return res.ok;
  } catch (err) {
    console.warn("[MulticloudDrivers] Falha ao despachar métricas para Upstash:", err);
    return false;
  }
}

/**
 * Despacha log de erro estruturado para Axiom via ingest API.
 */
export async function dispatchErrorToAxiom(payload: Record<string, unknown>): Promise<boolean> {
  const config = getObservabilityMulticloudConfig();
  const dataset = config.axiomDataset;
  const token = config.axiomToken;

  if (!dataset || !token) {
    return false;
  }

  try {
    const res = await fetch(`https://api.axiom.co/v1/datasets/${dataset}/ingest`, {
      method: "POST",
      keepalive: true,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([payload]),
    });

    return res.ok;
  } catch (err) {
    console.warn("[MulticloudDrivers] Falha ao despachar erro para Axiom:", err);
    return false;
  }
}
