import { supabase } from "@/integrations/supabase/client";
import { calculateSessionUnitAmountCents } from "@/lib/payment-plans";
import { getSessionBalanceCents } from "@/lib/session-operations";
import type {
  PatientHealthInsuranceRecord,
  PatientPaymentPlanRow,
  Session,
} from "./types";

export type ReceivePaymentMethodOption =
  | "pix"
  | "cartao"
  | "dinheiro"
  | "credito"
  | "pacote";

export async function createPatientPaymentPlan(params: {
  clinicId: string;
  patientId: string;
  userId?: string | null;
  name: string;
  totalSessions: number;
  totalAmountCents: number;
  paymentMethod: string;
  paymentStatus: "pago" | "pendente";
}): Promise<void> {
  const today = new Date().toISOString().split("T")[0];
  const unitCents = calculateSessionUnitAmountCents(
    params.totalAmountCents,
    params.totalSessions,
  );

  const { error } = await supabase.from("patient_payment_plans").insert({
    clinic_id: params.clinicId,
    patient_id: params.patientId,
    created_by_user_id: params.userId ?? null,
    name: params.name.trim() || `Pacote de ${params.totalSessions} Sessões`,
    total_sessions: params.totalSessions,
    used_sessions: 0,
    total_amount_cents: params.totalAmountCents,
    session_unit_amount_cents: unitCents,
    payment_method: params.paymentMethod || "pix",
    payment_status: params.paymentStatus,
    payment_status_date: params.paymentStatus === "pago" ? today : null,
    start_date: today,
  });

  if (error) throw error;
}

export async function upsertPatientHealthInsurance(params: {
  clinicId: string;
  patientId: string;
  existingRecord: PatientHealthInsuranceRecord | null;
  healthInsuranceId: string | null;
  customName: string | null;
  cardNumber: string;
  guideNumber: string;
}): Promise<void> {
  // patient_health_insurances may not yet be present in generated database.ts
  const client = supabase as unknown as {
    from: (table: string) => {
      insert: (values: Record<string, unknown>) => Promise<{ error: Error | null }>;
      update: (values: Record<string, unknown>) => {
        eq: (col: string, val: string) => Promise<{ error: Error | null }>;
      };
    };
  };

  const payload = {
    health_insurance_id: params.healthInsuranceId || null,
    insurance_name_custom: params.healthInsuranceId ? null : params.customName?.trim() || null,
    card_number: params.cardNumber.trim(),
    plan_tier: params.guideNumber.trim() || null,
  };

  if (params.existingRecord) {
    const { error } = await client
      .from("patient_health_insurances")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.existingRecord.id);
    if (error) throw error;
    return;
  }

  const { error } = await client.from("patient_health_insurances").insert({
    clinic_id: params.clinicId,
    patient_id: params.patientId,
    ...payload,
  });

  if (error) throw error;
}

export async function receiveSessionsPayment(params: {
  targetSessions: Session[];
  method: ReceivePaymentMethodOption;
  creditBalanceCents: number;
  activePlan: PatientPaymentPlanRow | null;
  onDeductCredit: (usedCents: number) => void;
}): Promise<{ settledCount: number }> {
  const { targetSessions, method, creditBalanceCents, activePlan, onDeductCredit } = params;
  const today = new Date().toISOString().split("T")[0];

  if (targetSessions.length === 0) {
    return { settledCount: 0 };
  }

  if (method === "pix" || method === "cartao" || method === "dinheiro") {
    const dbMethod = method === "cartao" ? "cartao_credito" : method;
    for (const session of targetSessions) {
      const charged = session.amount_charged_cents ?? 0;
      const paid = Math.max(charged, session.amount_paid_cents ?? 0);
      const { error } = await supabase
        .from("sessions")
        .update({
          payment_method: dbMethod,
          payment_status: "pago",
          amount_paid_cents: paid,
          payment_status_date: today,
        })
        .eq("id", session.id);
      if (error) throw error;
    }
    return { settledCount: targetSessions.length };
  }

  if (method === "credito") {
    let remainingCredit = creditBalanceCents;
    let settledCount = 0;

    for (const session of targetSessions) {
      if (remainingCredit <= 0) break;
      const balance = getSessionBalanceCents(session);
      const charged = session.amount_charged_cents ?? 0;
      const needed = balance > 0 ? balance : charged;
      const applyCents = needed > 0 ? Math.min(remainingCredit, needed) : 0;

      const newPaid = (session.amount_paid_cents ?? 0) + applyCents;
      const newStatus = charged === 0 || newPaid >= charged ? "pago" : "parcial";

      const { error } = await supabase
        .from("sessions")
        .update({
          payment_method: "credito_usado",
          payment_status: newStatus,
          amount_paid_cents: newPaid,
          payment_status_date: newStatus === "pago" ? today : session.payment_status_date,
        })
        .eq("id", session.id);

      if (error) throw error;
      remainingCredit -= applyCents;
      settledCount += 1;
    }

    const usedCents = creditBalanceCents - remainingCredit;
    if (usedCents > 0) {
      onDeductCredit(usedCents);
    }
    return { settledCount };
  }

  if (method === "pacote" && activePlan) {
    const availableSlots = Math.max(0, activePlan.total_sessions - activePlan.used_sessions);
    const sessionsToConsume = targetSessions.slice(0, availableSlots);
    if (sessionsToConsume.length === 0) {
      throw new Error("O pacote ativo não possui sessões disponíveis.");
    }

    const isPlanPaid = activePlan.payment_status === "pago";
    for (const session of sessionsToConsume) {
      const unitCents =
        (session.amount_charged_cents ?? 0) > 0
          ? session.amount_charged_cents
          : activePlan.session_unit_amount_cents ?? 0;

      const { error } = await supabase
        .from("sessions")
        .update({
          payment_plan_id: activePlan.id,
          payment_method: activePlan.payment_method || "nao_informado",
          payment_status: isPlanPaid ? "pago" : "pendente",
          amount_charged_cents: unitCents,
          amount_paid_cents: isPlanPaid ? unitCents : session.amount_paid_cents ?? 0,
          payment_status_date: isPlanPaid ? today : session.payment_status_date,
        })
        .eq("id", session.id);
      if (error) throw error;
    }

    const newUsed = Math.min(
      activePlan.total_sessions,
      activePlan.used_sessions + sessionsToConsume.length,
    );
    const { error: planError } = await supabase
      .from("patient_payment_plans")
      .update({ used_sessions: newUsed })
      .eq("id", activePlan.id);
    if (planError) throw planError;

    return { settledCount: sessionsToConsume.length };
  }

  return { settledCount: 0 };
}
