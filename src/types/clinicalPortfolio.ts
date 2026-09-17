import type { Json } from "@/integrations/supabase/types";

export interface ClinicalPortfolioItem {
  id: string;
  clinic_id: string;
  clinic_name: string;
  clinic_route_key?: string | null;
  clinic_logo_url?: string | null;
  patient_id: string;
  patient_ref?: string | null;
  patient_name?: string | null;
  patient_pseudonym: string;
  patient_demographics: string;
  session_date: string;
  scheduled_start_at: string | null;
  pain_score: number | null;
  complexity_score: number | null;
  notes_sanitized: string | null;
  treatment_sanitized: string | null;
  status: string;
  anamnesis_form_response?: Json | null;
  tags?: Array<{ id: string; name: string; color: string }>;
}

export interface ClinicalPortfolioRpcRow {
  session_id: string;
  clinic_id: string;
  clinic_name?: string | null;
  clinic_route_key?: string | null;
  patient_id: string;
  patient_ref?: string | null;
  patient_name?: string | null;
  patient_pseudonym?: string | null;
  patient_demographics?: string | null;
  session_date: string;
  pain_score?: number | null;
  complexity_score?: number | null;
  notes_sanitized?: string | null;
  treatment_sanitized?: string | null;
  session_status: string;
  anamnesis_form_response?: Json | null;
  care_lines?: Json | null;
  anamnesis_base_schema?: Json | null;
}

export interface ClinicalPortfolioMetrics {
  totalAttendances: number;
  totalClinics: number;
  averagePainScore: number | null;
  averageComplexityScore: number | null;
}

export interface ClinicalPortfolioFilters {
  clinicId: string;
  searchQuery: string;
  dateFilter?: string;
}

