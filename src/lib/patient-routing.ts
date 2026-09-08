import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Verifica se a string informada é estritamente um UUID V4 válido.
 */
export function isUuid(value: string | undefined | null): boolean {
  if (!value) return false;
  const str = value.trim();
  return UUID_REGEX.test(str);
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
