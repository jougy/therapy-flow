import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  assertAgendaEventDateTimeIsFuture,
  buildAgendaEventPayload,
  formatSupabaseErrorMessage,
  getAgendaEventDateTime,
  isAgendaEventDateTimeInPast,
  notifyAgendaEventsUpdated,
} from "@/lib/agenda-events";
import {
  DEFAULT_PATIENT_RECURRENCE_TIME,
  getNextPatientRecurrenceDateTime,
  normalizePatientRecurringTime,
  normalizePatientRecurringWeekdays,
} from "@/lib/patient-recurrence";
import { findConflictingAgendaEvent } from "@/lib/payment-plans";
import type { AgendaEventQueryResult } from "@/lib/agenda-cache";
import type { AgendaEvent, AgendaStatusAction, Patient, PatientGroup } from "../pacienteDetalheTypes";
import { getAgendaEventStatus, getDateInputValue, getDefaultAgendaInputs, getPatientGroupKind, getTimeInputValue } from "../pacienteDetalheHelpers";

interface Params {
  patient: Patient | null;
  realPatientId: string | undefined;
  clinicId: string | null | undefined;
  effectiveClinicId: string | null;
  user: User | null;
  groups: PatientGroup[];
  agendaEvents: AgendaEvent[];
  invalidatePatientData: (patientId: string, clinicId?: string | null, keys?: string[]) => Promise<void>;
  optimisticUpdatePatient: (patient: Patient) => void;
  optimisticUpsertAgendaEvent: (event: AgendaEventQueryResult) => Promise<void>;
  optimisticDeleteAgendaEvent: (eventId: string) => Promise<void>;
}

