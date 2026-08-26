import type { SessionFormValues } from "@/components/sessions";

export interface SessionDraftEnvelope {
  clinicId: string;
  patientId: string;
  sessionId: string;
  savedAt: number;
  values: SessionFormValues;
}

const DRAFT_PREFIX = "therapy-flow:session-draft:v1:";

export function getSessionDraftStorageKey(clinicId: string, patientId: string, sessionId: string): string {
  return `${DRAFT_PREFIX}${clinicId.trim()}:${patientId.trim()}:${sessionId.trim()}`;
}

export function saveSessionDraft(
  clinicId: string,
  patientId: string,
  sessionId: string,
  values: SessionFormValues
): void {
  if (!clinicId || !patientId || !sessionId || typeof window === "undefined") return;

  try {
    if (typeof window.localStorage?.setItem !== "function") return;
    const envelope: SessionDraftEnvelope = {
      clinicId,
      patientId,
      sessionId,
      savedAt: Date.now(),
      values,
    };
    window.localStorage.setItem(getSessionDraftStorageKey(clinicId, patientId, sessionId), JSON.stringify(envelope));
  } catch (err) {
    console.warn("Falha ao salvar rascunho local de atendimento:", err);
  }
}

export function getSessionDraft(
  clinicId?: string | null,
  patientId?: string | null,
  sessionId?: string | null
): SessionDraftEnvelope | null {
  if (!clinicId || !patientId || !sessionId || typeof window === "undefined") return null;

  try {
    if (typeof window.localStorage?.getItem !== "function") return null;
    const raw = window.localStorage.getItem(getSessionDraftStorageKey(clinicId, patientId, sessionId));
    if (!raw) return null;

    const envelope = JSON.parse(raw) as SessionDraftEnvelope;
    if (!envelope || typeof envelope !== "object" || envelope.sessionId !== sessionId) {
      return null;
    }
    return envelope;
  } catch {
    return null;
  }
}

export function clearSessionDraft(
  clinicId?: string | null,
  patientId?: string | null,
  sessionId?: string | null
): void {
  if (!clinicId || !patientId || !sessionId || typeof window === "undefined") return;

  try {
    if (typeof window.localStorage?.removeItem !== "function") return;
    window.localStorage.removeItem(getSessionDraftStorageKey(clinicId, patientId, sessionId));
  } catch {
    // Ignore
  }
}
