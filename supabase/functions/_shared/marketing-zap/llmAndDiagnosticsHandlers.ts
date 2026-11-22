import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import {
  compactConversationContext,
  fetchOpenCodeFreeModels,
  invokeUniversalLlm,
  type FallbackEntry,
  type LlmProviderConfig,
  type LlmProviderType,
} from '../llm-gateway.ts';

export interface EvolutionConfig {
  baseUrl: string;
  apiKey: string;
  configured: boolean;
}

export type CallEvolutionFn = (
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body?: unknown,
) => Promise<{ ok: boolean; status: number; data: Record<string, unknown> }>;

export type JsonResponderFn = (body: unknown, status?: number) => Response;

export interface ZapHandlerContext {
  admin: SupabaseClient;
  body: Record<string, unknown>;
  req: Request;
  callEvolution: CallEvolutionFn;
  getEvolutionConfig: () => EvolutionConfig;
  json: JsonResponderFn;
}

export interface KeywordTriggerMatch {
  id: string;
  name: string;
  match_type: 'exact' | 'contains' | 'starts_with' | 'regex';
  pattern: string;
  action_type: 'reply_text' | 'reply_media' | 'start_flow' | 'switch_agent' | 'handoff_human' | 'move_stage';
  action_payload: Record<string, unknown>;
  priority: number;
  hit_count: number;
}

export function normalizePhoneBr(raw?: string | null): string {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const DEFAULT_PROVIDER_CONFIG: LlmProviderConfig = {
  slug: 'opencode-free',
  providerType: 'opencode_free',
  baseUrl: 'https://opencode.ai/zen/v1',
  credentialAlias: 'OPENCODE_API_KEY',
  defaultModel: 'deepseek-v4.1-flash-free',
  disableThinkingDefault: true,
  isFreeTier: true,
};

export const DEFAULT_FALLBACK_CHAIN: FallbackEntry[] = [
  { providerSlug: 'gemini-flash-lite-default', providerType: 'gemini', modelId: 'gemini-2.5-flash-lite', credentialAlias: 'GEMINI_API_KEY', disableThinking: true },
  { providerSlug: 'gemma4-cloud', providerType: 'gemma_cloud', modelId: 'gemma4:cloud', credentialAlias: 'GEMINI_API_KEY', disableThinking: true },
  { providerSlug: 'groq-fast', providerType: 'groq', modelId: 'llama-3.1-8b-instant', credentialAlias: 'GROQ_API_KEY', disableThinking: true },
];

export function mapDbProviderToConfig(row: Record<string, unknown>): LlmProviderConfig {
  return {
    slug: String(row.slug || 'opencode-free'),
    providerType: String(row.provider_type || 'opencode_free') as LlmProviderType,
    baseUrl: String(row.base_url || ''),
    credentialAlias: String(row.credential_alias || ''),
    defaultModel: String(row.default_model || 'deepseek-v4.1-flash-free'),
    disableThinkingDefault: row.disable_thinking_default !== false,
    isFreeTier: Boolean(row.is_free_tier),
  };
}

export async function resolveAgentLlmSetup(
  admin: SupabaseClient,
  agentRow: Record<string, unknown> | null,
  overrides?: {
    provider_slug?: string;
    provider_type?: string;
    model_id?: string;
    base_url?: string;
    disable_thinking?: boolean;
    fallback_chain?: unknown;
  },
): Promise<{ provider: LlmProviderConfig; modelId: string; disableThinking: boolean; fallbackChain: FallbackEntry[] }> {
  let provider: LlmProviderConfig = { ...DEFAULT_PROVIDER_CONFIG };

  if (overrides?.provider_slug) {
    const { data } = await admin.from('marketing_llm_providers').select('*').eq('slug', overrides.provider_slug).is('deleted_at', null).maybeSingle();
    if (data) provider = mapDbProviderToConfig(data as Record<string, unknown>);
    else if (overrides.provider_type) {
      provider = {
        slug: overrides.provider_slug,
        providerType: overrides.provider_type as LlmProviderType,
        baseUrl: overrides.base_url || '',
        defaultModel: overrides.model_id || DEFAULT_PROVIDER_CONFIG.defaultModel,
        disableThinkingDefault: overrides.disable_thinking ?? true,
      };
    }
  } else if (agentRow?.llm_provider_id) {
    const { data } = await admin.from('marketing_llm_providers').select('*').eq('id', String(agentRow.llm_provider_id)).is('deleted_at', null).maybeSingle();
    if (data) provider = mapDbProviderToConfig(data as Record<string, unknown>);
  } else {
    const { data } = await admin.from('marketing_llm_providers').select('*').eq('is_enabled', true).is('deleted_at', null).order('priority_order', { ascending: true }).limit(1).maybeSingle();
    if (data) provider = mapDbProviderToConfig(data as Record<string, unknown>);
  }

  if (overrides?.base_url) provider.baseUrl = overrides.base_url;
  const modelId = String(overrides?.model_id || agentRow?.llm_model_id || provider.defaultModel).trim();
  const disableThinking = typeof overrides?.disable_thinking === 'boolean'
    ? overrides.disable_thinking
    : typeof agentRow?.disable_thinking === 'boolean'
      ? Boolean(agentRow.disable_thinking)
      : provider.disableThinkingDefault ?? true;

  const rawChain = Array.isArray(overrides?.fallback_chain)
    ? overrides.fallback_chain
    : Array.isArray(agentRow?.fallback_chain) && (agentRow.fallback_chain as unknown[]).length > 0
      ? (agentRow.fallback_chain as unknown[])
      : null;

  const fallbackChain: FallbackEntry[] = rawChain
    ? rawChain
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          providerSlug: String(item.providerSlug || item.provider_slug || 'opencode-free'),
          providerType: String(item.providerType || item.provider_type || 'opencode_free') as LlmProviderType,
          modelId: String(item.modelId || item.model_id || 'deepseek-v4.1-flash-free'),
          baseUrl: item.baseUrl || item.base_url ? String(item.baseUrl || item.base_url) : undefined,
          credentialAlias: item.credentialAlias || item.credential_alias ? String(item.credentialAlias || item.credential_alias) : undefined,
          disableThinking: typeof item.disableThinking === 'boolean' ? item.disableThinking : disableThinking,
        }))
    : DEFAULT_FALLBACK_CHAIN.filter((f) => f.providerSlug !== provider.slug);

  return { provider, modelId, disableThinking, fallbackChain };
}

