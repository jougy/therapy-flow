#!/usr/bin/env node
/**
 * Orquestrador Sequencial Semi-Automático (Opção A) — Pluri Fisio
 * Modos: --prepare [--batch=10] [--dry-run] | --approve-batch | --approve=<ids> | --run [--once|--daemon] [--max-active=2] [--timeout-min=60] | --status
 */

import { openBrainDb } from '../leads/brain/schema.mjs';
import {
  classifyDiscoveryOrigin,
  composeContextualOpening,
  inferMaturityStage,
  inferPersonalityProfile,
  buildCleanContentHook,
  resolveSafeGreeting,
} from '../leads/brain/personalityProfiler.mjs';
import { selectStrategyForLead } from '../leads/brain/ranker.mjs';
import {
  detectWhatsappAutoReply,
  recommendPlanForProfile,
  sanitizeOutboundSalesReply,
} from './product-truth.mjs';
import { buildLeadMetadataPatch, writeOrUpdateLeadDossier } from './dossier-store.mjs';
import {
  createEvolutionHttpClient,
  createSupabaseRestClient,
  isSlotBlockedBeforeSend,
  normalizeBrPhone,
  phoneSuffixes,
  recordSequentialDispatchAudit,
  resolveOpsCredentials,
} from './transport-clients.mjs';

export function isWithinBusinessWindowBrt(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  if ((parts.find((p) => p.type === 'weekday')?.value || 'Mon') === 'Sun') return false;
  const hh = Number(parts.find((p) => p.type === 'hour')?.value || '0');
  const mm = Number(parts.find((p) => p.type === 'minute')?.value || '0');
  const mins = hh * 60 + mm;
  return mins >= 8 * 60 + 30 && mins <= 19 * 60 + 30;
}

