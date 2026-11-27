/**
 * Instant Admin Error & Security Alert Dispatcher (Telegram Bot + Resend Email).
 *
 * Works across Deno Edge Functions, Cloudflare Functions and Node/Vitest (zero esm.sh imports).
 * Protects Free Tier quotas with Upstash atomic cooldowns (15m Telegram, 30m Email)
 * and hourly caps (40 Telegram/hour, 15 Emails/hour), with fail-open in-memory fallback.
 */

import { enqueueToQStash } from './qstash.ts';

export interface AdminErrorAlertInput {
  fingerprint: string;
  level: 'critical' | 'error' | 'warn';
  service: string;
  route: string;
  code: string | number;
  message: string;
  occurrences?: number;
  stack?: string;
  metadata?: Record<string, unknown>;
  force?: boolean;
  isQStashRetry?: boolean;
}

export interface AdminErrorAlertResult {
  telegramSent: boolean;
  emailSent: boolean;
  skippedReason?: string;
  telegramError?: string;
  emailError?: string;
}

const DEFAULT_ADMIN_EMAIL = 'jougy@gmx.com';
const DEFAULT_FROM_EMAIL = 'Pluri-Health Alertas <convite@pluri.health>';
const TELEGRAM_COOLDOWN_SEC = 900; // 15 min per fingerprint
const EMAIL_COOLDOWN_SEC = 1800; // 30 min per fingerprint
const TELEGRAM_HOURLY_CAP = 40;
const EMAIL_HOURLY_CAP = 15;
const FALLBACK_TG_COOLDOWN_MS = 60_000;
const FALLBACK_EMAIL_COOLDOWN_MS = 120_000;
const MAX_FALLBACK_GUARD_SIZE = 500;
const AXIOM_DASHBOARD_URL = 'https://app.axiom.co/pluri-health-kuo9/dashboards/uid/pluri-health-production';

const fallbackTgGuard = new Map<string, number>();
const fallbackEmailGuard = new Map<string, number>();

const SENSITIVE_META_KEYS = new Set([
  'email',
  'to',
  'phone',
  'cpf',
  'cnpj',
  'password',
  'token',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
  'secret',
  'credit_card_data',
  'card_number',
  'cvv',
]);

function getEnv(key: string): string | undefined {
  const denoEnv = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno?.env;
  if (denoEnv) return denoEnv.get(key);
  if (typeof process !== 'undefined' && process.env) return process.env[key];
  return undefined;
}

export function clearAlertFallbackGuards(): void {
  fallbackTgGuard.clear();
  fallbackEmailGuard.clear();
}

export function runBackgroundSafe(promise: Promise<unknown>, maxWaitMs = 2500): Promise<void> {
  const safePromise = promise
    .then(() => undefined)
    .catch((err) => {
      console.warn('[error-alert] Background task error:', err instanceof Error ? err.message : String(err));
    });

  const edgeRuntime = (globalThis as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (typeof edgeRuntime?.waitUntil === 'function') {
    try {
      edgeRuntime.waitUntil(safePromise);
      return Promise.resolve();
    } catch {
      // Fallback to bounded wait below if waitUntil throws outside request scope
    }
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    safePromise.finally(() => {
      if (timer !== undefined) clearTimeout(timer);
    }),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, maxWaitMs);
    }),
  ]);
}

export function sanitizeAlertText(input: string, maxLen = 500): string {
  if (!input) return '';
  const redacted = String(input)
    .replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [REDACTED]')
    .replace(/\beyJ[a-zA-Z0-9_-]{8,}\.[a-zA-Z0-9._-]{8,}\b/g, '[JWT_REDACTED]')
    .replace(/\b(?:re|sk|pk|ghp|xoxb|whsec)_[a-zA-Z0-9_-]{8,}\b/g, '[KEY_REDACTED]')
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF_REDACTED]')
    .replace(/([a-zA-Z0-9._%+-])[a-zA-Z0-9._%+-]*@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '$1***@$2')
    .replace(/\r/g, '')
    .trim();
  return redacted.length > maxLen ? `${redacted.slice(0, maxLen)}…` : redacted;
}

