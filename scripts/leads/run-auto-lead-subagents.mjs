#!/usr/bin/env node
/**
 * Script Orquestrador CLI dos Subagentes de Auto-Lead (Apify + Lindy AI)
 *
 * Lê credenciais do ambiente (injetadas via Pulumi ESC: `pulumi esc run <env> -- node ...`)
 * e executa a pipeline dos 3 subagentes:
 *   1. fb_group_intent_hunter (Apify Facebook Groups Scraper)
 *   2. cross_channel_enricher (Apify IG / Maps fallback)
 *   3. lindy_sdr_qualifier (Lindy AI Webhook SDR)
 *
 * Uso:
 *   node scripts/leads/run-auto-lead-subagents.mjs --routine-id=<uuid>
 *   node scripts/leads/run-auto-lead-subagents.mjs --simulate
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN || '';
const LINDY_WEBHOOK_URL = process.env.LINDY_WEBHOOK_URL || '';
const LINDY_WEBHOOK_SECRET = process.env.LINDY_WEBHOOK_SECRET || '';

const args = process.argv.slice(2);
const simulateArg = args.includes('--simulate');
const routineArg = args.find((a) => a.startsWith('--routine-id='))?.split('=')[1] || null;

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ [AUTO_LEAD_CLI] Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (recomendado via `pulumi esc run`).');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let query = supabase
    .from('platform_auto_lead_routines')
    .select('*')
    .is('deleted_at', null)
    .eq('is_active', true);

  if (routineArg) {
    query = query.eq('id', routineArg);
  }

  const { data: routines, error } = await query;
  if (error) {
    console.error('❌ [AUTO_LEAD_CLI] Erro ao consultar rotinas:', error.message);
    process.exit(1);
  }

  console.log(`[AUTO_LEAD_CLI] ${(routines || []).length} rotina(s) ativa(s) encontrada(s).`);

  for (const routine of routines || []) {
    console.log(`[AUTO_LEAD_CLI] Executando rotina "${routine.name}" (papel: ${routine.subagent_role})...`);

    const targetGroups = Array.isArray(routine.target_groups) ? routine.target_groups : [];
    const keywords = Array.isArray(routine.search_keywords) ? routine.search_keywords : [];

    if (!simulateArg && APIFY_API_TOKEN) {
      const actorPath = String(routine.apify_actor_id || 'apify/facebook-groups-scraper').replace('/', '~');
      const webhookUrl =
        LINDY_WEBHOOK_URL || `${SUPABASE_URL}/functions/v1/auto-lead-orchestrator?action=webhook`;

      const apifyRes = await fetch(
        `https://api.apify.com/v2/acts/${encodeURIComponent(actorPath)}/runs?token=${encodeURIComponent(APIFY_API_TOKEN)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startUrls: targetGroups.filter((g) => g.url).map((g) => ({ url: g.url })),
            searchKeywords: keywords,
            resultsLimit: 30,
            webhooks: [
              {
                eventTypes: ['ACTOR.RUN.SUCCEEDED'],
                requestUrl: webhookUrl,
                payloadTemplate: JSON.stringify({
                  routine_id: routine.id,
                  secret: LINDY_WEBHOOK_SECRET || undefined,
                  resource: '{{resource}}',
                }),
              },
            ],
          }),
        }
      );

      if (!apifyRes.ok) {
        console.error(`❌ [AUTO_LEAD_CLI] Falha Apify para "${routine.name}": HTTP ${apifyRes.status}`);
        continue;
      }

      const apifyJson = await apifyRes.json();
      console.log(`✅ [AUTO_LEAD_CLI] Run Apify disparada: ${apifyJson?.data?.id || 'ok'} -> Webhook: ${webhookUrl}`);
    } else {
      const groupName = targetGroups[0]?.name || 'Fisioterapia Brasil - Gestão e Clínica';
      const { data: upsertRes, error: rpcErr } = await supabase.rpc('upsert_platform_auto_leads_batch', {
        p_leads: [
          {
            full_name: 'Dra. Marina Albuquerque (CLI Subagente)',
            phone: '5511993332211',
            instagram_handle: '@marinaalbuquerque.fisio',
            facebook_group_name: groupName,
            city: 'Campinas',
            state: 'SP',
            specialty: 'Fisioterapia Traumato-Ortopédica',
            icp_tier: 'clinic_owner',
            source_post_excerpt: 'Alguém indica um prontuário eletrônico que envie lembretes no WhatsApp automaticamente?',
            ai_score: 89,
            subagent_captured_by: routine.subagent_role || 'fb_group_intent_hunter',
          },
        ],
        p_routine_id: routine.id,
      });

      if (rpcErr) {
        console.error(`❌ [AUTO_LEAD_CLI] Erro RPC em "${routine.name}":`, rpcErr.message);
      } else {
        console.log(`✅ [AUTO_LEAD_CLI] Simulação concluída para "${routine.name}": ${JSON.stringify(upsertRes)}`);
      }
    }
  }
}

main().catch((err) => {
  console.error('❌ [AUTO_LEAD_CLI] Erro fatal:', err?.message || err);
  process.exit(1);
});
