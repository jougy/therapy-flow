import type { Json } from "@/integrations/supabase/types";

export const FUNCTIONAL_INDEPENDENCE_OPTIONS = [
  { label: "Independente", value: "independente" },
  { label: "Parcialmente dependente", value: "parcialmente_dependente" },
  { label: "Dependente", value: "dependente" },
] as const;

export type FunctionalIndependenceValue = (typeof FUNCTIONAL_INDEPENDENCE_OPTIONS)[number]["value"];

export const DEPENDENCY_LEVEL_OPTIONS = [
  { label: "Uso ocasional, sem padrão de dependência", value: "ocasional_sem_dependencia" },
  { label: "Uso recorrente, ainda controlado", value: "recorrente_controlado" },
  { label: "Uso problemático ou difícil de reduzir", value: "problematico_dificil_reduzir" },
  { label: "Dependência provável", value: "dependencia_provavel" },
  { label: "Dependência intensa com abstinência", value: "dependencia_intensa_abstinencia" },
] as const;

export type DependencyLevelValue = (typeof DEPENDENCY_LEVEL_OPTIONS)[number]["value"];

export interface PatientSubstanceUseRecord {
  dependency_level: DependencyLevelValue | "";
  frequency: string;
  id: string;
  is_illicit: boolean;
  motivation: string;
  name: string;
  notes: string;
  started_at: string;
}

export interface PatientAddictionRecord {
  frequency: string;
  id: string;
  motivation: string;
  name: string;
  notes: string;
  started_at: string;
}

export interface PatientClinicalProfile {
  clinical_alerts: string;
  congenital_genetic_conditions: string;
  diagnoses: string;
  falls_history: string;
  family_history: string;
  functional_independence: FunctionalIndependenceValue | "";
  implants_devices: string;
  lifestyle_notes: string;
  mobility_aids: string;
  addiction_records: PatientAddictionRecord[];
  has_addictions: boolean;
  substance_use_records: PatientSubstanceUseRecord[];
  substance_use_history: string;
  uses_substances: boolean;
}

export interface PatientEmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export const EMPTY_CLINICAL_PROFILE: PatientClinicalProfile = {
  clinical_alerts: "",
  congenital_genetic_conditions: "",
  diagnoses: "",
  falls_history: "",
  family_history: "",
  functional_independence: "",
  implants_devices: "",
  lifestyle_notes: "",
  mobility_aids: "",
  addiction_records: [],
  has_addictions: false,
  substance_use_records: [],
  substance_use_history: "",
  uses_substances: false,
};

export const EMPTY_EMERGENCY_CONTACT: PatientEmergencyContact = {
  name: "",
  phone: "",
  relationship: "",
};

const isPlainObject = (value: Json | null | undefined): value is Record<string, Json> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readString = (value: Json | undefined) => (typeof value === "string" ? value : "");
const readBoolean = (value: Json | undefined) => (typeof value === "boolean" ? value : false);
const readDependencyLevel = (value: Json | undefined): DependencyLevelValue | "" => {
  const dependencyLevel = readString(value);

  return DEPENDENCY_LEVEL_OPTIONS.some((option) => option.value === dependencyLevel)
    ? dependencyLevel as DependencyLevelValue
    : "";
};

