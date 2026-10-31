/**
 * Cliente de Consulta e Agregação Direta Upstash Redis
 * Permite buscar métricas de telemetria, contadores instantâneos e matrizes de permanência sem tocar no Supabase.
 */

import { getObservabilityMulticloudConfig } from "./multicloud-drivers";

export interface UpstashUserTelemetry {
  pageViews: number;
  printsDetected: number;
  docsPrinted: number;
  pdfExported: number;
  clinicalRecordsSaved: number;
  formsCompleted: number;
  dwellTimeSeconds: number;
  pageDwellMatrix: Record<string, number>;
}

export interface UpstashClinicTelemetry {
  pageViews: number;
  printsDetected: number;
  docsPrinted: number;
  pdfExported: number;
  dwellTimeSeconds: number;
  pageDwellMatrix: Record<string, number>;
}

/**
 * Converte array plano do Redis HGETALL em objeto chave-valor.
 */
function parseHashResult(arr: unknown[]): Record<string, number> {
  const result: Record<string, number> = {};
  if (!Array.isArray(arr)) return result;

  for (let i = 0; i < arr.length; i += 2) {
    const key = String(arr[i]);
    const val = Number(arr[i + 1]) || 0;
    result[key] = val;
  }
  return result;
}

/**
 * Consulta a telemetria em tempo real de um usuário específico no Upstash Redis.
 */
export async function queryUpstashUserTelemetry(userId: string): Promise<UpstashUserTelemetry | null> {
  const config = getObservabilityMulticloudConfig();
  const url = config.upstashRestUrl;
  const token = config.upstashRestToken;

  if (!url || !token || !userId) {
    return null;
  }

  const pipeline = [
    ["HGETALL", `telemetry:user:${userId}`],
    ["HGETALL", `telemetry:user:${userId}:counters`],
  ];

  try {
    const pipelineUrl = url.endsWith("/") ? `${url}pipeline` : `${url}/pipeline`;
    const res = await fetch(pipelineUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
    });

    if (!res.ok) {
      console.warn("[UpstashClient] Falha HTTP ao consultar telemetria de usuário:", res.status);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length < 2) {
      return null;
    }

    const dwellRaw = Array.isArray(data[0]?.result) ? (data[0].result as unknown[]) : [];
    const countersRaw = Array.isArray(data[1]?.result) ? (data[1].result as unknown[]) : [];

    const pageDwellMatrix = parseHashResult(dwellRaw);
    const counters = parseHashResult(countersRaw);

    let totalDwell = 0;
    Object.values(pageDwellMatrix).forEach((sec) => {
      totalDwell += sec;
    });

    return {
      pageViews: counters.pageViews || 0,
      printsDetected: counters.printsDetected || 0,
      docsPrinted: counters.docsPrinted || 0,
      pdfExported: counters.pdfExported || 0,
      clinicalRecordsSaved: counters.clinicalRecordsSaved || 0,
      formsCompleted: counters.formsCompleted || 0,
      dwellTimeSeconds: totalDwell || counters.dwellTimeSeconds || 0,
      pageDwellMatrix,
    };
  } catch (err) {
    console.warn("[UpstashClient] Exceção ao consultar telemetria do usuário:", err);
    return null;
  }
}

/**
 * Consulta a telemetria em tempo real de uma clínica no Upstash Redis.
 */
export async function queryUpstashClinicTelemetry(clinicId: string): Promise<UpstashClinicTelemetry | null> {
  const config = getObservabilityMulticloudConfig();
  const url = config.upstashRestUrl;
  const token = config.upstashRestToken;

  if (!url || !token || !clinicId) {
    return null;
  }

  const pipeline = [
    ["HGETALL", `telemetry:clinic:${clinicId}`],
  ];

  try {
    const pipelineUrl = url.endsWith("/") ? `${url}pipeline` : `${url}/pipeline`;
    const res = await fetch(pipelineUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(pipeline),
    });

    if (!res.ok) {
      console.warn("[UpstashClient] Falha HTTP ao consultar telemetria da clínica:", res.status);
      return null;
    }

    const data = await res.json();
    if (!Array.isArray(data) || !data[0]) {
      return null;
    }

    const dwellRaw = Array.isArray(data[0]?.result) ? (data[0].result as unknown[]) : [];
    const pageDwellMatrix = parseHashResult(dwellRaw);

    let totalDwell = 0;
    Object.values(pageDwellMatrix).forEach((sec) => {
      totalDwell += sec;
    });

    return {
      pageViews: 0,
      printsDetected: 0,
      docsPrinted: 0,
      pdfExported: 0,
      dwellTimeSeconds: totalDwell,
      pageDwellMatrix,
    };
  } catch (err) {
    console.warn("[UpstashClient] Exceção ao consultar telemetria da clínica:", err);
    return null;
  }
}
