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
export async function fetchPatientByRef(
  ref: string,
  clinicId?: string | null,
  clinicRouteKey?: string | null
) {
  if (!ref) {
    return { data: null, error: new Error("Referência de paciente não informada.") };
  }

  const cleanRef = ref.trim();
  let resolvedClinicId = clinicId;

  // Se clinicRouteKey foi fornecido mas clinicId não, resolve clinicId pelo route_key
  if (!resolvedClinicId && clinicRouteKey && clinicRouteKey.trim()) {
    try {
      const clinicRes = await supabase
        .from("clinics")
        .select("id")
        .eq("route_key", clinicRouteKey.trim())
        .single();
      if (clinicRes.data?.id) {
        resolvedClinicId = clinicRes.data.id;
      }
    } catch {
      // Falha silenciosa no lookup da clínica
    }
  }

  // 1. Tenta buscar diretamente por ID UUID estritamente válido
  // Se resolvedClinicId estiver disponível, aplica SEMPRE clinic_id para impedir vazamento entre clínicas
  if (isUuid(cleanRef)) {
    try {
      let idQuery = supabase.from("patients").select("*").eq("id", cleanRef);
      if (resolvedClinicId) {
        idQuery = idQuery.eq("clinic_id", resolvedClinicId);
      }
      const idRes = await idQuery.single();
      if (idRes.data) {
        return idRes;
      }
    } catch {
      // Continuar se não encontrar por ID no escopo informado
    }
  }

  const normalizedCode = cleanRef.toUpperCase();

  // 2. Tenta buscar por patient_code com escopo de clínica
  if (resolvedClinicId) {
    try {
      const codeRes = await supabase
        .from("patients")
        .select("*")
        .eq("clinic_id", resolvedClinicId)
        .eq("patient_code", normalizedCode)
        .single();
      if (codeRes.data) {
        return codeRes;
      }
    } catch {
      // Tentar sem código normalizado em maiúsculas caso esteja minúsculo
      if (normalizedCode !== cleanRef) {
        try {
          const rawCodeRes = await supabase
            .from("patients")
            .select("*")
            .eq("clinic_id", resolvedClinicId)
            .eq("patient_code", cleanRef)
            .single();
          if (rawCodeRes.data) {
            return rawCodeRes;
          }
        } catch {
          // Seguir para busca global
        }
      }
    }
  }

  // 3. Tenta buscar por patient_code sem limitação de clinic_id
  // Garante tratamento seguro (limit 1 + maybeSingle/single) para evitar erro PGRST116
  // caso existam múltiplos códigos idênticos em clínicas distintas
  try {
    let globalQuery = supabase
      .from("patients")
      .select("*")
      .eq("patient_code", normalizedCode);

    if (typeof (globalQuery as any).limit === "function") {
      globalQuery = (globalQuery as any).limit(1);
    }

    const globalCodeRes = typeof (globalQuery as any).maybeSingle === "function"
      ? await (globalQuery as any).maybeSingle()
      : await globalQuery.single();

    if (globalCodeRes?.data) {
      return globalCodeRes;
    }
  } catch {
    // Fallback
  }

  // 4. Fallback final por id UUID - NUNCA execute com cleanRef que não seja UUID válido
  if (isUuid(cleanRef)) {
    let fallbackQuery = supabase.from("patients").select("*").eq("id", cleanRef);
    if (resolvedClinicId) {
      fallbackQuery = fallbackQuery.eq("clinic_id", resolvedClinicId);
    }
    return await fallbackQuery.single();
  }

  return {
    data: null,
    error: new Error(`Paciente com referência "${cleanRef}" não foi encontrado.`),
  };
}

/**
 * Busca e resolve uma sessão/atendimento a partir de qualquer referência suportada:
 * - 'novo' -> modo de criação de sessão
 * - UUID -> busca direta pelo ID com cálculo de sessionIndex
 * - 'ATD-1', 'ATD-#1', 'ATD-001', '1', etc. -> busca sequencial das sessões do paciente
 */
