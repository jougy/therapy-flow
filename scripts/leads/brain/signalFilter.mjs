#!/usr/bin/env node
/**
 * Super-Conversor Brain — Filtro de Sinais Públicos (First Customer Finder Pluri Fisio)
 *
 * Aplica rubrica 0-5 com trava de data, checagem de contra-evidência via LLM local custo zero,
 * deduplicação em `pain_signal_history` e geração de dossiê personalizado com a estratégia 80/20.
 */

import crypto from 'node:crypto';
import { callLocalLlmJson } from '../lib/local-llm-cascade.mjs';
import { clamp, selectStrategyForLead } from './ranker.mjs';
import {
  composeContextualOpening,
  PERSONALITY_ARCHETYPES,
  profileLeadContext,
  resolveSafeGreeting,
} from './personalityProfiler.mjs';
import { TONE_DIRECTIVE } from './schema.mjs';

export function normalizeUrl(rawUrl) {
  const s = String(rawUrl || '').trim();
  if (!s) return '';
  try {
    const u = new URL(s);
    const keepParams = [];
    for (const [k, v] of u.searchParams.entries()) {
      if (!/^utm_|^fbclid$|^igshid$/i.test(k)) keepParams.push([k, v]);
    }
    u.search = '';
    for (const [k, v] of keepParams) u.searchParams.append(k, v);
    return u.toString().replace(/\/+$/, '');
  } catch {
    return s.toLowerCase();
  }
}

export function normalizeBrPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

function sha256Short(value) {
  if (!value) return null;
  return crypto.createHash('sha256').update(String(value).toLowerCase().trim()).digest('hex').slice(0, 24);
}

export function computeSignalDedupKey(item) {
  const cleanUrl = normalizeUrl(item.source_url || item.url || '');
  const phone = normalizeBrPhone(item.phone || '');
  const handle = String(item.instagram_handle || '').trim().toLowerCase();
  const base = cleanUrl || phone || handle || `${item.full_name || ''}|${item.pain_excerpt || ''}`;
  return {
    signalHash: sha256Short(base),
    cleanUrl,
    phone,
    phoneHash: phone ? sha256Short(phone) : null,
    handle: handle || null,
  };
}

export function isDuplicateSignal(db, dedup) {
  if (!dedup?.signalHash) return false;
  const byHash = db
    .prepare('SELECT signal_hash, feedback_status FROM pain_signal_history WHERE signal_hash = ?')
    .get(dedup.signalHash);
  if (byHash) return true;
  if (dedup.phoneHash) {
    const byPhone = db
      .prepare('SELECT signal_hash FROM pain_signal_history WHERE phone_hash = ? LIMIT 1')
      .get(dedup.phoneHash);
    if (byPhone) return true;
  }
  if (dedup.handle) {
    const byHandle = db
      .prepare('SELECT signal_hash FROM pain_signal_history WHERE lower(social_handle) = ? LIMIT 1')
      .get(dedup.handle.toLowerCase());
    if (byHandle) return true;
  }
  return false;
}

