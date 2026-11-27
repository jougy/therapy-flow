/**
 * Edge Function: qstash-zap-worker
 *
 * Consumidor FIFO (Queue `zap-outbound-platform`, parallelism=1) anti-ban:
 * - dispatch_campaign_message: valida status `queued`, circuit_breaker e opt-out antes de enviar.
 * - execute_group_job: processa `marketing_group_jobs` (`broadcast_group`, `add_participants`, `remove_participants`).
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.99.2';
import { corsHeaders } from '../_shared/cors.ts';
import { verifyQStashSignature } from '../_shared/qstash.ts';
import { normalizePhoneBr } from '../_shared/marketing-zap/llmAndDiagnosticsHandlers.ts';
import { reportError } from '../_shared/error-dedup.ts';

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
  const expectedUrl = supabaseUrl ? `${supabaseUrl}/functions/v1/qstash-zap-worker` : undefined;
  const sig = await verifyQStashSignature(req, rawBody, expectedUrl);
  return sig.valid;
}

async function callEvolution(path: string, body: unknown) {
  const baseUrl = (Deno.env.get('EVOLUTION_API_URL') || '').trim().replace(/\/+$/, '');
  const apiKey = (Deno.env.get('EVOLUTION_API_KEY') || '').trim();
  if (!baseUrl || !apiKey) return { ok: false, status: 503, data: { error: 'Evolution API não configurada' } };

  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { apikey: apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const rawBody = await req.text();

  if (!(await authorizeRequest(req, rawBody, serviceRoleKey))) {
    return json({ error: 'Unauthorized: invalid QStash signature' }, 401);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    const action = String(body.action || '');

    if (action === 'dispatch_campaign_message') {
      const idempotencyKey = String(body.idempotency_key || '');
      if (!idempotencyKey) return json({ error: 'idempotency_key obrigatório' }, 400);

      const { data: dispatch } = await admin
        .from('marketing_zap_dispatches')
        .select('*')
        .eq('idempotency_key', idempotencyKey)
        .maybeSingle();

      if (!dispatch || dispatch.status !== 'queued') {
        return json({ ok: true, skipped: true, reason: dispatch?.status || 'not_found' });
      }

      const phone = normalizePhoneBr(dispatch.phone_e164);
      const [{ data: instance }, { data: optOut }] = await Promise.all([
        admin.from('marketing_whatsapp_instances').select('*').eq('id', dispatch.instance_id).maybeSingle(),
        phone ? admin.from('marketing_opt_outs').select('id').eq('phone_e164', phone).maybeSingle() : Promise.resolve({ data: null }),
      ]);

      if (optOut) {
        await admin.from('marketing_zap_dispatches').update({ status: 'blocked_optout' }).eq('id', dispatch.id);
        return json({ ok: true, blocked: 'opt_out' });
      }

      if (!instance || instance.status === 'circuit_broken') {
        await admin.from('marketing_zap_dispatches').update({ status: 'paused_circuit_breaker' }).eq('id', dispatch.id);
        return json({ ok: true, paused: 'circuit_breaker' });
      }

      const instanceKey = String(instance.instance_key || 'pluri-mkt-5511965120431');
      const sendRes = await callEvolution(`/message/sendText/${encodeURIComponent(instanceKey)}`, {
        number: phone,
        text: dispatch.rendered_body,
      });

      if (!sendRes.ok) {
        await admin.from('marketing_zap_dispatches').update({ status: 'failed', error_message: JSON.stringify(sendRes.data).slice(0, 250) }).eq('id', dispatch.id);
        return json({ ok: false, status: sendRes.status }, 502);
      }

      await Promise.all([
        admin.from('marketing_zap_dispatches').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', dispatch.id),
        admin.from('marketing_whatsapp_instances').update({ daily_sent_count: Number(instance.daily_sent_count ?? 0) + 1 }).eq('id', instance.id),
      ]);

      return json({ ok: true, sent: true, idempotencyKey });
    }

    if (action === 'execute_group_job') {
      const jobId = String(body.job_id || '');
      if (!jobId) return json({ error: 'job_id obrigatório' }, 400);

      const { data: job } = await admin.from('marketing_group_jobs').select('*').eq('id', jobId).maybeSingle();
      if (!job || job.status !== 'queued') {
        return json({ ok: true, skipped: true, reason: job?.status || 'not_found' });
      }

      const { data: instance } = await admin.from('marketing_whatsapp_instances').select('*').eq('id', job.instance_id).maybeSingle();
      if (!instance || instance.status === 'circuit_broken') {
        await admin.from('marketing_group_jobs').update({ status: 'paused_circuit_breaker' }).eq('id', job.id);
        return json({ ok: true, paused: 'circuit_breaker' });
      }

      const instanceKey = String(instance.instance_key || 'pluri-mkt-5511965120431');
      const payload = (job.payload || {}) as Record<string, unknown>;
      let res = { ok: true, status: 200, data: {} as Record<string, unknown> };

      if (job.job_type === 'broadcast_group') {
        res = await callEvolution(`/message/sendText/${encodeURIComponent(instanceKey)}`, {
          number: job.group_jid,
          text: String(payload.message || ''),
        });
      } else if (job.job_type === 'add_participants' || job.job_type === 'remove_participants') {
        const evoAction = job.job_type === 'add_participants' ? 'add' : 'remove';
        res = await callEvolution(`/group/updateParticipant/${encodeURIComponent(instanceKey)}`, {
          groupJid: job.group_jid,
          action: evoAction,
          participants: Array.isArray(payload.participants) ? payload.participants : [],
        });
      }

      if (!res.ok) {
        await admin.from('marketing_group_jobs').update({ status: 'failed' }).eq('id', job.id);
        return json({ ok: false, status: res.status }, 502);
      }

      await admin.from('marketing_group_jobs').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', job.id);
      return json({ ok: true, jobId });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await reportError({
      service: 'qstash-zap-worker',
      level: 'error',
      code: 'qstash_zap_worker_error',
      route: 'qstash-zap-worker',
      message,
    });
    return json({ error: message }, 500);
  }
});
