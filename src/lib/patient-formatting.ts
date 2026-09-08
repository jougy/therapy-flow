import type { Json } from "@/integrations/supabase/types";
import type { PatientClinicalSnapshotState } from "@/lib/patient-clinical-snapshots";

export type PatientAddressSource = {
  street?: string | null;
  address_number?: string | null;
  address_complement?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  cep?: string | null;
  country?: string | null;
};

/**
 * Formata data ISO (YYYY-MM-DD) para padrão brasileiro DD/MM/AAAA.
 */
export const formatPatientDate = (date?: string | null): string | null => {
  if (!date) return null;
  try {
    return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR");
  } catch {
    return date;
  }
};

/**
 * Formata data/hora ISO para exibição abreviada brasileira (DD/MM/AAAA HH:mm).
 */
export const formatDateTime = (date?: string | null): string => {
  if (!date) return "Sem data registrada";
  try {
    return new Date(date).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return date;
  }
};

/**
 * Formata o endereço completo de um paciente em linhas estruturadas.
 */
export const formatAddress = (patient?: PatientAddressSource | null): string | null => {
  if (!patient) return null;
  const streetLine = [patient.street, patient.address_number].filter(Boolean).join(", ");
  const cityLine = [patient.neighborhood, patient.city, patient.state].filter(Boolean).join(", ");
  const address = [streetLine, patient.address_complement, cityLine, patient.cep, patient.country]
    .filter(Boolean)
    .join("\n");

  return address || null;
};

/**
 * Remove todos os caracteres não numéricos de uma string (telefones, CPFs, CEPs).
 */
export const cleanDigits = (value?: string | null): string =>
  value ? value.replace(/\D/g, "") : "";

/**
 * Type guard para checar se um valor Json é um objeto chave-valor.
 */
export const isSnapshotState = (value: Json): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Converte um snapshot Json arbitrário para o estado clínico fortemente tipado.
 */
export const parseSnapshotState = (value: Json): PatientClinicalSnapshotState => {
  const snapshot = isSnapshotState(value)
    ? (value as Partial<Record<keyof PatientClinicalSnapshotState, unknown>>)
    : {};

  const getValue = (field: keyof PatientClinicalSnapshotState): string => {
    const fieldValue = snapshot[field];
    return typeof fieldValue === "string" ? fieldValue : "";
  };

  return {
    allergies: getValue("allergies"),
    blood_type: getValue("blood_type"),
    chronic_conditions: getValue("chronic_conditions"),
    clinical_notes: getValue("clinical_notes"),
    continuous_medications: getValue("continuous_medications"),
    surgeries: getValue("surgeries"),
    clinical_alerts: getValue("clinical_alerts"),
    congenital_genetic_conditions: getValue("congenital_genetic_conditions"),
    diagnoses: getValue("diagnoses"),
    falls_history: getValue("falls_history"),
    family_history: getValue("family_history"),
    functional_independence: getValue("functional_independence"),
    implants_devices: getValue("implants_devices"),
    mobility_aids: getValue("mobility_aids"),
    substance_use_history: getValue("substance_use_history"),
  };
};
