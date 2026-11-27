#!/usr/bin/env node
/**
 * Super-Conversor Brain — Schema SQLite Nativo (Node 24 node:sqlite) & Seeds Pluri Fisio
 */

import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const DEFAULT_BRAIN_DB_PATH =
  process.env.CONVERSION_BRAIN_DB ||
  path.resolve(process.cwd(), '.local-data/conversion-brain/brain.sqlite');

export const TONE_DIRECTIVE =
  'Natural, humano e simpático, sem perder o profissionalismo e a formalidade (acolhedor com profissionais de saúde, objetivo, sem gírias, sem textão de telemarketing e sem excesso de emojis).';

export const SEED_STRATEGIES = [
  {
    id: 'S1_PAIN_MIRROR',
    name: 'Espelhamento Empático da Dor Pública',
    short_label: 'S1 • Espelhamento Empático',
    description:
      'Referencia com delicadeza e respeito o desafio real citado pelo fisioterapeuta (ex.: prontuário no papel, faltas, agenda) antes de falar do sistema.',
    opening_guideline:
      'Cumprimente pelo nome/Dr(a). de forma simpática e respeitosa, cite brevemente o tema da dor pública e faça 1 pergunta aberta leve sobre como lida com isso hoje.',
    follow_up_guideline:
      'Valide o esforço atual com empatia e mostre em 2 linhas como a Pluri Fisio resolve especificamente essa dor sem burocracia.',
    target_pains: ['prontuario', 'papel_planilha', 'faltas', 'financeiro', 'sistema_atual'],
    prior_alpha: 4.2,
    prior_beta: 1.8,
  },
  {
    id: 'S2_QUICK_DIAGNOSTIC',
    name: 'Diagnóstico Consultivo Breve',
    short_label: 'S2 • Diagnóstico Consultivo',
    description:
      'Abordagem consultiva em 1 pergunta objetiva sobre a rotina atual (agenda, evolução CREFITO e recebimentos) para abrir diálogo natural.',
    opening_guideline:
      'Apresente-se com cordialidade formal, diga o motivo do contato em 1 frase e pergunte se hoje organiza a rotina por planilha/papel ou algum sistema.',
    follow_up_guideline:
      'Adapte a resposta à realidade informada (autônomo, clínica pequena ou estúdio) e pergunte se gostaria de ver um exemplo rápido.',
    target_pains: ['organizacao_geral', 'abertura_clinica', 'recem_formado', 'papel_planilha'],
    prior_alpha: 3.8,
    prior_beta: 2.2,
  },
  {
    id: 'S3_TIME_SAVER_ROI',
    name: 'Foco em Tempo Clínico & Zero Faltas',
    short_label: 'S3 • Tempo Clínico & Anti-Faltas',
    description:
      'Prioriza devolver horas fora do expediente (menos tempo evoluindo prontuários e confirmando pacientes no WhatsApp).',
    opening_guideline:
      'Pergunte com leveza se o tempo entre atendimentos ou no fim do dia anda corrido com evoluções e confirmações de agenda.',
    follow_up_guideline:
      'Mostre como lembretes automáticos e evolução ágil no celular liberam horas úteis da semana sem perder rigor do CREFITO.',
    target_pains: ['faltas', 'prontuario', 'excesso_trabalho'],
    prior_alpha: 3.6,
    prior_beta: 2.4,
  },
  {
    id: 'S4_ANTI_COMPLEXITY',
    name: 'Simplicidade Guiada (Sem Complicação)',
    short_label: 'S4 • Simplicidade Guiada',
    description:
      'Voltada a profissionais experientes no papel/caderno ou receosos com tecnologia; enfatiza uso intuitivo e suporte humano próximo.',
    opening_guideline:
      'Valorize a experiência clínica da pessoa e pergunte se ela evita sistemas justamente por achar os tradicionais engessados ou difíceis.',
    follow_up_guideline:
      'Explique com serenidade que a Pluri Fisio foi desenhada para usar direto no celular, com implantação guiada passo a passo.',
    target_pains: ['papel_planilha', 'leigo_tecnologia', 'medo_sistema'],
    prior_alpha: 3.5,
    prior_beta: 2.5,
  },
  {
    id: 'S5_SOCIAL_PROOF_DEMO',
    name: 'Demonstração Visual Leve (Vídeo 1 min)',
    short_label: 'S5 • Vídeo 1 min / Teste Guiado',
    description:
      'Convida sem pressão para assistir a um vídeo curto (60s) ou fazer um teste rápido com apoio comercial cordial.',
    opening_guideline:
      'Faça conexão rápida com a especialidade/cidade do profissional e ofereça mostrar em 1 minuto como outros fisios organizam a rotina.',
    follow_up_guideline:
      'Após interesse, ofereça escolher entre testar na prática ou conversar 10 minutos para configurar junto.',
    target_pains: ['organizacao_geral', 'abertura_clinica', 'pilates'],
    prior_alpha: 3.4,
    prior_beta: 2.6,
  },
  {
    id: 'S6_SWITCHING_RESCUE',
    name: 'Transição Tranquila de Sistema Atual',
    short_label: 'S6 • Transição Sem Atrito',
    description:
      'Para quem reclama de sistema concorrente caro, lento ou com suporte ausente; foca em migração assistida e custo justo.',
    opening_guideline:
      'Reconheça com elegância o ponto de frustração relatado e pergunte o que mais trava o fluxo diário no sistema atual.',
    follow_up_guideline:
      'Explique como a transição é simples e não interrompe atendimentos nem histórico de pacientes.',
    target_pains: ['sistema_atual', 'custo_alto', 'suporte_ruim'],
    prior_alpha: 3.3,
    prior_beta: 2.7,
  },
];

