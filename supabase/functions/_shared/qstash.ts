/**
 * Upstash QStash Client & Cryptographic Signature Verifier (Zero External Deps).
 *
 * Compatible with Deno Edge Functions and Node/Vitest via Web Crypto API.
 * Features:
 * - HS256 JWT verification with key rotation (CURRENT + NEXT signing keys)
 * - SHA-256 body hash verification
 * - Automatic Upstash-Failure-Callback injection (Active DLQ -> Axiom + Telegram + Email)
 * - Free Tier 7-day delay clamp & daily Quota Guard (alert at 800 msgs/day = 80%)
 */

export interface QStashPublishOptions {
  targetUrl: string;
  body: unknown;
  delay?: string; // e.g. '55s', '10m', '48h'
  notBeforeSec?: number; // Unix timestamp in seconds
  retries?: number;
  deduplicationId?: string;
  contentBasedDeduplication?: boolean;
  failureCallbackUrl?: string;
  flowControl?: {
    key: string;
    parallelism?: number;
    ratePerSecond?: number;
  };
  headers?: Record<string, string>;
}

export interface QStashPublishResult {
  queued: boolean;
  messageId?: string;
  deduplicated?: boolean;
  reason?: string;
  status?: number;
}

export interface QStashVerifyResult {
  valid: boolean;
  reason?: string;
  claims?: Record<string, unknown>;
}

const FREE_TIER_MAX_DELAY_SEC = 7 * 24 * 60 * 60; // 7 days
const FREE_TIER_DAILY_ALERT_THRESHOLD = 800; // 80% of 1,000 msgs/day

function getEnv(key: string): string | undefined {
  const denoEnv = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno?.env;
  if (denoEnv) return denoEnv.get(key);
  if (typeof process !== 'undefined' && process.env) return process.env[key];
  return undefined;
}

function base64UrlDecodeToBytes(input: string): Uint8Array {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256Base64Url(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncodeBytes(new Uint8Array(digest));
}

async function verifyHs256Jwt(token: string, signingKey: string): Promise<Record<string, unknown> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;

  try {
    const header = JSON.parse(new TextDecoder().decode(base64UrlDecodeToBytes(headerB64))) as { alg?: string };
    if (header.alg !== 'HS256') return null;

    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(signingKey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sigBytes = base64UrlDecodeToBytes(sigB64);
    const ok = await crypto.subtle.verify('HMAC', key, sigBytes, data);
    if (!ok) return null;

    return JSON.parse(new TextDecoder().decode(base64UrlDecodeToBytes(payloadB64))) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function verifyQStashSignature(
  req: Request,
  rawBody: string,
  expectedUrl?: string
): Promise<QStashVerifyResult> {
  const signature = req.headers.get('Upstash-Signature') || req.headers.get('upstash-signature') || '';
  if (!signature) {
    return { valid: false, reason: 'missing_signature' };
  }

  const currentKey = getEnv('QSTASH_CURRENT_SIGNING_KEY') || '';
  const nextKey = getEnv('QSTASH_NEXT_SIGNING_KEY') || '';
  if (!currentKey && !nextKey) {
    return { valid: false, reason: 'signing_keys_not_configured' };
  }

  let claims: Record<string, unknown> | null = null;
  if (currentKey) {
    claims = await verifyHs256Jwt(signature, currentKey);
  }
  if (!claims && nextKey) {
    claims = await verifyHs256Jwt(signature, nextKey);
  }
  if (!claims) {
    return { valid: false, reason: 'invalid_signature' };
  }

  if (claims.iss !== 'Upstash') {
    return { valid: false, reason: 'invalid_issuer' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (typeof claims.exp === 'number' && nowSec > claims.exp + 5) {
    return { valid: false, reason: 'token_expired' };
  }
  if (typeof claims.nbf === 'number' && nowSec + 5 < claims.nbf) {
    return { valid: false, reason: 'token_not_yet_valid' };
  }

  if (expectedUrl && typeof claims.sub === 'string') {
    const cleanSub = claims.sub.split('?')[0].replace(/\/+$/, '');
    const cleanExpected = expectedUrl.split('?')[0].replace(/\/+$/, '');
    if (cleanSub !== cleanExpected) {
      return { valid: false, reason: 'subject_mismatch' };
    }
  }

  if (typeof claims.body === 'string' && claims.body.length > 0) {
    const actualHash = await sha256Base64Url(rawBody);
    const normalizedClaim = claims.body.replace(/=+$/, '');
    if (actualHash !== normalizedClaim) {
      return { valid: false, reason: 'body_hash_mismatch' };
    }
  }

  return { valid: true, claims };
}

async function trackQStashPublishAndGuardQuota(): Promise<void> {
  const upstashUrl = getEnv('UPSTASH_REDIS_REST_URL');
  const upstashToken = getEnv('UPSTASH_REDIS_REST_TOKEN');
  if (!upstashUrl || !upstashToken) return;

  const dateKey = new Date().toISOString().slice(0, 10);
  const metricKey = `metrics:qstash:published:${dateKey}`;
  const alertLockKey = `qstash:quota_alert:${dateKey}`;

  try {
    const res = await fetch(`${upstashUrl.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        ['INCR', metricKey],
        ['EXPIRE', metricKey, 604800],
      ]),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return;
    const data = (await res.json()) as Array<{ result: unknown }>;
    const count = Number(data?.[0]?.result ?? 0);

    if (count >= FREE_TIER_DAILY_ALERT_THRESHOLD) {
      const lockRes = await fetch(`${upstashUrl.replace(/\/$/, '')}/set/${encodeURIComponent(alertLockKey)}/1/NX/EX/86400`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${upstashToken}` },
        signal: AbortSignal.timeout(2000),
      });
      if (lockRes.ok) {
        const lockJson = (await lockRes.json()) as { result?: unknown };
        if (lockJson.result === 'OK') {
          const botToken = getEnv('TELEGRAM_BOT_TOKEN');
          const chatId = getEnv('TELEGRAM_ADMIN_CHAT_ID') || getEnv('TELEGRAM_CHAT_ID');
          if (botToken && chatId) {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                parse_mode: 'HTML',
                text: `⚠️ <b>QStash Quota Guard (80%)</b>\nUso hoje (${dateKey}): <b>${count}/1.000</b> mensagens do Free Tier.`,
              }),
              signal: AbortSignal.timeout(3000),
            }).catch(() => undefined);
          }
        }
      }
    }
  } catch {
    // Non-blocking telemetry
  }
}

