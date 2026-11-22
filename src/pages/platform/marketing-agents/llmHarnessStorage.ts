import { del, get, set } from "idb-keyval";
import type { MarketingAiAgent } from "./types";
import {
  CURATED_LLM_CATALOG,
  DEFAULT_DEVICE_LLM_HARNESS,
  FALLBACK_LLM_PROVIDERS,
  type DeviceLlmHarnessConfig,
  type FallbackModelRef,
  type LlmModelCatalogItem,
  type LlmProviderRecord,
  type LlmProviderType,
} from "./suiteTypes";

const HARNESS_STORAGE_KEY = "pluri_mkt_device_llm_harness_v1";
const MODELS_DEV_CACHE_KEY = "pluri_mkt_models_dev_cache_v1";
const MODELS_DEV_TTL_MS = 24 * 60 * 60 * 1000;

interface ModelsDevCachePayload {
  fetchedAt: number;
  items: LlmModelCatalogItem[];
}

export interface EffectiveAgentLlmResolution {
  providerSlug: string;
  providerType: LlmProviderType;
  modelId: string;
  baseUrl: string;
  disableThinking: boolean;
  fallbackChain: FallbackModelRef[];
  sourceLabel: string;
  costLabel: string;
}

function readLocalStorageJson<T>(key: string): T | null {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocalStorageJson<T>(key: string, value: T): void {
  try {
    if (typeof window === "undefined" || !window.localStorage) return;
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignora falha de quota em modo privado/JSDOM
  }
}

function removeLocalStorageKey(key: string): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) window.localStorage.removeItem(key);
  } catch {
    // noop
  }
}

async function fetchJsonWithTimeout<T>(
  url: string,
  timeoutMs: number,
  headers?: Record<string, string>,
): Promise<T | null> {
  if (typeof fetch !== "function") return null;
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const res = await fetch(url, { method: "GET", headers, signal: controller?.signal });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function mergeWithDefaults(raw: Partial<DeviceLlmHarnessConfig> | null | undefined): DeviceLlmHarnessConfig {
  if (!raw) return { ...DEFAULT_DEVICE_LLM_HARNESS };
  return {
    ...DEFAULT_DEVICE_LLM_HARNESS,
    ...raw,
    fallbackChain:
      Array.isArray(raw.fallbackChain) && raw.fallbackChain.length > 0
        ? raw.fallbackChain
        : DEFAULT_DEVICE_LLM_HARNESS.fallbackChain,
  };
}

export async function loadDeviceLlmHarness(): Promise<DeviceLlmHarnessConfig> {
  try {
    const idbValue = await get<Partial<DeviceLlmHarnessConfig>>(HARNESS_STORAGE_KEY);
    if (idbValue) return mergeWithDefaults(idbValue);
  } catch {
    // Fallback para localStorage abaixo
  }
  return mergeWithDefaults(readLocalStorageJson<Partial<DeviceLlmHarnessConfig>>(HARNESS_STORAGE_KEY));
}

export async function saveDeviceLlmHarness(
  config: Partial<DeviceLlmHarnessConfig>,
): Promise<DeviceLlmHarnessConfig> {
  const current = await loadDeviceLlmHarness();
  const next: DeviceLlmHarnessConfig = {
    ...current,
    ...config,
    fallbackChain:
      Array.isArray(config.fallbackChain) && config.fallbackChain.length > 0
        ? config.fallbackChain
        : current.fallbackChain,
    updatedAt: new Date().toISOString(),
  };
  writeLocalStorageJson(HARNESS_STORAGE_KEY, next);
  try {
    await set(HARNESS_STORAGE_KEY, next);
  } catch {
    // localStorage fallback já persistido
  }
  return next;
}

export async function resetDeviceLlmHarness(): Promise<DeviceLlmHarnessConfig> {
  const fresh: DeviceLlmHarnessConfig = {
    ...DEFAULT_DEVICE_LLM_HARNESS,
    updatedAt: new Date().toISOString(),
  };
  removeLocalStorageKey(HARNESS_STORAGE_KEY);
  try {
    await del(HARNESS_STORAGE_KEY);
  } catch {
    // noop
  }
  return fresh;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string; details?: { parameter_size?: string } }>;
}

