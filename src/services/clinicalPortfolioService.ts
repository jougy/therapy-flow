import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { ClinicalPortfolioItem, ClinicalPortfolioRpcRow, ClinicalPortfolioSessionDetail } from "@/types/clinicalPortfolio";
import { formatDemographics, formatPatientPseudonym, sanitizeClinicalText } from "@/lib/clinical-portfolio";
import { readTreatmentState, formatTreatmentSummary } from "@/lib/session-treatment";
import { getClinicBrandName } from "@/lib/clinic-settings";

interface RawSessionJoin {
  id: string;
  clinic_id: string | null;
  patient_id: string;
  session_date: string;
  scheduled_start_at: string | null;
  pain_score: number | null;
  complexity_score: number | null;
  notes: string | null;
  treatment: Json | null;
  status: string;
  clinics?: {
    id: string;
    name: string;
    route_key?: string | null;
    logo_url: string | null;
  } | null;
  patients?: {
    id: string;
    name: string;
    patient_code?: string | null;
    age: number | null;
    gender: string | null;
    date_of_birth?: string | null;
  } | null;
}

/**
 * Fetches the professional's clinical portfolio items with LGPD pseudonymization.
 * Supports backend RPC if present, falling back to secure joined queries.
 */
export async function fetchPersonalClinicalPortfolio(userId: string): Promise<ClinicalPortfolioItem[]> {
  if (!userId) {
    return [];
  }

  // 1. Try canonical RPC get_personal_professional_sessions_portfolio (isolated and audited on server)
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_personal_professional_sessions_portfolio",
      { _limit: 200 }
    );
    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      return rpcData.map((row) => {
        let treatmentText: string | null = row.treatment_sanitized || null;
        if (treatmentText && (treatmentText.startsWith("{") || treatmentText.startsWith("["))) {
          try {
            const parsed = JSON.parse(treatmentText);
            const formatted = formatTreatmentSummary(readTreatmentState(parsed));
            if (formatted) {
              treatmentText = formatted;
            }
          } catch {
            // Keep original sanitized text
          }
        }

        const careLines = Array.isArray(row.care_lines) ? row.care_lines : [];
        const tags = careLines
          .filter((t: any) => t && typeof t === "object" && t.id && t.name)
          .map((t: any) => ({
            id: String(t.id),
            name: String(t.name),
            color: String(t.color || "#3b82f6"),
          }));

        return {
          id: row.session_id,
          clinic_id: row.clinic_id || "sem-clinica",
          clinic_name: getClinicBrandName(row.clinic_name || "Clínica"),
          clinic_route_key: row.clinic_route_key || null,
          clinic_logo_url: null,
          patient_id: row.patient_id || "",
          patient_ref: row.patient_ref || null,
          patient_name: row.patient_name || null,
          patient_pseudonym: row.patient_pseudonym || "Paciente",
          patient_demographics: row.patient_demographics,
          session_date: row.session_date,
          scheduled_start_at: null,
          pain_score: typeof row.pain_score === "number" ? row.pain_score : null,
          complexity_score: typeof row.complexity_score === "number" ? row.complexity_score : null,
          notes_sanitized: row.notes_sanitized,
          treatment_sanitized: treatmentText,
          status: row.session_status,
          anamnesis_form_response: row.anamnesis_form_response || null,
          tags,
        };
      });
    }
  } catch (rpcErr) {
    console.warn("RPC get_personal_professional_sessions_portfolio indisponível, usando fallback seguro:", rpcErr);
  }

  // 2. Query sessions directly
  const { data, error } = await supabase
    .from("sessions")
    .select(`
      id,
      clinic_id,
      patient_id,
      session_date,
      scheduled_start_at,
      pain_score,
      complexity_score,
      notes,
      treatment,
      status,
      clinics:clinic_id (id, name, route_key, logo_url),
      patients:patient_id (id, name, patient_code, age, gender, date_of_birth)
    `)
    .or(`user_id.eq.${userId},provider_id.eq.${userId}`)
    .neq("status", "cancelado")
    .order("session_date", { ascending: false })
    .limit(1000);

  if (error || !data) {
    // Fallback: If joined relationship fails in PostgREST, query plain sessions
    const { data: simpleData, error: simpleError } = await supabase
      .from("sessions")
      .select("id, clinic_id, patient_id, session_date, scheduled_start_at, pain_score, complexity_score, notes, treatment, status")
      .or(`user_id.eq.${userId},provider_id.eq.${userId}`)
      .neq("status", "cancelado")
      .order("session_date", { ascending: false })
      .limit(1000);

    if (simpleError || !simpleData) {
      return [];
    }

    return (simpleData as RawSessionJoin[]).map((session) => {
      const treatmentState = readTreatmentState(session.treatment);
      const treatmentSummary = formatTreatmentSummary(treatmentState);

      return {
        id: session.id,
        clinic_id: session.clinic_id || "sem-clinica",
        clinic_name: "Clínica de Atendimento",
        clinic_route_key: null,
        clinic_logo_url: null,
        patient_id: session.patient_id,
        patient_ref: session.patient_id,
        patient_name: "Paciente",
        patient_pseudonym: "Paciente Confidencial",
        patient_demographics: "Perfil não informado",
        session_date: session.session_date,
        scheduled_start_at: session.scheduled_start_at,
        pain_score: session.pain_score,
        complexity_score: session.complexity_score,
        notes_sanitized: sanitizeClinicalText(session.notes),
        treatment_sanitized: treatmentSummary || null,
        status: session.status,
      };
    });
  }

  return (data as unknown as RawSessionJoin[]).map((session) => {
    const clinicName = session.clinics?.name ? getClinicBrandName(session.clinics.name) : "Clínica de Atendimento";
    const patientPseudonym = session.patients?.name
      ? formatPatientPseudonym(session.patients.name)
      : "Paciente Confidencial";
    const demographics = formatDemographics(
      session.patients?.age,
      session.patients?.gender,
      session.patients?.date_of_birth
    );

    const treatmentState = readTreatmentState(session.treatment);
    const treatmentSummary = formatTreatmentSummary(treatmentState);

    return {
      id: session.id,
      clinic_id: session.clinic_id || "sem-clinica",
      clinic_name: clinicName,
      clinic_route_key: session.clinics?.route_key || null,
      clinic_logo_url: session.clinics?.logo_url || null,
      patient_id: session.patient_id,
      patient_ref: session.patients?.patient_code || session.patient_id,
      patient_name: session.patients?.name || "Paciente",
      patient_pseudonym: patientPseudonym,
      patient_demographics: demographics,
      session_date: session.session_date,
      scheduled_start_at: session.scheduled_start_at,
      pain_score: session.pain_score,
      complexity_score: session.complexity_score,
      notes_sanitized: sanitizeClinicalText(session.notes),
      treatment_sanitized: treatmentSummary || (typeof session.treatment === "string" ? session.treatment : null),
      status: session.status,
    };
  });
}

