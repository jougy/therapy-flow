#!/usr/bin/env node
/**
 * Testes Unitários — Super-Conversor Brain, Ranker 2 Níveis, Bandit 80/20, Snapshot, Zstd & Cascade
 */

import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { DatabaseSync } from 'node:sqlite';
import { openBrainDb, setBrainConfig, setContextPin } from '../schema.mjs';
import {
  buildCompactPlaybookSnapshot,
  getStrategyRankings,
  getTalkingPointRankings,
  PLAYBOOK_END_MARKER,
  PLAYBOOK_MAX_CHARS,
  PLAYBOOK_START_MARKER,
  recordEpisodeOutcome,
  selectStrategyForLead,
} from '../ranker.mjs';
import {
  compressTranscriptBlob,
  decompressTranscriptBlob,
  runSmartCompaction,
  storeTranscriptForEpisode,
} from '../compactor.mjs';
import { extractJsonFromText, truncatePromptText } from '../../lib/local-llm-cascade.mjs';
import { scoreAndCurateSignal } from '../signalFilter.mjs';
import { composeContextualOpening, profileLeadContext } from '../personalityProfiler.mjs';

const tempPaths = [];
function createTempBrain() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluri-brain-test-'));
  const dbPath = path.join(dir, 'brain.sqlite');
  tempPaths.push(dir);
  return { dir, dbPath, db: openBrainDb(dbPath) };
}

after(() => {
  for (const dir of tempPaths) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // ignore
    }
  }
});

test('1. Schema inicializa 6 estratégias e 12 talking points da Pluri Fisio', () => {
  const { db } = createTempBrain();
  try {
    const strats = db.prepare('SELECT id FROM strategies').all();
    const points = db.prepare('SELECT id FROM talking_points').all();
    assert.equal(strats.length, 6);
    assert.equal(points.length, 12);
  } finally {
    db.close();
  }
});

test('2. Ranking Bayesiano em 2 níveis promove pontos fortes, lista pontos fracos e penaliza opt_out', () => {
  const { db } = createTempBrain();
  try {
    // Registra 4 vitórias com S3_TIME_SAVER_ROI e TP_ANTI_FALTAS
    for (let i = 0; i < 4; i++) {
      recordEpisodeOutcome(db, {
        id: `ep-win-${i}`,
        icpTier: 'clinic_owner',
        painCategory: 'faltas',
        strategyId: 'S3_TIME_SAVER_ROI',
        outcome: 'converted_trial',
        llmScore: 9.2,
        strongPoints: [{ id: 'TP_ANTI_FALTAS', label: 'Redução de faltas', score_0_10: 9.4 }],
        weakPoints: [{ id: 'WP_NEW_FRICTION', label: 'Abertura sem saudação', score_0_10: 1.5 }],
      });
    }

    // Penaliza S6_SWITCHING_RESCUE com opt_out
    recordEpisodeOutcome(db, {
      id: 'ep-optout-1',
      icpTier: 'clinic_owner',
      painCategory: 'faltas',
      strategyId: 'S6_SWITCHING_RESCUE',
      outcome: 'opt_out',
      llmScore: 1.5,
      strongPoints: [],
      weakPoints: [{ id: 'WP_TOM_ROBOTICO', label: 'Tom robótico', score_0_10: 1.0 }],
    });

    const { strengths, weaknessesToAvoid } = getTalkingPointRankings(db);
    assert.equal(strengths[0].id, 'TP_ANTI_FALTAS');
    assert.ok(strengths[0].score >= 7.5);

    const avoidIds = new Set(weaknessesToAvoid.map((w) => w.id));
    assert.ok(avoidIds.has('WP_NEW_FRICTION'), 'Ponto com n>=3 e score<=4 deve ir para avoid_list');

    const stratRanks = getStrategyRankings(db, { icpTier: 'clinic_owner', painCategory: 'faltas' });
    assert.equal(stratRanks[0].id, 'S3_TIME_SAVER_ROI');
    const s6 = stratRanks.find((s) => s.id === 'S6_SWITCHING_RESCUE');
    assert.ok(s6 && s6.optOutCount === 1);
    assert.ok(stratRanks[0].estimatedSuccessPct > s6.estimatedSuccessPct);
  } finally {
    db.close();
  }
});

