const TRANSIENT_STATUS_CODES = new Set([429, 502, 503, 504, 522, 524]);

const TRANSIENT_MESSAGE_PATTERNS = [
  "service unavailable",
  "503",
  "502",
  "504",
  "522",
  "524",
  "bad gateway",
  "gateway timeout",
  "too many requests",
  "failed to fetch",
  "networkerror",
  "network request failed",
  "timeout",
  "econnreset",
  "etimedout",
];

// Circuit Breaker leve em memória para evitar tempestade de retries quando o banco está degradado
let consecutiveTransientFailures = 0;
let circuitOpenUntil = 0;
const CIRCUIT_FAILURE_THRESHOLD = 5;
const CIRCUIT_OPEN_MS = 20_000;

export function isSupabaseCircuitOpen(): boolean {
  return Date.now() < circuitOpenUntil;
}

/**
 * Identifica erros transientes de infraestrutura/rede (ex.: 503 Service Unavailable,
 * timeouts ou quedas momentâneas) que justificam retry controlado com backoff.
 */
export function isTransientSupabaseError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === "object") {
    const errObj = error as { status?: unknown; code?: unknown; message?: unknown; details?: unknown };
    if (typeof errObj.status === "number" && TRANSIENT_STATUS_CODES.has(errObj.status)) {
      return true;
    }
    if (typeof errObj.code === "string" && TRANSIENT_STATUS_CODES.has(Number(errObj.code))) {
      return true;
    }
    const text = [errObj.message, errObj.details]
      .filter((part): part is string => typeof part === "string")
      .join(" ")
      .toLowerCase();
    if (text && TRANSIENT_MESSAGE_PATTERNS.some((pattern) => text.includes(pattern))) {
      return true;
    }
  }

  if (typeof error === "string") {
    const lower = error.toLowerCase();
    return TRANSIENT_MESSAGE_PATTERNS.some((pattern) => lower.includes(pattern));
  }

  return false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executa uma chamada Supabase/assíncrona com retry exponencial limitado + jitter
 * apenas para erros transientes (503, 502, 504, 429, falhas de rede).
 */
export async function withTransientRetry<T extends { error?: unknown }>(
  operation: () => Promise<T>,
  options?: { maxRetries?: number; baseDelayMs?: number }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 2;
  const baseDelayMs = options?.baseDelayMs ?? 400;

  let attempt = 0;
  while (true) {
    if (isSupabaseCircuitOpen()) {
      return await operation();
    }

    try {
      const result = await operation();
      if (!result?.error) {
        consecutiveTransientFailures = 0;
        return result;
      }
      if (!isTransientSupabaseError(result.error)) {
        return result;
      }
      consecutiveTransientFailures += 1;
      if (consecutiveTransientFailures >= CIRCUIT_FAILURE_THRESHOLD) {
        circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
      }
      if (attempt >= maxRetries || isSupabaseCircuitOpen()) {
        return result;
      }
    } catch (err) {
      if (!isTransientSupabaseError(err)) {
        throw err;
      }
      consecutiveTransientFailures += 1;
      if (consecutiveTransientFailures >= CIRCUIT_FAILURE_THRESHOLD) {
        circuitOpenUntil = Date.now() + CIRCUIT_OPEN_MS;
      }
      if (attempt >= maxRetries || isSupabaseCircuitOpen()) {
        throw err;
      }
    }

    const jitter = Math.floor(Math.random() * 150);
    const delay = baseDelayMs * Math.pow(3, attempt) + jitter;
    attempt += 1;
    await sleep(delay);
  }
}
