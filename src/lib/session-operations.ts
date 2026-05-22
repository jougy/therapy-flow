export type SessionPaymentStatus = "nao_cobrado" | "pendente" | "parcial" | "pago" | "credito" | "cortesia";
export type SessionPaymentMethod =
  | "dinheiro"
  | "pix"
  | "cartao_debito"
  | "cartao_credito"
  | "convenio"
  | "transferencia"
  | "credito_usado"
  | "cortesia"
  | "nao_informado";

export const MAX_SESSION_AMOUNT_CENTS = 10_000_000;
export const PAYMENT_ADJUSTMENT_REASON_MAX_LENGTH = 240;

export type OperationalSession = {
  amount_charged_cents?: number | null;
  amount_original_cents?: number | null;
  amount_paid_cents?: number | null;
  patient_arrived_at?: string | null;
  payment_adjustment_reason?: string | null;
  payment_status?: string | null;
  scheduled_start_at?: string | null;
  status?: string | null;
};

export const PAYMENT_STATUS_OPTIONS: { label: string; value: SessionPaymentStatus }[] = [
  { value: "nao_cobrado", label: "Não cobrado" },
  { value: "pendente", label: "Pendente" },
  { value: "parcial", label: "Parcial" },
  { value: "pago", label: "Pago" },
  { value: "credito", label: "Crédito" },
  { value: "cortesia", label: "Cortesia" },
];

export const PAYMENT_METHOD_OPTIONS: { label: string; value: SessionPaymentMethod }[] = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "pix", label: "Pix" },
  { value: "cartao_debito", label: "Cartão débito" },
  { value: "cartao_credito", label: "Cartão crédito" },
  { value: "convenio", label: "Convênio" },
  { value: "transferencia", label: "Transferência" },
  { value: "credito_usado", label: "Crédito usado" },
  { value: "cortesia", label: "Cortesia" },
  { value: "nao_informado", label: "Não informado" },
];

export const PAYMENT_INSTALLMENT_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const value = index + 1;

  return {
    label: value === 1 ? "À vista" : `${value}x`,
    value,
  };
});

export const getPaymentStatusLabel = (status: string | null | undefined) =>
  PAYMENT_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "Não cobrado";

export const getPaymentMethodLabel = (method: string | null | undefined) =>
  PAYMENT_METHOD_OPTIONS.find((option) => option.value === method)?.label ?? "Não informado";

export const normalizePaymentInstallments = (value: number | string | null | undefined) => {
  const parsed = typeof value === "string" ? Number(value) : value ?? 1;

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 12) {
    return 1;
  }

  return parsed;
};

export const getPaymentInstallmentLabel = (value: number | string | null | undefined) =>
  PAYMENT_INSTALLMENT_OPTIONS.find((option) => option.value === normalizePaymentInstallments(value))?.label ?? "À vista";

export const normalizeSessionPaymentStatus = ({
  amountChargedCents,
  amountPaidCents,
  requestedStatus,
}: {
  amountChargedCents: number;
  amountPaidCents: number;
  requestedStatus: SessionPaymentStatus;
}): SessionPaymentStatus => {
  if (requestedStatus === "cortesia") {
    return "cortesia";
  }

  if (amountChargedCents <= 0 && amountPaidCents <= 0) {
    return "nao_cobrado";
  }

  if (amountPaidCents <= 0) {
    return "pendente";
  }

  if (amountPaidCents < amountChargedCents) {
    return "parcial";
  }

  if (amountPaidCents === amountChargedCents) {
    return "pago";
  }

  return "credito";
};

export const parseCurrencyToCents = (value: string) => {
  const trimmed = value.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");

  if (!trimmed) {
    return 0;
  }

  const isBrazilianThousands = /^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(trimmed);
  const isPlainDecimal = /^\d+([,.]\d{1,2})?$/.test(trimmed);

  if (!isBrazilianThousands && !isPlainDecimal) {
    return 0;
  }

  const normalized = isBrazilianThousands
    ? trimmed.replace(/\./g, "").replace(",", ".")
    : trimmed.replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.min(Math.round(parsed * 100), MAX_SESSION_AMOUNT_CENTS);
};

