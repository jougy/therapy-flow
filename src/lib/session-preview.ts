import type { Database, Json } from "@/integrations/supabase/types";
import type { AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";

type Session = Database["public"]["Tables"]["sessions"]["Row"];

const isJsonObject = (value: Json | null): value is Record<string, Json | undefined> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJsonString = (value: Json | undefined) => (typeof value === "string" ? value.trim() : "");

const joinNonEmpty = (parts: string[]) => parts.filter(Boolean).join("\n\n");

export interface SessionPreviewContent {
  complaint: string;
  treatment: string;
}

const shouldShowInPatientList = (field: { showInPatientList?: boolean; systemKey?: string }) => {
  if (typeof field.showInPatientList === "boolean") {
    return field.showInPatientList;
  }

  return field.systemKey === "queixa" || field.systemKey === "sintomas" || field.systemKey === "observacoes";
};

const formatComplaintLine = (
  field: { label: string; systemKey?: string },
  session: Pick<Session, "anamnesis" | "complexity_score" | "pain_score">
) => {
  const anamnesis = isJsonObject(session.anamnesis) ? session.anamnesis : {};

  if (field.systemKey === "queixa") {
    const value = readJsonString(anamnesis.queixa);
    return value ? `${field.label}: ${value}` : "";
  }

  if (field.systemKey === "sintomas") {
    const value = readJsonString(anamnesis.sintomas);
    return value ? `${field.label}: ${value}` : "";
  }

  if (field.systemKey === "observacoes") {
    const value = readJsonString(anamnesis.observacoes);
    return value ? `${field.label}: ${value}` : "";
  }

  if (field.systemKey === "pain_score" && typeof session.pain_score === "number") {
    return `${field.label}: ${session.pain_score}/10`;
  }

  if (field.systemKey === "complexity_score" && typeof session.complexity_score === "number") {
    return `${field.label}: ${session.complexity_score}/10`;
  }

  return "";
};

export const getSessionPreviewContent = (
  session: Pick<Session, "anamnesis" | "complexity_score" | "notes" | "pain_score" | "treatment">,
  baseSchema?: AnamnesisTemplateSchema
): SessionPreviewContent => {
  const anamnesis = isJsonObject(session.anamnesis) ? session.anamnesis : {};
  const treatment = isJsonObject(session.treatment) ? session.treatment : {};

  const complaintFields = (baseSchema ?? []).filter((field) => field.systemKey && shouldShowInPatientList(field));

  const complaint = complaintFields.length > 0
    ? joinNonEmpty(complaintFields.map((field) => formatComplaintLine(field, session)))
    : joinNonEmpty([
        readJsonString(anamnesis.queixa),
        readJsonString(anamnesis.sintomas),
        readJsonString(anamnesis.observacoes),
      ]);

  const treatmentSummary = joinNonEmpty([
    readJsonString(treatment.descricao),
    readJsonString(treatment.orientacoes),
    (session.notes ?? "").trim(),
  ]);

  return {
    complaint,
    treatment: treatmentSummary,
  };
};
