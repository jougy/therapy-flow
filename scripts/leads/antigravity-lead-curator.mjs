#!/usr/bin/env node
/**
 * Antigravity Lead Curator (Substituto 100% Open Source / Local do Lindy AI)
 *
 * Responsabilidade:
 * - Lê leads brutos de um ou mais datasets do Apify (`--dataset-id=id1,id2` usando APIFY_API_TOKEN do Pulumi ESC),
 *   de um arquivo JSON (`--input=<arquivo.json>`), de stdin (`--stdin`) ou `--demo`.
 * - Suporta nativamente os schemas reais de:
 *   1. `apify/facebook-groups-scraper` (`user.name`, `user.id`, `text`, `facebookUrl`, `url`)
 *   2. `compass/crawler-google-places` (`title`, `phoneUnformatted`, `phone`, `website`, `city`, `state`, `address`, `categoryName`)
 * - Executa curadoria SDR (extrai WhatsApp E.164, @instagram, e-mail, calcula Lead Score 0-100,
 *   classifica ICP, opcionalmente refina com Ollama local gratuito `gemma4:cloud`,
 *   gera Icebreaker personalizado) e grava em `--out=<arquivo.json>` e/ou na tabela `platform_auto_leads`.
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import { createClient } from '@supabase/supabase-js';

const OLLAMA_HOST = process.env.OLLAMA_HOST || '127.0.0.1';
const OLLAMA_PORT = Number(process.env.OLLAMA_PORT || 11434);
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gemma4:cloud';

function parseArg(prefix) {
  const found = process.argv.find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

const datasetIdsArg = parseArg('--dataset-id=');
const inputPath = parseArg('--input=');
const outPath = parseArg('--out=');
const useStdin = process.argv.includes('--stdin');
const useDemo = process.argv.includes('--demo');
const dryRun = process.argv.includes('--dry-run');

export function normalizeBrPhone(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function extractPhoneFromText(text) {
  const withoutUrls = String(text || '').replace(/https?:\/\/\S+/gi, ' ');
  const match = withoutUrls.match(/(?:\+?55[\s-]*)?(?:\(\d{2}\)|(?:^|\s)\d{2})[\s-]*(?:9\d{4}|\d{4})[-\s.]?\d{4}\b/);
  return match ? normalizeBrPhone(match[0]) : null;
}

export function extractInstagramFromText(text) {
  const match = String(text || '').match(/(?:^|[\s,(])@([a-zA-Z0-9._]{3,30})/);
  return match ? `@${match[1].replace(/\.+$/, '')}` : null;
}

export function extractEmailFromText(text) {
  const match = String(text || '').match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

export function extractGreetingName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/);
  if (parts.length >= 2 && /^(dr\.?|dra\.?)$/i.test(parts[0])) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts[0] || 'Colega';
}

function normalizeStateAbbr(stateRaw) {
  const s = String(stateRaw || '').trim();
  if (!s) return null;
  if (s.length === 2) return s.toUpperCase();
  const map = {
    'são paulo': 'SP',
    'rio de janeiro': 'RJ',
    'minas gerais': 'MG',
    'paraná': 'PR',
    'santa catarina': 'SC',
    'rio grande do sul': 'RS',
    'bahia': 'BA',
    'pernambuco': 'PE',
    'ceará': 'CE',
    'distrito federal': 'DF',
    'goiás': 'GO',
  };
  return map[s.toLowerCase()] || s.slice(0, 2).toUpperCase();
}

async function tryLocalOllamaCurator(rawText, fallbackResult) {
  const text = String(rawText || '').trim();
  if (!text) return fallbackResult;

  const prompt =
    `Você é um SDR especialista em fisioterapia e clínicas para a Pluri Fisio.\n` +
    `Foco de ICP: leigos com tecnologia, profissionais solo iniciando carreira, recém-formados com CREFITO novo, clínicas começando e fisioterapeutas experientes que ainda usam papel/planilha. Nunca qualifique quem já usa outro software de gestão.\n` +
    `Analise este contato/post e responda APENAS JSON válido com as chaves:\n` +
    `{"ai_score": number(0..100), "icp_tier": "clinic_owner"|"studio_pilates"|"solo_physio"|"student"|"other", "ai_qualification_summary": string, "ai_icebreaker_message": string}\n` +
    `Nome: ${fallbackResult.full_name}\nOrigem: ${fallbackResult.facebook_group_name || fallbackResult.source_platform}\nTexto: ${text.slice(0, 500)}`;

  return new Promise((resolve) => {
    const payload = JSON.stringify({ model: OLLAMA_MODEL, prompt, stream: false });
    const req = http.request(
      {
        hostname: OLLAMA_HOST,
        port: OLLAMA_PORT,
        path: '/api/generate',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 3000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(body);
            const jsonMatch = String(parsed.response || '').match(/\{[\s\S]*\}/);
            if (!jsonMatch) return resolve(fallbackResult);
            const ai = JSON.parse(jsonMatch[0]);
            resolve({
              ...fallbackResult,
              ai_score: typeof ai.ai_score === 'number' ? Math.max(0, Math.min(100, Math.round(ai.ai_score))) : fallbackResult.ai_score,
              icp_tier: ['clinic_owner', 'studio_pilates', 'solo_physio', 'student', 'other'].includes(ai.icp_tier)
                ? ai.icp_tier
                : fallbackResult.icp_tier,
              ai_qualification_summary: ai.ai_qualification_summary || fallbackResult.ai_qualification_summary,
              ai_icebreaker_message: ai.ai_icebreaker_message || fallbackResult.ai_icebreaker_message,
            });
          } catch {
            resolve(fallbackResult);
          }
        });
      }
    );
    req.on('error', () => resolve(fallbackResult));
    req.on('timeout', () => {
      req.destroy();
      resolve(fallbackResult);
    });
    req.write(payload);
    req.end();
  });
}

export async function curateRawLead(raw) {
  if (!raw || raw.error || raw.permanentlyClosed) return null;

  const isGoogleMaps = Boolean(raw.placeId || raw.categoryName || raw.searchString);
  const text = String(raw.source_post_excerpt || raw.postText || raw.text || raw.description || '').trim();
  const fullName = String(
    raw.full_name || raw.authorName || raw.user?.name || raw.name || raw.title || 'Profissional de Saúde'
  ).trim();
  const firstName = extractGreetingName(fullName);
  const isClinicTitle = /clínica|clinica|consultório|consultorio|centro|instituto|studio|estúdio|fisio|reabilitação|reabilitacao/i.test(fullName);

  const groupName = isGoogleMaps
    ? `Google Maps (${raw.searchString || raw.categoryName || 'Fisioterapia'})`
    : String(raw.facebook_group_name || raw.groupName || raw.groupTitle || (raw.facebookUrl?.includes('156870747718464') ? 'Fisioterapia Brasil (Grupo FB)' : 'Grupo de Fisioterapia')).trim();

  const phone = normalizeBrPhone(raw.phoneUnformatted || raw.phone || raw.whatsapp) || extractPhoneFromText(text);
  const email = String(raw.email || '').trim().toLowerCase() || extractEmailFromText(text);
  const instagram = String(raw.instagram_handle || raw.instagram || '').trim() || extractInstagramFromText(text);

  const fbProfileUrl =
    raw.facebook_profile_url ||
    raw.authorProfileUrl ||
    raw.userUrl ||
    (raw.user?.id ? `https://www.facebook.com/profile.php?id=${raw.user.id}` : null);

  const combinedText = `${fullName} ${raw.categoryName || ''} ${text}`.toLowerCase();

  // Exclui quem já postou sobre ou divulga outros softwares de gestão clínica parecidos
  if (/clinicorp|feegow|zenfisio|fisioonline|gest[aã]oclick|shosp|amplimed|doctoralia|simples\s*dental|ninsaude|iclinic|vedius|mobifisio|prontu[aá]rio\s*verde|amigo\s*tech/i.test(combinedText)) {
    return null;
  }

  let profileDetail = 'Fisioterapeuta / Clínica';
  if (/crefito|rec[eé]m[\s-]*formad|peguei o crefito|tirei meu crefito|formei/i.test(combinedText)) {
    profileDetail = 'CREFITO novo / Recém-formado';
  } else if (/abrindo cl[ií]nica|primeira cl[ií]nica|come[çc]ando cl[ií]nica|inaugurando|montando consult[oó]rio/i.test(combinedText)) {
    profileDetail = 'Clínica começando';
  } else if (/papel|caderno|ficha de papel|planilha|n[aã]o entendo de sistema|nunca usei sistema|leigo/i.test(combinedText)) {
    profileDetail = 'Experiente no papel / Leigo em tecnologia';
  } else if (/aut[oô]nomo|home\s*care|domiciliar|solo|come[çc]ando agora/i.test(combinedText)) {
    profileDetail = 'Profissional solo iniciante';
  }

  let score = typeof raw.ai_score === 'number' ? raw.ai_score : isGoogleMaps ? 68 : 55;
  if (typeof raw.ai_score !== 'number') {
    if (/fisio|pilates|reabilit|ortoped|rpg|quirop/i.test(combinedText)) score += 10;
    if (/clínica|clinica|consultório|consultorio|estúdio|estudio|pilates|clinic/i.test(combinedText)) score += 12;
    if (/crefito|rec[eé]m[\s-]*formad|abrindo cl[ií]nica|montando consult[oó]rio|aut[oô]nomo|home\s*care|papel|caderno|planilha/i.test(combinedText)) score += 15;
    if (/prontuário|prontuario|agenda|indicação|indicacao|whatsapp/i.test(combinedText)) score += 10;
    if (phone) score += 10;
    if (raw.website || instagram || email) score += 4;
    if (/estudante|estágio|estagio|tcc|prova/i.test(combinedText)) score -= 25;
    if (/hotmart\.com|kiwify|monetizze|artes prontas|cone hindu|ear candle/i.test(combinedText)) score -= 45;
  }
  score = Math.max(10, Math.min(100, Math.round(score)));

  let icpTier = raw.icp_tier || 'solo_physio';
  if (!raw.icp_tier) {
    if (/hotmart\.com|cone hindu|ear candle/i.test(combinedText)) icpTier = 'other';
    else if (/pilates/i.test(combinedText)) icpTier = 'studio_pilates';
    else if (isClinicTitle || /clínica|clinica|equipe|sócios|socios|clinic/i.test(combinedText)) icpTier = 'clinic_owner';
    else if (/estudante|estágio|estagio/i.test(combinedText)) icpTier = 'student';
  }

  const city = raw.city || null;
  const state = normalizeStateAbbr(raw.state);
  const clinicName = raw.clinic_name || (isGoogleMaps ? fullName : null);
  const sourceExcerpt = isGoogleMaps
    ? `${raw.categoryName || 'Fisioterapia'} • ${raw.address || `${city || ''} - ${state || ''}`}${raw.reviewsCount ? ` (${raw.reviewsCount} avaliações, nota ${raw.totalScore})` : ''}`
    : text.slice(0, 600);

  const icebreaker =
    raw.ai_icebreaker_message ||
    (isGoogleMaps
      ? `Oi, ${firstName}, tudo bem? Vi o contato de vocês no Google Maps${city ? ` (${city})` : ''} e queria te fazer uma pergunta rápida.\n\nHoje você atua na área de fisioterapia?\n\n[RESPOSTA]\n\nAh, legal. E atualmente, como você organiza agenda, prontuário e financeiro dos pacientes? Planilha, papel, algum sistema...?\n\n[RESPOSTA]\n\nPergunto porque fazemos a Pluri Fisio, um sistema feito só para fisioterapeutas autônomos e clínicas pequenas. Se fizer sentido, te mostro em 10 minutos. Se não, sem problema.`
      : `Oi, ${firstName}, tudo bem? Vi você no grupo ${groupName} e queria te fazer uma pergunta rápida.\n\nHoje você atua na área de fisioterapia?\n\n[RESPOSTA]\n\nAh, legal. E atualmente, como você organiza agenda, prontuário e financeiro dos pacientes? Planilha, papel, algum sistema...?\n\n[RESPOSTA]\n\nPergunto porque fazemos a Pluri Fisio, um sistema feito só para fisioterapeutas autônomos e clínicas pequenas. Se fizer sentido, te mostro em 10 minutos. Se não, sem problema.`);

  const baseCurated = {
    full_name: fullName,
    phone,
    email: email || null,
    instagram_handle: instagram || null,
    facebook_profile_url: fbProfileUrl,
    facebook_group_name: groupName,
    facebook_group_url: raw.facebook_group_url || raw.groupUrl || raw.facebookUrl || null,
    website_url: raw.website || raw.website_url || null,
    city,
    state,
    clinic_name: clinicName,
    specialty: raw.specialty || (icpTier === 'studio_pilates' ? 'Pilates Clínico' : 'Fisioterapia'),
    icp_tier: icpTier,
    source_platform: raw.source_platform || (isGoogleMaps ? 'google_maps' : 'facebook_group'),
    source_post_url: raw.source_post_url || raw.postUrl || raw.url || null,
    source_post_excerpt: sourceExcerpt || null,
    ai_score: score,
    ai_qualification_summary:
      raw.ai_qualification_summary ||
      `Perfil: ${profileDetail} (${icpTier}) • Origem: ${isGoogleMaps ? 'Google Maps' : 'Grupo Facebook'}${phone ? ' • WhatsApp/telefone verificado' : ''}.`,
    ai_icebreaker_message: icebreaker,
    subagent_captured_by: 'antigravity_lead_curator',
    raw_metadata: {
      source: isGoogleMaps ? 'apify_google_maps' : 'apify_facebook_groups',
      placeId: raw.placeId || null,
      url: raw.url || null,
    },
  };

  return tryLocalOllamaCurator(sourceExcerpt, baseCurated);
}

async function fetchApifyDataset(id, token) {
  const res = await fetch(
    `https://api.apify.com/v2/datasets/${encodeURIComponent(id)}/items?token=${encodeURIComponent(token)}&limit=100`
  );
  if (!res.ok) throw new Error(`Falha ao ler dataset Apify ${id} (${res.status})`);
  const items = await res.json();
  return Array.isArray(items) ? items : [];
}

async function loadRawItems() {
  if (useDemo) {
    return [
      {
        authorName: 'Dra. Beatriz Vasconcelos',
        groupName: 'Fisioterapia Brasil - Gestão e Clínica',
        postText: 'Alguém indica um sistema de prontuário e agenda com confirmação no WhatsApp para minha clínica em Campinas? Meu whats é (19) 99123-7788 @beatrizfisio.clinica',
        city: 'Campinas',
        state: 'SP',
      },
      {
        authorName: 'Dr. Lucas Pinheiro',
        groupName: 'Pilates Clínico & Estúdios Brasil',
        postText: 'Abri meu estúdio de Pilates agora e quero sair das planilhas de evolução e controle financeiro. Contato lucas@studiopinheiro.com.br',
        city: 'Curitiba',
        state: 'PR',
      },
    ];
  }

  if (datasetIdsArg) {
    const token = process.env.APIFY_API_TOKEN;
    if (!token) {
      throw new Error('APIFY_API_TOKEN ausente. Execute via `pulumi env run ... -- node scripts/leads/antigravity-lead-curator.mjs`.');
    }
    const ids = datasetIdsArg.split(',').map((s) => s.trim()).filter(Boolean);
    const all = [];
    for (const id of ids) {
      const chunk = await fetchApifyDataset(id, token);
      all.push(...chunk);
    }
    return all;
  }

  if (inputPath) {
    const raw = fs.readFileSync(inputPath, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  if (useStdin) {
    const raw = fs.readFileSync(0, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  throw new Error('Informe --dataset-id=<id1,id2>, --input=<arquivo.json>, --stdin ou --demo.');
}

async function main() {
  const rawItems = await loadRawItems();
  const curated = [];
  for (const item of rawItems) {
    const c = await curateRawLead(item);
    if (c) curated.push(c);
  }

  console.log(`[LEAD_CURATOR] ${curated.length} lead(s) curado(s) (de ${rawItems.length} itens brutos).`);

  if (outPath) {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(curated, null, 2), 'utf8');
    console.log(`[LEAD_CURATOR] Arquivo salvo em ${outPath}`);
  }

  if (dryRun) {
    if (!outPath) console.log(JSON.stringify(curated, null, 2));
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const projectRef = process.env.VITE_SUPABASE_PROJECT_ID || (supabaseUrl ? new URL(supabaseUrl).hostname.split('.')[0] : null);
  let serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceKey && process.env.SUPABASE_ACCESS_TOKEN && projectRef) {
    const keysRes = await fetch(`https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/api-keys`, {
      headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}` },
    });
    if (keysRes.ok) {
      const keys = await keysRes.json();
      const srv = Array.isArray(keys) ? keys.find((k) => k.name === 'service_role') : null;
      if (srv?.api_key) serviceKey = srv.api_key;
    }
  }

  if (!supabaseUrl || !serviceKey) {
    console.log('[LEAD_CURATOR] SUPABASE_SERVICE_ROLE_KEY não disponível; arquivo JSON salvo para importação.');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await supabase.rpc('upsert_platform_auto_leads_batch', {
    p_leads: curated,
    p_run_id: null,
    p_routine_id: null,
  });

  if (error) {
    throw new Error(`Erro ao salvar no Supabase: ${error.message}`);
  }

  console.log(`[LEAD_CURATOR] Tabela platform_auto_leads atualizada: ${JSON.stringify(data)}`);

  // Verifica contagem real e eventuais cruzamentos com as 3 agendas
  const { data: statsRows } = await supabase
    .from('platform_auto_leads')
    .select('id, full_name, phone, city, state, ai_score, meeting_status, meeting_booked_by, meeting_scheduled_at, source_platform')
    .is('deleted_at', null)
    .order('ai_score', { ascending: false })
    .limit(60);

  if (Array.isArray(statsRows)) {
    const withPhone = statsRows.filter((r) => Boolean(r.phone)).length;
    const withAgenda = statsRows.filter((r) => r.meeting_status && r.meeting_status !== 'none').length;
    console.log(`[LEAD_CURATOR] Resumo no DB: total=${statsRows.length}, com_telefone=${withPhone}, cruzados_com_agenda=${withAgenda}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('❌ [LEAD_CURATOR]', err?.message || err);
    process.exit(1);
  });
}
