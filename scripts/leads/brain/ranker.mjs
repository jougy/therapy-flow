#!/usr/bin/env node
/**
 * Super-Conversor Brain — Rankeamento Bayesiano em 2 Níveis, Seletor Bandit 80/20 & Snapshot Compacto
 *
 * Nível 1: Pontos Fortes & Fracos (`talking_points`) com decaimento temporal (meia-vida 30d)
 * Nível 2: Estratégias (`strategies` e `strategy_segment_stats`) combinando funil real (65%) + nota IA (35%)
 */

import crypto from 'node:crypto';
import { getBrainConfig, getContextPins, TONE_DIRECTIVE } from './schema.mjs';

export const HALF_LIFE_DAYS = 30;
export const POINT_PRIOR_WEIGHT = 3;
export const POINT_PRIOR_MEAN = 6.0;
export const FUNNEL_WEIGHT = 0.65;
export const LLM_WEIGHT = 0.35;
export const DEFAULT_EXPLOIT_RATIO = 0.8;
export const PLAYBOOK_START_MARKER = '<!-- PLURI_CONVERSION_BRAIN_START -->';
export const PLAYBOOK_END_MARKER = '<!-- PLURI_CONVERSION_BRAIN_END -->';
export const PLAYBOOK_MAX_CHARS = 2200;

export const OUTCOME_REWARDS = {
  converted_trial: 1.0,
  won: 1.0,
  meeting_scheduled: 0.85,
  scheduled: 0.85,
  proposal: 0.65,
  interested: 0.65,
  qualified: 0.55,
  engaged: 0.45,
  replied: 0.25,
  no_reply: 0.0,
  discarded: 0.0,
  opt_out: -0.5,
};

export function clamp(val, min, max) {
  const num = Number(val);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

export function recencyWeight(isoTimestamp, nowMs = Date.now()) {
  if (!isoTimestamp) return 1;
  const ts = Date.parse(String(isoTimestamp));
  if (!Number.isFinite(ts)) return 1;
  const deltaDays = Math.max(0, (nowMs - ts) / 86_400_000);
  return Math.pow(0.5, deltaDays / HALF_LIFE_DAYS);
}

export function normalizeSlugId(prefix, rawId, fallbackLabel = '') {
  const base = String(rawId || fallbackLabel || 'item')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 42);
  if (!base) return `${prefix}_ITEM`;
  return base.startsWith(prefix) || base.startsWith('TP_') || base.startsWith('WP_')
    ? base
    : `${prefix}_${base}`;
}

function pointPriorMean(polarity) {
  return polarity === 'weakness' ? 2.5 : POINT_PRIOR_MEAN;
}

function computePointScore(row) {
  const wSum = Number(row.weighted_score_sum || 0);
  const wTot = Number(row.weight_total || 0);
  const prior = pointPriorMean(String(row.polarity || 'strength'));
  const score = (POINT_PRIOR_WEIGHT * prior + wSum) / (POINT_PRIOR_WEIGHT + wTot);
  return Number(clamp(score, 0, 10).toFixed(2));
}

