/**
 * Universal Multi-LLM Gateway & Context Compaction for Deno Edge Functions.
 *
 * Supports:
 * - OpenCode Free (Zen), Ollama Local, Groq, OpenAI, OpenRouter, Custom OpenAI-compat
 * - Google Gemini & Gemma Cloud (native v1beta generateContent + thinkingConfig fallback)
 * - Anthropic Claude (Messages API)
 * - Upstash Redis 10-min circuit breaker on 429 / Free Usage Limit
 * - Anonymized Axiom telemetry & deterministic PT-BR fallback
 */

import { executeUpstashCommand } from './schedule-cache.ts';
import { ingestToAxiom } from './telemetry-axiom.ts';

export type LlmProviderType =
  | 'local_ollama'
  | 'opencode_free'
  | 'gemini'
  | 'gemma_cloud'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'openrouter'
  | 'custom_openai';

export interface LlmProviderConfig {
  slug: string;
  providerType: LlmProviderType;
  baseUrl?: string;
  credentialAlias?: string;
  defaultModel: string;
  disableThinkingDefault?: boolean;
  isFreeTier?: boolean;
}

export interface FallbackEntry {
  providerSlug: string;
  providerType: LlmProviderType;
  modelId: string;
  baseUrl?: string;
  credentialAlias?: string;
  disableThinking?: boolean;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface UniversalChatParams {
  provider: LlmProviderConfig;
  modelId?: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  disableThinking?: boolean;
  fallbackChain?: FallbackEntry[];
  tenantScope?: string;
  route?: string;
}

export interface UniversalChatResult {
  text: string;
  providerSlug: string;
  modelUsed: string;
  usedFallback: boolean;
  latencyMs: number;
  trippedCooldown?: boolean;
  error?: string;
}

export interface CompactTurn {
  role: string;
  text: string;
}

export interface CompactContextParams {
  previousSummary?: string;
  previousFacts?: Record<string, unknown>;
  turns: CompactTurn[];
  provider?: LlmProviderConfig;
  modelId?: string;
  fallbackChain?: FallbackEntry[];
}

export interface CompactContextResult {
  summary: string;
  facts: Record<string, unknown>;
  usedFallback: boolean;
  modelUsed: string;
}

export const CURATED_OPENCODE_FREE_MODELS = [
  'deepseek-v4.1-flash-free',
  'mimo-v2.5-free',
  'qwen3.6-plus-free',
  'nemotron-3-ultra-free',
  'big-pickle',
] as const;

interface CandidateTarget {
  slug: string;
  providerType: LlmProviderType;
  modelId: string;
  baseUrl: string;
  credentialAlias: string;
  disableThinking: boolean;
}

interface ProviderCallResponse {
  ok: boolean;
  text: string;
  status: number;
  rateLimited: boolean;
  error?: string;
}

function getEnv(key: string): string {
  const denoEnv = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno?.env;
  if (denoEnv) return (denoEnv.get(key) || '').trim();
  if (typeof process !== 'undefined' && process.env) return (process.env[key] || '').trim();
  return '';
}

function defaultBaseUrlForType(type: LlmProviderType): string {
  switch (type) {
    case 'opencode_free':
      return 'https://opencode.ai/zen/v1';
    case 'local_ollama':
      return getEnv('OLLAMA_BASE_URL') || 'http://127.0.0.1:11434/v1';
    case 'gemini':
    case 'gemma_cloud':
      return 'https://generativelanguage.googleapis.com';
    case 'groq':
      return 'https://api.groq.com/openai/v1';
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'anthropic':
      return 'https://api.anthropic.com';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'custom_openai':
    default:
      return '';
  }
}

function defaultCredentialAliasForType(type: LlmProviderType): string {
  switch (type) {
    case 'opencode_free':
      return 'OPENCODE_API_KEY';
    case 'gemini':
    case 'gemma_cloud':
      return 'GEMINI_API_KEY';
    case 'groq':
      return 'GROQ_API_KEY';
    case 'openai':
      return 'OPENAI_API_KEY';
    case 'anthropic':
      return 'ANTHROPIC_API_KEY';
    case 'openrouter':
      return 'OPENROUTER_API_KEY';
    case 'local_ollama':
    case 'custom_openai':
    default:
      return '';
  }
}

function cooldownKey(slug: string, modelId: string): string {
  return `marketing:llm:cooldown:${slug}:${modelId}`;
}

async function isCandidateInCooldown(slug: string, modelId: string): Promise<boolean> {
  const val = await executeUpstashCommand(['GET', cooldownKey(slug, modelId)]);
  return val !== null && val !== undefined && val !== '' && val !== 0;
}

async function tripCandidateCooldown(slug: string, modelId: string): Promise<void> {
  await executeUpstashCommand(['SET', cooldownKey(slug, modelId), '1', 'EX', 600]);
}

function isRateLimitSignal(status: number, bodyText: string): boolean {
  if (status === 429) return true;
  return bodyText.toLowerCase().includes('free usage limit');
}

export async function fetchOpenCodeFreeModels(apiKey?: string): Promise<string[]> {
  const resolvedKey = (apiKey || getEnv('OPENCODE_API_KEY') || '').trim();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (resolvedKey) {
    headers.Authorization = `Bearer ${resolvedKey}`;
  }

  try {
    const res = await fetch('https://opencode.ai/zen/v1/models', {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return [...CURATED_OPENCODE_FREE_MODELS];
    }

    const data = (await res.json()) as {
      data?: Array<{
        id?: string;
        pricing?: { prompt?: string | number };
      }>;
    };

    const models = (data?.data || [])
      .filter((item) => {
        const id = String(item?.id || '').trim();
        if (!id) return false;
        const promptPrice = item?.pricing?.prompt;
        return (
          id.includes('-free') ||
          id === 'big-pickle' ||
          promptPrice === '0' ||
          promptPrice === 0
        );
      })
      .map((item) => String(item.id).trim());

    return models.length > 0 ? Array.from(new Set(models)) : [...CURATED_OPENCODE_FREE_MODELS];
  } catch {
    return [...CURATED_OPENCODE_FREE_MODELS];
  }
}

function buildMessagesWithSystem(messages: ChatMessage[], systemPrompt?: string): ChatMessage[] {
  const cleaned = messages.filter((m) => m.content.trim().length > 0);
  if (!systemPrompt?.trim()) return cleaned;
  return [{ role: 'system', content: systemPrompt.trim() }, ...cleaned];
}

async function callOpenAiCompatible(
  target: CandidateTarget,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<ProviderCallResponse> {
  const baseUrl = (target.baseUrl || defaultBaseUrlForType(target.providerType)).replace(/\/+$/, '');
  if (!baseUrl) {
    return { ok: false, text: '', status: 0, rateLimited: false, error: 'Missing baseUrl' };
  }

  const alias = target.credentialAlias || defaultCredentialAliasForType(target.providerType);
  let token = alias ? getEnv(alias) : '';
  if (target.providerType === 'opencode_free') {
    token = token || 'public';
  } else if (target.providerType === 'local_ollama') {
    token = token || 'ollama';
  } else if (!token && target.providerType !== 'custom_openai') {
    return { ok: false, text: '', status: 0, rateLimited: false, error: `Missing env ${alias}` };
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
  const tryReasoningNone =
    target.disableThinking &&
    (target.providerType === 'opencode_free' || target.providerType === 'local_ollama');

  for (const includeReasoning of tryReasoningNone ? [true, false] : [false]) {
    const body: Record<string, unknown> = {
      model: target.modelId,
      messages,
      temperature,
      max_tokens: maxTokens,
    };
    if (includeReasoning) {
      body.reasoning = { effort: 'none' };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });

      const rawText = await res.text();
      if (!res.ok) {
        if (res.status === 400 && includeReasoning) {
          continue;
        }
        return {
          ok: false,
          text: '',
          status: res.status,
          rateLimited: isRateLimitSignal(res.status, rawText),
          error: `HTTP ${res.status}`,
        };
      }

      const parsed = JSON.parse(rawText) as {
        error?: { message?: string };
        choices?: Array<{
          message?: { content?: string | Array<{ text?: string }> };
        }>;
      };

      if (parsed?.error?.message && isRateLimitSignal(200, parsed.error.message)) {
        return {
          ok: false,
          text: '',
          status: 429,
          rateLimited: true,
          error: parsed.error.message.slice(0, 140),
        };
      }

      const content = parsed?.choices?.[0]?.message?.content;
      const text =
        typeof content === 'string'
          ? content.trim()
          : Array.isArray(content)
            ? content.map((part) => part?.text || '').join('').trim()
            : '';

      if (!text) {
        return { ok: false, text: '', status: res.status, rateLimited: false, error: 'Empty choice' };
      }

      return { ok: true, text, status: res.status, rateLimited: false };
    } catch (err) {
      return {
        ok: false,
        text: '',
        status: 0,
        rateLimited: false,
        error: err instanceof Error ? err.message.slice(0, 120) : 'Network error',
      };
    }
  }

  return { ok: false, text: '', status: 400, rateLimited: false, error: 'Request rejected' };
}

async function callGeminiNative(
  target: CandidateTarget,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<ProviderCallResponse> {
  const alias = target.credentialAlias || 'GEMINI_API_KEY';
  const apiKey = getEnv(alias);
  if (!apiKey) {
    return { ok: false, text: '', status: 0, rateLimited: false, error: `Missing env ${alias}` };
  }

  const baseUrl = (target.baseUrl || 'https://generativelanguage.googleapis.com').replace(/\/+$/, '');
  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
    .trim();

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  const safeContents = contents.length > 0 ? contents : [{ role: 'user', parts: [{ text: 'Olá' }] }];
  const endpoint = `${baseUrl}/v1beta/models/${encodeURIComponent(target.modelId)}:generateContent`;

  for (const includeThinkingConfig of target.disableThinking ? [true, false] : [false]) {
    const generationConfig: Record<string, unknown> = {
      temperature,
      maxOutputTokens: maxTokens,
    };
    if (includeThinkingConfig) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }

    const payload: Record<string, unknown> = {
      contents: safeContents,
      generationConfig,
    };
    if (systemText) {
      payload.systemInstruction = { parts: [{ text: systemText }] };
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });

      const rawText = await res.text();
      if (!res.ok) {
        if (res.status === 400 && includeThinkingConfig) {
          continue;
        }
        return {
          ok: false,
          text: '',
          status: res.status,
          rateLimited: isRateLimitSignal(res.status, rawText),
          error: `HTTP ${res.status}`,
        };
      }

      const data = JSON.parse(rawText) as {
        candidates?: Array<{
          content?: { parts?: Array<{ text?: string }> };
        }>;
      };

      const text = (data?.candidates?.[0]?.content?.parts || [])
        .map((p) => p?.text || '')
        .join('')
        .trim();

      if (!text) {
        return { ok: false, text: '', status: res.status, rateLimited: false, error: 'Empty candidate' };
      }

      return { ok: true, text, status: res.status, rateLimited: false };
    } catch (err) {
      return {
        ok: false,
        text: '',
        status: 0,
        rateLimited: false,
        error: err instanceof Error ? err.message.slice(0, 120) : 'Network error',
      };
    }
  }