export async function matchActiveKeywordTrigger(
  admin: SupabaseClient,
  inboundText: string,
  tenantScope = 'platform',
  instanceId?: string | null,
): Promise<KeywordTriggerMatch | null> {
  const normalized = inboundText.trim();
  if (!normalized) return null;

  const { data: rows } = await admin
    .from('marketing_keyword_triggers')
    .select('id, name, instance_id, match_type, pattern, action_type, action_payload, priority, hit_count')
    .eq('tenant_scope', tenantScope)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('priority', { ascending: true });

  const lower = normalized.toLowerCase();
  for (const row of (rows || []) as Array<Record<string, unknown>>) {
    if (row.instance_id && instanceId && String(row.instance_id) !== instanceId) continue;
    const pattern = String(row.pattern || '').trim();
    if (!pattern) continue;
    const matchType = String(row.match_type || 'contains') as KeywordTriggerMatch['match_type'];
    const pLower = pattern.toLowerCase();
    let matched = false;
    if (matchType === 'exact') matched = lower === pLower;
    else if (matchType === 'contains') matched = lower.includes(pLower);
    else if (matchType === 'starts_with') matched = lower.startsWith(pLower);
    else if (matchType === 'regex') {
      try { matched = new RegExp(pattern, 'i').test(normalized); } catch { matched = false; }
    }
    if (matched) {
      return {
        id: String(row.id),
        name: String(row.name || ''),
        match_type: matchType,
        pattern,
        action_type: String(row.action_type) as KeywordTriggerMatch['action_type'],
        action_payload: (row.action_payload as Record<string, unknown>) || {},
        priority: Number(row.priority || 10),
        hit_count: Number(row.hit_count || 0),
      };
    }
  }
  return null;
}

