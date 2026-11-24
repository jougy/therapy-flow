import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_ANTI_BAN_CONFIG,
  DEFAULT_MARKETING_CHIP_DISPLAY,
  FALLBACK_DEFAULT_AGENTS,
  FALLBACK_PRIMARY_INSTANCE,
  type AgentSimulationTurn,
  type AntiBanConfig,
  type MarketingAiAgent,
  type MarketingOptOut,
  type MarketingWhatsAppInstance,
  type MarketingZapCampaign,
  type MarketingZapConversation,
} from "./types";
import {
  computeTypingDurationMs, formatPhoneBr, getWarmupDailyLimit, isOptOutMessage, normalizePhoneToE164,
} from "./antiBanEngine";
import { tryLocalBrowserOllamaReply } from "./llmHarnessStorage";

export const marketingDb = supabase as unknown as SupabaseClient;

export interface AgentDraftInput {
  id?: string;
  name: string;
  persona_role: string;
  instance_id: string | null;
  model_tier: MarketingAiAgent["model_tier"];
  llm_provider_id?: string | null;
  llm_model_id?: string | null;
  fallback_chain?: Array<{ providerSlug: string; modelId: string }>;
  disable_thinking?: boolean;
  auto_compact_context?: boolean;
  split_messages?: boolean;
  simulate_typing?: boolean;
  audio_reply_mode?: "never" | "match_user" | "always_ptt";
  system_prompt: string;
  knowledge_base: string;
  welcome_message: string;
  handoff_keywords: string[];
  handoff_phone: string;
  max_chars_per_reply: number;
  debounce_seconds: number;
  transcribe_audio: boolean;
  analyze_images: boolean;
  enable_semantic_cache: boolean;
}