export async function discoverLocalOllamaModels(
  baseUrl = "http://127.0.0.1:11434",
): Promise<LlmModelCatalogItem[]> {
  const cleanBase = (baseUrl || "http://127.0.0.1:11434").trim().replace(/\/+$/, "");
  const payload = await fetchJsonWithTimeout<OllamaTagsResponse>(`${cleanBase}/api/tags`, 2500);
  if (!payload?.models || !Array.isArray(payload.models)) return [];

  return payload.models
    .map((entry): LlmModelCatalogItem | null => {
      const id = (entry.name || entry.model || "").trim();
      if (!id) return null;
      const lower = id.toLowerCase();
      const paramHint = entry.details?.parameter_size ? ` (${entry.details.parameter_size})` : "";
      const supportsThinking = lower.includes("gemma4") || lower.includes("deepseek") || lower.includes("qwen3");
      return {
        id,
        name: `${id}${paramHint}`,
        providerType: "local_ollama",
        providerSlug: "ollama-local",
        providerLabel: "Ollama Local",
        isFree: true,
        isLocal: true,
        isPulumiDefault: false,
        supportsThinking,
        disableThinkingRecommended: supportsThinking,
        contextWindow: 32768,
        speedTier: lower.includes("3b") || lower.includes("1b") ? "ultra_fast" : "fast",
        notes: "Detectado automaticamente no Ollama deste dispositivo.",
      };
    })
    .filter((item): item is LlmModelCatalogItem => item !== null);
}

interface OpenCodeModelsResponse {
  data?: Array<{ id?: string; name?: string; context_length?: number }>;
}

export async function fetchOpenCodeLiveModels(apiKey?: string): Promise<LlmModelCatalogItem[]> {
  const curatedOpenCode = CURATED_LLM_CATALOG.filter((m) => m.providerType === "opencode_free");
  const headers: Record<string, string> = apiKey?.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {};
  const payload = await fetchJsonWithTimeout<OpenCodeModelsResponse>("https://opencode.ai/zen/v1/models", 3500, headers);
  if (!payload?.data || !Array.isArray(payload.data) || payload.data.length === 0) return curatedOpenCode;

  const mapped: LlmModelCatalogItem[] = [];
  for (const raw of payload.data) {
    const id = (raw.id || "").trim();
    if (!id) continue;
    const lower = id.toLowerCase();
    if (!(lower.endsWith("-free") || lower === "big-pickle" || lower.includes("free"))) continue;
    const supportsThinking = lower.includes("deepseek") || lower.includes("r1");
    mapped.push({
      id,
      name: raw.name?.trim() || id,
      providerType: "opencode_free",
      providerSlug: "opencode-free",
      providerLabel: "OpenCode Zen Free",
      isFree: true,
      isLocal: false,
      isPulumiDefault: false,
      supportsThinking,
      disableThinkingRecommended: supportsThinking,
      contextWindow: raw.context_length || 64000,
      speedTier: lower.includes("flash") || lower.includes("lite") ? "ultra_fast" : "fast",
      notes: "Modelo gratuito listado ao vivo via OpenCode Zen.",
    });
  }
  if (mapped.length === 0) return curatedOpenCode;
  mapped.sort((a, b) => (a.id.includes("free") || a.id === "big-pickle" ? 0 : 1) - (b.id.includes("free") || b.id === "big-pickle" ? 0 : 1));
  return mapped;
}

const MODELS_DEV_PROVIDER_MAP: Record<
  string,
  { providerType: LlmProviderType; providerSlug: string; providerLabel: string }
> = {
  opencode: { providerType: "opencode_free", providerSlug: "opencode-free", providerLabel: "OpenCode Zen Free" },
  google: { providerType: "gemini", providerSlug: "gemini-pulumi", providerLabel: "Google Gemini" },
  openai: { providerType: "openai", providerSlug: "openai", providerLabel: "OpenAI" },
  anthropic: { providerType: "anthropic", providerSlug: "anthropic", providerLabel: "Anthropic" },
  groq: { providerType: "groq", providerSlug: "groq", providerLabel: "Groq Cloud" },
  openrouter: { providerType: "openrouter", providerSlug: "openrouter", providerLabel: "OpenRouter" },
};