test('3. Política Bandit 80/20 respeita estratégia fixada e explora em 20% das seleções', () => {
  const { db } = createTempBrain();
  try {
    setBrainConfig(db, 'pinned_strategy_id', 'S4_ANTI_COMPLEXITY');

    const exploitPick = selectStrategyForLead(db, {
      icpTier: 'solo_physio',
      painCategory: 'papel_planilha',
      randomFn: () => 0.15,
    });
    assert.equal(exploitPick.mode, 'exploit_pinned');
    assert.equal(exploitPick.strategy.id, 'S4_ANTI_COMPLEXITY');

    const explorePick = selectStrategyForLead(db, {
      icpTier: 'solo_physio',
      painCategory: 'papel_planilha',
      randomFn: () => 0.92,
    });
    assert.equal(explorePick.mode, 'explore');
    assert.notEqual(explorePick.strategy.id, 'S4_ANTI_COMPLEXITY');
  } finally {
    db.close();
  }
});

test('4. Playbook Snapshot respeita teto <= 2200 chars, marcadores e tom profissional', () => {
  const { db } = createTempBrain();
  try {
    setBrainConfig(db, 'pinned_strategy_id', 'S1_PAIN_MIRROR');
    const snapshot = buildCompactPlaybookSnapshot(db);
    assert.ok(snapshot.length <= PLAYBOOK_MAX_CHARS, `Snapshot excedeu limite: ${snapshot.length}`);
    assert.ok(snapshot.startsWith(PLAYBOOK_START_MARKER));
    assert.ok(snapshot.endsWith(PLAYBOOK_END_MARKER));
    assert.match(snapshot, /S1_PAIN_MIRROR/);
    assert.match(snapshot, /Natural, humano e simpático, sem perder o profissionalismo e a formalidade/i);
  } finally {
    db.close();
  }
});

test('5. Compactação Zstd em 3 camadas é lossless (>55% redução) e gera arquivo .jsonl.zst preservando priors', () => {
  const { dir, dbPath, db } = createTempBrain();
  try {
    const realisticConversation = {
      turns: Array.from({ length: 14 }, (_, idx) => ({
        role: idx % 2 === 0 ? 'ai' : 'lead',
        text: `Mensagem ${idx + 1}: Atendimento de fisioterapia domiciliar, evolução CREFITO, controle de pacotes e lembretes no WhatsApp sem planilha.`,
      })),
    };

    const compressed = compressTranscriptBlob(realisticConversation);
    assert.equal(compressed.encoding, 'zstd');
    const ratio = (compressed.rawBytes - compressed.compressedBytes) / compressed.rawBytes;
    assert.ok(ratio > 0.55, `Esperado >55% compressão, obtido ${(ratio * 100).toFixed(1)}%`);
    const restored = decompressTranscriptBlob(compressed.payload, compressed.encoding);
    assert.deepEqual(restored, realisticConversation);

    const days20AgoIso = new Date(Date.now() - 20 * 86_400_000).toISOString();
    recordEpisodeOutcome(db, {
      id: 'ep-archive-1',
      icpTier: 'solo_physio',
      painCategory: 'prontuario',
      strategyId: 'S1_PAIN_MIRROR',
      outcome: 'meeting_scheduled',
      llmScore: 8.8,
      strongPoints: [{ id: 'TP_CREFITO_EVOLUCAO', label: 'Evolução CREFITO', score_0_10: 8.9 }],
      weakPoints: [],
      evaluatedAt: days20AgoIso,
      lastMessageAt: days20AgoIso,
    });
    storeTranscriptForEpisode(db, 'ep-archive-1', realisticConversation);

    const archivesDir = path.join(dir, 'archives');
    const c1 = runSmartCompaction(db, { dbPath, hotDays: 7, warmDays: 180, archivesDir });
    assert.equal(c1.tier1Promoted, 1);
    assert.equal(c1.tier2ArchivedCount, 0);

    const c2 = runSmartCompaction(db, {
      dbPath,
      hotDays: 7,
      warmDays: 180,
      archivesDir,
      forceNowMs: Date.now() + 200 * 86_400_000,
    });
    assert.equal(c2.tier2ArchivedCount, 1);

    const archiveFiles = fs.readdirSync(archivesDir).filter((f) => f.endsWith('.jsonl.zst'));
    assert.equal(archiveFiles.length, 1);

    const statsAfter = getStrategyRankings(db).find((s) => s.id === 'S1_PAIN_MIRROR');
    assert.equal(statsAfter.sampleCount, 1, 'Priors estatísticos devem continuar intactos após arquivamento Tier 2');
  } finally {
    db.close();
  }
});

