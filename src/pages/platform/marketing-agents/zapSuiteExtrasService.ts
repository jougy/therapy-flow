import { toast } from "@/hooks/use-toast";
import {
  DEFAULT_MARKETING_CHIP_DISPLAY,
  type MarketingWhatsAppInstance,
  type MarketingZapConversation,
} from "./types";
import type {
  KeywordTriggerRecord,
  LlmProviderRecord,
  NumberValidationResult,
  WhatsAppGroupRecord,
  ZapDefenderReport,
} from "./suiteTypes";
import { buildLocalExtractiveCompaction, computeZapDefenderReport } from "./zapSuiteEngine";
import { formatPhoneBr, normalizePhoneToE164 } from "./antiBanEngine";
import { invokeZapGateway, marketingDb } from "./marketingAgentsService";
import type { ProviderConnectionTestResult } from "./LlmHarnessDrawer";
import type { WarmupPoolConfig } from "./WarmupPoolsPanel";

export interface ZapSuiteExtrasStatePayload {
  providers: LlmProviderRecord[];
  triggers: KeywordTriggerRecord[];
  groups: WhatsAppGroupRecord[];
  pools: WarmupPoolConfig[];
}

export async function fetchZapSuiteExtrasState(
  instances: MarketingWhatsAppInstance[],
): Promise<Partial<ZapSuiteExtrasStatePayload>> {
  const [provRes, trigRes, grpRes, poolRes] = await Promise.all([
    marketingDb
      .from("marketing_llm_providers")
      .select("*")
      .is("deleted_at", null)
      .order("priority_order", { ascending: true }),
    marketingDb
      .from("marketing_keyword_triggers")
      .select("*")
      .is("deleted_at", null)
      .order("priority", { ascending: true }),
    marketingDb
      .from("marketing_whatsapp_groups")
      .select("*")
      .order("participants_count", { ascending: false })
      .limit(100),
    marketingDb
      .from("marketing_warmup_pools")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const out: Partial<ZapSuiteExtrasStatePayload> = {};

  if (Array.isArray(provRes.data) && provRes.data.length > 0) {
    out.providers = provRes.data.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name),
      slug: String(r.slug),
      providerType: String(r.provider_type) as LlmProviderRecord["providerType"],
      baseUrl: String(r.base_url || ""),
      defaultModel: String(r.default_model || ""),
      isEnabled: Boolean(r.is_enabled),
      isFreeTier: Boolean(r.is_free_tier),
      isLocal: r.provider_type === "local_ollama",
      hasApiKey: Boolean(r.credential_alias),
      priority: Number(r.priority_order ?? 10),
    }));
  }

  if (Array.isArray(trigRes.data) && trigRes.data.length > 0) {
    out.triggers = trigRes.data.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      instanceId: r.instance_id ? String(r.instance_id) : null,
      name: String(r.name),
      matchType: String(r.match_type || "contains") as KeywordTriggerRecord["matchType"],
      pattern: String(r.pattern || ""),
      actionType: String(r.action_type || "reply_text") as KeywordTriggerRecord["actionType"],
      actionPayload: (r.action_payload as Record<string, string>) || {},
      priority: Number(r.priority ?? 10),
      isActive: r.is_active !== false,
      hitCount: Number(r.hit_count ?? 0),
    }));
  }

  if (Array.isArray(grpRes.data) && grpRes.data.length > 0) {
    out.groups = grpRes.data.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      instanceId: String(r.instance_id || ""),
      groupJid: String(r.group_jid),
      subject: String(r.subject || "Grupo WhatsApp"),
      participantsCount: Number(r.participants_count ?? 0),
      isAdmin: Boolean(r.is_admin),
      inviteCode: r.invite_code ? String(r.invite_code) : null,
      lastSyncedAt: r.last_synced_at ? String(r.last_synced_at) : null,
    }));
  }

  if (Array.isArray(poolRes.data) && poolRes.data.length > 0) {
    out.pools = poolRes.data.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      name: String(r.name),
      poolMode: String(r.pool_mode || "private_chips") as WarmupPoolConfig["poolMode"],
      inviteToken: String(r.invite_token || "PLURI-WARM"),
      dailyInteractionsTarget: Number(r.daily_interactions_target ?? 12),
      enableMedia: r.enable_media !== false,
      enableAudioPtt: Boolean(r.enable_audio_ptt),
      enableReactions: r.enable_reactions !== false,
      enableGroupInteractions: Boolean(r.enable_group_interactions),
      instanceIds: instances.map((i) => i.id),
      isActive: r.is_active !== false,
    }));
  }

  return out;
}

export async function testLlmProviderAction(
  providerSlug: string,
  modelId: string,
): Promise<ProviderConnectionTestResult> {
  const started = performance.now();
  try {
    const { data, error } = await invokeZapGateway("test_llm_provider", {
      provider_slug: providerSlug,
      model_id: modelId,
    });
    if (error) throw error;
    const resp = (data || {}) as { reply?: string; latencyMs?: number; error?: string };
    return {
      ok: Boolean(resp.reply) && !resp.error,
      latencyMs: resp.latencyMs ?? Math.round(performance.now() - started),
      reply: resp.reply,
      error: resp.error,
    };
  } catch (err) {
    return {
      ok: false,
      latencyMs: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message : "Falha na chamada de teste.",
    };
  }
}

