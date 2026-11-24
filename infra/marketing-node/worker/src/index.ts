import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Queue, Worker, type Job } from 'bullmq';
import { timingSafeEqual } from 'node:crypto';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import { Redis } from 'ioredis';
import { sendAudioPtt } from './lib/audioPtt.js';
import { verifyPayloadHmac } from './lib/hmac.js';
import { MultiChipRouter, type RouterInstanceRecord } from './lib/multiChipRouter.js';
import { executeWarmupJob, planWarmupSessionsForPool } from './lib/warmupScheduler.js';

const PORT = Number(process.env.WORKER_PORT || 8086);
const REDIS_URL = (process.env.REDIS_URL || 'redis://127.0.0.1:6379/0').trim();
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || 'http://127.0.0.1:8085').trim().replace(/\/+$/, '');
const EVOLUTION_API_KEY = (process.env.EVOLUTION_API_KEY || '').trim();
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const WORKER_SHARED_SECRET = (process.env.WORKER_SHARED_SECRET || '').trim();
const POLL_INTERVAL_MS = 15_000;

const QUEUE_NAMES = ['zap-dispatch', 'zap-filter', 'zap-groups', 'zap-warmup', 'zap-flows'] as const;
type QueueName = (typeof QUEUE_NAMES)[number];

