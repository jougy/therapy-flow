#!/usr/bin/env node
/**
 * Super-Conversor Brain — Avaliador Pós-Morte Local (Custo Zero)
 *
 * Lê 1 conversa por vez (limitada aos últimos 20 turnos e <= 6.000 caracteres para evitar delírios),
 * identifica pontos fortes e fracos dos discursos, atribui notas 0-10 e retroalimenta o Ranker + Zstd.
 */

import crypto from 'node:crypto';
import { callLocalLlmJson, truncatePromptText } from '../lib/local-llm-cascade.mjs';
import { clamp, normalizeSlugId, recordEpisodeOutcome } from './ranker.mjs';
import { storeTranscriptForEpisode } from './compactor.mjs';
import { TONE_DIRECTIVE } from './schema.mjs';

const MAX_TURNS_FOR_LLM = 20;
const MAX_TRANSCRIPT_CHARS = 6000;
const MAX_NEW_POINTS_PER_EPISODE = 2;

export function trimTranscriptTurns(messages = [], maxTurns = MAX_TURNS_FOR_LLM, maxChars = MAX_TRANSCRIPT_CHARS) {
  const recent = Array.isArray(messages) ? messages.slice(-maxTurns) : [];
  const lines = recent.map((m) => {
    const role = m.sender_role === 'lead' || m.direction === 'inbound' ? 'LEAD' : 'BOT';
    const text = String(m.body_text || m.text || '').replace(/\s+/g, ' ').trim();
    return `[${role}] ${text}`;
  });
  return {
    turns: recent,
    turnsCount: recent.length,
    formattedText: truncatePromptText(lines.join('\n'), maxChars),
  };
}

export function inferOutcomeFromData(conversation = {}, lead = {}, messages = []) {
  const convStage = String(conversation.funnel_stage || '').toLowerCase();
  const leadStage = String(lead?.stage || '').toLowerCase();
  const leadReplies = (messages || []).filter((m) => m.sender_role === 'lead' || m.direction === 'inbound').length;

  if (convStage === 'opt_out' || conversation.intent_classification === 'opt_out') return 'opt_out';
  if (leadStage === 'converted_trial' || convStage === 'won') return 'converted_trial';
  if (leadStage === 'meeting_scheduled' || convStage === 'scheduled') return 'meeting_scheduled';
  if (convStage === 'proposal') return 'proposal';
  if (convStage === 'qualified' || leadStage === 'qualified') return 'qualified';
  if (leadReplies >= 3) return 'engaged';
  if (leadReplies >= 1 || leadStage === 'replied') return 'replied';
  if (leadStage === 'discarded') return 'discarded';
  return 'no_reply';
}

