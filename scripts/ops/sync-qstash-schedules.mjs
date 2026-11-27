#!/usr/bin/env node
/**
 * IaC Idempotente para Upstash QStash (Schedules + Queues).
 * Uso:
 *   node scripts/ops/sync-qstash-schedules.mjs --dry-run
 *   pulumi env run joao-tdoval-gmail-com-org/plurihealth/pluri-prod -- node scripts/ops/sync-qstash-schedules.mjs
 */

const isDryRun = process.argv.includes('--dry-run');
const qstashUrl = (process.env.QSTASH_URL || 'https://qstash.upstash.io').replace(/\/+$/, '');
const qstashToken = process.env.QSTASH_TOKEN || '';
const supabaseUrl = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://ggytwbnintrftgzvjczs.supabase.co').replace(/\/+$/, '');

const QUEUES = [
  { name: 'asaas-side-effects', parallelism: 2 },
  { name: 'notifications-reliable', parallelism: 2 },
  { name: 'zap-outbound-platform', parallelism: 1 },
];

const SCHEDULES = [
  {
    scheduleId: 'observability-healthcheck',
    destination: `${supabaseUrl}/functions/v1/qstash-cron-dispatcher`,
    cron: '*/30 * * * *',
    body: { action: 'synthetic_healthcheck' },
    retries: 2,
  },
  {
    scheduleId: 'agenda-reminders-hourly',
    destination: `${supabaseUrl}/functions/v1/agenda-whatsapp-reminders`,
    cron: '*/30 7-21 * * *',
    body: { action: 'cron_dispatch_due_reminders' },
    retries: 2,
  },
  {
    scheduleId: 'auto-lead-agenda-sync',
    destination: `${supabaseUrl}/functions/v1/auto-lead-orchestrator`,
    cron: '0 12,15,18,21 * * 1-6',
    body: { action: 'sync_agendas' },
    retries: 2,
  },
  {
    scheduleId: 'asaas-reconcile-and-trials',
    destination: `${supabaseUrl}/functions/v1/qstash-billing-worker`,
    cron: '0 11,23 * * *',
    body: { action: 'reconcile_pending_and_trials' },
    retries: 3,
  },
  {
    scheduleId: 'daily-admin-digest',
    destination: `${supabaseUrl}/functions/v1/qstash-cron-dispatcher`,
    cron: '30 11 * * *',
    body: { action: 'daily_admin_digest' },
    retries: 2,
  },
];

async function main() {
  console.log(`[QStash IaC] Queues: ${QUEUES.length} | Schedules: ${SCHEDULES.length} | DryRun: ${isDryRun}`);
  if (isDryRun) {
    console.log(JSON.stringify({ qstashUrl, supabaseUrl, QUEUES, SCHEDULES }, null, 2));
    return;
  }
  if (!qstashToken) {
    throw new Error('QSTASH_TOKEN ausente. Execute via Pulumi ESC.');
  }

  for (const q of QUEUES) {
    const res = await fetch(`${qstashUrl}/v2/queues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${qstashToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueName: q.name, parallelism: q.parallelism }),
    });
    if (!res.ok) throw new Error(`Queue ${q.name} falhou: HTTP ${res.status} ${await res.text()}`);
    console.log(`✅ Queue sincronizada: ${q.name} (parallelism=${q.parallelism})`);
  }

  for (const s of SCHEDULES) {
    const res = await fetch(`${qstashUrl}/v2/schedules/${s.destination}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${qstashToken}`,
        'Content-Type': 'application/json',
        'Upstash-Schedule-Id': s.scheduleId,
        'Upstash-Cron': s.cron,
        'Upstash-Retries': String(s.retries),
      },
      body: JSON.stringify(s.body),
    });
    if (!res.ok) throw new Error(`Schedule ${s.scheduleId} falhou: HTTP ${res.status} ${await res.text()}`);
    console.log(`✅ Schedule sincronizado: ${s.scheduleId} (${s.cron})`);
  }
}

main().catch((err) => {
  console.error('❌ Erro:', err);
  process.exit(1);
});
