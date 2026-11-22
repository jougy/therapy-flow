export const DEFAULT_MARKETING_CHIP_PHONE = "5511965120431";
export const DEFAULT_MARKETING_CHIP_DISPLAY = "(11) 96512-0431";
export const DEFAULT_MARKETING_INSTANCE_KEY = "pluri-mkt-5511965120431";
export const DEFAULT_HANDOFF_COMMERCIAL_PHONE = "5511980113936";

export type WhatsAppInstanceStatus =
  | "disconnected"
  | "qr_ready"
  | "connecting"
  | "connected"
  | "circuit_broken"
  | "banned";

export type AgentModelTier =
  | "gemini-decision-1"
  | "gemini-3.5-flash-lite"
  | "gemini-4-hydrogen"
  | "gemma-4-local"
  | (string & {});

export type AgentsPanelTab =
  | "agents"
  | "connections"
  | "campaigns"
  | "filter_groups"
  | "warmup"
  | "crm";

export type ConversationFunnelStage =
  | "lead"
  | "contacted"
  | "qualified"
  | "proposal"
  | "scheduled"
  | "won"
  | "opt_out";

export type ConversationAgentMode = "ai" | "human" | "paused";

export interface AntiBanConfig {
  jitter_mean_sec: number;
  jitter_stddev_sec: number;
  block_size: number;
  block_pause_min: number;
  block_pause_max: number;
  business_start: string;
  business_end: string;
  business_days: number[];
  presence_typing: boolean;
  debounce_sec: number;
  circuit_breaker_error_pct: number;
  auto_warmup: boolean;
  validate_on_whatsapp: boolean;
}

