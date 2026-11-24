export type LlmProviderType =
  | "local_ollama"
  | "opencode_free"
  | "gemini"
  | "gemma_cloud"
  | "openai"
  | "anthropic"
  | "groq"
  | "openrouter"
  | "custom_openai";

export interface LlmProviderRecord {
  id: string;
  slug: string;
  name: string;
  providerType: LlmProviderType;
  baseUrl: string;
  defaultModel: string;
  isEnabled: boolean;
  isFreeTier: boolean;
  isLocal: boolean;
  hasApiKey: boolean;
  priority: number;
  notes?: string;
}

export interface LlmModelCatalogItem {
  id: string;
  name: string;
  providerType: LlmProviderType;
  providerSlug: string;
  providerLabel: string;
  isFree: boolean;
  isLocal: boolean;
  isPulumiDefault: boolean;
  supportsThinking: boolean;
  disableThinkingRecommended: boolean;
  contextWindow: number;
  speedTier: "ultra_fast" | "fast" | "balanced";
  notes?: string;
}

export interface FallbackModelRef {
  providerSlug: string;
  modelId: string;
  label?: string;
}

export interface DeviceLlmHarnessConfig {
  deviceId: string;
  preferLocalOllama: boolean;
  ollamaBaseUrl: string;
  ollamaModel: string;
  openCodeEnabled: boolean;
  openCodeUsePublicAuth: boolean;
  openCodePreferredFreeModel: string;
  pulumiDefaultProviderSlug: string;
  pulumiDefaultModelId: string;
  fallbackChain: FallbackModelRef[];
  disableThinkingByDefault: boolean;
  autoCompactContext: boolean;
  maxContextMessages: number;
  compactKeepLastTurns: number;
  updatedAt: string;
}

export interface ZapDefenderMetricItem {
  key: string;
  label: string;
  score: number;
  maxScore: number;
  status: "ok" | "warn" | "risk";
  detail: string;
}

export interface ZapDefenderReport {
  instanceId: string;
  overallScore: number;
  riskLevel: "safe" | "warning" | "high_risk";
  metrics: ZapDefenderMetricItem[];
  recommendations: string[];
  createdAt: string;
}

export interface NumberValidationResult {
  phoneE164: string;
  existsOnWhatsapp: boolean;
  whatsappJid?: string | null;
  verifiedName?: string | null;
  fromCache?: boolean;
  checkedAt: string;
}

export interface AudienceContactItem {
  phoneE164: string;
  name: string;
  vars: Record<string, string>;
  isValidWhatsapp?: boolean | null;
}

export interface AudienceListRecord {
  id: string;
  name: string;
  sourceType: "csv" | "txt" | "manual" | "leads";
  totalContacts: number;
  validWhatsappCount: number;
  detectedColumns: string[];
  contacts: AudienceContactItem[];
  createdAt: string;
  updatedAt: string;
}

export interface WhatsAppGroupRecord {
  id: string;
  instanceId: string;
  groupJid: string;
  subject: string;
  participantCount: number;
  isAdmin: boolean;
  isAnnouncement: boolean;
  lastSyncedAt: string;
}

export interface WhatsAppGroupJob {
  id: string;
  instanceId: string;
  groupJid: string;
  groupSubject?: string;
  jobType: "extract_members" | "broadcast_group" | "auto_join";
  status: "pending" | "running" | "completed" | "failed";
  processedCount: number;
  totalCount: number;
  errorMessage?: string | null;
  createdAt: string;
}

export interface WarmupPoolRecord {
  id: string;
  name: string;
  isActive: boolean;
  instanceIds: string[];
  minIntervalMinutes: number;
  maxIntervalMinutes: number;
  dailyExchangesPerPair: number;
  topics: string[];
  totalExchangesCount: number;
  lastRunAt?: string | null;
  createdAt: string;
}

export interface ZapMessageRecord {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  messageType: "text" | "image" | "audio" | "document" | "video";
  body: string;
  mediaUrl?: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  senderLabel?: string | null;
  createdAt: string;
}

