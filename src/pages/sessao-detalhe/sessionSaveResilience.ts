import type { ErrorDetails } from "@/components/sessions";
import { isUuid, resolveSessionReference, type PatientRow, type SessionRow } from "@/lib/patient-routing";
import { localTelemetryManager } from "@/lib/telemetry-local-store";
import { isNetworkOrOfflineError } from "@/services/clinicAgendaService";

const TRANSIENT_NETWORK_PATTERNS = [
  "fetch failed",
  "load failed",
  "failed to fetch",
  "networkerror",
  "network request failed",
  "network connection was lost",
  "econnreset",
  "aborted",
  "timeout",
  "socket",
] as const;

function extractErrorMessage(error: unknown): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message || "";
  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message ?? "");
  }
  return "";
}

/**
 * Detecta falhas transitórias de rede/socket (ex.: TypeError: Load failed no iOS Safari)
 * para retry rápido e fallback offline seguro sem perda da evolução clínica.
 */
export function isTransientNetworkError(error: unknown): boolean {
  if (isNetworkOrOfflineError(error)) {
    return true;
  }
  if (!error) {
    return false;
  }

  const msg = extractErrorMessage(error).toLowerCase();
  if (TRANSIENT_NETWORK_PATTERNS.some((pattern) => msg.includes(pattern))) {
    return true;
  }

  if (error instanceof TypeError && /fetch|load|network|internet|offline/i.test(msg)) {
    return true;
  }

  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }

  return false;
}

export interface ExecuteSessionMutationResult<T> {
  data: T | null;
  error: unknown;
  retried: boolean;
  networkFailed: boolean;
}

/**
 * Executa mutação de atendimento (insert/update) com 1 retry automático em erros transitórios de rede.
 * Erros de banco/RLS/validação retornam imediatamente sem retry.
 */
export async function executeSessionMutationWithRetry<T>(
  mutationFn: () => Promise<{ data: T | null; error: unknown }>,
  options?: { maxRetries?: number; retryDelayMs?: number }
): Promise<ExecuteSessionMutationResult<T>> {
  const maxRetries = Math.max(0, options?.maxRetries ?? 1);
  const retryDelayMs = Math.max(0, options?.retryDelayMs ?? 450);

  let lastData: T | null = null;
  let lastError: unknown = null;
  let retried = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      retried = true;
      if (retryDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }

    try {
      const result = await mutationFn();
      if (!result.error) {
        return {
          data: result.data,
          error: null,
          retried,
          networkFailed: false,
        };
      }
      lastData = result.data;
      lastError = result.error;
    } catch (caughtError) {
      lastData = null;
      lastError = caughtError;
    }

    if (!isTransientNetworkError(lastError) || attempt >= maxRetries) {
      break;
    }
  }

  return {
    data: lastData,
    error: lastError,
    retried,
    networkFailed: Boolean(lastError && isTransientNetworkError(lastError)),
  };
}

export interface ResolveTargetSessionIdParams {
  resolvedSessionId: string | null;
  activeSessionId?: string | null;
  sessionId?: string;
  patientId?: string;
  clinicId?: string | null;
  clinicRouteKey?: string | null;
  knownPatient?: PatientRow | null;
  knownSessions?: SessionRow[];
}

/**
 * Resolve o UUID real do atendimento para gravação mesmo quando a rota usa código sequencial (ex.: ATD-66).
 */
export async function resolveTargetSessionIdForSave(
  params: ResolveTargetSessionIdParams
): Promise<string | null> {
  const direct =
    params.resolvedSessionId ||
    params.activeSessionId ||
    (params.sessionId && isUuid(params.sessionId) ? params.sessionId : null);

  if (direct) {
    return direct;
  }

  const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
  if (!params.sessionId || !params.patientId || isOffline) {
    return null;
  }

  try {
    const resolved = await resolveSessionReference(
      params.sessionId,
      params.patientId,
      params.clinicId,
      params.clinicRouteKey,
      {
        knownPatient: params.knownPatient,
        knownSessions: params.knownSessions,
      }
    );
    return resolved.data?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Resume o erro técnico para exibição útil no toast sem esconder a causa do usuário/suporte.
 */
export function formatSessionErrorToastDescription(details: ErrorDetails): string {
  const raw = (details.message || "").replace(/\s+/g, " ").trim();
  if (!raw || raw === "Erro sem mensagem técnica retornada.") {
    return "Clique em i para ver o erro completo.";
  }
  const summary = raw.length > 110 ? `${raw.slice(0, 107).trimEnd()}...` : raw;
  return `${summary} Clique em (i) para detalhes.`;
}

/**
 * Registra o erro técnico real do atendimento na telemetria Zero-PHI (Axiom + alerta admin).
 */
export function reportSessionActionError(
  title: string,
  details: ErrorDetails,
  extra?: { sessionId?: string | null; isNew?: boolean; targetStatus?: string }
): void {
  const codeSuffix = details.code ? ` [${details.code}]` : "";
  localTelemetryManager.recordError({
    scope: "session.save_error",
    message: `${title}: ${details.message}${codeSuffix}`,
    context: {
      actionContext: details.context,
      code: details.code,
      details: details.details,
      hint: details.hint,
      isNew: extra?.isNew,
      targetStatus: extra?.targetStatus,
      hasSessionId: Boolean(extra?.sessionId),
    },
  });
}
