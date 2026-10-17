/**
 * useAgendaReminderPoller Hook
 * Therapy-Flow (Pluri-Health)
 *
 * Poller reativo e escuta global de lembretes da agenda:
 * - Checa eventos que atingiram o horário programado de lembrete (com tolerância de minuto atual).
 * - Dispara notificação nativa via PWA/Service Worker com actions e sincroniza alarme sonoro.
 * - Abre o AgendaAlarmDialog na aba ativa e sincroniza com demais abas via BroadcastChannel.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { format, parseISO } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AGENDA_EVENTS_UPDATED_EVENT } from "@/lib/agenda-events";
import {
  type NotificationSoundKey,
  stopAlarmLoop,
} from "@/lib/notification-sounds";
import {
  dismissAlarmNotification,
  showAgendaReminderNotification,
  subscribeToAlarmChannel,
} from "@/lib/pwa-notifications";
import type { AgendaAlarmEvent } from "@/components/agenda/AgendaAlarmDialog";

export interface ReminderConfigItem {
  minutesBefore: number;
  soundKey?: NotificationSoundKey;
}

export interface AgendaReminderPollerOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
  clinicId?: string | null;
  events?: AgendaAlarmEvent[];
  soundKey?: NotificationSoundKey;
  toleranceMinutes?: number;
  onReminderTriggered?: (event: AgendaAlarmEvent) => void;
}

export interface UseAgendaReminderPollerReturn {
  activeAlarmEvent: AgendaAlarmEvent | null;
  isAlarmOpen: boolean;
  openAlarm: (event: AgendaAlarmEvent) => void;
  closeAlarm: () => void;
  dismissAlarm: () => void;
  checkDueReminders: (targetEvents?: AgendaAlarmEvent[]) => AgendaAlarmEvent[];
  firedReminderKeys: Set<string>;
}

/**
 * Avalia se um compromisso com antecedência de minutos atingiu o horário devido,
 * respeitando a janela de tolerância de minuto atual.
 */
export function isReminderDue(
  scheduledFor: Date | string,
  minutesBefore: number = 0,
  currentTime: Date = new Date(),
  toleranceMinutes: number = 1,
): boolean {
  const eventTime =
    scheduledFor instanceof Date
      ? scheduledFor.getTime()
      : parseISO(String(scheduledFor)).getTime();

  if (Number.isNaN(eventTime)) {
    return false;
  }

  const targetTime = eventTime - minutesBefore * 60 * 1000;
  const now = currentTime.getTime();
  const toleranceMs = Math.max(1, toleranceMinutes) * 60 * 1000;

  // Está dentro da janela de tolerância do minuto atual
  return Math.abs(now - targetTime) <= toleranceMs;
}

/**
 * Normaliza os valores de reminder_configs em array padronizado.
 */
export function parseReminderConfigs(raw: unknown): ReminderConfigItem[] {
  if (!raw) return [{ minutesBefore: 0 }];

  if (Array.isArray(raw)) {
    if (raw.length === 0) return [{ minutesBefore: 0 }];
    const items: ReminderConfigItem[] = [];

    for (const item of raw) {
      if (typeof item === "number" && Number.isFinite(item)) {
        items.push({ minutesBefore: Math.max(0, item) });
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const minutes =
          typeof obj.minutesBefore === "number"
            ? obj.minutesBefore
            : typeof obj.minutes === "number"
            ? obj.minutes
            : 0;
        const soundKey =
          typeof obj.soundKey === "string"
            ? (obj.soundKey as NotificationSoundKey)
            : undefined;
        items.push({ minutesBefore: Math.max(0, minutes), soundKey });
      }
    }

    return items.length > 0 ? items : [{ minutesBefore: 0 }];
  }

  return [{ minutesBefore: 0 }];
}

/**
 * Cria a chave única para deduplicação de alarmes disparados.
 */
export function buildReminderDedupKey(
  eventId: string,
  minutesBefore: number,
  scheduledFor: string | Date,
): string {
  const timeStr =
    scheduledFor instanceof Date
      ? scheduledFor.toISOString()
      : String(scheduledFor);
  return `${eventId}_${minutesBefore}_${timeStr.slice(0, 16)}`;
}

