import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearAlertFallbackGuards,
  dispatchAdminErrorAlert,
  sanitizeAlertText,
} from '../../supabase/functions/_shared/error-alert.ts';
import { reportError } from '../../supabase/functions/_shared/error-dedup.ts';

describe('Admin Error Alert & Dedup Pipeline (_shared/error-alert.ts + error-dedup.ts)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearAlertFallbackGuards();
    process.env.UPSTASH_REDIS_REST_URL = 'https://upstash.test.local';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'test-redis-token';
    process.env.AXIOM_TOKEN = 'test-axiom-token';
    process.env.AXIOM_DATASET = 'pluri-health-logs';
    process.env.TELEGRAM_BOT_TOKEN = 'tg-bot-token';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '999888777';
    process.env.RESEND_API_KEY = 're_test_live';
    process.env.RESEND_DEFAULT_FROM = 'Pluri-Health Alertas <convite@pluri.health>';
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('dispatchAdminErrorAlert envia em paralelo para Telegram e Resend (jougy@gmx.com)', async () => {
    let telegramPayload: Record<string, unknown> | null = null;
    let resendPayload: Record<string, unknown> | null = null;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = typeof input === 'string' ? input : input.toString();
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
      if (url.includes('upstash.test.local')) {
        return new Response(JSON.stringify({ result: [1, 1, 'ok'] }), { status: 200 });
      }
      if (url.includes('api.telegram.org')) {
        telegramPayload = body;
        return new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 });
      }
      if (url.includes('api.resend.com')) {
        resendPayload = body;
        return new Response(JSON.stringify({ id: 'res_123' }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const result = await dispatchAdminErrorAlert({
      fingerprint: 'fp_001',
      level: 'critical',
      service: 'asaas-subscription',
      route: 'CREATE_SUBSCRIPTION',
      code: 'edge_unhandled_500',
      message: 'Falha crítica no gateway Asaas',
      occurrences: 1,
      metadata: { clinic_id: 'clinic-1' },
    });

    expect(result.telegramSent).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(telegramPayload?.chat_id).toBe('999888777');
    expect(String(telegramPayload?.text)).toContain('CRÍTICO');
    expect(resendPayload?.to).toEqual(['jougy@gmx.com']);
    expect(String(resendPayload?.subject)).toContain('asaas-subscription');
  });

  it('deduplica alertas dentro do cooldown e respeita teto global horário de e-mails', async () => {
    let tgCalls = 0;
    let emailCalls = 0;
    let redisStep = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      if (url.includes('upstash.test.local')) {
        redisStep += 1;
        // 1st call: both blocked by cooldown -> [0, 0, 'cooldown']
        // 2nd call: tg allowed, email hourly cap reached -> [1, 0, 'hourly_cap']
        const res = redisStep === 1 ? [0, 0, 'cooldown'] : [1, 0, 'hourly_cap'];
        return new Response(JSON.stringify({ result: res }), { status: 200 });
      }
      if (url.includes('api.telegram.org')) {
        tgCalls += 1;
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      if (url.includes('api.resend.com')) {
        emailCalls += 1;
        return new Response(JSON.stringify({ id: 'res_x' }), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    });

    const cooldownRes = await dispatchAdminErrorAlert({
      fingerprint: 'fp_cooldown',
      level: 'error',
      service: 'mfa-recovery',
      route: 'verify_code',
      code: '500',
      message: 'Erro repetido',
    });
    expect(cooldownRes.telegramSent).toBe(false);
    expect(cooldownRes.emailSent).toBe(false);
    expect(cooldownRes.skippedReason).toBe('cooldown');
    expect(tgCalls).toBe(0);
    expect(emailCalls).toBe(0);

    const capRes = await dispatchAdminErrorAlert({
      fingerprint: 'fp_cap',
      level: 'error',
      service: 'mfa-recovery',
      route: 'request_code',
      code: '500',
      message: 'Outro erro com teto de email atingido',
    });
    expect(capRes.telegramSent).toBe(true);
    expect(capRes.emailSent).toBe(false);
    expect(tgCalls).toBe(1);
    expect(emailCalls).toBe(0);
  });

  it('sanitiza PII e segredos (CPF, Bearer JWT, API Keys e e-mail parcial)', () => {
    const raw =
      'User 123.456.789-01 failed with Bearer eyJhbGciOiJIUzI1NiJ9.payload123.sig key re_abcdef123456 email joao.silva@clinica.com.br';
    const clean = sanitizeAlertText(raw, 400);

    expect(clean).not.toContain('123.456.789-01');
    expect(clean).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(clean).not.toContain('re_abcdef123456');
    expect(clean).not.toContain('joao.silva@');
    expect(clean).toContain('[CPF_REDACTED]');
    expect(clean).toContain('Bearer [REDACTED]');
    expect(clean).toContain('[KEY_REDACTED]');
    expect(clean).toContain('j***@clinica.com.br');
  });

  it('reportError envia para Axiom + Telegram + jougy@gmx.com na 1ª ocorrência e deduplica nas seguintes', async () => {
    let incrValue = 0;
    const called: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = typeof input === 'string' ? input : input.toString();
      called.push(url);
      if (url.includes('upstash.test.local/pipeline')) {
        incrValue += 1;
        return new Response(
          JSON.stringify([
            { result: incrValue },
            { result: 1 },
            { result: 'OK' },
            { result: 1 },
            { result: incrValue },
            { result: 1 },
          ]),
          { status: 200 }
        );
      }
      if (url.includes('upstash.test.local')) {
        return new Response(JSON.stringify({ result: [1, 1, 'ok'] }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true, id: 'ok' }), { status: 200 });
    });

    const first = await reportError({
      service: 'whatsapp-webhook',
      code: 'edge_500',
      route: 'inbound',
      message: 'Erro inesperado no webhook',
      metadata: { clinic_id: 'c1' },
    });
    expect(first.deduplicated).toBe(false);
    expect(first.count).toBe(1);
    expect(called.some((u) => u.includes('api.axiom.co'))).toBe(true);
    expect(called.some((u) => u.includes('api.telegram.org'))).toBe(true);
    expect(called.some((u) => u.includes('api.resend.com'))).toBe(true);

    called.length = 0;
    const second = await reportError({
      service: 'whatsapp-webhook',
      code: 'edge_500',
      route: 'inbound',
      message: 'Erro inesperado no webhook',
    });
    expect(second.deduplicated).toBe(true);
    expect(second.count).toBe(2);
    expect(called.some((u) => u.includes('api.axiom.co'))).toBe(false);
    expect(called.some((u) => u.includes('api.telegram.org'))).toBe(false);
    expect(called.some((u) => u.includes('api.resend.com'))).toBe(false);
  });
});
