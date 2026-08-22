import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { logRuntimeError } from "@/lib/runtime-debug";
import type {
  HomeAgendaEventRecord,
  HomeCollaboratorFilterRecord,
  HomePatientGroupRecord,
  HomePatientRecord,
  HomeSessionRecord,
} from "@/lib/home-patients-view";
import { getLegacyGroupHex } from "@/lib/group-colors";

export interface ClinicDashboardAnalytics {
  year: number;
  totalSessions: number;
  paidSessions: number;
  canceledSessions: number;
  cancellationRate: number;
  todaySessions: number;
  weekSessions: number;
  monthSessions: number;
  yearSessions: number;
  financialTotals: {
    paid: number;
    credit: number;
    open: number;
    forecastRevenueCents: number;
  };
  paymentStatusCounts: {
    cortesia?: number;
    courtesy?: number;
    credit?: number;
    debt?: number;
    pending?: number;
    paid?: number;
    notCharged?: number;
    [key: string]: number | undefined;
  };
  paymentMethodCounts: Record<string, number>;
  patientStatusCounts: Record<string, number>;
  totalPatients: number;
  recurringPatients: number;
  agendaCounts: {
    late: number;
    confirmed: number;
    awaiting: number;
    total: number;
  };
  monthlyRevenue: Array<{
    label: string;
    pago: number;
    emAberto: number;
    atendimentos: number;
  }>;
  last30Days: Array<{
    label: string;
    atendimentos: number;
  }>;
  weekdayDistribution: Array<{
    label: string;
    atendimentos: number;
  }>;
  topGroups: Array<{
    name: string;
    color: string;
    total: number;
  }>;
  collaborators: Array<{
    label: string;
    total: number;
    receita: number;
  }>;
}

export const DEFAULT_CLINIC_ANALYTICS: ClinicDashboardAnalytics = {
  year: new Date().getFullYear(),
  totalSessions: 0,
  paidSessions: 0,
  canceledSessions: 0,
  cancellationRate: 0,
  todaySessions: 0,
  weekSessions: 0,
  monthSessions: 0,
  yearSessions: 0,
  financialTotals: {
    paid: 0,
    credit: 0,
    open: 0,
    forecastRevenueCents: 0,
  },
  paymentStatusCounts: {
    courtesy: 0,
    credit: 0,
    debt: 0,
    pending: 0,
    paid: 0,
    notCharged: 0,
  },
  paymentMethodCounts: {},
  patientStatusCounts: {},
  totalPatients: 0,
  recurringPatients: 0,
  agendaCounts: {
    late: 0,
    confirmed: 0,
    awaiting: 0,
    total: 0,
  },
  monthlyRevenue: [
    { label: "Jan", pago: 0, emAberto: 0, atendimentos: 0 },
    { label: "Fev", pago: 0, emAberto: 0, atendimentos: 0 },
    { label: "Mar", pago: 0, emAberto: 0, atendimentos: 0 },
    { label: "Abr", pago: 0, emAberto: 0, atendimentos: 0 },
    { label: "Mai", pago: 0, emAberto: 0, atendimentos: 0 },
    { label: "Jun", pago: 0, emAberto: 0, atendimentos: 0 },
    { label: "Jul", pago: 0, emAberto: 0, atendimentos: 0 },
    { label: "Ago", pago: 0, emAberto: 0, atendimentos: 0 },
    { label: "Set", pago: 0, emAberto: 0, atendimentos: 0 },
    { label: "Out", pago: 0, emAberto: 0, atendimentos: 0 },
    { label: "Nov", pago: 0, emAberto: 0, atendimentos: 0 },
    { label: "Dez", pago: 0, emAberto: 0, atendimentos: 0 },
  ],
  last30Days: [],
  weekdayDistribution: [
    { label: "Dom", atendimentos: 0 },
    { label: "Seg", atendimentos: 0 },
    { label: "Ter", atendimentos: 0 },
    { label: "Qua", atendimentos: 0 },
    { label: "Qui", atendimentos: 0 },
    { label: "Sex", atendimentos: 0 },
    { label: "Sáb", atendimentos: 0 },
  ],
  topGroups: [],
  collaborators: [],
};

