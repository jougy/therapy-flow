#!/usr/bin/env node
/**
 * Super-Conversor Brain CLI (Pluri Fisio + First Customer Finder)
 *
 * Subcomandos:
 *   npm run leads:find-signals -- [--input=arq.json|--demo] [--dry-run] [--out=arq.json]
 *   npm run leads:learn        -- [--demo] [--dry-run]
 *   npm run leads:ranking
 *   npm run leads:select       -- --strategy=<ID> [--publish] [--agent-slug=<slug>]
 *   npm run leads:compact
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import {
  clearContextPin,
  DEFAULT_BRAIN_DB_PATH,
  getContextPins,
  openBrainDb,
  setBrainConfig,
  setContextPin,
} from './schema.mjs';
import {
  buildCompactPlaybookSnapshot,
  getStrategyRankings,
  getTalkingPointRankings,
  PLAYBOOK_END_MARKER,
  PLAYBOOK_MAX_CHARS,
  PLAYBOOK_START_MARKER,
} from './ranker.mjs';
import { evaluateConversationPostMortem } from './evaluator.mjs';
import { getBrainStorageStats, runSmartCompaction } from './compactor.mjs';
import { isDuplicateSignal, scoreAndCurateSignal } from './signalFilter.mjs';
import { PERSONALITY_ARCHETYPES } from './personalityProfiler.mjs';
import { loadLocalMarketingEnv } from '../../marketing-ops/media-engine.mjs';

function parseArg(prefix) {
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const subcommand = process.argv[2] || 'ranking';
const isDemo = process.argv.includes('--demo');
const isDryRun = process.argv.includes('--dry-run');
const shouldPublish = process.argv.includes('--publish');

async function getSupabaseAdminClient() {
  const localEnv = loadLocalMarketingEnv();
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || localEnv.SUPABASE_URL;
  const projectRef =
    process.env.VITE_SUPABASE_PROJECT_ID || (supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : null);
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || localEnv.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey && process.env.SUPABASE_ACCESS_TOKEN && projectRef) {
    try {
      const res = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/api-keys`, {
        headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
      });
      if (res.ok) {
        const keys = await res.json();
        const srv = Array.isArray(keys) ? keys.find((k) => k.name === 'service_role') : null;
        if (srv?.api_key) serviceKey = srv.api_key;
      }
    } catch {
      return null;
    }
  }
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

function getDemoSignals() {
  const recentIso = new Date(Date.now() - 5 * 86_400_000).toISOString();
  return [
    {
      full_name: 'Dra. Marina Albuquerque',
      source_url: 'https://www.instagram.com/p/DemoFisioProntuario01/',
      published_at: recentIso,
      source_platform: 'web_signal',
      city: 'Campinas',
      state: 'SP',
      phone: '(19) 99211-4401',
      instagram_handle: '@dramarinafisio.home',
      pain_excerpt:
        'Alguém indica um sistema de prontuário e agenda simples para fisioterapeuta domiciliar? Estou cansada de evoluir ficha no Word e perder controle de quem pagou o pacote.',
    },
    {
      full_name: 'Dr. Rafael Nogueira',
      source_url: 'https://www.reddit.com/r/fisioterapia/comments/demo02/',
      published_at: recentIso,
      source_platform: 'web_signal',
      city: 'Belo Horizonte',
      state: 'MG',
      instagram_handle: '@clinicapilates.nogueira',
      pain_excerpt:
        'Abrindo minha clínica com 2 colegas e já tivemos 4 faltas essa semana por falta de confirmação automática no WhatsApp. Planilha não está dando conta.',
    },
    {
      full_name: 'Carlos Henrique (Paciente)',
      source_url: 'https://x.com/carlos_paciente/status/demo03',
      published_at: recentIso,
      source_platform: 'web_signal',
      city: 'São Paulo',
      state: 'SP',
      pain_excerpt: 'Estou com dor lombar forte, procuro fisioterapeuta urgente na zona sul de SP!',
    },
    {
      full_name: 'Clínica VitalFisio Campinas',
      clinic_name: 'Clínica VitalFisio Campinas',
      placeId: 'demo-place-04',
      source_url: 'https://maps.google.com/?cid=demo04',
      source_platform: 'google_maps',
      icp_tier: 'clinic_owner',
      city: 'Campinas',
      state: 'SP',
      phone: '(19) 3255-8800',
      pain_excerpt: 'Clínica de Fisioterapia e Reabilitação Ortopédica com 4 profissionais no Cambuí.',
    },
  ];
}

async function cmdFindSignals(db) {
  const inputPath = parseArg('--input=');
  const outPath = parseArg('--out=');
  const useStdin = process.argv.includes('--stdin');

  let rawItems = [];
  if (isDemo) rawItems = getDemoSignals();
  else if (inputPath) {
    const parsed = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    rawItems = Array.isArray(parsed) ? parsed : [parsed];
  } else if (useStdin) {
    const parsed = JSON.parse(fs.readFileSync(0, 'utf8'));
    rawItems = Array.isArray(parsed) ? parsed : [parsed];
  } else {
    throw new Error('Informe --input=<arquivo.json>, --stdin ou --demo.');
  }

  let dedupSkipped = 0;
  const evaluated = [];
  for (const item of rawItems) {
    const curated = await scoreAndCurateSignal(db, item);
    if (isDuplicateSignal(db, curated.dedup)) {
      dedupSkipped++;
      continue;
    }
    evaluated.push(curated);
  }

  const approved = evaluated.filter((e) => e.qualified);
  const blocked = evaluated.filter((e) => !e.qualified);

  console.log(`\n🔎 [FIRST-CUSTOMER-FINDER — PLANO DE ABORDAGEM PARA APROVAÇÃO]`);
  console.log(
    `Analisados: ${rawItems.length} | Qualificados: ${approved.length} | Bloqueados (Contra-evidência/Nota baixa): ${blocked.length} | Duplicados ignorados: ${dedupSkipped}`
  );

  for (let i = 0; i < approved.length; i++) {
    const item = approved[i];
    const lp = item.leadPayload;
    const strat = lp.raw_metadata.strategy_assignment;
    const orig = lp.raw_metadata.origin_context;
    const pers = lp.raw_metadata.personality_profile;
    const alts = (strat.alternatives || [])
      .slice(0, 3)
      .map((a) => `${a.shortLabel} (${a.estimatedSuccessPct}%)`)
      .join(' > ');

    console.log(
      `\n#${i + 1} ${lp.full_name} (${lp.icp_tier}) — Nota: ${item.intentScore5}/5 (ai_score=${lp.ai_score})`
    );
    console.log(`   Origem & Gancho: ${orig.discoveryLabel} | Gancho: "${orig.contentHook}"`);
    console.log(`   Personalidade: ${pers.label} — ${pers.communicationStyle}`);
    console.log(`   URL: ${lp.source_post_url || 'N/A'} | Contra-evidência: OK (${item.counterEvidenceReason})`);
    console.log(`   Estratégia Escolhida: ${strat.shortLabel} [${strat.mode}] • Chance Est.: ${strat.estimatedSuccessPct}%`);
    console.log(`   Top 3 Ranqueadas p/ esta pessoa: ${alts}`);
    console.log(`   Prévia Abertura: "${lp.ai_icebreaker_message}"`);
  }

  if (blocked.length > 0) {
    console.log(`\n🚫 Descartados pela rubrica / contra-evidência:`);
    for (const b of blocked) {
      console.log(
        `   - ${b.leadPayload.full_name}: nota ${b.intentScore5}/5 | Motivo: ${b.counterEvidenceReason}`
      );
    }
  }

  const payloads = approved.map((a) => a.leadPayload);
  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(payloads, null, 2), 'utf8');
    console.log(`\n💾 JSON salvo em ${outPath}`);
  }

  if (isDryRun) {
    console.log(`\n🛡️ [--dry-run] Nada foi gravado no banco nem enviado. Revise o plano acima antes de aprovar.`);
    return;
  }

  const nowIso = new Date().toISOString();
  const insHist = db.prepare(`
    INSERT OR IGNORE INTO pain_signal_history (
      signal_hash, source_url, phone_hash, social_handle, full_name,
      pain_category, intent_score_5, ai_score_100, counter_evidence_passed, feedback_status, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const e of evaluated) {
    insHist.run(
      e.dedup.signalHash,
      e.dedup.cleanUrl || null,
      e.dedup.phoneHash || null,
      e.dedup.handle || null,
      e.leadPayload.full_name,
      e.leadPayload.raw_metadata.pain_signal.painCategory,
      e.intentScore5,
      e.leadPayload.ai_score,
      e.counterEvidencePassed ? 1 : 0,
      e.qualified ? 'approved' : 'rejected',
      e.counterEvidenceReason,
      nowIso
    );
  }

  const admin = await getSupabaseAdminClient();
  if (admin && payloads.length > 0) {
    const { data, error } = await admin.rpc('upsert_platform_auto_leads_batch', {
      p_leads: payloads,
      p_run_id: null,
      p_routine_id: null,
    });
    if (error) throw new Error(`Supabase upsert error: ${error.message}`);
    console.log(`\n✅ Gravados em platform_auto_leads: ${JSON.stringify(data)}`);
  } else {
    console.log(`\nℹ️ Histórico local atualizado. Credenciais Supabase ausentes neste shell para gravação em nuvem.`);
  }
}

function cmdRanking(db) {
  const strategies = getStrategyRankings(db);
  const { strengths, weaknessesToAvoid } = getTalkingPointRankings(db);
  const stats = getBrainStorageStats(db);
  const pins = getContextPins(db);

  const matrixScenarios = [
    { label: 'Post/Comentário × Sobrecarregado', originType: 'post_comment_pain', personalityArchetype: 'sobrecarregado_urgente', painCategory: 'prontuario' },
    { label: 'Post/Comentário × Cauteloso (Papel/Planilha)', originType: 'post_comment_pain', personalityArchetype: 'cauteloso_tradicional', painCategory: 'papel_planilha' },
    { label: 'Post/Comentário × Analítico (Trocar Sistema)', originType: 'post_comment_pain', personalityArchetype: 'analitico_tecnico', painCategory: 'sistema_atual' },
    { label: 'Google Maps × Pragmático (Gestor Clínica)', originType: 'directory_maps', personalityArchetype: 'pragmatico_direto', painCategory: 'organizacao_geral' },
    { label: 'Instagram/Bio × Relacional (Autônomo/Pilates)', originType: 'profile_bio', personalityArchetype: 'relacional_acolhedor', painCategory: 'organizacao_geral' },
  ];

  console.log(`\n🧭 [ROTEAMENTO DINÂMICO (ORIGEM × PERSONALIDADE) — POLÍTICA 80/20]`);
  for (const sc of matrixScenarios) {
    const r = getStrategyRankings(db, sc)[0];
    console.log(`  • ${sc.label} → [${r.id}] ${r.shortLabel} (${r.estimatedSuccessPct}% est.)${r.isPinned ? ' ⭐ PIN' : ''}`);
  }
  if (pins.length > 0) {
    console.log(`  📌 Regras contextuais fixadas: ${pins.map((p) => `${p.context_key} => ${p.strategy_id}`).join(' | ')}`);
  }

  console.log(`\n🏆 [SUPER-CONVERSOR BRAIN — RANKING GERAL DE ESTRATÉGIAS]`);
  strategies.forEach((s, idx) => {
    const pinTag = s.isPinned ? ' ⭐ PADRÃO GLOBAL' : '';
    console.log(
      `  ${idx + 1}. [${s.id}] ${s.name}${pinTag} — Chance Est.: ${s.estimatedSuccessPct}% | Nota: ${s.compositeScore10.toFixed(2)}/10 | Amostras: ${s.sampleCount}`
    );
    console.log(`     ↳ ${s.description}`);
  });

  console.log(`\n💎 [TOP PONTOS FORTES DO DISCURSO]`);
  strengths.slice(0, 6).forEach((p, idx) => {
    console.log(`  ${idx + 1}. (${p.score.toFixed(2)}/10 | n=${p.sampleCount}) ${p.label} [${p.id}]`);
  });

  console.log(`\n⚠️ [PONTOS FRACOS / EVITAR]`);
  weaknessesToAvoid.slice(0, 5).forEach((w, idx) => {
    console.log(`  ${idx + 1}. (${w.score.toFixed(2)}/10 | n=${w.sampleCount}) ${w.label} [${w.id}]`);
  });

  const kb = (stats.dbSizeBytes / 1024).toFixed(1);
  console.log(
    `\n🗜️ [ARMAZENAMENTO LOCAL ZSTD] DB: ${kb} KB (${stats.dbPath}) | Tier 0: ${stats.tier0Count} | Tier 1 (Zstd): ${stats.tier1Count} | Tier 2 (Archive): ${stats.tier2Count} | Economia Zstd: ${stats.compressionRatioPct}%`
  );
}

async function cmdLearn(db) {
  let processed = 0;

  if (isDemo) {
    const demoEpisodes = [
      {
        conversation: { id: `demo-conv-1`, phone_e164: '5519992114401', funnel_stage: 'scheduled', updated_at: new Date().toISOString() },
        lead: { id: 'demo-lead-1', icp_tier: 'solo_physio', stage: 'meeting_scheduled', raw_metadata: { pain_signal: { painCategory: 'prontuario' }, strategy_assignment: { strategyId: 'S1_PAIN_MIRROR' } } },
        messages: [
          { direction: 'outbound', sender_role: 'ai', body_text: 'Olá, Dra. Marina, tudo bem? Vi que comentou sobre evoluções no Word fora do horário. Hoje já testou algo pensado para fisioterapia?' },
          { direction: 'inbound', sender_role: 'lead', body_text: 'Ainda não, perco quase 1h por noite com isso.' },
          { direction: 'outbound', sender_role: 'ai', body_text: 'Entendo bem. A Pluri Fisio faz evolução CREFITO em 1 min no celular. Posso mandar um vídeo de 60s sem compromisso?' },
          { direction: 'inbound', sender_role: 'lead', body_text: 'Pode sim, gostei! Vamos agendar amanhã às 14h.' },
        ],
      },
    ];
    for (const ep of demoEpisodes) {
      if (!isDryRun) await evaluateConversationPostMortem(db, ep);
      processed++;
    }
  } else {
    const admin = await getSupabaseAdminClient();
    if (!admin) {
      console.log('ℹ️ Supabase credentials ausentes neste shell. Use --demo ou exporte env via Pulumi ESC.');
      cmdRanking(db);
      return;
    }

    const cursorRow = db.prepare("SELECT cursor_value FROM sync_cursors WHERE source = 'last_conv_sync'").get();
    const sinceIso = cursorRow?.cursor_value || '1970-01-01T00:00:00.000Z';

    const { data: convs, error } = await admin
      .from('marketing_zap_conversations')
      .select('id, lead_id, phone_e164, funnel_stage, intent_classification, structured_facts, ai_turns_count, updated_at')
      .gt('updated_at', sinceIso)
      .gte('ai_turns_count', 1)
      .is('deleted_at', null)
      .order('updated_at', { ascending: true })
      .limit(25);
    if (error) throw new Error(error.message);

    let maxUpdatedAt = sinceIso;
    for (const conv of convs || []) {
      const [{ data: msgs }, { data: lead }] = await Promise.all([
        admin.from('marketing_zap_messages').select('direction, sender_role, body_text, created_at').eq('conversation_id', conv.id).order('created_at', { ascending: true }),
        conv.lead_id
          ? admin.from('platform_auto_leads').select('id, phone, icp_tier, stage, raw_metadata').eq('id', conv.lead_id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      if (!isDryRun) await evaluateConversationPostMortem(db, { conversation: conv, messages: msgs || [], lead });
      if (conv.updated_at && conv.updated_at > maxUpdatedAt) maxUpdatedAt = conv.updated_at;
      processed++;
    }

    if (!isDryRun && processed > 0) {
      db.prepare(
        `INSERT INTO sync_cursors (source, cursor_value, updated_at) VALUES ('last_conv_sync', ?, ?)
         ON CONFLICT(source) DO UPDATE SET cursor_value = excluded.cursor_value, updated_at = excluded.updated_at`
      ).run(maxUpdatedAt, new Date().toISOString());
    }
  }

  if (!isDryRun) runSmartCompaction(db);
  console.log(`\n🧠 [LEADS:LEARN] ${processed} conversa(s) analisada(s)${isDryRun ? ' (dry-run)' : ''}.`);
  cmdRanking(db);
  console.log(`\n👉 Para selecionar e publicar uma estratégia no bot WhatsApp, rode:\n   npm run leads:select -- --strategy=<ID_DA_ESTRATEGIA> --publish`);
}

async function cmdSelect(db) {
  const strategyId = parseArg('--strategy=');
  const contextKey = parseArg('--context=');
  const modeArg = parseArg('--mode=');
  const agentSlug = parseArg('--agent-slug=');
  const rankings = getStrategyRankings(db);

  if (modeArg === 'dynamic') {
    setBrainConfig(db, 'pinned_strategy_id', '');
    if (contextKey) clearContextPin(db, contextKey);
    console.log('\n🧭 Modo 100% Dinâmico ativado (cada lead segue Origem × Personalidade + 80/20).');
  } else {
    if (!strategyId) {
      console.error(
        '❌ Informe --mode=dynamic ou --strategy=<ID> [--context=<origem>:<personalidade>].\n   Estratégias:',
        rankings.map((r) => r.id).join(', '),
        '\n   Personalidades:',
        Object.keys(PERSONALITY_ARCHETYPES).join(', ')
      );
      process.exit(1);
    }
    const found = rankings.find((r) => r.id === strategyId);
    if (!found) {
      console.error(`❌ Estratégia desconhecida "${strategyId}". Opções: ${rankings.map((r) => r.id).join(', ')}`);
      process.exit(1);
    }
    if (contextKey) {
      setContextPin(db, contextKey, strategyId);
      console.log(`\n⭐ Estratégia fixada para o contexto [${contextKey}] (80/20): ${found.id} (${found.name})`);
    } else {
      setBrainConfig(db, 'pinned_strategy_id', strategyId);
      console.log(`\n⭐ Estratégia global fixada (80/20): ${found.id} (${found.name})`);
    }
  }

  const snapshot = buildCompactPlaybookSnapshot(db);
  console.log(`📏 Tamanho do Playbook Snapshot: ${snapshot.length} / ${PLAYBOOK_MAX_CHARS} chars\n`);
  console.log(snapshot);

  if (!shouldPublish) {
    console.log(`\n🛡️ Modo preview apenas. Para enviar ao bot no Supabase, adicione --publish.`);
    return;
  }

  const admin = await getSupabaseAdminClient();
  if (!admin) throw new Error('Credenciais Supabase ausentes para --publish.');

  let q = admin.from('marketing_ai_agents').select('id, slug, knowledge_base').eq('tenant_scope', 'platform').is('deleted_at', null);
  q = agentSlug ? q.eq('slug', agentSlug) : q.eq('is_active', true);
  const { data: agents, error } = await q;
  if (error) throw new Error(error.message);

  for (const agent of agents || []) {
    const existingKb = String(agent.knowledge_base || '');
    const blockRegex = new RegExp(`${PLAYBOOK_START_MARKER}[\\s\\S]*?${PLAYBOOK_END_MARKER}`);
    const nextKb = blockRegex.test(existingKb)
      ? existingKb.replace(blockRegex, snapshot)
      : [existingKb.trim(), snapshot].filter(Boolean).join('\n\n');
    await admin.from('marketing_ai_agents').update({ knowledge_base: nextKb }).eq('id', agent.id);
    console.log(`✅ Playbook publicado no agente "${agent.slug}" (${agent.id}).`);
  }
}

function cmdCompact(db) {
  const res = runSmartCompaction(db, { dbPath: DEFAULT_BRAIN_DB_PATH });
  console.log(
    `\n🗜️ [LEADS:COMPACT] DB: ${(res.dbSizeBytes / 1024).toFixed(1)} KB | Promovidos Tier 1: ${res.tier1Promoted} | Arquivados Tier 2: ${res.tier2ArchivedCount} | Economia Zstd atual: ${res.compressionRatioPct}%`
  );
}

async function main() {
  const db = openBrainDb();
  try {
    if (subcommand === 'find-signals') await cmdFindSignals(db);
    else if (subcommand === 'learn') await cmdLearn(db);
    else if (subcommand === 'select') await cmdSelect(db);
    else if (subcommand === 'compact') cmdCompact(db);
    else cmdRanking(db);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error('❌ [BRAIN CLI]', err?.message || err);
  process.exit(1);
});
