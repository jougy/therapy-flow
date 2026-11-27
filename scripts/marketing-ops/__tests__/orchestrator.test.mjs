#!/usr/bin/env node
/**
 * Suíte de testes do Ambiente Dedicado de Marketing, Truth Pack Pluri Fisio,
 * Dossiês Vivos, Orquestrador Sequencial 2-por-Vez e Templates Visuais PNG.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { openBrainDb } from '../../leads/brain/schema.mjs';
import {
  PLURI_PLANS,
  PLURI_URLS,
  buildCompactTruthPromptBlock,
  detectWhatsappAutoReply,
  recommendPlanForProfile,
  sanitizeOutboundSalesReply,
} from '../product-truth.mjs';
import { buildLeadMetadataPatch, writeOrUpdateLeadDossier } from '../dossier-store.mjs';
import { approveSlots, runOrchestratorCycle } from '../sequential-orchestrator.mjs';

test('1. detectWhatsappAutoReply detecta 5+ padrões WhatsApp Business e evita falsos positivos humanos', () => {
  const autoSamples = [
    'Olá! Esta é uma mensagem automática. No momento não estamos disponíveis.',
    'Obrigado por entrar em contato! Nosso horário de atendimento é de seg a sex das 08h às 18h.',
    'Atendimento automático: digite 1 para agendamento ou escolha uma opção.',
    'Agradeço o seu contato, retornaremos assim que possível.',
    'Estamos fora do horário de atendimento, em breve retornaremos.',
  ];
  for (const s of autoSamples) {
    const res = detectWhatsappAutoReply(s);
    assert.equal(res.isAutoReply, true, `Deveria detectar auto-reply em: ${s}`);
    assert.equal(res.confidence, 'high');
  }

  const humanSamples = [
    'Oi! Tudo bem? Quanto custa o Pluri Fisio e quais são os planos?',
    'Sim, ainda uso planilhas aqui no consultório, gostaria de ver como funciona.',
    'Atendo em horário comercial, me manda os valores por favor.',
  ];
  for (const h of humanSamples) {
    const res = detectWhatsappAutoReply(h);
    assert.equal(res.isAutoReply, false, `Não deveria marcar humano como auto-reply: ${h}`);
  }
});

test('2. sanitizeOutboundSalesReply proíbe degustação e bloqueia termos técnicos internos', () => {
  const dirty =
    'Você pode fazer uma degustação grátis! Nosso sistema roda em Supabase, PostgreSQL, Redis, Evolution API, Ollama, SQLite e Deno Edge Functions.';
  const res = sanitizeOutboundSalesReply(dirty);

  assert.equal(/degusta[cç][aã]o/i.test(res.cleanText), false);
  assert.match(res.cleanText, /Teste Gratuito de 7 dias/);
  for (const leaked of ['supabase', 'postgresql', 'redis', 'evolution', 'ollama', 'sqlite', 'deno']) {
    assert.equal(new RegExp(`\\b${leaked}\\b`, 'i').test(res.cleanText), false, `Termo técnico vazou: ${leaked}`);
  }
  assert.ok(res.violationsFound.includes('forbidden_degustacao'));
  assert.ok(res.violationsFound.length >= 5);
});

test('3. Truth Pack mantém coerência 1:1 com subscriptionPricing.ts e URLs oficiais', () => {
  const pricingSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/utils/subscriptionPricing.ts'), 'utf8');
  const expected = [
    ['prof_basico', 57, 47, 37],
    ['prof_medio', 87, 67, 57],
    ['prof_top', 127, 107, 87],
    ['clinica_basico', 147, 127, 97],
    ['clinica_medio', 267, 227, 177],
    ['clinica_top', 447, 387, 297],
  ];

  for (const [id, m, q, a] of expected) {
    assert.equal(PLURI_PLANS[id].monthlyPrice, m);
    assert.equal(PLURI_PLANS[id].quarterlyMonthlyPrice, q);
    assert.equal(PLURI_PLANS[id].annualMonthlyPrice, a);
    assert.match(pricingSrc, new RegExp(`${id}:[\\s\\S]*?${a}\\.00`));
  }

  assert.equal(PLURI_URLS.landing, 'https://plurifisio.com.br');
  assert.equal(PLURI_URLS.trialUrl, 'https://pluri.health/auth/cadastro?trial=true');

  const soloRec = recommendPlanForProfile({ icpTier: 'solo_physio', maturityStage: 'iniciante_solo' }, 'LANCAMENTO1MES');
  assert.equal(soloRec.planId, 'prof_basico');
  assert.match(soloRec.checkoutUrl, /coupon=LANCAMENTO1MES/);

  const promptBlock = buildCompactTruthPromptBlock(soloRec, 'LANCAMENTO1MES');
  assert.match(promptBlock, /1º mês grátis nos planos anuais/i);
  assert.match(promptBlock, /Teste Gratuito de 7 dias/);
  assert.equal(/\bdegusta[cç][aã]o\b/i.test(promptBlock), false);
});

test('4. dossier-store cria dossiê .md, preserva linha do tempo e marca uses_auto_reply', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pluri-dossier-'));
  try {
    const lead = {
      id: 'lead-123',
      full_name: 'Dra. Camila Oliveira',
      clinic_name: 'Consultório Camila Fisio',
      phone: '5511999991111',
      city: 'São Paulo',
      icp_tier: 'solo_physio',
      source_platform: 'web_signal',
      source_post_url: 'https://instagram.com/p/demo',
    };
    const rec = recommendPlanForProfile({ icpTier: 'solo_physio', maturityStage: 'iniciante_solo' });

    const first = writeOrUpdateLeadDossier(
      lead,
      {
        phoneE164: '5511999991111',
        status: 'pending_approval',
        recommendedPlan: rec,
        openingMessage: 'Olá, Dra. Camila, tudo bem?',
        timelineEvent: 'Primeiro registro preparado.',
      },
      tmpDir,
    );
    assert.ok(fs.existsSync(first.filePath));

    const second = writeOrUpdateLeadDossier(
      lead,
      {
        phoneE164: '5511999991111',
        status: 'auto_reply_detected',
        usesAutoReply: true,
        autoReplySample: 'No momento não estamos disponíveis (mensagem automática).',
        recommendedPlan: rec,
        openingMessage: 'Olá, Dra. Camila, tudo bem?',
        timelineEvent: 'Auto-resposta detectada no WhatsApp.',
      },
      tmpDir,
    );

    const content = fs.readFileSync(second.filePath, 'utf8');
    assert.match(content, /Primeiro registro preparado\./);
    assert.match(content, /Auto-resposta detectada no WhatsApp\./);
    assert.match(content, /uses_auto_reply = true/);

    const patch = buildLeadMetadataPatch({ existing_key: 1 }, { usesAutoReply: true, recommendedPlan: rec });
    assert.equal(patch.existing_key, 1);
    assert.equal(patch.whatsapp_profile.uses_auto_reply, true);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('5. Orquestrador Sequencial (Opção A): exige aprovação, limita a 2 slots e libera imediatamente em auto-reply ou timeout 60m', async () => {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'pluri-seq-'));
  const dbPath = path.join(tmpRoot, 'brain.sqlite');
  const dossiersDir = path.join(tmpRoot, 'dossiers');
  const db = openBrainDb(dbPath);

  try {
    const nowIso = new Date().toISOString();
    const insert = db.prepare(`
      INSERT INTO sequential_slots (
        lead_id, phone_e164, full_name, icp_tier, maturity_stage, recommended_plan_id,
        opening_message, status, created_at, updated_at
      ) VALUES (?, ?, ?, 'solo_physio', 'iniciante_solo', 'prof_basico', 'Olá!', 'pending_approval', ?, ?)
    `);
    insert.run('L1', '5511900000001', 'Dra. Ana', nowIso, nowIso);
    insert.run('L2', '5511900000002', 'Dr. Bruno', nowIso, nowIso);
    insert.run('L3', '5511900000003', 'Dra. Clara', nowIso, nowIso);

    // Antes de aprovar, nada pode ser disparado
    const beforeApprove = await runOrchestratorCycle({ db, dossiersDir, dryRun: true, ignoreHours: true });
    assert.equal(beforeApprove.dispatched.length, 0);

    // Aprova os 3
    const appRes = approveSlots({ db });
    assert.equal(appRes.approvedCount, 3);

    // Ciclo 1: dispara estritamente 2 (nunca 3!)
    const cycle1 = await runOrchestratorCycle({ db, dossiersDir, maxActive: 2, dryRun: true, ignoreHours: true });
    assert.equal(cycle1.dispatched.length, 2);
    assert.deepEqual(cycle1.dispatched.map((d) => d.leadId), ['L1', 'L2']);

    // Simula auto-resposta em L1 -> deve liberar slot imediatamente para L3 entrar!
    const cycle2 = await runOrchestratorCycle({
      db,
      dossiersDir,
      maxActive: 2,
      dryRun: true,
      ignoreHours: true,
      fetchInboundAfter: async (slot) =>
        slot.lead_id === 'L1' ? { body_text: 'Mensagem automática: fora do horário de atendimento.' } : null,
    });
    assert.equal(cycle2.released.length, 1);
    assert.equal(cycle2.released[0].reason, 'auto_reply_detected');
    assert.equal(cycle2.dispatched.length, 1);
    assert.equal(cycle2.dispatched[0].leadId, 'L3');

    // Avança relógio em 65 minutos -> L2 e L3 expiram por timed_out_1h
    const future = new Date(Date.now() + 65 * 60_000);
    const cycle3 = await runOrchestratorCycle({
      db,
      dossiersDir,
      maxActive: 2,
      timeoutMin: 60,
      dryRun: true,
      ignoreHours: true,
      now: future,
    });
    assert.equal(cycle3.released.length, 2);
    assert.ok(cycle3.released.every((r) => r.reason === 'timed_out_1h'));
  } finally {
    db.close();
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('6. whatsappCardTemplates gera cards PNG oficiais com 6 preços exatos, oferta anual e <tspan> wrap', async () => {
  const distCardPath = path.resolve(process.cwd(), 'infra/marketing-node/worker/dist/studio/whatsappCardTemplates.js');
  const distSatoriPath = path.resolve(process.cwd(), 'infra/marketing-node/worker/dist/studio/satoriRenderer.js');
  assert.ok(fs.existsSync(distCardPath), 'Build do worker deve existir antes da suíte de testes');

  const { renderWhatsappCard } = await import(pathToFileURL(distCardPath).href);
  const { renderSlideAsset, wrapSvgText } = await import(pathToFileURL(distSatoriPath).href);

  const lines = wrapSvgText('Texto longo de fisioterapia para validar quebra de linha em tspan sem cortar palavras no meio', 28, 3);
  assert.ok(lines.length >= 2 && lines.every((l) => l.length <= 28));

  const resCard = await renderWhatsappCard('card_todos_planos_recursos');
  const priceCard = await renderWhatsappCard('card_todos_planos_precos', { launchCouponCode: 'PLURILANCAMENTO' });
  const recCard = await renderWhatsappCard('card_plano_recomendado', { recommendedPlanId: 'prof_medio', leadName: 'Dra. Juliana' });
  const slide = await renderSlideAsset({ headline: 'Pluri Fisio', body: 'Agenda e prontuários com conformidade ética total.', cta: 'Teste Gratuito 7 dias' });

  for (const r of [resCard, priceCard, recCard, slide]) {
    assert.equal(r.contentType, 'image/png');
    assert.deepEqual([...r.buffer.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47]);
    assert.equal(/degusta[cç][aã]o/i.test(r.svg), false);
  }

  for (const priceTxt of ['R$ 37/mês', 'R$ 57/mês', 'R$ 87/mês', 'R$ 97/mês', 'R$ 177/mês', 'R$ 297/mês']) {
    assert.ok(priceCard.svg.includes(priceTxt), `Preço ausente no card: ${priceTxt}`);
  }
  assert.match(priceCard.svg, /1º MÊS GRÁTIS nos Planos Anuais/);
  assert.match(priceCard.svg, /PLURILANCAMENTO/);
  assert.match(priceCard.svg, /Teste Gratuito de 7 dias/);
  assert.match(recCard.svg, /<tspan/);
});
