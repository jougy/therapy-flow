/**
 * Helpers de Telemetria Híbrida de Afiliados (Upstash Redis + Axiom Cloud)
 * SSOT: core/Pluri-Health/10 - Produto/Marketing de Afiliados/04 - Telemetria e Observabilidade.md
 */
import { getObservabilityMulticloudConfig } from "./multicloud-drivers";

export interface AffiliateTelemetryData {
  slug: string;
  clicksCount: number;
  trialLeadsCount: number;
  activeSubscribersCount: number;
  churnCount: number;
  lifetimeCommissionCents: number;
  availableBalanceCents: number;
  retainedBalanceCents: number;
  overdueGraceDaysRemaining: number;
  conversionRatePercent: number;
  churnRatePercent: number;
}

export interface AffiliateTelemetryOptions {
  lifetimeCommissionCents?: number;
  availableBalanceCents?: number;
  retainedBalanceCents?: number;
  overdueGraceDaysRemaining?: number;
  initialClicks?: number;
  initialTrials?: number;
  initialActives?: number;
  initialChurn?: number;
}

/** Consulta contadores em tempo real no Upstash Redis (HGET affiliate:clicks <slug>) */
export async function fetchAffiliateClicks(slug: string): Promise<number> {
  if (!slug || typeof slug !== "string") return 0;
  const { upstashRestUrl: url, upstashRestToken: token } = getObservabilityMulticloudConfig();
  if (!url || !token) return 0;

  try {
    const pipelineUrl = url.endsWith("/") ? `${url}pipeline` : `${url}/pipeline`;
    const res = await fetch(pipelineUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([["HGET", "affiliate:clicks", slug.trim().toLowerCase()]]),
    });
    if (!res.ok) return 0;
    const data = await res.json();
    const rawVal = Array.isArray(data) ? data[0]?.result : (data as { result?: unknown })?.result;
    const parsed = Number(rawVal);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

/** Consulta agregada no Axiom via APL para métricas de conversão e churn */
export async function fetchAffiliateAxiomMetrics(
  slug: string
): Promise<{ trialLeads: number; activeSubscribers: number; churn: number }> {
  const fallback = { trialLeads: 0, activeSubscribers: 0, churn: 0 };
  if (!slug) return fallback;
  const { axiomDataset: dataset, axiomToken: token } = getObservabilityMulticloudConfig();
  if (!dataset || !token) return fallback;

  const cleanSlug = slug.replace(/'/g, "\\'").trim().toLowerCase();
  const apl = `['${dataset}'] | where affiliate_slug == '${cleanSlug}' or context.affiliate_slug == '${cleanSlug}' | limit 200`;

  try {
    const res = await fetch("https://api.axiom.co/v1/datasets/_apl?format=tabular", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ apl }),
    });
    if (!res.ok) return fallback;
    const data = await res.json();
    if (!data.tables?.[0]) return fallback;

    const { fields, columns } = data.tables[0];
    const eventIdx = fields.findIndex((f: { name: string }) => f.name === "event_type");
    const rowCount = columns?.[0]?.length || 0;

    let trialLeads = 0;
    let activeSubscribers = 0;
    let churn = 0;

    for (let r = 0; r < rowCount; r++) {
      const et = String(columns[eventIdx]?.[r] || "").toLowerCase();
      if (et.includes("trial") || et.includes("lead")) trialLeads++;
      else if (et.includes("active") || et.includes("conversion") || et.includes("subscription_paid")) activeSubscribers++;
      else if (et.includes("churn") || et.includes("cancel")) churn++;
    }
    return { trialLeads, activeSubscribers, churn };
  } catch {
    return fallback;
  }
}

/** Consolida Upstash, Axiom e dados financeiros desacoplados do Supabase */
export async function getConsolidatedAffiliateTelemetry(
  slug: string,
  options: AffiliateTelemetryOptions = {}
): Promise<AffiliateTelemetryData> {
  const [redisClicks, axiomMetrics] = await Promise.all([
    fetchAffiliateClicks(slug),
    fetchAffiliateAxiomMetrics(slug),
  ]);

  const clicksCount = redisClicks || options.initialClicks || 0;
  const trialLeadsCount = axiomMetrics.trialLeads || options.initialTrials || 0;
  const activeSubscribersCount = axiomMetrics.activeSubscribers || options.initialActives || 0;
  const churnCount = axiomMetrics.churn || options.initialChurn || 0;

  const conversionRatePercent = clicksCount > 0
    ? Math.min(100, Math.round((activeSubscribersCount / clicksCount) * 1000) / 10)
    : 0;

  const totalSubs = activeSubscribersCount + churnCount;
  const churnRatePercent = totalSubs > 0
    ? Math.min(100, Math.round((churnCount / totalSubs) * 1000) / 10)
    : 0;

  return {
    slug,
    clicksCount,
    trialLeadsCount,
    activeSubscribersCount,
    churnCount,
    lifetimeCommissionCents: options.lifetimeCommissionCents ?? 0,
    availableBalanceCents: options.availableBalanceCents ?? 0,
    retainedBalanceCents: options.retainedBalanceCents ?? 0,
    overdueGraceDaysRemaining: options.overdueGraceDaysRemaining ?? 40,
    conversionRatePercent,
    churnRatePercent,
  };
}