function escapeHtml(text: string): string {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sanitizeMetadata(meta?: Record<string, unknown>): Record<string, string | number | boolean> {
  if (!meta || typeof meta !== 'object') return {};
  const clean: Record<string, string | number | boolean> = {};
  for (const [key, val] of Object.entries(meta)) {
    if (key === 'stack' || SENSITIVE_META_KEYS.has(key.toLowerCase())) continue;
    if (typeof val === 'string') {
      clean[key] = sanitizeAlertText(val, 140);
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      clean[key] = val;
    }
  }
  return clean;
}

function formatSaoPauloTime(date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function checkFallbackCooldown(guard: Map<string, number>, fp: string, ttlMs: number): boolean {
  const now = Date.now();
  const expiresAt = guard.get(fp);
  if (expiresAt && now < expiresAt) return false;
  if (guard.size >= MAX_FALLBACK_GUARD_SIZE) {
    for (const [k, exp] of guard.entries()) {
      if (now >= exp) guard.delete(k);
    }
    if (guard.size >= MAX_FALLBACK_GUARD_SIZE) {
      const firstKey = guard.keys().next().value;
      if (firstKey) guard.delete(firstKey);
    }
  }
  guard.set(fp, now + ttlMs);
  return true;
}

const ALERT_GATE_LUA = `
local tgLock = redis.call('SET', KEYS[1], '1', 'NX', 'EX', tonumber(ARGV[1]))
local emailLock = redis.call('SET', KEYS[2], '1', 'NX', 'EX', tonumber(ARGV[2]))
local tgAllowed = 0
local emailAllowed = 0
local reason = 'ok'

if tgLock then
  local tgCap = tonumber(redis.call('GET', KEYS[3]) or '0')
  if tgCap < tonumber(ARGV[3]) then
    redis.call('INCR', KEYS[3])
    redis.call('EXPIRE', KEYS[3], 7200)
    tgAllowed = 1
  else
    reason = 'hourly_cap'
  end
else
  reason = 'cooldown'
end

if emailLock then
  local emailCap = tonumber(redis.call('GET', KEYS[4]) or '0')
  if emailCap < tonumber(ARGV[4]) then
    redis.call('INCR', KEYS[4])
    redis.call('EXPIRE', KEYS[4], 7200)
    emailAllowed = 1
  elseif reason == 'ok' then
    reason = 'hourly_cap'
  end
elseif reason == 'ok' then
  reason = 'cooldown'
end

return {tgAllowed, emailAllowed, reason}
`;

async function acquireAlertGate(
  fingerprint: string,
  force?: boolean
): Promise<{ allowTg: boolean; allowEmail: boolean; skippedReason?: string }> {
  if (force) return { allowTg: true, allowEmail: true };

  const redisUrl = getEnv('UPSTASH_REDIS_REST_URL');
  const redisToken = getEnv('UPSTASH_REDIS_REST_TOKEN');
  const safeFp = fingerprint.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 32) || 'unknown';
  const hourBucket = new Date().toISOString().slice(0, 13);

  if (redisUrl && redisToken) {
    try {
      const endpoint = redisUrl.endsWith('/') ? redisUrl : `${redisUrl}/`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          'EVAL',
          ALERT_GATE_LUA,
          4,
          `alert:tg:${safeFp}`,
          `alert:email:${safeFp}`,
          `alert:cap:tg:${hourBucket}`,
          `alert:cap:email:${hourBucket}`,
          TELEGRAM_COOLDOWN_SEC,
          EMAIL_COOLDOWN_SEC,
          TELEGRAM_HOURLY_CAP,
          EMAIL_HOURLY_CAP,
        ]),
        signal: AbortSignal.timeout(2500),
      });

      if (res.ok) {
        const payload = (await res.json()) as { result?: [number, number, string] };
        const arr = payload?.result;
        if (Array.isArray(arr) && arr.length >= 2) {
          const allowTg = Number(arr[0]) === 1;
          const allowEmail = Number(arr[1]) === 1;
          const skippedReason = !allowTg && !allowEmail ? String(arr[2] || 'cooldown') : undefined;
          return { allowTg, allowEmail, skippedReason };
        }
      }
    } catch {
      // Fail-open to in-memory cooldown guard
    }
  }

  const allowTg = checkFallbackCooldown(fallbackTgGuard, safeFp, FALLBACK_TG_COOLDOWN_MS);
  const allowEmail = checkFallbackCooldown(fallbackEmailGuard, safeFp, FALLBACK_EMAIL_COOLDOWN_MS);
  return {
    allowTg,
    allowEmail,
    skippedReason: !allowTg && !allowEmail ? 'cooldown_fallback' : undefined,
  };
}

