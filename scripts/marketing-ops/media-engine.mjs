#!/usr/bin/env node
/**
 * Motor Unificado de Mídia Visual Pluri Fisio:
 * - local_png (primário determinístico: @resvg/resvg-js via worker ou dist local + fallback ImageMagick)
 * - gemini (adaptador Gemini Image API c/ cache SHA-256 em disco)
 * - canva (adaptador Canva CLI + dataset autofill pronto)
 * - invideo (adaptador InVideo CLI + storyboard 30s personalizado)
 */

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PLURI_PLANS, recommendPlanForProfile } from './product-truth.mjs';

export const DEFAULT_MEDIA_CACHE_DIR = path.resolve(process.cwd(), '.local-data/conversion-brain/media-cache');

export function loadLocalMarketingEnv(envPath = path.resolve(process.cwd(), 'infra/marketing-node/.env')) {
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (key && !(key in out)) out[key] = val;
  }
  return out;
}

function commandExists(bin) {
  try {
    execFileSync('which', [bin], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function tryRenderViaWorker({ cardType, params, workerUrl, workerSecret }) {
  if (!workerUrl || !workerSecret) return null;
  try {
    const res = await fetch(`${workerUrl.replace(/\/$/, '')}/studio/render-whatsapp-card`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-worker-secret': workerSecret },
      body: JSON.stringify({ cardType, ...params }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.ok || !data?.base64 || data.contentType !== 'image/png') return null;
    return { buffer: Buffer.from(data.base64, 'base64'), sha256: String(data.sha256 || ''), source: 'worker_http' };
  } catch {
    return null;
  }
}

async function tryRenderViaBuiltModule({ cardType, params }) {
  const distModulePath = path.resolve(process.cwd(), 'infra/marketing-node/worker/dist/studio/whatsappCardTemplates.js');
  if (!fs.existsSync(distModulePath)) return null;
  try {
    const mod = await import(pathToFileURL(distModulePath).href);
    if (typeof mod.renderWhatsappCard !== 'function') return null;
    const rendered = await mod.renderWhatsappCard(cardType, params);
    if (rendered?.contentType === 'image/png' && Buffer.isBuffer(rendered.buffer)) {
      return { buffer: rendered.buffer, sha256: rendered.sha256, source: 'dist_resvg' };
    }
    if (rendered?.svg && commandExists('magick')) {
      const tmpSvg = path.join(DEFAULT_MEDIA_CACHE_DIR, `_tmp_${cardType}.svg`);
      const tmpPng = path.join(DEFAULT_MEDIA_CACHE_DIR, `_tmp_${cardType}.png`);
      fs.mkdirSync(DEFAULT_MEDIA_CACHE_DIR, { recursive: true });
      fs.writeFileSync(tmpSvg, rendered.svg, 'utf8');
      execFileSync('magick', [tmpSvg, tmpPng], { stdio: 'ignore' });
      const buffer = fs.readFileSync(tmpPng);
      fs.rmSync(tmpSvg, { force: true });
      fs.rmSync(tmpPng, { force: true });
      return { buffer, sha256: rendered.sha256, source: 'dist_svg_magick' };
    }
    return null;
  } catch {
    return null;
  }
}

function buildCanvaAutofillDataset(cardType, params = {}) {
  const plan = params.recommendedPlanId ? PLURI_PLANS[params.recommendedPlanId] : PLURI_PLANS.prof_basico;
  return {
    brandKit: 'Pluri Fisio (#0284c7, #0f172a, #10b981, #f0f9ff)',
    cardType,
    generatedAt: new Date().toISOString(),
    fields: {
      headline: cardType === 'card_todos_planos_precos' ? 'Pluri Fisio · Investimento & Oferta de Lançamento' : 'Pluri Fisio · Todos os Planos e Recursos',
      recommendedPlan: plan?.name || 'Profissional Básico',
      annualPrice: plan?.annualMonthlyPrice ? `R$ ${plan.annualMonthlyPrice}/mês` : 'Sob consulta',
      trialOffer: 'Teste Gratuito de 7 dias (sem cartão no cadastro · até 20 atendimentos)',
      launchOffer: params.launchCouponCode
        ? `Oferta de Lançamento: 1º mês grátis no anual (cupom ${params.launchCouponCode})`
        : 'Oferta de Lançamento: cupom de 1º mês grátis nos planos anuais',
      ctaUrl: 'https://pluri.health/auth/cadastro?trial=true',
    },
  };
}

function buildInvideoStoryboardBrief(cardType, params = {}) {
  const rec = recommendPlanForProfile({ icpTier: params.icpTier, maturityStage: params.maturityStage }, params.launchCouponCode);
  return {
    engine: 'invideo',
    durationSec: 30,
    aspectRatio: '9:16',
    palette: ['#0284c7', '#0f172a', '#10b981', '#f0f9ff'],
    leadName: params.leadName || 'Profissional de Fisioterapia',
    recommendedPlan: rec.planName,
    scenes: [
      { sec: '0-5', visual: 'Abertura limpa Pluri Fisio', narration: 'Olá! Veja em 30 segundos como simplificar sua agenda e prontuários na Pluri Fisio.' },
      { sec: '5-15', visual: `Destaque ${cardType}`, narration: 'Evolução clínica em 30s, fichas digitais e controle financeiro num único lugar.' },
      { sec: '15-24', visual: `Plano indicado: ${rec.planName}`, narration: `Para o seu perfil, o plano ideal é o ${rec.planName}, com acompanhamento guiado.` },
      { sec: '24-30', visual: 'CTA Pluri.health', narration: 'Comece seu Teste Gratuito de 7 dias e aproveite o cupom de 1º mês grátis nos planos anuais!' },
    ],
  };
}

async function tryGeminiEditorialImage(prompt, apiKey) {
  if (!apiKey) return null;
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const imgPart = parts.find((p) => p?.inlineData?.data);
    if (!imgPart) return null;
    return Buffer.from(imgPart.inlineData.data, 'base64');
  } catch {
    return null;
  }
}

export async function generateMarketingVisual({
  engine = 'local_png',
  cardType = 'card_todos_planos_recursos',
  params = {},
  cacheDir = DEFAULT_MEDIA_CACHE_DIR,
  workerUrl,
  workerSecret,
  force = false,
} = {}) {
  fs.mkdirSync(cacheDir, { recursive: true });
  const envFile = loadLocalMarketingEnv();
  const effectiveWorkerUrl = workerUrl ?? process.env.MARKETING_WORKER_URL ?? 'http://127.0.0.1:8086';
  const effectiveSecret = workerSecret ?? process.env.WORKER_SHARED_SECRET ?? envFile.WORKER_SHARED_SECRET ?? '';
  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || envFile.GEMINI_API_KEY || '';

  const distModulePath = path.resolve(process.cwd(), 'infra/marketing-node/worker/dist/studio/whatsappCardTemplates.js');
  let templateVersion = 'v2';
  try {
    templateVersion = String(Math.floor(fs.statSync(distModulePath).mtimeMs));
  } catch {
    templateVersion = 'v2';
  }

  const specHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ engine, cardType, params, templateVersion }))
    .digest('hex')
    .slice(0, 12);

  const cachedPath = path.join(cacheDir, `${cardType}-${specHash}.png`);
  if (!force && fs.existsSync(cachedPath)) {
    const buf = fs.readFileSync(cachedPath);
    const canonicalPath = path.join(cacheDir, `${cardType}.png`);
    fs.writeFileSync(canonicalPath, buf);
    return {
      ok: true,
      engine,
      cardType,
      filePath: cachedPath,
      canonicalPath,
      cached: true,
      fallbackUsed: false,
      bytes: buf.length,
      sha256: crypto.createHash('sha256').update(buf).digest('hex'),
    };
  }

  let fallbackUsed = false;
  let fallbackReason = null;
  let manifestPath = null;
  let pngBuffer = null;

  if (engine === 'canva') {
    const dataset = buildCanvaAutofillDataset(cardType, params);
    manifestPath = path.join(cacheDir, `${cardType}-${specHash}-canva-autofill.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(dataset, null, 2), 'utf8');
    if (!commandExists('canva')) {
      fallbackUsed = true;
      fallbackReason = 'canva_cli_not_installed_or_unauthenticated';
    } else {
      fallbackUsed = true;
      fallbackReason = 'canva_autofill_dataset_prepared_local_fallback';
    }
  } else if (engine === 'invideo') {
    const brief = buildInvideoStoryboardBrief(cardType, params);
    manifestPath = path.join(cacheDir, `${cardType}-${specHash}-invideo-brief.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(brief, null, 2), 'utf8');
    fallbackUsed = true;
    fallbackReason = commandExists('invideo') ? 'invideo_brief_prepared_local_fallback' : 'invideo_cli_not_installed';
  } else if (engine === 'gemini') {
    if (cardType === 'card_todos_planos_precos' || cardType === 'card_todos_planos_recursos') {
      fallbackUsed = true;
      fallbackReason = 'pricing_and_specs_require_deterministic_local_png';
    } else {
      const prompt = `Clean clinical light-blue healthcare editorial card (#f0f9ff, #0284c7, #10b981) for physiotherapy SaaS Pluri Fisio, theme: ${params.headline || cardType}, minimalist vector style, no messy text.`;
      pngBuffer = await tryGeminiEditorialImage(prompt, geminiKey);
      if (!pngBuffer) {
        fallbackUsed = true;
        fallbackReason = geminiKey ? 'gemini_image_api_unavailable' : 'gemini_api_key_missing';
      }
    }
  }

  if (!pngBuffer) {
    const fromWorker = await tryRenderViaWorker({ cardType, params, workerUrl: effectiveWorkerUrl, workerSecret: effectiveSecret });
    if (fromWorker?.buffer) {
      pngBuffer = fromWorker.buffer;
    } else {
      const fromDist = await tryRenderViaBuiltModule({ cardType, params });
      if (fromDist?.buffer) pngBuffer = fromDist.buffer;
    }
  }

  if (!pngBuffer) {
    return { ok: false, engine, cardType, fallbackUsed, fallbackReason: fallbackReason || 'renderer_unavailable', manifestPath };
  }

  fs.writeFileSync(cachedPath, pngBuffer);
  const canonicalPath = path.join(cacheDir, `${cardType}.png`);
  fs.writeFileSync(canonicalPath, pngBuffer);

  return {
    ok: true,
    engine,
    cardType,
    filePath: cachedPath,
    canonicalPath,
    manifestPath,
    cached: false,
    fallbackUsed,
    fallbackReason,
    bytes: pngBuffer.length,
    sha256: crypto.createHash('sha256').update(pngBuffer).digest('hex'),
  };
}