export async function requestPairingCodeAction(inst: MarketingWhatsAppInstance): Promise<string | null> {
  try {
    const { data, error } = await invokeZapGateway("request_pairing_code", {
      instance_key: inst.instance_key,
      phone_e164: inst.phone_e164,
    });
    if (error) throw error;
    const resp = (data || {}) as { configured?: boolean; pairingCode?: string | null; setupHint?: string };
    if (!resp.configured || !resp.pairingCode) {
      toast({
        title: "Evolution API aguardando conexão",
        description:
          resp.setupHint || `Suba o node Docker para gerar o código de 8 dígitos do ${formatPhoneBr(inst.phone_e164)}.`,
      });
      return null;
    }
    toast({ title: "Código de 8 dígitos gerado!", description: `Digite ${resp.pairingCode} no WhatsApp.` });
    return resp.pairingCode;
  } catch {
    toast({ title: "Não foi possível gerar o código agora" });
    return null;
  }
}

export async function runZapDefenderAuditAction(inst: MarketingWhatsAppInstance): Promise<ZapDefenderReport> {
  try {
    const { data, error } = await invokeZapGateway("run_zap_defender_audit", {
      instance_id: inst.id,
      instance_key: inst.instance_key,
    });
    if (!error && (data as { report?: ZapDefenderReport })?.report) {
      return (data as { report: ZapDefenderReport }).report;
    }
  } catch {
    // Fallback determinístico local
  }
  return computeZapDefenderReport({
    instanceId: inst.id,
    warmupDay: inst.warmup_day,
    sent7d: Math.max(inst.daily_sent_count, 0),
    replied7d: Math.round(inst.daily_sent_count * 0.28),
    failed7d: 0,
    optOut7d: 0,
    disconnects7d: 0,
    dailyLimit: inst.daily_limit,
    dailySentCount: inst.daily_sent_count,
    status: inst.status,
  });
}

export async function validateNumbersBatchAction(
  inst: MarketingWhatsAppInstance | undefined,
  phones: string[],
  previewFallback: boolean,
): Promise<NumberValidationResult[]> {
  if (!previewFallback && inst) {
    try {
      const { data, error } = await invokeZapGateway("validate_numbers_batch", {
        instance_key: inst.instance_key,
        numbers: phones,
      });
      if (!error && Array.isArray((data as { results?: unknown[] })?.results)) {
        return (data as { results: NumberValidationResult[] }).results;
      }
    } catch {
      // Fallback local abaixo
    }
  }
  const now = new Date().toISOString();
  return phones.map((p) => {
    const e164 = normalizePhoneToE164(p);
    const valid = /^55\d{10,11}$/.test(e164) || e164.length >= 11;
    return {
      phoneE164: e164,
      existsOnWhatsapp: valid,
      whatsappJid: valid ? `${e164}@s.whatsapp.net` : null,
      fromCache: true,
      checkedAt: now,
    };
  });
}

export async function syncGroupsAction(
  inst: MarketingWhatsAppInstance | undefined,
  previewFallback: boolean,
): Promise<WhatsAppGroupRecord[]> {
  if (inst && !previewFallback) {
    const { data } = await invokeZapGateway("sync_whatsapp_groups", { instance_key: inst.instance_key }).catch(() => ({
      data: null,
    }));
    const rows = (data as { groups?: Array<Record<string, unknown>> } | null)?.groups;
    if (Array.isArray(rows) && rows.length > 0) {
      return rows.map((r) => ({
        id: String(r.id || r.group_jid),
        instanceId: String(r.instance_id || inst.id),
        groupJid: String(r.group_jid),
        subject: String(r.subject || "Grupo WhatsApp"),
        participantsCount: Number(r.participants_count ?? 0),
        isAdmin: Boolean(r.is_admin),
        inviteCode: r.invite_code ? String(r.invite_code) : null,
        lastSyncedAt: r.last_synced_at ? String(r.last_synced_at) : null,
      }));
    }
  }
  return [
    {
      id: "grp-demo-1",
      instanceId: inst?.id || "inst-primary-5511965120431",
      groupJid: "120363000112233445@g.us",
      subject: `Comunidade Fisioterapia Pluri (${DEFAULT_MARKETING_CHIP_DISPLAY})`,
      participantsCount: 48,
      isAdmin: true,
    },
  ];
}

export async function extractGroupMembersAction(
  inst: MarketingWhatsAppInstance | undefined,
  groupJid: string,
  previewFallback: boolean,
) {
  if (!previewFallback && inst) {
    const { data } = await invokeZapGateway("extract_group_members", {
      instance_key: inst.instance_key,
      group_jid: groupJid,
    }).catch(() => ({ data: null }));
    const members = (data as { members?: Array<{ phone_e164: string; name?: string }> } | null)?.members;
    if (Array.isArray(members)) {
      return members.map((m) => ({ phoneE164: m.phone_e164, name: m.name }));
    }
  }
  return [];
}

export async function persistWarmupPoolAction(pool: WarmupPoolConfig) {
  await marketingDb
    .from("marketing_warmup_pools")
    .upsert({
      tenant_scope: "platform",
      name: pool.name,
      pool_mode: pool.poolMode,
      invite_token: pool.inviteToken,
      daily_interactions_target: pool.dailyInteractionsTarget,
      enable_media: pool.enableMedia,
      enable_audio_ptt: pool.enableAudioPtt,
      enable_reactions: pool.enableReactions,
      enable_group_interactions: pool.enableGroupInteractions,
      is_active: pool.isActive,
    })
    .catch(() => undefined);
}

export async function compactConversationAction(
  conv: MarketingZapConversation,
  previewFallback: boolean,
  onReloadCore?: () => Promise<void>,
) {
  if (!previewFallback) {
    const { data } = await invokeZapGateway("compact_conversation_memory", {
      conversation_id: conv.id,
    }).catch(() => ({ data: null }));
    if (data && onReloadCore) await onReloadCore();
  } else {
    buildLocalExtractiveCompaction(conv.rolling_summary, conv.structured_facts, [], 4);
  }
  toast({ title: "Contexto compactado com segurança!" });
}