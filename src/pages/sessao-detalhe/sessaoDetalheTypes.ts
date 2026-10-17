import type { Database } from "@/integrations/supabase/types";

export type DatabaseAnamnesisTemplate = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];

export interface SessionDocumentBuilderParams {
  clinicAddress?: string | null;
  clinicBusinessHours?: any;
  clinicCnpj?: string | null;
  clinicEmail?: string | null;
  clinicLegalName?: string | null;
  clinicLogoUrl?: string | null;
  clinicName?: string | null;
  clinicPhone?: string | null;
  patientName: string;
  providerEmail?: string | null;
  providerFullName?: string;
  providerJobTitle?: string | null;
  providerPhone?: string | null;
  providerLicense?: string | null;
  providerSpecialty?: string | null;
  quickNotes: string;
  sessionDate: string;
  treatmentBlocks: any[];
  treatmentGeneralGuidance: string;
  treatmentSummary: string;
  anamnesisIndicators: any;
  anamnesisSummary: string;
}