export async function runCompactionForConversation(
  admin: SupabaseClient,
  conversation: Record<string, unknown>,
  keepLastTurns = 4,
  providerOverride?: LlmProviderConfig,
) {
  const conversationId = String(conversation.id);
  const { data: uncompacted } = await admin
    .from('marketing_zap_messages')
    .select('id, direction, sender_role, body_text, created_at')
    .eq('conversation_id', conversationId)
    .eq('is_compacted', false)
    .order('created_at', { ascending: true });

  const rows = (uncompacted || []) as Array<Record<string, unknown>>;
  const safeKeep = Math.max(1, keepLastTurns);
  const prevSummary = String(conversation.rolling_summary || '');
  const prevFacts = (conversation.structured_facts as Record<string, unknown>) || {};

  if (rows.length <= safeKeep) {
    const est = Math.ceil((prevSummary.length + rows.reduce((s, m) => s + String(m.body_text || '').length, 0)) / 4);
    return { compacted: false, compactedCount: 0, rollingSummary: prevSummary, structuredFacts: prevFacts, contextTokensEst: est, modelUsed: 'noop' };
  }

  const cutoff = rows.length - safeKeep;
  const older = rows.slice(0, cutoff);
  const kept = rows.slice(cutoff);

  const compactRes = await compactConversationContext({
    previousSummary: prevSummary,
    previousFacts: prevFacts,
    turns: older.map((m) => ({
      role: m.sender_role === 'lead' || m.direction === 'inbound' ? 'lead' : 'assistant',
      text: String(m.body_text || ''),
    })),
    provider: providerOverride || DEFAULT_PROVIDER_CONFIG,
    fallbackChain: DEFAULT_FALLBACK_CHAIN,
  });

  const olderIds = older.map((m) => String(m.id));
  await admin.from('marketing_zap_messages').update({ is_compacted: true }).in('id', olderIds);

  const tokensEst = Math.ceil((compactRes.summary.length + kept.reduce((s, m) => s + String(m.body_text || '').length, 0)) / 4);
  await admin.from('marketing_zap_conversations').update({
    rolling_summary: compactRes.summary,
    structured_facts: compactRes.facts,
    compaction_count: Number(conversation.compaction_count || 0) + 1,
    context_tokens_est: tokensEst,
    compacted_up_to_msg_id: olderIds[olderIds.length - 1] || null,
  }).eq('id', conversationId);

  return {
    compacted: true,
    compactedCount: older.length,
    rollingSummary: compactRes.summary,
    structuredFacts: compactRes.facts,
    contextTokensEst: tokensEst,
    modelUsed: compactRes.modelUsed,
  };
}

export async function handleSyncLlmModels({ admin, body, json }: ZapHandlerContext): Promise<Response> {
  const slug = String(body.slug || 'opencode-free').trim();
  const models = await fetchOpenCodeFreeModels();
  const nowIso = new Date().toISOString();
  await admin.from('marketing_llm_providers').update({ cached_models_json: models, last_synced_at: nowIso }).eq('slug', 'opencode-free').is('deleted_at', null);

  if (slug !== 'opencode-free') {
    const { data: prov } = await admin.from('marketing_llm_providers').select('cached_models_json').eq('slug', slug).is('deleted_at', null).maybeSingle();
    if (prov && Array.isArray(prov.cached_models_json) && prov.cached_models_json.length > 0) {
      return json({ success: true, models: prov.cached_models_json, synced_at: nowIso });
    }
  }
  return json({ success: true, models, synced_at: nowIso });
}

