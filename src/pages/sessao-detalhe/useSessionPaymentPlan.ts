import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { notifyAgendaEventsUpdated } from "@/lib/agenda-events";
import {
  calculateSessionUnitAmountCents,
  findConflictingAgendaEvent,
  generatePlanScheduleDates,
  type PatientPaymentPlanRow,
  type PaymentPlanFormValues,
} from "@/lib/payment-plans";
import { parseCurrencyToCents } from "@/lib/session-operations";
import type { AgendaEventRow } from "@/integrations/supabase/types/tables";

export function useSessionPaymentPlan() {
  const [activePaymentPlan, setActivePaymentPlan] = useState<PatientPaymentPlanRow | null>(null);
  const [lastCompletedPlan, setLastCompletedPlan] = useState<PatientPaymentPlanRow | null>(null);
  const [planAgendaEvents, setPlanAgendaEvents] = useState<AgendaEventRow[]>([]);

  useEffect(() => {
    if (!activePaymentPlan?.id) {
      setPlanAgendaEvents([]);
      return;
    }

    let isMounted = true;
    void supabase
      .from("agenda_events")
      .select("*")
      .eq("payment_plan_id", activePaymentPlan.id)
      .neq("status", "cancelado")
      .order("scheduled_for", { ascending: true })
      .then(({ data }) => {
        if (isMounted && data) {
          setPlanAgendaEvents(data as AgendaEventRow[]);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activePaymentPlan?.id]);

  const resolveInitialPlan = async ({
    isNew,
    sessionPlanId,
    agendaEventId,
    realPatientId,
  }: {
    isNew: boolean;
    sessionPlanId?: string | null;
    agendaEventId?: string;
    realPatientId: string;
  }): Promise<{ plan: PatientPaymentPlanRow | null; completedPlan: PatientPaymentPlanRow | null }> => {
    if (!isNew && sessionPlanId) {
      const { data: planData } = await supabase
        .from("patient_payment_plans")
        .select("*")
        .eq("id", sessionPlanId)
        .maybeSingle();

      if (planData) {
        setActivePaymentPlan(planData as PatientPaymentPlanRow);
        return { plan: planData as PatientPaymentPlanRow, completedPlan: null };
      }
    }

    if (isNew) {
      let matchedPlan: PatientPaymentPlanRow | null = null;

      if (agendaEventId) {
        const { data: agendaEvt } = await supabase
          .from("agenda_events")
          .select("id, payment_plan_id, payment_plan_session_index")
          .eq("id", agendaEventId)
          .maybeSingle();

        if (agendaEvt?.payment_plan_id) {
          const { data: planFromEvt } = await supabase
            .from("patient_payment_plans")
            .select("*")
            .eq("id", agendaEvt.payment_plan_id)
            .maybeSingle();
          if (planFromEvt) {
            matchedPlan = planFromEvt as PatientPaymentPlanRow;
          }
        }
      }

      let finishedPlan: PatientPaymentPlanRow | null = null;
      if (!matchedPlan && realPatientId) {
        const { data: patientPlans } = await supabase
          .from("patient_payment_plans")
          .select("*")
          .eq("patient_id", realPatientId)
          .neq("payment_status", "cancelado")
          .order("created_at", { ascending: false });

        matchedPlan =
          patientPlans?.find((p) => (p.used_sessions || 0) < (p.total_sessions || 1)) ?? null;
        finishedPlan =
          patientPlans?.find((p) => (p.used_sessions || 0) >= (p.total_sessions || 1)) ?? null;

        if (finishedPlan && !matchedPlan) {
          setLastCompletedPlan(finishedPlan as PatientPaymentPlanRow);
        }
      }

      if (matchedPlan) {
        setActivePaymentPlan(matchedPlan);
      }

      return { plan: matchedPlan, completedPlan: finishedPlan };
    }

    return { plan: null, completedPlan: null };
  };

  const processSessionPaymentPlan = async ({
    paymentPlanForm,
    targetClinicId,
    targetPatientId,
    currentNormalizedPaymentStatus,
    userId,
    patientName,
    agendaEventId,
    sessionData,
  }: {
    paymentPlanForm: PaymentPlanFormValues;
    targetClinicId: string;
    targetPatientId: string;
    currentNormalizedPaymentStatus: string;
    userId: string;
    patientName: string;
    agendaEventId?: string;
    sessionData: any;
  }) => {
    if (paymentPlanForm.createPlan && targetClinicId && targetPatientId) {
      const totalAmountCents = parseCurrencyToCents(paymentPlanForm.totalAmount);
      const unitAmountCents = calculateSessionUnitAmountCents(totalAmountCents, paymentPlanForm.totalSessions);

      const { data: newPlan } = await supabase
        .from("patient_payment_plans")
        .insert({
          clinic_id: targetClinicId,
          patient_id: targetPatientId,
          name: paymentPlanForm.name,
          total_sessions: paymentPlanForm.totalSessions,
          used_sessions: 1,
          total_amount_cents: totalAmountCents,
          session_unit_amount_cents: unitAmountCents,
          payment_method: paymentPlanForm.paymentMethod,
          payment_installments: paymentPlanForm.paymentInstallments,
          payment_status: paymentPlanForm.paymentStatus,
          payment_status_date: paymentPlanForm.paymentStatusDate || new Date().toISOString().split("T")[0],
          start_date: paymentPlanForm.startDate || new Date().toISOString().split("T")[0],
          created_by_user_id: userId,
        })
        .select("*")
        .single();

      if (newPlan) {
        sessionData.payment_plan_id = newPlan.id;
        sessionData.payment_plan_session_index = 1;
        sessionData.payment_status = "credito";

        if (paymentPlanForm.autoPreScheduleAgenda && paymentPlanForm.totalSessions > 1) {
          const scheduleDates = generatePlanScheduleDates({
            count: paymentPlanForm.totalSessions - 1,
            startDateStr: paymentPlanForm.startDate || new Date().toISOString().split("T")[0],
            recurringWeekdays: paymentPlanForm.recurringWeekdays,
            recurringTime: paymentPlanForm.recurringTime || "14:00",
          });

          // Busca eventos futuros existentes do paciente para unificar recorrências coincidentes
          const { data: existingPatientEvents } = await supabase
            .from("agenda_events")
            .select("id, scheduled_for, status, patient_id, title, generated_by_recurring_patient")
            .eq("patient_id", targetPatientId)
            .gte("scheduled_for", new Date().toISOString())
            .neq("status", "cancelado");

          const existingList = existingPatientEvents || [];
          const newAgendaEvents: any[] = [];

          for (let idx = 0; idx < scheduleDates.length; idx++) {
            const date = scheduleDates[idx];
            const sessionIndex = idx + 2;
            const conflict = findConflictingAgendaEvent(date, existingList);

            if (conflict) {
              // Unifica: o agendamento de recorrência preexistente torna-se o agendamento do pacote
              await supabase
                .from("agenda_events")
                .update({
                  payment_plan_id: newPlan.id,
                  payment_plan_session_index: sessionIndex,
                  title: `${patientName || "Paciente"} (${paymentPlanForm.name} - ${sessionIndex}/${paymentPlanForm.totalSessions})`,
                  status: "aguardando_confirmacao",
                  updated_at: new Date().toISOString(),
                })
                .eq("id", conflict.id);
            } else {
              newAgendaEvents.push({
                clinic_id: targetClinicId,
                patient_id: targetPatientId,
                user_id: userId,
                event_type: "atendimento" as const,
                title: `${patientName || "Paciente"} (${paymentPlanForm.name} - ${sessionIndex}/${paymentPlanForm.totalSessions})`,
                scheduled_for: date.toISOString(),
                status: "aguardando_confirmacao" as const,
                payment_plan_id: newPlan.id,
                payment_plan_session_index: sessionIndex,
              });
            }
          }

          if (newAgendaEvents.length > 0) {
            await supabase.from("agenda_events").insert(newAgendaEvents);
          }
          notifyAgendaEventsUpdated();
        }
      }
    } else if (activePaymentPlan && targetClinicId && targetPatientId && currentNormalizedPaymentStatus === "credito") {
      const nextIndex = (activePaymentPlan.used_sessions || 0) + 1;
      sessionData.payment_plan_id = activePaymentPlan.id;
      sessionData.payment_plan_session_index = nextIndex;
      sessionData.payment_status = "credito";

      await supabase
        .from("patient_payment_plans")
        .update({
          used_sessions: nextIndex,
          updated_at: new Date().toISOString(),
        })
        .eq("id", activePaymentPlan.id);

      if (!agendaEventId) {
        await supabase
          .from("agenda_events")
          .delete()
          .eq("payment_plan_id", activePaymentPlan.id)
          .eq("payment_plan_session_index", nextIndex);
        notifyAgendaEventsUpdated();
      }
    }
  };

  const handleUpdateAgendaEventDate = async (eventId: string, newDateIso: string) => {
    const { error } = await supabase
      .from("agenda_events")
      .update({
        scheduled_for: newDateIso,
        updated_at: new Date().toISOString(),
      })
      .eq("id", eventId);

    if (error) {
      throw error;
    }

    setPlanAgendaEvents((prev) =>
      prev.map((e) => (e.id === eventId ? { ...e, scheduled_for: newDateIso } : e))
    );
    notifyAgendaEventsUpdated();
    toast({
      title: "Agendamento atualizado",
      description: "A data e o horário foram alterados na Agenda com sucesso.",
    });
  };

  const handlePlanUpdated = async (updatedPlan: PatientPaymentPlanRow) => {
    const { error } = await supabase
      .from("patient_payment_plans")
      .update({
        name: updatedPlan.name,
        total_sessions: updatedPlan.total_sessions,
        total_amount_cents: updatedPlan.total_amount_cents,
        session_unit_amount_cents: updatedPlan.session_unit_amount_cents,
        payment_method: updatedPlan.payment_method,
        payment_installments: updatedPlan.payment_installments,
        payment_status: updatedPlan.payment_status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", updatedPlan.id);

    if (error) {
      toast({
        title: "Erro ao atualizar pacote",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    setActivePaymentPlan(updatedPlan);
  };

  const handlePayDebit = async () => {
    if (!activePaymentPlan) return;
    const today = new Date().toISOString().split("T")[0];
    const { error } = await supabase
      .from("patient_payment_plans")
      .update({
        payment_status: "pago",
        payment_status_date: today,
        updated_at: new Date().toISOString(),
      })
      .eq("id", activePaymentPlan.id);

    if (error) {
      throw error;
    }

    setActivePaymentPlan((prev) =>
      prev
        ? {
            ...prev,
            payment_status: "pago",
            payment_status_date: today,
          }
        : null
    );
  };

  const handleUnlinkPlan = () => {
    setActivePaymentPlan(null);
    toast({
      title: "Pacote desvinculado",
      description: "Este atendimento agora pode ser cobrado como avulso ou cortesia.",
    });
  };

  return {
    activePaymentPlan,
    setActivePaymentPlan,
    lastCompletedPlan,
    setLastCompletedPlan,
    planAgendaEvents,
    resolveInitialPlan,
    processSessionPaymentPlan,
    handleUpdateAgendaEventDate,
    handlePlanUpdated,
    handlePayDebit,
    handleUnlinkPlan,
  };
}