function getSeverityMeta(level: AdminErrorAlertInput['level']): { badge: string; label: string; color: string } {
  if (level === 'critical') return { badge: '🚨', label: 'CRÍTICO', color: '#dc2626' };
  if (level === 'warn') return { badge: '🛡️', label: 'ALERTA SEGURANÇA', color: '#d97706' };
  return { badge: '🔴', label: 'ERRO', color: '#e11d48' };
}

export async function dispatchAdminErrorAlert(input: AdminErrorAlertInput): Promise<AdminErrorAlertResult> {
  try {
    const gate = await acquireAlertGate(input.fingerprint, input.force);
    if (!gate.allowTg && !gate.allowEmail) {
      return { telegramSent: false, emailSent: false, skippedReason: gate.skippedReason || 'cooldown' };
    }

    const tgToken = getEnv('TELEGRAM_BOT_TOKEN') || '';
    const tgChatId = getEnv('TELEGRAM_ADMIN_CHAT_ID') || '';
    const resendKey = getEnv('RESEND_API_KEY') || '';
    const fromEmail = getEnv('RESEND_DEFAULT_FROM') || DEFAULT_FROM_EMAIL;
    const toEmail = getEnv('ALERT_ADMIN_EMAIL') || DEFAULT_ADMIN_EMAIL;

    const sev = getSeverityMeta(input.level);
    const whenBr = formatSaoPauloTime();
    const safeService = escapeHtml(sanitizeAlertText(input.service || 'pluri-health-edge', 80));
    const safeRoute = escapeHtml(sanitizeAlertText(input.route || '/', 120));
    const safeCode = escapeHtml(sanitizeAlertText(String(input.code || 'unknown'), 60));
    const safeMsg = escapeHtml(sanitizeAlertText(input.message || 'Erro não especificado', 600));
    const safeStack = input.stack ? escapeHtml(sanitizeAlertText(input.stack, 600)) : '';
    const cleanMeta = sanitizeMetadata(input.metadata);
    const metaJson = Object.keys(cleanMeta).length > 0 ? escapeHtml(JSON.stringify(cleanMeta)) : '';
    const occurrences = input.occurrences ?? 1;

    const tasks: Array<Promise<{ channel: 'tg' | 'email'; ok: boolean; error?: string }>> = [];

    if (gate.allowTg && tgToken && tgChatId) {
      const tgLines = [
        `${sev.badge} <b>Pluri-Health [${sev.label}]</b>`,
        `<b>Serviço:</b> <code>${safeService}</code>`,
        `<b>Rota:</b> <code>${safeRoute}</code> | <b>Código:</b> <code>${safeCode}</code>`,
        `<b>Quando:</b> ${escapeHtml(whenBr)} | <b>Ocorrências:</b> ${occurrences} | <b>FP:</b> <code>${escapeHtml(input.fingerprint)}</code>`,
        `<b>Mensagem:</b>\n<pre>${safeMsg}</pre>`,
        safeStack ? `<b>Stack:</b>\n<pre>${safeStack}</pre>` : '',
        metaJson ? `<b>Meta:</b> <code>${metaJson}</code>` : '',
        `<a href="${AXIOM_DASHBOARD_URL}">Abrir Dashboard Axiom</a>`,
      ].filter(Boolean);

      tasks.push(
        fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: tgChatId,
            text: tgLines.join('\n'),
            parse_mode: 'HTML',
            disable_web_page_preview: true,
          }),
          signal: AbortSignal.timeout(4000),
        })
          .then(async (r) => {
            const data = (await r.json().catch(() => ({}))) as { ok?: boolean; description?: string };
            const ok = Boolean(r.ok && data.ok !== false);
            return {
              channel: 'tg' as const,
              ok,
              error: ok ? undefined : sanitizeAlertText(`HTTP ${r.status}: ${data.description || 'telegram_error'}`, 140),
            };
          })
          .catch((e) => ({
            channel: 'tg' as const,
            ok: false,
            error: sanitizeAlertText(e instanceof Error ? e.message : 'telegram_fetch_error', 140),
          }))
      );
    }

    if (gate.allowEmail && resendKey) {
      const emailHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:20px;background:#f8fafc;color:#0f172a;">
  <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
    <div style="display:inline-block;background:${sev.color};color:#fff;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;margin-bottom:12px;">
      ${sev.badge} ${sev.label}
    </div>
    <h2 style="margin:0 0 12px;font-size:18px;color:#0f172a;">Alerta Automático — Pluri-Health</h2>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
      <tr><td style="padding:4px 0;color:#64748b;width:120px;">Serviço:</td><td><code>${safeService}</code></td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Rota / Ação:</td><td><code>${safeRoute}</code></td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Código:</td><td><code>${safeCode}</code></td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Horário (BRT):</td><td>${escapeHtml(whenBr)}</td></tr>
      <tr><td style="padding:4px 0;color:#64748b;">Ocorrências:</td><td>${occurrences} (FP: <code>${escapeHtml(input.fingerprint)}</code>)</td></tr>
    </table>
    <div style="background:#f1f5f9;border-radius:8px;padding:12px;font-family:monospace;font-size:12px;white-space:pre-wrap;word-break:break-word;margin-bottom:12px;">${safeMsg}</div>
    ${safeStack ? `<details open style="margin-bottom:12px;"><summary style="font-size:12px;font-weight:600;cursor:pointer;">Stack Trace</summary><pre style="background:#0f172a;color:#e2e8f0;border-radius:8px;padding:12px;font-size:11px;overflow-x:auto;">${safeStack}</pre></details>` : ''}
    ${metaJson ? `<p style="font-size:12px;color:#475569;"><strong>Metadata:</strong> <code>${metaJson}</code></p>` : ''}
    <p style="margin-top:16px;"><a href="${AXIOM_DASHBOARD_URL}" style="display:inline-block;background:#0284c7;color:#ffffff;text-decoration:none;padding:10px 16px;border-radius:8px;font-size:13px;font-weight:600;">Abrir Logs no Axiom</a></p>
  </div>
</div>`.trim();

      tasks.push(
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [toEmail],
            subject: `[Pluri-Health ${sev.label}] ${sanitizeAlertText(input.service, 40)}: ${sanitizeAlertText(String(input.code), 30)}`,
            html: emailHtml,
            text: `[Pluri-Health ${sev.label}] ${input.service} (${input.route}) [${input.code}] @ ${whenBr}\n${sanitizeAlertText(input.message, 600)}\nDashboard: ${AXIOM_DASHBOARD_URL}`,
          }),
          signal: AbortSignal.timeout(4000),
        })
          .then(async (r) => {
            if (r.ok) return { channel: 'email' as const, ok: true };
            const errJson = (await r.json().catch(() => ({}))) as { message?: string };
            return {
              channel: 'email' as const,
              ok: false,
              error: sanitizeAlertText(`HTTP ${r.status}: ${errJson.message || 'resend_error'}`, 140),
            };
          })
          .catch((e) => ({
            channel: 'email' as const,
            ok: false,
            error: sanitizeAlertText(e instanceof Error ? e.message : 'resend_fetch_error', 140),
          }))
      );
    }

    if (tasks.length === 0) {
      return { telegramSent: false, emailSent: false, skippedReason: 'credentials_missing' };
    }

    const settled = await Promise.allSettled(tasks);
    let telegramSent = false;
    let emailSent = false;
    let telegramError: string | undefined;
    let emailError: string | undefined;
    for (const item of settled) {
      if (item.status === 'fulfilled') {
        if (item.value.channel === 'tg') {
          telegramSent = item.value.ok;
          if (!item.value.ok) telegramError = item.value.error;
        }
        if (item.value.channel === 'email') {
          emailSent = item.value.ok;
          if (!item.value.ok) emailError = item.value.error;
        }
      }
    }
    if ((telegramError || emailError) && !input.isQStashRetry) {
      const supabaseUrl = getEnv('SUPABASE_URL')?.replace(/\/+$/, '');
      if (supabaseUrl) {
        void enqueueToQStash('notifications-reliable', {
          targetUrl: `${supabaseUrl}/functions/v1/platform-observability`,
          body: {
            action: 'retry_admin_alert',
            alertInput: { ...input, isQStashRetry: true, force: true },
          },
          retries: 4,
          deduplicationId: `alert-retry:${input.fingerprint}:${Math.floor(Date.now() / 60000)}`,
        });
      }
    }

    return {
      telegramSent,
      emailSent,
      ...(telegramError ? { telegramError } : {}),
      ...(emailError ? { emailError } : {}),
    };
  } catch (err) {
    console.warn('[error-alert] Falha ao despachar alerta:', err instanceof Error ? err.message : String(err));
    return { telegramSent: false, emailSent: false, skippedReason: 'dispatch_exception' };
  }
}
