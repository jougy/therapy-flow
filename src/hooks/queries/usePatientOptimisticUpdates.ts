import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { getLocalCacheItem, setLocalCacheItem } from "@/lib/indexed-db-persister";
import type { HomePatientRecord, HomeSessionRecord } from "@/lib/home-patients-view";
import { useAuth } from "@/hooks/useAuth";
import { CLINIC_QUERY_KEYS } from "./useClinicDataQueries";
import {
  PATIENT_AGENDA_CACHE_KEY,
  PATIENT_DETAIL_CACHE_KEY,
  PATIENT_GROUPS_CACHE_KEY,
  PATIENT_QUERY_KEYS,
  PATIENT_SESSIONS_CACHE_KEY,
  type AgendaEventRow,
  type PatientGroupRow,
  type PatientRow,
  type SessionRow,
} from "./patientQueryKeys";

/**
 * Mutações otimistas imediatas para o Prontuário do Paciente (PacienteDetalhe).
 * Atualiza o TanStack Query cache em tempo real e sincroniza com o IndexedDB local.
 */
export function useOptimisticPatientDetailUpdates(patientId?: string | null, clinicId?: string | null, patientRef?: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  const optimisticUpdatePatientStatus = useCallback(
    (nextStatus: PatientRow["status"]) => {
      if (!patientId) return;

      const detailKeys = [
        PATIENT_QUERY_KEYS.patient(patientId, clinicId),
        ...(patientRef && patientRef !== patientId ? [PATIENT_QUERY_KEYS.patient(patientRef, clinicId)] : []),
      ];

      detailKeys.forEach((key) => {
        queryClient.setQueryData<PatientRow | null>(key, (current) =>
          current ? { ...current, status: nextStatus, updated_at: new Date().toISOString() } : current
        );
      });

      if (clinicId) {
        const clinicPatientsKey = CLINIC_QUERY_KEYS.patients(clinicId);
        queryClient.setQueryData<HomePatientRecord[]>(clinicPatientsKey, (current = []) =>
          current.map((p) => (p.id === patientId ? { ...p, status: nextStatus, updated_at: new Date().toISOString() } : p))
        );
      }

      void getLocalCacheItem<PatientRow>(PATIENT_DETAIL_CACHE_KEY(clinicId, patientId)).then((cached) => {
        if (cached) {
          void setLocalCacheItem(PATIENT_DETAIL_CACHE_KEY(clinicId, patientId), {
            ...cached,
            status: nextStatus,
            updated_at: new Date().toISOString(),
          });
        }
      });
    },
    [clinicId, patientId, patientRef, queryClient]
  );

  const optimisticUpdatePatient = useCallback(
    (patch: Partial<PatientRow>) => {
      if (!patientId) return;

      const detailKeys = [
        PATIENT_QUERY_KEYS.patient(patientId, clinicId),
        ...(patientRef && patientRef !== patientId ? [PATIENT_QUERY_KEYS.patient(patientRef, clinicId)] : []),
      ];

      detailKeys.forEach((key) => {
        queryClient.setQueryData<PatientRow | null>(key, (current) =>
          current ? { ...current, ...patch, updated_at: new Date().toISOString() } : current
        );
      });

      void getLocalCacheItem<PatientRow>(PATIENT_DETAIL_CACHE_KEY(clinicId, patientId)).then((cached) => {
        if (cached) {
          void setLocalCacheItem(PATIENT_DETAIL_CACHE_KEY(clinicId, patientId), {
            ...cached,
            ...patch,
            updated_at: new Date().toISOString(),
          });
        }
      });
    },
    [clinicId, patientId, patientRef, queryClient]
  );

  const optimisticUpdateSessionStatus = useCallback(
    (sessionIds: string[], nextStatus: string) => {
      if (!patientId || sessionIds.length === 0) return;

      const key = PATIENT_QUERY_KEYS.sessions(patientId, currentUserId);
      queryClient.setQueryData<SessionRow[]>(key, (current = []) => {
        const next = current.map((session) =>
          sessionIds.includes(session.id)
            ? { ...session, status: nextStatus, updated_at: new Date().toISOString() }
            : session
        );
        void setLocalCacheItem(PATIENT_SESSIONS_CACHE_KEY(patientId, currentUserId), next);
        return next;
      });

      if (clinicId) {
        const clinicSessionsKey = CLINIC_QUERY_KEYS.sessionsSummary(clinicId);
        queryClient.setQueryData<HomeSessionRecord[]>(clinicSessionsKey, (current = []) =>
          current.map((session) =>
            sessionIds.includes(session.id) ? { ...session, status: nextStatus } : session
          )
        );
      }
    },
    [clinicId, currentUserId, patientId, queryClient]
  );

  const optimisticMoveSessions = useCallback(
    (sessionIds: string[], nextGroupId: string | null) => {
      if (!patientId || sessionIds.length === 0) return;

      const key = PATIENT_QUERY_KEYS.sessions(patientId, currentUserId);
      queryClient.setQueryData<SessionRow[]>(key, (current = []) => {
        const next = current.map((session) =>
          sessionIds.includes(session.id)
            ? { ...session, group_id: nextGroupId, updated_at: new Date().toISOString() }
            : session
        );
        void setLocalCacheItem(PATIENT_SESSIONS_CACHE_KEY(patientId, currentUserId), next);
        return next;
      });

      if (clinicId) {
        const clinicSessionsKey = CLINIC_QUERY_KEYS.sessionsSummary(clinicId);
        queryClient.setQueryData<HomeSessionRecord[]>(clinicSessionsKey, (current = []) =>
          current.map((session) =>
            sessionIds.includes(session.id) ? { ...session, group_id: nextGroupId } : session
          )
        );
      }
    },
    [clinicId, currentUserId, patientId, queryClient]
  );

  const optimisticMoveSessionsToEvolutionGroup = useCallback(
    (sessionIds: string[], nextEvolutionGroupId: string | null) => {
      if (!patientId || sessionIds.length === 0) return;

      const key = PATIENT_QUERY_KEYS.sessions(patientId, currentUserId);
      queryClient.setQueryData<SessionRow[]>(key, (current = []) => {
        const next = current.map((session) =>
          sessionIds.includes(session.id)
            ? { ...session, evolution_group_id: nextEvolutionGroupId, updated_at: new Date().toISOString() }
            : session
        );
        void setLocalCacheItem(PATIENT_SESSIONS_CACHE_KEY(patientId, currentUserId), next);
        return next;
      });
    },
    [currentUserId, patientId, queryClient]
  );

  const optimisticDeleteSessions = useCallback(
    (sessionIds: string[]) => {
      if (!patientId || sessionIds.length === 0) return;

      const key = PATIENT_QUERY_KEYS.sessions(patientId, currentUserId);
      queryClient.setQueryData<SessionRow[]>(key, (current = []) => {
        const next = current.filter((session) => !sessionIds.includes(session.id));
        void setLocalCacheItem(PATIENT_SESSIONS_CACHE_KEY(patientId, currentUserId), next);
        return next;
      });

      if (clinicId) {
        const clinicSessionsKey = CLINIC_QUERY_KEYS.sessionsSummary(clinicId);
        queryClient.setQueryData<HomeSessionRecord[]>(clinicSessionsKey, (current = []) =>
          current.filter((session) => !sessionIds.includes(session.id))
        );
      }
    },
    [clinicId, currentUserId, patientId, queryClient]
  );

  const optimisticUpsertSession = useCallback(
    (session: SessionRow) => {
      const targetPatientId = session.patient_id || patientId;
      if (!targetPatientId) return;

      const key = PATIENT_QUERY_KEYS.sessions(targetPatientId, currentUserId);
      queryClient.setQueryData<SessionRow[]>(key, (current = []) => {
        const exists = current.some((item) => item.id === session.id);
        const next = exists
          ? current.map((item) => (item.id === session.id ? session : item))
          : [session, ...current];
        next.sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());
        void setLocalCacheItem(PATIENT_SESSIONS_CACHE_KEY(targetPatientId, currentUserId), next);
        return next;
      });

      if (clinicId) {
        const clinicSessionsKey = CLINIC_QUERY_KEYS.sessionsSummary(clinicId);
        queryClient.setQueryData<HomeSessionRecord[]>(clinicSessionsKey, (current) => {
          if (!current) return current;
          const exists = current.some((item) => item.id === session.id);
          if (!exists) return current;
          return current.map((item) =>
            item.id === session.id
              ? {
                  ...item,
                  status: session.status,
                  group_id: session.group_id,
                  session_date: session.session_date,
                  payment_status: session.payment_status,
                  amount_charged_cents: session.amount_charged_cents,
                  amount_paid_cents: session.amount_paid_cents,
                }
              : item
          );
        });
      }
    },
    [clinicId, currentUserId, patientId, queryClient]
  );

  const optimisticAddOrUpdateGroup = useCallback(
    (group: PatientGroupRow) => {
      if (!patientId) return;

      const key = PATIENT_QUERY_KEYS.groups(patientId);
      queryClient.setQueryData<PatientGroupRow[]>(key, (current = []) => {
        const exists = current.some((g) => g.id === group.id);
        const next = exists ? current.map((g) => (g.id === group.id ? group : g)) : [...current, group];
        void setLocalCacheItem(PATIENT_GROUPS_CACHE_KEY(patientId), next);
        return next;
      });
    },
    [patientId, queryClient]
  );

  const optimisticDeleteGroup = useCallback(
    (groupId: string) => {
      if (!patientId) return;

      const key = PATIENT_QUERY_KEYS.groups(patientId);
      queryClient.setQueryData<PatientGroupRow[]>(key, (current = []) => {
        const next = current.filter((g) => g.id !== groupId);
        void setLocalCacheItem(PATIENT_GROUPS_CACHE_KEY(patientId), next);
        return next;
      });

      const sessionsKey = PATIENT_QUERY_KEYS.sessions(patientId, currentUserId);
      queryClient.setQueryData<SessionRow[]>(sessionsKey, (current = []) => {
        const next = current.map((s) => (s.group_id === groupId ? { ...s, group_id: null } : s));
        void setLocalCacheItem(PATIENT_SESSIONS_CACHE_KEY(patientId, currentUserId), next);
        return next;
      });
    },
    [currentUserId, patientId, queryClient]
  );

  const optimisticAddAgendaEvent = useCallback(
    (event: AgendaEventRow) => {
      if (!patientId) return;

      const key = PATIENT_QUERY_KEYS.agendaEvents(patientId);
      queryClient.setQueryData<AgendaEventRow[]>(key, (current = []) => {
        const next = [...current, event].sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
        void setLocalCacheItem(PATIENT_AGENDA_CACHE_KEY(patientId), next);
        return next;
      });
    },
    [patientId, queryClient]
  );

  const optimisticUpdateAgendaEvent = useCallback(
    (event: AgendaEventRow) => {
      if (!patientId) return;

      const key = PATIENT_QUERY_KEYS.agendaEvents(patientId);
      queryClient.setQueryData<AgendaEventRow[]>(key, (current = []) => {
        const next = current
          .map((e) => (e.id === event.id ? event : e))
          .sort((a, b) => a.scheduled_for.localeCompare(b.scheduled_for));
        void setLocalCacheItem(PATIENT_AGENDA_CACHE_KEY(patientId), next);
        return next;
      });
    },
    [patientId, queryClient]
  );

  const optimisticDeleteAgendaEvent = useCallback(
    (eventId: string) => {
      if (!patientId) return;

      const key = PATIENT_QUERY_KEYS.agendaEvents(patientId);
      queryClient.setQueryData<AgendaEventRow[]>(key, (current = []) => {
        const next = current.filter((e) => e.id !== eventId);
        void setLocalCacheItem(PATIENT_AGENDA_CACHE_KEY(patientId), next);
        return next;
      });
    },
    [patientId, queryClient]
  );

  return {
    optimisticUpdatePatientStatus,
    optimisticUpdatePatient,
    optimisticUpdateSessionStatus,
    optimisticMoveSessions,
    optimisticDeleteSessions,
    optimisticUpsertSession,
    optimisticAddOrUpdateGroup,
    optimisticDeleteGroup,
    optimisticAddAgendaEvent,
    optimisticUpdateAgendaEvent,
    optimisticDeleteAgendaEvent,
    optimisticMoveSessionsToEvolutionGroup,
  };
}

/**
 * Hook para invalidar queries do paciente no TanStack Query.
 */
export function useInvalidatePatientData() {
  const queryClient = useQueryClient();

  return useCallback(
    async (patientId?: string | null, clinicId?: string | null, targets?: Array<"patient" | "sessions" | "groups" | "agenda" | "all">) => {
      if (!targets || targets.includes("all")) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["patient", patientId] }),
          queryClient.invalidateQueries({ queryKey: ["patient-sessions", patientId] }),
          queryClient.invalidateQueries({ queryKey: ["patient-groups", patientId] }),
          queryClient.invalidateQueries({ queryKey: ["patient-agenda", patientId] }),
        ]);
        return;
      }

      const promises: Promise<void>[] = [];
      if (targets.includes("patient")) {
        promises.push(queryClient.invalidateQueries({ queryKey: ["patient", patientId] }));
      }
      if (targets.includes("sessions")) {
        promises.push(queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.sessions(patientId) }));
      }
      if (targets.includes("groups")) {
        promises.push(queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.groups(patientId) }));
      }
      if (targets.includes("agenda")) {
        promises.push(queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_KEYS.agendaEvents(patientId) }));
      }

      await Promise.all(promises);
    },
    [queryClient]
  );
}
