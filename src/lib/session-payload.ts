import type { Database } from "@/integrations/supabase/types";
import type { AnamnesisFormResponse } from "@/lib/anamnesis-forms";
import type { TreatmentBlock } from "@/lib/session-treatment";
import { buildTreatmentPayload } from "@/lib/session-treatment";

type SessionInsert = Database["public"]["Tables"]["sessions"]["Insert"];

export interface SessionFormValues {
  anamnesisFormResponse: AnamnesisFormResponse;
  anamnesisTemplateId: string | null;
  complexityScore: number;
  groupId: string | null;
  notes: string;
  observacoes: string;
  painScore: number;
  queixa: string;
  sintomas: string;
  status: string;
  treatmentBlocks: TreatmentBlock[];
  treatmentGeneralGuidance: string;
}

interface BuildSessionPayloadParams {
  clinicId: string | null;
  creatorUserId: string;
  patientId: string;
  values: SessionFormValues;
  statusOverride?: string;
  sessionDate?: string;
}

const toIsoDateTime = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

export const getCurrentDateTimeInputValue = () => formatDateTimeForInput(new Date().toISOString());

export const formatDateTimeForInput = (value: string | null | undefined) => {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offsetMinutes = date.getTimezoneOffset();
  const localTime = new Date(date.getTime() - offsetMinutes * 60_000);

  return localTime.toISOString().slice(0, 16);
};

export const parseDateTimeInputValue = (value: string | null | undefined) => toIsoDateTime(value);

export const buildSessionPayload = ({
  clinicId,
  creatorUserId,
  patientId,
  sessionDate,
  values,
  statusOverride,
}: BuildSessionPayloadParams): SessionInsert => ({
  anamnesis_form_response: values.anamnesisFormResponse,
  anamnesis_template_id: values.anamnesisTemplateId,
  patient_id: patientId,
  user_id: creatorUserId,
  clinic_id: clinicId,
  pain_score: values.painScore,
  complexity_score: values.complexityScore,
  session_date: parseDateTimeInputValue(sessionDate),
  status: statusOverride ?? values.status,
  notes: values.notes || null,
  group_id: values.groupId || null,
  provider_id: creatorUserId,
  anamnesis: {
    observacoes: values.observacoes,
    queixa: values.queixa,
    sintomas: values.sintomas,
  },
  treatment: buildTreatmentPayload({
    blocks: values.treatmentBlocks,
    generalGuidance: values.treatmentGeneralGuidance,
  }),
});

export const isCompletedSessionLocked = (isNew: boolean, status: string) =>
  !isNew && status === "concluído";