  return { ok: false, text: '', status: 400, rateLimited: false, error: 'Gemini rejected request' };
}

async function callAnthropic(
  target: CandidateTarget,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<ProviderCallResponse> {
  const alias = target.credentialAlias || 'ANTHROPIC_API_KEY';
  const apiKey = getEnv(alias);
  if (!apiKey) {
    return { ok: false, text: '', status: 0, rateLimited: false, error: `Missing env ${alias}` };
  }

  const rawBase = (target.baseUrl || 'https://api.anthropic.com').replace(/\/+$/, '');
  const baseUrl = rawBase.endsWith('/v1') ? rawBase.slice(0, -3) : rawBase;
  const systemText = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n')
    .trim();

  const nonSystem = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

  const payload: Record<string, unknown> = {
    model: target.modelId,
    max_tokens: maxTokens,
    temperature,
    messages: nonSystem.length > 0 ? nonSystem : [{ role: 'user', content: 'Olá' }],
  };
  if (systemText) {
    payload.system = systemText;
  }

  try {
    const res = await fetch(`${baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000),
    });

    const rawText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        text: '',
        status: res.status,
        rateLimited: isRateLimitSignal(res.status, rawText),
        error: `HTTP ${res.status}`,
      };
    }

    const data = JSON.parse(rawText) as {
      content?: Array<{ type?: string; text?: string }>;
    };

    const text = (data?.content || [])
      .filter((c) => c?.type === 'text')
      .map((c) => c?.text || '')
      .join('\n')
      .trim();

    if (!text) {
      return { ok: false, text: '', status: res.status, rateLimited: false, error: 'Empty content' };
    }

    return { ok: true, text, status: res.status, rateLimited: false };
  } catch (err) {
    return {
      ok: false,
      text: '',
      status: 0,
      rateLimited: false,
      error: err instanceof Error ? err.message.slice(0, 120) : 'Network error',
    };
  }
}

async function dispatchToProvider(
  target: CandidateTarget,
  messages: ChatMessage[],
  temperature: number,
  maxTokens: number,
): Promise<ProviderCallResponse> {
  if (target.providerType === 'anthropic') {
    return callAnthropic(target, messages, temperature, maxTokens);
  }

  if (target.providerType === 'gemini' || target.providerType === 'gemma_cloud') {
    if (target.baseUrl.includes('/openai')) {
      return callOpenAiCompatible(target, messages, temperature, maxTokens);
    }
    return callGeminiNative(target, messages, temperature, maxTokens);
  }

  return callOpenAiCompatible(target, messages, temperature, maxTokens);
}

function buildDeterministicPtBrFallback(messages: ChatMessage[]): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content || '';
  const lower = lastUser.toLowerCase();

  if (/\b(sair|parar|stop|cancelar|nao quero|não quero|remover)\b/i.test(lower)) {
    return 'Entendido! Já removemos seu contato da nossa lista. Desculpe qualquer incômodo!';
  }
  if (/\b(humano|atendente|suporte|vendedor|fechar plano)\b/i.test(lower)) {
    return 'Perfeito! Vou encaminhar seu atendimento para nossa equipe comercial no WhatsApp (11) 98011-3936.';
  }
  if (/\b(preço|preco|valor|plano|mensalidade|quanto)\b/i.test(lower)) {
    return 'Temos planos para profissionais autônomos e clínicas completas, com teste gratuito. Posso agendar uma demonstração rápida de 10 minutos para te mostrar?';
  }
  if (/\b(agendar|demo|demonstração|demonstracao|reunião|horário)\b/i.test(lower)) {
    return 'Ótimo! Qual o melhor dia e período (manhã ou tarde) para fazermos uma demonstração rápida de 10 minutos?';
  }

  return 'Olá! Recebi sua mensagem. O Pluri Fisio reúne prontuário SOAP, agenda multi-turno, termos digitais e gestão financeira. Como posso te ajudar hoje?';
}

export async function invokeUniversalLlm(params: UniversalChatParams): Promise<UniversalChatResult> {
  const startedAt = Date.now();
  const temperature = typeof params.temperature === 'number' ? params.temperature : 0.55;
  const maxTokens = typeof params.maxTokens === 'number' ? params.maxTokens : 450;
  const fullMessages = buildMessagesWithSystem(params.messages, params.systemPrompt);

  const primaryDisableThinking =
    params.disableThinking ?? params.provider.disableThinkingDefault ?? true;

  const candidates: CandidateTarget[] = [
    {
      slug: params.provider.slug,
      providerType: params.provider.providerType,
      modelId: (params.modelId || params.provider.defaultModel).trim(),
      baseUrl: params.provider.baseUrl || defaultBaseUrlForType(params.provider.providerType),
      credentialAlias:
        params.provider.credentialAlias || defaultCredentialAliasForType(params.provider.providerType),
      disableThinking: primaryDisableThinking,
    },
    ...(params.fallbackChain || []).map((entry) => ({
      slug: entry.providerSlug,
      providerType: entry.providerType,
      modelId: entry.modelId,
      baseUrl: entry.baseUrl || defaultBaseUrlForType(entry.providerType),
      credentialAlias: entry.credentialAlias || defaultCredentialAliasForType(entry.providerType),
      disableThinking: entry.disableThinking ?? primaryDisableThinking,
    })),
  ];

  let trippedCooldown = false;
  let lastError = '';

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    if (!candidate.modelId) continue;

    const coolingDown = await isCandidateInCooldown(candidate.slug, candidate.modelId);
    if (coolingDown) {
      lastError = 'Circuit breaker cooldown active';
      continue;
    }

    const res = await dispatchToProvider(candidate, fullMessages, temperature, maxTokens);
    if (res.ok && res.text) {
      const latencyMs = Date.now() - startedAt;
      void ingestToAxiom([
        {
          level: 'info',
          service: 'pluri-marketing-llm-gateway',
          route: params.route || 'universal-llm-gateway',
          message: 'Universal LLM response generated',
          metadata: {
            provider_slug: candidate.slug,
            provider_type: candidate.providerType,
            model: candidate.modelId,
            used_fallback: i > 0,
            latency_ms: latencyMs,
            tenant_scope: params.tenantScope || 'platform',
          },
        },
      ]);

      return {
        text: res.text,
        providerSlug: candidate.slug,
        modelUsed: candidate.modelId,
        usedFallback: i > 0,
        latencyMs,
        trippedCooldown,
      };
    }

    lastError = res.error || `HTTP ${res.status}`;
    if (res.rateLimited) {
      trippedCooldown = true;
      await tripCandidateCooldown(candidate.slug, candidate.modelId);
    }
  }

  const latencyMs = Date.now() - startedAt;
  void ingestToAxiom([
    {
      level: 'warn',
      service: 'pluri-marketing-llm-gateway',
      route: params.route || 'universal-llm-gateway',
      message: 'All LLM providers failed; deterministic PT-BR fallback used',
      metadata: {
        primary_slug: params.provider.slug,
        tripped_cooldown: trippedCooldown,
        last_error: lastError,
        latency_ms: latencyMs,
        tenant_scope: params.tenantScope || 'platform',
      },
    },
  ]);

  return {
    text: buildDeterministicPtBrFallback(fullMessages),
    providerSlug: 'deterministic-fallback',
    modelUsed: 'deterministic-fallback',
    usedFallback: true,
    latencyMs,
    trippedCooldown,
    error: lastError,
  };
}

function extractJsonObject(raw: string): Record<string, unknown> | null {
  const stripped = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  try {
    const direct = JSON.parse(stripped) as Record<string, unknown>;
    if (direct && typeof direct === 'object') return direct;
  } catch {
    // Try substring extraction
  }

  const start = stripped.indexOf('{');
  const end = stripped.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      const sliced = JSON.parse(stripped.slice(start, end + 1)) as Record<string, unknown>;
      if (sliced && typeof sliced === 'object') return sliced;
    } catch {
      return null;
    }
  }
  return null;
}

function deterministicCompactFallback(
  previousSummary: string,
  previousFacts: Record<string, unknown>,
  turns: CompactTurn[],
): { summary: string; facts: Record<string, unknown> } {
  const mergedFacts: Record<string, unknown> = { ...previousFacts };
  const joinedText = turns.map((t) => `${t.role}: ${t.text}`).join('\n');

  const nameMatch = joinedText.match(/(?:meu nome é|me chamo|sou o|sou a)\s+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+)?)/i);
  if (nameMatch?.[1]) mergedFacts.nome = nameMatch[1].trim();

  const clinicMatch = joinedText.match(/(?:clínica|clinica|estúdio|estudio)\s+([A-ZÀ-Úa-zà-ú0-9\s]{2,35})/i);
  if (clinicMatch?.[1]) mergedFacts.clinica = clinicMatch[1].trim();

  const painMatch = joinedText.match(/\b(prontuário|prontuario|agenda|repasse|financeiro|cobrança|whatsapp|planilha)\b/i);
  if (painMatch?.[1]) mergedFacts.dor_principal = painMatch[1].toLowerCase();

  if (/\b(demo|demonstração|demonstracao|agendar|preço|preco|plano)\b/i.test(joinedText)) {
    mergedFacts.interesse = 'alto_comercial';
  }

  const recentSnippets = turns
    .slice(-4)
    .map((t) => `${t.role === 'lead' || t.role === 'user' ? 'Lead' : 'Atendente'}: ${t.text.replace(/\s+/g, ' ').slice(0, 120)}`)
    .join(' | ');

  const combined = [previousSummary?.trim(), recentSnippets].filter(Boolean).join(' — ');
  const summary = combined.slice(0, 850);

  return { summary, facts: mergedFacts };
}

export async function compactConversationContext(
  params: CompactContextParams,
): Promise<CompactContextResult> {
  const prevSummary = (params.previousSummary || '').trim();
  const prevFacts = params.previousFacts || {};

  if (!params.turns || params.turns.length === 0) {
    return {
      summary: prevSummary,
      facts: prevFacts,
      usedFallback: false,
      modelUsed: 'noop',
    };
  }

  const defaultProvider: LlmProviderConfig = params.provider || {
    slug: 'opencode-free',
    providerType: 'opencode_free',
    baseUrl: 'https://opencode.ai/zen/v1',
    credentialAlias: 'OPENCODE_API_KEY',
    defaultModel: 'deepseek-v4.1-flash-free',
    disableThinkingDefault: true,
    isFreeTier: true,
  };

  const formattedTurns = params.turns
    .map((t) => `[${t.role}]: ${t.text.replace(/\s+/g, ' ').slice(0, 500)}`)
    .join('\n');

  const prompt = [
    'Você é um compactador de contexto clínico/comercial em Português do Brasil.',
    'Extraia fatos objetivos e gere um resumo factual com NO MÁXIMO 250 tokens (~850 caracteres).',
    'Responda ESTRITAMENTE em JSON válido no formato: {"summary":"...","facts":{"nome":null,"clinica":null,"cidade":null,"dor_principal":null,"interesse":null,"proximo_passo":null}}',
    prevSummary ? `Resumo anterior: ${prevSummary}` : '',
    Object.keys(prevFacts).length > 0 ? `Fatos anteriores: ${JSON.stringify(prevFacts)}` : '',
    `Turnos recentes:\n${formattedTurns}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  const llmRes = await invokeUniversalLlm({
    provider: defaultProvider,
    modelId: params.modelId || defaultProvider.defaultModel,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    maxTokens: 350,
    disableThinking: true,
    fallbackChain: params.fallbackChain,
    route: 'context-compaction',
  });

  if (llmRes.providerSlug !== 'deterministic-fallback') {
    const parsed = extractJsonObject(llmRes.text);
    const parsedSummary = typeof parsed?.summary === 'string' ? parsed.summary.trim() : '';
    const parsedFacts =
      parsed?.facts && typeof parsed.facts === 'object' && !Array.isArray(parsed.facts)
        ? (parsed.facts as Record<string, unknown>)
        : null;

    if (parsedSummary) {
      return {
        summary: parsedSummary.slice(0, 900),
        facts: { ...prevFacts, ...(parsedFacts || {}) },
        usedFallback: llmRes.usedFallback,
        modelUsed: llmRes.modelUsed,
      };
    }
  }

  const fallback = deterministicCompactFallback(prevSummary, prevFacts, params.turns);
  return {
    summary: fallback.summary,
    facts: fallback.facts,
    usedFallback: true,
    modelUsed: 'deterministic-compactor',
  };
}
