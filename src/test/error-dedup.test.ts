import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportError, flushPendingErrors, normalizeErrorFingerprint } from '../../supabase/functions/_shared/error-dedup';

describe('error-dedup (Upstash -> Axiom)', () => {
  beforeEach(() => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock-upstash.local';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-upstash-token';
    process.env.AXIOM_TOKEN = 'mock-axiom-token';
    process.env.AXIOM_DATASET = 'pluri-test';
  });

  it('normalizes UUIDs and numbers into the same fingerprint', () => {
    const fp1 = normalizeErrorFingerprint(504, '/api/sync', 'Timeout for patient 123e4567-e89b-12d3-a456-426614174000 after 5000ms');
    const fp2 = normalizeErrorFingerprint(504, '/api/sync', 'Timeout for patient 999e4567-e89b-12d3-a456-426614174999 after 8200ms');
    expect(fp1).toBe(fp2);
  });

  it('deduplicates 100 identical errors into 1 immediate + 1 consolidated flush (99 occurrences)', async () => {
    const store = new Map<string, string>();
    const pendingSet = new Set<string>();
    const axiomPayloads: unknown[][] = [];

    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      const body = JSON.parse((init?.body as string) ?? '[]');

      if (url.includes('mock-upstash.local/pipeline')) {
        const results = (body as Array<Array<string | number>>).map((cmd) => {
          const op = cmd[0];
          if (op === 'INCR') {
            const key = String(cmd[1]);
            const next = Number(store.get(key) ?? '0') + 1;
            store.set(key, String(next));
            return { result: next };
          }
          if (op === 'SET') {
            const key = String(cmd[1]);
            if (!store.has(key)) store.set(key, String(cmd[2]));
            return { result: 'OK' };
          }
          if (op === 'SADD') {
            pendingSet.add(String(cmd[2]));
            return { result: 1 };
          }
          if (op === 'SMEMBERS') {
            return { result: Array.from(pendingSet) };
          }
          if (op === 'GET') {
            return { result: store.get(String(cmd[1])) ?? null };
          }
          if (op === 'DEL') {
            for (let i = 1; i < cmd.length; i++) {
              const k = String(cmd[i]);
              if (k === 'err:pending_flush') pendingSet.clear();
              else store.delete(k);
            }
            return { result: 1 };
          }
          return { result: 1 };
        });
        return new Response(JSON.stringify(results), { status: 200 });
      }

      if (url.includes('api.axiom.co')) {
        axiomPayloads.push(body as unknown[]);
        return new Response('{}', { status: 200 });
      }

      return new Response('Not Found', { status: 404 });
    });

    vi.stubGlobal('fetch', fetchMock);

    for (let i = 0; i < 100; i++) {
      const res = await reportError({
        code: 504,
        route: '/functions/v1/sync',
        message: 'Upstream gateway timeout',
      });
      if (i === 0) expect(res).toEqual({ deduplicated: false, count: 1 });
      else expect(res).toEqual({ deduplicated: true, count: i + 1 });
    }

    expect(axiomPayloads).toHaveLength(1);
    expect((axiomPayloads[0][0] as { occurrences: number }).occurrences).toBe(1);

    const flushed = await flushPendingErrors();
    expect(flushed).toBe(1);
    expect(axiomPayloads).toHaveLength(2);
    expect((axiomPayloads[1][0] as { occurrences: number }).occurrences).toBe(99);

    vi.unstubAllGlobals();
  });
});
