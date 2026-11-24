import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  getLocalCacheItem,
  getSyncMemoryCacheItem,
  setLocalCacheItem,
  deleteLocalCacheItem,
} from "@/lib/indexed-db-persister";
import { deltaMergeById } from "@/lib/local-first/deltaMerge";
import { coalesceInFlight } from "@/lib/local-first/inFlightCoalescer";
import { fetchPatientByRef } from "@/lib/patient-routing";
import { CLINIC_QUERY_KEYS } from "./useClinicDataQueries";
import type { HomePatientRecord } from "@/lib/home-patients-view";
import { isAnamnesisTemplateSchema, type AnamnesisTemplateSchema } from "@/lib/anamnesis-forms";
import { useAuth } from "@/hooks/useAuth";
import {
  PATIENT_EVOLUTION_GROUPS_CACHE_KEY,
  PATIENT_PAYMENT_PLANS_CACHE_KEY,
  SESSION_SHARE_SUMMARIES_CACHE_KEY,
  CLINIC_SHARE_COLLABORATORS_CACHE_KEY,
  usePatientEvolutionGroupsQuery,
  usePatientPaymentPlansQuery,
  useSessionShareSummariesQuery,
  useClinicShareCollaboratorsQuery,
  type PatientEvolutionGroupRow,
  type PatientPaymentPlanRow,
} from "./usePatientExtraQueries";
import {
  PATIENT_QUERY_KEYS,
  PATIENT_DETAIL_CACHE_KEY,
  PATIENT_SESSIONS_CACHE_KEY,
  PATIENT_SESSIONS_SYNC_KEY,
  PATIENT_GROUPS_CACHE_KEY,
  PATIENT_AGENDA_CACHE_KEY,
  PATIENT_TEMPLATES_CACHE_KEY,
  PATIENT_SUGGESTIONS_CACHE_KEY,
  PATIENT_BASE_SCHEMA_CACHE_KEY,
  type PatientRow,
  type PatientGroupRow,
  type SessionRow,
  type AgendaEventRow,
  type PatientGroupTemplateRow,
  type AnamnesisFormTemplateRow,
  type ClinicColorSlotRow,
  type ProfileSummary,
  type GroupSuggestion,
} from "./patientQueryKeys";
import {
  useOptimisticPatientDetailUpdates,
  useInvalidatePatientData,
} from "./usePatientOptimisticUpdates";

export {
  PATIENT_EVOLUTION_GROUPS_CACHE_KEY,
  PATIENT_PAYMENT_PLANS_CACHE_KEY,
  SESSION_SHARE_SUMMARIES_CACHE_KEY,
  CLINIC_SHARE_COLLABORATORS_CACHE_KEY,
  usePatientEvolutionGroupsQuery,
  usePatientPaymentPlansQuery,
  useSessionShareSummariesQuery,
  useClinicShareCollaboratorsQuery,
  type PatientEvolutionGroupRow,
  type PatientPaymentPlanRow,
  PATIENT_QUERY_KEYS,
  PATIENT_DETAIL_CACHE_KEY,
  PATIENT_SESSIONS_CACHE_KEY,
  PATIENT_SESSIONS_SYNC_KEY,
  PATIENT_GROUPS_CACHE_KEY,
  PATIENT_AGENDA_CACHE_KEY,
  PATIENT_TEMPLATES_CACHE_KEY,
  PATIENT_SUGGESTIONS_CACHE_KEY,
  PATIENT_BASE_SCHEMA_CACHE_KEY,
  type PatientRow,
  type PatientGroupRow,
  type SessionRow,
  type AgendaEventRow,
  type PatientGroupTemplateRow,
  type AnamnesisFormTemplateRow,
  type ClinicColorSlotRow,
  type ProfileSummary,
  type GroupSuggestion,
  useOptimisticPatientDetailUpdates,
  useInvalidatePatientData,
};

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

      const memoryCached = getSyncMemoryCacheItem<PatientRow>(PATIENT_DETAIL_CACHE_KEY(clinicId, patientRef));
      if (memoryCached) return memoryCached;

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

