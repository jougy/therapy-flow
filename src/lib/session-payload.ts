import type { Database } from "@/integrations/supabase/types";
import type { AnamnesisFormResponse, AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import { sanitizeAnamnesisFormResponse } from "@/lib/anamnesis-forms";
import { INPUT_LIMITS, sanitizeMultilineInput, sanitizeSingleLineInput } from "@/lib/input-security";
import {
  normalizePaymentInstallments,
  normalizeSessionPaymentStatus,
  parseCurrencyToCents,
  sanitizePaymentAdjustmentReason,
  type SessionPaymentMethod,
  type SessionPaymentStatus,
} from "@/lib/session-operations";
import type { TreatmentBlock } from "@/lib/session-treatment";
import { buildTreatmentPayload } from "@/lib/session-treatment";

type SessionInsert = Database["public"]["Tables"]["sessions"]["Insert"];

export const SESSION_DATE_MIN_YEAR = 2000;
export const SESSION_DATE_MAX_YEAR = 2100;

export interface SessionFormValues {
  anamnesisFormResponse: AnamnesisFormResponse;
  anamnesisTemplateId: string | null;
  complexityScore: number;
  groupId: string | null;
  careLineIds?: string[];
  amountCharged: string;
  amountOriginal: string;
  amountPaid: string;
  notes: string;
  observacoes: string;
  painScore: number;
  patientArrivedAt: string;
  paymentAdjustmentReason: string;
  paymentInstallments: number;
  paymentMethod: SessionPaymentMethod;
  paymentStatusDate: string;
  paymentStatus: SessionPaymentStatus;
  queixa: string;
  scheduledStartAt: string;
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
  parentSessionId?: string | null;
  evolutionGroupId?: string | null;
}

const isDateTimeInAllowedRange = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return false;
  }
  const parsed = new Date(value);
  const year = parsed.getFullYear();

  return !Number.isNaN(parsed.getTime()) && year >= SESSION_DATE_MIN_YEAR && year <= SESSION_DATE_MAX_YEAR;
};

const toIsoDateTime = (value: string | null | undefined) => {
  if (!isDateTimeInAllowedRange(value)) {
    return new Date().toISOString();
  }

  return new Date(value as string).toISOString();
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

export const isSessionDateTimeInputValid = isDateTimeInAllowedRange;

export const parseDateTimeInputValue = (value: string | null | undefined) => toIsoDateTime(value);

export const parseOptionalDateTimeInputValue = (value: string | null | undefined) => {
  if (!value?.trim()) {
    return null;
  }

  return isDateTimeInAllowedRange(value) ? new Date(value).toISOString() : null;
};

export const parseOptionalDateInputValue = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";

  if (!trimmed) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }

  const parsed = new Date(`${trimmed}T12:00:00`);
  const year = parsed.getFullYear();

  if (Number.isNaN(parsed.getTime()) || year < SESSION_DATE_MIN_YEAR || year > SESSION_DATE_MAX_YEAR) {
    return null;
  }

  return parsed.toISOString().slice(0, 10) === trimmed ? trimmed : null;
};

/**
 * Extracts and sanitizes care line candidates from modular form fields
 * that have `includeInGlobalDashboard: true` or `systemKey: "sintomas"`.
 */
export const extractDashboardCareLineItems = (
  schema: AnamnesisTemplateSchema,
  formResponse: AnamnesisFormResponse
): string[] => {
  const dashboardFields = schema.filter(
    (f) => f.includeInGlobalDashboard || f.systemKey === "sintomas"
  );
  const items: string[] = [];

  for (const field of dashboardFields) {
    const fieldValue = formResponse[field.id];

    if (Array.isArray(fieldValue)) {
      for (const item of fieldValue) {
        if (typeof item === "string") {
          items.push(item);
        } else if (item && typeof item === "object") {
          const strCandidate =
            (typeof (item as any).label === "string" ? (item as any).label : null) ??
            (typeof (item as any).name === "string" ? (item as any).name : null) ??
            (typeof (item as any).value === "string" ? (item as any).value : null);
          if (strCandidate) items.push(strCandidate);
        }
      }
    } else if (typeof fieldValue === "string" && fieldValue.trim()) {
      if (field.type === "simple_list" || field.type === "tags") {
        items.push(...fieldValue.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean));
      } else {
        items.push(fieldValue.trim());
      }
    }
  }

  const sanitizedList: string[] = [];
  const seen = new Set<string>();
  for (const raw of items) {
    const sanitized = sanitizeSingleLineInput(raw, INPUT_LIMITS.name).trim();
    if (sanitized) {
      const lower = sanitized.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        sanitizedList.push(sanitized);
      }
    }
  }

  return sanitizedList;
};