type PatientGroupRow = Database["public"]["Tables"]["patient_groups"]["Row"];
type PatientGroupWithColorSlot = PatientGroupRow & {
  clinic_group_color_slots?: { color_hex: string | null } | null;
};
type ClinicMembershipRow = Database["public"]["Tables"]["clinic_memberships"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export const CLINIC_QUERY_KEYS = {
  patients: (clinicId?: string | null) => ["clinic", clinicId, "patients"] as const,
  sessionsSummary: (clinicId?: string | null) => ["clinic", clinicId, "sessions-summary"] as const,
  groups: (clinicId?: string | null) => ["clinic", clinicId, "groups"] as const,
  colorSlots: (clinicId?: string | null) => ["clinic", clinicId, "color-slots"] as const,
  agendaEvents: (clinicId?: string | null) => ["clinic", clinicId, "agenda-events"] as const,
  memberships: (clinicId?: string | null) => ["clinic", clinicId, "memberships"] as const,
  profiles: (clinicId?: string | null) => ["clinic", clinicId, "profiles"] as const,
  analytics: (clinicId?: string | null, year?: number | null) => ["clinic", clinicId, "analytics", year ?? new Date().getFullYear()] as const,
  patientDetail: (patientId?: string | null, clinicId?: string | null) => ["patient", patientId, "clinic", clinicId] as const,
  patientSessions: (patientId?: string | null) => ["patient-sessions", patientId] as const,
};

const resolveGroupFilterColor = (group: PatientGroupWithColorSlot) =>
  group.clinic_group_color_slots?.color_hex ?? getLegacyGroupHex(group.color);

import { getLocalCacheItem, setLocalCacheItem } from "@/lib/indexed-db-persister";

const PATIENTS_CACHE_KEY = (clinicId: string) => `clinic_patients_${clinicId}`;
const PATIENTS_SYNC_KEY = (clinicId: string) => `clinic_patients_sync_${clinicId}`;

export function useClinicPatientsQuery(clinicId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: CLINIC_QUERY_KEYS.patients(clinicId),
    queryFn: async (): Promise<HomePatientRecord[]> => {
      if (!clinicId) return [];

      const cached = await getLocalCacheItem<HomePatientRecord[]>(PATIENTS_CACHE_KEY(clinicId));
      const lastSync = typeof window !== "undefined" ? window.sessionStorage.getItem(PATIENTS_SYNC_KEY(clinicId)) : null;

      // Delta sync if local cache exists
      if (cached && cached.length > 0 && lastSync) {
        const { data: delta, error } = await supabase
          .from("patients")
          .select("id, name, patient_code, status, updated_at, cpf, date_of_birth, gender, pronoun, phone, is_recurring, recurring_weekdays, recurring_time, origin_type")
          .eq("clinic_id", clinicId)
          .gt("updated_at", lastSync)
          .order("updated_at", { ascending: false });

        if (!error && delta) {
          const syncTimestamp = new Date().toISOString();
          if (delta.length === 0) {
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(PATIENTS_SYNC_KEY(clinicId), syncTimestamp);
            }
            return cached;
          }

          const deltaMap = new Map((delta as HomePatientRecord[]).map((p) => [p.id, p]));
          const merged = cached.map((p) => deltaMap.get(p.id) ?? p);
          delta.forEach((p) => {
            if (!cached.some((c) => c.id === p.id)) {
              merged.unshift(p as HomePatientRecord);
            }
          });

          void setLocalCacheItem(PATIENTS_CACHE_KEY(clinicId), merged);
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(PATIENTS_SYNC_KEY(clinicId), syncTimestamp);
          }
          return merged;
        }
      }

      const { data, error } = await supabase
        .from("patients")
        .select("id, name, patient_code, status, updated_at, cpf, date_of_birth, gender, pronoun, phone, is_recurring, recurring_weekdays, recurring_time, origin_type")
        .eq("clinic_id", clinicId)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      const records = (data ?? []) as HomePatientRecord[];
      void setLocalCacheItem(PATIENTS_CACHE_KEY(clinicId), records);
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(PATIENTS_SYNC_KEY(clinicId), new Date().toISOString());
      }
      return records;
    },
    enabled: Boolean(clinicId) && enabled,
  });
}

export function useClinicSessionsSummaryQuery(clinicId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: CLINIC_QUERY_KEYS.sessionsSummary(clinicId),
    queryFn: async (): Promise<HomeSessionRecord[]> => {
      if (!clinicId) return [];

      const { data, error } = await supabase
        .from("sessions")
        .select("id, patient_id, clinic_id, group_id, session_date, status, amount_charged_cents, amount_paid_cents, payment_status, payment_method, provider_id, user_id, scheduled_start_at")
        .eq("clinic_id", clinicId);

      if (error) throw error;
      return (data ?? []) as HomeSessionRecord[];
    },
    enabled: Boolean(clinicId) && enabled,
  });
}

