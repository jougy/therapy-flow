import type { PatientPaymentPlanRow } from "@/lib/payment-plans";
import { getSessionBalanceCents, getSessionOriginalAmountCents } from "@/lib/session-operations";
import type { Session } from "../pacienteDetalheTypes";

export interface ClinicHealthInsuranceItem {
  id: string;
  name: string;
  ans_code: string | null;
  payment_term_days: number;
  requires_authorization_guide?: boolean;
  is_active: boolean;
}

export interface PatientHealthInsuranceRecord {
  id: string;
  clinic_id: string;
  patient_id: string;
  health_insurance_id: string | null;
  insurance_name_custom: string | null;
  card_number: string;
  card_valid_until: string | null;
  plan_tier: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreditEntry {
  id: string;
  amount_cents: number;
  method: string;
  created_at: string;
  note?: string;
}

export interface PatientCreditState {
  balance_cents: number;
  history: CreditEntry[];
}

export type PaymentSheetKind =
  | "add-credit"
  | "new-plan"
  | "link-insurance"
  | "receive-payment"
  | null;

export type ChargesFilter = "pending" | "paid" | "all";

export type { PatientPaymentPlanRow, Session };

const CREDIT_STORAGE_PREFIX = "therapy-flow:patient-credit:";

export function loadPatientCreditState(patientId: string): PatientCreditState {
  if (typeof window === "undefined" || !patientId) {
    return { balance_cents: 0, history: [] };
  }
  try {
    const raw = window.localStorage.getItem(`${CREDIT_STORAGE_PREFIX}${patientId}`);
    if (!raw) return { balance_cents: 0, history: [] };
    const parsed = JSON.parse(raw) as Partial<PatientCreditState>;
    return {
      balance_cents: Math.max(0, Number(parsed.balance_cents) || 0),
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    return { balance_cents: 0, history: [] };
  }
}

export function savePatientCreditState(patientId: string, state: PatientCreditState): void {
  if (typeof window === "undefined" || !patientId) return;
  try {
    window.localStorage.setItem(`${CREDIT_STORAGE_PREFIX}${patientId}`, JSON.stringify(state));
  } catch {
    // Ignore storage quota or private mode failures
  }
}

export function formatShortDate(dateValue?: string | null): string {
  if (!dateValue) return "Sem data";
  const normalized = dateValue.includes("T") ? dateValue : `${dateValue}T00:00:00`;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return dateValue;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(parsed);
}

export function getSessionEffectiveChargeCents(session: Session): number {
  const charged = session.amount_charged_cents ?? 0;
  if (charged > 0) return charged;
  return getSessionOriginalAmountCents(session);
}

export function isSessionPendingCharge(session: Session): boolean {
  if (session.deleted_at) return false;
  if (session.payment_status === "cortesia") return false;
  const balance = getSessionBalanceCents(session);
  return balance > 0 || session.payment_status === "pendente" || session.payment_status === "parcial";
}

export function isSessionPaidCharge(session: Session): boolean {
  if (session.deleted_at) return false;
  if (session.payment_status === "pago" || session.payment_status === "credito" || session.payment_status === "cortesia") {
    return true;
  }
  const charged = getSessionEffectiveChargeCents(session);
  return charged > 0 && getSessionBalanceCents(session) === 0;
}
