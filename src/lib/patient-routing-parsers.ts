import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Verifica se a string informada é estritamente um UUID V4 válido.
 */
export function isUuid(value: string | undefined | null): boolean {
  if (!value || typeof value !== "string" || value.length > 64) return false;
  const str = value.trim();
  return UUID_REGEX.test(str);
}

export type ParsedSessionRef = {
  raw: string;
  isNew: boolean;
  isUuid: boolean;
  sessionIndex: number | null;
  isValid: boolean;
};

export type FetchSessionResult = {
  data: SessionRow | null;
  error: Error | null;
  isNew: boolean;
  sessionIndex: number | null;
  patient: PatientRow | null;
  totalSessions: number;
};

/**
 * Interpreta uma referência de atendimento em rota (ex: 'novo', 'ATD-1', 'ATD-#1', 'ATD-001', '1', UUID).
 */
export function parseSessionRef(ref: string | undefined | null): ParsedSessionRef {
  if (!ref || typeof ref !== "string" || ref.length > 100 || !ref.trim()) {
    return { raw: "", isNew: false, isUuid: false, sessionIndex: null, isValid: false };
  }
  const clean = ref.trim();
  if (clean.toLowerCase() === "novo") {
    return { raw: clean, isNew: true, isUuid: false, sessionIndex: null, isValid: true };
  }
  if (isUuid(clean)) {
    return { raw: clean, isNew: false, isUuid: true, sessionIndex: null, isValid: true };
  }
  const match = clean.match(/^(?:ATD[-_ #]*|#)?(\d+)$/i);
  if (match) {
    const idx = parseInt(match[1], 10);
    if (Number.isFinite(idx) && idx > 0) {
      return { raw: clean, isNew: false, isUuid: false, sessionIndex: idx, isValid: true };
    }
  }
  return { raw: clean, isNew: false, isUuid: false, sessionIndex: null, isValid: false };
}

/**
 * Formata um código amigável de exibição do atendimento (ex: ATD-1).
 */
export function formatSessionDisplayCode(sessionIndexOrRef: number | string): string {
  if (typeof sessionIndexOrRef === "number") {
    return `ATD-${sessionIndexOrRef}`;
  }
  const parsed = parseSessionRef(sessionIndexOrRef);
  if (parsed.sessionIndex !== null) {
    return `ATD-${parsed.sessionIndex}`;
  }
  return sessionIndexOrRef;
}

/**
 * Retorna a chave primária de rota de uma sessão/atendimento (dando preferência a ATD-N se o índice existir).
 */
export function getSessionRouteKey(
  session: { id?: string; session_index?: number | null } | number | string
): string {
  if (typeof session === "number") {
    return session > 0 ? `ATD-${session}` : String(session);
  }
  if (typeof session === "string") {
    const parsed = parseSessionRef(session);
    if (parsed.isNew) return "novo";
    if (parsed.sessionIndex !== null) return `ATD-${parsed.sessionIndex}`;
    return session.trim();
  }
  if (session.session_index && session.session_index > 0) {
    return `ATD-${session.session_index}`;
  }
  if (session.id && session.id.trim()) {
    return session.id.trim();
  }
  return "";
}

/**
 * Retorna a chave primária de rota do paciente (dando preferência ao patient_code limpo).
 */
export function getPatientRouteKey(patient: { id: string; patient_code?: string | null }): string {
  if (patient.patient_code && patient.patient_code.trim()) {
    return patient.patient_code.trim();
  }
  return patient.id;
}

/**
 * Monta o caminho relativo da rota do paciente (ex: /pacientes/PAC-001 ou /pacientes/PAC-001/cadastro).
 */
export function getPatientPath(
  patient: { id: string; patient_code?: string | null } | string,
  subpath?: string
): string {
  const key = typeof patient === "string" ? patient : getPatientRouteKey(patient);
  const cleanSubpath = subpath ? (subpath.startsWith("/") ? subpath : `/${subpath}`) : "";
  return `/pacientes/${key}${cleanSubpath}`;
}

/**
 * Monta o caminho relativo da rota de um atendimento do paciente (ex: /pacientes/PAC-001/sessao/ATD-1).
 */
export function getPatientSessionPath(
  patient: { id: string; patient_code?: string | null } | string,
  sessionRef: { id?: string; session_index?: number | null } | string | number,
  subpath?: string
): string {
  const patientKey = typeof patient === "string" ? (patient.trim() || "") : getPatientRouteKey(patient);
  const sessionKey = getSessionRouteKey(sessionRef);
  const cleanSubpath = subpath ? (subpath.startsWith("/") ? subpath : `/${subpath}`) : "";
  return `/pacientes/${patientKey}/sessao/${sessionKey}${cleanSubpath}`;
}

/**
 * Monta o caminho completo com o escopo da clínica (ex: /clinica/saude-total/pacientes/PAC-001).
 */
export function getClinicPatientPath(
  clinicRouteKey: string | undefined | null,
  patient: { id: string; patient_code?: string | null } | string,
  subpath?: string
): string {
  const patientPath = getPatientPath(patient, subpath);
  if (clinicRouteKey && clinicRouteKey.trim()) {
    return `/clinica/${clinicRouteKey.trim()}${patientPath}`;
  }
  return patientPath;
}

/**
 * Monta o caminho completo da sessão com o escopo da clínica (ex: /clinica/saude-total/pacientes/PAC-001/sessao/ATD-1).
 */
export function getClinicPatientSessionPath(
  clinicRouteKey: string | undefined | null,
  patient: { id: string; patient_code?: string | null } | string,
  sessionRef: { id?: string; session_index?: number | null } | string | number,
  subpath?: string
): string {
  const sessionPath = getPatientSessionPath(patient, sessionRef, subpath);
  if (clinicRouteKey && clinicRouteKey.trim()) {
    return `/clinica/${clinicRouteKey.trim()}${sessionPath}`;
  }
  return sessionPath;
}

/**
 * Busca um paciente por referência de rota (tanto por patient_code quanto por id UUID)
 * com blindagem multi-tenancy rigorosa por clínica.
 */