export interface CampaignDraftInput {
  name: string;
  instance_id: string;
  agent_id: string | null;
  min_score: number;
  message_template: string;
  enable_ai_spintax: boolean;
  campaign_mode?: MarketingZapCampaign["campaign_mode"];
  instance_pool_ids?: string[];
  target_group_jids?: string[];
  media_payload?: Record<string, unknown>;
  require_turbo_filter?: boolean;
  parsed_contacts?: Array<{ phoneE164: string; name?: string; customVars?: Record<string, string> }>;
  audience_list_name?: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function asUuidOrNull(value?: string | null): string | null {
  return value && UUID_RE.test(value) ? value : null;
}

function isColumnMissingError(err: unknown): boolean {
  const msg = String((err as { message?: string; code?: string })?.message || "");
  const code = String((err as { code?: string })?.code || "");
  return code === "42703" || code === "PGRST204" || /column .* does not exist/i.test(msg);
}

function isSchemaMissingError(err: unknown): boolean {
  const msg = String((err as { message?: string; code?: string })?.message || "");
  const code = String((err as { code?: string })?.code || "");
  return code === "42P01" || code === "PGRST205" || /does not exist|schema cache/i.test(msg);
}

export async function invokeZapGateway(action: string, payload: Record<string, unknown>) {
  return supabase.functions.invoke(`marketing-zap-gateway?action=${encodeURIComponent(action)}`, {
    body: { action, ...payload },
  });
}

export async function fetchMarketingAgentsState() {
  const [instRes, agentRes, campRes, convRes, optRes, leadsCountRes] = await Promise.all([
    marketingDb
      .from("marketing_whatsapp_instances")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    marketingDb
      .from("marketing_ai_agents")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    marketingDb
      .from("marketing_zap_campaigns")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    marketingDb
      .from("marketing_zap_conversations")
      .select("*")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(50),
    marketingDb
      .from("marketing_opt_outs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    marketingDb
      .from("platform_auto_leads")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .not("phone", "is", null),
  ]);

  if (instRes.error && isSchemaMissingError(instRes.error)) {
    return {
      previewFallback: true,
      instances: [FALLBACK_PRIMARY_INSTANCE],
      agents: FALLBACK_DEFAULT_AGENTS,
      campaigns: [] as MarketingZapCampaign[],
      conversations: [] as MarketingZapConversation[],
      optOuts: [] as MarketingOptOut[],
      eligibleLeadsCount: leadsCountRes.count ?? 0,
    };
  }

  return {
    previewFallback: false,
    instances:
      Array.isArray(instRes.data) && instRes.data.length > 0
        ? (instRes.data as MarketingWhatsAppInstance[])
        : [FALLBACK_PRIMARY_INSTANCE],
    agents: Array.isArray(agentRes.data) ? (agentRes.data as MarketingAiAgent[]) : FALLBACK_DEFAULT_AGENTS,
    campaigns: Array.isArray(campRes.data) ? (campRes.data as MarketingZapCampaign[]) : [],
    conversations: Array.isArray(convRes.data) ? (convRes.data as MarketingZapConversation[]) : [],
    optOuts: Array.isArray(optRes.data) ? (optRes.data as MarketingOptOut[]) : [],
    eligibleLeadsCount: leadsCountRes.count ?? 0,
  };
}

export async function createPoolInstanceRecord(
  displayName: string,
  e164: string,
  previewFallback: boolean,
): Promise<{ instance?: MarketingWhatsAppInstance; error?: string }> {
  const instanceKey = `pluri-mkt-${e164}`;
  const now = new Date().toISOString();
  const base: MarketingWhatsAppInstance = {
    id: `inst-${Date.now()}`,
    tenant_scope: "platform",
    clinic_id: null,
    instance_key: instanceKey,
    display_name: displayName.trim() || `Chip Pool — ${formatPhoneBr(e164)}`,
    phone_e164: e164,
    provider: "evolution",
    role_type: "warmup_pool",
    status: "disconnected",
    health_score: 100,
    warmup_day: 1,
    daily_limit: 15,
    daily_sent_count: 0,
    anti_ban_config: DEFAULT_ANTI_BAN_CONFIG,
    created_at: now,
    updated_at: now,
  };

  if (previewFallback) return { instance: base };

  const { data, error } = await marketingDb
    .from("marketing_whatsapp_instances")
    .insert({
      tenant_scope: "platform",
      instance_key: base.instance_key,
      display_name: base.display_name,
      phone_e164: base.phone_e164,
      role_type: "warmup_pool",
    })
    .select("*")
    .single();

  if (error) return { error: error.message };
  return { instance: data as MarketingWhatsAppInstance };
}

export async function saveAgentRecord(
  draft: AgentDraftInput,
  previewFallback: boolean,
): Promise<{ agent?: MarketingAiAgent; isEdit: boolean; error?: string }> {
  const now = new Date().toISOString();
  const slugBase = draft.name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  if (draft.id) {
    if (previewFallback) {
      return {
        isEdit: true,
        agent: {
          ...FALLBACK_DEFAULT_AGENTS[0],
          ...draft,
          id: draft.id,
          updated_at: now,
        },
      };
    }

    const corePayload = {
      name: draft.name,
      persona_role: draft.persona_role,
      instance_id: draft.instance_id,
      model_tier: draft.model_tier,
      system_prompt: draft.system_prompt,
      knowledge_base: draft.knowledge_base,
      welcome_message: draft.welcome_message,
      handoff_keywords: draft.handoff_keywords,
      handoff_phone: normalizePhoneToE164(draft.handoff_phone),
      max_chars_per_reply: draft.max_chars_per_reply,
      debounce_seconds: draft.debounce_seconds,
      transcribe_audio: draft.transcribe_audio,
      analyze_images: draft.analyze_images,
      enable_semantic_cache: draft.enable_semantic_cache,
    };

    const extendedPayload = {
      ...corePayload,
      ...(draft.llm_provider_id !== undefined ? { llm_provider_id: asUuidOrNull(draft.llm_provider_id) } : {}),
      ...(draft.llm_model_id !== undefined ? { llm_model_id: draft.llm_model_id } : {}),
      ...(draft.fallback_chain !== undefined ? { fallback_chain: draft.fallback_chain } : {}),
      ...(draft.disable_thinking !== undefined ? { disable_thinking: draft.disable_thinking } : {}),
      ...(draft.auto_compact_context !== undefined ? { auto_compact_context: draft.auto_compact_context } : {}),
      ...(draft.split_messages !== undefined ? { split_messages: draft.split_messages } : {}),
      ...(draft.simulate_typing !== undefined ? { simulate_typing: draft.simulate_typing } : {}),
      ...(draft.audio_reply_mode !== undefined ? { audio_reply_mode: draft.audio_reply_mode } : {}),
    };

    let { data, error } = await marketingDb
      .from("marketing_ai_agents")
      .update(extendedPayload)
      .eq("id", draft.id)
      .select("*")
      .single();

    if (error && isColumnMissingError(error)) {
      const retry = await marketingDb
        .from("marketing_ai_agents")
        .update(corePayload)
        .eq("id", draft.id)
        .select("*")
        .single();
      data = retry.data;
      error = retry.error;
    }

    if (error) return { isEdit: true, error: error.message };
    return { isEdit: true, agent: data as MarketingAiAgent };
  }

  const newSlug = `${slugBase || "agente"}-${Date.now().toString(36)}`;
  if (previewFallback) {
    return {
      isEdit: false,
      agent: {
        ...draft,
        id: `agent-${Date.now()}`,
        tenant_scope: "platform",
        clinic_id: null,
        slug: newSlug,
        is_active: true,
        total_conversations: 0,
        total_handoffs: 0,
        created_at: now,
        updated_at: now,
      },
    };
  }

  const coreInsert = {
    tenant_scope: "platform",
    name: draft.name,
    slug: newSlug,
    persona_role: draft.persona_role,
    instance_id: draft.instance_id,
    model_tier: draft.model_tier,
    system_prompt: draft.system_prompt,
    knowledge_base: draft.knowledge_base,
    welcome_message: draft.welcome_message,
    handoff_keywords: draft.handoff_keywords,
    handoff_phone: normalizePhoneToE164(draft.handoff_phone),
    max_chars_per_reply: draft.max_chars_per_reply,
    debounce_seconds: draft.debounce_seconds,
    transcribe_audio: draft.transcribe_audio,
    analyze_images: draft.analyze_images,
    enable_semantic_cache: draft.enable_semantic_cache,
  };

  const extendedInsert = {
    ...coreInsert,
    ...(draft.llm_provider_id !== undefined ? { llm_provider_id: asUuidOrNull(draft.llm_provider_id) } : {}),
    ...(draft.llm_model_id !== undefined ? { llm_model_id: draft.llm_model_id } : {}),
    ...(draft.fallback_chain !== undefined ? { fallback_chain: draft.fallback_chain } : {}),
    ...(draft.disable_thinking !== undefined ? { disable_thinking: draft.disable_thinking } : {}),
    ...(draft.auto_compact_context !== undefined ? { auto_compact_context: draft.auto_compact_context } : {}),
    ...(draft.split_messages !== undefined ? { split_messages: draft.split_messages } : {}),
    ...(draft.simulate_typing !== undefined ? { simulate_typing: draft.simulate_typing } : {}),
    ...(draft.audio_reply_mode !== undefined ? { audio_reply_mode: draft.audio_reply_mode } : {}),
  };

  let { data, error } = await marketingDb
    .from("marketing_ai_agents")
    .insert(extendedInsert)
    .select("*")
    .single();

  if (error && isColumnMissingError(error)) {
    const retry = await marketingDb
      .from("marketing_ai_agents")
      .insert(coreInsert)
      .select("*")
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) return { isEdit: false, error: error.message };
  return { isEdit: false, agent: data as MarketingAiAgent };
}

export async function runAgentSimulationTurn(
  agent: MarketingAiAgent,
  trimmedMessage: string,
  override?: { providerSlug?: string; modelId?: string } | null,
): Promise<AgentSimulationTurn> {
  const optOut = isOptOutMessage(trimmedMessage);
  const handoff = agent.handoff_keywords.some((kw) => trimmedMessage.toLowerCase().includes(kw.toLowerCase()));
  const sysPrompt = `${agent.system_prompt}\n\nBase de conhecimento:\n${agent.knowledge_base}\n\nResponda em português do Brasil em até ${agent.max_chars_per_reply} caracteres.`;
  const preferredModel = override?.modelId || agent.llm_model_id || undefined;
  const wantsLocalOllama =
    override?.providerSlug === "ollama-local" || agent.llm_provider_id === "ollama-local" || agent.model_tier === "gemma-4-local";

  if (wantsLocalOllama && !optOut && !handoff) {
    const localHit = await tryLocalBrowserOllamaReply(sysPrompt, trimmedMessage, agent.max_chars_per_reply, preferredModel);
    if (localHit) {
      return {
        id: `turn-agent-${Date.now()}`, role: "agent", text: localHit.reply, intent: "product_question",
        modelUsed: localHit.modelUsed, typingMs: computeTypingDurationMs(localHit.reply),
        isOptOut: false, triggeredHandoff: false, createdAt: new Date().toISOString(),
      };
    }
  }

  try {
    const { data, error } = await invokeZapGateway("simulate_agent_reply", {
      message: trimmedMessage, model_tier: agent.model_tier, provider_slug: override?.providerSlug,
      model_id: preferredModel, disable_thinking: agent.disable_thinking ?? true,
      fallback_chain: agent.fallback_chain || [], instance_id: agent.instance_id,
      system_prompt: agent.system_prompt, knowledge_base: agent.knowledge_base,
      handoff_keywords: agent.handoff_keywords, max_chars_per_reply: agent.max_chars_per_reply,
    });

    if (!error && data && (data as { reply?: string }).reply) {
      const resp = data as {
        reply: string; intent?: string; modelUsed?: string; typingMs?: number; isOptOut?: boolean; triggeredHandoff?: boolean;
      };
      return {
        id: `turn-agent-${Date.now()}`, role: "agent", text: resp.reply, intent: resp.intent,
        modelUsed: resp.modelUsed, typingMs: resp.typingMs, isOptOut: resp.isOptOut,
        triggeredHandoff: resp.triggeredHandoff, createdAt: new Date().toISOString(),
      };
    }
  } catch {
    // Fallback para Ollama local antes do texto estático
  }

  if (!optOut && !handoff && !wantsLocalOllama) {
    const localFallback = await tryLocalBrowserOllamaReply(sysPrompt, trimmedMessage, agent.max_chars_per_reply, preferredModel);
    if (localFallback) {
      return {
        id: `turn-agent-${Date.now()}`, role: "agent", text: localFallback.reply, intent: "product_question",
        modelUsed: `${localFallback.modelUsed} (fallback local)`, typingMs: computeTypingDurationMs(localFallback.reply),
        isOptOut: false, triggeredHandoff: false, createdAt: new Date().toISOString(),
      };
    }
  }
  const fallbackText = optOut
    ? "Entendido! Removemos seu número da lista de envios imediatamente (LGPD Opt-Out)."
    : handoff
      ? `Perfeito! Encaminhando seu contato para nosso consultor humano no ${formatPhoneBr(agent.handoff_phone)}.`
      : `Olá! Recebemos sua mensagem no chip ${DEFAULT_MARKETING_CHIP_DISPLAY}. Como posso te ajudar com o Pluri Fisio hoje?`;

  return {
    id: `turn-agent-${Date.now()}`,
    role: "agent",
    text: fallbackText.slice(0, agent.max_chars_per_reply),
    intent: optOut ? "opt_out" : handoff ? "handoff_human" : "product_question",
    modelUsed: `${agent.model_tier} (simulação local)`,
    typingMs: computeTypingDurationMs(fallbackText),
    isOptOut: optOut,
    triggeredHandoff: handoff,
    createdAt: new Date().toISOString(),
  };
}

export async function updateInstanceAntiBanRecord(
  instance: MarketingWhatsAppInstance,
  nextConfig: AntiBanConfig,
  warmupDay: number,
  previewFallback: boolean,
): Promise<number> {
  const nextDailyLimit = nextConfig.auto_warmup
    ? getWarmupDailyLimit(warmupDay)
    : instance.daily_limit;

  if (!previewFallback) {
    await marketingDb
      .from("marketing_whatsapp_instances")
      .update({
        anti_ban_config: nextConfig,
        warmup_day: warmupDay,
        daily_limit: nextDailyLimit,
      })
      .eq("id", instance.id);
  }
  return nextDailyLimit;
}
