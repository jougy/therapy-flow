import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  enqueueToQStash,
  publishToQStash,
  verifyQStashSignature,
} from '../../supabase/functions/_shared/qstash';

function b64Url(bytes: Uint8Array | string): string {
  const buf = typeof bytes === 'string' ? Buffer.from(bytes, 'utf8') : Buffer.from(bytes);
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function signQStashJwt(payload: Record<string, unknown>, secret: string): Promise<string> {
  const headerB64 = b64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payloadB64 = b64Url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${headerB64}.${payloadB64}`));
  return `${headerB64}.${payloadB64}.${b64Url(new Uint8Array(sig))}`;
}

async function sha256B64Url(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return b64Url(new Uint8Array(digest));
}

describe('Upstash QStash Client & Signature Verifier', () => {
  const origEnv = { ...process.env };

  beforeEach(() => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = 'sig_current_secret_123';
    process.env.QSTASH_NEXT_SIGNING_KEY = 'sig_next_secret_456';
    process.env.QSTASH_TOKEN = 'qstash_test_token';
    process.env.QSTASH_URL = 'https://qstash.upstash.io';
    process.env.SUPABASE_URL = 'https://ggytwbnintrftgzvjczs.supabase.co';
  });

  afterEach(() => {
    process.env = { ...origEnv };
    vi.restoreAllMocks();
  });

  it('verifies valid Upstash-Signature with current signing key and body hash', async () => {
    const rawBody = JSON.stringify({ action: 'synthetic_healthcheck' });
    const now = Math.floor(Date.now() / 1000);
    const jwt = await signQStashJwt(
      {
        iss: 'Upstash',
        sub: 'https://ggytwbnintrftgzvjczs.supabase.co/functions/v1/qstash-cron-dispatcher',
        exp: now + 300,
        nbf: now - 10,
        body: await sha256B64Url(rawBody),
      },
      'sig_current_secret_123'
    );

    const req = new Request('https://ggytwbnintrftgzvjczs.supabase.co/functions/v1/qstash-cron-dispatcher', {
      method: 'POST',
      headers: { 'Upstash-Signature': jwt },
    });

    const res = await verifyQStashSignature(
      req,
      rawBody,
      'https://ggytwbnintrftgzvjczs.supabase.co/functions/v1/qstash-cron-dispatcher'
    );
    expect(res.valid).toBe(true);
  });

  it('supports key rotation using QSTASH_NEXT_SIGNING_KEY', async () => {
    const rawBody = JSON.stringify({ ok: true });
    const now = Math.floor(Date.now() / 1000);
    const jwt = await signQStashJwt(
      {
        iss: 'Upstash',
        sub: 'https://ggytwbnintrftgzvjczs.supabase.co/functions/v1/qstash-billing-worker',
        exp: now + 300,
        body: await sha256B64Url(rawBody),
      },
      'sig_next_secret_456'
    );

    const req = new Request('https://ggytwbnintrftgzvjczs.supabase.co/functions/v1/qstash-billing-worker', {
      method: 'POST',
      headers: { 'Upstash-Signature': jwt },
    });

    const res = await verifyQStashSignature(req, rawBody);
    expect(res.valid).toBe(true);
  });

  it('rejects tampered body, expired token, or missing signature', async () => {
    const reqMissing = new Request('https://example.com', { method: 'POST' });
    expect((await verifyQStashSignature(reqMissing, '{}')).reason).toBe('missing_signature');

    const now = Math.floor(Date.now() / 1000);
    const jwtTampered = await signQStashJwt(
      { iss: 'Upstash', exp: now + 300, body: await sha256B64Url('{"a":1}') },
      'sig_current_secret_123'
    );
    const reqTampered = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Upstash-Signature': jwtTampered },
    });
    expect((await verifyQStashSignature(reqTampered, '{"a":2}')).reason).toBe('body_hash_mismatch');

    const jwtExpired = await signQStashJwt(
      { iss: 'Upstash', exp: now - 60, body: await sha256B64Url('{}') },
      'sig_current_secret_123'
    );
    const reqExpired = new Request('https://example.com', {
      method: 'POST',
      headers: { 'Upstash-Signature': jwtExpired },
    });
    expect((await verifyQStashSignature(reqExpired, '{}')).reason).toBe('token_expired');
  });

  it('fails open when QSTASH_TOKEN is not configured', async () => {
    delete process.env.QSTASH_TOKEN;
    const res = await publishToQStash({
      targetUrl: 'https://example.com/fn',
      body: { test: 1 },
    });
    expect(res.queued).toBe(false);
    expect(res.reason).toBe('qstash_not_configured');
  });

  it('sends correct headers on enqueueToQStash including DLQ callback and flow control', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ messageId: 'msg_123', deduplicated: false }), { status: 201 })
    );

    const res = await enqueueToQStash('zap-outbound-platform', {
      targetUrl: 'https://ggytwbnintrftgzvjczs.supabase.co/functions/v1/qstash-zap-worker',
      body: { dispatchId: 'd1' },
      retries: 3,
      deduplicationId: 'camp:1:5511999999999',
      flowControl: { key: 'chip:1', parallelism: 1 },
    });

    expect(res.queued).toBe(true);
    expect(res.messageId).toBe('msg_123');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/v2/enqueue/zap-outbound-platform/');
    const headers = init?.headers as Record<string, string>;
    expect(headers['Upstash-Retries']).toBe('3');
    expect(headers['Upstash-Deduplication-Id']).toBe('camp:1:5511999999999');
    expect(headers['Upstash-Failure-Callback']).toContain('platform-observability?action=qstash_failure_callback');
    expect(headers['Upstash-Flow-Control-Key']).toBe('chip:1');
    expect(headers['Upstash-Flow-Control-Value']).toBe('parallelism=1');
  });
});
