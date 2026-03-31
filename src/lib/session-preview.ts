import type { Database, Json } from "@/integrations/supabase/types";
import {
  getVisibleTemplateFields,
  type AnamnesisField,
  type AnamnesisFormValue,
  type AnamnesisTableRow,
  type AnamnesisTemplateSchema,
} from "@/lib/anamnesis-forms";
import { formatTreatmentSummary, readTreatmentState } from "@/lib/session-treatment";

type Session = Database["public"]["Tables"]["sessions"]["Row"];

const isJsonObject = (value: Json | null): value is Record<string, Json | undefined> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readJsonString = (value: Json | undefined) => (typeof value === "string" ? value.trim() : "");

const joinNonEmpty = (parts: string[]) => parts.filter(Boolean).join("\n\n");

export interface SessionPreviewContent {
  complaint: string;
  treatment: string;
}

export interface SessionPreviewIndicator {
  id: string;
  label: string;
  max: number;
  min: number;
  score: number;
}

type SessionComplaintSource = Pick<
  Session,
  "anamnesis" | "anamnesis_form_response" | "complexity_score" | "pain_score"
>;

const shouldShowInPatientList = (field: { showInPatientList?: boolean; systemKey?: string }) => {
  if (typeof field.showInPatientList === "boolean") {
    return field.showInPatientList;
  }

  return field.systemKey === "queixa" || field.systemKey === "sintomas" || field.systemKey === "observacoes";
};

const formatResponseValue = (field: AnamnesisField, responseValue: Json | undefined) => {
  if (typeof responseValue === "string") {
    const trimmed = responseValue.trim();

    if (!trimmed) {
      return "";
    }

    if (field.options?.length) {
      return field.options.find((option) => option.id === trimmed)?.label ?? trimmed;
    }

    return trimmed;
  }

  if (typeof responseValue === "number") {
    return String(responseValue);
  }

  if (Array.isArray(responseValue)) {
    if (responseValue.every((item) => typeof item === "object" && item !== null && !Array.isArray(item))) {
      const formattedRows = (responseValue as AnamnesisTableRow[])
        .map((row) =>
          (field.options ?? [])
            .map((option) => {
              const value = typeof row[option.id] === "string" ? row[option.id].trim() : "";
              return value ? `${option.label}: ${value}` : "";
            })
            .filter(Boolean)
            .join(" | ")
        )
        .filter(Boolean)
        .join(" / ");

      return formattedRows;
    }

    const formatted = responseValue
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => field.options?.find((option) => option.id === item)?.label ?? item)
      .join(", ");

    return formatted;
  }

  return "";
};

const formatComplaintLine = (
  field: AnamnesisField,
  session: SessionComplaintSource
) => {
  const anamnesis = isJsonObject(session.anamnesis) ? session.anamnesis : {};
  const formResponse = isJsonObject(session.anamnesis_form_response) ? session.anamnesis_form_response : {};

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

  if (field.id) {
    const formattedValue = formatResponseValue(field, formResponse[field.id]);
    return formattedValue ? `${field.label}: ${formattedValue}` : "";
  }

  return "";
};

const getFallbackComplaint = (session: SessionComplaintSource) => {
  const anamnesis = isJsonObject(session.anamnesis) ? session.anamnesis : {};

  return joinNonEmpty([
    readJsonString(anamnesis.queixa),
    readJsonString(anamnesis.sintomas),
    readJsonString(anamnesis.observacoes),
  ]);
};

const collectComplaintLines = (
  session: SessionComplaintSource,
  fields: AnamnesisTemplateSchema
) => joinNonEmpty(fields.map((field) => formatComplaintLine(field, session)));

export const getSessionPreviewContent = (
  session: Pick<Session, "anamnesis" | "anamnesis_form_response" | "complexity_score" | "notes" | "pain_score" | "treatment">,
  baseSchema?: AnamnesisTemplateSchema
): SessionPreviewContent => {
  const anamnesis = isJsonObject(session.anamnesis) ? session.anamnesis : {};
  const treatmentState = readTreatmentState(session.treatment);

  const complaintFields = (baseSchema ?? []).filter(
    (field) => field.type !== "section" && field.type !== "slider" && shouldShowInPatientList(field)
  );

  const complaint = complaintFields.length > 0
    ? collectComplaintLines(session, complaintFields)
    : getFallbackComplaint(session);

  const treatmentSummary = joinNonEmpty([
    formatTreatmentSummary(treatmentState),
    (session.notes ?? "").trim(),
  ]);

  return {
    complaint,
    treatment: treatmentSummary,
  };
};

export const getSessionSummaryContent = (
  session: SessionComplaintSource,
  baseSchema?: AnamnesisTemplateSchema,
  templateSchema?: AnamnesisTemplateSchema
) => {
  const visibleFields = getVisibleTemplateFields(
    [...(baseSchema ?? []), ...(templateSchema ?? [])],
    isJsonObject(session.anamnesis_form_response)
      ? (session.anamnesis_form_response as Record<string, AnamnesisFormValue>)
      : {}
  ).filter((field) => !["section", "slider", "section_selector", "horizontal_section"].includes(field.type));

  if (visibleFields.length === 0) {
    return getFallbackComplaint(session);
  }

  const complaint = collectComplaintLines(session, visibleFields);
  return complaint || getFallbackComplaint(session);
};

export const getSessionPreviewIndicators = (
  session: Pick<Session, "anamnesis_form_response" | "complexity_score" | "pain_score">,
  baseSchema?: AnamnesisTemplateSchema
): SessionPreviewIndicator[] => {
  const formResponse = isJsonObject(session.anamnesis_form_response) ? session.anamnesis_form_response : {};

  return (baseSchema ?? [])
    .filter((field) => field.type === "slider" && shouldShowInPatientList(field))
    .flatMap((field) => {
      let rawValue: number | null = null;

      if (field.systemKey === "pain_score" && typeof session.pain_score === "number") {
        rawValue = session.pain_score;
      } else if (field.systemKey === "complexity_score" && typeof session.complexity_score === "number") {
        rawValue = session.complexity_score;
      } else if (field.id) {
        const responseValue = formResponse[field.id];
        if (typeof responseValue === "number") {
          rawValue = responseValue;
        } else if (typeof responseValue === "string" && responseValue.trim()) {
          const parsed = Number(responseValue);
          rawValue = Number.isNaN(parsed) ? null : parsed;
        }
      }

      if (rawValue === null) {
        return [];
      }

      return [{
        id: field.id,
        label: field.label,
        max: field.max ?? 10,
        min: field.min ?? 0,
        score: rawValue,
      }];
    });
};