interface ModelsDevRawEntry {
  models?: Record<string, { id?: string; name?: string; reasoning?: boolean; cost?: { input?: number; output?: number }; limit?: { context?: number } }>;
}

function mergeCatalogDedupe(primary: LlmModelCatalogItem[], secondary: LlmModelCatalogItem[]): LlmModelCatalogItem[] {
  const seen = new Map<string, LlmModelCatalogItem>();
  for (const item of [...primary, ...secondary]) {
    const key = `${item.providerSlug}::${item.id}`;
    if (!seen.has(key)) seen.set(key, item);
  }
  return Array.from(seen.values());
}

export async function fetchModelsDevCatalog(forceRefresh = false): Promise<LlmModelCatalogItem[]> {
  if (!forceRefresh) {
    try {
      const idbCache = await get<ModelsDevCachePayload>(MODELS_DEV_CACHE_KEY);
      if (idbCache && Date.now() - idbCache.fetchedAt < MODELS_DEV_TTL_MS) {
        return mergeCatalogDedupe(CURATED_LLM_CATALOG, idbCache.items);
      }
    } catch {
      // tenta localStorage
    }
    const lsCache = readLocalStorageJson<ModelsDevCachePayload>(MODELS_DEV_CACHE_KEY);
    if (lsCache && Date.now() - lsCache.fetchedAt < MODELS_DEV_TTL_MS) {
      return mergeCatalogDedupe(CURATED_LLM_CATALOG, lsCache.items);
    }
  }

  const rawCatalog = await fetchJsonWithTimeout<Record<string, ModelsDevRawEntry>>("https://models.dev/api.json", 4000);
  if (!rawCatalog) return [...CURATED_LLM_CATALOG];

  const remoteItems: LlmModelCatalogItem[] = [];
  for (const [provKey, meta] of Object.entries(MODELS_DEV_PROVIDER_MAP)) {
    const modelsMap = rawCatalog[provKey]?.models;
    if (!modelsMap) continue;
    for (const [modelKey, modelInfo] of Object.entries(modelsMap).slice(0, 12)) {
      const id = (modelInfo.id || modelKey || "").trim();
      if (!id) continue;
      const lower = id.toLowerCase();
      const isFree = (modelInfo.cost?.input === 0 && modelInfo.cost?.output === 0) || lower.includes(":free") || lower.endsWith("-free") || lower === "big-pickle";
      if (!(isFree || lower.includes("flash") || lower.includes("lite") || lower.includes("mini") || lower.includes("haiku") || lower.includes("gemma") || lower.includes("llama"))) {
        continue;
      }
      const supportsThinking = Boolean(modelInfo.reasoning);
      remoteItems.push({
        id,
        name: modelInfo.name?.trim() || id,
        providerType: meta.providerType,
        providerSlug: meta.providerSlug,
        providerLabel: meta.providerLabel,
        isFree,
        isLocal: false,
        isPulumiDefault: id === "gemini-2.5-flash-lite",
        supportsThinking,
        disableThinkingRecommended: supportsThinking,
        contextWindow: modelInfo.limit?.context || 128000,
        speedTier: lower.includes("lite") || lower.includes("flash") || lower.includes("mini") ? "ultra_fast" : "fast",
      });
    }
  }

  const cachePayload: ModelsDevCachePayload = { fetchedAt: Date.now(), items: remoteItems };
  writeLocalStorageJson(MODELS_DEV_CACHE_KEY, cachePayload);
  try {
    await set(MODELS_DEV_CACHE_KEY, cachePayload);
  } catch {
    // noop
  }
  return mergeCatalogDedupe(CURATED_LLM_CATALOG, remoteItems);
}