export async function handleTestLlmProvider({ admin, body, json }: ZapHandlerContext): Promise<Response> {
  let provider: LlmProviderConfig = { ...DEFAULT_PROVIDER_CONFIG };
  const bodyProvider = body.provider;

  if (bodyProvider && typeof bodyProvider === 'object' && !Array.isArray(bodyProvider)) {
    const p = bodyProvider as Record<string, unknown>;
    provider = {
      slug: String(p.slug || 'custom-test'),
      providerType: String(p.providerType || p.provider_type || 'opencode_free') as LlmProviderType,
      baseUrl: String(p.baseUrl || p.base_url || ''),
      credentialAlias: String(p.credentialAlias || p.credential_alias || ''),
      defaultModel: String(p.defaultModel || p.default_model || p.modelId || 'deepseek-v4.1-flash-free'),
      disableThinkingDefault: true,
    };
  } else {
    const lookupSlug = String((typeof bodyProvider === 'string' ? bodyProvider : '') || body.provider_slug || body.slug || '').trim();
    const providerId = String(body.provider_id || '').trim();
    const q = admin.from('marketing_llm_providers').select('*').is('deleted_at', null);
    const { data } = providerId ? await q.eq('id', providerId).maybeSingle() : lookupSlug ? await q.eq('slug', lookupSlug).maybeSingle() : await q.eq('is_enabled', true).order('priority_order', { ascending: true }).limit(1).maybeSingle();
    if (data) provider = mapDbProviderToConfig(data as Record<string, unknown>);
  }

  const modelId = String(body.model_id || body.modelId || provider.defaultModel).trim();
  const result = await invokeUniversalLlm({
    provider,
    modelId,
    messages: [{ role: 'user', content: String(body.message || 'Responda apenas: OK Pluri Zap conectado.') }],
    disableThinking: true,
    maxTokens: 64,
    temperature: 0.2,
    route: 'test-llm-provider',
  });

  return json({ success: true, reply: result.text, modelUsed: result.modelUsed, latencyMs: result.latencyMs, usedFallback: result.usedFallback, providerSlug: result.providerSlug, error: result.error });
}

export async function handleRequestPairingCode({ admin, body, callEvolution, getEvolutionConfig, json }: ZapHandlerContext): Promise<Response> {
  const instanceKey = String(body.instance_key || 'pluri-mkt-5511965120431').trim();
  const phoneDigits = normalizePhoneBr(String(body.phone_e164 || body.phone || ''));
  if (!phoneDigits || phoneDigits.length < 10) return json({ error: 'phone_e164 válido (apenas dígitos) é obrigatório.' }, 400);

  if (!getEvolutionConfig().configured) {
    return json({
      success: true,
      configured: false,
      instance_key: instanceKey,
      setupHint: 'Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no Pulumi ESC / Supabase Secrets e suba infra/marketing-node/docker-compose.marketing.yml para gerar o código de pareamento.',
    });
  }

  await callEvolution('/instance/create', 'POST', { instanceName: instanceKey, qrcode: false, number: phoneDigits, integration: 'WHATSAPP-BAILEYS' });
  const connectRes = await callEvolution(`/instance/connect/${encodeURIComponent(instanceKey)}?number=${encodeURIComponent(phoneDigits)}`, 'GET');
  const qrObj = (connectRes.data.qrcode || {}) as Record<string, unknown>;
  const pairingCode = String(connectRes.data.pairingCode || connectRes.data.code || qrObj.pairingCode || qrObj.code || '').trim();

  await admin.from('marketing_whatsapp_instances').update({ pairing_code: pairingCode || null, status: pairingCode ? 'qr_ready' : 'connecting', last_error: null }).eq('instance_key', instanceKey);
  return json({ success: true, configured: true, instance_key: instanceKey, pairingCode: pairingCode || null });
}

function metricStatus(score: number, maxScore: number): 'ok' | 'warn' | 'risk' {
  const ratio = maxScore > 0 ? score / maxScore : 0;
  return ratio >= 0.75 ? 'ok' : ratio >= 0.45 ? 'warn' : 'risk';
}