export interface MarketingWhatsAppInstance {
  id: string;
  tenant_scope: "platform" | "clinic";
  clinic_id?: string | null;
  instance_key: string;
  display_name: string;
  phone_e164: string;
  provider: "evolution" | "android_bridge";
  role_type: "marketing_automation" | "warmup_pool" | "commercial_backup";
  status: WhatsAppInstanceStatus;
  health_score: number;
  warmup_day: number;
  daily_limit: number;
  daily_sent_count: number;
  anti_ban_config: AntiBanConfig;
  pairing_code?: string | null;
  warmup_pool_id?: string | null;
  last_diagnostic_at?: string | null;
  last_connected_at?: string | null;
  last_error?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingAiAgent {
  id: string;
  tenant_scope: "platform" | "clinic";
  clinic_id?: string | null;
  instance_id?: string | null;
  name: string;
  slug: string;
  persona_role: string;
  is_active: boolean;
  model_tier: AgentModelTier;
  llm_provider_id?: string | null;
  llm_model_id?: string | null;
  fallback_chain?: Array<{ providerSlug: string; modelId: string }>;
  temperature?: number;
  disable_thinking?: boolean;
  split_messages?: boolean;
  simulate_typing?: boolean;
  audio_reply_mode?: "never" | "match_user" | "always_ptt";
  max_context_messages?: number;
  auto_compact_context?: boolean;
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
  total_conversations: number;
  total_handoffs: number;
  created_at: string;
  updated_at: string;
}

export interface MarketingZapCampaign {
  id: string;
  tenant_scope: "platform" | "clinic";
  clinic_id?: string | null;
  instance_id?: string | null;
  agent_id?: string | null;
  name: string;
  status: "draft" | "scheduled" | "running" | "paused" | "completed" | "circuit_broken";
  campaign_mode?: "standard" | "classic_fast" | "multi_chip" | "push_alert" | "group_broadcast";
  instance_pool_ids?: string[];
  audience_list_id?: string | null;
  target_group_jids?: string[];
  media_payload?: Record<string, unknown>;
  require_turbo_filter?: boolean;
  audience_filter: {
    min_score?: number;
    icp_tier?: string;
    only_with_phone?: boolean;
  };
  message_template: string;
  enable_ai_spintax: boolean;
  budget_cap_cents: number;
  total_targets: number;
  sent_count: number;
  replied_count: number;
  failed_count: number;
  scheduled_for?: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketingZapConversation {
  id: string;
  tenant_scope: "platform" | "clinic";
  clinic_id?: string | null;
  instance_id?: string | null;
  agent_id?: string | null;
  lead_id?: string | null;
  phone_e164: string;
  contact_name: string;
  clinic_or_origin?: string | null;
  gemini_interaction_id?: string | null;
  agent_mode: ConversationAgentMode;
  funnel_stage: ConversationFunnelStage;
  intent_classification?: string | null;
  last_message_preview?: string | null;
  last_message_direction: "inbound" | "outbound";
  unread_count: number;
  ai_turns_count: number;
  rolling_summary?: string;
  structured_facts?: Record<string, string>;
  context_tokens_est?: number;
  compaction_count?: number;
  last_inbound_at?: string | null;
  updated_at: string;
}

export interface MarketingOptOut {
  id: string;
  phone_e164: string;
  phone_hash: string;
  reason: string;
  source_channel: string;
  created_at: string;
}

export interface AgentSimulationTurn {
  id: string;
  role: "lead" | "agent";
  text: string;
  intent?: string;
  modelUsed?: string;
  typingMs?: number;
  isOptOut?: boolean;
  triggeredHandoff?: boolean;
  createdAt: string;
}

export const DEFAULT_ANTI_BAN_CONFIG: AntiBanConfig = {
  jitter_mean_sec: 42,
  jitter_stddev_sec: 14,
  block_size: 15,
  block_pause_min: 3,
  block_pause_max: 8,
  business_start: "08:30",
  business_end: "19:30",
  business_days: [1, 2, 3, 4, 5, 6],
  presence_typing: true,
  debounce_sec: 6,
  circuit_breaker_error_pct: 5,
  auto_warmup: true,
  validate_on_whatsapp: true,
};

export const INSTANCE_STATUS_META: Record<
  WhatsAppInstanceStatus,
  { label: string; badgeClass: string }
> = {
  connected: {
    label: "Conectado",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  },
  qr_ready: {
    label: "QR Code Pronto",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30",
  },
  connecting: {
    label: "Conectando...",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
  },
  disconnected: {
    label: "Aguardando QR Code",
    badgeClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30",
  },
  circuit_broken: {
    label: "Circuit Breaker Ativo",
    badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
  },
  banned: {
    label: "Bloqueado Meta",
    badgeClass: "bg-red-600/20 text-red-700 dark:text-red-300 border-red-600/40",
  },
};

export const MODEL_TIER_LABELS: Record<string, { label: string; costHint: string }> = {
  "gemini-4-hydrogen": { label: "Gemini 4 Hydrogen", costHint: "Consultivo SDR" },
  "gemini-3.5-flash-lite": { label: "Gemini 3.5 Flash-Lite", costHint: "Alta Vazão / Lite" },
  "gemini-2.5-flash-lite": { label: "Gemini 2.5 Flash-Lite", costHint: "Pulumi Default" },
  "gemini-decision-1": { label: "Gemini Decision 1", costHint: "0 tokens saída" },
  "gemma-4-local": { label: "Gemma 4 Local", costHint: "Custo R$ 0 (Batch)" },
  "gemma4:cloud": { label: "Gemma 4 Cloud", costHint: "Rápido / Econômico" },
  "gemma4:e4b": { label: "Gemma 4 E4B (Local)", costHint: "Ollama 12GB VRAM" },
  "deepseek-v4.1-flash-free": { label: "DeepSeek V4.1 Flash Free", costHint: "OpenCode Free" },
};

export const FUNNEL_STAGE_META: Record<
  ConversationFunnelStage,
  { label: string; badgeClass: string }
> = {
  lead: { label: "Novo Lead", badgeClass: "bg-slate-500/15 text-slate-700 dark:text-slate-300" },
  contacted: { label: "Abordado", badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  qualified: { label: "Qualificado IA", badgeClass: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  proposal: { label: "Proposta / Link", badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300" },
  scheduled: { label: "Demo Agendada", badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300" },
  won: { label: "Convertido", badgeClass: "bg-green-600/20 text-green-700 dark:text-green-300" },
  opt_out: { label: "Opt-Out LGPD", badgeClass: "bg-rose-500/15 text-rose-700 dark:text-rose-300" },
};

export const FALLBACK_PRIMARY_INSTANCE: MarketingWhatsAppInstance = {
  id: "inst-primary-5511965120431",
  tenant_scope: "platform",
  clinic_id: null,
  instance_key: DEFAULT_MARKETING_INSTANCE_KEY,
  display_name: `Chip Marketing Principal — ${DEFAULT_MARKETING_CHIP_DISPLAY}`,
  phone_e164: DEFAULT_MARKETING_CHIP_PHONE,
  provider: "evolution",
  role_type: "marketing_automation",
  status: "disconnected",
  health_score: 100,
  warmup_day: 1,
  daily_limit: 15,
  daily_sent_count: 0,
  anti_ban_config: DEFAULT_ANTI_BAN_CONFIG,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const FALLBACK_DEFAULT_AGENTS: MarketingAiAgent[] = [
  {
    id: "agent-sdr-pluri-fisio",
    tenant_scope: "platform",
    clinic_id: null,
    instance_id: "inst-primary-5511965120431",
    name: "Agente SDR Pluri Fisio (Qualificação & Demo)",
    slug: "sdr-pluri-fisio",
    persona_role: "sdr_qualifier",
    is_active: true,
    model_tier: "gemini-4-hydrogen",
    system_prompt:
      "Você é o consultor SDR oficial do Pluri Fisio / Pluri Health no WhatsApp. Seja cordial, direto e consultivo com fisioterapeutas, donos de clínica e estúdios de Pilates.",
    knowledge_base:
      "Pluri Fisio: Prontuário SOAP + Escala EVA + Estúdio de Demarcação + Agenda Multi-Turno + Assinatura Digital + Repasses financeiros. Comercial: (11) 98011-3936.",
    welcome_message:
      "Olá {{primeiro_nome}}! Aqui é da equipe Pluri Fisio. Vi seu perfil e queria entender como está sua rotina de prontuários e agenda hoje.",
    handoff_keywords: ["falar com humano", "atendente", "suporte", "fechar plano", "comercial"],
    handoff_phone: DEFAULT_HANDOFF_COMMERCIAL_PHONE,
    max_chars_per_reply: 450,
    debounce_seconds: 6,
    transcribe_audio: true,
    analyze_images: true,
    enable_semantic_cache: true,
    total_conversations: 0,
    total_handoffs: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: "agent-triagem-reativacao",
    tenant_scope: "platform",
    clinic_id: null,
    instance_id: "inst-primary-5511965120431",
    name: "Agente Triagem & Reativação Rápida",
    slug: "triagem-reativacao-lite",
    persona_role: "reactivation_triage",
    is_active: true,
    model_tier: "gemini-3.5-flash-lite",
    system_prompt:
      "Faça triagem rápida e reativação amigável de leads frios em até 2 frases objetivas. Respeite opt-out LGPD imediatamente.",
    knowledge_base:
      "Retomada consultiva para sair das planilhas e organizar evoluções clínicas no celular.",
    welcome_message:
      "Oi {{primeiro_nome}}, tudo bem? Passando rápido para saber se você ainda busca um sistema prático para evoluções e agenda.",
    handoff_keywords: ["falar com humano", "atendente", "agendar", "demonstração"],
    handoff_phone: DEFAULT_HANDOFF_COMMERCIAL_PHONE,
    max_chars_per_reply: 320,
    debounce_seconds: 6,
    transcribe_audio: true,
    analyze_images: false,
    enable_semantic_cache: true,
    total_conversations: 0,
    total_handoffs: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
