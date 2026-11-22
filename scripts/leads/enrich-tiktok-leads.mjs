#!/usr/bin/env node
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import { extractPhoneFromText, extractEmailFromText, extractGreetingName } from './antigravity-lead-curator.mjs';

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!APIFY_API_TOKEN) {
  console.error('❌ APIFY_API_TOKEN ausente');
  process.exit(1);
}

const QUERIES = [
  'site:tiktok.com ("fisioterapeuta" OR "fisioterapia") ("recém formada" OR "recem formado" OR "crefito")',
  'site:tiktok.com ("fisioterapeuta" OR "pilates") ("meu consultório" OR "inauguração" OR "atendimentos")',
  'site:tiktok.com ("fisioterapia" OR "fisioterapeuta") ("whatsapp" OR "contato" OR "agendamento")',
];

async function startSearch(query) {
  const res = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${APIFY_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queries: query,
      maxPagesPerQuery: 2,
      resultsPerPage: 20,
      languageCode: 'pt-BR',
      countryCode: 'br',
    }),
  });
  const data = await res.json();
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId };
}

async function waitForRun(runId, datasetId) {
  process.stdout.write(`Aguardando run ${runId}... `);
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`);
    const data = await res.json();
    if (data?.data?.status === 'SUCCEEDED') {
      console.log('✅ Concluído!');
      const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`);
      return await itemsRes.json();
    }
    process.stdout.write('.');
  }
  return [];
}

async function main() {
  const newLeads = [];
  for (const q of QUERIES) {
    console.log(`\n🔍 Query TikTok: ${q}`);
    const { runId, datasetId } = await startSearch(q);
    const ds = await waitForRun(runId, datasetId);
    for (const item of ds) {
      for (const org of (item.organicResults || [])) {
        const title = org.title || '';
        const desc = org.description || '';
        const combined = `${title} ${desc}`.toLowerCase();
        
        // Filtro anti-software
        if (/clinicorp|feegow|zenfisio|amplimed|doctoralia|iclinic|kiwify|hotmart/i.test(combined)) continue;

        let name = title.split(/[-|–•·:]/)[0].replace(/no TikTok/gi, '').trim();
        if (name.length < 3) name = 'Fisioterapeuta';

        const phone = extractPhoneFromText(`${title} ${desc}`);
        const email = extractEmailFromText(`${title} ${desc}`);
        const tiktokUserMatch = org.url?.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/);
        const handle = tiktokUserMatch ? `@${tiktokUserMatch[1]}` : null;

        const firstName = extractGreetingName(name);
        const icebreaker =
          `Oi, ${firstName}, tudo bem? Vi seus vídeos e atuação no TikTok e queria te fazer uma pergunta rápida.\n\n` +
          `Hoje você está atendendo pacientes de fisioterapia no consultório ou domiciliar?\n\n` +
          `[RESPOSTA]\n\n` +
          `A gente criou a Pluri Fisio pensando exatamente em profissionais que querem prontuário ágil, agenda prática e evolução rápida sem ter que pagar fortunas por sistemas engessados. Se tiver 10 minutinhos, adoraria te mostrar!`;

        newLeads.push({
          full_name: name,
          phone: phone || null,
          email: email || null,
          instagram_handle: handle,
          facebook_group_name: 'TikTok Brasil',
          website_url: org.url,
          clinic_name: null,
          specialty: 'Fisioterapia Geral',
          icp_tier: 'solo_physio',
          source_platform: 'apify_direct',
          source_post_url: org.url,
          source_post_excerpt: desc.slice(0, 500) || title,
          ai_score: 75,
          ai_qualification_summary: 'Perfil: Fisioterapeuta Autônomo • Canal: TikTok • Alinhamento com Pluri Fisio.',
          ai_icebreaker_message: icebreaker,
          subagent_captured_by: 'apify_tiktok_hunter',
          raw_metadata: { url: org.url, title, searchChannel: 'tiktok' },
        });
      }
    }
  }

  console.log(`\n📥 Coletados ${newLeads.length} novos leads do TikTok!`);
  if (newLeads.length > 0) {
    const client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    const { data, error } = await client.rpc('upsert_platform_auto_leads_batch', {
      p_leads: newLeads,
      p_run_id: null,
      p_routine_id: null,
    });
    console.log('✅ Inserção Supabase:', error ? error.message : data);
  }
}

main().catch(console.error);