test('6. Cascade local extrai JSON em blocos markdown, trunca textos e bloqueia paciente na contra-evidência', async () => {
  const parsedFenced = extractJsonFromText('Aqui está o resultado:\n```json\n{"strategy_score_0_10": 8.5, "ok": true}\n```\nFim.');
  assert.deepEqual(parsedFenced, { strategy_score_0_10: 8.5, ok: true });

  const longText = 'A'.repeat(9000);
  const truncated = truncatePromptText(longText, 6000);
  assert.ok(truncated.length <= 6000);

  const prevOffline = process.env.LOCAL_LLM_OFFLINE;
  process.env.LOCAL_LLM_OFFLINE = '1';
  const { db } = createTempBrain();
  try {
    const patientSignal = await scoreAndCurateSignal(db, {
      full_name: 'Carlos Paciente',
      source_url: 'https://x.com/carlos/status/1',
      published_at: new Date().toISOString(),
      pain_excerpt: 'Estou com dor lombar, procuro fisioterapeuta urgente na zona sul!',
    });
    assert.equal(patientSignal.counterEvidencePassed, false);
    assert.equal(patientSignal.qualified, false);
    assert.ok(patientSignal.intentScore5 <= 1.5);
  } finally {
    db.close();
    if (prevOffline === undefined) delete process.env.LOCAL_LLM_OFFLINE;
    else process.env.LOCAL_LLM_OFFLINE = prevOffline;
  }
});

test('7. Roteamento contextual diverge por Origem × Personalidade e gera gancho sem cortes no meio da palavra', async () => {
  const prevOffline = process.env.LOCAL_LLM_OFFLINE;
  process.env.LOCAL_LLM_OFFLINE = '1';
  const { db } = createTempBrain();
  try {
    const postCtx = profileLeadContext(
      {
        full_name: 'Dra. Marina',
        source_platform: 'web_signal',
        source_url: 'https://instagram.com/p/123',
        pain_excerpt: 'Estou cansada de evoluir prontuário no Word no atendimento domiciliar e controlar pacotes.',
      },
      { painCategory: 'prontuario', icpTier: 'solo_physio' }
    );
    assert.equal(postCtx.originType, 'post_comment_pain');
    assert.equal(postCtx.personality.id, 'sobrecarregado_urgente');
    assert.ok(postCtx.contentHook.includes('prontuários'));
    assert.ok(!postCtx.contentHook.endsWith('domicilia'));

    const postPick = selectStrategyForLead(db, {
      icpTier: 'solo_physio',
      painCategory: 'prontuario',
      originType: postCtx.originType,
      personalityArchetype: postCtx.personality.id,
      hasExplicitPainSignal: true,
      randomFn: () => 0.1,
    });
    assert.equal(postPick.strategy.id, 'S1_PAIN_MIRROR');
    assert.ok(postPick.alternatives.length >= 3);

    const mapsPick = selectStrategyForLead(db, {
      icpTier: 'clinic_owner',
      painCategory: 'organizacao_geral',
      originType: 'directory_maps',
      personalityArchetype: 'pragmatico_direto',
      hasExplicitPainSignal: false,
      randomFn: () => 0.1,
    });
    assert.equal(mapsPick.strategy.id, 'S2_QUICK_DIAGNOSTIC');

    const mapsOpening = composeContextualOpening({
      greeting: 'Clínica VitalFisio',
      originType: 'directory_maps',
      contentHook: 'o trabalho da Clínica VitalFisio em Campinas',
      strategyId: mapsPick.strategy.id,
    });
    assert.ok(!/\b(post|publica[çc][aã]o|coment[aá]rio)\b/i.test(mapsOpening));

    const switchPick = selectStrategyForLead(db, {
      icpTier: 'clinic_owner',
      painCategory: 'sistema_atual',
      originType: 'post_comment_pain',
      personalityArchetype: 'analitico_tecnico',
      hasExplicitPainSignal: true,
      randomFn: () => 0.1,
    });
    assert.equal(switchPick.strategy.id, 'S6_SWITCHING_RESCUE');
  } finally {
    db.close();
    if (prevOffline === undefined) delete process.env.LOCAL_LLM_OFFLINE;
    else process.env.LOCAL_LLM_OFFLINE = prevOffline;
  }
});

