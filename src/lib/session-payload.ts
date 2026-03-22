import type { Database } from "@/integrations/supabase/types";

type SessionInsert = Database["public"]["Tables"]["sessions"]["Insert"];

export interface SessionFormValues {
  complexityScore: number;
  descricaoTratamento: string;
  groupId: string | null;
  notes: string;
  observacoes: string;
  orientacoes: string;
  painScore: number;
  queixa: string;
  selectedTechniques: string[];
  sintomas: string;
  status: string;
}

interface BuildSessionPayloadParams {
  clinicId: string | null;
  patientId: string;
  userId: string;
  values: SessionFormValues;
  statusOverride?: string;
}

export const buildSessionPayload = ({
  clinicId,
  patientId,
  userId,
  values,
  statusOverride,
}: BuildSessionPayloadParams): SessionInsert => ({
  patient_id: patientId,
  user_id: userId,
  clinic_id: clinicId,
  pain_score: values.painScore,
  complexity_score: values.complexityScore,
  status: statusOverride ?? values.status,
  notes: values.notes || null,
  group_id: values.groupId || null,
  anamnesis: {
    observacoes: values.observacoes,
    queixa: values.queixa,
    sintomas: values.sintomas,
  },
  treatment: {
    descricao: values.descricaoTratamento,
    orientacoes: values.orientacoes,
    techniques: [...values.selectedTechniques],
  },
});

export const isCompletedSessionLocked = (isNew: boolean, status: string) =>
  !isNew && status === "concluído";