const trimToNull = (value: string) => {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const hasRecordContent = (record: PatientSubstanceUseRecord | PatientAddictionRecord) =>
  [
    record.name,
    record.started_at,
    record.frequency,
    record.motivation,
    record.notes,
    "dependency_level" in record ? record.dependency_level : "",
  ].some((value) => value.trim().length > 0) || ("is_illicit" in record && record.is_illicit);

const normalizeUseRecord = (value: Json, index: number, prefix: string): PatientSubstanceUseRecord | null => {
  if (!isPlainObject(value)) {
    return null;
  }

  return {
    dependency_level: readDependencyLevel(value.dependency_level),
    frequency: readString(value.frequency),
    id: readString(value.id) || `${prefix}-${index + 1}`,
    is_illicit: readBoolean(value.is_illicit),
    motivation: readString(value.motivation),
    name: readString(value.name),
    notes: readString(value.notes),
    started_at: readString(value.started_at),
  };
};

const readUseRecords = (value: Json | undefined, prefix: string) =>
  Array.isArray(value)
    ? value
        .map((record, index) => normalizeUseRecord(record, index, prefix))
        .filter((record): record is PatientSubstanceUseRecord => !!record)
    : [];

const normalizeUseRecordsForPayload = (records: Array<PatientSubstanceUseRecord | PatientAddictionRecord>, prefix: string) =>
  (records ?? [])
    .map((record, index) => ({
      dependency_level: "dependency_level" in record ? record.dependency_level : "",
      frequency: record.frequency.trim(),
      id: record.id || `${prefix}-${index + 1}`,
      is_illicit: "is_illicit" in record ? record.is_illicit : false,
      motivation: record.motivation.trim(),
      name: record.name.trim(),
      notes: record.notes.trim(),
      started_at: record.started_at.trim(),
    }))
    .filter(hasRecordContent);

const formatUseRecord = (record: PatientSubstanceUseRecord | PatientAddictionRecord) => {
  const dependencyLevel = "dependency_level" in record
    ? DEPENDENCY_LEVEL_OPTIONS.find((option) => option.value === record.dependency_level)?.label
    : null;
  const details = [
    "is_illicit" in record ? `ilícito: ${record.is_illicit ? "sim" : "não"}` : "",
    dependencyLevel ? `padrão: ${dependencyLevel}` : "",
    record.started_at.trim() ? `início: ${record.started_at.trim()}` : "",
    record.frequency.trim() ? `frequência: ${record.frequency.trim()}` : "",
    record.motivation.trim() ? `motivação: ${record.motivation.trim()}` : "",
    record.notes.trim() ? `observações: ${record.notes.trim()}` : "",
  ].filter(Boolean);

  return [record.name.trim() || "Registro sem nome", details.join("; ")].filter(Boolean).join(" — ");
};

export const createSubstanceUseRecord = (index: number): PatientSubstanceUseRecord => ({
  dependency_level: "",
  frequency: "",
  id: `substance-use-${index + 1}`,
  is_illicit: false,
  motivation: "",
  name: "",
  notes: "",
  started_at: "",
});

export const createAddictionRecord = (index: number): PatientAddictionRecord => ({
  frequency: "",
  id: `addiction-${index + 1}`,
  motivation: "",
  name: "",
  notes: "",
  started_at: "",
});

export const formatSubstanceUseAndAddictionsSummary = (profile: Pick<
  PatientClinicalProfile,
  "addiction_records" | "has_addictions" | "substance_use_history" | "substance_use_records" | "uses_substances"
>) => {
  const hasSubstanceContent = profile.uses_substances || profile.substance_use_records.some(hasRecordContent);
  const hasAddictionContent = profile.has_addictions || profile.addiction_records.some(hasRecordContent);
  const records = [
    ...profile.substance_use_records,
    ...profile.addiction_records.map((record, index) => ({
      ...createSubstanceUseRecord(profile.substance_use_records.length + index),
      dependency_level: "dependencia_provavel" as const,
      frequency: record.frequency,
      id: record.id || `summary-addiction-${index + 1}`,
      motivation: record.motivation,
      name: record.name,
      notes: record.notes,
      started_at: record.started_at,
    })),
  ];
  const sections = [
    hasSubstanceContent || hasAddictionContent
      ? [
          "Uso, substâncias e dependência: sim",
          ...records.filter(hasRecordContent).map((record) => `- ${formatUseRecord(record)}`),
        ].join("\n")
      : ""
  ];

  const legacyNotes = profile.substance_use_history.trim();

  return [...sections, legacyNotes ? `Observações anteriores:\n${legacyNotes}` : ""].filter(Boolean).join("\n\n");
};

export const parseClinicalProfile = (value: Json | null | undefined): PatientClinicalProfile => {
  if (!isPlainObject(value)) {
    return EMPTY_CLINICAL_PROFILE;
  }

  const functionalIndependence = readString(value.functional_independence);
  const isKnownFunctionalIndependence = FUNCTIONAL_INDEPENDENCE_OPTIONS.some(
    (option) => option.value === functionalIndependence,
  );
  const legacySubstanceUseHistory = readString(value.substance_use_history);
  const substanceUseRecords = readUseRecords(value.substance_use_records, "substance-use");
  const addictionRecords = readUseRecords(value.addiction_records, "addiction");
  const migratedAddictionRecords = addictionRecords.map((record, index) => ({
    ...createSubstanceUseRecord(substanceUseRecords.length + index),
    dependency_level: "dependencia_provavel" as const,
    frequency: record.frequency,
    id: record.id || `migrated-addiction-${index + 1}`,
    motivation: record.motivation,
    name: record.name,
    notes: record.notes,
    started_at: record.started_at,
  }));
  const legacySubstanceRecord = legacySubstanceUseHistory.trim() && substanceUseRecords.length === 0
    ? [{ ...createSubstanceUseRecord(0), id: "legacy-substance-use-1", name: "Nome da substância", notes: legacySubstanceUseHistory }]
    : [];
  const unifiedSubstanceUseRecords = substanceUseRecords.length > 0
    ? [...substanceUseRecords, ...migratedAddictionRecords]
    : [...legacySubstanceRecord, ...migratedAddictionRecords];

  return {
    clinical_alerts: readString(value.clinical_alerts),
    congenital_genetic_conditions: readString(value.congenital_genetic_conditions),
    diagnoses: readString(value.diagnoses),
    falls_history: readString(value.falls_history),
    family_history: readString(value.family_history),
    functional_independence: isKnownFunctionalIndependence
      ? (functionalIndependence as FunctionalIndependenceValue)
      : "",
    implants_devices: readString(value.implants_devices),
    lifestyle_notes: readString(value.lifestyle_notes),
    mobility_aids: readString(value.mobility_aids),
    addiction_records: addictionRecords,
    has_addictions: readBoolean(value.has_addictions) || addictionRecords.some(hasRecordContent),
    substance_use_records: unifiedSubstanceUseRecords,
    substance_use_history: legacySubstanceUseHistory,
    uses_substances: readBoolean(value.uses_substances) || unifiedSubstanceUseRecords.some(hasRecordContent),
  };
};

export const parseEmergencyContact = (value: Json | null | undefined): PatientEmergencyContact => {
  if (!isPlainObject(value)) {
    return EMPTY_EMERGENCY_CONTACT;
  }

  return {
    name: readString(value.name),
    phone: readString(value.phone),
    relationship: readString(value.relationship),
  };
};

export const buildClinicalProfilePayload = (profile: PatientClinicalProfile): Json | null => {
  const substanceUseRecords = normalizeUseRecordsForPayload(profile.substance_use_records, "substance-use");
  const addictionRecords = normalizeUseRecordsForPayload(profile.addiction_records, "addiction");
  const usesSubstances = profile.uses_substances || substanceUseRecords.length > 0;
  const hasAddictions = profile.has_addictions || addictionRecords.length > 0;
  const substanceUseSummary = formatSubstanceUseAndAddictionsSummary({
    ...profile,
    addiction_records: addictionRecords,
    has_addictions: hasAddictions,
    substance_use_records: substanceUseRecords,
    uses_substances: usesSubstances,
  });
  const payload = {
    addiction_records: addictionRecords.length > 0 ? addictionRecords : null,
    clinical_alerts: trimToNull(profile.clinical_alerts),
    congenital_genetic_conditions: trimToNull(profile.congenital_genetic_conditions),
    diagnoses: trimToNull(profile.diagnoses),
    falls_history: trimToNull(profile.falls_history),
    family_history: trimToNull(profile.family_history),
    functional_independence: trimToNull(profile.functional_independence),
    has_addictions: hasAddictions ? true : null,
    implants_devices: trimToNull(profile.implants_devices),
    lifestyle_notes: trimToNull(profile.lifestyle_notes),
    mobility_aids: trimToNull(profile.mobility_aids),
    substance_use_history: trimToNull(substanceUseSummary),
    substance_use_records: substanceUseRecords.length > 0 ? substanceUseRecords : null,
    uses_substances: usesSubstances ? true : null,
  };

  return Object.values(payload).some(Boolean) ? payload : null;
};

export const buildEmergencyContactPayload = (contact: PatientEmergencyContact): Json | null => {
  const payload = {
    name: trimToNull(contact.name),
    phone: trimToNull(contact.phone),
    relationship: trimToNull(contact.relationship),
  };

  return Object.values(payload).some(Boolean) ? payload : null;
};

export const getFunctionalIndependenceLabel = (value: string | null | undefined) =>
  FUNCTIONAL_INDEPENDENCE_OPTIONS.find((option) => option.value === value)?.label ?? value ?? "";