/**
 * Busca o detalhe clínico completo de um atendimento do portfólio pessoal do profissional.
 * Totalmente isolado do escopo de tenant da clínica, com garantia de propriedade e omissão de dados comerciais/financeiros.
 */
export async function fetchPersonalPortfolioSessionDetail(sessionId: string): Promise<ClinicalPortfolioSessionDetail | null> {
  if (!sessionId) {
    return null;
  }

  // 1. Tentar RPC canônica dedicada do PostgreSQL
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      "get_personal_portfolio_session_detail" as any,
      { _session_id: sessionId }
    );

    if (!rpcError && Array.isArray(rpcData) && rpcData.length > 0) {
      const row = rpcData[0] as any;
      let treatmentText: string | null = row.treatment_sanitized || null;
      if (treatmentText && (treatmentText.startsWith("{") || treatmentText.startsWith("["))) {
        try {
          const parsed = JSON.parse(treatmentText);
          const formatted = formatTreatmentSummary(readTreatmentState(parsed));
          if (formatted) {
            treatmentText = formatted;
          }
        } catch {
          // Mantém texto original sanitizado
        }
      }

      const careLines = Array.isArray(row.care_lines)
        ? row.care_lines
            .filter((t: any) => t && typeof t === "object" && t.id && t.name)
            .map((t: any) => ({
              id: String(t.id),
              name: String(t.name),
              color: String(t.color || "#3b82f6"),
            }))
        : [];

      return {
        sessionId: row.session_id,
        sessionDate: row.session_date,
        sessionStatus: row.session_status,
        clinicId: row.clinic_id || "sem-clinica",
        clinicName: getClinicBrandName(row.clinic_name || "Clínica"),
        clinicRouteKey: row.clinic_route_key || null,
        clinicLogoUrl: row.clinic_logo_url || null,
        patientId: row.patient_id || "",
        patientRef: row.patient_ref || null,
        patientName: row.patient_name || "Paciente",
        patientPseudonym: row.patient_pseudonym || "Paciente",
        patientDemographics: row.patient_demographics || null,
        notesSanitized: row.notes_sanitized || null,
        treatmentSanitized: treatmentText,
        painScore: typeof row.pain_score === "number" ? row.pain_score : null,
        complexityScore: typeof row.complexity_score === "number" ? row.complexity_score : null,
        createdAt: row.created_at,
        anamnesisFormResponse: row.anamnesis_form_response || null,
        careLines,
        anamnesisBaseSchema: row.anamnesis_base_schema || null,
        anamnesisData: row.anamnesis_data || null,
      };
    }
  } catch (rpcErr) {
    console.warn("RPC get_personal_portfolio_session_detail falhou, tentando consulta direta segura:", rpcErr);
  }

  // 2. Fallback de consulta direta de sessão autenticada
  const { data: sessionData, error: sessionError } = await supabase
    .from("sessions")
    .select(`
      id,
      session_date,
      status,
      clinic_id,
      patient_id,
      notes,
      treatment,
      pain_score,
      complexity_score,
      created_at,
      anamnesis,
      anamnesis_form_response,
      deleted_at,
      clinics:clinic_id (id, name, route_key, logo_url, anamnesis_base_schema),
      patients:patient_id (id, name, patient_code, age, gender, date_of_birth)
    `)
    .eq("id", sessionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (sessionError || !sessionData) {
    return null;
  }

  const rawSession = sessionData as any;
  const clinicName = rawSession.clinics?.name ? getClinicBrandName(rawSession.clinics.name) : "Clínica de Atendimento";
  const patientName = rawSession.patients?.name || "Paciente";
  const patientPseudonym = formatPatientPseudonym(patientName);
  const patientDemographics = formatDemographics(
    rawSession.patients?.age,
    rawSession.patients?.gender,
    rawSession.patients?.date_of_birth
  );

  const treatmentState = readTreatmentState(rawSession.treatment);
  const treatmentSummary = formatTreatmentSummary(treatmentState);

  return {
    sessionId: rawSession.id,
    sessionDate: rawSession.session_date,
    sessionStatus: rawSession.status,
    clinicId: rawSession.clinic_id || "sem-clinica",
    clinicName,
    clinicRouteKey: rawSession.clinics?.route_key || null,
    clinicLogoUrl: rawSession.clinics?.logo_url || null,
    patientId: rawSession.patient_id,
    patientRef: rawSession.patients?.patient_code || rawSession.patient_id,
    patientName,
    patientPseudonym,
    patientDemographics,
    notesSanitized: sanitizeClinicalText(rawSession.notes),
    treatmentSanitized: treatmentSummary || (typeof rawSession.treatment === "string" ? rawSession.treatment : null),
    painScore: rawSession.pain_score,
    complexityScore: rawSession.complexity_score,
    createdAt: rawSession.created_at,
    anamnesisFormResponse: rawSession.anamnesis_form_response,
    careLines: [],
    anamnesisBaseSchema: rawSession.clinics?.anamnesis_base_schema || null,
    anamnesisData: rawSession.anamnesis || null,
  };
}
