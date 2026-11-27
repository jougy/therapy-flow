#!/usr/bin/env node
/**
 * Marketing Integration Doctor (100% Read-Only / Zero WhatsApp Sends)
 * Audita ponta a ponta os 8 elos do ecossistema de prospecção e WhatsApp Pluri Fisio.
 *
 * Uso: npm run marketing:doctor [-- --json]
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { loadLocalMarketingEnv } from './media-engine.mjs';
import { createSupabaseRestClient, resolveOpsCredentials } from './transport-clients.mjs';
import { openBrainDb } from '../leads/brain/schema.mjs';

const require = createRequire(import.meta.url);

function safeExec(bin, args, timeoutMs = 6000) {
  try {
    return {
      ok: true,
      out: execFileSync(bin, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: timeoutMs }).trim(),
    };
  } catch (err) {
    return { ok: false, out: String(err?.stderr || err?.message || '').trim() };
  }
}

async function safeFetchJson(url, opts = {}) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(opts.timeoutMs || 5000), ...opts });
    const data = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err), data: null };
  }
}

function readPulumiEnvKeysPresence() {
  const res = safeExec(
    'pulumi',
    ['env', 'open', 'joao-tdoval-gmail-com-org/plurihealth/pluri-prod', '--format', 'json'],
    8000,
  );
  if (!res.ok || !res.out) return { available: false, keys: {} };
  try {
    const parsed = JSON.parse(res.out);
    const ev = parsed.environmentVariables || parsed || {};
    const keys = {};
    for (const k of [
      'APIFY_API_TOKEN',
      'GEMINI_API_KEY',
      'GOOGLE_AI_API_KEY',
      'EVOLUTION_API_URL',
      'EVOLUTION_API_KEY',
      'EVOLUTION_WEBHOOK_SECRET',
      'PLURI_LAUNCH_COUPON_CODE',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]) {
      keys[k] = Boolean(String(ev[k] || '').trim());
    }
    return { available: true, keys };
  } catch {
    return { available: false, keys: {} };
  }
}

async function runDoctor() {
  const localEnv = loadLocalMarketingEnv();
  const creds = resolveOpsCredentials();
  const workerSecret = String(process.env.WORKER_SHARED_SECRET || localEnv.WORKER_SHARED_SECRET || '').trim();
  const workerUrl = String(process.env.MARKETING_WORKER_URL || 'http://127.0.0.1:8086').trim().replace(/\/$/, '');
  const report = {
    checkedAt: new Date().toISOString(),
    safeMode: 'READ_ONLY_ZERO_WHATSAPP_SENDS',
    links: {},
    criticalGaps: [],
    warnings: [],
  };

  // 1. Containers Docker
  const dockerRes = safeExec('docker', ['ps', '--format', '{{.Names}}|{{.Status}}']);
  const runningContainers = {};
  if (dockerRes.ok) {
    for (const line of dockerRes.out.split('\n').filter(Boolean)) {
      const [name, status] = line.split('|');
      runningContainers[name] = status;
    }
  }
  const requiredContainers = ['pluri-marketing-evolution', 'pluri-marketing-worker', 'pluri-marketing-redis', 'pluri-marketing-postgres'];
  report.links.docker = {
    ok: requiredContainers.every((c) => Boolean(runningContainers[c])),
    containers: Object.fromEntries(requiredContainers.map((c) => [c, runningContainers[c] || 'NOT_RUNNING'])),
  };

  // 2. Evolution API (:8085)
  const encInst = encodeURIComponent(creds.instanceKey);
  const evoHeaders = { apikey: creds.evoKey, 'Content-Type': 'application/json' };
  const [evoState, evoWebhook, evoSettings, evoChats] = await Promise.all([
    safeFetchJson(`${creds.evoUrl}/instance/connectionState/${encInst}`, { headers: evoHeaders }),
    safeFetchJson(`${creds.evoUrl}/webhook/find/${encInst}`, { headers: evoHeaders }),
    safeFetchJson(`${creds.evoUrl}/settings/find/${encInst}`, { headers: evoHeaders }),
    safeFetchJson(`${creds.evoUrl}/chat/findChats/${encInst}`, { method: 'POST', headers: evoHeaders, body: '{}' }),
  ]);
  const chatList = Array.isArray(evoChats.data) ? evoChats.data : Array.isArray(evoChats.data?.chats) ? evoChats.data.chats : [];
  const waState = evoState.data?.instance?.state || evoState.data?.state || 'unknown';
  const whUrl = evoWebhook.data?.url || null;
  const whHeadersSet = Boolean(evoWebhook.data?.headers && Object.keys(evoWebhook.data.headers).length > 0);
  report.links.evolution = {
    ok: evoState.ok && waState === 'open' && Boolean(evoWebhook.data?.enabled),
    instanceKey: creds.instanceKey,
    connectionState: waState,
    webhookEnabled: Boolean(evoWebhook.data?.enabled),
    webhookUrl: whUrl,
    webhookHeadersConfigured: whHeadersSet,
    groupsIgnore: Boolean(evoSettings.data?.groupsIgnore),
    alwaysOnline: Boolean(evoSettings.data?.alwaysOnline),
    chatsCount: chatList.length,
  };
  if (!whHeadersSet) {
    report.warnings.push('Evolution webhook está com headers: null (funciona enquanto EVOLUTION_WEBHOOK_SECRET estiver vazio no Supabase; se ativar segredo lá, adicione header x-evolution-secret no Evolution).');
  }

  // 3. Marketing Worker (:8086) + Studio PNG smoke check
  const workerHealth = await safeFetchJson(`${workerUrl}/health`);
  const cardSmoke = workerSecret
    ? await safeFetchJson(`${workerUrl}/studio/render-whatsapp-card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-worker-secret': workerSecret },
        body: JSON.stringify({ cardType: 'card_todos_planos_precos' }),
        timeoutMs: 8000,
      })
    : { ok: false, status: 0 };
  report.links.worker = {
    ok: Boolean(workerHealth.ok && workerHealth.data?.ok && cardSmoke.ok && cardSmoke.data?.ok),
    health: workerHealth.data || { error: workerHealth.error || workerHealth.status },
    cardSmokeOk: Boolean(cardSmoke.ok && cardSmoke.data?.ok),
    cardSha256: cardSmoke.data?.sha256 ? String(cardSmoke.data.sha256).slice(0, 12) : null,
  };

  // 4. Ollama Local + OpenCode CLI
  const ollamaTags = await safeFetchJson('http://127.0.0.1:11434/api/tags', { timeoutMs: 3000 });
  const modelNames = Array.isArray(ollamaTags.data?.models) ? ollamaTags.data.models.map((m) => m.name) : [];
  let gemmaVision = false;
  if (modelNames.includes('gemma4:12b')) {
    const showRes = await safeFetchJson('http://127.0.0.1:11434/api/show', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'gemma4:12b' }),
      timeoutMs: 3000,
    });
    gemmaVision = Array.isArray(showRes.data?.capabilities) && showRes.data.capabilities.includes('vision');
  }
  const opencodeBin = safeExec('which', ['opencode']);
  report.links.localAi = {
    ok: ollamaTags.ok && modelNames.includes('mimo-v2.6:latest') && modelNames.includes('gemma4:12b'),
    ollamaOnline: ollamaTags.ok,
    models: modelNames,
    gemma4Vision: gemmaVision,
    opencodeCliInstalled: opencodeBin.ok,
  };

  // 5. Supabase Cloud State
  const supabase = createSupabaseRestClient(creds.supabaseUrl, creds.serviceKey);
  if (supabase) {
    const [instances, agents, dispatches, convs, leads] = await Promise.all([
      supabase.select('marketing_whatsapp_instances', 'select=id,instance_key,status,daily_limit,daily_sent_count&deleted_at=is.null'),
      supabase.select('marketing_ai_agents', 'select=slug,is_active,system_prompt,knowledge_base&deleted_at=is.null'),
      supabase.select('marketing_zap_dispatches', 'select=id,status,rendered_body,error_message&order=created_at.desc&limit=50'),
      supabase.select('marketing_zap_conversations', 'select=id,agent_mode,ai_turns_count&deleted_at=is.null&limit=20'),
      supabase.select('platform_auto_leads', 'select=stage&deleted_at=is.null&limit=500'),
    ]);

    const statusCounts = {};
    let badQueuedGreetings = 0;
    for (const d of dispatches || []) {
      statusCounts[d.status] = (statusCounts[d.status] || 0) + 1;
      if (d.status === 'queued' && /Dr\(a\)\.\s*(Cl[ií]nica|We\b|Fisioterapia)/i.test(String(d.rendered_body || ''))) {
        badQueuedGreetings++;
      }
    }
    const leadStageCounts = {};
    for (const l of leads || []) leadStageCounts[l.stage] = (leadStageCounts[l.stage] || 0) + 1;
    const activeAgent = (agents || []).find((a) => a.is_active);

    report.links.supabase = {
      ok: true,
      instances: (instances || []).map((i) => ({
        instanceKey: i.instance_key,
        status: i.status,
        quota: `${i.daily_sent_count}/${i.daily_limit}`,
      })),
      activeAgentSlug: activeAgent?.slug || null,
      activeAgentHasPlaybook: Boolean(activeAgent?.knowledge_base?.includes('PLURI_CONVERSION_BRAIN_START')),
      dispatchesByStatus: statusCounts,
      badQueuedGreetings,
      conversationsCount: (convs || []).length,
      leadsByStage: leadStageCounts,
    };

    const primaryInst = (instances || [])[0];
    if (primaryInst?.status === 'circuit_broken') {
      report.criticalGaps.push('Instância no Supabase está marcada como "circuit_broken" (enquanto Evolution local está "open"). Isso bloqueia enfileiramentos/disparos até aprovação para reset.');
    }
    if (badQueuedGreetings > 0) {
      report.criticalGaps.push(`Existem ${badQueuedGreetings} dispatches antigos com status "queued" contendo saudação quebrada ("Dr(a). Clínica" / "Dr(a). We") aguardando cancelamento.`);
    }
    if (activeAgent && !activeAgent.knowledge_base?.includes('PLURI_CONVERSION_BRAIN_START')) {
      report.warnings.push(`Agente "${activeAgent.slug}" no Supabase ainda não recebeu "npm run leads:select -- --mode=dynamic --publish" nem o system_prompt constitucional atualizado.`);
    }
  } else {
    report.links.supabase = { ok: false, error: 'SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.' };
  }

  // 6. Local Brain SQLite + Bridge Drift Check
  const db = openBrainDb();
  const slotCounts = db.prepare('SELECT status, COUNT(*) AS cnt FROM sequential_slots GROUP BY status').all();
  db.close();
  const gwSrc = fs.readFileSync(path.resolve(process.cwd(), 'supabase/functions/marketing-zap-gateway/index.ts'), 'utf8');
  const evolutionPublicUrl = String(localEnv.EVOLUTION_PUBLIC_URL || 'http://localhost:8085');
  report.links.bridgeAndDrift = {
    localGatewayHasConstitution: gwSrc.includes('WHATSAPP_AGENT_CONSTITUTION_PROMPT'),
    localGatewayHasReactiveFallbackQueue: gwSrc.includes('enqueueReactiveOutboundText'),
    localGatewayNormalizesDotEvents: gwSrc.includes("replace(/\\./g, '_')"),
    evolutionPublicUrl,
    sequentialSlots: slotCounts,
  };
  if (evolutionPublicUrl.includes('localhost') || evolutionPublicUrl.includes('127.0.0.1')) {
    report.warnings.push('Evolution API roda localmente (localhost:8085). Para respostas IA funcionarem sem Tunnel público, publique a versão local do marketing-zap-gateway (que já enfileira na fila reativa para o pluri-marketing-worker local entregar).');
  }

  // 7. Credenciais (boolean apenas) & Dependências Cross-Network
  const esc = readPulumiEnvKeysPresence();
  let sharpOk = false;
  try {
    require.resolve('sharp');
    sharpOk = true;
  } catch {
    sharpOk = false;
  }
  const pyVer = safeExec('python3', ['--version']);
  report.links.credentialsAndOsint = {
    localEnvKeys: {
      EVOLUTION_API_KEY: Boolean(creds.evoKey),
      SUPABASE_SERVICE_ROLE_KEY: Boolean(creds.serviceKey),
      WORKER_SHARED_SECRET: Boolean(workerSecret),
      PLURI_LAUNCH_COUPON_CODE: Boolean(creds.launchCouponCode),
    },
    pulumiEscAvailable: esc.available,
    pulumiEscKeys: esc.keys,
    crossNetworkDeps: {
      sharp: sharpOk,
      python3: pyVer.ok ? pyVer.out : 'missing',
      ollamaVision: gemmaVision,
      apifyReady: Boolean(process.env.APIFY_API_TOKEN || localEnv.APIFY_API_TOKEN || esc.keys.APIFY_API_TOKEN),
    },
  };
  if (!esc.keys.GEMINI_API_KEY && !localEnv.GEMINI_API_KEY) {
    report.warnings.push('GEMINI_API_KEY ausente no ESC/local .env (cards PNG locais funcionam 100%, mas geração criativa de fundo via Gemini Image API usa fallback local).');
  }

  return report;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await runDoctor();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('\n🩺 [MARKETING INTEGRATION DOCTOR — SOMENTE LEITURA / ZERO ENVIOS]');
    console.log(`• Docker: ${report.links.docker.ok ? 'OK' : 'FALHA'} | Containers: ${JSON.stringify(report.links.docker.containers)}`);
    console.log(`• Evolution (:8085): ${report.links.evolution.ok ? 'OK' : 'ATENÇÃO'} | WhatsApp=${report.links.evolution.connectionState} | Webhook=${report.links.evolution.webhookEnabled ? 'ON' : 'OFF'} | Chats=${report.links.evolution.chatsCount}`);
    console.log(`• Worker (:8086) + Studio PNG: ${report.links.worker.ok ? 'OK' : 'FALHA'} | CardSha=${report.links.worker.cardSha256 || 'N/A'}`);
    console.log(`• IA Local: Ollama=${report.links.localAi.ollamaOnline ? 'OK' : 'OFF'} | Vision(gemma4:12b)=${report.links.localAi.gemma4Vision ? 'SIM' : 'NÃO'} | OpenCode=${report.links.localAi.opencodeCliInstalled ? 'OK' : 'OFF'}`);
    console.log(`• Supabase Cloud: ${JSON.stringify(report.links.supabase)}`);
    console.log(`• Cross-Network OSINT Deps: ${JSON.stringify(report.links.credentialsAndOsint.crossNetworkDeps)}`);
    if (report.criticalGaps.length > 0) {
      console.log('\n🚨 GAPS CRÍTICOS ENCONTRADOS:');
      for (const g of report.criticalGaps) console.log(`  - ${g}`);
    }
    if (report.warnings.length > 0) {
      console.log('\n⚠️ AVISOS:');
      for (const w of report.warnings) console.log(`  - ${w}`);
    }
  }
}

export { runDoctor };
