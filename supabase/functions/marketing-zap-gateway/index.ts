/**
 * Edge Function: marketing-zap-gateway
 *
 * Orquestra o Pluri Zap Suite 16-em-1:
 * - Conexões Evolution API v2 (QR Code / Pairing Code) + Android Bridge (MobZap)
 * - Webhooks inbound com idempotência Redis, Gatilhos 0-token, Multi-LLM e Compaction
 * - Simulação de Agentes IA, ZapDefender, Turbo Filter, Grupos, PushZap e TypeZap
 */

import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import { corsHeaders } from '../_shared/cors.ts';
import { executeUpstashCommand } from '../_shared/schedule-cache.ts';
import { ingestToAxiom } from '../_shared/telemetry-axiom.ts';
import { TelegramClient } from '../_shared/telegram-client.ts';
import {
  checkRateLimit,
  checkRateLimits,
  extractClientIp,
  rateLimitExceededResponse,
  type RateLimitPreset,
} from '../_shared/rate-limit.ts';
import { reportError } from '../_shared/error-dedup.ts';
import { enqueueToQStash } from '../_shared/qstash.ts';
import { classifyIntentDeterministic, classifyMarketingIntent } from '../_shared/gemini-router.ts';
import { invokeUniversalLlm } from '../_shared/llm-gateway.ts';
import {
  handleCompactConversationMemory,
  handleRequestPairingCode,
  handleRunZapDefenderAudit,
  handleSyncLlmModels,
  handleTestLlmProvider,
  matchActiveKeywordTrigger,
  normalizePhoneBr,
  resolveAgentLlmSetup,
  runCompactionForConversation,
  sha256Hex,
  type ZapHandlerContext,
} from '../_shared/marketing-zap/llmAndDiagnosticsHandlers.ts';
import {
  handleEnqueueGroupAction,
  handleExtractGroupMembers,
  handleSendHumanReply,
  handleSendPushAlert,
  handleSyncTypebotBinding,
  handleSyncWhatsappContacts,
  handleSyncWhatsappGroups,
  handleValidateNumbersBatch,
  handleWebhookAndroidBridge,
} from '../_shared/marketing-zap/filterGroupsPushHandlers.ts';
import { lookupSemanticCache, storeSemanticCache } from '../_shared/semantic-cache.ts';
import {
  coalesceBurstMessages,
  transcribeInboundAudio,
  reconcileAutoLeadAndTripleAgenda,
} from '../_shared/marketing-zap/inboundEnhancers.ts';
import {
  hydrateLeadContextForConversation,
  renderPersonalizedCampaignMessage,
} from '../_shared/marketing-zap/leadContextHydrator.ts';
import {
  detectWhatsappAutoReply,
  sanitizeOutboundSalesReply,
} from '../_shared/marketing-zap/salesGuardrail.ts';
import {
  buildCommercialTurnGuidance,
  enqueueOfficialPlansVisualPack,
  enqueueReactiveOutboundText,
  recordWhatsappAutoReplyDetected,
} from '../_shared/marketing-zap/visualCardQueue.ts';
import { WHATSAPP_AGENT_CONSTITUTION_PROMPT } from '../_shared/marketing-zap/pluriProductTruthPack.ts';

const extendedCorsHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, x-evolution-secret, x-android-bridge-secret, apikey`,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' } });

function resolveSpintax(template: string): string {
  let out = template;
  for (let guard = 0; guard < 12; guard++) {
    const next = out.replace(/(?<!\{)\{([^{}]*\|[^{}]*)\}(?!\})/g, (_m, group: string) => {
      const opts = group.split('|');
      return opts[Math.floor(Math.random() * opts.length)] ?? '';
    });
    if (next === out) break;
    out = next;
  }
  return out;
}

function computeGaussianDelaySec(meanSec: number, stddevSec: number): number {
  const u1 = Math.max(1e-7, Math.random());
  const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * Math.random());
  return Math.max(15, Math.min(180, Math.round(meanSec + z0 * stddevSec)));
}

async function authorizePlatformMarketingUser(req: Request, admin: SupabaseClient) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { authorized: false, error: 'Token de autenticação ausente.' };
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return { authorized: false, error: 'Sessão inválida ou expirada.' };

  const userId = userData.user.id;
  const [ownerRes, mktRes, flagRes] = await Promise.all([
    admin.rpc('is_platform_owner', { _user_id: userId }),
    admin.rpc('is_platform_marketing', { _user_id: userId }),
    admin.rpc('has_platform_flag', { _flag: 'marketing', _user_id: userId }),
  ]);
  if (!ownerRes.data && !mktRes.data && !flagRes.data) {
    return { authorized: false, error: 'Acesso restrito à equipe de Marketing/Plataforma.' };
  }
  return { authorized: true, userId };
}

function getEvolutionConfig() {
  const baseUrl = (Deno.env.get('EVOLUTION_API_URL') || '').trim().replace(/\/+$/, '');
  const apiKey = (Deno.env.get('EVOLUTION_API_KEY') || '').trim();
  return { baseUrl, apiKey, configured: Boolean(baseUrl && apiKey) };
}

async function callEvolution(path: string, method: 'GET' | 'POST' | 'DELETE', body?: unknown) {
  const { baseUrl, apiKey } = getEvolutionConfig();
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  let data: Record<string, unknown> = {};
  try { data = (await res.json()) as Record<string, unknown>; } catch { data = {}; }
  return { ok: res.ok, status: res.status, data };
}

async function deliverOrQueueOutboundText(params: {
  admin: SupabaseClient;
  evoConfig: { configured: boolean };
  evoCall: ZapHandlerContext['callEvolution'];
  instanceKey: string;
  instanceId: string | null;
  tenantScope: string;
  clinicId: string | null;
  conversationId: string | null;
  leadId: string | null;
  senderPhone: string;
  msgId: string;
  text: string;
  simulateTyping?: boolean;
}): Promise<{ deliveredDirect: boolean; queuedForWorker: boolean }> {
  const { admin, evoConfig, evoCall, instanceKey, instanceId, tenantScope, clinicId, conversationId, leadId, senderPhone, msgId, text, simulateTyping } = params;
  if (!text.trim()) return { deliveredDirect: false, queuedForWorker: false };
  if (evoConfig.configured) {
    try {
      if (simulateTyping) {
        await evoCall(`/chat/sendPresence/${encodeURIComponent(instanceKey)}`, 'POST', {
          number: senderPhone,
          delay: Math.max(1200, Math.min(8000, text.length * 40)),
          presence: 'composing',
        });
      }
      const res = await evoCall(`/message/sendText/${encodeURIComponent(instanceKey)}`, 'POST', { number: senderPhone, text });
      if (res.ok) return { deliveredDirect: true, queuedForWorker: false };
    } catch {
      // Fallback para fila reativa entregue pelo pluri-marketing-worker local
    }
  }
  const q = await enqueueReactiveOutboundText({
    admin, tenantScope, clinicId, instanceId, conversationId, leadId, phoneE164: senderPhone, messageId: msgId, text,
  });
  return { deliveredDirect: false, queuedForWorker: q.queued };
}

async function handleWebhookEvolution({ admin, body, req, callEvolution: evoCall, getEvolutionConfig: getEvo, json: respond }: ZapHandlerContext): Promise<Response> {
  const expectedSecret = (Deno.env.get('EVOLUTION_WEBHOOK_SECRET') || Deno.env.get('EVOLUTION_API_KEY') || '').trim();
  if (expectedSecret) {
    const provided = req.headers.get('x-evolution-secret') || req.headers.get('apikey') || String(body.apikey || '');
    if (provided !== expectedSecret) return respond({ error: 'Assinatura Evolution inválida.' }, 401);
  }

  const eventName = String(body.event || '').toUpperCase().replace(/\./g, '_');
  const instanceKey = String(body.instance || body.instanceName || 'pluri-mkt-5511965120431');
  const payloadData = (body.data || {}) as Record<string, unknown>;

  if (eventName === 'CONNECTION_UPDATE') {
    const state = String(payloadData.state || '').toLowerCase();
    const mapped = state === 'open' ? 'connected' : state === 'connecting' ? 'connecting' : 'disconnected';
    await admin.from('marketing_whatsapp_instances').update({ status: mapped, ...(mapped === 'connected' ? { last_connected_at: new Date().toISOString() } : {}) }).eq('instance_key', instanceKey);
    return respond({ success: true, event: 'CONNECTION_UPDATE', status: mapped });
  }
  if (eventName && eventName !== 'MESSAGES_UPSERT') {
    return respond({ success: true, ignored: `event_${eventName.toLowerCase()}` });
  }

  const keyObj = (payloadData.key || {}) as Record<string, unknown>;
  if (keyObj.fromMe === true) return respond({ success: true, ignored: 'outbound_echo' });

  const msgId = String(keyObj.id || `${instanceKey}:${Date.now()}`);
  const dedup = await executeUpstashCommand(['SET', `zap:msg:${msgId}`, '1', 'NX', 'EX', 86400]);
  if (dedup === null && Deno.env.get('UPSTASH_REDIS_REST_URL')) return respond({ success: true, deduplicated: true });

  const remoteJid = String(keyObj.remoteJid || '');
  const senderPhone = normalizePhoneBr(remoteJid.split('@')[0]);
  if (!senderPhone || remoteJid.includes('@g.us')) return respond({ success: true, ignored: 'group_or_empty' });

  const rlEvo = await checkRateLimits([
    { preset: 'marketing_zap_webhook_phone', identifier: senderPhone, service: 'marketing-zap-gateway', route: 'webhook_evolution' },
    { preset: 'marketing_zap_webhook_instance', identifier: instanceKey, service: 'marketing-zap-gateway', route: 'webhook_evolution' },
  ]);
  if (!rlEvo.allowed) return rateLimitExceededResponse(rlEvo, extendedCorsHeaders);

  const msgContent = (payloadData.message || {}) as Record<string, unknown>;
  const extText = (msgContent.extendedTextMessage || {}) as Record<string, unknown>;
  let inboundText = String(msgContent.conversation || extText.text || body.text || '').trim();

  const { data: instanceRow } = await admin.from('marketing_whatsapp_instances').select('*').eq('instance_key', instanceKey).is('deleted_at', null).maybeSingle();
  const tenantScope = String(instanceRow?.tenant_scope || 'platform');
  const clinicId = (instanceRow?.clinic_id as string | null) || null;

  const [{ data: agentRow }, { data: existingConv }] = await Promise.all([
    admin.from('marketing_ai_agents').select('*').eq('instance_id', instanceRow?.id || '').eq('is_active', true).is('deleted_at', null).order('created_at', { ascending: true }).limit(1).maybeSingle(),
    admin.from('marketing_zap_conversations').select('*').eq('phone_e164', senderPhone).is('deleted_at', null).order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!inboundText && msgContent.audioMessage && agentRow?.transcribe_audio !== false) {
    const transcribed = await transcribeInboundAudio(msgContent, payloadData, instanceKey, evoCall);
    if (transcribed) inboundText = transcribed;
  }

  if (!inboundText) return respond({ success: true, ignored: 'empty_text' });

  const burstRes = await coalesceBurstMessages(senderPhone, msgId, inboundText, Number(agentRow?.debounce_seconds ?? 0));
  if (!burstRes.proceed) return respond({ success: true, coalesced: true });
  const effectiveText = burstRes.combinedText;

  const leadCtx = await hydrateLeadContextForConversation(
    admin,
    senderPhone,
    (existingConv?.structured_facts as Record<string, unknown> | null) || null,
    existingConv?.lead_id ? String(existingConv.lead_id) : null,
  );

  const { data: conv } = await admin.from('marketing_zap_conversations').upsert({
    id: existingConv?.id, tenant_scope: tenantScope, clinic_id: clinicId, instance_id: instanceRow?.id || null,
    agent_id: agentRow?.id || existingConv?.agent_id || null, lead_id: leadCtx.leadId,
    structured_facts: leadCtx.updatedFacts,
    phone_e164: senderPhone,
    contact_name: String(payloadData.pushName || existingConv?.contact_name || 'Lead WhatsApp'),
    last_message_preview: effectiveText.slice(0, 240), last_message_direction: 'inbound', last_inbound_at: new Date().toISOString(),
  }).select('*').single();

  if (conv?.id) {
    await admin.from('marketing_zap_messages').insert({
      conversation_id: conv.id, direction: 'inbound', sender_role: 'lead', message_type: msgContent.audioMessage ? 'audio_ptt' : 'text', body_text: effectiveText, provider_message_id: msgId,
    });
  }

  const intentRes = await classifyMarketingIntent(effectiveText);
  if (intentRes.intent === 'opt_out') {
    const phoneHash = await sha256Hex(senderPhone);
    await executeUpstashCommand(['SADD', 'marketing:optout', phoneHash]);
    let optQ = admin.from('marketing_opt_outs').select('id').eq('tenant_scope', tenantScope).eq('phone_e164', senderPhone);
    optQ = clinicId ? optQ.eq('clinic_id', clinicId) : optQ.is('clinic_id', null);
    const { data: existingOpt } = await optQ.maybeSingle();
    if (!existingOpt) {
      await admin.from('marketing_opt_outs').insert({ tenant_scope: tenantScope, clinic_id: clinicId, phone_e164: senderPhone, phone_hash: phoneHash, reason: 'whatsapp_inbound_keyword', source_channel: 'whatsapp_evolution' });
    }
    await admin.from('marketing_zap_dispatches').update({ status: 'blocked_optout' }).eq('phone_e164', senderPhone).eq('status', 'queued');
    if (conv?.id) await admin.from('marketing_zap_conversations').update({ agent_mode: 'paused', funnel_stage: 'opt_out', intent_classification: 'opt_out' }).eq('id', conv.id);
    return respond({ success: true, opt_out: true, phone: senderPhone });
  }

  const autoReplyCheck = detectWhatsappAutoReply(effectiveText);
  if (autoReplyCheck.isAutoReply) {
    await recordWhatsappAutoReplyDetected({
      admin,
      conversationId: conv?.id ? String(conv.id) : null,
      existingFacts: ((conv?.structured_facts as Record<string, unknown> | undefined) || leadCtx.updatedFacts),
      leadId: conv?.lead_id ? String(conv.lead_id) : leadCtx.leadId,
      effectiveText,
      autoReplyCheck,
    });
    return respond({ success: true, auto_reply_detected: true, matchedRule: autoReplyCheck.matchedRule, skipped_ai: true, zeroTokens: true });
  }

  if (conv?.agent_mode === 'human' || conv?.agent_mode === 'paused') {
    await admin.from('marketing_zap_conversations').update({ unread_count: Number(conv.unread_count || 0) + 1 }).eq('id', conv.id);
    return respond({ success: true, mode: conv.agent_mode, skipped_ai: true });
  }

  const evoConfig = getEvo();
  const baseDeliveryArgs = {
    admin,
    evoConfig,
    evoCall,
    instanceKey,
    instanceId: instanceRow?.id ? String(instanceRow.id) : null,
    tenantScope,
    clinicId,
    conversationId: conv?.id ? String(conv.id) : null,
    leadId: conv?.lead_id ? String(conv.lead_id) : leadCtx.leadId,
    senderPhone,
    msgId,
  };

  const trigger = await matchActiveKeywordTrigger(admin, effectiveText, tenantScope, instanceRow?.id ? String(instanceRow.id) : null);
  if (trigger) {
    await admin.from('marketing_keyword_triggers').update({ hit_count: trigger.hit_count + 1 }).eq('id', trigger.id);
    const replyText = sanitizeOutboundSalesReply(String(trigger.action_payload.text || trigger.action_payload.reply_text || '')).cleanText;
    const sendOutcome = await deliverOrQueueOutboundText({ ...baseDeliveryArgs, text: replyText });
    if (conv?.id) {
      if (replyText) await admin.from('marketing_zap_messages').insert({ conversation_id: conv.id, direction: 'outbound', sender_role: 'system', message_type: 'text', body_text: replyText });
      await admin.from('marketing_zap_conversations').update({
        ...(trigger.action_type === 'handoff_human' ? { agent_mode: 'human' } : {}),
        ...(trigger.action_type === 'move_stage' && trigger.action_payload.funnel_stage ? { funnel_stage: String(trigger.action_payload.funnel_stage) } : {}),
        ...(replyText ? { last_message_preview: replyText.slice(0, 240), last_message_direction: 'outbound' } : {}),
      }).eq('id', conv.id);
    }
    return respond({ success: true, triggerHit: trigger.name, zeroTokens: true, replySent: sendOutcome.deliveredDirect, queuedForWorker: sendOutcome.queuedForWorker });
  }

  if (agentRow?.enable_semantic_cache !== false) {
    const semHit = await lookupSemanticCache(String(agentRow?.id || 'default'), effectiveText);
    if (semHit) {
      const safeSemReply = sanitizeOutboundSalesReply(semHit.reply).cleanText;
      const sendOutcome = await deliverOrQueueOutboundText({
        ...baseDeliveryArgs,
        text: safeSemReply,
        simulateTyping: agentRow?.simulate_typing !== false,
      });
      if (conv?.id) {
        await admin.from('marketing_zap_messages').insert({ conversation_id: conv.id, direction: 'outbound', sender_role: 'ai', message_type: 'text', body_text: safeSemReply, model_used: `semantic-cache-${semHit.matchType}` });
        await admin.from('marketing_zap_conversations').update({
          last_message_preview: safeSemReply.slice(0, 240),
          last_message_direction: 'outbound',
          ai_turns_count: Number(conv.ai_turns_count || 0) + 1,
        }).eq('id', conv.id);
      }
      return respond({ success: true, zeroTokens: true, cacheHit: semHit.matchType, replySent: sendOutcome.deliveredDirect, queuedForWorker: sendOutcome.queuedForWorker });
    }
  }

  const llmSetup = await resolveAgentLlmSetup(admin, (agentRow as Record<string, unknown>) || null);
  const { data: uncompacted } = conv?.id
    ? await admin.from('marketing_zap_messages').select('direction, sender_role, body_text').eq('conversation_id', conv.id).eq('is_compacted', false).order('created_at', { ascending: true })
    : { data: [] };

  const currentFacts = ((conv?.structured_facts as Record<string, unknown> | undefined) || leadCtx.updatedFacts || {}) as Record<string, unknown>;
  const launchCouponCode = (Deno.env.get('PLURI_LAUNCH_COUPON_CODE') || '').trim() || undefined;
  const { isCommercialPresentation, maxChars, recommendation: finalRecommendation, truthPromptBlock } = buildCommercialTurnGuidance({
    intent: intentRes.intent,
    effectiveText,
    baseMaxChars: Number(agentRow?.max_chars_per_reply || 450),
    currentFacts,
    launchCouponCode,
  });

  const factsStr = Object.keys(currentFacts).length > 0 ? `Fatos do lead: ${JSON.stringify(currentFacts)}` : '';
  const sysPrompt = [
    WHATSAPP_AGENT_CONSTITUTION_PROMPT,
    String(agentRow?.system_prompt || 'Você é o consultor SDR do Pluri Fisio no WhatsApp. Seja cordial e objetivo.'),
    truthPromptBlock,
    agentRow?.knowledge_base ? `Base de conhecimento:\n${String(agentRow.knowledge_base)}` : '',
    leadCtx.painContextPrompt ? `Contexto de Dor & Estratégia do Lead:\n${leadCtx.painContextPrompt}` : '',
    conv?.rolling_summary ? `Resumo da conversa:\n${String(conv.rolling_summary)}` : '',
    factsStr,
    `Responda em PT-BR natural, humano, simpático e profissionalmente formal para WhatsApp em até ${maxChars} caracteres.`,
  ].filter(Boolean).join('\n\n');

  const history = ((uncompacted || []) as Array<Record<string, unknown>>).map((m) => ({
    role: (m.sender_role === 'lead' || m.direction === 'inbound' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: String(m.body_text || ''),
  }));

  const aiResult = await invokeUniversalLlm({
    provider: llmSetup.provider, modelId: llmSetup.modelId, systemPrompt: sysPrompt,
    messages: history.length > 0 ? history : [{ role: 'user', content: effectiveText }],
    temperature: Number(agentRow?.temperature ?? 0.55), maxTokens: Math.min(700, Math.ceil(maxChars / 2) + 140),
    disableThinking: llmSetup.disableThinking, fallbackChain: llmSetup.fallbackChain, tenantScope, route: 'webhook-evolution',
  });

  const cleanReply = sanitizeOutboundSalesReply(aiResult.text.slice(0, maxChars)).cleanText;
  const sendOutcome = await deliverOrQueueOutboundText({
    ...baseDeliveryArgs,
    text: cleanReply,
    simulateTyping: agentRow?.simulate_typing !== false,
  });

  let nextFacts = currentFacts;
  if (isCommercialPresentation && conv?.id && currentFacts.plans_cards_sent !== true) {
    const packRes = await enqueueOfficialPlansVisualPack({
      admin,
      tenantScope,
      clinicId,
      instanceId: instanceRow?.id ? String(instanceRow.id) : null,
      conversationId: String(conv.id),
      leadId: conv.lead_id ? String(conv.lead_id) : leadCtx.leadId,
      phoneE164: senderPhone,
      leadName: String(payloadData.pushName || conv.contact_name || 'Profissional'),
      recommendation: finalRecommendation,
      launchCouponCode,
    });
    if (packRes.queued) {
      nextFacts = { ...currentFacts, plans_cards_sent: true, recommended_plan_id: finalRecommendation.planId };
    }
  }

  if (conv?.id) {
    await admin.from('marketing_zap_messages').insert({ conversation_id: conv.id, direction: 'outbound', sender_role: 'ai', message_type: 'text', body_text: cleanReply, model_used: aiResult.modelUsed });
    await admin.from('marketing_zap_conversations').update({
      agent_mode: intentRes.intent === 'handoff_human' ? 'human' : 'ai',
      funnel_stage: intentRes.intent === 'schedule_demo' ? 'scheduled' : 'qualified',
      intent_classification: intentRes.intent,
      structured_facts: nextFacts,
      last_message_preview: cleanReply.slice(0, 240), last_message_direction: 'outbound', ai_turns_count: Number(conv.ai_turns_count || 0) + 1,
    }).eq('id', conv.id);

    if (intentRes.intent === 'pricing' || intentRes.intent === 'product_question') {
      void storeSemanticCache(String(agentRow?.id || 'default'), effectiveText, cleanReply);
    }
    void reconcileAutoLeadAndTripleAgenda(admin, senderPhone, intentRes.intent, String(payloadData.pushName || 'Lead'));

    if (agentRow?.auto_compact_context !== false && (uncompacted?.length || 0) + 1 > Number(agentRow?.max_context_messages || 8)) {
      await runCompactionForConversation(admin, conv as Record<string, unknown>, 4, llmSetup.provider);
    }
  }
  return respond({
    success: true,
    intent: intentRes.intent,
    modelUsed: aiResult.modelUsed,
    usedFallback: aiResult.usedFallback,
    replySent: sendOutcome.deliveredDirect,
    queuedForWorker: sendOutcome.queuedForWorker,
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: extendedCorsHeaders });

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim();
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!supabaseUrl || !serviceKey) return json({ error: 'Configuração Supabase incompleta.' }, 500);

  try {
    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    let body: Record<string, unknown> = {};
    try { body = (await req.json()) as Record<string, unknown>; } catch { return json({ error: 'Payload JSON inválido.' }, 400); }

    const url = new URL(req.url);
    const action = String(url.searchParams.get('action') || body.action || 'webhook_evolution');
    const ctx: ZapHandlerContext = { admin, body, req, callEvolution, getEvolutionConfig, json };

    if (action === 'webhook_android_bridge') {
      const bridgeKey = `${extractClientIp(req)}:${String(body.instance_key || body.instance || 'bridge')}`;
      const rlBridge = await checkRateLimit({
        preset: 'marketing_zap_webhook_instance',
        identifier: bridgeKey,
        service: 'marketing-zap-gateway',
        route: 'webhook_android_bridge',
      });
      if (!rlBridge.allowed) return rateLimitExceededResponse(rlBridge, extendedCorsHeaders);
      return await handleWebhookAndroidBridge(ctx);
    }
    if (action === 'webhook_evolution') return await handleWebhookEvolution(ctx);

    const authCheck = await authorizePlatformMarketingUser(req, admin);
    if (!authCheck.authorized || !authCheck.userId) return json({ error: authCheck.error || 'Não autorizado.' }, 403);

    const actionPreset: RateLimitPreset =
      action === 'connect_qr' || action === 'request_pairing_code'
        ? 'marketing_zap_qr'
        : action === 'simulate_agent_reply' || action === 'enqueue_campaign'
        ? 'marketing_zap_ai'
        : 'obs_admin_query';

    const rlAction = await checkRateLimit({
      preset: actionPreset,
      identifier: authCheck.userId,
      service: 'marketing-zap-gateway',
      route: action,
    });
    if (!rlAction.allowed) return rateLimitExceededResponse(rlAction, extendedCorsHeaders);

    const delegated: Record<string, (c: ZapHandlerContext) => Promise<Response>> = {
      sync_llm_models: handleSyncLlmModels,
      test_llm_provider: handleTestLlmProvider,
      request_pairing_code: handleRequestPairingCode,
      run_zap_defender_audit: handleRunZapDefenderAudit,
      compact_conversation_memory: handleCompactConversationMemory,
      validate_numbers_batch: handleValidateNumbersBatch,
      send_push_alert: handleSendPushAlert,
      sync_whatsapp_groups: handleSyncWhatsappGroups,
      extract_group_members: handleExtractGroupMembers,
      enqueue_group_action: handleEnqueueGroupAction,
      sync_whatsapp_contacts: handleSyncWhatsappContacts,
      send_human_reply: handleSendHumanReply,
      sync_typebot_binding: handleSyncTypebotBinding,
    };
    if (delegated[action]) return await delegated[action](ctx);

  if (action === 'connect_qr') {
    const instanceKey = String(body.instance_key || 'pluri-mkt-5511965120431').trim();
    if (!getEvolutionConfig().configured) {
      return json({
        success: true, configured: false, instance_key: instanceKey,
        setupHint: 'Configure EVOLUTION_API_URL e EVOLUTION_API_KEY no Pulumi ESC / Supabase Secrets e suba infra/marketing-node/docker-compose.marketing.yml para gerar o QR Code real.',
      });
    }
    await callEvolution('/instance/create', 'POST', { instanceName: instanceKey, qrcode: true, integration: 'WHATSAPP-BAILEYS' });
    const connectRes = await callEvolution(`/instance/connect/${encodeURIComponent(instanceKey)}`, 'GET');
    const qrBase64 = String(connectRes.data.base64 || '') || String((connectRes.data.qrcode as Record<string, unknown> | undefined)?.base64 || '');
    await admin.from('marketing_whatsapp_instances').update({ status: qrBase64 ? 'qr_ready' : 'connecting', last_error: null }).eq('instance_key', instanceKey);
    return json({ success: true, configured: true, instance_key: instanceKey, qrBase64: qrBase64 || null, raw: connectRes.data });
  }

  if (action === 'check_connection') {
    const instanceKey = String(body.instance_key || 'pluri-mkt-5511965120431').trim();
    if (!getEvolutionConfig().configured) return json({ success: true, configured: false, status: 'disconnected' });
    const stateRes = await callEvolution(`/instance/connectionState/${encodeURIComponent(instanceKey)}`, 'GET');
    const rawState = String((stateRes.data.instance as Record<string, unknown> | undefined)?.state || stateRes.data.state || '').toLowerCase();
    const mappedStatus = rawState === 'open' ? 'connected' : rawState === 'connecting' ? 'connecting' : 'disconnected';
    await admin.from('marketing_whatsapp_instances').update({ status: mappedStatus, ...(mappedStatus === 'connected' ? { last_connected_at: new Date().toISOString() } : {}) }).eq('instance_key', instanceKey);
    return json({ success: true, configured: true, status: mappedStatus });
  }

  if (action === 'disconnect_instance') {
    const instanceKey = String(body.instance_key || 'pluri-mkt-5511965120431').trim();
    if (getEvolutionConfig().configured) await callEvolution(`/instance/logout/${encodeURIComponent(instanceKey)}`, 'DELETE');
    await admin.from('marketing_whatsapp_instances').update({ status: 'disconnected' }).eq('instance_key', instanceKey);
    return json({ success: true, status: 'disconnected' });
  }

  if (action === 'simulate_agent_reply') {
    const message = String(body.message || '').trim();
    if (!message) return json({ error: 'Mensagem de simulação é obrigatória.' }, 400);

    const handoffKeywords = Array.isArray(body.handoff_keywords) ? body.handoff_keywords.map((k) => String(k).toLowerCase()) : ['falar com humano', 'atendente', 'suporte'];
    const det = classifyIntentDeterministic(message);
    const isOptOut = det.intent === 'opt_out';
    const triggeredHandoff = det.intent === 'handoff_human' || handoffKeywords.some((kw) => kw && message.toLowerCase().includes(kw));
    const triggerHit = await matchActiveKeywordTrigger(admin, message, 'platform', body.instance_id ? String(body.instance_id) : null);

    const llmSetup = await resolveAgentLlmSetup(admin, null, {
      provider_slug: body.provider_slug ? String(body.provider_slug) : undefined,
      provider_type: body.provider_type ? String(body.provider_type) : undefined,
      model_id: body.model_id ? String(body.model_id) : undefined,
      base_url: body.base_url ? String(body.base_url) : undefined,
      disable_thinking: typeof body.disable_thinking === 'boolean' ? body.disable_thinking : undefined,
      fallback_chain: body.fallback_chain,
    });

    const simGuidance = buildCommercialTurnGuidance({
      intent: det.intent,
      effectiveText: message,
      baseMaxChars: Number(body.max_chars_per_reply || 450),
      currentFacts: {},
      launchCouponCode: (Deno.env.get('PLURI_LAUNCH_COUPON_CODE') || '').trim() || undefined,
    });
    const maxChars = simGuidance.maxChars;
    const aiResult = await invokeUniversalLlm({
      provider: llmSetup.provider, modelId: llmSetup.modelId,
      systemPrompt: [
        WHATSAPP_AGENT_CONSTITUTION_PROMPT,
        String(body.system_prompt || 'Você é o consultor SDR oficial do Pluri Fisio no WhatsApp.'),
        simGuidance.truthPromptBlock,
        body.knowledge_base ? `Base:\n${String(body.knowledge_base)}` : '',
        `Responda em PT-BR natural, humano, simpático e profissionalmente formal para WhatsApp em até ${maxChars} caracteres.`,
      ].filter(Boolean).join('\n\n'),
      messages: [{ role: 'user', content: message }],
      maxTokens: Math.min(700, Math.ceil(maxChars / 2) + 120),
      disableThinking: llmSetup.disableThinking, fallbackChain: llmSetup.fallbackChain, route: 'simulate-agent-reply',
    });

    const reply = sanitizeOutboundSalesReply(aiResult.text.slice(0, maxChars)).cleanText;
    return json({
      success: true, reply, interactionId: (body.previous_interaction_id as string | null) || null,
      modelUsed: aiResult.modelUsed, providerSlug: aiResult.providerSlug, usedFallback: aiResult.usedFallback, latencyMs: aiResult.latencyMs,
      intent: isOptOut ? 'opt_out' : triggeredHandoff ? 'handoff_human' : det.intent, isOptOut, triggeredHandoff,
      typingMs: Math.max(1800, Math.min(9000, reply.length * 45)),
      keywordTriggerHit: triggerHit ? { id: triggerHit.id, name: triggerHit.name, actionType: triggerHit.action_type } : null,
    });
  }

  if (action === 'enqueue_campaign') {
    const campaignId = String(body.campaign_id || '').trim();
    if (!campaignId) return json({ error: 'campaign_id é obrigatório.' }, 400);
    const { data: campaign, error: campErr } = await admin.from('marketing_zap_campaigns').select('*').eq('id', campaignId).is('deleted_at', null).single();
    if (campErr || !campaign) return json({ error: 'Campanha não encontrada.' }, 404);
    const { data: instance } = await admin.from('marketing_whatsapp_instances').select('*').eq('id', campaign.instance_id).maybeSingle();
    if (instance?.status === 'circuit_broken') return json({ error: 'Chip bloqueado pelo Circuit Breaker anti-ban.' }, 409);

    const minScore = Number(((campaign.audience_filter || {}) as Record<string, unknown>).min_score ?? 70);
    const maxToQueue = Math.min(Math.max(0, Number(instance?.daily_limit ?? 15) - Number(instance?.daily_sent_count ?? 0)) || 15, 100);
    const [{ data: leads }, { data: optOuts }] = await Promise.all([
      admin.from('platform_auto_leads').select('id, full_name, phone, clinic_name, city, ai_score, source_post_excerpt, ai_icebreaker_message, raw_metadata').is('deleted_at', null).not('phone', 'is', null).gte('ai_score', minScore).order('ai_score', { ascending: false }).limit(maxToQueue),
      admin.from('marketing_opt_outs').select('phone_e164'),
    ]);

    const optOutSet = new Set((optOuts || []).map((o: { phone_e164?: string | null }) => normalizePhoneBr(o.phone_e164)));
    const antiBan = (instance?.anti_ban_config || {}) as Record<string, unknown>;
    let cursorMs = Date.now() + 5000;
    const rowsToInsert: Array<Record<string, unknown>> = [];

    for (let i = 0; i < (leads || []).length; i++) {
      const lead = leads![i];
      const phone = normalizePhoneBr(lead.phone);
      if (!phone || optOutSet.has(phone)) continue;
      cursorMs += computeGaussianDelaySec(Number(antiBan.jitter_mean_sec ?? 42), Number(antiBan.jitter_stddev_sec ?? 14)) * 1000;
      if (i > 0 && i % Math.max(5, Number(antiBan.block_size ?? 15)) === 0) cursorMs += (3 + Math.random() * 5) * 60 * 1000;
      const interpolated = renderPersonalizedCampaignMessage(String(campaign.message_template || ''), lead as Record<string, unknown>);
      rowsToInsert.push({
        campaign_id: campaign.id, instance_id: instance?.id || null, lead_id: lead.id, phone_e164: phone,
        step_index: 0, status: 'queued', rendered_body: campaign.enable_ai_spintax ? resolveSpintax(interpolated) : interpolated,
        idempotency_key: `${campaign.id}:${phone}:0`, scheduled_for: new Date(cursorMs).toISOString(),
      });
    }
    if (rowsToInsert.length > 0) {
      await admin.from('marketing_zap_dispatches').upsert(rowsToInsert, { onConflict: 'idempotency_key', ignoreDuplicates: true });
      const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
      if (supabaseUrl) {
        await Promise.allSettled(
          rowsToInsert.map((row) =>
            enqueueToQStash('zap-outbound-platform', {
              targetUrl: `${supabaseUrl}/functions/v1/qstash-zap-worker`,
              body: { action: 'dispatch_campaign_message', idempotency_key: row.idempotency_key },
              notBeforeSec: Math.floor(Date.parse(String(row.scheduled_for)) / 1000),
              retries: 2,
              deduplicationId: String(row.idempotency_key),
              flowControl: { key: `chip:${String(row.instance_id || 'default')}`, parallelism: 1 },
            })
          )
        );
      }
    }
    await admin.from('marketing_zap_campaigns').update({ status: rowsToInsert.length > 0 ? 'scheduled' : 'draft', total_targets: rowsToInsert.length }).eq('id', campaign.id);
    return json({ success: true, queued_count: rowsToInsert.length, skipped_optout_or_empty: (leads || []).length - rowsToInsert.length, estimated_finish_at: rowsToInsert.length > 0 ? new Date(cursorMs).toISOString() : null });
  }

  if (action === 'toggle_circuit_breaker') {
    const instanceId = String(body.instance_id || '').trim();
    const trip = Boolean(body.trip);
    if (!instanceId) return json({ error: 'instance_id é obrigatório.' }, 400);
    const nextStatus = trip ? 'circuit_broken' : 'disconnected';
    await admin.from('marketing_whatsapp_instances').update({ status: nextStatus }).eq('id', instanceId);
    if (trip) {
      await admin.from('marketing_zap_campaigns').update({ status: 'circuit_broken' }).eq('instance_id', instanceId).in('status', ['running', 'scheduled']);
      await new TelegramClient().sendMessage(`🛡️ <b>Pluri Zap Engine — Circuit Breaker Acionado</b>\nInstância ID: <code>${instanceId}</code>\nMotivo: ${String(body.reason || 'Acionamento manual no painel Agentes')}`);
    }
    void ingestToAxiom([{ level: trip ? 'warn' : 'info', service: 'pluri-marketing-zap-gateway', route: 'toggle_circuit_breaker', message: trip ? 'Circuit breaker tripped' : 'Circuit breaker reset', metadata: { instanceId, trip } }]);
    return json({ success: true, status: nextStatus });
  }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error('[marketing-zap-gateway] Erro inesperado:', errorMsg);
    await reportError({
      service: 'marketing-zap-gateway',
      level: 'critical',
      code: 'edge_unhandled_500',
      route: 'marketing-zap-gateway',
      message: errorMsg,
      stack: err instanceof Error ? err.stack : undefined,
    });
    return json({ error: errorMsg }, 500);
  }
});
