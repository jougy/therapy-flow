import type { SupabaseClient } from '@supabase/supabase-js';

export type InstanceStatus =
  | 'disconnected'
  | 'qr_ready'
  | 'connecting'
  | 'connected'
  | 'circuit_broken'
  | 'banned';

export interface RouterInstanceRecord {
  id: string;
  instance_key: string;
  phone_e164: string;
  status: InstanceStatus;
  health_score: number;
  daily_limit: number;
  daily_sent_count: number;
  total_sent_lifetime?: number;
  anti_ban_config?: Record<string, unknown> | null;
}

interface InstanceHealthStats {
  attempts: number;
  failures: number;
  consecutiveFailures: number;
}

const MAX_STICKY_CACHE_ENTRIES = 10_000;

/**
 * Calcula o peso UltraSender de um chip: (daily_limit - daily_sent_count) * health_score.
 * Retorna 0 para chips inelegíveis (banidos, circuit_broken, desconectados ou sem cota).
 */
export function computeInstanceWeight(instance: RouterInstanceRecord): number {
  if (instance.status !== 'connected') return 0;
  const remaining = Math.max(0, instance.daily_limit - instance.daily_sent_count);
  if (remaining <= 0) return 0;
  const health = Math.max(1, Math.min(100, instance.health_score));
  return remaining * health;
}

/**
 * Seleção pura UltraSender com afinidade sticky por leadKey e fallback weighted round-robin.
 */
export function selectWeightedInstance(
  instances: RouterInstanceRecord[],
  leadKey: string,
  stickyMap: Map<string, string>,
  randomFn: () => number = Math.random,
): RouterInstanceRecord | null {
  const eligible = instances.filter((inst) => computeInstanceWeight(inst) > 0);
  if (eligible.length === 0) return null;

  const stickyInstanceId = stickyMap.get(leadKey);
  if (stickyInstanceId) {
    const stickyMatch = eligible.find((inst) => inst.id === stickyInstanceId);
    if (stickyMatch) return stickyMatch;
    stickyMap.delete(leadKey);
  }

  let totalWeight = 0;
  const weighted: Array<{ instance: RouterInstanceRecord; weight: number }> = [];
  for (const inst of eligible) {
    const weight = computeInstanceWeight(inst);
    totalWeight += weight;
    weighted.push({ instance: inst, weight });
  }

  if (totalWeight <= 0) return null;

  let cursor = randomFn() * totalWeight;
  let chosen = weighted[weighted.length - 1].instance;
  for (const entry of weighted) {
    cursor -= entry.weight;
    if (cursor <= 0) {
      chosen = entry.instance;
      break;
    }
  }

  if (stickyMap.size >= MAX_STICKY_CACHE_ENTRIES) {
    const oldestKey = stickyMap.keys().next().value;
    if (oldestKey) stickyMap.delete(oldestKey);
  }
  stickyMap.set(leadKey, chosen.id);
  return chosen;
}

export class MultiChipRouter {
  private readonly stickyMap = new Map<string, string>();
  private readonly statsMap = new Map<string, InstanceHealthStats>();

  getStickyMapSize(): number {
    return this.stickyMap.size;
  }

  async loadPoolInstances(
    supabase: SupabaseClient,
    instanceIds: string[],
  ): Promise<RouterInstanceRecord[]> {
    if (instanceIds.length === 0) return [];
    const { data, error } = await supabase
      .from('marketing_whatsapp_instances')
      .select('id, instance_key, phone_e164, status, health_score, daily_limit, daily_sent_count, total_sent_lifetime, anti_ban_config')
      .in('id', instanceIds)
      .is('deleted_at', null);

    if (error || !data) return [];
    return data as RouterInstanceRecord[];
  }

  pickInstanceForLead(
    instances: RouterInstanceRecord[],
    leadKey: string,
  ): RouterInstanceRecord | null {
    return selectWeightedInstance(instances, leadKey, this.stickyMap);
  }

  async tripCircuitBreaker(
    supabase: SupabaseClient,
    instanceId: string,
    reason: string,
  ): Promise<void> {
    await supabase
      .from('marketing_whatsapp_instances')
      .update({
        status: 'circuit_broken',
        last_error: reason.slice(0, 500),
      })
      .eq('id', instanceId);

    await supabase
      .from('marketing_zap_campaigns')
      .update({ status: 'circuit_broken' })
      .eq('instance_id', instanceId)
      .in('status', ['running', 'scheduled']);
  }

  async recordDispatchOutcome(
    supabase: SupabaseClient,
    instance: RouterInstanceRecord,
    success: boolean,
    errorMessage?: string,
  ): Promise<{ trippedCircuitBreaker: boolean }> {
    const current = this.statsMap.get(instance.id) ?? {
      attempts: 0,
      failures: 0,
      consecutiveFailures: 0,
    };
    current.attempts += 1;

    if (success) {
      current.consecutiveFailures = 0;
      this.statsMap.set(instance.id, current);

      const nextDaily = instance.daily_sent_count + 1;
      const nextLifetime = (instance.total_sent_lifetime ?? 0) + 1;
      await supabase
        .from('marketing_whatsapp_instances')
        .update({
          daily_sent_count: nextDaily,
          total_sent_lifetime: nextLifetime,
          last_error: null,
        })
        .eq('id', instance.id);

      return { trippedCircuitBreaker: false };
    }

    current.failures += 1;
    current.consecutiveFailures += 1;
    this.statsMap.set(instance.id, current);

    const antiBan = (instance.anti_ban_config || {}) as Record<string, unknown>;
    const thresholdPct = Math.max(2, Math.min(50, Number(antiBan.circuit_breaker_error_pct ?? 5)));
    const errorPct = (current.failures / Math.max(1, current.attempts)) * 100;
    const shouldTrip =
      current.consecutiveFailures >= 3 ||
      (current.attempts >= 10 && errorPct >= thresholdPct);

    if (shouldTrip) {
      const reason = `Auto circuit breaker: ${current.failures}/${current.attempts} falhas (${errorPct.toFixed(1)}%). Último erro: ${errorMessage || 'desconhecido'}`;
      await this.tripCircuitBreaker(supabase, instance.id, reason);
      return { trippedCircuitBreaker: true };
    }

    if (errorMessage) {
      await supabase
        .from('marketing_whatsapp_instances')
        .update({ last_error: errorMessage.slice(0, 500) })
        .eq('id', instance.id);
    }

    return { trippedCircuitBreaker: false };
  }
}