test('8. context_pins isola regra específica sem afetar demais perfis e Playbook dinâmico cabe em <= 2200 chars', () => {
  const { db } = createTempBrain();
  try {
    setContextPin(db, 'directory_maps:pragmatico_direto', 'S5_SOCIAL_PROOF_DEMO');

    const pinnedMaps = selectStrategyForLead(db, {
      originType: 'directory_maps',
      personalityArchetype: 'pragmatico_direto',
      painCategory: 'organizacao_geral',
      randomFn: () => 0.1,
    });
    assert.equal(pinnedMaps.mode, 'exploit_context_pin');
    assert.equal(pinnedMaps.strategy.id, 'S5_SOCIAL_PROOF_DEMO');

    const unpinnedPost = selectStrategyForLead(db, {
      originType: 'post_comment_pain',
      personalityArchetype: 'sobrecarregado_urgente',
      painCategory: 'prontuario',
      randomFn: () => 0.1,
    });
    assert.equal(unpinnedPost.mode, 'exploit_contextual');
    assert.equal(unpinnedPost.strategy.id, 'S1_PAIN_MIRROR');

    const snapshot = buildCompactPlaybookSnapshot(db);
    assert.ok(snapshot.length <= PLAYBOOK_MAX_CHARS);
    assert.match(snapshot, /ROTEAMENTO POR ORIGEM & PERSONALIDADE/);
    assert.match(snapshot, /\[directory_maps:pragmatico_direto\]: S5_SOCIAL_PROOF_DEMO/);
  } finally {
    db.close();
  }
});

test('9. Upgrade de schema preserva episódios existentes ao adicionar origin_type e personality_archetype', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluri-brain-upgrade-'));
  tempPaths.push(dir);
  const dbPath = path.join(dir, 'legacy.sqlite');

  const legacyDb = new DatabaseSync(dbPath);
  legacyDb.exec(`
    CREATE TABLE conversation_episodes (
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
    INSERT INTO conversation_episodes VALUES (
      'ep-legacy-1', 'conv-legacy-1', NULL, 'hash1', 'solo_physio', 'prontuario',
      'S1_PAIN_MIRROR', 'replied', 0.25, 7.5, '[]', '[]', '[]', 'lição legada', 2, 0,
      '2026-11-01T00:00:00Z', '2026-11-01T00:00:00Z'
    );
  `);
  legacyDb.close();

  const upgradedDb = openBrainDb(dbPath);
  try {
    const row = upgradedDb.prepare('SELECT * FROM conversation_episodes WHERE id = ?').get('ep-legacy-1');
    assert.ok(row);
    assert.equal(row.lesson, 'lição legada');
    assert.equal(row.origin_type, 'post_comment_pain');
    assert.equal(row.personality_archetype, 'relacional_acolhedor');
  } finally {
    upgradedDb.close();
  }
});

