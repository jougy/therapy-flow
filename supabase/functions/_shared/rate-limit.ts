/**
 * Distributed Upstash Redis Rate Limiter (Zero external deps: Deno + Cloudflare + Node/Vitest).
 *
 * Uses:
 * - Single atomic Redis Lua `EVAL` command per allowed check (Fixed Window + PTTL self-heal)
 * - In-memory Ephemeral Block Cache (0 Redis commands while blocked keys flood an isolate)
 * - Fail-open guarantee with 2.5s timeout so Upstash outages never block clinical workflows
 * - Anonymized identifiers (Zero-PHI) + Axiom metrics + Telegram/Email spike alerting
 */

import { dispatchAdminErrorAlert, runBackgroundSafe } from './error-alert.ts';
import { ingestToAxiom } from './telemetry-axiom.ts';

export type RateLimitPreset =
  // Tier P0
  | 'auth_confirmation_ip'
  | 'auth_confirmation_email_min'
  | 'auth_confirmation_email_day'
  | 'guardian_consent_ip'
  | 'guardian_consent_email'
  | 'notify_admin_public'
  | 'notify_admin_test'
  | 'whatsapp_webhook_phone'
  | 'whatsapp_webhook_ip'
  | 'mfa_request_user_min'
  | 'mfa_request_user_hour'
  | 'mfa_request_ip'
  | 'mfa_verify_user'
  | 'marketing_zap_webhook_phone'
  | 'marketing_zap_webhook_instance'
  | 'marketing_zap_ai'
  | 'marketing_zap_qr'
  | 'auto_lead_webhook'
  | 'auto_lead_admin'
  // Tier P1
  | 'asaas_mutation_user'
  | 'asaas_mutation_clinic'
  | 'asaas_read_user'
  | 'affiliate_provision_user'
  | 'clinic_invite_user'
  | 'clinic_invite_clinic'
  | 'marketing_studio_copy'
  | 'marketing_studio_render'
  | 'marketing_studio_upload'
  | 'marketing_flow_run'
  | 'obs_telemetry_user'
  | 'obs_error_user'
  | 'obs_slots_user'
  | 'obs_admin_query'
  | 'whatsapp_intro_user'
  | 'whatsapp_diagnostics_user'
  // Tier P2
  | 'b2_write_user'
  | 'b2_write_clinic'
  | 'b2_download_user'
  | 'pluriform_codec_user'
  | 'asaas_webhook_invalid_ip'
  | 'platform_admin_user'
  | 'cep_proxy_ip';

export interface PresetRule {
  limit: number;
  windowSec: number;
  spikeThreshold: number;
}

