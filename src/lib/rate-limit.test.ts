import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRateLimitHeaders,
  checkRateLimit,
  checkRateLimits,
  clearEphemeralBlockCache,
  extractClientIp,
  hashIdentifier,
  rateLimitExceededResponse,
} from '../../supabase/functions/_shared/rate-limit.ts';
import { clearAlertFallbackGuards } from '../../supabase/functions/_shared/error-alert.ts';

describe('Upstash Distributed Rate Limiter (_shared/rate-limit.ts)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearEphemeralBlockCache();
    clearAlertFallbackGuards();
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.test.local';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-redis-token';
    process.env.AXIOM_TOKEN = 'test-axiom-token';
    process.env.AXIOM_DATASET = 'pluri-health-logs';
    process.env.TELEGRAM_BOT_TOKEN = 'tg-token';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '123456';
    process.env.RESEND_API_KEY = 're_test_123';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.useRealTimers();
  });

  it('permite requisição dentro do limite e retorna headers X-RateLimit-* corretos', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ result: [2, 45_000, 0] }), { status: 200 })
    );

    const res = await checkRateLimit({
      preset: 'auth_confirmation_email_min',
      identifier: 'clinica@example.com',
      service: 'send-auth-confirmation',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.allowed).toBe(true);
    expect(res.limit).toBe(3);
    expect(res.remaining).toBe(1);
    expect(res.count).toBe(2);

    const headers = buildRateLimitHeaders(res);
    expect(headers['X-RateLimit-Limit']).toBe('3');
    expect(headers['X-RateLimit-Remaining']).toBe('1');
    expect(headers['Retry-After']).toBeUndefined();
  });

  it('bloqueia com 429 ao exceder limite e atende flood subsequente via ephemeralBlockCache com 0 comandos Redis extras', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('upstash.test.local')) {
        return new Response(JSON.stringify({ result: [4, 25_000, 1] }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const firstBlock = await checkRateLimit({
      preset: 'auth_confirmation_email_min',
      identifier: 'flood@example.com',
      service: 'send-auth-confirmation',
      route: 'send-auth-confirmation',
    });

    expect(firstBlock.allowed).toBe(false);
    expect(firstBlock.retryAfterSec).toBe(25);
    expect(firstBlock.fromEphemeralCache).toBeUndefined();

    const callsAfterFirst = fetchMock.mock.calls.length;

    const secondBlock = await checkRateLimit({
      preset: 'auth_confirmation_email_min',
      identifier: 'flood@example.com',
      service: 'send-auth-confirmation',
    });

    expect(secondBlock.allowed).toBe(false);
    expect(secondBlock.fromEphemeralCache).toBe(true);
    expect(secondBlock.retryAfterSec).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(callsAfterFirst);

    const resp = rateLimitExceededResponse(secondBlock, { 'Access-Control-Allow-Origin': '*' });
    expect(resp.status).toBe(429);
    expect(resp.headers.get('Retry-After')).toBe(String(secondBlock.retryAfterSec));
    const jsonBody = await resp.json();
    expect(jsonBody.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(jsonBody.retryAfter).toBe(secondBlock.retryAfterSec);
  });

  it('libera novamente após expiração da janela no ephemeralBlockCache', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-25T10:00:00Z'));

    let redisCount = 4;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('upstash.test.local')) {
        return new Response(JSON.stringify({ result: [redisCount, 5_000, 0] }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const blocked = await checkRateLimit({
      preset: 'auth_confirmation_email_min',
      identifier: 'user@example.com',
    });
    expect(blocked.allowed).toBe(false);

    vi.advanceTimersByTime(6_000);
    redisCount = 1;

    const recovered = await checkRateLimit({
      preset: 'auth_confirmation_email_min',
      identifier: 'user@example.com',
    });
    expect(recovered.allowed).toBe(true);
    expect(recovered.remaining).toBe(2);
  });

  it('faz fail-open quando Upstash retorna erro HTTP 500 ou variáveis estão ausentes', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('Internal Error', { status: 500 }));
    const errRes = await checkRateLimit({
      preset: 'guardian_consent_ip',
      identifier: '198.51.100.2',
    });
    expect(errRes.allowed).toBe(true);
    expect(errRes.degraded).toBe(true);

    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    const missingRes = await checkRateLimit({
      preset: 'guardian_consent_ip',
      identifier: '198.51.100.3',
    });
    expect(missingRes.allowed).toBe(true);
    expect(missingRes.degraded).toBe(true);
  });

  it('extrai IP com prioridade cf-connecting-ip > x-real-ip > x-forwarded-for e anonimiza identificador', async () => {
    const req1 = new Request('https://example.com', {
      headers: {
        'cf-connecting-ip': '203.0.113.10',
        'x-real-ip': '198.51.100.1',
        'x-forwarded-for': '192.0.2.1, 10.0.0.1',
      },
    });
    expect(extractClientIp(req1)).toBe('203.0.113.10');

    const req2 = new Request('https://example.com', {
      headers: {
        'x-real-ip': '198.51.100.2',
        'x-forwarded-for': '192.0.2.2, 10.0.0.1',
      },
    });
    expect(extractClientIp(req2)).toBe('198.51.100.2');

    const req3 = new Request('https://example.com', {
      headers: { 'x-forwarded-for': '192.0.2.99, 10.0.0.1' },
    });
    expect(extractClientIp(req3)).toBe('192.0.2.99');
    expect(extractClientIp(new Request('https://example.com'))).toBe('unknown-ip');

    const h1 = await hashIdentifier('  User@Clinic.COM ');
    const h2 = await hashIdentifier('user@clinic.com');
    expect(h1).toBe(h2);
    expect(h1).toHaveLength(12);
    expect(h1).not.toContain('@');
  });

  it('checkRateLimits realiza short-circuit na primeira camada bloqueada', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('upstash.test.local')) {
        return new Response(JSON.stringify({ result: [99, 30_000, 1] }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const result = await checkRateLimits([
      { preset: 'guardian_consent_ip', identifier: '203.0.113.7' },
      { preset: 'guardian_consent_email', identifier: 'responsavel@example.com' },
    ]);

    expect(result.allowed).toBe(false);
    expect(result.preset).toBe('guardian_consent_ip');
    const upstashCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('upstash.test.local'));
    expect(upstashCalls).toHaveLength(1);
  });

  it('dispara alerta de pico (Telegram + Email + Axiom) exatamente ao atingir spikeThreshold', async () => {
    const calledUrls: string[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const bodyStr = String(init?.body || '');
      calledUrls.push(url);
      if (url.includes('upstash.test.local')) {
        if (bodyStr.includes('alert:tg:')) {
          return new Response(JSON.stringify({ result: [1, 1, 'ok'] }), { status: 200 });
        }
        return new Response(JSON.stringify({ result: [11, 40_000, 10] }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, id: 'email-1' }), { status: 200 });
    });

    const res = await checkRateLimit({
      preset: 'auth_confirmation_ip',
      identifier: '198.51.100.44',
      service: 'send-auth-confirmation',
      route: 'send-auth-confirmation',
    });

    expect(res.allowed).toBe(false);
    expect(calledUrls.some((u) => u.includes('api.axiom.co'))).toBe(true);
    expect(calledUrls.some((u) => u.includes('api.telegram.org'))).toBe(true);
    expect(calledUrls.some((u) => u.includes('api.resend.com'))).toBe(true);
  });

  it('aplica vipOverride apenas quando limite base é excedido e permite VIP acima do base', async () => {
    const lookupOverride = vi.fn().mockResolvedValue(3); // 3x limit

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const bodyStr = String(init?.body || '');
      if (url.includes('upstash.test.local')) {
        if (bodyStr.includes('"EVAL"')) {
          return new Response(JSON.stringify({ result: [35, 20_000, 1] }), { status: 200 });
        }
        if (bodyStr.includes('"GET"')) {
          return new Response(JSON.stringify({ result: null }), { status: 200 });
        }
        return new Response(JSON.stringify({ result: 'OK' }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const res = await checkRateLimit({
      preset: 'b2_write_user', // base limit 30 -> VIP limit 90
      identifier: 'user-vip-123',
      vipOverride: {
        userId: 'user-vip-123',
        lookupOverride,
      },
    });

    expect(lookupOverride).toHaveBeenCalledTimes(1);
    expect(res.allowed).toBe(true);
    expect(res.vipApplied).toBe(true);
    expect(res.limit).toBe(90);
    expect(res.remaining).toBe(55);
  });
});
