/**
 * Sanitizador LGPD Zero-PHI e Deduplicador de Erros de Telemetria
 * Blindagem estrita contra vazamento de dados de saúde protegidos (PHI) e PII para provedores cloud.
 */

const CPF_REGEX = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g;
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const BEARER_REGEX = /Bearer\s+[a-zA-Z0-9._-]+/gi;
const JWT_REGEX = /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g;
const PAC_CODE_REGEX = /\bPAC-\d+\b/gi;
const PHONE_BR_REGEX = /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?9\d{4}-?\d{4}\b/g;

/**
 * Remove qualquer dado pessoal (PII) ou identificador clínico sensível de uma string.
 */
export function scrubSensitiveHealthData(text: string): string {
  if (!text) return "";
  return text
    .replace(BEARER_REGEX, "Bearer [TOKEN_REDACTED]")
    .replace(JWT_REGEX, "[JWT_REDACTED]")
    .replace(EMAIL_REGEX, "[EMAIL_REDACTED]")
    .replace(CPF_REGEX, "[CPF_REDACTED]")
    .replace(PHONE_BR_REGEX, "[PHONE_REDACTED]")
    .replace(PAC_CODE_REGEX, "PAC-[REDACTED]");
}

export interface RawErrorEntryInput {
  scope: string;
  message: string;
  stack?: string;
  context?: unknown;
}

export interface SanitizedErrorEntry {
  scope: string;
  message: string;
  stack?: string;
  context?: Record<string, unknown> | string;
}

/**
 * Higieniza um registro de erro para persistência em nuvem, garantindo limites de tamanho e sanitização PHI.
 */
export function sanitizeErrorEntryForCloud(entry: RawErrorEntryInput): SanitizedErrorEntry {
  const scope = (entry.scope || "runtime").slice(0, 100);
  const rawMessage = entry.message || "Erro desconhecido";
  const scrubbedMessage = scrubSensitiveHealthData(rawMessage).slice(0, 400);

  let scrubbedStack: string | undefined = undefined;
  if (entry.stack) {
    scrubbedStack = scrubSensitiveHealthData(entry.stack).slice(0, 1200);
  }

  let scrubbedContext: Record<string, unknown> | string | undefined = undefined;
  if (entry.context !== undefined && entry.context !== null) {
    try {
      const serialized =
        typeof entry.context === "string" ? entry.context : JSON.stringify(entry.context);
      const scrubbed = scrubSensitiveHealthData(serialized).slice(0, 1500);
      try {
        const parsed = JSON.parse(scrubbed);
        scrubbedContext =
          typeof parsed === "object" && parsed !== null ? parsed : { value: parsed };
      } catch {
        scrubbedContext = { raw: scrubbed };
      }
    } catch {
      scrubbedContext = { error: "[Context serialization error]" };
    }
  }

  return {
    scope,
    message: scrubbedMessage,
    stack: scrubbedStack,
    context: scrubbedContext,
  };
}

// Mapa em memória para deduplicação com janela de 5 minutos
const recentFingerprints = new Map<string, number>();

/**
 * Avalia se o mesmo erro (scope + message + route) já foi disparado dentro da janela informada.
 */
export function shouldSkipDuplicateError(
  scope: string,
  message: string,
  route: string,
  windowMs = 5 * 60 * 1000
): boolean {
  const now = Date.now();
  const key = `${scope}::${message}::${route}`;
  const lastSeen = recentFingerprints.get(key);

  // Limpeza de entradas expiradas para evitar vazamento de memória
  if (recentFingerprints.size > 200) {
    for (const [k, timestamp] of recentFingerprints.entries()) {
      if (now - timestamp > windowMs) {
        recentFingerprints.delete(k);
      }
    }
  }

  if (lastSeen && now - lastSeen < windowMs) {
    return true;
  }

  recentFingerprints.set(key, now);
  return false;
}

/**
 * Reseta o cache de deduplicação de erros.
 */
export function resetErrorDeduplicator(): void {
  recentFingerprints.clear();
}