function heuristicPostMortem({ messages = [], outcome, strategyId }) {
  const outbound = messages.filter((m) => m.direction === 'outbound' || m.sender_role !== 'lead');
  const firstOut = String(outbound[0]?.body_text || outbound[0]?.text || '');
  const fullOutText = outbound.map((m) => String(m.body_text || m.text || '')).join('\n');

  const strongPoints = [];
  const weakPoints = [];
  const objections = [];

  if (firstOut.length > 420) {
    weakPoints.push({
      id: 'WP_TEXTAO_PRIMEIRA_MSG',
      label: 'Mensagem inicial longa com múltiplas ofertas (> 420 caracteres)',
      severity_0_10: 8,
      reason: `Primeira abordagem com ${firstOut.length} caracteres gera atrito de leitura.`,
    });
  } else if (firstOut.includes('?')) {
    strongPoints.push({
      id: 'TP_MICRO_PERGUNTA',
      label: 'Terminar a abertura com 1 micro-pergunta simples',
      score_0_10: outcome === 'no_reply' ? 6.2 : 8.4,
      reason: 'Abertura enxuta com pergunta direta facilita resposta.',
    });
  }

  if (/crefito|evolu[çc][aã]o|prontu[áa]rio/i.test(fullOutText)) {
    strongPoints.push({
      id: 'TP_CREFITO_EVOLUCAO',
      label: 'Citar evolução clínica rápida compatível com CREFITO',
      score_0_10: outcome === 'opt_out' ? 4.5 : 7.8,
      reason: 'Vocabulário específico de fisioterapia gera identificação técnica.',
    });
  }

  if (/papel|planilha|caderno|word/i.test(fullOutText)) {
    strongPoints.push({
      id: 'TP_ZERO_PLANILHA',
      label: 'Tirar o peso do papel, Word e planilhas soltas',
      score_0_10: outcome === 'opt_out' ? 4.0 : 8.0,
      reason: 'Ataca dor real fora do horário clínico.',
    });
  }

  if (/plano|r\$|mensalidade|valor/i.test(firstOut)) {
    weakPoints.push({
      id: 'WP_PRECO_CEDO_DEMAIS',
      label: 'Falar de planos/preço antes de entender o cenário do lead',
      severity_0_10: 7.5,
      reason: 'Preço citado já na abertura antes de qualificar.',
    });
  }

  if (outcome === 'opt_out') {
    weakPoints.push({
      id: 'WP_TOM_ROBOTICO',
      label: 'Clichês de telemarketing ou abertura artificial automatizada',
      severity_0_10: 8.5,
      reason: 'Lead solicitou remoção/opt-out durante o contato.',
    });
  }

  const baseScore =
    outcome === 'converted_trial'
      ? 9.4
      : outcome === 'meeting_scheduled'
        ? 8.7
        : outcome === 'engaged'
          ? 7.5
          : outcome === 'replied'
            ? 6.6
            : outcome === 'opt_out'
              ? 1.5
              : 4.5;

  return {
    strategy_score_0_10: baseScore,
    strong_points: strongPoints.slice(0, 3),
    weak_points: weakPoints.slice(0, 3),
    objections,
    lesson: `Avaliação determinística (${strategyId}): desfecho=${outcome}, turnos_out=${outbound.length}.`,
  };
}

function sanitizeEvaluatedPoints(db, rawPoints = [], polarity = 'strength') {
  const knownRows = db.prepare('SELECT id, polarity FROM talking_points').all();
  const knownSet = new Set(knownRows.map((r) => String(r.id)));
  let createdNew = 0;
  const cleaned = [];

  for (const item of Array.isArray(rawPoints) ? rawPoints.slice(0, 4) : []) {
    if (!item || typeof item !== 'object') continue;
    const prefix = polarity === 'strength' ? 'TP_AUTO' : 'WP_AUTO';
    const rawCandidate = String(item.id || item.id_or_slug || '').trim().toUpperCase();
    let finalId = knownSet.has(rawCandidate)
      ? rawCandidate
      : normalizeSlugId(prefix, rawCandidate || item.label);

    if (!knownSet.has(finalId)) {
      if (createdNew >= MAX_NEW_POINTS_PER_EPISODE) continue;
      createdNew++;
      knownSet.add(finalId);
    }

    const label = String(item.label || finalId).trim().slice(0, 140);
    const reason = String(item.reason || label).trim().slice(0, 220);

    if (polarity === 'strength') {
      cleaned.push({
        id: finalId,
        label,
        score_0_10: clamp(item.score_0_10 ?? item.score ?? 7.5, 0, 10),
        reason,
      });
    } else {
      const severity = clamp(item.severity_0_10 ?? item.severity ?? 7.0, 0, 10);
      cleaned.push({
        id: finalId,
        label,
        severity_0_10: severity,
        score_0_10: clamp(10 - severity, 0, 10),
        reason,
      });
    }
  }
  return cleaned;
}

