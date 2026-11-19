/**
 * Edge Function: auto-lead-orchestrator
 *
 * Responsabilidade:
 * - Orquestrar o enxame de subagentes (Apify Facebook Groups Scraper + Cross-Enricher + Lindy AI SDR)
 * - Receber webhooks em tempo real do Lindy AI e do Apify (ACTOR.RUN.SUCCEEDED)
 * - Sincronizar datasets sob demanda e reconciliar as 3 agendas:
 *   WhatsApp Bot (+5511960474566), WhatsApp Comercial (+5511980113936) e Agenda Backoffice.
 *
 * Segredos (via Pulumi ESC -> Supabase Secrets):
 * - APIFY_API_TOKEN, APIFY_DEFAULT_ACTOR_ID
 * - LINDY_WEBHOOK_URL, LINDY_WEBHOOK_SECRET
 * - AXIOM_TOKEN, AXIOM_DATASET, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import { corsHeaders } from '../_shared/cors.ts';
import { ingestToAxiom } from '../_shared/telemetry-axiom.ts';

const extendedCorsHeaders = {
  ...corsHeaders,
  'Access-Control-Allow-Headers': `${corsHeaders['Access-Control-Allow-Headers']}, x-auto-lead-secret, x-lindy-signature`,
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...extendedCorsHeaders, 'Content-Type': 'application/json' },
  });

const BOT_PHONE = '5511960474566';
const COMMERCIAL_PHONE = '5511980113936';

interface RawLeadInput {
  full_name?: string;
  authorName?: string;
  name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram_handle?: string;
  instagram?: string;
  facebook_profile_url?: string;
  authorProfileUrl?: string;
  userUrl?: string;
  facebook_group_name?: string;
  groupName?: string;
  facebook_group_url?: string;
  groupUrl?: string;
  linkedin_url?: string;
  website_url?: string;
  city?: string;
  state?: string;
  clinic_name?: string;
  specialty?: string;
  icp_tier?: string;
  source_platform?: string;
  source_post_url?: string;
  postUrl?: string;
  url?: string;
  source_post_excerpt?: string;
  postText?: string;
  text?: string;
  ai_score?: number;
  ai_qualification_summary?: string;
  ai_icebreaker_message?: string;
  subagent_captured_by?: string;
  external_lead_key?: string;
  apify_run_id?: string;
  lindy_task_id?: string;
  raw_metadata?: Record<string, unknown>;
}

function normalizePhoneBr(raw?: string | null): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12 && digits.startsWith('55')) return digits;
  return digits;
}

function normalizePhoneKey(raw?: string | null): string | null {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return null;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits.length > 11 ? digits.slice(-11) : digits;
}

function extractPhoneFromText(text: string): string | null {
  const match = text.match(/(?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?(?:9\d{4}|\d{4})[-\s.]?\d{4}/);
  return match ? normalizePhoneBr(match[0]) : null;
}

function extractInstagramFromText(text: string): string | null {
  const match = text.match(/@([a-zA-Z0-9._]{3,30})/);
  return match ? `@${match[1]}` : null;
}

function extractEmailFromText(text: string): string | null {
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].toLowerCase() : null;
}

function scoreAndQualifyLead(raw: RawLeadInput, runId?: string) {
  const text = (raw.source_post_excerpt || raw.postText || raw.text || '').trim();
  const fullName = (raw.full_name || raw.authorName || raw.name || 'Profissional de Saúde').trim();
  const firstName = fullName.split(/\s+/)[0] || 'Colega';
  const groupName = (raw.facebook_group_name || raw.groupName || 'Grupo de Fisioterapia').trim();
  const phone = normalizePhoneBr(raw.phone || raw.whatsapp) || extractPhoneFromText(text);
  const email = (raw.email || '').trim().toLowerCase() || extractEmailFromText(text);
  const instagram = (raw.instagram_handle || raw.instagram || '').trim() || extractInstagramFromText(text);
  const lower = text.toLowerCase();

  let score = typeof raw.ai_score === 'number' ? raw.ai_score : 52;
  if (typeof raw.ai_score !== 'number') {
    if (/clínica|clinica|consultório|consultorio|estúdio|estudio|pilates/i.test(lower)) score += 18;
    if (/sistema|software|prontuário|prontuario|agenda|planilha|indicação|indicacao/i.test(lower)) score += 20;
    if (phone) score += 10;
    if (instagram || email) score += 5;
    if (/estudante|estágio|estagio|tcc|prova/i.test(lower)) score -= 25;
  }
  score = Math.max(10, Math.min(100, Math.round(score)));

  let icpTier = raw.icp_tier || 'solo_physio';
  if (!raw.icp_tier) {
    if (/pilates/i.test(lower)) icpTier = 'studio_pilates';
    else if (/clínica|clinica|equipe|sócios|socios|recepção/i.test(lower)) icpTier = 'clinic_owner';
    else if (/estudante|estágio|estagio/i.test(lower)) icpTier = 'student';
  }

  const summary =
    raw.ai_qualification_summary ||
    `Lead identificado no grupo "${groupName}" (${icpTier === 'clinic_owner' ? 'Dono de Clínica' : icpTier === 'studio_pilates' ? 'Estúdio de Pilates' : 'Fisioterapeuta'}).` +
      (phone ? ' WhatsApp capturado/enriquecido.' : ' Perfil social disponível para enriquecimento/DM.');

  const icebreaker =
    raw.ai_icebreaker_message ||
    `Olá ${firstName}! Vi sua publicação no grupo "${groupName}" sobre organização clínica e prontuário. Trabalho com a Pluri-Health (feita para fisios e clínicas) e queria te mostrar em 10 min como automatizamos agenda, evolução e cobranças. Posso te enviar o link?`;

  return {
    full_name: fullName,
    phone,
    email,
    instagram_handle: instagram,
    facebook_profile_url: raw.facebook_profile_url || raw.authorProfileUrl || raw.userUrl || null,
    facebook_group_name: groupName,
    facebook_group_url: raw.facebook_group_url || raw.groupUrl || null,
    linkedin_url: raw.linkedin_url || null,
    website_url: raw.website_url || null,
    city: raw.city || null,
    state: raw.state || null,
    clinic_name: raw.clinic_name || null,
    specialty: raw.specialty || (icpTier === 'studio_pilates' ? 'Pilates Clínico' : 'Fisioterapia'),
    icp_tier: icpTier,
    source_platform: raw.source_platform || 'facebook_group',
    source_post_url: raw.source_post_url || raw.postUrl || raw.url || null,
    source_post_excerpt: text ? text.slice(0, 600) : null,
    ai_score: score,
    ai_qualification_summary: summary,
    ai_icebreaker_message: icebreaker,
    subagent_captured_by: raw.subagent_captured_by || 'fb_group_intent_hunter',
    external_lead_key: raw.external_lead_key || undefined,
    apify_run_id: raw.apify_run_id || runId || null,
    lindy_task_id: raw.lindy_task_id || null,
    raw_metadata: raw.raw_metadata || (raw as Record<string, unknown>),
  };
}

async function checkUpstashRateLimit(key: string, maxRequests = 60, windowSec = 60): Promise<boolean> {
  const url = Deno.env.get('UPSTASH_REDIS_REST_URL');
  const token = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return true;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', key],
        ['EXPIRE', key, windowSec],
      ]),
    });
    if (!res.ok) return true;
    const data = (await res.json()) as Array<{ result?: number }>;
    const count = Number(data?.[0]?.result ?? 1);
    return count <= maxRequests;
  } catch {
    return true;
  }
}

async function verifyPlatformAdmin(
  adminClient: ReturnType<typeof createClient>,
  req: Request
): Promise<{ ok: boolean; userId?: string; error?: string }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return { ok: false, error: 'Cabeçalho Authorization ausente.' };
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const { data: userRes, error } = await adminClient.auth.getUser(token);
  if (error || !userRes?.user) return { ok: false, error: 'Sessão inválida ou expirada.' };

  const userId = userRes.user.id;
  const { data: adminRow } = await adminClient
    .from('platform_admins')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();

  if (!adminRow) return { ok: false, error: 'Acesso restrito a administradores da plataforma.' };
  return { ok: true, userId };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: extendedCorsHeaders });
  }

  if (req.method !== 'POST') {
    return json({ error: 'Método não permitido.' }, 405);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!supabaseUrl || !serviceKey) {
    return json({ error: 'Configuração Supabase incompleta.' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Payload JSON inválido.' }, 400);
  }

  const url = new URL(req.url);
  const action = String(url.searchParams.get('action') || body.action || 'webhook');

  // ----------------------------------------------------------------------------
  // AÇÃO 1: WEBHOOK (Lindy AI ou Apify ACTOR.RUN.SUCCEEDED)
  // ----------------------------------------------------------------------------
  if (action === 'webhook') {
    const allowed = await checkUpstashRateLimit('rl:auto-lead-webhook', 120, 60);
    if (!allowed) {
      return json({ error: 'Rate limit excedido no webhook.' }, 429);
    }

    const expectedSecret = (Deno.env.get('LINDY_WEBHOOK_SECRET') || '').trim();
    if (expectedSecret) {
      const provided =
        req.headers.get('x-auto-lead-secret') ||
        req.headers.get('x-lindy-signature') ||
        req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
        String(body.secret || '');
      if (provided !== expectedSecret) {
        return json({ error: 'Segredo de webhook inválido.' }, 401);
      }
    }

    let rawItems: RawLeadInput[] = [];
    const routineId = (body.routine_id as string | undefined) || null;
    const resource = (body.resource || {}) as Record<string, unknown>;
    const apifyDatasetId = (resource.defaultDatasetId || body.datasetId) as string | undefined;
    const apifyRunId = (resource.id || body.runId || body.apify_run_id) as string | undefined;

    if (Array.isArray(body.leads)) {
      rawItems = body.leads as RawLeadInput[];
    } else if (Array.isArray(body.items)) {
      rawItems = body.items as RawLeadInput[];
    } else if (body.lead && typeof body.lead === 'object') {
      rawItems = [body.lead as RawLeadInput];
    } else if (apifyDatasetId) {
      const apifyToken = (Deno.env.get('APIFY_API_TOKEN') || '').trim();
      if (apifyToken) {
        const dsRes = await fetch(
          `https://api.apify.com/v2/datasets/${encodeURIComponent(apifyDatasetId)}/items?token=${encodeURIComponent(apifyToken)}&limit=100`
        );
        if (dsRes.ok) {
          const dsJson = await dsRes.json();
          if (Array.isArray(dsJson)) rawItems = dsJson as RawLeadInput[];
        }
      }
    } else if (body.full_name || body.authorName || body.phone) {
      rawItems = [body as RawLeadInput];
    }

    const normalized = rawItems.map((item) => scoreAndQualifyLead(item, apifyRunId));
    const { data: runRow } = await admin
      .from('platform_auto_lead_runs')
      .insert({
        routine_id: routineId,
        run_type: apifyDatasetId ? 'apify_scrape' : 'lindy_webhook',
        subagent_stage: 'qualifying_lindy',
        status: 'running',
        external_run_id: apifyRunId || null,
        leads_found_count: normalized.length,
      })
      .select('id')
      .single();

    const { data: upsertRes, error: upsertErr } = await admin.rpc('upsert_platform_auto_leads_batch', {
      p_leads: normalized,
      p_run_id: runRow?.id || null,
      p_routine_id: routineId,
    });

    if (upsertErr) {
      await ingestToAxiom([
        { level: 'error', route: 'auto-lead-orchestrator/webhook', message: upsertErr.message },
      ]);
      return json({ error: upsertErr.message }, 500);
    }

    await ingestToAxiom([
      {
        level: 'info',
        route: 'auto-lead-orchestrator/webhook',
        message: 'Leads ingeridos via webhook Apify/Lindy',
        metadata: { upsertRes, routineId },
      },
    ]);

    return json({ success: true, result: upsertRes, run_id: runRow?.id || null });
  }

  // Demais ações exigem JWT de platform_admin
  const authCheck = await verifyPlatformAdmin(admin, req);
  if (!authCheck.ok) {
    return json({ error: authCheck.error }, 403);
  }

  // ----------------------------------------------------------------------------
  // AÇÃO 2: DISPARO ATIVO DA ROTINA DE SUBAGENTES (Apify + Lindy AI)
  // ----------------------------------------------------------------------------
  if (action === 'run_subagent_routine') {
    const routineId = (body.routine_id as string | undefined) || null;
    const apifyToken = (Deno.env.get('APIFY_API_TOKEN') || '').trim();
    const lindyWebhookUrl = (Deno.env.get('LINDY_WEBHOOK_URL') || '').trim();
    const actorId = String(body.apify_actor_id || Deno.env.get('APIFY_DEFAULT_ACTOR_ID') || 'apify/facebook-groups-scraper');

    let routineData: Record<string, unknown> | null = null;
    if (routineId) {
      const { data } = await admin
        .from('platform_auto_lead_routines')
        .select('*')
        .eq('id', routineId)
        .maybeSingle();
      routineData = data;
    }

    const targetGroups = (body.target_groups || routineData?.target_groups || []) as Array<{ name?: string; url?: string }>;
    const keywords = (body.search_keywords || routineData?.search_keywords || []) as string[];
    const forceSimulate = Boolean(body.simulate) || !apifyToken;

    const { data: runRow } = await admin
      .from('platform_auto_lead_runs')
      .insert({
        routine_id: routineId,
        run_type: 'subagent_routine',
        subagent_stage: 'extracting_apify',
        status: 'running',
        target_groups: targetGroups,
        keywords,
        triggered_by: authCheck.userId || null,
      })
      .select('id')
      .single();

    if (routineId) {
      await admin
        .from('platform_auto_lead_routines')
        .update({ last_run_status: 'running_apify', last_run_at: new Date().toISOString() })
        .eq('id', routineId);
    }

    // Modo Real: dispara Actor na API v2 do Apify com webhook para Pluri-Health ou Lindy AI
    if (!forceSimulate && apifyToken) {
      const actorPath = actorId.replace('/', '~');
      const callbackUrl = lindyWebhookUrl || `${supabaseUrl}/functions/v1/auto-lead-orchestrator?action=webhook`;
      const apifyPayload = {
        startUrls: targetGroups.filter((g) => g.url).map((g) => ({ url: g.url })),
        resultsLimit: Number(body.results_limit || 25),
        searchKeywords: keywords,
        webhooks: [
          {
            eventTypes: ['ACTOR.RUN.SUCCEEDED'],
            requestUrl: callbackUrl,
          },
        ],
      };

      const apifyRes = await fetch(
        `https://api.apify.com/v2/acts/${encodeURIComponent(actorPath)}/runs?token=${encodeURIComponent(apifyToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(apifyPayload),
        }
      );

      if (!apifyRes.ok) {
        const errText = await apifyRes.text();
        if (runRow?.id) {
          await admin
            .from('platform_auto_lead_runs')
            .update({ status: 'failed', subagent_stage: 'failed', error_message: errText, completed_at: new Date().toISOString() })
            .eq('id', runRow.id);
        }
        return json({ error: `Erro ao acionar Apify: ${errText}` }, 502);
      }

      const apifyJson = (await apifyRes.json()) as { data?: { id?: string; defaultDatasetId?: string } };
      if (runRow?.id) {
        await admin
          .from('platform_auto_lead_runs')
          .update({ external_run_id: apifyJson.data?.id || null, subagent_stage: 'cross_enriching' })
          .eq('id', runRow.id);
      }

      return json({
        success: true,
        mode: 'apify_live',
        run_id: runRow?.id || null,
        apify_run_id: apifyJson.data?.id || null,
        dataset_id: apifyJson.data?.defaultDatasetId || null,
      });
    }

    // Modo Simulação / Preview Local (sem APIFY_API_TOKEN configurado)
    const groupPrimary = targetGroups[0]?.name || 'Fisioterapia Brasil - Gestão e Clínica';
    const sampleLeads: RawLeadInput[] = [
      {
        full_name: 'Dra. Camila Nogueira',
        phone: '5511991234455',
        instagram_handle: '@camilanogueira.fisio',
        facebook_group_name: groupPrimary,
        city: 'São Paulo',
        state: 'SP',
        clinic_name: 'Clínica Movimento Pleno',
        specialty: 'Fisioterapia Ortopédica',
        icp_tier: 'clinic_owner',
        source_post_excerpt: 'Pessoal, qual sistema de prontuário e agenda vocês usam na clínica com repasse para equipe?',
        subagent_captured_by: String(routineData?.subagent_role || 'fb_group_intent_hunter'),
        ai_score: 92,
      },
      {
        full_name: 'Dr. Henrique Bastos',
        phone: '5521988776655',
        instagram_handle: '@hbastos.pilates',
        facebook_group_name: targetGroups[1]?.name || groupPrimary,
        city: 'Niterói',
        state: 'RJ',
        clinic_name: 'Studio Bastos Pilates',
        specialty: 'Pilates Clínico',
        icp_tier: 'studio_pilates',
        source_post_excerpt: 'Estou abrindo meu estúdio de pilates clínico e preciso sair das planilhas para evoluções e cobrança recorrente.',
        subagent_captured_by: 'cross_channel_enricher',
        ai_score: 85,
      },
    ];

    const enriched = sampleLeads.map((l) => scoreAndQualifyLead(l, runRow?.id));
    const { data: upsertRes, error: upsertErr } = await admin.rpc('upsert_platform_auto_leads_batch', {
      p_leads: enriched,
      p_run_id: runRow?.id || null,
      p_routine_id: routineId,
    });

    if (upsertErr) return json({ error: upsertErr.message }, 500);
    return json({ success: true, mode: 'simulated_pipeline', run_id: runRow?.id || null, result: upsertRes });
  }

  // ----------------------------------------------------------------------------
  // AÇÃO 3: SINCRONIZAÇÃO DE DATASET APIFY SOB DEMANDA
  // ----------------------------------------------------------------------------
  if (action === 'sync_dataset') {
    const datasetId = String(body.dataset_id || '').trim();
    const apifyToken = (Deno.env.get('APIFY_API_TOKEN') || '').trim();
    if (!datasetId) return json({ error: 'dataset_id é obrigatório.' }, 400);
    if (!apifyToken) return json({ error: 'APIFY_API_TOKEN não configurado no Pulumi ESC / Supabase Secrets.' }, 400);

    const dsRes = await fetch(
      `https://api.apify.com/v2/datasets/${encodeURIComponent(datasetId)}/items?token=${encodeURIComponent(apifyToken)}&limit=100`
    );
    if (!dsRes.ok) {
      return json({ error: `Falha ao ler dataset Apify (${dsRes.status}).` }, 502);
    }

    const items = (await dsRes.json()) as RawLeadInput[];
    const normalized = (Array.isArray(items) ? items : []).map((i) => scoreAndQualifyLead(i, datasetId));
    const { data: upsertRes, error: upsertErr } = await admin.rpc('upsert_platform_auto_leads_batch', {
      p_leads: normalized,
      p_run_id: null,
      p_routine_id: (body.routine_id as string | undefined) || null,
    });

    if (upsertErr) return json({ error: upsertErr.message }, 500);
    return json({ success: true, result: upsertRes });
  }

  // ----------------------------------------------------------------------------
  // AÇÃO 4: RECONCILIAÇÃO DAS 3 AGENDAS (Bot +5511960474566 + Comercial +5511980113936 + Backoffice)
  // ----------------------------------------------------------------------------
  if (action === 'sync_agendas') {
    const [{ data: leads }, { data: meetings }, { data: sessions }] = await Promise.all([
      admin.from('platform_auto_leads').select('*').is('deleted_at', null),
      admin.from('platform_onboarding_meetings').select('*').order('scheduled_at', { ascending: false }),
      admin.from('whatsapp_chat_sessions').select('*').order('last_message_at', { ascending: false }),
    ]);

    let updatedCount = 0;
    const allMeetings = meetings || [];
    const allSessions = sessions || [];

    for (const lead of leads || []) {
      const key = normalizePhoneKey(lead.phone);
      const emailLower = (lead.email || '').trim().toLowerCase();

      const matchedMeeting = allMeetings.find(
        (m: Record<string, unknown>) =>
          (key && normalizePhoneKey(String(m.phone || '')) === key) ||
          (emailLower && String(m.email || '').trim().toLowerCase() === emailLower)
      );

      if (matchedMeeting) {
        const origin = String(matchedMeeting.origin || '');
        const conf = String(matchedMeeting.confirmation_channel || '');
        const line = String(matchedMeeting.whatsapp_line || '');
        const notes = String(matchedMeeting.notes || '').toLowerCase();
        const channel =
          line === BOT_PHONE || conf.includes(BOT_PHONE) || origin.includes('bot') || notes.includes('whatsapp bot')
            ? 'whatsapp_bot_5511960474566'
            : line === COMMERCIAL_PHONE || conf.includes(COMMERCIAL_PHONE) || origin.includes('commercial') || origin.includes('comercial')
            ? 'whatsapp_commercial_5511980113936'
            : 'backoffice_agenda';

        await admin
          .from('platform_auto_leads')
          .update({
            meeting_id: matchedMeeting.id,
            meeting_status: matchedMeeting.status,
            meeting_scheduled_at: matchedMeeting.scheduled_at,
            meeting_duration_minutes: matchedMeeting.duration_minutes,
            meeting_channel: channel,
            meeting_booked_by: matchedMeeting.booked_by_name || matchedMeeting.lead_name,
          })
          .eq('id', lead.id);
        updatedCount++;
        continue;
      }

      if (key) {
        const matchedSession = allSessions.find((s: Record<string, unknown>) => normalizePhoneKey(String(s.phone || '')) === key);
        if (matchedSession && ['waiting_day', 'waiting_time', 'owner_support_menu', 'support_handoff', 'support_active'].includes(String(matchedSession.current_step || ''))) {
          const isCommercial = ['support_handoff', 'support_active'].includes(String(matchedSession.current_step));
          await admin
            .from('platform_auto_leads')
            .update({
              meeting_status: isCommercial ? 'handed_off_commercial' : 'attempted_bot',
              meeting_channel: isCommercial ? 'whatsapp_commercial_5511980113936' : 'whatsapp_bot_5511960474566',
              last_scheduling_attempt_at: matchedSession.last_message_at,
              scheduling_attempt_summary: isCommercial
                ? 'Transferido para atendimento no WhatsApp Comercial (+55 11 98011-3936).'
                : `Iniciou agendamento no Bot (+55 11 96047-4566) — etapa: ${matchedSession.current_step}`,
            })
            .eq('id', lead.id);
          updatedCount++;
        }
      }
    }

    return json({ success: true, reconciled_count: updatedCount });
  }

  return json({ error: `Ação desconhecida: ${action}` }, 400);
});