export function useAgendaReminderPoller(
  options: AgendaReminderPollerOptions = {},
): UseAgendaReminderPollerReturn {
  const {
    enabled = true,
    pollIntervalMs = 20000,
    clinicId: optionsClinicId,
    events: overrideEvents,
    soundKey = "urgent_alarm",
    toleranceMinutes = 1,
    onReminderTriggered,
  } = options;

  const { clinic, user } = useAuth();
  const effectiveClinicId = optionsClinicId ?? clinic?.id ?? null;

  const [activeAlarmEvent, setActiveAlarmEvent] = useState<AgendaAlarmEvent | null>(null);
  const [isAlarmOpen, setIsAlarmOpen] = useState(false);

  const firedKeysRef = useRef<Set<string>>(new Set());
  const isAlarmOpenRef = useRef(isAlarmOpen);
  isAlarmOpenRef.current = isAlarmOpen;

  const closeAlarm = useCallback(() => {
    stopAlarmLoop();
    setIsAlarmOpen(false);
  }, []);

  const dismissAlarm = useCallback(() => {
    dismissAlarmNotification();
    closeAlarm();
  }, [closeAlarm]);

  const openAlarm = useCallback((event: AgendaAlarmEvent) => {
    setActiveAlarmEvent(event);
    setIsAlarmOpen(true);
  }, []);

  // Escuta ordens de encerramento de alarme vindas do Service Worker ou outras abas
  useEffect(() => {
    const unsubscribe = subscribeToAlarmChannel(() => {
      closeAlarm();
    });
    return unsubscribe;
  }, [closeAlarm]);

  // Função central de checagem de lembretes pendentes
  const checkDueReminders = useCallback(
    (targetEvents?: AgendaAlarmEvent[]): AgendaAlarmEvent[] => {
      if (!enabled) return [];

      const listToCheck = targetEvents ?? overrideEvents;
      if (!listToCheck || listToCheck.length === 0) return [];

      const now = new Date();
      const triggeredEvents: AgendaAlarmEvent[] = [];

      for (const event of listToCheck) {
        // Ignora compromissos já cancelados ou finalizados
        if (event.status === "cancelado" || event.status === "concluido") {
          continue;
        }

        const rawConfigs =
          "reminder_configs" in (event as Record<string, unknown>)
            ? (event as Record<string, unknown>).reminder_configs
            : "reminderConfigs" in (event as Record<string, unknown>)
            ? (event as Record<string, unknown>).reminderConfigs
            : undefined;

        const reminderConfigs = parseReminderConfigs(rawConfigs);

        for (const config of reminderConfigs) {
          const isDue = isReminderDue(
            event.scheduledFor,
            config.minutesBefore,
            now,
            toleranceMinutes,
          );

          if (isDue) {
            const dedupKey = buildReminderDedupKey(
              event.id,
              config.minutesBefore,
              event.scheduledFor,
            );

            if (!firedKeysRef.current.has(dedupKey)) {
              firedKeysRef.current.add(dedupKey);
              triggeredEvents.push(event);

              // Dispara notificação nativa do PWA
              let timeLabel = event.time;
              if (!timeLabel) {
                try {
                  const d =
                    event.scheduledFor instanceof Date
                      ? event.scheduledFor
                      : parseISO(String(event.scheduledFor));
                  timeLabel = format(d, "HH:mm");
                } catch {
                  timeLabel = "";
                }
              }

              const displayBody = timeLabel
                ? `${event.title} • ${timeLabel}`
                : event.title;

              void showAgendaReminderNotification({
                eventId: event.id,
                title: "Lembrete de Agendamento",
                body: displayBody,
                scheduledFor: event.scheduledFor,
                eventType: event.eventType,
                patientId: event.patientId,
                patientName: event.patientName,
                clinicName: event.clinicName ?? clinic?.brand_name ?? clinic?.name,
                clinicRouteKey: clinic?.route_key,
              });

              // Abre o modal de alarme se nenhum outro estiver ativo na tela
              if (!isAlarmOpenRef.current) {
                setActiveAlarmEvent(event);
                setIsAlarmOpen(true);
              }

              onReminderTriggered?.(event);
            }
          }
        }
      }

      return triggeredEvents;
    },
    [clinic, enabled, onReminderTriggered, overrideEvents, toleranceMinutes],
  );

  // Busca remota periódica quando eventos locais não são passados
  const fetchAndCheckRemotes = useCallback(async () => {
    if (!enabled || overrideEvents) return;
    if (!user?.id) return;

    try {
      const now = new Date();
      // Janela de busca: de 30 minutos atrás a até 24 horas no futuro
      const windowStart = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
      const windowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();

      let query = supabase
        .from("agenda_events")
        .select(
          "id, title, scheduled_for, event_type, status, patient_id, clinic_id, duration_minutes, reminder_configs",
        )
        .neq("status", "cancelado")
        .neq("status", "concluido")
        .gte("scheduled_for", windowStart)
        .lte("scheduled_for", windowEnd)
        .order("scheduled_for", { ascending: true });

      if (effectiveClinicId) {
        query = query.eq("clinic_id", effectiveClinicId);
      }

      const { data, error } = await query;
      if (error || !data) return;

      const remoteAlarmEvents: AgendaAlarmEvent[] = data.map((ev) => ({
        id: ev.id,
        title: ev.title,
        scheduledFor: ev.scheduled_for,
        eventType: ev.event_type,
        patientId: ev.patient_id,
        clinicId: ev.clinic_id,
        status: ev.status,
        durationMinutes: ev.duration_minutes ?? 60,
        reminderConfigs: ev.reminder_configs,
      }));

      checkDueReminders(remoteAlarmEvents);
    } catch {
      // Ignorar erros transitórios de rede na checagem de fundo
    }
  }, [checkDueReminders, effectiveClinicId, enabled, overrideEvents, user?.id]);

  // Poller de intervalo
  useEffect(() => {
    if (!enabled) return;

    if (overrideEvents) {
      checkDueReminders(overrideEvents);
    } else {
      void fetchAndCheckRemotes();
    }

    const intervalTimer = setInterval(() => {
      if (overrideEvents) {
        checkDueReminders(overrideEvents);
      } else {
        void fetchAndCheckRemotes();
      }
    }, pollIntervalMs);

    return () => clearInterval(intervalTimer);
  }, [checkDueReminders, enabled, fetchAndCheckRemotes, overrideEvents, pollIntervalMs]);

  // Escuta de atualizações da agenda na janela local
  useEffect(() => {
    const handleEventsUpdated = () => {
      if (overrideEvents) {
        checkDueReminders(overrideEvents);
      } else {
        void fetchAndCheckRemotes();
      }
    };

    window.addEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleEventsUpdated);
    return () => {
      window.removeEventListener(AGENDA_EVENTS_UPDATED_EVENT, handleEventsUpdated);
    };
  }, [checkDueReminders, fetchAndCheckRemotes, overrideEvents]);

  return {
    activeAlarmEvent,
    isAlarmOpen,
    openAlarm,
    closeAlarm,
    dismissAlarm,
    checkDueReminders,
    firedReminderKeys: firedKeysRef.current,
  };
}
