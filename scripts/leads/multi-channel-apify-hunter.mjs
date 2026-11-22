#!/usr/bin/env node
/**
 * Multi-Channel Apify Lead Hunter (Instagram, TikTok, LinkedIn)
 * 
 * Executa scraping direto no Apify via Google Search Scraper direcionado por dorks:
 * - Instagram: site:instagram.com ("fisioterapeuta" OR "estudio pilates") ("recém formada" OR "crefito" OR "atendimento domiciliar" OR "inauguração") "whatsapp"
 * - TikTok: site:tiktok.com ("fisioterapeuta" OR "consultorio de fisioterapia") ("recem formada" OR "meu consultorio" OR "atendimento") "whatsapp"
 * - LinkedIn: site:linkedin.com/in ("fisioterapeuta" OR "fisioterapia") ("recém-formada" OR "recém-formado" OR "inaugurando" OR "proprietário" OR "autônomo") "contato" OR "whatsapp"
 *
 * Em seguida, roda o curador SDR estilo Lindy AI com rigorosos filtros anti-software:
 * - Exclui quem vende/anuncia softwares ou outros serviços alheios à fisioterapia.
 * - Prioriza recém-formados e clínicas/estúdios em estágio inicial.
 * - Formata WhatsApp E.164, links e grava diretamente em platform_auto_leads.
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  normalizeBrPhone,
  extractPhoneFromText,
  extractInstagramFromText,
  extractEmailFromText,
  extractGreetingName,
} from './antigravity-lead-curator.mjs';

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN;
const SUPABASE_PROJECT_ID = process.env.VITE_SUPABASE_PROJECT_ID || 'ggytwbnintrftgzvjczs';

if (!APIFY_API_TOKEN) {
  console.error('❌ APIFY_API_TOKEN não encontrado.');
  process.exit(1);
}

// Queries segmentadas por canal (Instagram, TikTok, LinkedIn) com variações para capturar pelo menos 30 de cada
const SEARCH_TARGETS = [
  // --- INSTAGRAM (3 queries x ~15-20 resultados) ---
  {
    channel: 'instagram',
    query: 'site:instagram.com ("fisioterapeuta" OR "fisioterapia") ("recém formada" OR "recem formado" OR "crefito") ("whatsapp" OR "contato" OR "agendamento") Brasil',
  },
  {
    channel: 'instagram',
    query: 'site:instagram.com ("consultório de fisioterapia" OR "estúdio de pilates" OR "studio de pilates") ("inauguração" OR "inaugurou" OR "novo espaço" OR "atendimentos") ("whatsapp" OR "link na bio")',
  },
  {
    channel: 'instagram',
    query: 'site:instagram.com ("fisioterapeuta domiciliar" OR "fisioterapia home care" OR "fisioterapeuta autônoma") ("agende sua avaliação" OR "whatsapp") Brasil',
  },

  // --- TIKTOK (3 queries x ~15-20 resultados) ---
  {
    channel: 'tiktok',
    query: 'site:tiktok.com ("fisioterapeuta" OR "fisioterapia") ("recém formada" OR "peguei meu crefito" OR "crefito") ("whatsapp" OR "contato")',
  },
  {
    channel: 'tiktok',
    query: 'site:tiktok.com ("consultório de fisioterapia" OR "meu consultorio" OR "montando meu consultorio") ("fisioterapeuta" OR "pilates") ("whatsapp" OR "contato")',
  },
  {
    channel: 'tiktok',
    query: 'site:tiktok.com ("fisioterapia" OR "estudio de pilates") ("atendimento domiciliar" OR "agendamentos abertos") ("whatsapp" OR "link")',
  },

  // --- LINKEDIN (3 queries x ~15-20 resultados) ---
  {
    channel: 'linkedin',
    query: 'site:linkedin.com/in ("fisioterapeuta" OR "fisioterapia") ("recém-formado" OR "recém-formada" OR "buscando oportunidades" OR "atendimentos autônomos") ("whatsapp" OR "contato" OR "telefone")',
  },
  {
    channel: 'linkedin',
    query: 'site:linkedin.com/in ("fisioterapeuta" OR "proprietária") ("consultório" OR "clínica de fisioterapia" OR "studio de pilates") ("whatsapp" OR "contato")',
  },
  {
    channel: 'linkedin',
    query: 'site:linkedin.com/in ("fisioterapeuta autônomo" OR "fisioterapia domiciliar" OR "home care") ("whatsapp" OR "contato" OR "celular") Brasil',
  },
];

async function startGoogleSearchRun(query) {
  const res = await fetch(`https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${APIFY_API_TOKEN}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      queries: query,
      maxPagesPerQuery: 2,
      resultsPerPage: 25,
      mobileResults: false,
      languageCode: 'pt-BR',
      countryCode: 'br',
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Falha ao iniciar scraping Apify: ${err}`);
  }
  const data = await res.json();
  return { runId: data.data.id, datasetId: data.data.defaultDatasetId };
}

async function waitForRun(runId, datasetId) {
  process.stdout.write(`Aguardando run ${runId}... `);
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 4000));
    const res = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`);
    const data = await res.json();
    const status = data?.data?.status;
    if (status === 'SUCCEEDED') {
      console.log('✅ Concluído!');
      const itemsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`);
      const items = await itemsRes.json();
      return items;
    }
    if (status === 'FAILED' || status === 'ABORTED' || status === 'TIMED-OUT') {
      console.log(`❌ Run falhou com status ${status}`);
      return [];
    }
    process.stdout.write('.');
  }
  console.log('⏳ Timeout esperando run.');
  return [];
}

// Filtro anti-software e anti-serviços não fisioterapêuticos
function isExcludedText(combinedText) {
  // Concorrentes de gestão de clínicas ou softwares
  const softwareRegex = /clinicorp|feegow|zenfisio|fisioonline|gest[aã]oclick|shosp|amplimed|doctoralia|simples\s*dental|ninsaude|iclinic|vedius|mobifisio|prontu[aá]rio\s*verde|amigo\s*tech|totvs|sienge|omie|conta\s*azul/i;
  // Serviços alheios a atendimento fisioterapêutico direto (marketing, venda de cursos, infoprodutos, contabilidade, design de unhas, etc.)
  const nonPhysioServices = /venda de seguidores|gestor de tráfego|social media para|marketing para fisio|curso de marketing|mentoria para faturar|infoproduto|hotmart|kiwify|monetizze|afiliado|drop\s*shipping|advogado|contabilidade|imobili[aá]ria/i;
  // Apenas estudantes de fases iniciais (sem foco clínico prático)
  const pureStudent = /1º semestre|2º semestre|3º semestre|4º semestre|calouro|estudante de fonoaudiologia|estudante de medicina/i;

  return softwareRegex.test(combinedText) || nonPhysioServices.test(combinedText) || pureStudent.test(combinedText);
}

function parseLeadFromSearchResult(item, channel) {
  const title = String(item.title || '');
  const desc = String(item.description || '');
  const url = String(item.url || '');
  const combined = `${title} ${desc}`.toLowerCase();

  if (isExcludedText(combined)) {
    return null;
  }

  // Extração de nome
  let name = title.split(/[-|–•·:]/)[0].trim();
  name = name.replace(/\(@[a-zA-Z0-9._]+\)/g, '').replace(/no\s+(Instagram|TikTok|LinkedIn)/gi, '').trim();
  if (name.length < 3 || /^(instagram|tiktok|linkedin|perfil|fisioterapeuta|fisioterapia|video|post)$/i.test(name)) {
    // Tenta extrair da descrição ou fallback
    const matchName = desc.match(/(?:Dr\.|Dra\.|Fisioterapeuta)\s+([A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+(?:\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõç]+)+)/);
    if (matchName) name = matchName[0];
    else name = title.slice(0, 40);
  }

  const phone = extractPhoneFromText(`${title} ${desc}`);
  const email = extractEmailFromText(`${title} ${desc}`);
  const instagram = channel === 'instagram' ? extractInstagramFromText(`${title} ${desc} ${url}`) : extractInstagramFromText(`${title} ${desc}`);

  // Classificação ICP
  let icpTier = 'solo_physio';
  let profileDetail = 'Fisioterapeuta Autônomo';

  if (/crefito|rec[eé]m[\s-]*formad|peguei o crefito|tirei meu crefito|formei em fisioterapia/i.test(combined)) {
    profileDetail = 'Recém-formado / CREFITO novo';
    icpTier = 'solo_physio';
  } else if (/inaugura|novo espa[çc]o|montando|abertura|primeiro consult[oó]rio|abrindo cl[ií]nica/i.test(combined)) {
    profileDetail = 'Clínica / Consultório em estágio inicial';
    icpTier = 'clinic_owner';
  } else if (/pilates|studio|est[uú]dio/i.test(combined)) {
    profileDetail = 'Estúdio de Pilates / Reabilitação';
    icpTier = 'studio_pilates';
  } else if (/home\s*care|domiciliar|atendimento em domic[ií]lio/i.test(combined)) {
    profileDetail = 'Atendimento Domiciliar / Home Care';
    icpTier = 'solo_physio';
  }

  // Pontuação estilo Lindy AI (0-100)
  let score = 70;
  if (/crefito|rec[eé]m[\s-]*formad|novo espa[çc]o|inaugura/i.test(combined)) score += 15;
  if (/domiciliar|home\s*care|aut[oô]nomo/i.test(combined)) score += 10;
  if (phone) score += 10;
  if (email || instagram) score += 5;
  score = Math.max(50, Math.min(100, score));

  // Extrai estado/cidade se citado
  const stateMatch = desc.match(/\b(SP|RJ|MG|RS|PR|SC|BA|PE|CE|DF|GO|ES|MT|MS|PA|PB|RN|AL|SE|PI|MA|AM|RO|AC|TO|AP|RR)\b/i);
  const state = stateMatch ? stateMatch[1].toUpperCase() : null;

  const firstName = extractGreetingName(name);
  const channelDisplay = channel === 'instagram' ? 'Instagram' : channel === 'tiktok' ? 'TikTok' : 'LinkedIn';

  const icebreaker =
    `Oi, ${firstName}, tudo bem? Vi seu perfil no ${channelDisplay} e achei muito bacana sua atuação na fisioterapia!\n\n` +
    `Hoje você está atuando com atendimentos próprios/consultório?\n\n` +
    `[RESPOSTA]\n\n` +
    `Pergunto porque desenvolvemos a Pluri Fisio, uma plataforma prática feita sob medida para fisioterapeutas no início e consultórios novos organizarem prontuários, evolução rápida e agenda sem complicações de sistemas engessados. Se fizer sentido, te apresento em 10 minutinhos!`;

  return {
    full_name: name,
    phone: phone || null,
    email: email || null,
    instagram_handle: instagram || (channel === 'instagram' && url.includes('instagram.com/') ? `@${url.split('instagram.com/')[1].split('/')[0].split('?')[0]}` : null),
    facebook_profile_url: null,
    facebook_group_name: null,
    facebook_group_url: null,
    website_url: url,
    city: null,
    state: state || null,
    clinic_name: icpTier === 'clinic_owner' ? name : null,
    specialty: icpTier === 'studio_pilates' ? 'Pilates Clínico' : 'Fisioterapia Geral & Traumato-Ortopédica',
    icp_tier: icpTier,
    source_platform: channel,
    source_post_url: url,
    source_post_excerpt: desc.slice(0, 500) || title,
    ai_score: score,
    ai_qualification_summary: `Perfil: ${profileDetail} • Canal: ${channelDisplay}${phone ? ' • WhatsApp identificado' : ''} • Alinhamento com Pluri Fisio.`,
    ai_icebreaker_message: icebreaker,
    subagent_captured_by: `apify_${channel}_hunter`,
    raw_metadata: {
      url,
      title,
      searchChannel: channel,
    },
  };
}

async function getServiceKey() {
  if (SUPABASE_SERVICE_ROLE_KEY) return SUPABASE_SERVICE_ROLE_KEY;
  if (SUPABASE_ACCESS_TOKEN && SUPABASE_PROJECT_ID) {
    const keysRes = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(SUPABASE_PROJECT_ID)}/api-keys`, {
      headers: { Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}` },
    });
    if (keysRes.ok) {
      const keys = await keysRes.json();
      const srv = Array.isArray(keys) ? keys.find((k) => k.name === 'service_role') : null;
      if (srv?.api_key) return srv.api_key;
    }
  }
  return null;
}

async function main() {
  console.log('🚀 Iniciando Varredura Multi-Canal (Instagram, TikTok, LinkedIn) no Apify...');
  const allCuratedLeads = [];
  const countsByChannel = { instagram: 0, tiktok: 0, linkedin: 0 };

  for (const target of SEARCH_TARGETS) {
    console.log(`\n🔍 Disparando busca para canal [${target.channel.toUpperCase()}]: ${target.query.slice(0, 80)}...`);
    try {
      const { runId, datasetId } = await startGoogleSearchRun(target.query);
      const datasetItems = await waitForRun(runId, datasetId);
      
      let collectedForQuery = 0;
      for (const dsItem of datasetItems) {
        const organic = dsItem.organicResults || [];
        for (const item of organic) {
          const lead = parseLeadFromSearchResult(item, target.channel);
          if (lead) {
            // Evita duplicatas por URL ou Nome
            const isDuplicate = allCuratedLeads.some(
              (l) => (lead.source_post_url && l.source_post_url === lead.source_post_url) ||
                     (lead.phone && l.phone === lead.phone) ||
                     (lead.full_name && l.full_name.toLowerCase() === lead.full_name.toLowerCase())
            );
            if (!isDuplicate) {
              allCuratedLeads.push(lead);
              countsByChannel[target.channel]++;
              collectedForQuery++;
            }
          }
        }
      }
      console.log(`   ➔ ${collectedForQuery} leads novos coletados nesta query. Total [${target.channel}]: ${countsByChannel[target.channel]}`);
    } catch (err) {
      console.error(`   ⚠️ Erro na busca ${target.channel}:`, err.message);
    }
  }

  console.log('\n📊 Resumo da Coleta por Rede:');
  console.log(`   - Instagram: ${countsByChannel.instagram}`);
  console.log(`   - TikTok: ${countsByChannel.tiktok}`);
  console.log(`   - LinkedIn: ${countsByChannel.linkedin}`);
  console.log(`   - Total Curado: ${allCuratedLeads.length} leads`);

  // Salva cópia local em JSON
  const outPath = path.resolve('scripts/leads/output-multichannel-leads.json');
  fs.writeFileSync(outPath, JSON.stringify(allCuratedLeads, null, 2), 'utf8');
  console.log(`💾 JSON salvo em: ${outPath}`);

  // Grava direto no Supabase
  const serviceKey = await getServiceKey();
  if (!serviceKey || !SUPABASE_URL) {
    console.error('❌ Não foi possível obter SUPABASE_SERVICE_ROLE_KEY para gravação direta.');
    return;
  }

  const supabase = createClient(SUPABASE_URL, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`\n📤 Gravando ${allCuratedLeads.length} leads no Supabase (tabela platform_auto_leads)...`);
  const { data, error } = await supabase.rpc('upsert_platform_auto_leads_batch', {
    p_leads: allCuratedLeads,
    p_run_id: null,
    p_routine_id: null,
  });

  if (error) {
    console.error('❌ Erro na RPC upsert_platform_auto_leads_batch:', error.message);
    process.exit(1);
  }

  console.log('✅ Leads inseridos com sucesso no Supabase:', JSON.stringify(data));
}

main().catch((err) => {
  console.error('❌ Falha fatal no orquestrador:', err);
  process.exit(1);
});