export const buildSessionPayload = ({
  clinicId,
  creatorUserId,
  patientId,
  sessionDate,
  values,
  statusOverride,
  parentSessionId,
  evolutionGroupId,
}: BuildSessionPayloadParams): SessionInsert => {
  const amountChargedCents = parseCurrencyToCents(values.amountCharged);
  const parsedOriginalAmountCents = parseCurrencyToCents(values.amountOriginal);
  const amountOriginalCents = parsedOriginalAmountCents > 0 ? parsedOriginalAmountCents : amountChargedCents;
  const amountPaidCents = parseCurrencyToCents(values.amountPaid);
  const normalizedPaymentStatus = normalizeSessionPaymentStatus({
    amountChargedCents,
    amountPaidCents,
    requestedStatus: values.paymentStatus,
  });

  const hasCareLineIdsArray = Array.isArray(values.careLineIds);
  const resolvedCareLineIds = hasCareLineIdsArray
    ? values.careLineIds!
    : values.groupId
    ? [values.groupId]
    : [];
  const resolvedGroupId = resolvedCareLineIds.length > 0
    ? resolvedCareLineIds[0]
    : (hasCareLineIdsArray ? null : (values.groupId || null));

  return {
    anamnesis_form_response: sanitizeAnamnesisFormResponse(values.anamnesisFormResponse),
    anamnesis_template_id: values.anamnesisTemplateId,
    patient_id: patientId,
    user_id: creatorUserId,
    clinic_id: clinicId,
    pain_score: values.painScore,
    complexity_score: values.complexityScore,
    session_date: parseDateTimeInputValue(sessionDate),
    scheduled_start_at: parseOptionalDateTimeInputValue(values.scheduledStartAt),
    patient_arrived_at: parseOptionalDateTimeInputValue(values.patientArrivedAt),
    payment_status: normalizedPaymentStatus,
    amount_charged_cents: amountChargedCents,
    amount_original_cents: amountOriginalCents,
    amount_paid_cents: amountPaidCents,
    payment_adjustment_reason: sanitizePaymentAdjustmentReason(values.paymentAdjustmentReason) || null,
    payment_installments: normalizedPaymentStatus === "cortesia" ? 1 : normalizePaymentInstallments(values.paymentInstallments),
    payment_method: normalizedPaymentStatus === "cortesia" ? "cortesia" : values.paymentMethod,
    payment_status_date: parseOptionalDateInputValue(values.paymentStatusDate),
    status: statusOverride ?? values.status,
    notes: sanitizeMultilineInput(values.notes, INPUT_LIMITS.clinicalLongText).trim() || null,
    group_id: resolvedGroupId,
    provider_id: creatorUserId,
    parent_session_id: parentSessionId || null,
    evolution_group_id: evolutionGroupId || null,
    anamnesis: {
      observacoes: sanitizeMultilineInput(values.observacoes, INPUT_LIMITS.clinicalLongText),
      queixa: sanitizeMultilineInput(values.queixa, INPUT_LIMITS.clinicalLongText),
      sintomas: sanitizeMultilineInput(values.sintomas, INPUT_LIMITS.clinicalLongText),
      care_line_ids: resolvedCareLineIds,
    },
    treatment: buildTreatmentPayload({
      blocks: values.treatmentBlocks,
      generalGuidance: values.treatmentGeneralGuidance,
    }),
  };
};

export const isCompletedSessionLocked = (isNew: boolean, status: string) =>
  !isNew && status === "concluído";