export async function renderOfficialPlanPackLocally(options = {}) {
  const engine = options.engine || 'local_png';
  const r1 = await generateMarketingVisual({ ...options, engine, cardType: 'card_todos_planos_recursos' });
  const r2 = await generateMarketingVisual({ ...options, engine, cardType: 'card_todos_planos_precos' });
  return { resourcesCard: r1, pricesCard: r2 };
}

function parseCliArgs(argv) {
  const args = {};
  for (const a of argv) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) args[a.slice(2)] = true;
    else args[a.slice(2, eq)] = a.slice(eq + 1);
  }
  return args;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = parseCliArgs(process.argv.slice(2));
  const engine = String(args.engine || 'local_png');
  const params = {
    ...(args.plan ? { recommendedPlanId: String(args.plan) } : {}),
    ...(args.lead ? { leadName: String(args.lead) } : {}),
    ...(args.coupon ? { launchCouponCode: String(args.coupon) } : {}),
  };

  if (args['render-official-pack'] || !args.card) {
    const out = await renderOfficialPlanPackLocally({ engine, params, force: Boolean(args.force) });
    console.log(JSON.stringify(out, null, 2));
    if (!out.resourcesCard.ok || !out.pricesCard.ok) process.exit(1);
  } else {
    const out = await generateMarketingVisual({ engine, cardType: String(args.card), params, force: Boolean(args.force) });
    console.log(JSON.stringify(out, null, 2));
    if (!out.ok) process.exit(1);
  }
}