export async function handleRunZapDefenderAudit({ admin, body, json }: ZapHandlerContext): Promise<Response> {
  const instanceId = String(body.instance_id || '').trim();
  const instanceKey = String(body.instance_key || 'pluri-mkt-5511965120431').trim();
  const q = admin.from('marketing_whatsapp_instances').select('*').is('deleted_at', null);
  const { data: instance } = instanceId ? await q.eq('id', instanceId).maybeSingle() : await q.eq('instance_key', instanceKey).maybeSingle();
  if (!instance) return json({ error: 'Instância WhatsApp não encontrada.' }, 404);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const optQ = admin.from('marketing_opt_outs').select('id', { count: 'exact', head: true }).eq('tenant_scope', String(instance.tenant_scope || 'platform')).gte('created_at', sevenDaysAgo);

  const [{ data: dispatches }, optRes, { data: convs }] = await Promise.all([
    admin.from('marketing_zap_dispatches').select('status').eq('instance_id', instance.id).gte('created_at', sevenDaysAgo),
    instance.clinic_id ? optQ.eq('clinic_id', instance.clinic_id) : optQ.is('clinic_id', null),
    admin.from('marketing_zap_conversations').select('last_inbound_at, last_message_direction, ai_turns_count').eq('instance_id', instance.id).is('deleted_at', null).gte('updated_at', sevenDaysAgo),
  ]);

  const dispatchRows = (dispatches || []) as Array<{ status: string }>;
  const sent7d = dispatchRows.filter((d) => ['sent', 'delivered', 'replied', 'failed'].includes(d.status)).length;
  const failed7d = dispatchRows.filter((d) => d.status === 'failed').length;
  const repliedDispatches = dispatchRows.filter((d) => d.status === 'replied').length;
  const optOut7d = optRes.count ?? 0;

  const convRows = (convs || []) as Array<Record<string, unknown>>;
  const inboundCount = convRows.filter((c) => Boolean(c.last_inbound_at)).length;
  const outboundCount = convRows.filter((c) => Number(c.ai_turns_count || 0) > 0 || c.last_message_direction === 'outbound').length;
  const replied7d = Math.max(repliedDispatches, inboundCount);

  const warmupDay = Math.max(1, Number(instance.warmup_day || 1));
  const dailyLimit = Math.max(1, Number(instance.daily_limit || 15));
  const dailySent = Math.max(0, Number(instance.daily_sent_count || 0));
  const status = String(instance.status || 'disconnected');
  const recommendations: string[] = [];

  const warmupScore = Math.min(20, Math.round((Math.min(14, warmupDay) / 14) * 20));
  if (warmupScore < 12) recommendations.push('Mantenha o aquecimento gradual antes de escalar disparos em massa.');
  const replyRate = sent7d > 0 ? replied7d / sent7d : inboundCount > 0 ? 0.25 : 0.2;
  const replyScore = sent7d === 0 ? 12 : Math.min(15, Math.round((replyRate / 0.25) * 15));
  if (sent7d >= 20 && replyRate < 0.1) recommendations.push('Taxa de resposta abaixo de 10%: refine a abordagem inicial e use Spintax.');
  const errorRate = sent7d > 0 ? (failed7d / sent7d) * 100 : 0;
  const errorScore = errorRate <= 1 ? 20 : errorRate <= 3 ? 14 : errorRate <= 5 ? 8 : 2;
  if (errorRate > 3) recommendations.push('Valide os números no Filtro Turbo antes de enviar para reduzir falhas.');
  const optOutRate = sent7d > 0 ? (optOut7d / sent7d) * 100 : 0;
  const optOutScore = optOutRate <= 1 ? 20 : optOutRate <= 2.5 ? 14 : optOutRate <= 5 ? 7 : 1;
  if (optOutRate > 2.5) recommendations.push('Opt-out elevado: segmente melhor o ICP e reduza cadência diária.');
  const sessionScore = status === 'connected' || status === 'qr_ready' ? 10 : status === 'connecting' ? 7 : status === 'disconnected' ? 5 : 0;
  if (sessionScore < 7) recommendations.push('Instabilidade de conexão detectada: verifique pareamento e rede do chip.');
  const usedRatio = Math.min(1.2, dailySent / dailyLimit);
  const quotaScore = usedRatio <= 0.7 ? 15 : usedRatio <= 0.9 ? 11 : usedRatio <= 1 ? 6 : 2;
  if (usedRatio > 0.85) recommendations.push('Cota diária próxima do limite: distribua o envio em pool multi-chip.');

  const metrics = [
    { key: 'warmup_maturity', label: 'Maturação do Chip', score: warmupScore, maxScore: 20, status: metricStatus(warmupScore, 20), detail: `Dia ${warmupDay} de aquecimento` },
    { key: 'reply_ratio', label: 'Razão Enviadas/Respondidas', score: replyScore, maxScore: 15, status: metricStatus(replyScore, 15), detail: sent7d > 0 ? `${Math.round(replyRate * 100)}% de resposta em 7d` : `${inboundCount} entrada(s) / ${outboundCount} saída(s)` },
    { key: 'error_rate_7d', label: 'Taxa de Erro 7d', score: errorScore, maxScore: 20, status: metricStatus(errorScore, 20), detail: `${errorRate.toFixed(1)}% de falhas` },
    { key: 'opt_out_rate', label: 'Taxa de Opt-Out LGPD', score: optOutScore, maxScore: 20, status: metricStatus(optOutScore, 20), detail: `${optOutRate.toFixed(1)}% de descadastros (${optOut7d})` },
    { key: 'session_stability', label: 'Estabilidade de Sessão', score: sessionScore, maxScore: 10, status: metricStatus(sessionScore, 10), detail: `Status atual: ${status}` },
    { key: 'daily_quota_margin', label: 'Margem da Cota Diária', score: quotaScore, maxScore: 15, status: metricStatus(quotaScore, 15), detail: `${dailySent}/${dailyLimit} enviados hoje` },
  ];

  const overallScore = Math.max(0, Math.min(100, metrics.reduce((s, m) => s + m.score, 0)));
  const riskLevel = overallScore >= 80 ? 'safe' : overallScore >= 55 ? 'warning' : 'high_risk';
  if (recommendations.length === 0) recommendations.push('Chip saudável e em conformidade anti-ban para operar normalmente.');

  const nowIso = new Date().toISOString();
  const { data: diagRow } = await admin.from('marketing_account_diagnostics').insert({
    instance_id: instance.id,
    overall_score: overallScore,
    risk_level: riskLevel,
    metrics_json: { metrics, sent7d, failed7d, optOut7d, inboundCount, outboundCount },
    recommendations,
  }).select('*').single();

  await admin.from('marketing_whatsapp_instances').update({ health_score: overallScore, last_diagnostic_at: nowIso }).eq('id', instance.id);

  return json({
    success: true,
    report: { id: diagRow?.id || null, instanceId: instance.id, overallScore, riskLevel, metrics, recommendations, createdAt: diagRow?.created_at || nowIso },
  });
}

export async function handleCompactConversationMemory({ admin, body, json }: ZapHandlerContext): Promise<Response> {
  const conversationId = String(body.conversation_id || '').trim();
  if (!conversationId) return json({ error: 'conversation_id é obrigatório.' }, 400);

  const { data: conv } = await admin.from('marketing_zap_conversations').select('*').eq('id', conversationId).is('deleted_at', null).maybeSingle();
  if (!conv) return json({ error: 'Conversa não encontrada.' }, 404);

  const keepLast = Math.max(1, Number(body.keep_last_turns ?? 4));
  const result = await runCompactionForConversation(admin, conv as Record<string, unknown>, keepLast);
  return json({ success: true, ...result });
}