export const SEED_TALKING_POINTS = [
  {
    id: 'TP_ACOLHIMENTO_FORMAL',
    polarity: 'strength',
    category: 'tom',
    label: 'Saudação simpática, humana e formalmente respeitosa',
    guidance: 'Tratar por Dr(a). ou primeiro nome com cordialidade profissional gera confiança imediata.',
  },
  {
    id: 'TP_MICRO_PERGUNTA',
    polarity: 'strength',
    category: 'engajamento',
    label: 'Terminar a abertura com 1 micro-pergunta simples',
    guidance: 'Facilita resposta rápida no intervalo entre pacientes sem exigir explicação longa.',
  },
  {
    id: 'TP_CREFITO_EVOLUCAO',
    polarity: 'strength',
    category: 'produto',
    label: 'Citar evolução clínica rápida compatível com CREFITO',
    guidance: 'Mostra domínio real da rotina do fisioterapeuta (anamnese, evolução por sessão, histórico).',
  },
  {
    id: 'TP_ZERO_PLANILHA',
    polarity: 'strength',
    category: 'dor',
    label: 'Tirar o peso do papel, Word e planilhas soltas',
    guidance: 'Conecta com a fadiga de preencher fichas fora do horário de atendimento.',
  },
  {
    id: 'TP_ANTI_FALTAS',
    polarity: 'strength',
    category: 'produto',
    label: 'Redução de faltas com confirmação prática no WhatsApp',
    guidance: 'Ganha atenção ao proteger o faturamento de sessões desmarcadas em cima da hora.',
  },
  {
    id: 'TP_FINANCEIRO_PACOTES',
    polarity: 'strength',
    category: 'produto',
    label: 'Controle claro de sessões pagas e pacotes',
    guidance: 'Resolve uma dor diária de autônomos e estúdios de Pilates sem planilhas paralelas.',
  },
  {
    id: 'TP_VIDEO_60S',
    polarity: 'strength',
    category: 'cta',
    label: 'Oferta de vídeo curto (1 min) antes de pedir reunião',
    guidance: 'Reduz atrito de agenda e deixa o lead ver o sistema antes de agendar demonstração.',
  },
  {
    id: 'TP_TESTE_SEM_PRESSAO',
    polarity: 'strength',
    category: 'cta',
    label: 'Convite cordial e sem pressão (respeita a rotina)',
    guidance: 'Preserva elegância comercial e evita sensação de cobrança agressiva.',
  },
  {
    id: 'WP_TEXTAO_PRIMEIRA_MSG',
    polarity: 'weakness',
    category: 'formato',
    label: 'Mensagem inicial longa com múltiplas ofertas (> 420 caracteres)',
    guidance: 'Evite enviar lista de funcionalidades logo no primeiro contato; causa silêncio ou opt-out.',
  },
  {
    id: 'WP_PRECO_CEDO_DEMAIS',
    polarity: 'weakness',
    category: 'timing',
    label: 'Falar de planos/preço antes de entender o cenário do lead',
    guidance: 'Evite apresentar tabela antes de confirmar a dor e o porte do atendimento.',
  },
  {
    id: 'WP_TOM_ROBOTICO',
    polarity: 'weakness',
    category: 'tom',
    label: 'Clichês de telemarketing ou abertura artificial automatizada',
    guidance: 'Evite expressões como "oportunidade única", "prezado cliente" ou textos padronizados.',
  },
  {
    id: 'WP_LINGUAGEM_INFORMAL_DEMAIS',
    polarity: 'weakness',
    category: 'tom',
    label: 'Informalidade excessiva, gírias ou excesso de emojis',
    guidance: 'Mantenha simpatia humana com elegância e respeito compatíveis com profissionais de saúde.',
  },
];