export const sanitizePaymentAdjustmentReason = (value: string) =>
  value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim()
    .slice(0, PAYMENT_ADJUSTMENT_REASON_MAX_LENGTH);

export const centsToCurrencyInput = (value: number | null | undefined) => {
  const cents = Math.max(0, value ?? 0);
  return cents
    ? new Intl.NumberFormat("pt-BR", {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
      }).format(cents / 100)
    : "";
};

export const currencyDigitsToInput = (value: string) => {
  const digits = value.replace(/\D/g, "").replace(/^0+(?=\d)/, "");

  if (!digits || Number(digits) <= 0) {
    return "";
  }

  return centsToCurrencyInput(Math.min(Number(digits), MAX_SESSION_AMOUNT_CENTS));
};

export const formatMoneyCents = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    style: "currency",
  }).format((value ?? 0) / 100);

export const getSessionOriginalAmountCents = (session: OperationalSession) => {
  const original = session.amount_original_cents ?? 0;

  return original > 0 ? original : session.amount_charged_cents ?? 0;
};

export const getPaymentAdjustmentCents = (session: OperationalSession) =>
  (session.amount_charged_cents ?? 0) - getSessionOriginalAmountCents(session);

export const getPaymentAdjustmentPercent = (session: OperationalSession) => {
  const original = getSessionOriginalAmountCents(session);

  if (original <= 0) {
    return 0;
  }

  return Math.round((getPaymentAdjustmentCents(session) / original) * 100);
};

export const hasPaymentAdjustment = (session: OperationalSession) =>
  getSessionOriginalAmountCents(session) > 0 && getPaymentAdjustmentCents(session) !== 0;

export const getSessionBalanceCents = (session: OperationalSession) => {
  if (session.payment_status === "cortesia") {
    return 0;
  }

  return Math.max(0, (session.amount_charged_cents ?? 0) - (session.amount_paid_cents ?? 0));
};

export const getSessionCreditCents = (session: OperationalSession) => {
  if (session.payment_status === "cortesia") {
    return 0;
  }

  return Math.max(0, (session.amount_paid_cents ?? 0) - (session.amount_charged_cents ?? 0));
};

export const getArrivalDelayMinutes = (session: OperationalSession) => {
  if (!session.scheduled_start_at || !session.patient_arrived_at) {
    return null;
  }

  const scheduled = new Date(session.scheduled_start_at).getTime();
  const arrived = new Date(session.patient_arrived_at).getTime();

  if (Number.isNaN(scheduled) || Number.isNaN(arrived)) {
    return null;
  }

  return Math.round((arrived - scheduled) / 60_000);
};

export const buildPatientOperationalSummary = (sessions: OperationalSession[]) => {
  const sessionsWithSchedule = sessions.filter((session) => session.scheduled_start_at);
  const absences = sessions.filter((session) => session.status === "cancelado" && !session.patient_arrived_at).length;
  const delayedSessions = sessions
    .map(getArrivalDelayMinutes)
    .filter((delay): delay is number => delay !== null && delay > 0);
  const totalDelay = delayedSessions.reduce((sum, delay) => sum + delay, 0);
  const openBalanceCents = sessions.reduce((sum, session) => sum + getSessionBalanceCents(session), 0);
  const creditCents = sessions.reduce((sum, session) => sum + getSessionCreditCents(session), 0);
  const chargedCents = sessions.reduce((sum, session) => sum + (session.amount_charged_cents ?? 0), 0);
  const originalChargedCents = sessions.reduce((sum, session) => sum + getSessionOriginalAmountCents(session), 0);
  const paidCents = sessions.reduce((sum, session) => sum + (session.amount_paid_cents ?? 0), 0);

  return {
    absences,
    averageDelayMinutes: delayedSessions.length ? Math.round(totalDelay / delayedSessions.length) : 0,
    chargedCents,
    creditCents,
    openBalanceCents,
    originalChargedCents,
    paidCents,
    scheduledCount: sessionsWithSchedule.length,
  };
};
