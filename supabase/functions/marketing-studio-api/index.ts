/**
 * Edge Function: marketing-studio-api
 *
 * Responsabilidade:
 * - Gerar copies de carrosséis/posts e roteiros JSON de Reels via Gemini Tiered Router
 * - Calcular SHA-256 content-addressable para evitar re-renderizações duplicadas
 * - Enfileirar jobs em marketing_render_jobs (fast_node vs heavy_pull)
 * - Obter upload targets seguros via s3-router (Cloudflare R2 / Backblaze B2)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import { corsHeaders } from '../_shared/cors.ts';
import { converseMarketingAgent } from '../_shared/gemini-router.ts';
import { selectWritableProvider } from '../_shared/s3-router.ts';
import { checkRateLimit, rateLimitExceededResponse } from '../_shared/rate-limit.ts';
import { reportError } from '../_shared/error-dedup.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').trim();
  const serviceKey = (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!supabaseUrl || !serviceKey) return json({ error: 'Configuração Supabase ausente.' }, 500);

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  const { data: userData } = await admin.auth.getUser(token);
  if (!userData?.user) return json({ error: 'Não autenticado.' }, 401);

  const userId = userData.user.id;
  const [ownerRes, mktRes, flagRes] = await Promise.all([
    admin.rpc('is_platform_owner', { _user_id: userId }),
    admin.rpc('is_platform_marketing', { _user_id: userId }),
    admin.rpc('has_platform_flag', { _flag: 'marketing', _user_id: userId }),
  ]);
  if (!ownerRes.data && !mktRes.data && !flagRes.data) {
    return json({ error: 'Acesso restrito ao Marketing/Plataforma.' }, 403);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || 'generate_copy');

    const studioPreset =
      action === 'generate_copy'
        ? 'marketing_studio_copy'
        : action === 'enqueue_render_job'
        ? 'marketing_studio_render'
        : 'marketing_studio_upload';

    const rl = await checkRateLimit({
      preset: studioPreset,
      identifier: userId,
      service: 'marketing-studio-api',
      route: action,
    });
    if (!rl.allowed) return rateLimitExceededResponse(rl, corsHeaders);

  if (action === 'generate_copy') {
    const topic = String(body.topic || 'Prontuário SOAP rápido para fisioterapeutas').trim();
    const format = String(body.format || 'carousel');
    const ai = await converseMarketingAgent({
      modelTier: format === 'reel_video' ? 'gemini-4-hydrogen' : 'gemini-3.5-flash-lite',
      systemPrompt:
        'Você é um diretor criativo especialista em marketing para fisioterapeutas e clínicas de saúde no Brasil.',
      userMessage: `Crie um ${format === 'reel_video' ? 'roteiro curto de Reels (30s) com gancho de 3s, 3 cenas e CTA' : 'carrossel de 5 slides com título chamativo, dor clínica, solução Pluri Fisio e CTA'} sobre: ${topic}`,
      maxChars: 900,
    });

    const contentHash = await sha256Hex(`${format}:${topic}:${ai.reply}`);
    return json({
      success: true,
      content: ai.reply,
      modelUsed: ai.modelUsed,
      contentHash,
    });
  }

  if (action === 'enqueue_render_job') {
    const title = String(body.title || 'Untitled Creative');
    const formatType = String(body.format_type || 'carousel');
    const specJson = (body.spec_json || {}) as Record<string, unknown>;
    const brandKitId = body.brand_kit_id ? String(body.brand_kit_id) : null;

    const rawHashString = JSON.stringify({ title, format_type: formatType, spec_json: specJson, brand_kit_id: brandKitId });
    const contentHashSha256 = await sha256Hex(rawHashString);

    // Check existing project with same content_hash_sha256 and deleted_at IS NULL
    const { data: existing } = await admin
      .from('marketing_creative_projects')
      .select('*')
      .eq('content_hash_sha256', contentHashSha256)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      return json({ success: true, deduplicated: true, project: existing });
    }

    // Insert project
    const { data: project, err: projErr } = await admin
      .from('marketing_creative_projects')
      .insert({
        title,
        format_type: formatType,
        spec_json: specJson,
        brand_kit_id: brandKitId,
        content_hash_sha256: contentHashSha256,
        tenant_scope: 'platform',
      })
      .select()
      .single();

    if (projErr || !project) {
      return json({ error: projErr?.message || 'Falha ao criar projeto criativo.' }, 500);
    }

    const workerTier = formatType === 'reel_video' ? 'heavy_pull' : 'fast_node';
    const { data: job, err: jobErr } = await admin
      .from('marketing_render_jobs')
      .insert({
        project_id: project.id,
        worker_tier: workerTier,
        status: 'queued',
        payload_json: { title, format_type: formatType, spec_json: specJson },
        tenant_scope: 'platform',
      })
      .select()
      .single();

    if (jobErr || !job) {
      return json({ error: jobErr?.message || 'Falha ao enfileirar job de renderização.' }, 500);
    }

    return json({ success: true, deduplicated: false, project, job });
  }

  if (action === 'get_upload_target') {
    const bytes = Number(body.bytes || 0);
    const preferredProvider = String(body.preferred_provider || 'r2');

    try {
      const target = await selectWritableProvider(admin, bytes, preferredProvider);
      return json({
        configured: target.configured,
        provider_key: target.provider_key,
        bucket: target.bucket,
        endpoint: target.endpoint,
        region: target.region,
        object_key: target.object_key,
      });
    } catch (err) {
      return json({
        configured: false,
        provider_key: preferredProvider,
        bucket: '',
        endpoint: '',
        region: '',
        object_key: '',
        error: String(err?.message || err),
      });
    }
  }

  return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await reportError({
      service: 'marketing-studio-api',
      level: 'critical',
      code: 'edge_unhandled_500',
      route: 'marketing-studio-api',
      message,
      stack: err instanceof Error ? err.stack : undefined,
      metadata: { user_id: userId },
    });
    return json({ error: message || 'Erro interno no Marketing Studio API.' }, 500);
  }
});
