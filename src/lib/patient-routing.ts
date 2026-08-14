import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Verifica se a string informada é um UUID V4 válido (ou ID primário direto).
 */
export function isUuid(value: string | undefined | null): boolean {
  if (!value) return false;
  const str = value.trim();
  return UUID_REGEX.test(str) || str.startsWith("patient-") || str.startsWith("test-");
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
 * Busca um paciente por referência de rota (tanto por patient_code quanto por id UUID).
 */
export async function fetchPatientByRef(ref: string, clinicId?: string | null) {
  if (!ref) {
    return { data: null, error: new Error("Referência de paciente não informada.") };
  }

  const cleanRef = ref.trim();

  // 1. Tenta buscar diretamente por ID UUID/mock se for o formato
  if (isUuid(cleanRef)) {
    try {
      const idRes = await supabase.from("patients").select("*").eq("id", cleanRef).single();
      if (idRes.data) {
        return idRes;
      }
    } catch {
      // Continuar se não encontrar por ID
    }
  }

  // 2. Tenta buscar por patient_code com escopo de clínica
  if (clinicId) {
    try {
      const codeRes = await supabase.from("patients").select("*").eq("clinic_id", clinicId).eq("patient_code", cleanRef).single();
      if (codeRes.data) {
        return codeRes;
      }
    } catch {
      // Tentar sem limitar por clínica caso o paciente pertença a outra clínica acessível
    }
  }

  // 3. Tenta buscar por patient_code sem limitação de clinic_id
  try {
    const globalCodeRes = await supabase.from("patients").select("*").eq("patient_code", cleanRef).single();
    if (globalCodeRes.data) {
      return globalCodeRes;
    }
  } catch {
    // Fallback final
  }

  // 4. Fallback final por id UUID
  return await supabase.from("patients").select("*").eq("id", cleanRef).single();
}