export function useClinicDashboardAnalyticsQuery(
  clinicId: string | null | undefined,
  year?: number | null,
  enabled = true
) {
  const currentYear = year ?? new Date().getFullYear();

  return useQuery({
    queryKey: CLINIC_QUERY_KEYS.analytics(clinicId, currentYear),
    queryFn: async (): Promise<ClinicDashboardAnalytics> => {
      if (!clinicId) return DEFAULT_CLINIC_ANALYTICS;

      const { data, error } = await supabase.rpc("get_clinic_dashboard_analytics", {
        _clinic_id: clinicId,
        _year: currentYear,
      });

      if (error) {
        logRuntimeError("useClinicDashboardAnalyticsQuery", error, { clinicId, year: currentYear });
        throw error;
      }

      if (!data) return DEFAULT_CLINIC_ANALYTICS;
      return data as unknown as ClinicDashboardAnalytics;
    },
    enabled: Boolean(clinicId) && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 24 * 60 * 60 * 1000,
  });
}

export function useClinicPatientGroupsQuery(clinicId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: CLINIC_QUERY_KEYS.groups(clinicId),
    queryFn: async (): Promise<HomePatientGroupRecord[]> => {
      if (!clinicId) return [];

      const { data, error } = await supabase
        .from("patient_groups")
        .select("*, clinic_group_color_slots(color_hex)")
        .eq("clinic_id", clinicId);

      if (error) throw error;

      return ((data ?? []) as PatientGroupWithColorSlot[]).map<HomePatientGroupRecord>((group) => ({
        color: resolveGroupFilterColor(group),
        id: group.id,
        name: group.name,
        patient_id: group.patient_id,
        status: group.status,
      }));
    },
    enabled: Boolean(clinicId) && enabled,
  });
}

export function useClinicGroupColorSlotsQuery(clinicId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: CLINIC_QUERY_KEYS.colorSlots(clinicId),
    queryFn: async () => {
      if (!clinicId) return [];

      const { data, error } = await supabase
        .from("clinic_group_color_slots")
        .select("*")
        .eq("clinic_id", clinicId)
        .order("slot_index", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
    enabled: Boolean(clinicId) && enabled,
  });
}

export function useClinicAgendaEventsQuery(clinicId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: CLINIC_QUERY_KEYS.agendaEvents(clinicId),
    queryFn: async (): Promise<HomeAgendaEventRecord[]> => {
      if (!clinicId) return [];

      const { data, error } = await supabase
        .from("agenda_events")
        .select("id, patient_id, title, event_type, status, scheduled_for")
        .eq("clinic_id", clinicId)
        .neq("status", "cancelado")
        .order("scheduled_for", { ascending: true });

      if (error) throw error;
      return (data ?? []) as HomeAgendaEventRecord[];
    },
    enabled: Boolean(clinicId) && enabled,
  });
}

export function useClinicCollaboratorsQuery(clinicId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: CLINIC_QUERY_KEYS.memberships(clinicId),
    queryFn: async (): Promise<HomeCollaboratorFilterRecord[]> => {
      if (!clinicId) return [];

      const [membershipsRes, profilesRes] = await Promise.all([
        supabase
          .from("clinic_memberships")
          .select("user_id, operational_role, is_active, membership_status")
          .eq("clinic_id", clinicId),
        supabase
          .from("profiles")
          .select("id, full_name, email, job_title")
          .eq("clinic_id", clinicId),
      ]);

      if (membershipsRes.error) throw membershipsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const memberships = ((membershipsRes.data ?? []) as ClinicMembershipRow[]).filter(
        (membership) => membership.is_active && membership.membership_status === "active"
      );
      const profiles = (profilesRes.data ?? []) as Pick<ProfileRow, "email" | "full_name" | "id" | "job_title">[];
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      return memberships.map<HomeCollaboratorFilterRecord>((membership) => {
        const profile = profileMap.get(membership.user_id);
        return {
          email: profile?.email ?? null,
          full_name: profile?.full_name ?? null,
          id: membership.user_id,
          job_title: profile?.job_title ?? null,
          operational_role: membership.operational_role,
        };
      });
    },
    enabled: Boolean(clinicId) && enabled,
  });
}