export async function evaluateConversationPostMortem(db, { conversation = {}, messages = [], lead = null } = {}) {
  const trimmed = trimTranscriptTurns(messages, MAX_TURNS_FOR_LLM, MAX_TRANSCRIPT_CHARS);
  const outcome = inferOutcomeFromData(conversation, lead, messages);
  const rawMeta = (lead?.raw_metadata && typeof lead.raw_metadata === 'object' ? lead.raw_metadata : {}) || {};
  const strategyId = String(
    rawMeta?.strategy_assignment?.strategyId ||
      conversation?.structured_facts?.strategy_id ||
      'S2_QUICK_DIAGNOSTIC'
  );
  const icpTier = String(lead?.icp_tier || conversation?.structured_facts?.icp_tier || 'solo_physio');
  const painCategory = String(
    rawMeta?.pain_signal?.painCategory ||
      conversation?.structured_facts?.pain_category ||
      'organizacao_geral'
  );
  const originType = String(
    rawMeta?.origin_context?.originType ||
      conversation?.structured_facts?.origin_type ||
      (lead?.source_platform === 'google_maps'
        ? 'directory_maps'
        : lead?.source_platform === 'instagram'
          ? 'profile_bio'
          : 'post_comment_pain')
  );
  const personalityArchetype = String(
    rawMeta?.personality_profile?.id ||
      conversation?.structured_facts?.personality_archetype ||
      'relacional_acolhedor'
  );

  const knownCatalog = db
    .prepare('SELECT id, polarity, label FROM talking_points ORDER BY sample_count DESC LIMIT 20')
    .all()
    .map((p) => `${p.id} [${p.polarity}]: ${p.label}`)
    .join('\n');

  const systemPrompt = [
    'Você é o Auditor de Vendas Pós-Morte da Pluri Fisio (sistema para fisioterapeutas).',
    `Diretriz obrigatória de comunicação: ${TONE_DIRECTIVE}`,
    'Analise APENAS esta conversa e devolva JSON estrito com:',
    '{',
    '  "strategy_score_0_10": number,',
    '  "strong_points": [{"id_or_slug": string, "label": string, "score_0_10": number, "reason": string}],',
    '  "weak_points": [{"id_or_slug": string, "label": string, "severity_0_10": number, "reason": string}],',
    '  "objections": [string],',
    '  "lesson": string',
    '}',
    `Reutilize sempre que possível os IDs conhecidos abaixo (máximo 2 novos):\n${knownCatalog}`,
  ].join('\n\n');

  const userPrompt = [
    `ICP: ${icpTier} | Dor: ${painCategory} | Estratégia aplicada: ${strategyId} | Desfecho real: ${outcome}`,
    `Transcrição (últimos ${trimmed.turnsCount} turnos):\n${trimmed.formattedText}`,
  ].join('\n\n');

  const llmRes = await callLocalLlmJson({
    systemPrompt,
    userPrompt,
    temperature: 0.15,
    maxChars: MAX_TRANSCRIPT_CHARS,
    timeoutMs: 25000,
  });

  const evalData =
    llmRes.ok && llmRes.parsed && typeof llmRes.parsed === 'object'
      ? llmRes.parsed
      : heuristicPostMortem({ messages, outcome, strategyId });

  const strongPoints = sanitizeEvaluatedPoints(db, evalData.strong_points, 'strength');
  const weakPoints = sanitizeEvaluatedPoints(db, evalData.weak_points, 'weakness');
  const llmScore = clamp(evalData.strategy_score_0_10 ?? 6.0, 0, 10);
  const objections = Array.isArray(evalData.objections)
    ? evalData.objections.map((o) => String(o).slice(0, 120)).slice(0, 5)
    : [];
  const lesson = String(evalData.lesson || '').slice(0, 240);

  const rawPhone = String(conversation.phone_e164 || lead?.phone || 'unknown');
  const phoneHash = crypto.createHash('sha256').update(rawPhone).digest('hex').slice(0, 24);
  const episodeId = `ep_${crypto.randomUUID()}`;

  const recRes = recordEpisodeOutcome(db, {
    id: episodeId,
    conversationId: conversation.id || null,
    leadId: lead?.id || conversation.lead_id || null,
    phoneHash,
    icpTier,
    painCategory,
    originType,
    personalityArchetype,
    strategyId,
    outcome,
    llmScore,
    strongPoints,
    weakPoints,
    objections,
    lesson,
    turnsCount: messages.length,
    lastMessageAt: conversation.updated_at || new Date().toISOString(),
    evaluatedAt: new Date().toISOString(),
  });

  if (recRes.recorded) {
    storeTranscriptForEpisode(db, episodeId, {
      conversationId: conversation.id || null,
      strategyId,
      outcome,
      turns: trimmed.turns,
    });
  }

  return {
    ...recRes,
    provider: llmRes.ok ? llmRes.provider : 'heuristic',
    model: llmRes.model,
    strongPointsCount: strongPoints.length,
    weakPointsCount: weakPoints.length,
    lesson,
  };
}
