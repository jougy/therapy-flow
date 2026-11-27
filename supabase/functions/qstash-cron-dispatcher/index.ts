/**
 * Edge Function: qstash-cron-dispatcher
 *
 * Responsável por rotinas periódicas externas (fora do Postgres):
 * - synthetic_healthcheck: valida Postgres, Upstash Redis, Axiom e Asaas; alerta em caso de falha.
 * - daily_admin_digest: envia resumo executivo das últimas 24h no Telegram + E-mail.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyQStashSignature } from '../_shared/qstash.ts';
import { ingestToAxiom } from '../_shared/telemetry-axiom.ts';
import { dispatchAdminErrorAlert } from '../_shared/error-alert.ts';
import { TelegramClient } from '../_shared/telegram-client.ts';
import { ResendClient } from '../_shared/resend-client.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

async function authorizeRequest(req: Request, rawBody: string, serviceRoleKey: string): Promise<boolean> {
  const authHeader = req.headers.get('Authorization') || '';
  const bearer = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (serviceRoleKey && bearer === serviceRoleKey) return true;

  const supabaseUrl = (Deno.env.get('SUPABASE_URL') || '').replace(/\/+$/, '');
  const expectedUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/qstash-cron-dispatcher` : undefined;
  const sig = await verifyQStashSignature(req, rawBody, expectedUrl);
  return sig.valid;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const rawBody = await req.text();

  const authorized = await authorizeRequest(req, rawBody, serviceRoleKey);
  if (!authorized) {
    return json({ error: 'Unauthorized: invalid QStash signature or service_role' }, 401);
  }

  let body: Record<string, unknown> = {};
  try {
    body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
  } catch {
    body = {};
  }

  const action = String(body.action || 'synthetic_healthcheck');
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (action === 'synthetic_healthcheck') {
    const checks: Record<string, { ok: boolean; latencyMs: number; detail?: string }> = {};

    // 1. Postgres DB
    const dbStart = Date.now();
    try {
      const { error } = await admin.from('platform_feature_flags').select('key').limit(1);
      checks.postgres = { ok: !error, latencyMs: Date.now() - dbStart, ...(error ? { detail: error.message } : {}) };
    } catch (e) {
      checks.postgres = { ok: false, latencyMs: Date.now() - dbStart, detail: e instanceof Error ? e.message : String(e) };
    }

    // 2. Upstash Redis
    const redisUrl = (Deno.env.get('UPSTASH_REDIS_REST_URL') || '').replace(/\/+$/, '');
    const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || '';
    const rdStart = Date.now();
    if (redisUrl && redisToken) {
      try {
        const res = await fetch(`${redisUrl}/ping`, {
          headers: { Authorization: `Bearer ${redisToken}` },
          signal: AbortSignal.timeout(3000),
        });
        checks.upstash_redis = { ok: res.ok, latencyMs: Date.now() - rdStart, ...(!res.ok ? { detail: `HTTP ${res.status}` } : {}) };
      } catch (e) {
        checks.upstash_redis = { ok: false, latencyMs: Date.now() - rdStart, detail: e instanceof Error ? e.message : String(e) };
      }
    }

    // 3. Axiom API
    const axiomToken = Deno.env.get('AXIOM_TOKEN') || '';
    const axStart = Date.now();
    if (axiomToken) {
      try {
        const res = await fetch('https://api.axiom.co/v1/datasets', {
          headers: { Authorization: `Bearer ${axiomToken}` },
          signal: AbortSignal.timeout(3000),
        });
        checks.axiom = { ok: res.ok, latencyMs: Date.now() - axStart, ...(!res.ok ? { detail: `HTTP ${res.status}` } : {}) };
      } catch (e) {
        checks.axiom = { ok: false, latencyMs: Date.now() - axStart, detail: e instanceof Error ? e.message : String(e) };
      }
    }

    const failed = Object.entries(checks).filter(([, c]) => !c.ok);
    if (failed.length > 0) {
      await dispatchAdminErrorAlert({
        fingerprint: `healthcheck:${failed.map(([k]) => k).join(',')}`,
        level: 'critical',
        service: 'qstash-cron-dispatcher',
        route: 'synthetic_healthcheck',
        code: 'HEALTHCHECK_FAILED',
        message: `Falha no Healthcheck Sintético: ${failed.map(([k, v]) => `${k} (${v.detail || 'down'})`).join(', ')}`,
        metadata: { checks },
      });
    }

    await ingestToAxiom([
      {
        level: failed.length > 0 ? 'error' : 'info',
        service: 'qstash-cron-dispatcher',
        route: 'synthetic_healthcheck',
        message: failed.length > 0 ? 'Synthetic healthcheck degraded' : 'Synthetic healthcheck healthy',
        metadata: { checks },
      },
    ]);

    return json({ ok: failed.length === 0, checks });
  }

  if (action === 'daily_admin_digest') {
    const sinceIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const dateKey = new Date().toISOString().slice(0, 10);

    const [clinicsRes, activeSubsRes, paidInvoicesRes] = await Promise.all([
      admin.from('clinics').select('id', { count: 'exact', head: true }).gte('created_at', sinceIso),
      admin.from('clinic_subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'ACTIVE'),
      admin.from('subscription_invoices').select('id', { count: 'exact', head: true }).eq('status', 'RECEIVED').gte('paid_at', sinceIso),
    ]);

    let qstashPublishedToday = 0;
    let qstashDlqToday = 0;
    const redisUrl = (Deno.env.get('UPSTASH_REDIS_REST_URL') || '').replace(/\/+$/, '');
    const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN') || '';
    if (redisUrl && redisToken) {
      try {
        const res = await fetch(`${redisUrl}/pipeline`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${redisToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify([
            ['GET', `metrics:qstash:published:${dateKey}`],
            ['GET', `metrics:qstash:dlq:${dateKey}`],
          ]),
          signal: AbortSignal.timeout(2500),
        });
        if (res.ok) {
          const data = (await res.json()) as Array<{ result: unknown }>;
          qstashPublishedToday = Number(data?.[0]?.result ?? 0);
          qstashDlqToday = Number(data?.[1]?.result ?? 0);
        }
      } catch {
        // segue sem travar digest
      }
    }

    const summaryHtml =
      `📊 <b>Pluri-Health — Digest Diário (24h)</b>\n\n` +
      `🏥 Novas clínicas (24h): <b>${clinicsRes.count ?? 0}</b>\n` +
      `✅ Assinaturas ativas: <b>${activeSubsRes.count ?? 0}</b>\n` +
      `💰 Faturas pagas (24h): <b>${paidInvoicesRes.count ?? 0}</b>\n` +
      `⚡ QStash hoje: <b>${qstashPublishedToday}/1000</b> msgs | DLQ: <b>${qstashDlqToday}</b>`;

    const tg = new TelegramClient();
    const resend = new ResendClient();
    await Promise.allSettled([
      tg.sendMessage(summaryHtml),
      resend.sendEmail({
        to: Deno.env.get('ADMIN_ALERT_EMAIL') || 'jougy@gmx.com',
        subject: `Pluri-Health Digest Diário (${dateKey})`,
        html: `<div style="font-family:sans-serif;line-height:1.6">${summaryHtml.replace(/\n/g, '<br/>')}</div>`,
      }),
    ]);

    return json({ ok: true, dateKey, qstashPublishedToday, qstashDlqToday });
  }

  return json({ error: `Ação desconhecida: ${action}` }, 400);
});