export function useOptimisticSessionUpdates(clinicId?: string | null) {
  const queryClient = useQueryClient();

  const optimisticMoveSessions = useCallback(
    (sessionIds: string[], nextGroupId: string | null) => {
      if (!clinicId || sessionIds.length === 0) return;
      const key = CLINIC_QUERY_KEYS.sessionsSummary(clinicId);
      queryClient.setQueryData<HomeSessionRecord[]>(key, (current = []) =>
        current.map((session) =>
          sessionIds.includes(session.id) ? { ...session, group_id: nextGroupId } : session
        )
      );
    },
    [clinicId, queryClient]
  );

  const optimisticUpdateStatus = useCallback(
    (sessionIds: string[], nextStatus: string) => {
      if (!clinicId || sessionIds.length === 0) return;
      const key = CLINIC_QUERY_KEYS.sessionsSummary(clinicId);
      queryClient.setQueryData<HomeSessionRecord[]>(key, (current = []) =>
        current.map((session) =>
          sessionIds.includes(session.id) ? { ...session, status: nextStatus } : session
        )
      );
    },
    [clinicId, queryClient]
  );

  const optimisticDeleteSessions = useCallback(
    (sessionIds: string[]) => {
      if (!clinicId || sessionIds.length === 0) return;
      const key = CLINIC_QUERY_KEYS.sessionsSummary(clinicId);
      queryClient.setQueryData<HomeSessionRecord[]>(key, (current = []) =>
        current.filter((session) => !sessionIds.includes(session.id))
      );
    },
    [clinicId, queryClient]
  );

  return {
    optimisticMoveSessions,
    optimisticUpdateStatus,
    optimisticDeleteSessions,
  };
}

export function useOptimisticPatientUpdates(clinicId?: string | null) {
  const queryClient = useQueryClient();

  const optimisticRemovePatient = useCallback(
    (patientId: string) => {
      if (!clinicId || !patientId) return;
      const key = CLINIC_QUERY_KEYS.patients(clinicId);
      queryClient.setQueryData<HomePatientRecord[]>(key, (current = []) =>
        current.filter((patient) => patient.id !== patientId)
      );
    },
    [clinicId, queryClient]
  );

  return {
    optimisticRemovePatient,
  };
}

export function useInvalidateClinicData() {
  const queryClient = useQueryClient();

  return useCallback(
    async (
      clinicId?: string | null,
      targets?: Array<"patients" | "sessions" | "groups" | "agenda" | "members" | "analytics">
    ) => {
      if (!clinicId) {
        await queryClient.invalidateQueries({ queryKey: ["clinic"] });
        return;
      }

      if (!targets || targets.length === 0) {
        await queryClient.invalidateQueries({ queryKey: ["clinic", clinicId] });
        return;
      }

      const promises: Promise<void>[] = [];

      if (targets.includes("patients")) {
        promises.push(queryClient.invalidateQueries({ queryKey: CLINIC_QUERY_KEYS.patients(clinicId) }));
      }
      if (targets.includes("sessions")) {
        promises.push(queryClient.invalidateQueries({ queryKey: CLINIC_QUERY_KEYS.sessionsSummary(clinicId) }));
      }
      if (targets.includes("groups")) {
        promises.push(queryClient.invalidateQueries({ queryKey: CLINIC_QUERY_KEYS.groups(clinicId) }));
      }
      if (targets.includes("agenda")) {
        promises.push(queryClient.invalidateQueries({ queryKey: CLINIC_QUERY_KEYS.agendaEvents(clinicId) }));
      }
      if (targets.includes("members")) {
        promises.push(queryClient.invalidateQueries({ queryKey: CLINIC_QUERY_KEYS.memberships(clinicId) }));
      }
      if (targets.includes("analytics") || targets.includes("sessions") || targets.includes("patients") || targets.includes("agenda")) {
        promises.push(queryClient.invalidateQueries({ queryKey: ["clinic", clinicId, "analytics"] }));
      }

      await Promise.all(promises);
    },
    [queryClient]
  );
}

export function usePrefetchPatientDetail(clinicId?: string | null) {
  const queryClient = useQueryClient();

  return useCallback(
    (patientId?: string | null) => {
      if (!clinicId || !patientId) return;

      void queryClient.prefetchQuery({
        queryKey: ["patient", patientId, "clinic", clinicId],
        queryFn: async () => {
          const cacheKey = `patient_detail_${clinicId || "global"}_${patientId}`;
          const cached = await getLocalCacheItem(cacheKey);
          if (cached) return cached;

          const { data, error } = await supabase
            .from("patients")
            .select("*")
            .eq("id", patientId)
            .eq("clinic_id", clinicId)
            .maybeSingle();

          if (error) throw error;
          if (data) {
            void setLocalCacheItem(cacheKey, data);
          }
          return data;
        },
        staleTime: 60 * 1000,
      });

      void queryClient.prefetchQuery({
        queryKey: ["patient-sessions", patientId],
        queryFn: async () => {
          const cacheKey = `patient_sessions_${patientId}`;
          const cached = await getLocalCacheItem(cacheKey);
          if (cached) return cached;

          const { data, error } = await supabase
            .from("sessions")
            .select("*")
            .eq("patient_id", patientId)
            .order("session_date", { ascending: false });

          if (error) throw error;
          const records = data ?? [];
          void setLocalCacheItem(cacheKey, records);
          return records;
        },
        staleTime: 60 * 1000,
      });
    },
    [clinicId, queryClient]
  );
}