export const RATE_LIMIT_PRESETS: Record<RateLimitPreset, PresetRule> = {
  // Tier P0
  auth_confirmation_ip: { limit: 10, windowSec: 60, spikeThreshold: 10 },
  auth_confirmation_email_min: { limit: 3, windowSec: 60, spikeThreshold: 5 },
  auth_confirmation_email_day: { limit: 10, windowSec: 86400, spikeThreshold: 5 },
  guardian_consent_ip: { limit: 5, windowSec: 60, spikeThreshold: 8 },
  guardian_consent_email: { limit: 3, windowSec: 900, spikeThreshold: 5 },
  notify_admin_public: { limit: 5, windowSec: 60, spikeThreshold: 10 },
  notify_admin_test: { limit: 10, windowSec: 60, spikeThreshold: 8 },
  whatsapp_webhook_phone: { limit: 15, windowSec: 60, spikeThreshold: 8 },
  whatsapp_webhook_ip: { limit: 120, windowSec: 60, spikeThreshold: 15 },
  mfa_request_user_min: { limit: 1, windowSec: 60, spikeThreshold: 5 },
  mfa_request_user_hour: { limit: 5, windowSec: 3600, spikeThreshold: 5 },
  mfa_request_ip: { limit: 10, windowSec: 600, spikeThreshold: 8 },
  mfa_verify_user: { limit: 5, windowSec: 300, spikeThreshold: 5 },
  marketing_zap_webhook_phone: { limit: 20, windowSec: 60, spikeThreshold: 10 },
  marketing_zap_webhook_instance: { limit: 200, windowSec: 60, spikeThreshold: 15 },
  marketing_zap_ai: { limit: 15, windowSec: 60, spikeThreshold: 8 },
  marketing_zap_qr: { limit: 5, windowSec: 300, spikeThreshold: 5 },
  auto_lead_webhook: { limit: 120, windowSec: 60, spikeThreshold: 15 },
  auto_lead_admin: { limit: 30, windowSec: 60, spikeThreshold: 10 },
  // Tier P1
  asaas_mutation_user: { limit: 5, windowSec: 600, spikeThreshold: 6 },
  asaas_mutation_clinic: { limit: 10, windowSec: 600, spikeThreshold: 8 },
  asaas_read_user: { limit: 30, windowSec: 60, spikeThreshold: 12 },
  affiliate_provision_user: { limit: 3, windowSec: 3600, spikeThreshold: 5 },
  clinic_invite_user: { limit: 10, windowSec: 600, spikeThreshold: 8 },
  clinic_invite_clinic: { limit: 30, windowSec: 3600, spikeThreshold: 10 },
  marketing_studio_copy: { limit: 20, windowSec: 600, spikeThreshold: 10 },
  marketing_studio_render: { limit: 10, windowSec: 600, spikeThreshold: 8 },
  marketing_studio_upload: { limit: 30, windowSec: 60, spikeThreshold: 10 },
  marketing_flow_run: { limit: 30, windowSec: 60, spikeThreshold: 10 },
  obs_telemetry_user: { limit: 20, windowSec: 60, spikeThreshold: 15 },
  obs_error_user: { limit: 30, windowSec: 60, spikeThreshold: 15 },
  obs_slots_user: { limit: 60, windowSec: 60, spikeThreshold: 20 },
  obs_admin_query: { limit: 30, windowSec: 60, spikeThreshold: 10 },
  whatsapp_intro_user: { limit: 2, windowSec: 600, spikeThreshold: 5 },
  whatsapp_diagnostics_user: { limit: 10, windowSec: 60, spikeThreshold: 8 },
  // Tier P2
  b2_write_user: { limit: 30, windowSec: 60, spikeThreshold: 12 },
  b2_write_clinic: { limit: 100, windowSec: 60, spikeThreshold: 15 },
  b2_download_user: { limit: 60, windowSec: 60, spikeThreshold: 15 },
  pluriform_codec_user: { limit: 30, windowSec: 60, spikeThreshold: 10 },
  asaas_webhook_invalid_ip: { limit: 10, windowSec: 300, spikeThreshold: 5 },
  platform_admin_user: { limit: 20, windowSec: 60, spikeThreshold: 10 },
  cep_proxy_ip: { limit: 30, windowSec: 60, spikeThreshold: 15 },
};

export interface VipOverrideConfig {
  userId: string;
  lookupOverride?: () => Promise<number | null>;
}

export interface RateLimitOptions {
  preset: RateLimitPreset;
  identifier: string;
  limit?: number;
  windowSec?: number;
  spikeThreshold?: number;
  service?: string;
  route?: string;
  vipOverride?: VipOverrideConfig;
}

export interface RateLimitResult {
  allowed: boolean;
  preset: RateLimitPreset;
  limit: number;
  remaining: number;
  resetAtMs: number;
  retryAfterSec: number;
  count: number;
  fromEphemeralCache?: boolean;
  degraded?: boolean;
  vipApplied?: boolean;
}

const MAX_EPHEMERAL_CACHE_SIZE = 2000;
const SPIKE_WINDOW_SEC = 300;
const VIP_CACHE_TTL_SEC = 300;
const ephemeralBlockCache = new Map<string, { resetAtMs: number; limit: number }>();

const RATE_LIMIT_LUA = `
local count = redis.call('INCR', KEYS[1])
local pttl = redis.call('PTTL', KEYS[1])
if count == 1 or pttl < 0 then
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[2]))
  pttl = tonumber(ARGV[2])
end
local spike = 0
if count > tonumber(ARGV[1]) then
  redis.call('HINCRBY', KEYS[2], ARGV[3], 1)
  redis.call('EXPIRE', KEYS[2], 604800)
  spike = redis.call('INCR', KEYS[3])
  if spike == 1 then
    redis.call('EXPIRE', KEYS[3], tonumber(ARGV[4]))
  end
end
return {count, pttl, spike}
`;

function getEnv(key: string): string | undefined {
  const denoEnv = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno?.env;
  if (denoEnv) return denoEnv.get(key);
  if (typeof process !== 'undefined' && process.env) return process.env[key];
  return undefined;
}

export function clearEphemeralBlockCache(): void {
  ephemeralBlockCache.clear();
}

export function extractClientIp(req: Request): string {
  const cfIp = req.headers.get('cf-connecting-ip')?.trim();
  if (cfIp) return cfIp;

  const realIp = req.headers.get('x-real-ip')?.trim();
  if (realIp) return realIp;

  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }

  return 'unknown-ip';
}