function upsertTalkingPointObservation(db, { id, polarity, category, label, guidance, score, weight, nowIso }) {
  const safeId = String(id).trim().slice(0, 64);
  const existing = db.prepare('SELECT * FROM talking_points WHERE id = ?').get(safeId);

  if (!existing) {
    const newWSum = score * weight;
    const newWTot = weight;
    const prior = pointPriorMean(polarity);
    const initialScore = (POINT_PRIOR_WEIGHT * prior + newWSum) / (POINT_PRIOR_WEIGHT + newWTot);
    const avoid = polarity === 'weakness' || initialScore <= 4.0 ? 1 : 0;
    db.prepare(`
      INSERT INTO talking_points (
        id, polarity, category, label, guidance,
        weighted_score_sum, weight_total, sample_count, is_avoid_listed, last_seen_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      safeId,
      polarity,
      String(category || 'geral').slice(0, 40),
      String(label || safeId).slice(0, 140),
      String(guidance || label || '').slice(0, 260),
      newWSum,
      newWTot,
      1,
      avoid,
      nowIso,
      nowIso
    );
    return;
  }

  const nextWSum = Number(existing.weighted_score_sum || 0) + score * weight;
  const nextWTot = Number(existing.weight_total || 0) + weight;
  const nextSamples = Number(existing.sample_count || 0) + 1;
  const prior = pointPriorMean(String(existing.polarity || polarity));
  const bayesianScore = (POINT_PRIOR_WEIGHT * prior + nextWSum) / (POINT_PRIOR_WEIGHT + nextWTot);
  const avoid =
    nextSamples >= 3
      ? bayesianScore <= 4.0
        ? 1
        : 0
      : Number(existing.is_avoid_listed || 0);

  db.prepare(`
    UPDATE talking_points
       SET weighted_score_sum = ?,
           weight_total = ?,
           sample_count = ?,
           is_avoid_listed = ?,
           last_seen_at = ?,
           updated_at = ?
     WHERE id = ?
  `).run(nextWSum, nextWTot, nextSamples, avoid, nowIso, nowIso, safeId);
}

export function recordEpisodeOutcome(db, episodeInput) {
  const nowIso = new Date().toISOString();
  const evaluatedAt = episodeInput.evaluatedAt || episodeInput.lastMessageAt || nowIso;
  const weight = recencyWeight(evaluatedAt);
  const outcome = String(episodeInput.outcome || 'no_reply').toLowerCase();
  const funnelReward =
    typeof episodeInput.funnelReward === 'number'
      ? clamp(episodeInput.funnelReward, -0.5, 1.0)
      : OUTCOME_REWARDS[outcome] ?? 0.0;
  const llmScore = clamp(episodeInput.llmScore ?? 6.0, 0, 10);
  const icpTier = String(episodeInput.icpTier || 'solo_physio');
  const painCategory = String(episodeInput.painCategory || 'organizacao_geral');
  const originType = String(episodeInput.originType || 'post_comment_pain');
  const personalityArchetype = String(episodeInput.personalityArchetype || 'relacional_acolhedor');
  const strategyId = episodeInput.strategyId ? String(episodeInput.strategyId) : 'S2_QUICK_DIAGNOSTIC';

  const strongPoints = Array.isArray(episodeInput.strongPoints) ? episodeInput.strongPoints : [];
  const weakPoints = Array.isArray(episodeInput.weakPoints) ? episodeInput.weakPoints : [];
  const objections = Array.isArray(episodeInput.objections) ? episodeInput.objections : [];

  const episodeId = String(episodeInput.id || `ep_${crypto.randomUUID()}`);
  const existingEpisode = episodeInput.conversationId
    ? db.prepare('SELECT id FROM conversation_episodes WHERE conversation_id = ?').get(String(episodeInput.conversationId))
    : db.prepare('SELECT id FROM conversation_episodes WHERE id = ?').get(episodeId);

  if (existingEpisode) {
    return { recorded: false, reason: 'already_evaluated', episodeId: String(existingEpisode.id) };
  }

  db.prepare(`
    INSERT INTO conversation_episodes (
      id, conversation_id, lead_id, phone_hash, icp_tier, pain_category,
      origin_type, personality_archetype, strategy_id, outcome, funnel_reward, llm_score,
      strong_points_json, weak_points_json, objections_json, lesson,
      turns_count, compaction_tier, last_message_at, evaluated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(
    episodeId,
    episodeInput.conversationId ? String(episodeInput.conversationId) : null,
    episodeInput.leadId ? String(episodeInput.leadId) : null,
    String(episodeInput.phoneHash || 'unknown'),
    icpTier,
    painCategory,
    originType,
    personalityArchetype,
    strategyId,
    outcome,
    funnelReward,
    llmScore,
    JSON.stringify(strongPoints),
    JSON.stringify(weakPoints),
    JSON.stringify(objections),
    String(episodeInput.lesson || '').slice(0, 260),
    Math.max(0, Number(episodeInput.turnsCount || 0)),
    episodeInput.lastMessageAt ? String(episodeInput.lastMessageAt) : nowIso,
    evaluatedAt
  );

  for (const sp of strongPoints) {
    const ptId = sp.id || normalizeSlugId('TP', sp.id_or_slug || sp.label);
    upsertTalkingPointObservation(db, {
      id: ptId,
      polarity: 'strength',
      category: sp.category || 'argumento',
      label: sp.label || ptId,
      guidance: sp.reason || sp.guidance || sp.label,
      score: clamp(sp.score_0_10 ?? sp.score ?? llmScore, 0, 10),
      weight,
      nowIso,
    });
  }

  for (const wp of weakPoints) {
    const ptId = wp.id || normalizeSlugId('WP', wp.id_or_slug || wp.label);
    const qualityScore =
      typeof wp.score_0_10 === 'number'
        ? clamp(wp.score_0_10, 0, 10)
        : clamp(10 - Number(wp.severity_0_10 ?? 7), 0, 10);
    upsertTalkingPointObservation(db, {
      id: ptId,
      polarity: 'weakness',
      category: wp.category || 'friccao',
      label: wp.label || ptId,
      guidance: wp.reason || wp.guidance || wp.label,
      score: qualityScore,
      weight,
      nowIso,
    });
  }

  const isOptOut = outcome === 'opt_out' ? 1 : 0;
  db.prepare(`
    UPDATE strategies
       SET weighted_funnel_sum = weighted_funnel_sum + ?,
           weighted_llm_sum = weighted_llm_sum + ?,
           weight_total = weight_total + ?,
           sample_count = sample_count + 1,
           opt_out_count = opt_out_count + ?,
           updated_at = ?
     WHERE id = ?
  `).run(funnelReward * weight, (llmScore / 10) * weight, weight, isOptOut, nowIso, strategyId);

  db.prepare(`
    INSERT INTO strategy_segment_stats (
      strategy_id, icp_tier, pain_category,
      weighted_funnel_sum, weighted_llm_sum, weight_total, sample_count, opt_out_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(strategy_id, icp_tier, pain_category) DO UPDATE SET
      weighted_funnel_sum = strategy_segment_stats.weighted_funnel_sum + excluded.weighted_funnel_sum,
      weighted_llm_sum = strategy_segment_stats.weighted_llm_sum + excluded.weighted_llm_sum,
      weight_total = strategy_segment_stats.weight_total + excluded.weight_total,
      sample_count = strategy_segment_stats.sample_count + 1,
      opt_out_count = strategy_segment_stats.opt_out_count + excluded.opt_out_count,
      updated_at = excluded.updated_at
  `).run(
    strategyId,
    icpTier,
    painCategory,
    funnelReward * weight,
    (llmScore / 10) * weight,
    weight,
    isOptOut,
    nowIso
  );

  db.prepare(`
    INSERT INTO context_routing_stats (
      strategy_id, origin_type, personality_archetype, pain_category,
      weighted_funnel_sum, weighted_llm_sum, weight_total, sample_count, opt_out_count, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    ON CONFLICT(strategy_id, origin_type, personality_archetype, pain_category) DO UPDATE SET
      weighted_funnel_sum = context_routing_stats.weighted_funnel_sum + excluded.weighted_funnel_sum,
      weighted_llm_sum = context_routing_stats.weighted_llm_sum + excluded.weighted_llm_sum,
      weight_total = context_routing_stats.weight_total + excluded.weight_total,
      sample_count = context_routing_stats.sample_count + 1,
      opt_out_count = context_routing_stats.opt_out_count + excluded.opt_out_count,
      updated_at = excluded.updated_at
  `).run(
    strategyId,
    originType,
    personalityArchetype,
    painCategory,
    funnelReward * weight,
    (llmScore / 10) * weight,
    weight,
    isOptOut,
    nowIso
  );

  return { recorded: true, episodeId, strategyId, originType, personalityArchetype, outcome, funnelReward, llmScore };
}

export function getTalkingPointRankings(db) {
  const rows = db.prepare('SELECT * FROM talking_points').all();
  const scored = rows.map((row) => ({
    id: String(row.id),
    polarity: String(row.polarity),
    category: String(row.category),
    label: String(row.label),
    guidance: String(row.guidance),
    score: computePointScore(row),
    sampleCount: Number(row.sample_count || 0),
    isAvoidListed: Number(row.is_avoid_listed || 0) === 1,
  }));

  const strengths = scored
    .filter((p) => !p.isAvoidListed && (p.polarity === 'strength' || p.score >= 7.0))
    .sort((a, b) => b.score - a.score || b.sampleCount - a.sampleCount);

  const weaknessesToAvoid = scored
    .filter((p) => p.isAvoidListed || p.polarity === 'weakness' || (p.sampleCount >= 3 && p.score <= 4.0))
    .sort((a, b) => a.score - b.score || b.sampleCount - a.sampleCount);

  return { strengths, weaknessesToAvoid };
}

export function computeContextualPriorBoost(
  strategyId,
  { originType = null, personalityArchetype = null, painCategory = null, targetPains = [] } = {}
) {
  if (!originType && !personalityArchetype) return 0;
  let boost = 0;

  if (originType === 'post_comment_pain') {
    if (strategyId === 'S1_PAIN_MIRROR') boost += 0.12;
    if (painCategory === 'sistema_atual' && strategyId === 'S6_SWITCHING_RESCUE') boost += 0.2;
  } else if (originType === 'directory_maps' || originType === 'profile_bio') {
    if (strategyId === 'S1_PAIN_MIRROR') boost -= 0.18;
    if (strategyId === 'S2_QUICK_DIAGNOSTIC') boost += 0.12;
    if (strategyId === 'S3_TIME_SAVER_ROI') boost += 0.07;
    if (strategyId === 'S5_SOCIAL_PROOF_DEMO') boost += 0.06;
  }

  if (personalityArchetype === 'sobrecarregado_urgente') {
    if (strategyId === 'S1_PAIN_MIRROR' || strategyId === 'S3_TIME_SAVER_ROI') boost += 0.08;
  } else if (personalityArchetype === 'cauteloso_tradicional') {
    if (strategyId === 'S4_ANTI_COMPLEXITY') boost += 0.14;
  } else if (personalityArchetype === 'analitico_tecnico') {
    if (painCategory === 'sistema_atual' && strategyId === 'S6_SWITCHING_RESCUE') boost += 0.12;
    if (strategyId === 'S5_SOCIAL_PROOF_DEMO') boost += 0.06;
  } else if (personalityArchetype === 'pragmatico_direto') {
    if (strategyId === 'S2_QUICK_DIAGNOSTIC' || strategyId === 'S3_TIME_SAVER_ROI') boost += 0.08;
  } else if (personalityArchetype === 'relacional_acolhedor') {
    if (strategyId === 'S1_PAIN_MIRROR' || strategyId === 'S2_QUICK_DIAGNOSTIC') boost += 0.06;
  }

  if (painCategory && Array.isArray(targetPains) && targetPains.includes(painCategory)) {
    boost += 0.05;
  }
  return boost;
}

function resolveEffectivePin(db, { originType = null, personalityArchetype = null } = {}) {
  const pins = getContextPins(db);
  const pinMap = new Map(pins.map((p) => [String(p.context_key), String(p.strategy_id)]));
  const candidates = [
    originType && personalityArchetype ? `${originType}:${personalityArchetype}` : null,
    originType ? `${originType}:*` : null,
    personalityArchetype ? `*:${personalityArchetype}` : null,
  ].filter(Boolean);

  for (const key of candidates) {
    if (pinMap.has(key)) return { strategyId: pinMap.get(key), pinScope: key };
  }
  const globalPin = getBrainConfig(db, 'pinned_strategy_id', '');
  return globalPin ? { strategyId: globalPin, pinScope: 'global' } : { strategyId: '', pinScope: null };
}

export function getStrategyRankings(
  db,
  { icpTier = null, painCategory = null, originType = null, personalityArchetype = null } = {}
) {
  const { strategyId: pinnedId, pinScope } = resolveEffectivePin(db, { originType, personalityArchetype });
  const strategies = db.prepare("SELECT * FROM strategies WHERE status = 'active'").all();
  const segRows =
    icpTier && painCategory
      ? db
          .prepare('SELECT * FROM strategy_segment_stats WHERE icp_tier = ? AND pain_category = ?')
          .all(icpTier, painCategory)
      : [];
  const segMap = new Map(segRows.map((r) => [String(r.strategy_id), r]));

  const ctxRows =
    originType || personalityArchetype
      ? db
          .prepare(
            `SELECT strategy_id,
                    SUM(weighted_funnel_sum) AS wf,
                    SUM(weighted_llm_sum) AS wl,
                    SUM(weight_total) AS wt,
                    SUM(sample_count) AS sc
               FROM context_routing_stats
              WHERE (? IS NULL OR origin_type = ?)
                AND (? IS NULL OR personality_archetype = ?)
              GROUP BY strategy_id`
          )
          .all(originType, originType, personalityArchetype, personalityArchetype)
      : [];
  const ctxMap = new Map(ctxRows.map((r) => [String(r.strategy_id), r]));

  return strategies
    .map((s) => {
      const targetPains = JSON.parse(String(s.target_pains_json || '[]'));
      const priorTotal = Number(s.prior_alpha || 3) + Number(s.prior_beta || 2);
      const basePriorProb = Number(s.prior_alpha || 3) / Math.max(1, priorTotal);
      const priorBoost = computeContextualPriorBoost(String(s.id), {
        originType,
        personalityArchetype,
        painCategory,
        targetPains,
      });

      const globalW = Number(s.weight_total || 0);
      const seg = segMap.get(String(s.id));
      const segW = Number(seg?.weight_total || 0);
      const ctx = ctxMap.get(String(s.id));
      const ctxW = Number(ctx?.wt || 0);

      const useFunnelSum =
        ctxW >= 1.5
          ? Number(ctx.wf || 0) * 0.75 + Number(s.weighted_funnel_sum || 0) * 0.25
          : segW >= 2
            ? Number(seg.weighted_funnel_sum || 0) * 0.7 + Number(s.weighted_funnel_sum || 0) * 0.3
            : Number(s.weighted_funnel_sum || 0);

      const useLlmSum =
        ctxW >= 1.5
          ? Number(ctx.wl || 0) * 0.75 + Number(s.weighted_llm_sum || 0) * 0.25
          : segW >= 2
            ? Number(seg.weighted_llm_sum || 0) * 0.7 + Number(s.weighted_llm_sum || 0) * 0.3
            : Number(s.weighted_llm_sum || 0);

      const useW = ctxW >= 1.5 ? ctxW * 0.75 + globalW * 0.25 : segW >= 2 ? segW * 0.7 + globalW * 0.3 : globalW;
      const effectivePrior = clamp(basePriorProb + priorBoost * Math.max(0.15, 1 - ctxW / 4), 0.1, 0.95);

      const smoothedFunnel = (priorTotal * effectivePrior + useFunnelSum) / (priorTotal + useW);
      const smoothedLlm = (priorTotal * effectivePrior + useLlmSum) / (priorTotal + useW);
      const composite01 = clamp(FUNNEL_WEIGHT * smoothedFunnel + LLM_WEIGHT * smoothedLlm, 0.05, 0.98);

      return {
        id: String(s.id),
        name: String(s.name),
        shortLabel: String(s.short_label),
        description: String(s.description),
        openingGuideline: String(s.opening_guideline),
        followUpGuideline: String(s.follow_up_guideline),
        targetPains,
        compositeScore10: Number((composite01 * 10).toFixed(2)),
        estimatedSuccessPct: Math.round(composite01 * 100),
        sampleCount: Number(s.sample_count || 0),
        segmentSampleCount: Number(ctx?.sc || seg?.sample_count || 0),
        optOutCount: Number(s.opt_out_count || 0),
        isPinned: pinnedId === String(s.id),
        pinScope: pinnedId === String(s.id) ? pinScope : null,
      };
    })
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.compositeScore10 - a.compositeScore10);
}

export function selectStrategyForLead(
  db,
  {
    icpTier = 'solo_physio',
    painCategory = 'organizacao_geral',
    originType = 'post_comment_pain',
    personalityArchetype = 'relacional_acolhedor',
    hasExplicitPainSignal = false,
    randomFn = Math.random,
  } = {}
) {
  const exploitRatio = clamp(Number(getBrainConfig(db, 'exploit_ratio', String(DEFAULT_EXPLOIT_RATIO))), 0.5, 0.95);
  const toneDirective = getBrainConfig(db, 'tone_directive', TONE_DIRECTIVE);
  const contextKey = `${originType}:${personalityArchetype}`;

  const rankings = getStrategyRankings(db, {
    icpTier,
    painCategory,
    originType,
    personalityArchetype,
  }).map((r) => {
    const extraPainLift = hasExplicitPainSignal && originType === 'post_comment_pain' && r.id === 'S1_PAIN_MIRROR' && r.sampleCount < 2 ? 0.25 : 0;
    return { ...r, selectionWeight: r.compositeScore10 + extraPainLift };
  });

  const sortedByFit = [...rankings].sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.selectionWeight - a.selectionWeight);
  const primary = sortedByFit[0];
  const exploreCandidates = sortedByFit.filter((r) => r.id !== primary?.id);

  let chosen = primary;
  let mode = primary?.isPinned ? (primary.pinScope === 'global' ? 'exploit_pinned' : 'exploit_context_pin') : 'exploit_contextual';

  if (randomFn() >= exploitRatio && exploreCandidates.length > 0) {
    exploreCandidates.sort(
      (a, b) => b.compositeScore10 + 1.5 / (1 + b.sampleCount) - (a.compositeScore10 + 1.5 / (1 + a.sampleCount))
    );
    chosen = exploreCandidates[0];
    mode = 'explore';
  }

  const { strengths, weaknessesToAvoid } = getTalkingPointRankings(db);

  return {
    strategy: chosen,
    alternatives: sortedByFit.slice(0, 3).map((s) => ({
      id: s.id,
      name: s.name,
      shortLabel: s.shortLabel,
      estimatedSuccessPct: s.estimatedSuccessPct,
      compositeScore10: s.compositeScore10,
      isPinned: s.isPinned,
    })),
    mode,
    contextKey,
    exploitRatio,
    estimatedSuccessPct: chosen?.estimatedSuccessPct ?? 60,
    topTalkingPoints: strengths.slice(0, 3),
    avoidPoints: weaknessesToAvoid.slice(0, 4),
    toneDirective,
  };
}

export function buildCompactPlaybookSnapshot(db) {
  const { strengths, weaknessesToAvoid } = getTalkingPointRankings(db);
  const tone = getBrainConfig(db, 'tone_directive', TONE_DIRECTIVE);
  const exploitPct = Math.round(clamp(Number(getBrainConfig(db, 'exploit_ratio', '0.8')), 0.5, 0.95) * 100);
  const pins = getContextPins(db);
  const globalPin = getBrainConfig(db, 'pinned_strategy_id', '');

  const routingRules = [
    '- Post/Comentário c/ dor: use S1 (Espelhamento) citando o tema do post com delicadeza; se reclama de sistema atual, use S6.',
    '- Google Maps/Perfil: use S2 (Diagnóstico Consultivo) sem citar posts; adapte ao ritmo da personalidade (direto p/ gestor, simples p/ papel).',
    ...(globalPin ? [`- Padrão global selecionado: ${globalPin}`] : []),
    ...pins.slice(0, 3).map((p) => `- Regra fixada [${p.context_key}]: ${p.strategy_id}`),
  ].join('\n');

  const topPoints = strengths
    .slice(0, 4)
    .map((p) => `- (${p.score.toFixed(1)}/10) ${p.label}`)
    .join('\n');

  const avoidLines = weaknessesToAvoid
    .slice(0, 4)
    .map((w) => `- EVITAR (${w.score.toFixed(1)}/10): ${w.label}`)
    .join('\n');

  const body = [
    PLAYBOOK_START_MARKER,
    `### Playbook Super-Conversor Dinâmico Pluri Fisio (${exploitPct}/${100 - exploitPct})`,
    `TOM: ${tone}`,
    `ROTEAMENTO POR ORIGEM & PERSONALIDADE:\n${routingRules}`,
    `PONTOS FORTES:\n${topPoints}`,
    `EVITAR:\n${avoidLines}`,
    PLAYBOOK_END_MARKER,
  ].join('\n\n');

  if (body.length <= PLAYBOOK_MAX_CHARS) return body;
  const maxContent = PLAYBOOK_MAX_CHARS - PLAYBOOK_END_MARKER.length - 6;
  return `${body.slice(0, maxContent)}\n\n${PLAYBOOK_END_MARKER}`;
}