function buildQStashEndpoint(baseUrl: string, targetUrl: string, queueName?: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const encodedTarget = encodeURIComponent(targetUrl);
  if (queueName) {
    return `${cleanBase}/v2/enqueue/${encodeURIComponent(queueName)}/${encodedTarget}`;
  }
  return `${cleanBase}/v2/publish/${encodedTarget}`;
}

async function dispatchToQStash(options: QStashPublishOptions, queueName?: string): Promise<QStashPublishResult> {
  const token = getEnv('QSTASH_TOKEN');
  if (!token) {
    return { queued: false, reason: 'qstash_not_configured' };
  }

  const baseUrl = getEnv('QSTASH_URL') || 'https://qstash.upstash.io';
  const supabaseUrl = getEnv('SUPABASE_URL')?.replace(/\/+$/, '');
  const defaultFailureCb = supabaseUrl
    ? `${supabaseUrl}/functions/v1/platform-observability?action=qstash_failure_callback`
    : undefined;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.delay) headers['Upstash-Delay'] = options.delay;
  if (typeof options.notBeforeSec === 'number' && Number.isFinite(options.notBeforeSec)) {
    const maxAllowed = Math.floor(Date.now() / 1000) + FREE_TIER_MAX_DELAY_SEC - 60;
    const clamped = Math.min(Math.floor(options.notBeforeSec), maxAllowed);
    headers['Upstash-Not-Before'] = String(clamped);
  }
  if (typeof options.retries === 'number') {
    headers['Upstash-Retries'] = String(Math.max(0, Math.min(10, options.retries)));
  }
  if (options.deduplicationId) {
    headers['Upstash-Deduplication-Id'] = options.deduplicationId;
  }
  if (options.contentBasedDeduplication) {
    headers['Upstash-Content-Based-Deduplication'] = 'true';
  }
  const failureCb = options.failureCallbackUrl || defaultFailureCb;
  if (failureCb) {
    headers['Upstash-Failure-Callback'] = failureCb;
  }
  if (options.flowControl) {
    headers['Upstash-Flow-Control-Key'] = options.flowControl.key;
    const parts: string[] = [];
    if (options.flowControl.parallelism) parts.push(`parallelism=${options.flowControl.parallelism}`);
    if (options.flowControl.ratePerSecond) parts.push(`rate=${options.flowControl.ratePerSecond}`);
    if (parts.length > 0) {
      headers['Upstash-Flow-Control-Value'] = parts.join(', ');
    }
  }

  const endpoint = buildQStashEndpoint(baseUrl, options.targetUrl, queueName);

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: typeof options.body === 'string' ? options.body : JSON.stringify(options.body),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return { queued: false, status: res.status, reason: `qstash_http_${res.status}:${errText.slice(0, 120)}` };
    }

    const data = (await res.json().catch(() => ({}))) as { messageId?: string; deduplicated?: boolean };
    void trackQStashPublishAndGuardQuota();
    return {
      queued: true,
      messageId: data.messageId,
      deduplicated: Boolean(data.deduplicated),
      status: res.status,
    };
  } catch (err) {
    return {
      queued: false,
      reason: err instanceof Error ? err.message : 'qstash_network_error',
    };
  }
}

export function publishToQStash(options: QStashPublishOptions): Promise<QStashPublishResult> {
  return dispatchToQStash(options);
}

export function enqueueToQStash(queueName: string, options: QStashPublishOptions): Promise<QStashPublishResult> {
  return dispatchToQStash(options, queueName);
}
