import type { Database, Json } from "@/integrations/supabase/types";
import { getFunctionalIndependenceLabel, parseClinicalProfile } from "@/lib/patient-clinical-profile";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

export interface PatientClinicalSnapshotState {
  allergies: string;
  chronic_conditions: string;
  clinical_notes: string;
  continuous_medications: string;
  blood_type: string;
  surgeries: string;
  clinical_alerts: string;
  congenital_genetic_conditions: string;
  diagnoses: string;
  falls_history: string;
  family_history: string;
  functional_independence: string;
  implants_devices: string;
  mobility_aids: string;
  substance_use_history: string;
}

export interface ClinicalSnapshotChange {
  field: keyof PatientClinicalSnapshotState;
  label: string;
  previous: string | null;
  next: string | null;
}

const CLINICAL_SNAPSHOT_FIELDS: Array<{ field: keyof PatientClinicalSnapshotState; label: string }> = [
  { field: "blood_type", label: "Tipo sanguíneo" },
  { field: "allergies", label: "Alergias" },
  { field: "chronic_conditions", label: "Problemas crônicos" },
  { field: "clinical_alerts", label: "Alertas clínicos" },
  { field: "congenital_genetic_conditions", label: "Condições congênitas ou genéticas" },
  { field: "family_history", label: "Histórico familiar" },
  { field: "diagnoses", label: "Diagnósticos prévios" },
  { field: "surgeries", label: "Cirurgias e internações" },
  { field: "implants_devices", label: "Implantes e dispositivos" },
  { field: "falls_history", label: "Histórico de quedas" },
  { field: "continuous_medications", label: "Medicamentos de uso contínuo" },
  { field: "functional_independence", label: "Contexto funcional atual" },
  { field: "mobility_aids", label: "Dispositivos de apoio" },
  { field: "substance_use_history", label: "Uso de substâncias, vícios e compulsões" },
  { field: "clinical_notes", label: "Observações clínicas" },
];

const normalizeText = (value: string | null | undefined) => {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "";
};

const toNullable = (value: string) => {
  const normalized = normalizeText(value);
  return normalized.length > 0 ? normalized : null;
};

export const buildPatientClinicalSnapshotState = (patient: Pick<
  PatientRow,
  | "allergies"
  | "blood_type"
  | "chronic_conditions"
  | "clinical_notes"
  | "clinical_profile"
  | "continuous_medications"
  | "surgeries"
>): PatientClinicalSnapshotState => {
  const profile = parseClinicalProfile(patient.clinical_profile);

  return {
    allergies: normalizeText(patient.allergies),
    blood_type: normalizeText(patient.blood_type),
    chronic_conditions: normalizeText(patient.chronic_conditions),
    clinical_notes: normalizeText(patient.clinical_notes),
    continuous_medications: normalizeText(patient.continuous_medications),
    surgeries: normalizeText(patient.surgeries),
    clinical_alerts: normalizeText(profile.clinical_alerts),
    congenital_genetic_conditions: normalizeText(profile.congenital_genetic_conditions),
    diagnoses: normalizeText(profile.diagnoses),
    falls_history: normalizeText(profile.falls_history),
    family_history: normalizeText(profile.family_history),
    functional_independence: normalizeText(
      profile.functional_independence ? getFunctionalIndependenceLabel(profile.functional_independence) : "",
    ),
    implants_devices: normalizeText(profile.implants_devices),
    mobility_aids: normalizeText(profile.mobility_aids),
    substance_use_history: normalizeText(profile.substance_use_history),
  };
};

export const diffPatientClinicalSnapshotStates = (
  previousState: PatientClinicalSnapshotState,
  nextState: PatientClinicalSnapshotState,
): ClinicalSnapshotChange[] =>
  CLINICAL_SNAPSHOT_FIELDS.flatMap(({ field, label }) => {
    const previous = normalizeText(previousState[field]);
    const next = normalizeText(nextState[field]);

    if (previous === next) {
      return [];
    }

    return [{ field, label, previous: toNullable(previous), next: toNullable(next) }];
  });

export const buildClinicalSnapshotSummaryPayload = (changes: ClinicalSnapshotChange[]): Json =>
  changes.map((change) => ({
    field: change.field,
    label: change.label,
    previous: change.previous,
    next: change.next,
  })) as Json;

export const formatClinicalSnapshotFieldLabel = (field: string) =>
  CLINICAL_SNAPSHOT_FIELDS.find((item) => item.field === field)?.label ?? field;