export interface KeywordTriggerRecord {
  id: string;
  name: string;
  instanceId?: string | null;
  matchType: "exact" | "contains" | "starts_with" | "regex";
  pattern: string;
  actionType:
    | "reply_text"
    | "reply_media"
    | "start_flow"
    | "switch_agent"
    | "handoff_human"
    | "move_stage";
  actionPayload: Record<string, unknown>;
  priority: number;
  isActive: boolean;
  hitCount: number;
}

export interface TypebotBindingRecord {
  id: string;
  name: string;
  instanceId?: string | null;
  typebotPublicId: string;
  typebotBaseUrl: string;
  triggerKeyword?: string | null;
  expireMinutes: number;
  isActive: boolean;
  createdAt: string;
}

export interface CampaignMediaPayload {
  mediaType?: "none" | "image" | "audio_ptt" | "document" | "video";
  mediaUrl?: string;
  ttsScript?: string;
  caption?: string;
  simulateRecordingSec?: number;
}

export const DEFAULT_DEVICE_LLM_HARNESS: DeviceLlmHarnessConfig = {
  deviceId: "local-browser-device",
  preferLocalOllama: false,
  ollamaBaseUrl: "http://127.0.0.1:11434",
  ollamaModel: "mimo-v2.6:latest",
  openCodeEnabled: true,
  openCodeUsePublicAuth: true,
  openCodePreferredFreeModel: "mimo-v2.6-flash-free",
  pulumiDefaultProviderSlug: "gemini-pulumi",
  pulumiDefaultModelId: "gemini-2.5-flash-lite",
  fallbackChain: [
    { providerSlug: "opencode-free", modelId: "mimo-v2.6-flash-free", label: "OpenCode Free (MiMo v2.6 Flash)" },
    { providerSlug: "opencode-free", modelId: "deepseek-v4.1-flash-free", label: "OpenCode Free (DeepSeek V4.1)" },
    { providerSlug: "ollama-local", modelId: "mimo-v2.6:latest", label: "Ollama Local (MiMo v2.6 9B)" },
    { providerSlug: "ollama-local", modelId: "gemma4:12b", label: "Ollama Local (Gemma 4 12B)" },
    { providerSlug: "gemini-pulumi", modelId: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite (Pulumi)" },
  ],
  disableThinkingByDefault: true,
  autoCompactContext: true,
  maxContextMessages: 8,
  compactKeepLastTurns: 4,
  updatedAt: "2026-11-22T00:00:00.000Z",
};

export const CURATED_LLM_CATALOG: LlmModelCatalogItem[] = [
  {
    id: "mimo-v2.6-flash-free",
    name: "MiMo v2.6 Flash Free (OpenCode)",
    providerType: "opencode_free",
    providerSlug: "opencode-free",
    providerLabel: "OpenCode Zen Free",
    isFree: true,
    isLocal: false,
    isPulumiDefault: false,
    supportsThinking: true,
    disableThinkingRecommended: true,
    contextWindow: 262144,
    speedTier: "ultra_fast",
    notes: "Agente gratuito ultrarrápido via OpenCode.",
  },
  {
    id: "deepseek-v4.1-flash-free",
    name: "DeepSeek V4.1 Flash Free",
    providerType: "opencode_free",
    providerSlug: "opencode-free",
    providerLabel: "OpenCode Zen Free",
    isFree: true,
    isLocal: false,
    isPulumiDefault: false,
    supportsThinking: true,
    disableThinkingRecommended: true,
    contextWindow: 64000,
    speedTier: "ultra_fast",
    notes: "Custo zero via OpenCode Zen; desative thinking para WhatsApp.",
  },
  {
    id: "nemotron-3.5-lightning-free",
    name: "Nemotron 3.5 Lightning Free",
    providerType: "opencode_free",
    providerSlug: "opencode-free",
    providerLabel: "OpenCode Zen Free",
    isFree: true,
    isLocal: false,
    isPulumiDefault: false,
    supportsThinking: false,
    disableThinkingRecommended: false,
    contextWindow: 128000,
    speedTier: "ultra_fast",
  },
  {
    id: "big-pickle",
    name: "Big Pickle (OpenCode Free)",
    providerType: "opencode_free",
    providerSlug: "opencode-free",
    providerLabel: "OpenCode Zen Free",
    isFree: true,
    isLocal: false,
    isPulumiDefault: false,
    supportsThinking: false,
    disableThinkingRecommended: false,
    contextWindow: 128000,
    speedTier: "fast",
  },
  {
    id: "mimo-v2.6:latest",
    name: "MiMo v2.6 9B (Ollama Local)",
    providerType: "local_ollama",
    providerSlug: "ollama-local",
    providerLabel: "Ollama Local",
    isFree: true,
    isLocal: true,
    isPulumiDefault: false,
    supportsThinking: true,
    disableThinkingRecommended: true,
    contextWindow: 262144,
    speedTier: "ultra_fast",
    notes: "Instalado localmente (9B Q4_K_M, ~390ms com thinking desativado).",
  },
  {
    id: "gemma4:12b",
    name: "Gemma 4 12B (Ollama Local)",
    providerType: "local_ollama",
    providerSlug: "ollama-local",
    providerLabel: "Ollama Local",
    isFree: true,
    isLocal: true,
    isPulumiDefault: false,
    supportsThinking: true,
    disableThinkingRecommended: true,
    contextWindow: 262144,
    speedTier: "fast",
    notes: "Instalado localmente (12B Q4_K_M multimodal com tools e visão).",
  },
  {
    id: "gemini-2.5-flash-lite",
    name: "Gemini 2.5 Flash-Lite",
    providerType: "gemini",
    providerSlug: "gemini-pulumi",
    providerLabel: "Google Gemini (Pulumi)",
    isFree: false,
    isLocal: false,
    isPulumiDefault: true,
    supportsThinking: true,
    disableThinkingRecommended: true,
    contextWindow: 1000000,
    speedTier: "ultra_fast",
    notes: "Padrão gerenciado via Pulumi ESC; ideal para SDR em alta vazão.",
  },
  {
    id: "gemma4:cloud",
    name: "Gemma 4 Cloud",
    providerType: "gemma_cloud",
    providerSlug: "gemma-cloud",
    providerLabel: "Gemma 4 Cloud",
    isFree: false,
    isLocal: false,
    isPulumiDefault: false,
    supportsThinking: false,
    disableThinkingRecommended: true,
    contextWindow: 128000,
    speedTier: "ultra_fast",
  },
  {
    id: "gemma4:e4b",
    name: "Gemma 4 E4B (Local 12GB VRAM)",
    providerType: "local_ollama",
    providerSlug: "ollama-local",
    providerLabel: "Ollama Local",
    isFree: true,
    isLocal: true,
    isPulumiDefault: false,
    supportsThinking: true,
    disableThinkingRecommended: true,
    contextWindow: 32768,
    speedTier: "fast",
    notes: "Roda 100% local em GPU 12GB VRAM sem custo de API.",
  },
  {
    id: "llama3.2:3b",
    name: "Llama 3.2 3B (Local Leve)",
    providerType: "local_ollama",
    providerSlug: "ollama-local",
    providerLabel: "Ollama Local",
    isFree: true,
    isLocal: true,
    isPulumiDefault: false,
    supportsThinking: false,
    disableThinkingRecommended: false,
    contextWindow: 131072,
    speedTier: "ultra_fast",
  },
  {
    id: "llama-3.3-70b-versatile",
    name: "Llama 3.3 70B Versatile (Groq)",
    providerType: "groq",
    providerSlug: "groq",
    providerLabel: "Groq Cloud",
    isFree: false,
    isLocal: false,
    isPulumiDefault: false,
    supportsThinking: false,
    disableThinkingRecommended: false,
    contextWindow: 128000,
    speedTier: "ultra_fast",
  },
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    providerType: "openai",
    providerSlug: "openai",
    providerLabel: "OpenAI",
    isFree: false,
    isLocal: false,
    isPulumiDefault: false,
    supportsThinking: false,
    disableThinkingRecommended: false,
    contextWindow: 128000,
    speedTier: "fast",
  },
  {
    id: "claude-3-5-haiku-latest",
    name: "Claude 3.5 Haiku",
    providerType: "anthropic",
    providerSlug: "anthropic",
    providerLabel: "Anthropic",
    isFree: false,
    isLocal: false,
    isPulumiDefault: false,
    supportsThinking: false,
    disableThinkingRecommended: false,
    contextWindow: 200000,
    speedTier: "fast",
  },
  {
    id: "meta-llama/llama-3.3-70b-instruct:free",
    name: "Llama 3.3 70B Instruct (Free)",
    providerType: "openrouter",
    providerSlug: "openrouter",
    providerLabel: "OpenRouter Free",
    isFree: true,
    isLocal: false,
    isPulumiDefault: false,
    supportsThinking: false,
    disableThinkingRecommended: false,
    contextWindow: 128000,
    speedTier: "balanced",
  },
];

