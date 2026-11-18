/**
 * Error Deduplication & Coalescing (Upstash Redis -> Axiom).
 * Prevents log storms from loops by aggregating repeated errors in Redis
 * and flushing consolidated counts to Axiom. Never writes to Postgres or S3.
 */

import { ingestToAxiom, type AxiomEvent } from './telemetry-axiom.ts';

export interface ErrorReportInput {
  code: string | number;
  route: string;
  message: string;
  windowSec?: number;
  metadata?: Record<string, unknown>;
}

const DEFAULT_WINDOW_SEC = 60;
const PENDING_SET_KEY = 'err:pending_flush';

function getEnv(key: string): string | undefined {
  const denoEnv = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno?.env;
  if (denoEnv) return denoEnv.get(key);
  if (typeof process !== 'undefined' && process.env) return process.env[key];
  return undefined;
}

export function normalizeErrorFingerprint(code: string | number, route: string, message: string): string {
  const normalizedMsg = message
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
    .replace(/\d{4,}/g, '<num>')
    .trim()
    .slice(0, 160);

  const raw = `${code}|${route}|${normalizedMsg}`;
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function upstashPipeline(commands: Array<Array<string | number>>): Promise<Array<{ result: unknown }> | null> {
  const url = getEnv('UPSTASH_REDIS_REST_URL');
  const token = getEnv('UPSTASH_REDIS_REST_TOKEN');
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(commands),
    });
    if (!res.ok) return null;
    return (await res.json()) as Array<{ result: unknown }>;
  } catch {
    return null;
  }
}

export async function reportError(input: ErrorReportInput): Promise<{ deduplicated: boolean; count: number }> {
  const windowSec = input.windowSec ?? DEFAULT_WINDOW_SEC;
  const fp = normalizeErrorFingerprint(input.code, input.route, input.message);
  const countKey = `err:count:${fp}`;
  const metaKey = `err:meta:${fp}`;

  const pipelineRes = await upstashPipeline([
    ['INCR', countKey],
    ['EXPIRE', countKey, windowSec],
    ['SET', metaKey, JSON.stringify({ code: input.code, route: input.route, message: input.message, windowSec }), 'EX', windowSec, 'NX'],
    ['SADD', PENDING_SET_KEY, fp],
  ]);

  const count = Number(pipelineRes?.[0]?.result ?? 1);

  if (count === 1 || !pipelineRes) {
    await ingestToAxiom([
      {
        level: 'error',
        error_code: input.code,
        route: input.route,
        message: input.message,
        occurrences: 1,
        window_sec: windowSec,
        metadata: input.metadata,
      },
    ]);
    return { deduplicated: false, count };
  }

  return { deduplicated: true, count };
}

export async function flushPendingErrors(): Promise<number> {
  const membersRes = await upstashPipeline([['SMEMBERS', PENDING_SET_KEY]]);
  const fps = (membersRes?.[0]?.result as string[] | undefined) ?? [];
  if (fps.length === 0) return 0;

  const fetchCmds: Array<Array<string | number>> = [];
  for (const fp of fps) {
    fetchCmds.push(['GET', `err:count:${fp}`]);
    fetchCmds.push(['GET', `err:meta:${fp}`]);
  }

  const dataRes = await upstashPipeline(fetchCmds);
  if (!dataRes) return 0;

  const events: AxiomEvent[] = [];
  const cleanupCmds: Array<Array<string | number>> = [['DEL', PENDING_SET_KEY]];

  for (let i = 0; i < fps.length; i++) {
    const fp = fps[i];
    const totalCount = Number(dataRes[i * 2]?.result ?? 0);
    const metaRaw = dataRes[i * 2 + 1]?.result as string | null;

    cleanupCmds.push(['DEL', `err:count:${fp}`, `err:meta:${fp}`]);

    // First occurrence was already sent immediately; flush only the remaining aggregated count.
    const extraOccurrences = totalCount - 1;
    if (extraOccurrences > 0 && metaRaw) {
      const meta = JSON.parse(metaRaw) as { code: string | number; route: string; message: string; windowSec: number };
      events.push({
        level: 'error',
        error_code: meta.code,
        route: meta.route,
        message: meta.message,
        occurrences: extraOccurrences,
        window_sec: meta.windowSec,
      });
    }
  }

  if (events.length > 0) {
    await ingestToAxiom(events);
  }
  await upstashPipeline(cleanupCmds);
  return events.length;
}
