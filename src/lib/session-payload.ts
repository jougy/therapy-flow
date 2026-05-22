import type { Database } from "@/integrations/supabase/types";
import type { AnamnesisFormResponse } from "@/lib/anamnesis-forms";
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

export const buildSessionPayload = ({
  clinicId,
  creatorUserId,
  patientId,
  sessionDate,
  values,
  statusOverride,
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

  return {
    anamnesis_form_response: values.anamnesisFormResponse,
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
  };
};

export const isCompletedSessionLocked = (isNew: boolean, status: string) =>
  !isNew && status === "concluído";
