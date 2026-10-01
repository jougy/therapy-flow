import type { TablesInsert } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { INPUT_LIMITS, sanitizeSingleLineInput } from "@/lib/input-security";

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

export interface AgendaEventItem {
  id: string;
  eventType: AgendaEventType;
  patientId: string | null;
  scheduledFor: string;
  status: AgendaEventStatus;
  title: string;
  date: Date;
  time: string;
  durationMinutes?: number;
}

export interface BuildAgendaEventPayloadInput {
  clinicId: string | null;
  eventType: AgendaEventType;
  selectedDate: Date;
  selectedPatient: AgendaPatientOption | null;
  time: string;
  title: string;
  userId: string;
  durationMinutes?: number;
  graceMinutes?: number;
}

export const isValidDurationMinutes = (durationMinutes?: number | null): boolean => {
  return (
    typeof durationMinutes === "number" &&
    Number.isFinite(durationMinutes) &&
    durationMinutes > 0 &&
    durationMinutes <= 1440
  );
};

export const normalizeEventDurationMinutes = (durationMinutes?: number | null): number => {
  if (isValidDurationMinutes(durationMinutes)) {
    return Math.round(durationMinutes as number);
  }
  return 60;
};

export const isValidTimeString = (time: string): boolean => {
  if (!time || typeof time !== "string") {
    return false;
  }
  const match = time.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) {
    return false;
  }
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
};

export const formatSupabaseErrorMessage = (err: unknown, fallbackMessage = "Tente novamente."): string => {
  if (!err) return fallbackMessage;
  if (typeof err === "string") return err;
  if (typeof err === "object") {
    const errorObj = err as Record<string, unknown>;
    if (typeof errorObj.message === "string" && errorObj.message.trim()) {
      // Caso seja erro de RLS do Supabase, fornecer mensagem clara e contextualizada
      if (errorObj.message.includes("row-level security") || errorObj.code === "42501") {
        return "Permissão insuficiente ou clínica não identificada para criar este agendamento.";
      }
      return errorObj.message;
    }
    if (typeof errorObj.details === "string" && errorObj.details.trim()) {
      return errorObj.details;
    }
    if (typeof errorObj.hint === "string" && errorObj.hint.trim()) {
      return errorObj.hint;
    }
  }
  return fallbackMessage;
};

export const getAgendaEventDateTime = (selectedDate: Date | string, time: string): Date => {
  if (!isValidTimeString(time)) {
    throw new Error("Informe um horário válido no formato HH:mm (entre 00:00 e 23:59).");
  }

  const [hours, minutes] = time.trim().split(":").map(Number);

  // Extrair ano, mês e dia locais ou de string YYYY-MM-DD para evitar recuo de fuso horário UTC (-3h)
  let year: number;
  let month: number;
  let day: number;

  if (typeof selectedDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(selectedDate)) {
    const [y, m, d] = selectedDate.slice(0, 10).split("-").map(Number);
    year = y;
    month = m - 1;
    day = d;
  } else {
    const d = selectedDate instanceof Date ? selectedDate : new Date(selectedDate);
    if (Number.isNaN(d.getTime())) {
      throw new Error("Informe uma data válida para o agendamento.");
    }
    year = d.getFullYear();
    month = d.getMonth();
    day = d.getDate();
  }

  const scheduledFor = new Date(year, month, day, hours, minutes, 0, 0);

  if (Number.isNaN(scheduledFor.getTime())) {
    throw new Error("Informe uma data válida para o agendamento.");
  }

  return scheduledFor;
};

export const isAgendaEventDateTimeInPast = (scheduledFor: Date, now = new Date(), graceMinutes = 0) => {
  const graceMs = Math.max(0, graceMinutes) * 60 * 1000;
  return scheduledFor.getTime() < now.getTime() - graceMs;
};

export const assertAgendaEventDateTimeIsFuture = (scheduledFor: Date, now = new Date(), graceMinutes = 0) => {
  if (Number.isNaN(scheduledFor.getTime())) {
    throw new Error("Informe uma data e um horário válidos para o agendamento.");
  }

  if (isAgendaEventDateTimeInPast(scheduledFor, now, graceMinutes)) {
    throw new Error(AGENDA_PAST_EVENT_ERROR_MESSAGE);
  }
};

const VALID_EVENT_TYPES: AgendaEventType[] = ["atendimento", "reuniao", "evento"];

