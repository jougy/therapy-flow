import { parseISO, format } from "date-fns";
import { normalizeAgendaStatus, type AgendaEventItem, type AgendaEventType, type AgendaPatientOption } from "./agenda-events";

export const AGENDA_EVENTS_CACHE_KEY = (clinicId: string) => `clinic_agenda_events_${clinicId}`;
export const PATIENTS_CACHE_KEY = (clinicId: string) => `clinic_patients_${clinicId}`;

export interface AgendaEventQueryResult {
  id: string;
  event_type: string;
  patient_id: string | null;
  scheduled_for: string;
  status: string | null;
  title: string;
  duration_minutes?: number | null;
}

export interface AgendaMemoryCacheEntry {
  events: AgendaEventItem[];
  patients: AgendaPatientOption[];
  timestamp: number;
}

export const inMemoryAgendaCache = new Map<string, AgendaMemoryCacheEntry>();

export function mapRawEventToItem(ev: AgendaEventQueryResult): AgendaEventItem {
  return {
    id: ev.id,
    eventType: (ev.event_type as AgendaEventType) || "atendimento",
    patientId: ev.patient_id,
    scheduledFor: ev.scheduled_for,
    status: normalizeAgendaStatus(ev.status),
    title: ev.title,
    date: parseISO(ev.scheduled_for),
    time: format(parseISO(ev.scheduled_for), "HH:mm"),
    durationMinutes: ev.duration_minutes ?? 60,
  };
}
