/**
 * Enfileiramento idempotente do pacote visual oficial Pluri Fisio (Imagem 1: Recursos + Imagem 2: Preços)
 * para renderização e envio via Evolution API pelo worker local pluri-marketing-worker.
 */

import {
  buildCompactTruthPromptBlock,
  recommendPlanForProfile,
  type PlanRecommendationResult,
  type PluriPlanId,
} from './pluriProductTruthPack.ts';
import { type AutoReplyDetectionResult } from './salesGuardrail.ts';

export interface EnqueueVisualPackParams {
  admin: { from: (table: string) => any };
  tenantScope: string;
  clinicId: string | null;
  instanceId: string | null;
  conversationId: string;
  leadId: string | null;
  phoneE164: string;
  leadName: string;
  recommendation: PlanRecommendationResult;
  launchCouponCode?: string;
}

const SYSTEM_CARD_CAMPAIGN_NAME = 'Sistema — Cards Oficiais Pluri Fisio';
const SYSTEM_REACTIVE_CAMPAIGN_NAME = 'Sistema — Respostas IA Pluri Fisio';

async function getOrCreateSystemCampaign(params: {
  admin: { from: (table: string) => any };
  tenantScope: string;
  clinicId: string | null;
  instanceId: string | null;
  name: string;
  audienceFilter: Record<string, unknown>;
  messageTemplate: string;
  mediaPayload: Record<string, unknown>;
}): Promise<{ id: string; instance_id: string | null; instance_pool_ids?: unknown } | null> {
  const { admin, tenantScope, clinicId, instanceId, name, audienceFilter, messageTemplate, mediaPayload } = params;
  let campaignQuery = admin
    .from('marketing_zap_campaigns')
    .select('id, instance_id, instance_pool_ids')
    .eq('tenant_scope', tenantScope)
    .eq('name', name)
    .is('deleted_at', null)
    .limit(1);

  campaignQuery = clinicId ? campaignQuery.eq('clinic_id', clinicId) : campaignQuery.is('clinic_id', null);
  const { data: existing } = await campaignQuery.maybeSingle();
  if (existing?.id) return existing;

  const { data: created, error: createErr } = await admin
    .from('marketing_zap_campaigns')
    .insert({
      tenant_scope: tenantScope,
      clinic_id: clinicId,
      instance_id: instanceId,
      instance_pool_ids: instanceId ? [instanceId] : [],
      name,
      status: 'running',
      audience_filter: audienceFilter,
      message_template: messageTemplate,
      enable_ai_spintax: false,
      media_payload: mediaPayload,
      active_hours_window: { business_start: '00:00', business_end: '23:59', business_days: [0, 1, 2, 3, 4, 5, 6] },
    })
    .select('id, instance_id, instance_pool_ids')
    .single();

  if (createErr || !created?.id) return null;
  return created;
}

