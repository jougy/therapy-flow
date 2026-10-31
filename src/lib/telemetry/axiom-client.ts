/**
 * Cliente de Consulta e Ingestão Direta Axiom Cloud
 * Permite buscar logs, erros de runtime e traces no dataset pluri-health-logs sem tocar no Supabase.
 */

import { getObservabilityMulticloudConfig } from "./multicloud-drivers";

export interface AxiomLogRecord {
  id: string;
  _time: string;
  _sysTime?: string;
  environment?: string;
  service?: string;
  event_type?: string;
  scope?: string;
  message?: string;
  stack?: string;
  context?: Record<string, unknown>;
  route?: string;
  clinic_id?: string;
  user_id?: string;
  [key: string]: unknown;
}

export interface AxiomQueryParams {
  limit?: number;
  scope?: string;
  eventType?: string;
  search?: string;
  clinicId?: string;
  userId?: string;
  service?: string;
}

/**
 * Executa uma consulta APL no Axiom e retorna os registros mapeados.
 */
export async function queryAxiomLogs(params: AxiomQueryParams = {}): Promise<AxiomLogRecord[]> {
  const config = getObservabilityMulticloudConfig();
  const dataset = config.axiomDataset;
  const token = config.axiomToken;

  if (!dataset || !token) {
    return [];
  }

  const limit = Math.min(params.limit || 100, 250);
  const filters: string[] = [];

  if (params.service) {
    filters.push(`service == '${params.service}'`);
  }
  if (params.eventType && params.eventType !== "all") {
    filters.push(`event_type == '${params.eventType}'`);
  }
  if (params.scope && params.scope !== "all") {
    filters.push(`scope == '${params.scope}'`);
  }
  if (params.clinicId) {
    filters.push(`clinic_id == '${params.clinicId}'`);
  }
  if (params.userId) {
    filters.push(`user_id == '${params.userId}'`);
  }
  if (params.search && params.search.trim()) {
    const cleanSearch = params.search.replace(/'/g, "\\'");
    filters.push(`(message contains '${cleanSearch}' or scope contains '${cleanSearch}' or route contains '${cleanSearch}')`);
  }

  const whereClause = filters.length > 0 ? `| where ${filters.join(" and ")}` : "";
  const apl = `['${dataset}'] ${whereClause} | sort by _time desc | limit ${limit}`;

  try {
    const res = await fetch("https://api.axiom.co/v1/datasets/_apl?format=tabular", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ apl }),
    });

    if (!res.ok) {
      console.warn("[AxiomClient] Erro ao consultar Axiom:", res.status, res.statusText);
      return [];
    }

    const data = await res.json();
    if (!data.tables || !data.tables[0]) {
      return [];
    }

    const table = data.tables[0];
    const fields: string[] = table.fields.map((f: { name: string }) => f.name);
    const columns: unknown[][] = table.columns || [];
    const rowCount = columns[0]?.length || 0;

    const records: AxiomLogRecord[] = [];
    for (let r = 0; r < rowCount; r++) {
      const item: Record<string, unknown> = {};
      fields.forEach((fieldName, colIdx) => {
        item[fieldName] = columns[colIdx]?.[r];
      });

      records.push({
        id: (item.id as string) || (item._sysTime as string) || (item._time as string) || `${Date.now()}-${r}`,
        _time: (item._time as string) || new Date().toISOString(),
        _sysTime: item._sysTime as string,
        environment: item.environment as string,
        service: item.service as string,
        event_type: item.event_type as string,
        scope: item.scope as string,
        message: item.message as string,
        stack: item.stack as string,
        context: typeof item.context === "object" && item.context !== null ? (item.context as Record<string, unknown>) : undefined,
        route: item.route as string,
        clinic_id: item.clinic_id as string,
        user_id: item.user_id as string,
      });
    }

    return records;
  } catch (err) {
    console.warn("[AxiomClient] Exceção ao consultar Axiom:", err);
    return [];
  }
}