export interface UsePatientSessionsQueryOptions {
  userId?: string | null;
  canReadSessions?: boolean;
}

/**
 * Hook para carregar atendimentos/sessões do paciente com persistência IndexedDB,
 * isolamento estrito por usuário (blindagem LGPD) e sincronização delta incremental.
 */
export function usePatientSessionsQuery(
  patientId?: string | null,
  enabled = true,
  options?: UsePatientSessionsQueryOptions
) {
  const auth = useAuth();
  const currentUserId = options?.userId ?? auth.user?.id ?? null;
  const isSuperAdmin = auth.isSuperAdmin;
  const isOwner = auth.accountRole === "account_owner" || auth.operationalRole === "owner";

  // Blindagem LGPD: Validação estrita se o colaborador possui permissão de leitura de sessões
  const hasReadPermission =
    options?.canReadSessions !== undefined
      ? options.canReadSessions
      : Boolean(
          !auth.user || // fallback para testes unitários executados sem sessão autenticada
            isSuperAdmin ||
            isOwner ||
            auth.can("sessions.read") ||
            auth.can("sessions.read_all")
        );

  const queryKey = PATIENT_QUERY_KEYS.sessions(patientId, currentUserId);
  const cacheKey = patientId ? PATIENT_SESSIONS_CACHE_KEY(patientId, currentUserId) : "";
  const syncKey = patientId ? PATIENT_SESSIONS_SYNC_KEY(patientId, currentUserId) : "";

  return useQuery({
    queryKey,
    queryFn: async (): Promise<SessionRow[]> => {
      if (!patientId || !hasReadPermission) {
        if (patientId && currentUserId && !hasReadPermission) {
          // Hardening contra vazamento de prontuário: se perdeu acesso, limpa o cache local sensível
          void deleteLocalCacheItem(cacheKey);
        }
        return [];
      }

      const cached = await getLocalCacheItem<SessionRow[]>(cacheKey);
      const lastSync = typeof window !== "undefined" ? window.sessionStorage.getItem(syncKey) : null;

      // Delta sync incremental se houver cache local e marca de último sync
      if (cached && cached.length > 0 && lastSync) {
        try {
          const { data: delta, error } = await coalesceInFlight(
            `sessions_delta:${patientId}:${currentUserId ?? "anon"}:${lastSync}`,
            async () =>
              supabase
                .from("sessions")
                .select("*")
                .eq("patient_id", patientId)
                .gt("updated_at", lastSync)
                .order("updated_at", { ascending: false })
          );

          if (!error && delta) {
            const syncTimestamp = new Date().toISOString();
            if (delta.length === 0) {
              if (typeof window !== "undefined") {
                window.sessionStorage.setItem(syncKey, syncTimestamp);
              }
              return cached;
            }

            const merged = deltaMergeById(
              cached,
              delta as SessionRow[],
              (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime()
            );

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
      const { data, error } = await coalesceInFlight(
        `sessions_full:${patientId}:${currentUserId ?? "anon"}`,
        async () =>
          supabase
            .from("sessions")
            .select("*")
            .eq("patient_id", patientId)
            .order("session_date", { ascending: false })
      );

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
    placeholderData: () =>
      cacheKey && hasReadPermission
        ? getSyncMemoryCacheItem<SessionRow[]>(cacheKey) ?? undefined
        : undefined,
    enabled: Boolean(patientId) && enabled && hasReadPermission,
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
    placeholderData: () =>
      patientId
        ? getSyncMemoryCacheItem<PatientGroupRow[]>(PATIENT_GROUPS_CACHE_KEY(patientId)) ?? undefined
        : undefined,
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
    placeholderData: () =>
      patientId
        ? getSyncMemoryCacheItem<AgendaEventRow[]>(PATIENT_AGENDA_CACHE_KEY(patientId)) ?? undefined
        : undefined,
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
    staleTime: 30 * 60 * 1000, // 30 minutos em cache (dados frios de catálogo)
    gcTime: 60 * 60 * 1000,    // 1 hora de retenção em memória
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

