export type WorkerLlmProviderType =
  | 'local_ollama'
  | 'opencode_free'
  | 'gemini'
  | 'gemma_cloud'
  | 'groq'
  | 'openai'
  | 'anthropic'
  | 'openrouter'
  | 'custom_openai';

export interface LlmWorkerRequest {
  provider: WorkerLlmProviderType;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

export interface LlmWorkerResponse {
  ok: boolean;
  text: string;
  provider: WorkerLlmProviderType;
  model: string;
  error?: string;
}

const DEFAULT_MODELS: Record<WorkerLlmProviderType, string> = {
  local_ollama: 'gemma4:e4b',
  opencode_free: 'deepseek-v4.1-flash-free',
  gemini: 'gemini-2.5-flash-lite',
  gemma_cloud: 'gemma4:cloud',
  groq: 'llama-3.1-8b-instant',
  openai: 'gpt-4.1-mini',
  anthropic: 'claude-3-5-haiku-latest',
  openrouter: 'meta-llama/llama-3.3-70b-instruct:free',
  custom_openai: 'gpt-4.1-mini',
};

function resolveBaseUrl(provider: WorkerLlmProviderType, override?: string): string {
  const cleaned = (override || '').trim().replace(/\/+$/, '');
  if (cleaned) return cleaned;
  switch (provider) {
    case 'local_ollama':
      return (process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434/v1').trim().replace(/\/+$/, '');
    case 'opencode_free':
      return 'https://opencode.ai/zen/v1';
    case 'groq':
      return 'https://api.groq.com/openai/v1';
    case 'openai':
      return 'https://api.openai.com/v1';
    case 'openrouter':
      return 'https://openrouter.ai/api/v1';
    case 'anthropic':
      return 'https://api.anthropic.com';
    case 'gemini':
    case 'gemma_cloud':
      return 'https://generativelanguage.googleapis.com';
    case 'custom_openai':
      return (process.env.CUSTOM_OPENAI_BASE_URL || 'http://127.0.0.1:11434/v1').trim().replace(/\/+$/, '');
  }
}

function resolveApiKey(provider: WorkerLlmProviderType, override?: string): string {
  if (override && override.trim()) return override.trim();
  switch (provider) {
    case 'opencode_free':
      return (process.env.OPENCODE_API_KEY || 'public').trim() || 'public';
    case 'local_ollama':
      return (process.env.OLLAMA_API_KEY || 'ollama').trim();
    case 'gemini':
    case 'gemma_cloud':
      return (process.env.GEMINI_API_KEY || '').trim();
    case 'groq':
      return (process.env.GROQ_API_KEY || '').trim();
    case 'openai':
      return (process.env.OPENAI_API_KEY || '').trim();
    case 'anthropic':
      return (process.env.ANTHROPIC_API_KEY || '').trim();
    case 'openrouter':
      return (process.env.OPENROUTER_API_KEY || '').trim();
    case 'custom_openai':
      return (process.env.CUSTOM_OPENAI_API_KEY || '').trim();
  }
}

async function callGeminiCompatible(
  req: LlmWorkerRequest,
  model: string,
  baseUrl: string,
  apiKey: string,
): Promise<LlmWorkerResponse> {
  if (!apiKey) {
    return { ok: false, text: '', provider: req.provider, model, error: 'Missing GEMINI_API_KEY' };
  }

  const endpoint = `${baseUrl}/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const payload: Record<string, unknown> = {
    systemInstruction: { parts: [{ text: req.systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: req.userPrompt }] }],
    generationConfig: {
      temperature: req.temperature ?? 0.65,
      maxOutputTokens: req.maxTokens ?? 220,
      thinkingConfig: { thinkingBudget: 0 },
    },
  };

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(req.timeoutMs ?? 20_000),
  });

  if (!res.ok) {
    return { ok: false, text: '', provider: req.provider, model, error: `HTTP ${res.status}` };
  }

  const data = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  return text
    ? { ok: true, text, provider: req.provider, model }
    : { ok: false, text: '', provider: req.provider, model, error: 'Empty response' };
}

async function callAnthropic(
  req: LlmWorkerRequest,
  model: string,
  baseUrl: string,
  apiKey: string,
): Promise<LlmWorkerResponse> {
  if (!apiKey) {
    return { ok: false, text: '', provider: req.provider, model, error: 'Missing ANTHROPIC_API_KEY' };
  }

  const res = await fetch(`${baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      system: req.systemPrompt,
      max_tokens: req.maxTokens ?? 220,
      temperature: req.temperature ?? 0.65,
      messages: [{ role: 'user', content: req.userPrompt }],
    }),
    signal: AbortSignal.timeout(req.timeoutMs ?? 20_000),
  });

  if (!res.ok) {
    return { ok: false, text: '', provider: req.provider, model, error: `HTTP ${res.status}` };
  }

  const data = (await res.json()) as { content?: Array<{ type?: string; text?: string }> };
  const text = (data.content?.find((c) => c.type === 'text')?.text || '').trim();
  return text
    ? { ok: true, text, provider: req.provider, model }
    : { ok: false, text: '', provider: req.provider, model, error: 'Empty response' };
}

