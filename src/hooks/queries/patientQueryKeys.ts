import type { Database } from "@/integrations/supabase/types";
import { PATIENT_EXTRA_QUERY_KEYS } from "./usePatientExtraQueries";

export type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
export type PatientGroupRow = Database["public"]["Tables"]["patient_groups"]["Row"];
export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
export type AgendaEventRow = Database["public"]["Tables"]["agenda_events"]["Row"];
export type PatientGroupTemplateRow = Database["public"]["Tables"]["patient_group_templates"]["Row"];
export type AnamnesisFormTemplateRow = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];
export type ClinicColorSlotRow = Database["public"]["Tables"]["clinic_group_color_slots"]["Row"];
export type ProfileSummary = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name" | "email" | "job_title">;
export type GroupSuggestion = Pick<PatientGroupTemplateRow, "clinic_color_slot_id" | "color" | "name" | "normalized_name" | "status">;

export const PATIENT_QUERY_KEYS = {
  patient: (patientRef?: string | null, clinicId?: string | null) => ["patient", patientRef, "clinic", clinicId] as const,
  sessions: (patientId?: string | null, userId?: string | null) =>
    userId ? (["patient-sessions", patientId, "user", userId] as const) : (["patient-sessions", patientId] as const),
  groups: (patientId?: string | null) => ["patient-groups", patientId] as const,
  agendaEvents: (patientId?: string | null) => ["patient-agenda", patientId] as const,
  groupSuggestions: (clinicId?: string | null) => ["patient-group-suggestions", clinicId] as const,
  anamnesisTemplates: (clinicId?: string | null) => ["patient-anamnesis-templates", clinicId] as const,
  clinicBaseSchema: (clinicId?: string | null) => ["patient-clinic-base-schema", clinicId] as const,
  clinicColorSlots: (clinicId?: string | null) => ["clinic", clinicId, "color-slots"] as const,
  collaborators: (clinicId?: string | null) => ["clinic", clinicId, "profiles"] as const,
  ...PATIENT_EXTRA_QUERY_KEYS,
};

// IndexedDB storage keys
export const PATIENT_DETAIL_CACHE_KEY = (clinicId?: string | null, ref?: string | null) =>
  `patient_detail_${clinicId || "global"}_${ref || "unknown"}`;
export const PATIENT_SESSIONS_CACHE_KEY = (patientId: string, userId?: string | null) =>
  userId ? `patient_sessions_${userId}_${patientId}` : `patient_sessions_${patientId}`;
export const PATIENT_SESSIONS_SYNC_KEY = (patientId: string, userId?: string | null) =>
  userId ? `patient_sessions_sync_${userId}_${patientId}` : `patient_sessions_sync_${patientId}`;
export const PATIENT_GROUPS_CACHE_KEY = (patientId: string) => `patient_groups_${patientId}`;
export const PATIENT_AGENDA_CACHE_KEY = (patientId: string) => `patient_agenda_${patientId}`;
export const PATIENT_TEMPLATES_CACHE_KEY = (clinicId: string) => `clinic_anamnesis_templates_${clinicId}`;
export const PATIENT_SUGGESTIONS_CACHE_KEY = (clinicId: string) => `clinic_group_suggestions_${clinicId}`;
export const PATIENT_BASE_SCHEMA_CACHE_KEY = (clinicId: string) => `clinic_base_schema_${clinicId}`;
