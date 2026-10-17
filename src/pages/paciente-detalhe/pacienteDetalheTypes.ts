import type { Database } from "@/integrations/supabase/types";
import type { AgendaEventStatus } from "@/lib/agenda-events";
import type { EditablePatientStatus } from "@/lib/patient-statuses";

export type Patient = Database["public"]["Tables"]["patients"]["Row"];
export type PatientGroup = Database["public"]["Tables"]["patient_groups"]["Row"];
export type PatientGroupStatus = Database["public"]["Enums"]["patient_group_status"];
export type PatientGroupTemplate = Database["public"]["Tables"]["patient_group_templates"]["Row"];
export type AnamnesisTemplateRow = Pick<Database["public"]["Tables"]["anamnesis_form_templates"]["Row"], "id" | "name" | "schema">;
export type ClinicColorSlotRow = Database["public"]["Tables"]["clinic_group_color_slots"]["Row"];
export type Session = Database["public"]["Tables"]["sessions"]["Row"];
export type AgendaEvent = Database["public"]["Tables"]["agenda_events"]["Row"];
export type ProfileSummary = Pick<Database["public"]["Tables"]["profiles"]["Row"], "email" | "full_name" | "id" | "job_title">;
export type GroupSuggestion = Pick<PatientGroupTemplate, "clinic_color_slot_id" | "color" | "name" | "normalized_name" | "status">;

export type ShareLinkResponse = {
  completed: boolean;
  password_prefix: string;
  token: string;
};

export type PatientStatus = EditablePatientStatus;
export type PatientStatusSelectValue = PatientStatus | "delete";
export type AgendaStatusAction = AgendaEventStatus | "delete";
export type PatientGroupKind = "custom" | "default" | "cancelados";
export type PatientRecordsView = "dashboard" | "files" | "list";