export const FALLBACK_LLM_PROVIDERS: LlmProviderRecord[] = [
  { id: "prov-opencode-free", slug: "opencode-free", name: "OpenCode Zen Free", providerType: "opencode_free", baseUrl: "https://opencode.ai/zen/v1", defaultModel: "mimo-v2.6-flash-free", isEnabled: true, isFreeTier: true, isLocal: false, hasApiKey: false, priority: 1 },
  { id: "prov-gemini-pulumi", slug: "gemini-pulumi", name: "Google Gemini (Pulumi ESC)", providerType: "gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemini-2.5-flash-lite", isEnabled: true, isFreeTier: false, isLocal: false, hasApiKey: true, priority: 2 },
  { id: "prov-gemma-cloud", slug: "gemma-cloud", name: "Gemma 4 Cloud", providerType: "gemma_cloud", baseUrl: "https://generativelanguage.googleapis.com/v1beta", defaultModel: "gemma4:cloud", isEnabled: true, isFreeTier: false, isLocal: false, hasApiKey: true, priority: 3 },
  { id: "prov-ollama-local", slug: "ollama-local", name: "Ollama Local (Este Dispositivo)", providerType: "local_ollama", baseUrl: "http://127.0.0.1:11434", defaultModel: "mimo-v2.6:latest", isEnabled: true, isFreeTier: true, isLocal: true, hasApiKey: false, priority: 4 },
  { id: "prov-groq", slug: "groq", name: "Groq Inference", providerType: "groq", baseUrl: "https://api.groq.com/openai/v1", defaultModel: "llama-3.3-70b-versatile", isEnabled: true, isFreeTier: false, isLocal: false, hasApiKey: false, priority: 5 },
  { id: "prov-openai", slug: "openai", name: "OpenAI", providerType: "openai", baseUrl: "https://api.openai.com/v1", defaultModel: "gpt-4o-mini", isEnabled: false, isFreeTier: false, isLocal: false, hasApiKey: false, priority: 6 },
  { id: "prov-anthropic", slug: "anthropic", name: "Anthropic", providerType: "anthropic", baseUrl: "https://api.anthropic.com/v1", defaultModel: "claude-3-5-haiku-latest", isEnabled: false, isFreeTier: false, isLocal: false, hasApiKey: false, priority: 7 },
  { id: "prov-openrouter", slug: "openrouter", name: "OpenRouter", providerType: "openrouter", baseUrl: "https://openrouter.ai/api/v1", defaultModel: "meta-llama/llama-3.3-70b-instruct:free", isEnabled: true, isFreeTier: true, isLocal: false, hasApiKey: false, priority: 8 },
];