function heuristicEvaluateSignal(item) {
  const excerpt = String(item.pain_excerpt || item.text || '').trim();
  const combined = `${item.full_name || ''} ${excerpt} ${item.specialty || ''}`.toLowerCase();

  const isPatient = /procuro fisioterapeuta|busco fisio|quanto custa sess[aã]o|dor nas costas procuro|indica[çc][aã]o de fisio/i.test(combined);
  const isSeller = /hotmart|kiwify|vendo maca|curso|ebook|pack de artes|vaga para fisioterapeuta|envie seu curr[ií]culo/i.test(combined);
  const alreadyHappy = /j[aá] uso .* e amo|super satisfeit|n[aã]o troco meu sistema/i.test(combined);
  const counterPassed = !isPatient && !isSeller && !alreadyHappy;

  let painCategory = 'organizacao_geral';
  if (/prontu[aá]rio|crefito|evolu[çc][aã]o/i.test(combined)) painCategory = 'prontuario';
  else if (/papel|caderno|planilha|excel|word/i.test(combined)) painCategory = 'papel_planilha';
  else if (/falta|faltou|desmarc|lembrete|whatsapp/i.test(combined)) painCategory = 'faltas';
  else if (/sistema|software|trocar|suporte|caro/i.test(combined)) painCategory = 'sistema_atual';
  else if (/abrindo|inaugurando|montando consult/i.test(combined)) painCategory = 'abertura_clinica';

  let icpTier = item.icp_tier || 'solo_physio';
  if (isPatient || isSeller) icpTier = 'other';
  else if (/pilates/i.test(combined)) icpTier = 'studio_pilates';
  else if (/cl[ií]nica|equipe|s[oó]cios|salas/i.test(combined)) icpTier = 'clinic_owner';
  else if (/estudante|est[aá]gio|tcc/i.test(combined)) icpTier = 'student';

  const hasDate = Boolean(item.published_at && Date.parse(String(item.published_at)));
  const ageDays = hasDate ? (Date.now() - Date.parse(String(item.published_at))) / 86_400_000 : 999;

  const evidenceStrength = item.source_url ? 5 : 2;
  const painSeverity = /indica|preciso|socorro|cansad|planilha|papel|prontu[aá]rio|falt/i.test(combined) ? 4.6 : 3.2;
  const timingUrgency = !hasDate || ageDays > 180 ? 2 : ageDays <= 30 ? 5 : 3.5;
  const icpFit = icpTier === 'other' ? 0.5 : icpTier === 'student' ? 2 : 4.8;
  const reachability = item.phone ? 5 : item.instagram_handle || item.email ? 3.5 : 2;

  return {
    evidence_strength: evidenceStrength,
    pain_severity: painSeverity,
    timing_urgency: timingUrgency,
    icp_fit: icpFit,
    reachability,
    icp_tier: icpTier,
    pain_category: painCategory,
    is_patient_seeking_care: isPatient,
    is_seller_or_recruiter: isSeller,
    already_uses_competitor_happily: alreadyHappy,
    counter_evidence_passed: counterPassed,
    counter_evidence_reason: !counterPassed
      ? isPatient
        ? 'Paciente buscando tratamento'
        : isSeller
          ? 'Vendedor ou vaga de emprego'
          : 'Já satisfeito com outro sistema'
      : 'Profissional em dor ativa compatível com Pluri Fisio',
    pain_summary: excerpt.slice(0, 140),
  };
}

function isCleanCustomOpening(rawText, originType) {
  const s = String(rawText || '').replace(/\s+/g, ' ').trim();
  if (s.length < 30 || s.length > 360) return false;
  if (/\.\.\.|"[^"]{35,}/.test(s)) return false;
  if (originType === 'directory_maps' && /\b(post|publica[çc][aã]o|coment[aá]rio)\b/i.test(s)) {
    return false;
  }
  return true;
}

