import type { Database } from "@/integrations/supabase/types";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

export type PatientOriginType = "particular" | "indicacao" | "convenio" | "filantropia" | "outros";

export const DEFAULT_PATIENT_ORIGIN_TYPE: PatientOriginType = "outros";
export const DEFAULT_PATIENT_ORIGIN_OTHER_NAME = "Não informado";
export const DEFAULT_PATIENT_ORIGIN_OTHER_DESCRIPTION = "Por favor, adicione uma opção de origem para este paciente";

export const PATIENT_ORIGIN_OPTIONS: Array<{ value: PatientOriginType; label: string }> = [
  { value: "particular", label: "Particular" },
  { value: "indicacao", label: "Indicação" },
  { value: "convenio", label: "Convênio" },
  { value: "filantropia", label: "Filantropia" },
  { value: "outros", label: "Outros" },
];

const VALID_ORIGINS = new Set(PATIENT_ORIGIN_OPTIONS.map((option) => option.value));

export interface PatientOriginFormValues {
  originInsuranceMemberId: string;
  originInsurancePlan: string;
  originInsuranceProvider: string;
  originOtherDescription: string;
  originOtherName: string;
  originReferrerName: string;
  originType: PatientOriginType;
}

const trimLimit = (value: string | null | undefined, limit: number) => {
  const trimmed = (value ?? "").trim().slice(0, limit);
  return trimmed.length > 0 ? trimmed : null;
};

export const normalizePatientOriginType = (value: string | null | undefined): PatientOriginType => {
  return VALID_ORIGINS.has(value as PatientOriginType) ? (value as PatientOriginType) : DEFAULT_PATIENT_ORIGIN_TYPE;
};

export const getPatientOriginLabel = (value: string | null | undefined) =>
  PATIENT_ORIGIN_OPTIONS.find((option) => option.value === normalizePatientOriginType(value))?.label ?? "Outros";

export const buildPatientOriginPayload = (values: PatientOriginFormValues) => {
  const originType = normalizePatientOriginType(values.originType);

  return {
    origin_insurance_member_id: originType === "convenio" ? trimLimit(values.originInsuranceMemberId, 80) : null,
    origin_insurance_plan: originType === "convenio" ? trimLimit(values.originInsurancePlan, 120) : null,
    origin_insurance_provider: originType === "convenio" ? trimLimit(values.originInsuranceProvider, 120) : null,
    origin_other_description:
      originType === "outros"
        ? trimLimit(values.originOtherDescription, 500) ?? DEFAULT_PATIENT_ORIGIN_OTHER_DESCRIPTION
        : null,
    origin_other_name:
      originType === "outros" ? trimLimit(values.originOtherName, 120) ?? DEFAULT_PATIENT_ORIGIN_OTHER_NAME : null,
    origin_referrer_name: originType === "indicacao" ? trimLimit(values.originReferrerName, 120) : null,
    origin_type: originType,
  };
};

export const formatPatientOriginDetails = (patient: Pick<
  PatientRow,
  | "origin_insurance_member_id"
  | "origin_insurance_plan"
  | "origin_insurance_provider"
  | "origin_other_description"
  | "origin_other_name"
  | "origin_referrer_name"
  | "origin_type"
>) => {
  const originType = normalizePatientOriginType(patient.origin_type);

  if (originType === "indicacao") {
    return patient.origin_referrer_name ? `Indicado por ${patient.origin_referrer_name}` : null;
  }

  if (originType === "convenio") {
    const details = [
      patient.origin_insurance_provider,
      patient.origin_insurance_plan ? `Plano ${patient.origin_insurance_plan}` : null,
      patient.origin_insurance_member_id ? `Carteirinha ${patient.origin_insurance_member_id}` : null,
    ].filter(Boolean);

    return details.length > 0 ? details.join("\n") : null;
  }

  if (originType === "outros") {
    return [
      patient.origin_other_name || DEFAULT_PATIENT_ORIGIN_OTHER_NAME,
      patient.origin_other_description || DEFAULT_PATIENT_ORIGIN_OTHER_DESCRIPTION,
    ].join("\n");
  }

  return null;
};
