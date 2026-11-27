/**
 * Hidratação de Contexto do Lead & Personalização de Mensagens (Personalidade × Origem × Gancho)
 *
 * Mantém marketing-zap-gateway/index.ts enxuto:
 *  - Cacheia em structured_facts.lead_pain_context (<= 480 chars, 0 queries nos turnos seguintes)
 *  - Salva origin_type e personality_archetype para retroalimentar context_routing_stats
 *  - Guia o bot a aproveitar o post/comentário quando a origem for post/comentário
 *  - Renderiza {{dor_principal}}, {{gancho_conteudo}}, {{icebreaker_ia}}, {{estrategia}}
 */

export interface HydratedLeadContext {
  leadId: string | null;
  painContextPrompt: string;
  updatedFacts: Record<string, unknown>;
}

export async function hydrateLeadContextForConversation(
  admin: { from: (table: string) => any },
  senderPhone: string,
  existingFacts: Record<string, unknown> | null | undefined,
  existingLeadId?: string | null,
): Promise<HydratedLeadContext> {
  const baseFacts =
    existingFacts && typeof existingFacts === 'object' && !Array.isArray(existingFacts)
      ? { ...existingFacts }
      : {};

  if (typeof baseFacts.lead_pain_context === 'string' && baseFacts.lead_pain_context.trim()) {
    return {
      leadId: existingLeadId || (typeof baseFacts.lead_id === 'string' ? baseFacts.lead_id : null),
      painContextPrompt: baseFacts.lead_pain_context.slice(0, 480),
      updatedFacts: baseFacts,
    };
  }

  const last8 = String(senderPhone || '').replace(/\D/g, '').slice(-8);
  if (!last8) {
    return { leadId: existingLeadId || null, painContextPrompt: '', updatedFacts: baseFacts };
  }

  const { data: lead } = await admin
    .from('platform_auto_leads')
    .select(
      'id, full_name, clinic_name, city, icp_tier, source_platform, source_post_url, source_post_excerpt, ai_qualification_summary, raw_metadata',
    )
    .ilike('phone', `%${last8}`)
    .is('deleted_at', null)
    .order('ai_score', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lead?.id) {
    return { leadId: existingLeadId || null, painContextPrompt: '', updatedFacts: baseFacts };
  }

  const rawMeta =
    lead.raw_metadata && typeof lead.raw_metadata === 'object'
      ? (lead.raw_metadata as Record<string, unknown>)
      : {};
  const painSig = (rawMeta.pain_signal || {}) as Record<string, unknown>;
  const originCtx = (rawMeta.origin_context || {}) as Record<string, unknown>;
  const personality = (rawMeta.personality_profile || {}) as Record<string, unknown>;
  const strat = (rawMeta.strategy_assignment || {}) as Record<string, unknown>;

  const originType = String(
    originCtx.originType ||
      (lead.source_platform === 'google_maps'
        ? 'directory_maps'
        : lead.source_platform === 'instagram'
          ? 'profile_bio'
          : 'post_comment_pain'),
  );
  const discoveryLabel = String(
    originCtx.discoveryLabel ||
      (originType === 'directory_maps' ? 'Google Maps' : 'Post / Comentário Público'),
  );
  const contentHook = String(
    originCtx.contentHook || painSig.contentHook || painSig.painSummary || lead.source_post_excerpt || '',
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

  const originGuidance =
    originType === 'post_comment_pain' || originType === 'profile_bio'
      ? `Origem: ${discoveryLabel}${contentHook ? ` | Gancho: "${contentHook}" (aproveitar o tema do post/perfil com naturalidade)` : ''}`
      : `Origem: ${discoveryLabel} (abordagem consultiva sem mencionar posts)`;

  const personalityId = String(personality.id || '').trim();
  const personalityLabel = String(personality.label || '').trim();
  const personalityPacing = String(personality.pacing || '').trim();
  const personalityStr = personalityLabel
    ? `Personalidade: ${personalityLabel}${personalityPacing ? ` — ${personalityPacing}` : ''}`
    : '';

  const stratLabel = String(strat.shortLabel || strat.strategyId || '').trim();
  const painCategory = String(painSig.painCategory || '').trim();
  const icpTier = String(lead.icp_tier || 'solo_physio');
  const maturityStage = String(rawMeta.maturity_stage || '').trim();
  const recPlan = (rawMeta.recommended_plan || {}) as Record<string, unknown>;
  const recPlanId = String(recPlan.planId || '').trim();
  const recPlanName = String(recPlan.planName || '').trim();
  const usesAutoReply = Boolean((rawMeta.whatsapp_profile as Record<string, unknown> | undefined)?.uses_auto_reply);

  const compactParts = [
    `ICP: ${icpTier}${lead.city ? ` (${lead.city})` : ''}`,
    maturityStage ? `Estágio: ${maturityStage}` : '',
    recPlanName ? `Plano ideal: ${recPlanName}` : '',
    originGuidance,
    personalityStr,
    stratLabel ? `Estratégia: ${stratLabel}` : '',
    usesAutoReply ? 'Já usou auto-resposta no Zap' : '',
    'Tom: natural, humano, simpático e profissionalmente formal.',
  ].filter(Boolean);

  const painContextPrompt = compactParts.join(' | ').slice(0, 480);

  const updatedFacts: Record<string, unknown> = {
    ...baseFacts,
    lead_id: String(lead.id),
    icp_tier: icpTier,
    origin_type: originType,
    ...(maturityStage ? { maturity_stage: maturityStage } : {}),
    ...(recPlanId ? { recommended_plan_id: recPlanId } : {}),
    ...(recPlanName ? { recommended_plan_name: recPlanName } : {}),
    ...(usesAutoReply ? { uses_whatsapp_auto_reply: true } : {}),
    ...(personalityId ? { personality_archetype: personalityId } : {}),
    ...(painCategory ? { pain_category: painCategory } : {}),
    ...(strat.strategyId ? { strategy_id: String(strat.strategyId) } : {}),
    lead_pain_context: painContextPrompt,
  };

  return {
    leadId: String(lead.id),
    painContextPrompt,
    updatedFacts,
  };
}

export function renderPersonalizedCampaignMessage(
  template: string,
  lead: Record<string, unknown>,
): string {
  const firstName =
    String(lead.full_name || 'Dr(a).')
      .trim()
      .split(/\s+/)[0] || 'Dr(a).';

  const rawMeta =
    lead.raw_metadata && typeof lead.raw_metadata === 'object'
      ? (lead.raw_metadata as Record<string, unknown>)
      : {};
  const painSig = (rawMeta.pain_signal || {}) as Record<string, unknown>;
  const originCtx = (rawMeta.origin_context || {}) as Record<string, unknown>;
  const strat = (rawMeta.strategy_assignment || {}) as Record<string, unknown>;

  const mainPain = String(
    painSig.painSummary || lead.source_post_excerpt || 'organização de agenda e prontuários',
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

  const contentHook = String(originCtx.contentHook || painSig.contentHook || mainPain)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140);

  const icebreaker = String(lead.ai_icebreaker_message || '').trim();
  const strategyLabel = String(strat.shortLabel || 'Diagnóstico Consultivo').trim();

  return String(template || '')
    .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, firstName)
    .replace(/\{\{\s*clinica\s*\}\}/gi, String(lead.clinic_name || 'sua clínica'))
    .replace(/\{\{\s*cidade\s*\}\}/gi, String(lead.city || 'sua região'))
    .replace(/\{\{\s*dor_principal\s*\}\}/gi, mainPain)
    .replace(/\{\{\s*gancho_conteudo\s*\}\}/gi, contentHook)
    .replace(/\{\{\s*icebreaker_ia\s*\}\}/gi, icebreaker)
    .replace(/\{\{\s*estrategia\s*\}\}/gi, strategyLabel);
}
