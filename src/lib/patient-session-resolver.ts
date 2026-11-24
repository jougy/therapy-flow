import { supabase } from "@/integrations/supabase/client";
import {
  formatSessionDisplayCode,
  parseSessionRef,
  type FetchSessionResult,
  type PatientRow,
  type SessionRow,
} from "./patient-routing-parsers";
export interface ResolveSessionReferenceOptions {
  knownPatient?: PatientRow | null;
  knownSessions?: SessionRow[];
}

function sortSessionsChronologically(sessions: SessionRow[]): SessionRow[] {
  return [...sessions]
    .filter((s) => !s.deleted_at)
    .sort((a, b) => {
      const dateDiff = new Date(a.session_date).getTime() - new Date(b.session_date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
}

function matchesKnownPatient(
  patient: PatientRow,
  patientIdOrRef: string,
  clinicId?: string | null
): boolean {
  const cleanRef = patientIdOrRef.trim();
  const matchesRef =
    patient.id === cleanRef ||
    (patient.patient_code ? patient.patient_code.toUpperCase() === cleanRef.toUpperCase() : false);
  const matchesClinic = !clinicId || !patient.clinic_id || patient.clinic_id === clinicId;
  return matchesRef && matchesClinic;
}

/**
 * Busca e resolve uma sessão/atendimento a partir de qualquer referência suportada:
 * - 'novo' -> modo de criação de sessão
 * - UUID -> busca direta pelo ID com cálculo de sessionIndex
 * - 'ATD-1', 'ATD-#1', 'ATD-001', '1', etc. -> busca sequencial das sessões do paciente
 */
export type FetchPatientByRefFn = (
  patientIdOrRef: string,
  clinicId?: string | null,
  clinicRouteKey?: string | null
) => Promise<{ data: PatientRow | null; error: any }>;

export async function resolveSessionReferenceWithPatientFetcher(
  fetchPatient: FetchPatientByRefFn,
  sessionRef: string,
  patientIdOrRef: string,
  clinicId?: string | null,
  clinicRouteKey?: string | null,
  options?: ResolveSessionReferenceOptions
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

  // 1. Resolve o paciente primeiro (usa cache se compatível)
  let patient: PatientRow | null = null;
  if (options?.knownPatient && matchesKnownPatient(options.knownPatient, patientIdOrRef, clinicId)) {
    patient = options.knownPatient;
  } else {
    const patientRes = await fetchPatient(patientIdOrRef, clinicId, clinicRouteKey);
    patient = patientRes.data;
  }

  const resolvedPatientId = patient?.id || (isUuid(patientIdOrRef) ? patientIdOrRef : null);

  let resolvedClinicId = clinicId;
  if (!resolvedClinicId && patient?.clinic_id) {
    resolvedClinicId = patient.clinic_id;
  }

  const knownSessions = Array.isArray(options?.knownSessions)
    ? sortSessionsChronologically(
        resolvedPatientId
          ? options.knownSessions.filter((s) => s.patient_id === resolvedPatientId)
          : options.knownSessions
      )
    : null;

  // Se for nova sessão
  if (parsed.isNew) {
    if (knownSessions) {
      const totalSessions = knownSessions.length;
      return {
        data: null,
        error: null,
        isNew: true,
        sessionIndex: totalSessions + 1,
        patient,
        totalSessions,
      };
    }

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
    if (knownSessions) {
      const cachedIdx = knownSessions.findIndex((s) => s.id === parsed.raw);
      if (cachedIdx >= 0) {
        return {
          data: knownSessions[cachedIdx],
          error: null,
          isNew: false,
          sessionIndex: cachedIdx + 1,
          patient,
          totalSessions: knownSessions.length,
        };
      }
    }

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

    if (knownSessions) {
      const cachedTarget = knownSessions[parsed.sessionIndex - 1] ?? null;
      if (cachedTarget) {
        return {
          data: cachedTarget,
          error: null,
          isNew: false,
          sessionIndex: parsed.sessionIndex,
          patient,
          totalSessions: knownSessions.length,
        };
      }
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