export function openBrainDb(dbPath = DEFAULT_BRAIN_DB_PATH) {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const db = new DatabaseSync(dbPath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
    PRAGMA auto_vacuum = INCREMENTAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS brain_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      short_label TEXT NOT NULL,
      description TEXT NOT NULL,
      opening_guideline TEXT NOT NULL,
      follow_up_guideline TEXT NOT NULL,
      target_pains_json TEXT NOT NULL,
      prior_alpha REAL NOT NULL DEFAULT 3.0,
      prior_beta REAL NOT NULL DEFAULT 2.0,
      weighted_funnel_sum REAL NOT NULL DEFAULT 0,
      weighted_llm_sum REAL NOT NULL DEFAULT 0,
      weight_total REAL NOT NULL DEFAULT 0,
      sample_count INTEGER NOT NULL DEFAULT 0,
      opt_out_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS talking_points (
      id TEXT PRIMARY KEY,
      polarity TEXT NOT NULL CHECK (polarity IN ('strength','weakness')),
      category TEXT NOT NULL,
      label TEXT NOT NULL,
      guidance TEXT NOT NULL,
      weighted_score_sum REAL NOT NULL DEFAULT 0,
      weight_total REAL NOT NULL DEFAULT 0,
      sample_count INTEGER NOT NULL DEFAULT 0,
      is_avoid_listed INTEGER NOT NULL DEFAULT 0,
      last_seen_at TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS strategy_segment_stats (
      strategy_id TEXT NOT NULL,
      icp_tier TEXT NOT NULL,
      pain_category TEXT NOT NULL,
      weighted_funnel_sum REAL NOT NULL DEFAULT 0,
      weighted_llm_sum REAL NOT NULL DEFAULT 0,
      weight_total REAL NOT NULL DEFAULT 0,
      sample_count INTEGER NOT NULL DEFAULT 0,
      opt_out_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (strategy_id, icp_tier, pain_category)
    );

    CREATE TABLE IF NOT EXISTS conversation_episodes (
      id TEXT PRIMARY KEY,
      conversation_id TEXT UNIQUE,
      lead_id TEXT,
      phone_hash TEXT NOT NULL,
      icp_tier TEXT NOT NULL,
      pain_category TEXT NOT NULL,
      strategy_id TEXT,
      outcome TEXT NOT NULL,
      funnel_reward REAL NOT NULL,
      llm_score REAL NOT NULL,
      strong_points_json TEXT NOT NULL,
      weak_points_json TEXT NOT NULL,
      objections_json TEXT NOT NULL,
      lesson TEXT NOT NULL,
      turns_count INTEGER NOT NULL DEFAULT 0,
      compaction_tier INTEGER NOT NULL DEFAULT 0,
      last_message_at TEXT,
      evaluated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transcript_blobs (
      episode_id TEXT PRIMARY KEY REFERENCES conversation_episodes(id) ON DELETE CASCADE,
      encoding TEXT NOT NULL DEFAULT 'zstd',
      raw_bytes INTEGER NOT NULL,
      compressed_bytes INTEGER NOT NULL,
      payload BLOB NOT NULL,
      archived_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pain_signal_history (
      signal_hash TEXT PRIMARY KEY,
      source_url TEXT,
      phone_hash TEXT,
      social_handle TEXT,
      full_name TEXT,
      pain_category TEXT,
      intent_score_5 REAL,
      ai_score_100 INTEGER,
      counter_evidence_passed INTEGER NOT NULL,
      feedback_status TEXT NOT NULL DEFAULT 'discovered',
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_cursors (
      source TEXT PRIMARY KEY,
      cursor_value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS context_routing_stats (
      strategy_id TEXT NOT NULL,
      origin_type TEXT NOT NULL,
      personality_archetype TEXT NOT NULL,
      pain_category TEXT NOT NULL,
      weighted_funnel_sum REAL NOT NULL DEFAULT 0,
      weighted_llm_sum REAL NOT NULL DEFAULT 0,
      weight_total REAL NOT NULL DEFAULT 0,
      sample_count INTEGER NOT NULL DEFAULT 0,
      opt_out_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (strategy_id, origin_type, personality_archetype, pain_category)
    );

    CREATE TABLE IF NOT EXISTS context_pins (
      context_key TEXT PRIMARY KEY,
      strategy_id TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sequential_slots (
      lead_id TEXT PRIMARY KEY,
      phone_e164 TEXT NOT NULL,
      full_name TEXT,
      clinic_name TEXT,
      icp_tier TEXT NOT NULL DEFAULT 'solo_physio',
      maturity_stage TEXT NOT NULL DEFAULT 'desconhecido',
      origin_type TEXT NOT NULL DEFAULT 'profile_bio',
      personality_archetype TEXT NOT NULL DEFAULT 'relacional_acolhedor',
      recommended_plan_id TEXT NOT NULL DEFAULT 'prof_basico',
      strategy_id TEXT,
      opening_message TEXT NOT NULL,
      dossier_path TEXT,
      campaign_id TEXT,
      dispatch_id TEXT,
      status TEXT NOT NULL CHECK (status IN (
        'pending_approval',
        'approved_queue',
        'in_flight',
        'human_replied',
        'auto_reply_detected',
        'timed_out_1h',
        'completed',
        'skipped_existing_chat',
        'skipped_no_whatsapp',
        'canceled'
      )),
      auto_reply_sample TEXT,
      notes TEXT,
      started_at TEXT,
      resolved_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sequential_slots_status
      ON sequential_slots(status, updated_at);

    CREATE TABLE IF NOT EXISTS icp_conversion_stats (
      icp_tier TEXT NOT NULL,
      maturity_stage TEXT NOT NULL,
      contacted_count INTEGER NOT NULL DEFAULT 0,
      replied_count INTEGER NOT NULL DEFAULT 0,
      auto_reply_count INTEGER NOT NULL DEFAULT 0,
      demo_count INTEGER NOT NULL DEFAULT 0,
      converted_count INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (icp_tier, maturity_stage)
    );
  `);

  ensureConversationEpisodeContextColumns(db);
  seedDefaults(db);
  return db;
}

function ensureConversationEpisodeContextColumns(db) {
  const cols = db.prepare('PRAGMA table_info(conversation_episodes)').all();
  const names = new Set(cols.map((c) => String(c.name)));
  if (!names.has('origin_type')) {
    db.exec("ALTER TABLE conversation_episodes ADD COLUMN origin_type TEXT NOT NULL DEFAULT 'post_comment_pain'");
  }
  if (!names.has('personality_archetype')) {
    db.exec(
      "ALTER TABLE conversation_episodes ADD COLUMN personality_archetype TEXT NOT NULL DEFAULT 'relacional_acolhedor'"
    );
  }
}

function seedDefaults(db) {
  const now = new Date().toISOString();
  const insertCfg = db.prepare(
    'INSERT OR IGNORE INTO brain_config (key, value, updated_at) VALUES (?, ?, ?)'
  );
  insertCfg.run('exploit_ratio', '0.80', now);
  insertCfg.run('max_brain_mb', String(process.env.MAX_BRAIN_MB || '250'), now);
  insertCfg.run('pinned_strategy_id', '', now);
  insertCfg.run('tone_directive', TONE_DIRECTIVE, now);

  const insertStrat = db.prepare(`
    INSERT OR IGNORE INTO strategies (
      id, name, short_label, description, opening_guideline, follow_up_guideline,
      target_pains_json, prior_alpha, prior_beta, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const s of SEED_STRATEGIES) {
    insertStrat.run(
      s.id,
      s.name,
      s.short_label,
      s.description,
      s.opening_guideline,
      s.follow_up_guideline,
      JSON.stringify(s.target_pains),
      s.prior_alpha,
      s.prior_beta,
      now
    );
  }

  const insertPoint = db.prepare(`
    INSERT OR IGNORE INTO talking_points (
      id, polarity, category, label, guidance, is_avoid_listed, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  for (const p of SEED_TALKING_POINTS) {
    insertPoint.run(
      p.id,
      p.polarity,
      p.category,
      p.label,
      p.guidance,
      p.polarity === 'weakness' ? 1 : 0,
      now
    );
  }
}

export function getBrainConfig(db, key, fallback = '') {
  const row = db.prepare('SELECT value FROM brain_config WHERE key = ?').get(key);
  return row ? String(row.value) : fallback;
}

export function setBrainConfig(db, key, value) {
  db.prepare(
    `INSERT INTO brain_config (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, String(value), new Date().toISOString());
}

export function setContextPin(db, contextKey, strategyId) {
  db.prepare(
    `INSERT INTO context_pins (context_key, strategy_id, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(context_key) DO UPDATE SET strategy_id = excluded.strategy_id, updated_at = excluded.updated_at`
  ).run(String(contextKey).trim(), String(strategyId).trim(), new Date().toISOString());
}

export function clearContextPin(db, contextKey) {
  db.prepare('DELETE FROM context_pins WHERE context_key = ?').run(String(contextKey).trim());
}

export function getContextPins(db) {
  return db.prepare('SELECT context_key, strategy_id, updated_at FROM context_pins ORDER BY context_key ASC').all();
}