export async function hashIdentifier(raw: string): Promise<string> {
  const normalized = String(raw || 'anonymous').trim().toLowerCase();
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
      return Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, 12);
    }
  } catch {
    // Fallback to deterministic FNV-1a below
  }

  let h1 = 2166136261;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < normalized.length; i++) {
    const c = normalized.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ (c + i), 2246822519);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(4, '0').slice(0, 4)}`;
}

async function execUpstash<T = unknown>(command: Array<string | number>): Promise<{ ok: boolean; result: T | null }> {
  const url = getEnv('UPSTASH_REDIS_REST_URL');
  const token = getEnv('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return { ok: false, result: null };

  try {
    const endpoint = url.endsWith('/') ? url : `${url}/`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return { ok: false, result: null };
    const data = (await res.json()) as { result?: T; error?: string };
    if (data?.error) return { ok: false, result: null };
    return { ok: true, result: (data?.result ?? null) as T | null };
  } catch {
    return { ok: false, result: null };
  }
}

function setEphemeralBlock(cacheKey: string, resetAtMs: number, limit: number): void {
  if (ephemeralBlockCache.size >= MAX_EPHEMERAL_CACHE_SIZE) {
    const now = Date.now();
    for (const [k, entry] of ephemeralBlockCache.entries()) {
      if (now >= entry.resetAtMs) ephemeralBlockCache.delete(k);
    }
    if (ephemeralBlockCache.size >= MAX_EPHEMERAL_CACHE_SIZE) {
      const oldest = ephemeralBlockCache.keys().next().value;
      if (oldest) ephemeralBlockCache.delete(oldest);
    }
  }
  ephemeralBlockCache.set(cacheKey, { resetAtMs, limit });
}

async function resolveVipMultiplier(vip: VipOverrideConfig): Promise<number> {
  const vipHash = await hashIdentifier(vip.userId);
  const cacheKey = `rl:gov:vip:${vipHash}`;

  const cached = await execUpstash<string | null>(['GET', cacheKey]);
  if (cached.ok && cached.result !== null && cached.result !== undefined) {
    const num = Number(cached.result);
    return Number.isFinite(num) && num > 1 ? num : 1;
  }

  let multiplier = 1;
  if (vip.lookupOverride) {
    try {
      const lookedUp = await vip.lookupOverride();
      if (typeof lookedUp === 'number' && Number.isFinite(lookedUp) && lookedUp > 1) {
        multiplier = Math.min(lookedUp, 10);
      }
    } catch {
      multiplier = 1;
    }
  }

  await execUpstash(['SET', cacheKey, String(multiplier), 'EX', VIP_CACHE_TTL_SEC]);
  return multiplier;
}

export async function checkRateLimit(opts: RateLimitOptions): Promise<RateLimitResult> {
  const defaults = RATE_LIMIT_PRESETS[opts.preset];
  const limit = opts.limit ?? defaults.limit;
  const windowSec = opts.windowSec ?? defaults.windowSec;
  const spikeThreshold = opts.spikeThreshold ?? defaults.spikeThreshold;
  const windowMs = windowSec * 1000;

  const idHash = await hashIdentifier(opts.identifier);
  const cacheKey = `${opts.preset}:${idHash}`;
  const now = Date.now();

  const cachedBlock = ephemeralBlockCache.get(cacheKey);
  if (cachedBlock && now < cachedBlock.resetAtMs) {
    const retryAfterSec = Math.max(1, Math.ceil((cachedBlock.resetAtMs - now) / 1000));
    return {
      allowed: false,
      preset: opts.preset,
      limit: cachedBlock.limit,
      remaining: 0,
      resetAtMs: cachedBlock.resetAtMs,
      retryAfterSec,
      count: cachedBlock.limit + 1,
      fromEphemeralCache: true,
    };
  }
  if (cachedBlock) {
    ephemeralBlockCache.delete(cacheKey);
  }

  const dateKey = new Date(now).toISOString().slice(0, 10);
  const redisKey = `rl:${opts.preset}:${idHash}`;
  const metricsKey = `rl:metrics:blocked:${dateKey}`;
  const spikeKey = `rl:spike:${opts.preset}`;

  const evalRes = await execUpstash<[number, number, number]>([
    'EVAL',
    RATE_LIMIT_LUA,
    3,
    redisKey,
    metricsKey,
    spikeKey,
    limit,
    windowMs,
    opts.preset,
    SPIKE_WINDOW_SEC,
  ]);

  if (!evalRes.ok || !Array.isArray(evalRes.result)) {
    return {
      allowed: true,
      preset: opts.preset,
      limit,
      remaining: limit,
      resetAtMs: now + windowMs,
      retryAfterSec: 0,
      count: 0,
      degraded: true,
    };
  }

  const count = Number(evalRes.result[0] ?? 1);
  const pttlMs = Math.max(1000, Number(evalRes.result[1] ?? windowMs));
  const spikeCount = Number(evalRes.result[2] ?? 0);
  const resetAtMs = now + pttlMs;

  if (count <= limit) {
    return {
      allowed: true,
      preset: opts.preset,
      limit,
      remaining: Math.max(0, limit - count),
      resetAtMs,
      retryAfterSec: 0,
      count,
    };
  }

  // Only inspect VIP override when the base limit is actually exceeded (0 overhead on happy path)
  if (opts.vipOverride?.userId) {
    const vipMult = await resolveVipMultiplier(opts.vipOverride);
    if (vipMult > 1) {
      const effectiveLimit = Math.ceil(limit * vipMult);
      if (count <= effectiveLimit) {
        return {
          allowed: true,
          preset: opts.preset,
          limit: effectiveLimit,
          remaining: Math.max(0, effectiveLimit - count),
          resetAtMs,
          retryAfterSec: 0,
          count,
          vipApplied: true,
        };
      }
    }
  }

  const retryAfterSec = Math.max(1, Math.ceil(pttlMs / 1000));
  setEphemeralBlock(cacheKey, resetAtMs, limit);

  const service = opts.service || 'pluri-health-edge';
  const route = opts.route || opts.preset;
  const telemetryTasks: Array<Promise<unknown>> = [
    ingestToAxiom([
      {
        level: 'warn',
        service,
        error_code: 'rate_limit_blocked',
        route,
        message: `Rate limit exceeded on ${opts.preset}`,
        metadata: {
          event_type: 'rate_limit_blocked',
          preset: opts.preset,
          idHash,
          limit,
          count,
          retryAfterSec,
        },
      },
    ]),
  ];

  if (spikeCount === spikeThreshold) {
    telemetryTasks.push(
      dispatchAdminErrorAlert({
        fingerprint: `rl-spike-${opts.preset}`,
        level: 'warn',
        service,
        route,
        code: 'rate_limit_spike',
        message: `Pico de bloqueios detectado no preset "${opts.preset}" (${spikeCount} bloqueios nos últimos ${SPIKE_WINDOW_SEC}s).`,
        occurrences: spikeCount,
        metadata: {
          preset: opts.preset,
          spikeCount,
          spikeWindowSec: SPIKE_WINDOW_SEC,
          limit,
          windowSec,
        },
      })
    );
  }

  await runBackgroundSafe(Promise.allSettled(telemetryTasks), 1500);

  return {
    allowed: false,
    preset: opts.preset,
    limit,
    remaining: 0,
    resetAtMs,
    retryAfterSec,
    count,
  };
}

export async function checkRateLimits(checks: RateLimitOptions[]): Promise<RateLimitResult> {
  let lastResult: RateLimitResult | null = null;
  for (const check of checks) {
    const res = await checkRateLimit(check);
    lastResult = res;
    if (!res.allowed) return res;
  }
  return (
    lastResult ?? {
      allowed: true,
      preset: checks[0]?.preset ?? 'platform_admin_user',
      limit: 1,
      remaining: 1,
      resetAtMs: Date.now() + 60_000,
      retryAfterSec: 0,
      count: 0,
    }
  );
}

export function buildRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(result.limit),
    'X-RateLimit-Remaining': String(Math.max(0, result.remaining)),
    'X-RateLimit-Reset': String(Math.ceil(result.resetAtMs / 1000)),
  };
  if (!result.allowed) {
    headers['Retry-After'] = String(Math.max(1, result.retryAfterSec));
  }
  return headers;
}

export function rateLimitExceededResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>,
  customMessage?: string,
  extraBody?: Record<string, unknown>
): Response {
  const message =
    customMessage ||
    `Muitas solicitações em curto intervalo. Aguarde ${result.retryAfterSec} segundos e tente novamente.`;

  return new Response(
    JSON.stringify({
      error: message,
      code: 'RATE_LIMIT_EXCEEDED',
      preset: result.preset,
      retryAfter: result.retryAfterSec,
      ...extraBody,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        ...buildRateLimitHeaders(result),
        'Content-Type': 'application/json',
      },
    }
  );
}