export function usePatientAgendaActions(params: Params) {
  const {
    patient, realPatientId, clinicId, effectiveClinicId, user, groups, agendaEvents,
    invalidatePatientData, optimisticUpdatePatient, optimisticUpsertAgendaEvent, optimisticDeleteAgendaEvent,
  } = params;

  const [agendaDialogOpen, setAgendaDialogOpen] = useState(false);
  const [agendaDate, setAgendaDate] = useState(() => getDefaultAgendaInputs().date);
  const [agendaTime, setAgendaTime] = useState(() => getDefaultAgendaInputs().time);
  const [savingAgendaEvent, setSavingAgendaEvent] = useState(false);
  const [selectedAgendaEvent, setSelectedAgendaEvent] = useState<AgendaEvent | null>(null);
  const [selectedAgendaStatusAction, setSelectedAgendaStatusAction] = useState<AgendaStatusAction>("aguardando_confirmacao");
  const [selectedAgendaDate, setSelectedAgendaDate] = useState(() => getDefaultAgendaInputs().date);
  const [selectedAgendaTime, setSelectedAgendaTime] = useState("09:00");
  const [savingAgendaDetails, setSavingAgendaDetails] = useState(false);

  const [recurrenceDialogOpen, setRecurrenceDialogOpen] = useState(false);
  const [recurrenceEnabled, setRecurrenceEnabled] = useState(false);
  const [recurrenceWeekdays, setRecurrenceWeekdays] = useState<number[]>([]);
  const [recurrenceTime, setRecurrenceTime] = useState(DEFAULT_PATIENT_RECURRENCE_TIME);
  const [savingRecurrence, setSavingRecurrence] = useState(false);

  useEffect(() => {
    if (!patient) return;
    setRecurrenceEnabled(Boolean(patient.is_recurring));
    setRecurrenceTime(normalizePatientRecurringTime(patient.recurring_time));
  }, [patient]);

  const handleOpenPatientAgendaDialog = useCallback(() => {
    const next = getDefaultAgendaInputs();
    setAgendaDate(next.date);
    setAgendaTime(next.time);
    setAgendaDialogOpen(true);
  }, []);

  const handleOpenAgendaDetails = useCallback((event: AgendaEvent) => {
    setSelectedAgendaEvent(event);
    setSelectedAgendaStatusAction(getAgendaEventStatus(event));
    setSelectedAgendaDate(getDateInputValue(new Date(event.scheduled_for)));
    setSelectedAgendaTime(getTimeInputValue(event.scheduled_for));
  }, []);

  const handleSchedulePatientAgendaEvent = async () => {
    if (!user || !patient) return;
    try {
      const selectedDateTime = getAgendaEventDateTime(agendaDate, agendaTime);
      assertAgendaEventDateTimeIsFuture(selectedDateTime, undefined, 15);
      setSavingAgendaEvent(true);
      const payload = buildAgendaEventPayload({
        clinicId: effectiveClinicId, eventType: "atendimento", graceMinutes: 15,
        selectedDate: agendaDate as unknown as Date, selectedPatient: { id: patient.id, name: patient.name },
        time: agendaTime, title: patient.name, userId: user.id,
      });
      let res = await supabase.from("agenda_events").insert(payload).select("*").single();
      if (res.error && (res.error.code === "42703" || res.error.message.includes("duration_minutes"))) {
        const fb = { ...payload };
        delete (fb as Record<string, unknown>).duration_minutes;
        res = await supabase.from("agenda_events").insert(fb).select("*").single();
      }
      if (res.error) throw res.error;
      if (res.data) await optimisticUpsertAgendaEvent(res.data as AgendaEvent);
      setAgendaDialogOpen(false);
      notifyAgendaEventsUpdated();
      toast({ title: "Agendamento confirmado" });
    } catch (error) {
      toast({ title: "Erro ao salvar agendamento", description: formatSupabaseErrorMessage(error, "Não foi possível salvar o agendamento."), variant: "destructive" });
    } finally {
      setSavingAgendaEvent(false);
    }
  };

  const toggleRecurrenceWeekday = (weekday: number, checked: boolean | "indeterminate") => {
    setRecurrenceWeekdays((curr) =>
      checked === true ? (curr.includes(weekday) ? curr : [...curr, weekday].sort((a, b) => a - b)) : curr.filter((v) => v !== weekday)
    );
  };

  const handleSaveRecurrence = async () => {
    if (!user || !patient) return;
    const normalizedWeekdays = recurrenceEnabled ? normalizePatientRecurringWeekdays(recurrenceWeekdays) : [];
    const normalizedTime = normalizePatientRecurringTime(recurrenceTime);
    if (recurrenceEnabled && normalizedWeekdays.length === 0) {
      toast({ title: "Escolha pelo menos um dia", description: "Para paciente recorrente, marque os dias da semana programados.", variant: "destructive" });
      return;
    }
    try {
      setSavingRecurrence(true);
      const { data: updatedPatient, error: patientError } = await supabase
        .from("patients")
        .update({ is_recurring: recurrenceEnabled, recurring_time: normalizedTime, recurring_weekdays: normalizedWeekdays })
        .eq("id", patient.id)
        .select("*")
        .single();
      if (patientError) throw patientError;

      const now = new Date();
      const { error: deleteError } = await supabase
        .from("agenda_events")
        .delete()
        .eq("patient_id", patient.id)
        .eq("generated_by_recurring_patient", true)
        .gte("scheduled_for", now.toISOString());
      if (deleteError) throw deleteError;

      if (recurrenceEnabled) {
        const nextDateTime = getNextPatientRecurrenceDateTime({ now, time: normalizedTime, weekdays: normalizedWeekdays });
        if (nextDateTime) {
          const conflict = findConflictingAgendaEvent(
            nextDateTime,
            agendaEvents.filter((ev) => ev.patient_id === patient.id && !ev.generated_by_recurring_patient && getAgendaEventStatus(ev) !== "cancelado")
          );
          if (!conflict) {
            const { data: insertedEv, error: insertError } = await supabase
              .from("agenda_events")
              .insert({ clinic_id: effectiveClinicId, event_type: "atendimento", generated_by_recurring_patient: true, patient_id: patient.id, scheduled_for: nextDateTime.toISOString(), status: "lembrete", title: patient.name, user_id: user.id })
              .select("*")
              .single();
            if (insertError) throw insertError;
            if (insertedEv) await optimisticUpsertAgendaEvent(insertedEv as AgendaEvent);
          }
        }
      }
      optimisticUpdatePatient(updatedPatient as Patient);
      if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["patient", "agenda"]);
      notifyAgendaEventsUpdated();
      setRecurrenceDialogOpen(false);
      toast({ title: "Recorrência atualizada" });
    } catch (error) {
      toast({ title: "Erro ao salvar recorrência", description: formatSupabaseErrorMessage(error, "Não foi possível salvar a recorrência."), variant: "destructive" });
    } finally {
      setSavingRecurrence(false);
    }
  };

  const handleApplyAgendaStatus = async (overrideAction?: AgendaStatusAction) => {
    if (!selectedAgendaEvent || !user || !patient) return;
    const effectiveAction = overrideAction ?? selectedAgendaStatusAction;
    try {
      setSavingAgendaDetails(true);
      if (effectiveAction === "delete") {
        await optimisticDeleteAgendaEvent(selectedAgendaEvent.id);
        const { error } = await supabase.from("agenda_events").delete().eq("id", selectedAgendaEvent.id);
        if (error) { if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["agenda"]); throw error; }
        setSelectedAgendaEvent(null);
        notifyAgendaEventsUpdated();
        toast({ title: "Agendamento excluído" });
        return;
      }

      const previousStatus = getAgendaEventStatus(selectedAgendaEvent);
      await optimisticUpsertAgendaEvent({ ...selectedAgendaEvent, status: effectiveAction });
      const { data, error } = await supabase.from("agenda_events").update({ status: effectiveAction }).eq("id", selectedAgendaEvent.id).select("*").single();
      if (error) { if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["agenda"]); throw error; }
      setSelectedAgendaEvent(data as AgendaEvent);

      if (effectiveAction === "cancelado" && previousStatus !== "cancelado") {
        const canceledGroup = groups.find((g) => getPatientGroupKind(g) === "cancelados") ?? null;
        const { data: canceledSession, error: sessionError } = await supabase
          .from("sessions")
          .insert({ clinic_id: clinicId, group_id: canceledGroup?.id ?? null, notes: "Atendimento cancelado a partir do agendamento.", patient_id: patient.id, provider_id: user.id, session_date: selectedAgendaEvent.scheduled_for, status: "cancelado", user_id: user.id })
          .select("*")
          .single();
        if (sessionError) throw sessionError;
        if (canceledSession && realPatientId) void invalidatePatientData(realPatientId, clinicId, ["sessions"]);
      }
      notifyAgendaEventsUpdated();
      toast({ title: "Status do agendamento atualizado" });
    } catch (error) {
      toast({ title: "Erro ao atualizar agendamento", description: formatSupabaseErrorMessage(error, "Não foi possível atualizar o agendamento."), variant: "destructive" });
    } finally {
      setSavingAgendaDetails(false);
    }
  };

  const handleUpdateAgendaDateTime = async () => {
    if (!selectedAgendaEvent) return;
    try {
      setSavingAgendaDetails(true);
      const nextDate = getAgendaEventDateTime(selectedAgendaDate, selectedAgendaTime || "00:00");
      assertAgendaEventDateTimeIsFuture(nextDate, undefined, 15);
      const { data, error } = await supabase.from("agenda_events").update({ scheduled_for: nextDate.toISOString() }).eq("id", selectedAgendaEvent.id).select("*").single();
      if (error) throw error;
      const updated = data as AgendaEvent;
      await optimisticUpsertAgendaEvent(updated);
      setSelectedAgendaEvent(updated);
      notifyAgendaEventsUpdated();
      toast({ title: "Data e horário atualizados" });
    } catch (error) {
      toast({ title: "Erro ao trocar data/horário", description: formatSupabaseErrorMessage(error, "Não foi possível trocar data/horário."), variant: "destructive" });
    } finally {
      setSavingAgendaDetails(false);
    }
  };

  const agendaDialogDateTime = agendaDate && agendaTime ? getAgendaEventDateTime(agendaDate, agendaTime) : null;
  const isAgendaDialogDateTimePast = agendaDialogDateTime ? isAgendaEventDateTimeInPast(agendaDialogDateTime, undefined, 15) : false;
  const selectedAgendaDateTime = selectedAgendaDate && selectedAgendaTime ? getAgendaEventDateTime(selectedAgendaDate, selectedAgendaTime || "00:00") : null;
  const isSelectedAgendaDateTimePast = selectedAgendaDateTime ? isAgendaEventDateTimeInPast(selectedAgendaDateTime, undefined, 15) : false;

  return {
    agendaDialogOpen, setAgendaDialogOpen, agendaDate, setAgendaDate, agendaTime, setAgendaTime,
    isAgendaDialogDateTimePast, savingAgendaEvent, handleOpenPatientAgendaDialog, handleSchedulePatientAgendaEvent,
    selectedAgendaEvent, setSelectedAgendaEvent, selectedAgendaStatusAction, setSelectedAgendaStatusAction,
    selectedAgendaDate, setSelectedAgendaDate, selectedAgendaTime, setSelectedAgendaTime,
    isSelectedAgendaDateTimePast, savingAgendaDetails, handleOpenAgendaDetails, handleApplyAgendaStatus, handleUpdateAgendaDateTime,
    recurrenceDialogOpen, setRecurrenceDialogOpen, recurrenceEnabled, setRecurrenceEnabled,
    recurrenceWeekdays, setRecurrenceWeekdays, recurrenceTime, setRecurrenceTime,
    savingRecurrence, toggleRecurrenceWeekday, handleSaveRecurrence,
  };
}