export async function enqueueOfficialPlansVisualPack(params: EnqueueVisualPackParams): Promise<{ queued: boolean; dispatchId?: string }> {
  const { admin, tenantScope, clinicId, instanceId, conversationId, leadId, phoneE164, leadName, recommendation, launchCouponCode } = params;

  const campaign = await getOrCreateSystemCampaign({
    admin,
    tenantScope,
    clinicId,
    instanceId,
    name: SYSTEM_CARD_CAMPAIGN_NAME,
    audienceFilter: { system_visual_pack: true },
    messageTemplate: 'Cards oficiais Pluri Fisio',
    mediaPayload: { type: 'whatsapp_card_pack' },
  });
  if (!campaign?.id) return { queued: false };

  const packPayload = {
    cards: ['card_todos_planos_recursos', 'card_todos_planos_precos'],
    recommendedPlanId: recommendation.planId,
    recommendedPlanName: recommendation.planName,
    leadName,
    ...(launchCouponCode ? { launchCouponCode } : {}),
  };

  const renderedBody = `[[PLURI_CARD_PACK]]${JSON.stringify(packPayload)}`;
  const idempotencyKey = `visual_plans_pack:${conversationId}:v1`;

  const { data: inserted, error: dispatchErr } = await admin
    .from('marketing_zap_dispatches')
    .upsert(
      {
        campaign_id: campaign.id,
        instance_id: instanceId || campaign.instance_id || null,
        lead_id: leadId,
        phone_e164: phoneE164,
        step_index: 90,
        status: 'queued',
        rendered_body: renderedBody,
        idempotency_key: idempotencyKey,
        scheduled_for: new Date().toISOString(),
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle();

  if (dispatchErr) {
    return { queued: false };
  }

  return { queued: true, dispatchId: inserted?.id ? String(inserted.id) : undefined };
}

export async function enqueueReactiveOutboundText(params: {
  admin: { from: (table: string) => any };
  tenantScope: string;
  clinicId: string | null;
  instanceId: string | null;
  conversationId: string | null;
  leadId: string | null;
  phoneE164: string;
  messageId: string;
  text: string;
}): Promise<{ queued: boolean; dispatchId?: string }> {
  const { admin, tenantScope, clinicId, instanceId, conversationId, leadId, phoneE164, messageId, text } = params;
  if (!text.trim() || !phoneE164) return { queued: false };

  const campaign = await getOrCreateSystemCampaign({
    admin,
    tenantScope,
    clinicId,
    instanceId,
    name: SYSTEM_REACTIVE_CAMPAIGN_NAME,
    audienceFilter: { system_reactive_reply: true },
    messageTemplate: 'Resposta reativa Pluri Fisio',
    mediaPayload: {},
  });
  if (!campaign?.id) return { queued: false };

  const idempotencyKey = `reactive_reply:${conversationId || phoneE164}:${messageId}`;
  const { data: inserted, error: dispatchErr } = await admin
    .from('marketing_zap_dispatches')
    .upsert(
      {
        campaign_id: campaign.id,
        instance_id: instanceId || campaign.instance_id || null,
        lead_id: leadId,
        phone_e164: phoneE164,
        step_index: 91,
        status: 'queued',
        rendered_body: text.trim(),
        idempotency_key: idempotencyKey,
        scheduled_for: new Date().toISOString(),
      },
      { onConflict: 'idempotency_key', ignoreDuplicates: true },
    )
    .select('id')
    .maybeSingle();

  if (dispatchErr) return { queued: false };
  return { queued: true, dispatchId: inserted?.id ? String(inserted.id) : undefined };
}

export async function recordWhatsappAutoReplyDetected(params: {
  admin: { from: (table: string) => any };
  conversationId?: string | null;
  existingFacts: Record<string, unknown>;
  leadId?: string | null;
  effectiveText: string;
  autoReplyCheck: AutoReplyDetectionResult;
}): Promise<void> {
  const { admin, conversationId, existingFacts, leadId, effectiveText, autoReplyCheck } = params;
  const autoNow = new Date().toISOString();
  if (conversationId) {
    await admin
      .from('marketing_zap_conversations')
      .update({
        structured_facts: {
          ...existingFacts,
          uses_whatsapp_auto_reply: true,
          auto_reply_rule: autoReplyCheck.matchedRule,
          auto_reply_detected_at: autoNow,
        },
      })
      .eq('id', conversationId);
  }
  if (leadId) {
    const { data: leadRow } = await admin.from('platform_auto_leads').select('raw_metadata').eq('id', leadId).maybeSingle();
    const prevMeta = (leadRow?.raw_metadata && typeof leadRow.raw_metadata === 'object' ? leadRow.raw_metadata : {}) as Record<string, unknown>;
    await admin
      .from('platform_auto_leads')
      .update({
        raw_metadata: {
          ...prevMeta,
          whatsapp_profile: {
            ...((prevMeta.whatsapp_profile as Record<string, unknown> | undefined) || {}),
            uses_auto_reply: true,
            detected_at: autoNow,
            rule: autoReplyCheck.matchedRule,
            sample: effectiveText.slice(0, 180),
          },
        },
      })
      .eq('id', leadId);
  }
}

export function buildCommercialTurnGuidance(params: {
  intent: string;
  effectiveText: string;
  baseMaxChars: number;
  currentFacts: Record<string, unknown>;
  launchCouponCode?: string;
}): {
  isCommercialPresentation: boolean;
  maxChars: number;
  recommendation: PlanRecommendationResult;
  truthPromptBlock: string;
} {
  const isCommercialPresentation =
    params.intent === 'pricing' ||
    params.intent === 'product_question' ||
    /(plano|planos|pre[cç]o|valor|quanto custa|funcionalidade|como funciona|teste gr[aá]tis)/i.test(params.effectiveText);
  const maxChars = isCommercialPresentation ? Math.max(params.baseMaxChars, 760) : params.baseMaxChars;
  const baseRec = recommendPlanForProfile(
    {
      icpTier: params.currentFacts.icp_tier ? String(params.currentFacts.icp_tier) : 'solo_physio',
      maturityStage: params.currentFacts.maturity_stage ? String(params.currentFacts.maturity_stage) : null,
      needsAutoWhatsappReminders: /(lembrete|confirma[cç][aã]o autom)/i.test(params.effectiveText),
      needsRepasses: /(repasse|comiss[aã]o)/i.test(params.effectiveText),
      hasSecretary: /(secret[aá]ria|recep[cç][aã]o|apoio)/i.test(params.effectiveText),
    },
    params.launchCouponCode,
  );
  const planId = (params.currentFacts.recommended_plan_id ? String(params.currentFacts.recommended_plan_id) : baseRec.planId) as PluriPlanId;
  const recommendation = { ...baseRec, planId };
  return {
    isCommercialPresentation,
    maxChars,
    recommendation,
    truthPromptBlock: buildCompactTruthPromptBlock(recommendation, params.launchCouponCode),
  };
}