export const buildAgendaEventPayload = ({
  clinicId,
  durationMinutes,
  eventType,
  graceMinutes,
  selectedDate,
  selectedPatient,
  time,
  title,
  userId,
}: BuildAgendaEventPayloadInput): TablesInsert<"agenda_events"> => {
  if (!VALID_EVENT_TYPES.includes(eventType)) {
    throw new Error("Tipo de agendamento inválido.");
  }

  const scheduledFor = getAgendaEventDateTime(selectedDate, time);
  assertAgendaEventDateTimeIsFuture(scheduledFor, undefined, graceMinutes ?? 0);

  if (eventType === "atendimento") {
    if (!selectedPatient || !selectedPatient.id || !selectedPatient.id.trim()) {
      throw new Error("Selecione um paciente para agendar um atendimento.");
    }
  }

  const rawTitle = eventType === "atendimento" ? selectedPatient?.name ?? "" : title;
  const normalizedTitle = sanitizeSingleLineInput(rawTitle, INPUT_LIMITS.agendaTitle).trim();

  if (!normalizedTitle) {
    throw new Error("Informe um titulo para o evento.");
  }

  const cleanUserId = sanitizeSingleLineInput(userId, 64).trim();
  if (!cleanUserId) {
    throw new Error("Usuário não autenticado para criar agendamento.");
  }

  const cleanClinicId = clinicId ? sanitizeSingleLineInput(clinicId, 64).trim() || null : null;
  const cleanPatientId = selectedPatient?.id ? sanitizeSingleLineInput(selectedPatient.id, 64).trim() || null : null;

  return {
    clinic_id: cleanClinicId,
    duration_minutes: normalizeEventDurationMinutes(durationMinutes),
    event_type: eventType,
    patient_id: cleanPatientId,
    scheduled_for: scheduledFor.toISOString(),
    status: "aguardando_confirmacao",
    title: normalizedTitle,
    user_id: cleanUserId,
  };
};

export const resolvePatientSelection = (query: string, patients: AgendaPatientOption[]) => {
  const normalizedQuery = sanitizeSingleLineInput(query, INPUT_LIMITS.name).trim().toLowerCase();

  if (!normalizedQuery) {
    return null;
  }

  return (
    patients.find(
      (patient) => sanitizeSingleLineInput(patient.name, INPUT_LIMITS.name).trim().toLowerCase() === normalizedQuery
    ) ?? null
  );
};

export interface FetchPatientAverageSessionDurationOptions {
  fallbackMinutes?: number;
  limit?: number;
  supabaseClient?: typeof supabase;
}

export const parseDurationMinutesFromSession = (session: {
  treatment?: unknown;
  scheduled_start_at?: string | null;
  patient_arrived_at?: string | null;
  session_date?: string | null;
  updated_at?: string | null;
}): number | null => {
  if (session.treatment && typeof session.treatment === "object" && !Array.isArray(session.treatment)) {
    const tr = session.treatment as Record<string, unknown>;
    if (typeof tr.duration_minutes === "number" && tr.duration_minutes > 0 && tr.duration_minutes <= 1440) {
      return Math.round(tr.duration_minutes);
    }
    if (typeof tr.durationMinutes === "number" && tr.durationMinutes > 0 && tr.durationMinutes <= 1440) {
      return Math.round(tr.durationMinutes);
    }

    if (Array.isArray(tr.blocks)) {
      for (const block of tr.blocks) {
        if (block && typeof block === "object" && "duration" in block && typeof block.duration === "string") {
          const match = block.duration.match(/\b(\d+)\s*(?:min|m|minutos)?\b/i);
          if (match) {
            const parsed = parseInt(match[1], 10);
            if (!Number.isNaN(parsed) && parsed >= 15 && parsed <= 240) {
              return parsed;
            }
          }
        }
      }
    }
  }

  const startIso = session.patient_arrived_at || session.scheduled_start_at || session.session_date;
  if (startIso && session.updated_at) {
    const startTime = new Date(startIso).getTime();
    const endTime = new Date(session.updated_at).getTime();
    if (!Number.isNaN(startTime) && !Number.isNaN(endTime) && endTime > startTime) {
      const diffMinutes = Math.round((endTime - startTime) / 60_000);
      if (diffMinutes >= 15 && diffMinutes <= 240) {
        return diffMinutes;
      }
    }
  }

  return null;
};

export const fetchPatientAverageSessionDurationMinutes = async (
  patientId: string,
  options?: FetchPatientAverageSessionDurationOptions
): Promise<number> => {
  const fallback = options?.fallbackMinutes ?? 50;
  if (!patientId || typeof patientId !== "string" || !patientId.trim()) {
    return fallback;
  }

  try {
    const client = options?.supabaseClient ?? supabase;
    const limit = options?.limit ?? 10;

    const { data: sessions, error } = await client
      .from("sessions")
      .select("id, status, scheduled_start_at, patient_arrived_at, session_date, updated_at, treatment")
      .eq("patient_id", patientId.trim())
      .is("deleted_at", null)
      .in("status", ["concluído", "concluido"])
      .order("session_date", { ascending: false })
      .limit(limit);

    if (error || !sessions || sessions.length === 0) {
      return fallback;
    }

    const durations: number[] = [];
    for (const session of sessions) {
      const dur = parseDurationMinutesFromSession(session);
      if (dur !== null) {
        durations.push(dur);
      }
    }

    if (durations.length === 0) {
      return fallback;
    }

    const sum = durations.reduce((acc, d) => acc + d, 0);
    const avg = Math.round(sum / durations.length);
    return Math.max(15, Math.min(240, avg));
  } catch {
    return fallback;
  }
};