export function resolveEffectiveAgentLlm(
  agent: Partial<MarketingAiAgent> | null | undefined,
  providers: LlmProviderRecord[],
  deviceHarness: DeviceLlmHarnessConfig,
): EffectiveAgentLlmResolution {
  const pool = providers.length > 0 ? providers : FALLBACK_LLM_PROVIDERS;
  const disableThinking = agent?.disable_thinking ?? deviceHarness.disableThinkingByDefault;
  const fallbackChain = agent?.fallback_chain?.length ? agent.fallback_chain : deviceHarness.fallbackChain;
  const findProvider = (idOrSlug?: string | null) =>
    idOrSlug ? pool.find((p) => p.id === idOrSlug || p.slug === idOrSlug) : undefined;

  if (deviceHarness.preferLocalOllama) {
    const localProv = pool.find((p) => p.providerType === "local_ollama");
    return {
      providerSlug: localProv?.slug || "ollama-local",
      providerType: "local_ollama",
      modelId: deviceHarness.ollamaModel || localProv?.defaultModel || "gemma4:e4b",
      baseUrl: deviceHarness.ollamaBaseUrl || localProv?.baseUrl || "http://127.0.0.1:11434",
      disableThinking,
      fallbackChain,
      sourceLabel: "Ollama Local (Este Dispositivo)",
      costLabel: "R$ 0 (Local GPU)",
    };
  }

  const explicitProvider = findProvider(agent?.llm_provider_id);
  if (explicitProvider) {
    const modelId = agent?.llm_model_id || explicitProvider.defaultModel;
    const isFree = explicitProvider.isFreeTier || modelId.includes(":free") || modelId.endsWith("-free");
    return {
      providerSlug: explicitProvider.slug,
      providerType: explicitProvider.providerType,
      modelId,
      baseUrl: explicitProvider.baseUrl,
      disableThinking,
      fallbackChain,
      sourceLabel: explicitProvider.name,
      costLabel: explicitProvider.isLocal
        ? "R$ 0 (Local GPU)"
        : isFree
          ? "Grátis (Tier Free)"
          : explicitProvider.slug === "gemini-pulumi"
            ? "Pulumi ESC (Gerenciado)"
            : "API Externa (BYOK)",
    };
  }

  if (agent?.model_tier === "gemma-4-local" || agent?.llm_model_id === "gemma4:e4b") {
    const localProv = pool.find((p) => p.providerType === "local_ollama");
    return {
      providerSlug: localProv?.slug || "ollama-local",
      providerType: "local_ollama",
      modelId: agent?.llm_model_id || deviceHarness.ollamaModel || "gemma4:e4b",
      baseUrl: deviceHarness.ollamaBaseUrl || localProv?.baseUrl || "http://127.0.0.1:11434",
      disableThinking,
      fallbackChain,
      sourceLabel: "Ollama Local (Agente)",
      costLabel: "R$ 0 (Local GPU)",
    };
  }

  if (deviceHarness.openCodeEnabled && !agent?.llm_model_id) {
    const ocProv = findProvider("opencode-free");
    return {
      providerSlug: ocProv?.slug || "opencode-free",
      providerType: "opencode_free",
      modelId: deviceHarness.openCodePreferredFreeModel || ocProv?.defaultModel || "deepseek-v4.1-flash-free",
      baseUrl: ocProv?.baseUrl || "https://opencode.ai/zen/v1",
      disableThinking,
      fallbackChain,
      sourceLabel: "OpenCode Zen Free (Harness Padrão)",
      costLabel: "Grátis (OpenCode Free)",
    };
  }

  const pulumiProv = findProvider(deviceHarness.pulumiDefaultProviderSlug) || findProvider("gemini-pulumi") || pool[0];
  return {
    providerSlug: pulumiProv?.slug || "gemini-pulumi",
    providerType: pulumiProv?.providerType || "gemini",
    modelId: agent?.llm_model_id || deviceHarness.pulumiDefaultModelId || pulumiProv?.defaultModel || "gemini-2.5-flash-lite",
    baseUrl: pulumiProv?.baseUrl || "https://generativelanguage.googleapis.com/v1beta",
    disableThinking,
    fallbackChain,
    sourceLabel: pulumiProv?.name || "Google Gemini (Pulumi ESC)",
    costLabel: pulumiProv?.isFreeTier ? "Grátis (Tier Free)" : "Pulumi ESC (Gerenciado)",
  };
}