function bumpIcpConversionStat(db, icpTier, maturityStage, field) {
  const allowed = new Set(['contacted_count', 'replied_count', 'auto_reply_count', 'demo_count', 'converted_count']);
  if (!allowed.has(field)) return;
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO icp_conversion_stats (icp_tier, maturity_stage, ${field}, updated_at) VALUES (?, ?, 1, ?)
    ON CONFLICT(icp_tier, maturity_stage) DO UPDATE SET ${field} = icp_conversion_stats.${field} + 1, updated_at = excluded.updated_at
  `).run(icpTier || 'solo_physio', maturityStage || 'desconhecido', nowIso);
}

function upsertSlotRow(db, row) {
  const nowIso = new Date().toISOString();
  db.prepare(`
    INSERT INTO sequential_slots (
      lead_id, phone_e164, full_name, clinic_name, icp_tier, maturity_stage, origin_type,
      personality_archetype, recommended_plan_id, strategy_id, opening_message, dossier_path,
      status, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(lead_id) DO UPDATE SET
      status = excluded.status, recommended_plan_id = excluded.recommended_plan_id,
      opening_message = excluded.opening_message, dossier_path = excluded.dossier_path,
      notes = excluded.notes, updated_at = excluded.updated_at
  `).run(
    row.lead_id, row.phone_e164, row.full_name || null, row.clinic_name || null,
    row.icp_tier || 'solo_physio', row.maturity_stage || 'desconhecido',
    row.origin_type || 'profile_bio', row.personality_archetype || 'relacional_acolhedor',
    row.recommended_plan_id || 'prof_basico', row.strategy_id || 'S2_QUICK_DIAGNOSTIC',
    row.opening_message || '', row.dossier_path || null, row.status, row.notes || null,
    nowIso, nowIso,
  );
}

export async function runPreSendShield({ leads, db, supabase, evo }) {
  const existingSlots = new Set(db.prepare('SELECT lead_id FROM sequential_slots').all().map((r) => String(r.lead_id)));
  const optOutSuffixes = new Set();
  const dispatchedSuffixes = new Set();
  if (supabase) {
    const [optOuts, dispatches] = await Promise.all([
      supabase.select('marketing_opt_outs', 'select=phone_e164&limit=1000'),
      supabase.select('marketing_zap_dispatches', 'select=phone_e164&status=in.(queued,sending,sent,delivered,replied)&limit=1500'),
    ]);
    for (const o of optOuts || []) optOutSuffixes.add(phoneSuffixes(o.phone_e164).last8);
    for (const d of dispatches || []) dispatchedSuffixes.add(phoneSuffixes(d.phone_e164).last8);
  }
  const chatRes = evo ? await evo.fetchExistingChatSuffixes() : { ok: false, suffixes: new Set() };
  const waCheckMap = evo ? await evo.checkWhatsappNumbers(leads.map((l) => normalizeBrPhone(l.phone)).filter(Boolean)) : new Map();

  const passed = [];
  const skipped = [];
  for (const lead of leads) {
    const phoneE164 = normalizeBrPhone(lead.phone);
    const { last8, last10 } = phoneSuffixes(phoneE164);
    if (!phoneE164 || last8.length < 8 || existingSlots.has(String(lead.id))) continue;
    if (optOutSuffixes.has(last8)) skipped.push({ lead, reason: 'opt_out' });
    else if (dispatchedSuffixes.has(last8) || (chatRes.ok && (chatRes.suffixes.has(last8) || chatRes.suffixes.has(last10)))) {
      skipped.push({ lead, phoneE164, reason: 'skipped_existing_chat' });
    } else if (waCheckMap.has(last10) && waCheckMap.get(last10) === false) {
      skipped.push({ lead, phoneE164, reason: 'skipped_no_whatsapp' });
    } else passed.push({ ...lead, phoneE164 });
  }
  return { passed, skipped };
}

export async function prepareBatch({ db, supabase, evo, batch = 10, dryRun = false, launchCouponCode = '', dossiersDir }) {
  if (!supabase) throw new Error('Supabase não configurado para buscar leads reais.');
  const rawLeads = await supabase.select(
    'platform_auto_leads',
    `select=id,full_name,clinic_name,phone,city,icp_tier,source_platform,source_post_url,source_post_excerpt,ai_score,ai_qualification_summary,raw_metadata,stage&deleted_at=is.null&phone=not.is.null&stage=in.(new,qualified,enriched)&order=ai_score.desc&limit=${Math.max(20, batch * 4)}`,
  );
  const prioritized = [...(rawLeads || [])].sort((a, b) =>
    (b.source_platform === 'web_signal' ? 1 : 0) - (a.source_platform === 'web_signal' ? 1 : 0) || Number(b.ai_score || 0) - Number(a.ai_score || 0),
  );
  const shield = await runPreSendShield({ leads: prioritized, db, supabase, evo });
  if (!dryRun) {
    for (const item of shield.skipped) {
      if (item.reason === 'skipped_existing_chat' || item.reason === 'skipped_no_whatsapp') {
        upsertSlotRow(db, {
          lead_id: String(item.lead.id), phone_e164: item.phoneE164 || normalizeBrPhone(item.lead.phone),
          full_name: item.lead.full_name, clinic_name: item.lead.clinic_name, icp_tier: item.lead.icp_tier,
          opening_message: '', status: item.reason, notes: `Escudo pré-envio: ${item.reason}`,
        });
      }
    }
  }

  const prepared = [];
  for (const lead of shield.passed.slice(0, batch)) {
    const origin = classifyDiscoveryOrigin(lead);
    const maturity = inferMaturityStage(lead);
    const personality = inferPersonalityProfile({
      text: [lead.source_post_excerpt, lead.ai_qualification_summary, lead.clinic_name].filter(Boolean).join(' '),
      icpTier: lead.icp_tier,
      originType: origin.id,
    });
    const painCategory = lead.raw_metadata?.pain_signal?.painCategory || 'organizacao_geral';
    const contentHook = buildCleanContentHook({
      originType: origin.id, painCategory, excerpt: lead.source_post_excerpt || '',
      city: lead.city || '', clinicName: lead.clinic_name || lead.full_name || '',
    });
    const selection = selectStrategyForLead(db, {
      icpTier: lead.icp_tier || 'solo_physio', painCategory, originType: origin.id,
      personalityArchetype: personality.id, hasExplicitPainSignal: lead.source_platform === 'web_signal',
    });
    const recommendedPlan = recommendPlanForProfile({ icpTier: lead.icp_tier, maturityStage: maturity.id }, launchCouponCode);
    const safeGreeting = resolveSafeGreeting(lead.full_name, lead.clinic_name);
    const opening = sanitizeOutboundSalesReply(composeContextualOpening({
      greeting: safeGreeting, originType: origin.id, contentHook,
      strategyId: selection.strategy?.id || 'S2_QUICK_DIAGNOSTIC', city: lead.city || '',
    })).cleanText;

    let dossierPath = null;
    if (!dryRun) {
      const dossierRes = writeOrUpdateLeadDossier(lead, {
        phoneE164: lead.phoneE164, status: 'pending_approval', originLabel: origin.discoveryLabel,
        maturityStage: maturity.id, maturityLabel: maturity.label, personalityArchetype: personality.id,
        personalityLabel: personality.label, personalityPacing: personality.pacing, contentHook,
        recommendedPlan, strategyId: selection.strategy?.id, strategyShortLabel: selection.strategy?.shortLabel,
        safeGreeting, openingMessage: opening, timelineEvent: 'Qualificado no escudo pré-envio; aguardando aprovação.',
      }, dossiersDir);
      dossierPath = dossierRes.filePath;
      await supabase.patch('platform_auto_leads', `id=eq.${encodeURIComponent(String(lead.id))}`, {
        raw_metadata: buildLeadMetadataPatch(lead.raw_metadata, {
          maturityStage: maturity.id, recommendedPlan, dossierFile: dossierRes.fileName,
        }),
      });
      upsertSlotRow(db, {
        lead_id: String(lead.id), phone_e164: lead.phoneE164, full_name: lead.full_name, clinic_name: lead.clinic_name,
        icp_tier: lead.icp_tier, maturity_stage: maturity.id, origin_type: origin.id,
        personality_archetype: personality.id, recommended_plan_id: recommendedPlan.planId,
        strategy_id: selection.strategy?.id, opening_message: opening, dossier_path: dossierPath, status: 'pending_approval',
      });
    }
    prepared.push({
      id: lead.id, name: lead.full_name || lead.clinic_name, icp: lead.icp_tier,
      maturity: maturity.id, plan: recommendedPlan.planId, strategy: selection.strategy?.id, opening, dossierPath,
    });
  }
  return { prepared, skippedCount: shield.skipped.length };
}

export function approveSlots({ db, ids = [] }) {
  const nowIso = new Date().toISOString();
  if (ids.length === 0) {
    const info = db.prepare("UPDATE sequential_slots SET status = 'approved_queue', updated_at = ? WHERE status = 'pending_approval'").run(nowIso);
    return { approvedCount: Number(info.changes || 0) };
  }
  const stmt = db.prepare("UPDATE sequential_slots SET status = 'approved_queue', updated_at = ? WHERE lead_id = ? AND status = 'pending_approval'");
  let approvedCount = 0;
  for (const id of ids) approvedCount += Number(stmt.run(nowIso, String(id).trim()).changes || 0);
  return { approvedCount };
}

export async function runOrchestratorCycle({
  db, supabase, evo, maxActive = 2, timeoutMin = 60, dryRun = false,
  ignoreHours = false, dossiersDir, now = new Date(), fetchInboundAfter = null, dispatchFn = null,
}) {
  const nowIso = now.toISOString();
  if (!ignoreHours && !isWithinBusinessWindowBrt(now)) return { windowClosed: true, released: [], dispatched: [] };

  const inFlightRows = db.prepare("SELECT * FROM sequential_slots WHERE status = 'in_flight' ORDER BY started_at ASC").all();
  const released = [];
  for (const slot of inFlightRows) {
    let inboundMsg = typeof fetchInboundAfter === 'function' ? await fetchInboundAfter(slot) : null;
    if (!inboundMsg && supabase && slot.started_at) {
      const convs = await supabase.select('marketing_zap_conversations', `select=id&phone_e164=eq.${encodeURIComponent(slot.phone_e164)}&limit=1`);
      if (convs?.[0]?.id) {
        const msgs = await supabase.select(
          'marketing_zap_messages',
          `select=body_text,created_at&conversation_id=eq.${encodeURIComponent(convs[0].id)}&direction=eq.inbound&created_at=gte.${encodeURIComponent(slot.started_at)}&order=created_at.asc&limit=1`,
        );
        inboundMsg = msgs?.[0] || null;
      }
    }
    if (inboundMsg?.body_text) {
      const autoCheck = detectWhatsappAutoReply(inboundMsg.body_text);
      const nextStatus = autoCheck.isAutoReply ? 'auto_reply_detected' : 'human_replied';
      db.prepare('UPDATE sequential_slots SET status = ?, auto_reply_sample = ?, resolved_at = ?, updated_at = ? WHERE lead_id = ?')
        .run(nextStatus, autoCheck.isAutoReply ? String(inboundMsg.body_text).slice(0, 180) : null, nowIso, nowIso, slot.lead_id);
      bumpIcpConversionStat(db, slot.icp_tier, slot.maturity_stage, autoCheck.isAutoReply ? 'auto_reply_count' : 'replied_count');
      if (autoCheck.isAutoReply && supabase) {
        const cur = await supabase.select('platform_auto_leads', `select=raw_metadata&id=eq.${encodeURIComponent(slot.lead_id)}&limit=1`).catch(() => []);
        await supabase.patch('platform_auto_leads', `id=eq.${encodeURIComponent(slot.lead_id)}`, {
          raw_metadata: buildLeadMetadataPatch(cur?.[0]?.raw_metadata || {}, {
            usesAutoReply: true, autoReplyDetectedAt: nowIso, autoReplySample: inboundMsg.body_text,
          }),
        }).catch(() => undefined);
      }
      writeOrUpdateLeadDossier(
        { id: slot.lead_id, full_name: slot.full_name, clinic_name: slot.clinic_name, icp_tier: slot.icp_tier },
        {
          phoneE164: slot.phone_e164, status: nextStatus, usesAutoReply: autoCheck.isAutoReply,
          autoReplySample: autoCheck.isAutoReply ? inboundMsg.body_text : undefined,
          recommendedPlan: recommendPlanForProfile({ icpTier: slot.icp_tier, maturityStage: slot.maturity_stage }),
          openingMessage: slot.opening_message,
          timelineEvent: autoCheck.isAutoReply
            ? 'Auto-resposta WhatsApp Business detectada (IA silenciada, slot liberado).'
            : 'Resposta humana recebida no WhatsApp — assumido pelo consultor SDR.',
        }, dossiersDir,
      );
      released.push({ leadId: slot.lead_id, reason: nextStatus });
      continue;
    }
    const elapsedMin = slot.started_at ? (now.getTime() - Date.parse(slot.started_at)) / 60_000 : 0;
    if (elapsedMin >= timeoutMin) {
      db.prepare("UPDATE sequential_slots SET status = 'timed_out_1h', resolved_at = ?, updated_at = ? WHERE lead_id = ?").run(nowIso, nowIso, slot.lead_id);
      released.push({ leadId: slot.lead_id, reason: 'timed_out_1h' });
    }
  }

  const stillActive = db.prepare("SELECT COUNT(*) AS cnt FROM sequential_slots WHERE status = 'in_flight'").get();
  const openSlots = Math.max(0, maxActive - Number(stillActive?.cnt || 0));
  const queued = openSlots > 0 ? db.prepare("SELECT * FROM sequential_slots WHERE status = 'approved_queue' ORDER BY created_at ASC LIMIT ?").all(openSlots) : [];
  const dispatched = [];
  for (const slot of queued) {
    let dispatchId = null;
    if (!dryRun) {
      const blockReason = await isSlotBlockedBeforeSend({ supabase, evo, phoneE164: slot.phone_e164 });
      if (blockReason) {
        db.prepare('UPDATE sequential_slots SET status = ?, updated_at = ? WHERE lead_id = ?').run(
          blockReason === 'opt_out' ? 'canceled' : blockReason, nowIso, slot.lead_id,
        );
        continue;
      }
      if (typeof dispatchFn === 'function') await dispatchFn(slot);
      else if (evo) {
        const res = await evo.sendHumanText(slot.phone_e164, slot.opening_message);
        if (!res.ok) continue;
        dispatchId = await recordSequentialDispatchAudit({
          supabase, instanceKey: evo.instanceKey, leadId: slot.lead_id,
          phoneE164: slot.phone_e164, messageText: slot.opening_message, nowIso,
        });
        if (supabase) {
          await supabase.patch('platform_auto_leads', `id=eq.${encodeURIComponent(slot.lead_id)}`, {
            stage: 'contacted', last_contacted_at: nowIso,
          }).catch(() => undefined);
        }
      }
    }
    db.prepare("UPDATE sequential_slots SET status = 'in_flight', dispatch_id = COALESCE(?, dispatch_id), started_at = ?, updated_at = ? WHERE lead_id = ?")
      .run(dispatchId, nowIso, nowIso, slot.lead_id);
    bumpIcpConversionStat(db, slot.icp_tier, slot.maturity_stage, 'contacted_count');
    dispatched.push({ leadId: slot.lead_id, phone: slot.phone_e164, planId: slot.recommended_plan_id });
    if (!dryRun && queued.length > 1) await new Promise((r) => setTimeout(r, 4000));
  }
  return { windowClosed: false, released, dispatched };
}

export function getOrchestratorStatus(db) {
  return {
    byStatus: db.prepare('SELECT status, COUNT(*) AS count FROM sequential_slots GROUP BY status').all(),
    active: db.prepare("SELECT lead_id, full_name, clinic_name, recommended_plan_id, started_at FROM sequential_slots WHERE status = 'in_flight'").all(),
    icpStats: db.prepare('SELECT * FROM icp_conversion_stats ORDER BY contacted_count DESC').all(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const eq = a.indexOf('=');
    return eq === -1 ? [a.slice(2), true] : [a.slice(2, eq), a.slice(eq + 1)];
  }));
  const db = openBrainDb();
  const creds = resolveOpsCredentials();
  const supabase = createSupabaseRestClient(creds.supabaseUrl, creds.serviceKey);
  const evo = createEvolutionHttpClient(creds.evoUrl, creds.evoKey, creds.instanceKey);
  try {
    if (args.prepare) {
      console.log(JSON.stringify(await prepareBatch({
        db, supabase, evo, batch: Math.max(1, Number(args.batch || 10)),
        dryRun: Boolean(args['dry-run']), launchCouponCode: creds.launchCouponCode,
      }), null, 2));
    } else if (args['approve-batch'] || args.approve) {
      const ids = typeof args.approve === 'string' ? args.approve.split(',').filter(Boolean) : [];
      console.log(JSON.stringify(approveSlots({ db, ids }), null, 2));
    } else if (args.run) {
      const cycleOpts = {
        db, supabase, evo, maxActive: Math.min(2, Math.max(1, Number(args['max-active'] || 2))),
        timeoutMin: Math.max(15, Number(args['timeout-min'] || 60)),
        dryRun: Boolean(args['dry-run']), ignoreHours: Boolean(args['ignore-hours']),
      };
      if (args.daemon) {
        let running = true;
        process.on('SIGINT', () => { running = false; });
        process.on('SIGTERM', () => { running = false; });
        while (running) {
          console.log(JSON.stringify({ at: new Date().toISOString(), ...(await runOrchestratorCycle({ ...cycleOpts, now: new Date() })) }));
          for (let i = 0; i < 60 && running; i++) await new Promise((r) => setTimeout(r, 1000));
        }
      } else console.log(JSON.stringify(await runOrchestratorCycle(cycleOpts), null, 2));
    } else console.log(JSON.stringify(getOrchestratorStatus(db), null, 2));
  } finally {
    db.close();
  }
}
