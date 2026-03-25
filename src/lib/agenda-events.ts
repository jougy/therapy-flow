import type { TablesInsert } from "@/integrations/supabase/types";

export type AgendaEventType = "atendimento" | "reuniao" | "evento";

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

export const buildAgendaEventPayload = ({
  clinicId,
  eventType,
  selectedDate,
  selectedPatient,
  time,
  title,
  userId,
}: BuildAgendaEventPayloadInput): TablesInsert<"agenda_events"> => {
  const [hours, minutes] = time.split(":").map(Number);
  const scheduledFor = new Date(selectedDate);
  scheduledFor.setHours(hours, minutes, 0, 0);

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