async function callOpenAiCompatible(
  req: LlmWorkerRequest,
  model: string,
  baseUrl: string,
  apiKey: string,
): Promise<LlmWorkerResponse> {
  if (!apiKey && req.provider !== 'local_ollama' && req.provider !== 'opencode_free') {
    return { ok: false, text: '', provider: req.provider, model, error: `Missing API key for ${req.provider}` };
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model,
      temperature: req.temperature ?? 0.65,
      max_tokens: req.maxTokens ?? 220,
      messages: [
        { role: 'system', content: req.systemPrompt },
        { role: 'user', content: req.userPrompt },
      ],
    }),
    signal: AbortSignal.timeout(req.timeoutMs ?? 20_000),
  });

  if (!res.ok) {
    return { ok: false, text: '', provider: req.provider, model, error: `HTTP ${res.status}` };
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = (data.choices?.[0]?.message?.content || '').trim();
  return text
    ? { ok: true, text, provider: req.provider, model }
    : { ok: false, text: '', provider: req.provider, model, error: 'Empty response' };
}

/**
 * Executa uma chamada de completion contra provedores leves (Ollama local, OpenCode Free, Gemini sem thinking, Groq, OpenAI ou Anthropic).
 */
export async function generateWorkerCompletion(req: LlmWorkerRequest): Promise<LlmWorkerResponse> {
  const model = (req.model || '').trim() || DEFAULT_MODELS[req.provider];
  const baseUrl = resolveBaseUrl(req.provider, req.baseUrl);
  const apiKey = resolveApiKey(req.provider, req.apiKey);

  try {
    if (req.provider === 'gemini' || req.provider === 'gemma_cloud') {
      return await callGeminiCompatible(req, model, baseUrl, apiKey);
    }
    if (req.provider === 'anthropic') {
      return await callAnthropic(req, model, baseUrl, apiKey);
    }
    return await callOpenAiCompatible(req, model, baseUrl, apiKey);
  } catch (err) {
    return {
      ok: false,
      text: '',
      provider: req.provider,
      model,
      error: err instanceof Error ? err.message : 'Unknown LLM error',
    };
  }
}

/**
 * Executa uma cadeia ordenada de fallback até obter uma resposta não-vazia.
 */
export async function generateWithFallback(
  chain: Array<{ provider: WorkerLlmProviderType; model?: string; baseUrl?: string }>,
  systemPrompt: string,
  userPrompt: string,
  options?: { temperature?: number; maxTokens?: number; timeoutMs?: number },
): Promise<LlmWorkerResponse> {
  let lastResult: LlmWorkerResponse = {
    ok: false,
    text: '',
    provider: 'opencode_free',
    model: DEFAULT_MODELS.opencode_free,
    error: 'Empty provider chain',
  };

  for (const item of chain) {
    const result = await generateWorkerCompletion({
      provider: item.provider,
      model: item.model,
      baseUrl: item.baseUrl,
      systemPrompt,
      userPrompt,
      temperature: options?.temperature,
      maxTokens: options?.maxTokens,
      timeoutMs: options?.timeoutMs,
    });
    if (result.ok && result.text) return result;
    lastResult = result;
  }

  return lastResult;
}
