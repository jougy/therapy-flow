import type { TablesInsert } from "@/integrations/supabase/types";

export type AgendaEventType = "atendimento" | "reuniao" | "evento";
export type AgendaEventStatus = "lembrete" | "aguardando_confirmacao" | "confirmado" | "cancelado";

export const AGENDA_EVENTS_UPDATED_EVENT = "pluri-health:agenda-events-updated";
export const AGENDA_PAST_EVENT_ERROR_MESSAGE =
  "Para registrar um atendimento que já aconteceu, use Atender agora ou crie o atendimento e preencha os horários no bloco Presença.";

export const notifyAgendaEventsUpdated = () => {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event(AGENDA_EVENTS_UPDATED_EVENT));
};

export interface AgendaPatientOption {
  id: string;
  name: string;
}

interface BuildAgendaEventPayloadInput {
  clinicId: string | null;
  eventType: AgendaEventType;
  selectedDate: Date;
  selectedPatient: AgendaPatientOption | null;
  time: string;
  title: string;
  userId: string;
}

export const getAgendaEventDateTime = (selectedDate: Date, time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  const scheduledFor = new Date(selectedDate);
  scheduledFor.setHours(hours, minutes, 0, 0);

  return scheduledFor;
};

export const isAgendaEventDateTimeInPast = (scheduledFor: Date, now = new Date()) => scheduledFor.getTime() < now.getTime();

export const assertAgendaEventDateTimeIsFuture = (scheduledFor: Date, now = new Date()) => {
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new Error("Informe uma data e um horário válidos para o agendamento.");
  }

  if (isAgendaEventDateTimeInPast(scheduledFor, now)) {
    throw new Error(AGENDA_PAST_EVENT_ERROR_MESSAGE);
  }
};

export const buildAgendaEventPayload = ({
  clinicId,
  eventType,
  selectedDate,
  selectedPatient,
  time,
  title,
  userId,
}: BuildAgendaEventPayloadInput): TablesInsert<"agenda_events"> => {
  const scheduledFor = getAgendaEventDateTime(selectedDate, time);
  assertAgendaEventDateTimeIsFuture(scheduledFor);

  if (eventType === "atendimento" && !selectedPatient) {
    throw new Error("Selecione um paciente para agendar um atendimento.");
  }

  const normalizedTitle = eventType === "atendimento" ? selectedPatient!.name : title.trim();

  if (!normalizedTitle) {
    throw new Error("Informe um titulo para o evento.");
  }

  return {
    clinic_id: clinicId,
    event_type: eventType,
    patient_id: selectedPatient?.id ?? null,
    scheduled_for: scheduledFor.toISOString(),
    status: "aguardando_confirmacao",
    title: normalizedTitle,
    user_id: userId,
  };
};

export const resolvePatientSelection = (query: string, patients: AgendaPatientOption[]) => {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return null;
  }

  return patients.find((patient) => patient.name.trim().toLowerCase() === normalizedQuery) ?? null;
};
