/**
 * Minimalist Axiom HTTP ingestion client for Edge Functions.
 * Never throws on telemetry failure so primary request flows stay resilient.
 */

export interface AxiomEvent {
  _time?: string;
  level: 'info' | 'warn' | 'error';
  service?: string;
  error_code?: string | number;
  route?: string;
  message: string;
  occurrences?: number;
  window_sec?: number;
  metadata?: Record<string, unknown>;
}

function getEnv(key: string): string | undefined {
  const denoEnv = (globalThis as { Deno?: { env?: { get(k: string): string | undefined } } }).Deno?.env;
  if (denoEnv) return denoEnv.get(key);
  if (typeof process !== 'undefined' && process.env) return process.env[key];
  return undefined;
}

export async function ingestToAxiom(events: AxiomEvent[]): Promise<boolean> {
  if (events.length === 0) return true;

  const token = getEnv('AXIOM_TOKEN');
  const dataset = getEnv('AXIOM_DATASET') ?? 'pluri-health-logs';
  if (!token) return false;

  const now = new Date().toISOString();
  const payload = events.map((ev) => ({
    ...ev,
    _time: ev._time ?? now,
    service: ev.service ?? 'pluri-health-edge',
  }));

  try {
    const res = await fetch(`https://api.axiom.co/v1/datasets/${encodeURIComponent(dataset)}/ingest`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