export async function scoreAndCurateSignal(db, item, { randomFn = Math.random } = {}) {
  const heuristic = heuristicEvaluateSignal(item);
  const archetypeKeys = Object.keys(PERSONALITY_ARCHETYPES).join('"|"');

  const sysPrompt = [
    'Você é o Analista de Sinais Públicos & Personalidade da Pluri Fisio (sistema para fisioterapeutas).',
    'Avalie o contato abaixo aplicando rubrica 0-5, checagem de contra-evidência, personalidade do cliente e gancho limpo em PT-BR.',
    'Trave timing_urgency <= 2 se published_at estiver ausente ou > 180 dias (exceto cadastros de diretório com sinal operacional claro).',
    'Responda JSON estrito:',
    '{',
    '  "evidence_strength": number, "pain_severity": number, "timing_urgency": number,',
    '  "icp_fit": number, "reachability": number,',
    '  "icp_tier": "solo_physio"|"clinic_owner"|"studio_pilates"|"student"|"other",',
    '  "pain_category": "prontuario"|"papel_planilha"|"faltas"|"financeiro"|"sistema_atual"|"abertura_clinica"|"organizacao_geral",',
    `  "personality_archetype": "${archetypeKeys}",`,
    '  "content_hook": string (frase nominal curta em PT-BR resumindo o tema sem copiar pergunta literal nem cortar palavras),',
    '  "is_patient_seeking_care": boolean, "is_seller_or_recruiter": boolean, "already_uses_competitor_happily": boolean,',
    '  "counter_evidence_reason": string, "pain_summary": string,',
    '  "custom_opening": string',
    '}',
    `Tom para custom_opening: ${TONE_DIRECTIVE}`,
  ].join('\n');

  const userPrompt = JSON.stringify({
    full_name: item.full_name,
    published_at: item.published_at || null,
    source_url: item.source_url || null,
    source_platform: item.source_platform || 'web_signal',
    city: item.city || null,
    pain_excerpt: String(item.pain_excerpt || item.source_post_excerpt || '').slice(0, 700),
    has_phone: Boolean(item.phone),
    has_social: Boolean(item.instagram_handle || item.email),
  });

  const llmRes = await callLocalLlmJson({ systemPrompt: sysPrompt, userPrompt, temperature: 0.15, timeoutMs: 20000 });
  const evalObj = llmRes.ok && llmRes.parsed ? { ...heuristic, ...llmRes.parsed } : heuristic;

  const isPatient = Boolean(evalObj.is_patient_seeking_care || heuristic.is_patient_seeking_care);
  const isSeller = Boolean(evalObj.is_seller_or_recruiter || heuristic.is_seller_or_recruiter);
  const alreadyHappy = Boolean(evalObj.already_uses_competitor_happily || heuristic.already_uses_competitor_happily);
  const counterPassed = !isPatient && !isSeller && !alreadyHappy && evalObj.icp_tier !== 'other';

  const hasValidDate = Boolean(item.published_at && Date.parse(String(item.published_at)));
  const ageDays = hasValidDate ? (Date.now() - Date.parse(String(item.published_at))) / 86_400_000 : 999;
  const isDirectoryLead = item.source_platform === 'google_maps' || Boolean(item.placeId);
  const cappedTiming =
    isDirectoryLead
      ? clamp(evalObj.timing_urgency, 0, 5)
      : !hasValidDate || ageDays > 180
        ? Math.min(2, clamp(evalObj.timing_urgency, 0, 5))
        : clamp(evalObj.timing_urgency, 0, 5);

  const rawAvg5 =
    clamp(evalObj.evidence_strength, 0, 5) * 0.25 +
    clamp(evalObj.pain_severity, 0, 5) * 0.25 +
    cappedTiming * 0.2 +
    clamp(evalObj.icp_fit, 0, 5) * 0.2 +
    clamp(evalObj.reachability, 0, 5) * 0.1;

  const intentScore5 = Number((counterPassed ? rawAvg5 : Math.min(1.5, rawAvg5)).toFixed(2));
  const aiScore = counterPassed
    ? Math.max(10, Math.min(100, Math.round(rawAvg5 * 20)))
    : Math.max(5, Math.min(35, Math.round(rawAvg5 * 10)));

  const icpTier = ['clinic_owner', 'solo_physio', 'studio_pilates', 'student', 'other'].includes(evalObj.icp_tier)
    ? evalObj.icp_tier
    : heuristic.icp_tier;
  const painCategory = String(evalObj.pain_category || heuristic.pain_category);

  const sourcePlatform = item.source_platform || 'web_signal';
  const ctx = profileLeadContext(
    { ...item, source_platform: sourcePlatform },
    {
      painCategory,
      icpTier,
      llmArchetype: String(evalObj.personality_archetype || ''),
      llmContentHook: String(evalObj.content_hook || ''),
    }
  );

  const assignment = selectStrategyForLead(db, {
    icpTier,
    painCategory,
    originType: ctx.originType,
    personalityArchetype: ctx.personality.id,
    hasExplicitPainSignal: ctx.originType === 'post_comment_pain',
    randomFn,
  });

  const fullName = String(item.full_name || 'Dr(a). Fisioterapeuta').trim();
  const greeting = resolveSafeGreeting(fullName, item.clinic_name || '');
  const rawPainSummary = String(evalObj.pain_summary || ctx.contentHook || '').replace(/\s+/g, ' ').trim();
  const painSummary = rawPainSummary.length <= 140 ? rawPainSummary : ctx.contentHook;

  const deterministicOpening = composeContextualOpening({
    greeting,
    originType: ctx.originType,
    contentHook: ctx.contentHook,
    strategyId: assignment.strategy?.id || 'S1_PAIN_MIRROR',
    personality: ctx.personality,
    city: item.city || '',
  });

  const opening =
    llmRes.ok && isCleanCustomOpening(evalObj.custom_opening, ctx.originType)
      ? String(evalObj.custom_opening).replace(/\s+/g, ' ').trim()
      : deterministicOpening;

  const followUp = `Compreendo perfeitamente. Na rotina clínica, perder tempo fora do horário com papel, planilha ou faltas pesa bastante. Criamos a Pluri Fisio justamente para reunir prontuário (padrão CREFITO), agenda com confirmação no WhatsApp e controle de pacotes em um único lugar, direto do celular. Posso te encaminhar um vídeo de 1 minuto para conhecer sem compromisso?`;

  const dedup = computeSignalDedupKey(item);
  const cleanUrl = dedup.cleanUrl || item.source_url || null;

  return {
    qualified: counterPassed && intentScore5 >= 3.0,
    provider: llmRes.ok ? llmRes.provider : 'heuristic',
    model: llmRes.model,
    dedup,
    intentScore5,
    counterEvidencePassed: counterPassed,
    counterEvidenceReason: String(evalObj.counter_evidence_reason || heuristic.counter_evidence_reason),
    originContext: {
      originType: ctx.originType,
      discoveryLabel: ctx.discoveryLabel,
      canUseContentHook: ctx.canUseContentHook,
      contentHook: ctx.contentHook,
    },
    personalityProfile: ctx.personality,
    leadPayload: {
      full_name: fullName,
      phone: dedup.phone,
      email: item.email || null,
      instagram_handle: dedup.handle,
      city: item.city || null,
      state: item.state || null,
      clinic_name: item.clinic_name || null,
      specialty: item.specialty || (icpTier === 'studio_pilates' ? 'Pilates Clínico' : 'Fisioterapia'),
      icp_tier: icpTier,
      source_platform: sourcePlatform,
      source_post_url: cleanUrl,
      source_post_excerpt: String(item.pain_excerpt || item.source_post_excerpt || '').slice(0, 600),
      ai_score: aiScore,
      ai_qualification_summary: `${ctx.discoveryLabel} • Perfil: ${ctx.personality.label} • Nota: ${intentScore5}/5 • Estratégia: ${assignment.strategy?.shortLabel} (${assignment.estimatedSuccessPct}% est.)`,
      ai_icebreaker_message: opening,
      subagent_captured_by: 'first_customer_finder',
      external_lead_key: `signal:${dedup.signalHash}`,
      raw_metadata: {
        pain_signal: {
          sourceUrl: cleanUrl,
          publishedAt: item.published_at || null,
          painExcerpt: String(item.pain_excerpt || item.source_post_excerpt || '').slice(0, 400),
          painSummary,
          contentHook: ctx.contentHook,
          painCategory,
          intentScore5,
          counterEvidencePassed: counterPassed,
          counterEvidenceReason: String(evalObj.counter_evidence_reason || heuristic.counter_evidence_reason),
        },
        origin_context: {
          originType: ctx.originType,
          discoveryLabel: ctx.discoveryLabel,
          canUseContentHook: ctx.canUseContentHook,
          contentHook: ctx.contentHook,
        },
        personality_profile: {
          id: ctx.personality.id,
          label: ctx.personality.label,
          communicationStyle: ctx.personality.communicationStyle,
          pacing: ctx.personality.pacing,
          avoidForThisPerson: ctx.personality.avoidForThisPerson,
        },
        strategy_assignment: {
          strategyId: assignment.strategy?.id,
          strategyName: assignment.strategy?.name,
          shortLabel: assignment.strategy?.shortLabel,
          estimatedSuccessPct: assignment.estimatedSuccessPct,
          mode: assignment.mode,
          contextKey: assignment.contextKey,
          alternatives: assignment.alternatives,
          topTalkingPoints: assignment.topTalkingPoints.map((p) => p.label),
          avoidPoints: assignment.avoidPoints.map((p) => p.label),
        },
        dossier: {
          businessStage: `${icpTier === 'clinic_owner' ? 'Clínica enxuta' : icpTier === 'studio_pilates' ? 'Estúdio de Pilates' : 'Fisioterapeuta autônomo(a)'} • Origem: ${ctx.discoveryLabel}.`,
          toneOfVoice: `${TONE_DIRECTIVE} Ritmo recomendado: ${ctx.personality.pacing}.`,
          likelyPains: [painSummary || ctx.contentHook],
          approachTrigger: `${ctx.discoveryLabel}: guiar início por "${ctx.contentHook}" com estratégia ${assignment.strategy?.shortLabel} (${assignment.estimatedSuccessPct}% est.).`,
          messages: [
            { id: 'msg-1', label: '1. Abertura Personalizada', timing: 'Horário comercial (12h–14h ou 17h–19h)', text: opening },
            { id: 'msg-2', label: '2. Conexão Empática + Vídeo 1 min', timing: 'Após resposta do profissional', text: followUp },
          ],
        },
      },
    },
  };
}
