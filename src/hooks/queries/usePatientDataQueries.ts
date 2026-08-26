import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getLocalCacheItem, setLocalCacheItem } from "@/lib/indexed-db-persister";
import { fetchPatientByRef } from "@/lib/patient-routing";
import { CLINIC_QUERY_KEYS } from "./useClinicDataQueries";
import type { HomeSessionRecord, HomePatientRecord } from "@/lib/home-patients-view";
import { isAnamnesisTemplateSchema, type AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";

export type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
export type PatientGroupRow = Database["public"]["Tables"]["patient_groups"]["Row"];
export type SessionRow = Database["public"]["Tables"]["sessions"]["Row"];
export type AgendaEventRow = Database["public"]["Tables"]["agenda_events"]["Row"];
export type PatientGroupTemplateRow = Database["public"]["Tables"]["patient_group_templates"]["Row"];
export type AnamnesisFormTemplateRow = Database["public"]["Tables"]["anamnesis_form_templates"]["Row"];
export type ClinicColorSlotRow = Database["public"]["Tables"]["clinic_group_color_slots"]["Row"];
export type ProfileSummary = Pick<Database["public"]["Tables"]["profiles"]["Row"], "id" | "full_name" | "email" | "job_title">;
export type GroupSuggestion = Pick<PatientGroupTemplateRow, "clinic_color_slot_id" | "color" | "name" | "normalized_name" | "status">;

export const PATIENT_QUERY_KEYS = {
  patient: (patientRef?: string | null, clinicId?: string | null) => ["patient", patientRef, "clinic", clinicId] as const,
  sessions: (patientId?: string | null) => ["patient-sessions", patientId] as const,
  groups: (patientId?: string | null) => ["patient-groups", patientId] as const,
  agendaEvents: (patientId?: string | null) => ["patient-agenda", patientId] as const,
  groupSuggestions: (clinicId?: string | null) => ["patient-group-suggestions", clinicId] as const,
  anamnesisTemplates: (clinicId?: string | null) => ["patient-anamnesis-templates", clinicId] as const,
  clinicBaseSchema: (clinicId?: string | null) => ["patient-clinic-base-schema", clinicId] as const,
  clinicColorSlots: (clinicId?: string | null) => ["clinic", clinicId, "color-slots"] as const,
  collaborators: (clinicId?: string | null) => ["clinic", clinicId, "profiles"] as const,
};

// IndexedDB storage keys
export const PATIENT_DETAIL_CACHE_KEY = (clinicId?: string | null, ref?: string | null) =>
  `patient_detail_${clinicId || "global"}_${ref || "unknown"}`;
export const PATIENT_SESSIONS_CACHE_KEY = (patientId: string) => `patient_sessions_${patientId}`;
export const PATIENT_SESSIONS_SYNC_KEY = (patientId: string) => `patient_sessions_sync_${patientId}`;
export const PATIENT_GROUPS_CACHE_KEY = (patientId: string) => `patient_groups_${patientId}`;
export const PATIENT_AGENDA_CACHE_KEY = (patientId: string) => `patient_agenda_${patientId}`;
export const PATIENT_TEMPLATES_CACHE_KEY = (clinicId: string) => `clinic_anamnesis_templates_${clinicId}`;
export const PATIENT_SUGGESTIONS_CACHE_KEY = (clinicId: string) => `clinic_group_suggestions_${clinicId}`;
export const PATIENT_BASE_SCHEMA_CACHE_KEY = (clinicId: string) => `clinic_base_schema_${clinicId}`;

/**
 * Hook para carregar dados cadastrais do paciente com cache local em IndexedDB e stale-while-revalidate.
 */
export function usePatientDetailQuery(patientRef?: string | null, clinicId?: string | null, enabled = true) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: PATIENT_QUERY_KEYS.patient(patientRef, clinicId),
    queryFn: async (): Promise<PatientRow | null> => {
      if (!patientRef) return null;

      const cacheKey = PATIENT_DETAIL_CACHE_KEY(clinicId, patientRef);
      const cached = await getLocalCacheItem<PatientRow>(cacheKey);

      try {
        const res = await fetchPatientByRef(patientRef, clinicId);
        if (res.data) {
          void setLocalCacheItem(cacheKey, res.data);
          // Se tiver clinicId e id diferente da ref, grava também pela chave id
          if (res.data.id && res.data.id !== patientRef) {
            void setLocalCacheItem(PATIENT_DETAIL_CACHE_KEY(clinicId, res.data.id), res.data);
          }
          return res.data;
        }
      } catch (err) {
        if (cached) {
          return cached;
        }
        throw err;
      }

      return cached ?? null;
    },
    placeholderData: () => {
      if (!patientRef) return undefined;
      const cachedDirect = queryClient.getQueryData<PatientRow>(PATIENT_QUERY_KEYS.patient(patientRef, clinicId));
      if (cachedDirect) return cachedDirect;

      if (clinicId) {
        const clinicPatients = queryClient.getQueryData<HomePatientRecord[]>(CLINIC_QUERY_KEYS.patients(clinicId));
        if (clinicPatients) {
          const found = clinicPatients.find((p) => p.id === patientRef || p.patient_code === patientRef);
          if (found) {
            return found as unknown as PatientRow;
          }
        }
      }
      return undefined;
    },
    enabled: Boolean(patientRef) && enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook para carregar atendimentos/sessões do paciente com persistência IndexedDB e sincronização delta incremental.
 */
export function usePatientSessionsQuery(patientId?: string | null, enabled = true) {
  return useQuery({
    queryKey: PATIENT_QUERY_KEYS.sessions(patientId),
    queryFn: async (): Promise<SessionRow[]> => {
      if (!patientId) return [];

      const cacheKey = PATIENT_SESSIONS_CACHE_KEY(patientId);
      const syncKey = PATIENT_SESSIONS_SYNC_KEY(patientId);

      const cached = await getLocalCacheItem<SessionRow[]>(cacheKey);
      const lastSync = typeof window !== "undefined" ? window.sessionStorage.getItem(syncKey) : null;

      // Delta sync incremental se houver cache local e marca de último sync
      if (cached && cached.length > 0 && lastSync) {
        try {
          const { data: delta, error } = await supabase
            .from("sessions")
            .select("*")
            .eq("patient_id", patientId)
            .gt("updated_at", lastSync)
            .order("updated_at", { ascending: false });

          if (!error && delta) {
            const syncTimestamp = new Date().toISOString();
            if (delta.length === 0) {
              if (typeof window !== "undefined") {
                window.sessionStorage.setItem(syncKey, syncTimestamp);
              }
              return cached;
            }

            const deltaMap = new Map(delta.map((s) => [s.id, s]));
            const merged = cached.map((s) => deltaMap.get(s.id) ?? s);
            delta.forEach((s) => {
              if (!cached.some((c) => c.id === s.id)) {
                merged.unshift(s);
              }
            });

            // Reordena por data da sessão decrescente
            merged.sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime());

            void setLocalCacheItem(cacheKey, merged);
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(syncKey, syncTimestamp);
            }
            return merged;
          }
        } catch {
          // Em caso de erro na busca delta, retorna o cache local resiliente
          return cached;
        }
      }

      // Busca completa caso não haja cache inicial ou falha no delta
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("patient_id", patientId)
        .order("session_date", { ascending: false });

      if (error) {
        if (cached) return cached;
        throw error;
      }

      const records = (data ?? []) as SessionRow[];
      void setLocalCacheItem(cacheKey, records);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(syncKey, new Date().toISOString());
      }
      return records;
    },
    enabled: Boolean(patientId) && enabled,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook para carregar grupos/tags do paciente persistidos em IndexedDB.
 */
export function usePatientGroupsQuery(patientId?: string | null, enabled = true) {
  return useQuery({
    queryKey: PATIENT_QUERY_KEYS.groups(patientId),
    queryFn: async (): Promise<PatientGroupRow[]> => {
      if (!patientId) return [];

      const cacheKey = PATIENT_GROUPS_CACHE_KEY(patientId);
      const cached = await getLocalCacheItem<PatientGroupRow[]>(cacheKey);

      try {
        const { data, error } = await supabase
          .from("patient_groups")
          .select("*")
          .eq("patient_id", patientId);

        if (error) {
          if (cached) return cached;
          throw error;
        }

        const groups = (data ?? []) as PatientGroupRow[];
        void setLocalCacheItem(cacheKey, groups);
        return groups;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    },
    enabled: Boolean(patientId) && enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook para carregar agendamentos do paciente persistidos em IndexedDB.
 */
export function usePatientAgendaEventsQuery(patientId?: string | null, enabled = true) {
  return useQuery({
    queryKey: PATIENT_QUERY_KEYS.agendaEvents(patientId),
    queryFn: async (): Promise<AgendaEventRow[]> => {
      if (!patientId) return [];

      const cacheKey = PATIENT_AGENDA_CACHE_KEY(patientId);
      const cached = await getLocalCacheItem<AgendaEventRow[]>(cacheKey);

      try {
        const { data, error } = await supabase
          .from("agenda_events")
          .select("*")
          .eq("patient_id", patientId)
          .order("scheduled_for", { ascending: true });

        if (error) {
          if (cached) return cached;
          throw error;
        }

        const events = (data ?? []) as AgendaEventRow[];
        void setLocalCacheItem(cacheKey, events);
        return events;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    },
    enabled: Boolean(patientId) && enabled,
    staleTime: 30 * 1000,
  });
}

/**
 * Hook para carregar modelos de grupos/tags da clínica persistidos em IndexedDB.
 */
export function usePatientGroupSuggestionsQuery(clinicId?: string | null, enabled = true) {
  return useQuery({
    queryKey: PATIENT_QUERY_KEYS.groupSuggestions(clinicId),
    queryFn: async (): Promise<GroupSuggestion[]> => {
      if (!clinicId) return [];

      const cacheKey = PATIENT_SUGGESTIONS_CACHE_KEY(clinicId);
      const cached = await getLocalCacheItem<GroupSuggestion[]>(cacheKey);

      try {
        const { data, error } = await supabase
          .from("patient_group_templates")
          .select("clinic_color_slot_id, color, name, normalized_name, status")
          .eq("clinic_id", clinicId)
          .order("name", { ascending: true });

        if (error) {
          if (cached) return cached;
          throw error;
        }

        const suggestions = (data ?? []) as GroupSuggestion[];
        void setLocalCacheItem(cacheKey, suggestions);
        return suggestions;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    },
    enabled: Boolean(clinicId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para carregar templates de anamnese ativos da clínica persistidos em IndexedDB.
 */
export function usePatientAnamnesisTemplatesQuery(clinicId?: string | null, enabled = true) {
  return useQuery({
    queryKey: PATIENT_QUERY_KEYS.anamnesisTemplates(clinicId),
    queryFn: async () => {
      if (!clinicId) return [];

      const cacheKey = PATIENT_TEMPLATES_CACHE_KEY(clinicId);
      const cached = await getLocalCacheItem<{ id: string; name: string; schema: AnamnesisTemplateSchema }[]>(cacheKey);

      try {
        const { data, error } = await supabase
          .from("anamnesis_form_templates")
          .select("id, name, schema")
          .eq("clinic_id", clinicId)
          .eq("is_active", true);

        if (error) {
          if (cached) return cached;
          throw error;
        }

        const validTemplates = ((data ?? []) as AnamnesisFormTemplateRow[])
          .filter((t) => isAnamnesisTemplateSchema(t.schema))
          .map((t) => ({
            id: t.id,
            name: t.name,
            schema: t.schema as AnamnesisTemplateSchema,
          }));

        void setLocalCacheItem(cacheKey, validTemplates);
        return validTemplates;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    },
    enabled: Boolean(clinicId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook para carregar o schema base de anamnese da clínica.
 */
export function usePatientClinicBaseSchemaQuery(clinicId?: string | null, enabled = true) {
  return useQuery({
    queryKey: PATIENT_QUERY_KEYS.clinicBaseSchema(clinicId),
    queryFn: async (): Promise<AnamnesisTemplateSchema> => {
      if (!clinicId) return [];

      const cacheKey = PATIENT_BASE_SCHEMA_CACHE_KEY(clinicId);
      const cached = await getLocalCacheItem<AnamnesisTemplateSchema>(cacheKey);

      try {
        const { data, error } = await supabase
          .from("clinics")
          .select("anamnesis_base_schema")
          .eq("id", clinicId)
          .single();

        if (error) {
          if (cached) return cached;
          throw error;
        }

        const schema = isAnamnesisTemplateSchema(data?.anamnesis_base_schema) ? data.anamnesis_base_schema : [];
        void setLocalCacheItem(cacheKey, schema);
        return schema;
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    },
    enabled: Boolean(clinicId) && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Mutações otimistas imediatas para o Prontuário do Paciente (PacienteDetalhe).
 * Atualiza o TanStack Query cache em tempo real e sincroniza com o IndexedDB local.
 */
export function useOptimisticPatientDetailUpdates(patientId?: string | null, clinicId?: string | null, patientRef?: string | null) {
  const queryClient = useQueryClient();

  const optimisticUpdatePatientStatus = useCallback(
    (nextStatus: PatientRow["status"]) => {
      if (!patientId) return;

      // Atualiza o paciente no detalhe
      const detailKeys = [
        PATIENT_QUERY_KEYS.patient(patientId, clinicId),
        ...(patientRef && patientRef !== patientId ? [PATIENT_QUERY_KEYS.patient(patientRef, clinicId)] : []),
      ];

      detailKeys.forEach((key) => {
        queryClient.setQueryData<PatientRow | null>(key, (current) =>
          current ? { ...current, status: nextStatus, updated_at: new Date().toISOString() } : current
        );
      });

      // Atualiza o paciente na listagem geral da clínica se existir clinicId
      if (clinicId) {
        const clinicPatientsKey = CLINIC_QUERY_KEYS.patients(clinicId);
        queryClient.setQueryData<HomePatientRecord[]>(clinicPatientsKey, (current = []) =>
          current.map((p) => (p.id === patientId ? { ...p, status: nextStatus, updated_at: new Date().toISOString() } : p))
        );
      }

      // Atualiza o IndexedDB
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

      // Atualiza IndexedDB
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

      const key = PATIENT_QUERY_KEYS.sessions(patientId);
      queryClient.setQueryData<SessionRow[]>(key, (current = []) => {
        const next = current.map((session) =>
          sessionIds.includes(session.id)
            ? { ...session, status: nextStatus, updated_at: new Date().toISOString() }
            : session
        );
        void setLocalCacheItem(PATIENT_SESSIONS_CACHE_KEY(patientId), next);
        return next;
      });

      // Sincroniza também com o resumo de sessões da clínica na Home
      if (clinicId) {
        const clinicSessionsKey = CLINIC_QUERY_KEYS.sessionsSummary(clinicId);
        queryClient.setQueryData<HomeSessionRecord[]>(clinicSessionsKey, (current = []) =>
          current.map((session) =>
            sessionIds.includes(session.id) ? { ...session, status: nextStatus } : session
          )
        );
      }
    },
    [clinicId, patientId, queryClient]
  );

  const optimisticMoveSessions = useCallback(
    (sessionIds: string[], nextGroupId: string | null) => {
      if (!patientId || sessionIds.length === 0) return;

      const key = PATIENT_QUERY_KEYS.sessions(patientId);
      queryClient.setQueryData<SessionRow[]>(key, (current = []) => {
        const next = current.map((session) =>
          sessionIds.includes(session.id)
            ? { ...session, group_id: nextGroupId, updated_at: new Date().toISOString() }
            : session
        );
        void setLocalCacheItem(PATIENT_SESSIONS_CACHE_KEY(patientId), next);
        return next;
      });

      // Sincroniza com a Home
      if (clinicId) {
        const clinicSessionsKey = CLINIC_QUERY_KEYS.sessionsSummary(clinicId);
        queryClient.setQueryData<HomeSessionRecord[]>(clinicSessionsKey, (current = []) =>
          current.map((session) =>
            sessionIds.includes(session.id) ? { ...session, group_id: nextGroupId } : session
          )
        );
      }
    },
    [clinicId, patientId, queryClient]
  );

  const optimisticMoveSessionsToEvolutionGroup = useCallback(
    (sessionIds: string[], nextEvolutionGroupId: string | null) => {
      if (!patientId || sessionIds.length === 0) return;

      const key = PATIENT_QUERY_KEYS.sessions(patientId);
      queryClient.setQueryData<SessionRow[]>(key, (current = []) => {
        const next = current.map((session) =>
          sessionIds.includes(session.id)
            ? { ...session, evolution_group_id: nextEvolutionGroupId, updated_at: new Date().toISOString() }
            : session
        );
        void setLocalCacheItem(PATIENT_SESSIONS_CACHE_KEY(patientId), next);
        return next;
      });
    },
    [patientId, queryClient]
  );

  const optimisticDeleteSessions = useCallback(
    (sessionIds: string[]) => {
      if (!patientId || sessionIds.length === 0) return;

      const key = PATIENT_QUERY_KEYS.sessions(patientId);
      queryClient.setQueryData<SessionRow[]>(key, (current = []) => {
        const next = current.filter((session) => !sessionIds.includes(session.id));
        void setLocalCacheItem(PATIENT_SESSIONS_CACHE_KEY(patientId), next);
        return next;
      });

      // Sincroniza com a Home
      if (clinicId) {
        const clinicSessionsKey = CLINIC_QUERY_KEYS.sessionsSummary(clinicId);
        queryClient.setQueryData<HomeSessionRecord[]>(clinicSessionsKey, (current = []) =>
          current.filter((session) => !sessionIds.includes(session.id))
        );
      }
    },
    [clinicId, patientId, queryClient]
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

      // Remove o grupo
      const key = PATIENT_QUERY_KEYS.groups(patientId);
      queryClient.setQueryData<PatientGroupRow[]>(key, (current = []) => {
        const next = current.filter((g) => g.id !== groupId);
        void setLocalCacheItem(PATIENT_GROUPS_CACHE_KEY(patientId), next);
        return next;
      });

      // Desvincula sessões associadas ao grupo deletado
      const sessionsKey = PATIENT_QUERY_KEYS.sessions(patientId);
      queryClient.setQueryData<SessionRow[]>(sessionsKey, (current = []) => {
        const next = current.map((s) => (s.group_id === groupId ? { ...s, group_id: null } : s));
        void setLocalCacheItem(PATIENT_SESSIONS_CACHE_KEY(patientId), next);
        return next;
      });
    },
    [patientId, queryClient]
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