function emitLog(level: 'info' | 'warn' | 'error', event: string, meta?: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, service: 'pluri-marketing-worker', event, ...meta });
  if (level === 'error') process.stderr.write(`${line}\n`);
  else process.stdout.write(`${line}\n`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeSecretEquals(provided: string, expected: string): boolean {
  if (!expected || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function evoRequest(
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  body?: unknown,
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${EVOLUTION_API_URL}${path}`, {
    method,
    headers: { apikey: EVOLUTION_API_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { ok: res.ok, status: res.status, data };
}

function isWithinBusinessWindow(antiBan: Record<string, unknown> | null | undefined): boolean {
  const startStr = String(antiBan?.business_start || '08:30');
  const endStr = String(antiBan?.business_end || '19:30');
  const allowedDays = Array.isArray(antiBan?.business_days) ? (antiBan.business_days as number[]) : [1, 2, 3, 4, 5, 6];
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());

  const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const weekday = dayMap[parts.find((p) => p.type === 'weekday')?.value || 'Mon'] ?? 1;
  if (!allowedDays.includes(weekday)) return false;

  const hh = Number(parts.find((p) => p.type === 'hour')?.value || 12);
  const mm = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  const nowMinutes = hh * 60 + mm;
  const [sh, sm] = startStr.split(':').map(Number);
  const [eh, em] = endStr.split(':').map(Number);
  const startMin = (Number.isFinite(sh) ? sh : 8) * 60 + (Number.isFinite(sm) ? sm : 30);
  const endMin = (Number.isFinite(eh) ? eh : 19) * 60 + (Number.isFinite(em) ? em : 30);
  return nowMinutes >= startMin && nowMinutes <= endMin;
}

const supabase: SupabaseClient | null =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    : null;

const redisConnection = new Redis(REDIS_URL, { maxRetriesPerRequest: null, enableReadyCheck: false });
const router = new MultiChipRouter();
const queues = new Map<QueueName, Queue>();
for (const name of QUEUE_NAMES) {
  queues.set(name, new Queue(name, { connection: redisConnection, defaultJobOptions: { removeOnComplete: 200, removeOnFail: 200 } }));
}

async function handleDispatchJob(job: Job<Record<string, unknown>>): Promise<void> {
  if (!supabase) return;
  const dispatchId = String(job.data.dispatchId || job.id || '');
  if (!dispatchId) return;

  const { data: dispatch } = await supabase
    .from('marketing_zap_dispatches')
    .select('id, campaign_id, instance_id, phone_e164, status, rendered_body')
    .eq('id', dispatchId)
    .maybeSingle();

  if (!dispatch || dispatch.status !== 'queued') return;

  const { data: campaign } = await supabase
    .from('marketing_zap_campaigns')
    .select('id, instance_id, instance_pool_ids, media_payload, active_hours_window, sent_count, failed_count, status')
    .eq('id', dispatch.campaign_id)
    .maybeSingle();

  if (!campaign || campaign.status === 'paused' || campaign.status === 'circuit_broken') return;

  const { data: optOut } = await supabase
    .from('marketing_opt_outs')
    .select('id')
    .eq('phone_e164', dispatch.phone_e164)
    .limit(1)
    .maybeSingle();

  if (optOut) {
    await supabase.from('marketing_zap_dispatches').update({ status: 'blocked_optout', error_message: 'LGPD opt-out' }).eq('id', dispatch.id);
    return;
  }

  const poolIds = Array.isArray(campaign.instance_pool_ids) && campaign.instance_pool_ids.length > 0
    ? (campaign.instance_pool_ids as string[])
    : [String(dispatch.instance_id || campaign.instance_id || '')].filter(Boolean);

  const pool = await router.loadPoolInstances(supabase, poolIds);
  const chosen: RouterInstanceRecord | null = router.pickInstanceForLead(pool, `${campaign.id}:${dispatch.phone_e164}`);
  if (!chosen) {
    await supabase.from('marketing_zap_dispatches').update({ status: 'failed', error_message: 'Nenhum chip conectado ou com cota disponível.' }).eq('id', dispatch.id);
    return;
  }

  const antiBan = (chosen.anti_ban_config || campaign.active_hours_window || {}) as Record<string, unknown>;
  if (!isWithinBusinessWindow(antiBan) && job.data.ignoreBusinessHours !== true) {
    const retryAt = new Date(Date.now() + 15 * 60_000).toISOString();
    await supabase.from('marketing_zap_dispatches').update({ scheduled_for: retryAt }).eq('id', dispatch.id);
    return;
  }

  await supabase.from('marketing_zap_dispatches').update({ status: 'sending', instance_id: chosen.id }).eq('id', dispatch.id);

  const mediaPayload = ((job.data.mediaPayload || campaign.media_payload || {}) as Record<string, unknown>);
  const mediaType = String(mediaPayload.type || '');
  let sendOk = false;
  let sendErr: string | undefined;

  if (mediaType === 'audio_ptt' && (mediaPayload.url || mediaPayload.base64)) {
    const ptt = await sendAudioPtt({
      evolutionBaseUrl: EVOLUTION_API_URL,
      evolutionApiKey: EVOLUTION_API_KEY,
      instanceKey: chosen.instance_key,
      phoneE164: dispatch.phone_e164,
      audioUrl: mediaPayload.url ? String(mediaPayload.url) : undefined,
      audioBase64: mediaPayload.base64 ? String(mediaPayload.base64) : undefined,
      simulateRecording: true,
    });
    sendOk = ptt.ok;
    sendErr = ptt.error;
  } else if (mediaType && mediaPayload.url) {
    const mediaRes = await evoRequest(`/message/sendMedia/${encodeURIComponent(chosen.instance_key)}`, 'POST', {
      number: dispatch.phone_e164,
      mediatype: mediaType,
      media: String(mediaPayload.url),
      caption: String(mediaPayload.caption || dispatch.rendered_body || ''),
      fileName: mediaPayload.fileName ? String(mediaPayload.fileName) : undefined,
    });
    sendOk = mediaRes.ok;
    sendErr = mediaRes.ok ? undefined : String(mediaRes.data.message || `HTTP ${mediaRes.status}`);
  } else {
    if (antiBan.presence_typing !== false) {
      await evoRequest(`/chat/sendPresence/${encodeURIComponent(chosen.instance_key)}`, 'POST', {
        number: dispatch.phone_e164,
        presence: 'composing',
        delay: 1400,
      }).catch(() => undefined);
      await sleep(1200);
    }
    const textRes = await evoRequest(`/message/sendText/${encodeURIComponent(chosen.instance_key)}`, 'POST', {
      number: dispatch.phone_e164,
      text: dispatch.rendered_body,
      delay: 800,
    });
    sendOk = textRes.ok;
    sendErr = textRes.ok ? undefined : String(textRes.data.message || `HTTP ${textRes.status}`);
  }

  await supabase.from('marketing_zap_dispatches').update({
    status: sendOk ? 'sent' : 'failed',
    sent_at: sendOk ? new Date().toISOString() : null,
    error_message: sendOk ? null : (sendErr || 'Dispatch failed').slice(0, 500),
  }).eq('id', dispatch.id);

  await supabase.from('marketing_zap_campaigns').update({
    sent_count: sendOk ? Number(campaign.sent_count || 0) + 1 : Number(campaign.sent_count || 0),
    failed_count: sendOk ? Number(campaign.failed_count || 0) : Number(campaign.failed_count || 0) + 1,
  }).eq('id', campaign.id);

  const outcome = await router.recordDispatchOutcome(supabase, chosen, sendOk, sendErr);
  emitLog(sendOk ? 'info' : 'warn', 'dispatch_processed', { dispatchId, instanceKey: chosen.instance_key, ok: sendOk, trippedBreaker: outcome.trippedCircuitBreaker });
}

async function handleFilterJob(job: Job<Record<string, unknown>>): Promise<void> {
  if (!supabase) return;
  const instanceKey = String(job.data.instanceKey || '');
  const phones = Array.isArray(job.data.phones) ? (job.data.phones as string[]).filter(Boolean) : [];
  if (!instanceKey || phones.length === 0) return;

  const tenantScope = String(job.data.tenantScope || 'platform');
  const clinicId = job.data.clinicId ? String(job.data.clinicId) : null;
  const instanceId = job.data.instanceId ? String(job.data.instanceId) : null;
  const listId = job.data.listId ? String(job.data.listId) : null;

  for (let i = 0; i < phones.length; i += 50) {
    const batch = phones.slice(i, i + 50);
    const res = await evoRequest(`/chat/whatsappNumbers/${encodeURIComponent(instanceKey)}`, 'POST', { numbers: batch });
    if (!res.ok) continue;
    const rows = Array.isArray(res.data) ? res.data : (Array.isArray(res.data.response) ? res.data.response : []);
    const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString();

    for (const rawItem of rows as Array<Record<string, unknown>>) {
      const phone = String(rawItem.number || rawItem.jid || '').replace(/\D/g, '');
      if (!phone) continue;
      const exists = Boolean(rawItem.exists);
      const scopedClinicId = tenantScope === 'clinic' ? clinicId : null;
      const payload = {
        tenant_scope: tenantScope,
        clinic_id: scopedClinicId,
        phone_e164: phone,
        exists_on_whatsapp: exists,
        whatsapp_jid: rawItem.jid ? String(rawItem.jid) : null,
        verified_name: rawItem.name ? String(rawItem.name) : null,
        checked_by_instance_id: instanceId,
        checked_at: new Date().toISOString(),
        expires_at: expiresAt,
      };
      const existingQuery = supabase
        .from('marketing_number_validations')
        .select('id')
        .eq('tenant_scope', tenantScope)
        .eq('phone_e164', phone);
      const { data: existing } = scopedClinicId
        ? await existingQuery.eq('clinic_id', scopedClinicId).maybeSingle()
        : await existingQuery.is('clinic_id', null).maybeSingle();

      if (existing?.id) {
        await supabase.from('marketing_number_validations').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('marketing_number_validations').insert(payload);
      }

      if (listId) {
        await supabase.from('marketing_audience_contacts').update({ validation_status: exists ? 'valid' : 'invalid' }).eq('list_id', listId).eq('phone_e164', phone);
      }
    }
    if (i + 50 < phones.length) await sleep(1500);
  }
  emitLog('info', 'turbo_filter_completed', { instanceKey, count: phones.length });
}

async function handleGroupJob(job: Job<Record<string, unknown>>): Promise<void> {
  if (!supabase) return;
  const jobId = String(job.data.groupJobId || job.id || '');
  if (!jobId) return;

  const { data: gJob } = await supabase.from('marketing_group_jobs').select('*').eq('id', jobId).maybeSingle();
  if (!gJob || gJob.status !== 'queued') return;

  const { data: inst } = await supabase.from('marketing_whatsapp_instances').select('instance_key, status').eq('id', gJob.instance_id).maybeSingle();
  if (!inst || inst.status !== 'connected') {
    await supabase.from('marketing_group_jobs').update({ status: 'failed', result_summary: { error: 'Instance disconnected' } }).eq('id', gJob.id);
    return;
  }

  await supabase.from('marketing_group_jobs').update({ status: 'running' }).eq('id', gJob.id);
  const payload = (gJob.payload || {}) as Record<string, unknown>;
  const participants = Array.isArray(payload.participants) ? (payload.participants as string[]) : [];
  let summary: Record<string, unknown> = {};
  let ok = true;

  if (gJob.job_type === 'extract_members') {
    const res = await evoRequest(`/group/participants/${encodeURIComponent(inst.instance_key)}?groupJid=${encodeURIComponent(gJob.group_jid)}`, 'GET');
    ok = res.ok;
    const members = Array.isArray(res.data.participants) ? res.data.participants : [];
    summary = { extractedCount: members.length };
  } else if (gJob.job_type === 'broadcast_group') {
    const res = await evoRequest(`/message/sendText/${encodeURIComponent(inst.instance_key)}`, 'POST', {
      number: gJob.group_jid,
      text: String(payload.message || ''),
      delay: 1500,
    });
    ok = res.ok;
    summary = { broadcasted: res.ok, status: res.status };
  } else {
    const action = gJob.job_type === 'add_participants' ? 'add' : 'remove';
    let processed = 0;
    for (let i = 0; i < participants.length; i += 3) {
      const chunk = participants.slice(i, i + 3);
      const res = await evoRequest(`/group/updateParticipant/${encodeURIComponent(inst.instance_key)}?groupJid=${encodeURIComponent(gJob.group_jid)}`, 'PUT', {
        action,
        participants: chunk,
      });
      if (res.ok) processed += chunk.length;
      if (i + 3 < participants.length) await sleep(3500 + Math.floor(Math.random() * 5000));
    }
    summary = { action, requested: participants.length, processed };
  }

  await supabase.from('marketing_group_jobs').update({
    status: ok ? 'completed' : 'failed',
    result_summary: summary,
    completed_at: new Date().toISOString(),
  }).eq('id', gJob.id);
  emitLog('info', 'group_job_finished', { jobId: gJob.id, type: gJob.job_type, ok });
}

async function handleWarmupJob(job: Job<Record<string, unknown>>): Promise<void> {
  if (!supabase) return;
  if (job.data.poolId && !job.data.sessionId) {
    const plan = await planWarmupSessionsForPool(supabase, String(job.data.poolId));
    emitLog('info', 'warmup_pool_planned', { poolId: job.data.poolId, planned: plan.planned });
    return;
  }
  const sessionId = String(job.data.sessionId || job.id || '');
  if (!sessionId) return;
  const result = await executeWarmupJob(supabase, { baseUrl: EVOLUTION_API_URL, apiKey: EVOLUTION_API_KEY }, { sessionId });
  emitLog('info', 'warmup_session_executed', { sessionId, status: result.status });
}

async function handleFlowJob(job: Job<Record<string, unknown>>): Promise<void> {
  const { flowRunId, nodeId, webhookUrl, instanceKey, phoneE164, messageText, audioUrl } = job.data as Record<string, unknown>;
  if (audioUrl && instanceKey && phoneE164) {
    await sendAudioPtt({
      evolutionBaseUrl: EVOLUTION_API_URL,
      evolutionApiKey: EVOLUTION_API_KEY,
      instanceKey: String(instanceKey),
      phoneE164: String(phoneE164),
      audioUrl: String(audioUrl),
      simulateRecording: true,
    });
  } else if (messageText && instanceKey && phoneE164) {
    await evoRequest(`/message/sendText/${encodeURIComponent(String(instanceKey))}`, 'POST', {
      number: String(phoneE164),
      text: String(messageText),
      delay: 1000,
    });
  }
  if (webhookUrl) {
    await fetch(String(webhookUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flowRunId, nodeId, payload: job.data }),
      signal: AbortSignal.timeout(12_000),
    }).catch(() => undefined);
  }
  if (supabase && flowRunId) {
    await supabase.from('marketing_flow_runs').update({
      current_node_id: nodeId ? String(nodeId) : null,
      status: job.data.markCompleted ? 'completed' : 'running',
      finished_at: job.data.markCompleted ? new Date().toISOString() : null,
    }).eq('id', String(flowRunId));
  }
  emitLog('info', 'flow_step_executed', { flowRunId, nodeId });
}

const workers = [
  new Worker('zap-dispatch', handleDispatchJob, { connection: redisConnection, concurrency: 2 }),
  new Worker('zap-filter', handleFilterJob, { connection: redisConnection, concurrency: 2 }),
  new Worker('zap-groups', handleGroupJob, { connection: redisConnection, concurrency: 1 }),
  new Worker('zap-warmup', handleWarmupJob, { connection: redisConnection, concurrency: 2 }),
  new Worker('zap-flows', handleFlowJob, { connection: redisConnection, concurrency: 3 }),
];
for (const w of workers) {
  w.on('failed', (job, err) => emitLog('error', 'worker_job_failed', { queue: w.name, jobId: job?.id, error: err.message }));
}

let isPolling = false;
async function pollDueRows(): Promise<void> {
  if (!supabase || isPolling) return;
  isPolling = true;
  const nowIso = new Date().toISOString();
  try {
    const [{ data: dispatches }, { data: groupJobs }, { data: warmups }] = await Promise.all([
      supabase.from('marketing_zap_dispatches').select('id').eq('status', 'queued').lte('scheduled_for', nowIso).order('scheduled_for', { ascending: true }).limit(25),
      supabase.from('marketing_group_jobs').select('id').eq('status', 'queued').lte('scheduled_for', nowIso).order('scheduled_for', { ascending: true }).limit(10),
      supabase.from('marketing_warmup_sessions').select('id').eq('status', 'queued').lte('scheduled_for', nowIso).order('scheduled_for', { ascending: true }).limit(10),
    ]);

    const dispatchQ = queues.get('zap-dispatch');
    const groupQ = queues.get('zap-groups');
    const warmupQ = queues.get('zap-warmup');

    await Promise.all([
      ...(dispatches || []).map((row) => dispatchQ?.add('dispatch', { dispatchId: row.id }, { jobId: `dispatch-${row.id}` })),
      ...(groupJobs || []).map((row) => groupQ?.add('group-job', { groupJobId: row.id }, { jobId: `group-${row.id}` })),
      ...(warmups || []).map((row) => warmupQ?.add('warmup', { sessionId: row.id }, { jobId: `warmup-${row.id}` })),
    ]);
  } catch (err) {
    emitLog('warn', 'poll_error', { error: err instanceof Error ? err.message : 'Poll failure' });
  } finally {
    isPolling = false;
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readRawBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8').trim();
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
  if (req.method === 'GET' && reqUrl.pathname === '/health') {
    return writeJson(res, 200, {
      ok: true,
      service: 'pluri-marketing-worker',
      redisStatus: redisConnection.status,
      supabaseConfigured: Boolean(supabase),
      stickyRouterEntries: router.getStickyMapSize(),
      queues: [...QUEUE_NAMES],
    });
  }

  if (req.method === 'POST' && reqUrl.pathname === '/enqueue') {
    const headerSecret = String(req.headers['x-worker-secret'] || '').trim() || String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    let rawBody = '';
    try {
      rawBody = await readRawBody(req);
    } catch {
      return writeJson(res, 400, { error: 'Failed to read request body' });
    }

    const isSecretValid = Boolean(WORKER_SHARED_SECRET && safeSecretEquals(headerSecret, WORKER_SHARED_SECRET));
    const isHmacValid = Boolean(
      WORKER_SHARED_SECRET &&
      verifyPayloadHmac(
        rawBody,
        String(req.headers['x-pluri-signature'] || ''),
        String(req.headers['x-pluri-timestamp'] || ''),
        WORKER_SHARED_SECRET
      )
    );

    if (!WORKER_SHARED_SECRET || (!isSecretValid && !isHmacValid)) {
      return writeJson(res, 401, { error: 'Unauthorized worker secret or signature' });
    }

    try {
      const body = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
      const queueName = String(body.queue || '') as QueueName;
      const queue = queues.get(queueName);
      if (!queue) return writeJson(res, 400, { error: `Unknown queue: ${queueName}` });
      const data = (body.data && typeof body.data === 'object' ? body.data : {}) as Record<string, unknown>;
      const delay = Math.max(0, Number(body.delayMs || 0));
      const jobId = body.jobId ? String(body.jobId) : undefined;
      const added = await queue.add(String(body.name || 'job'), data, { delay, jobId });
      return writeJson(res, 202, { ok: true, queue: queueName, jobId: added.id });
    } catch (err) {
      return writeJson(res, 400, { error: err instanceof Error ? err.message : 'Invalid JSON payload' });
    }
  }

  writeJson(res, 404, { error: 'Not found' });
});

const pollTimer = setInterval(() => void pollDueRows(), POLL_INTERVAL_MS);
server.listen(PORT, '0.0.0.0', () => {
  emitLog('info', 'worker_started', { port: PORT, supabaseConfigured: Boolean(supabase), queues: [...QUEUE_NAMES] });
  void pollDueRows();
});

async function shutdown(signal: string): Promise<void> {
  emitLog('info', 'worker_shutting_down', { signal });
  clearInterval(pollTimer);
  server.close();
  await Promise.all(workers.map((w) => w.close()));
  await Promise.all([...queues.values()].map((q) => q.close()));
  await redisConnection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