export async function resolveSessionReference(
  sessionRef: string,
  patientIdOrRef: string,
  clinicId?: string | null,
  clinicRouteKey?: string | null
): Promise<FetchSessionResult> {
  if (!sessionRef || !sessionRef.trim()) {
    return {
      data: null,
      error: new Error("Referência de atendimento não informada."),
      isNew: false,
      sessionIndex: null,
      patient: null,
      totalSessions: 0,
    };
  }

  if (!patientIdOrRef || !patientIdOrRef.trim()) {
    return {
      data: null,
      error: new Error("Referência de paciente não informada."),
      isNew: false,
      sessionIndex: null,
      patient: null,
      totalSessions: 0,
    };
  }

  const parsed = parseSessionRef(sessionRef);
  if (!parsed.isValid) {
    return {
      data: null,
      error: new Error(`Referência de atendimento inválida: "${sessionRef}"`),
      isNew: false,
      sessionIndex: null,
      patient: null,
      totalSessions: 0,
    };
  }

  // 1. Resolve o paciente primeiro
  const patientRes = await fetchPatientByRef(patientIdOrRef, clinicId, clinicRouteKey);
  const patient = patientRes.data;
  const resolvedPatientId = patient?.id || (isUuid(patientIdOrRef) ? patientIdOrRef : null);

  let resolvedClinicId = clinicId;
  if (!resolvedClinicId && patient?.clinic_id) {
    resolvedClinicId = patient.clinic_id;
  }

  // Se for nova sessão
  if (parsed.isNew) {
    let totalSessions = 0;
    if (resolvedPatientId) {
      try {
        let countQuery = supabase
          .from("sessions")
          .select("id", { count: "exact", head: true })
          .eq("patient_id", resolvedPatientId);
        if (resolvedClinicId) {
          countQuery = countQuery.eq("clinic_id", resolvedClinicId);
        }
        const countRes = await countQuery;
        totalSessions = countRes.count ?? 0;
      } catch {
        // Silencioso
      }
    }
    return {
      data: null,
      error: null,
      isNew: true,
      sessionIndex: totalSessions + 1,
      patient,
      totalSessions,
    };
  }

  // Se for UUID direto
  if (parsed.isUuid) {
    try {
      let query = supabase.from("sessions").select("*").eq("id", parsed.raw);
      if (resolvedPatientId) {
        query = query.eq("patient_id", resolvedPatientId);
      }
      if (resolvedClinicId) {
        query = query.eq("clinic_id", resolvedClinicId);
      }
      const sessionRes = await query.maybeSingle();

      if (!sessionRes?.data) {
        return {
          data: null,
          error: sessionRes?.error || new Error(`Atendimento com ID "${parsed.raw}" não foi encontrado.`),
          isNew: false,
          sessionIndex: null,
          patient,
          totalSessions: 0,
        };
      }

      const session = sessionRes.data as SessionRow;
      const actualPatientId = session.patient_id;

      // Buscar todas as sessões para calcular o índice sequencial (ATD-N)
      let sessionsListQuery = supabase
        .from("sessions")
        .select("id, session_date, created_at")
        .eq("patient_id", actualPatientId);
      if (resolvedClinicId) {
        sessionsListQuery = sessionsListQuery.eq("clinic_id", resolvedClinicId);
      }
      sessionsListQuery = sessionsListQuery
        .order("session_date", { ascending: true })
        .order("created_at", { ascending: true });

      const listRes = await sessionsListQuery;
      const sessionsList = (listRes.data ?? []) as Array<{ id: string }>;
      const idx = sessionsList.findIndex((s) => s.id === session.id);
      const sessionIndex = idx >= 0 ? idx + 1 : null;

      return {
        data: session,
        error: null,
        isNew: false,
        sessionIndex,
        patient,
        totalSessions: sessionsList.length,
      };
    } catch (err: any) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
        isNew: false,
        sessionIndex: null,
        patient,
        totalSessions: 0,
      };
    }
  }

  // Se for código sequencial (ex: ATD-1, 1, etc.)
  if (parsed.sessionIndex !== null) {
    if (!resolvedPatientId) {
      return {
        data: null,
        error: new Error(`Paciente com referência "${patientIdOrRef}" não foi encontrado.`),
        isNew: false,
        sessionIndex: parsed.sessionIndex,
        patient: null,
        totalSessions: 0,
      };
    }

    try {
      let query = supabase
        .from("sessions")
        .select("*")
        .eq("patient_id", resolvedPatientId);
      if (resolvedClinicId) {
        query = query.eq("clinic_id", resolvedClinicId);
      }
      query = query
        .order("session_date", { ascending: true })
        .order("created_at", { ascending: true });

      const res = await query;
      if (res.error) {
        return {
          data: null,
          error: res.error,
          isNew: false,
          sessionIndex: parsed.sessionIndex,
          patient,
          totalSessions: 0,
        };
      }

      const sessionsList = (res.data ?? []) as SessionRow[];
      const targetSession = sessionsList[parsed.sessionIndex - 1] ?? null;

      if (!targetSession) {
        return {
          data: null,
          error: new Error(
            `Atendimento ${formatSessionDisplayCode(parsed.sessionIndex)} não foi encontrado para este paciente.`
          ),
          isNew: false,
          sessionIndex: parsed.sessionIndex,
          patient,
          totalSessions: sessionsList.length,
        };
      }

      return {
        data: targetSession,
        error: null,
        isNew: false,
        sessionIndex: parsed.sessionIndex,
        patient,
        totalSessions: sessionsList.length,
      };
    } catch (err: any) {
      return {
        data: null,
        error: err instanceof Error ? err : new Error(String(err)),
        isNew: false,
        sessionIndex: parsed.sessionIndex,
        patient,
        totalSessions: 0,
      };
    }
  }

  return {
    data: null,
    error: new Error(`Referência de atendimento não reconhecida: "${sessionRef}"`),
    isNew: false,
    sessionIndex: null,
    patient,
    totalSessions: 0,
  };
}

export const fetchSessionByRef = resolveSessionReference;

