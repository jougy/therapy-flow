import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  getLocalCacheItem,
  getSyncMemoryCacheItem,
  setLocalCacheItem,
} from "@/lib/indexed-db-persister";
import { coalesceInFlight } from "@/lib/local-first/inFlightCoalescer";
import {
  fetchClinicShareCollaborators,
  fetchSessionShareSummaries,
  type SessionShareCollaborator,
  type SessionShareSummary,
} from "@/lib/session-sharing";

export type PatientEvolutionGroupRow = Database["public"]["Tables"]["patient_evolution_groups"]["Row"];
export type PatientPaymentPlanRow = Database["public"]["Tables"]["patient_payment_plans"]["Row"];

export const PATIENT_EVOLUTION_GROUPS_CACHE_KEY = (patientId: string) =>
  `patient_evolution_groups_${patientId}`;
export const PATIENT_PAYMENT_PLANS_CACHE_KEY = (patientId: string) =>
  `patient_payment_plans_${patientId}`;
export const SESSION_SHARE_SUMMARIES_CACHE_KEY = (sessionIdsKey: string) =>
  `session_share_summaries_${sessionIdsKey}`;
export const CLINIC_SHARE_COLLABORATORS_CACHE_KEY = (clinicId: string) =>
  `clinic_share_collaborators_${clinicId}`;

export const PATIENT_EXTRA_QUERY_KEYS = {
  evolutionGroups: (patientId?: string | null) =>
    ["patient-evolution-groups", patientId] as const,
  paymentPlans: (patientId?: string | null) =>
    ["patient-payment-plans", patientId] as const,
  sessionShareSummaries: (sessionIdsKey: string) =>
    ["session-share-summaries", sessionIdsKey] as const,
  clinicShareCollaborators: (clinicId?: string | null) =>
    ["clinic-share-collaborators", clinicId] as const,
};

/**
 * Hook para carregar grupos de evolução do paciente com cache local L1/L2.
 */
export function usePatientEvolutionGroupsQuery(patientId?: string | null, enabled = true) {
  const cacheKey = patientId ? PATIENT_EVOLUTION_GROUPS_CACHE_KEY(patientId) : "";

  return useQuery({
    queryKey: PATIENT_EXTRA_QUERY_KEYS.evolutionGroups(patientId),
    queryFn: async (): Promise<PatientEvolutionGroupRow[]> => {
      if (!patientId) return [];

      const cached = await getLocalCacheItem<PatientEvolutionGroupRow[]>(cacheKey);

      try {
        return await coalesceInFlight(`evo_groups:${patientId}`, async () => {
          const { data, error } = await supabase
            .from("patient_evolution_groups")
            .select("*")
            .eq("patient_id", patientId);

          if (error) {
            if (cached) return cached;
            throw error;
          }

          const groups = (data ?? []) as PatientEvolutionGroupRow[];
          void setLocalCacheItem(cacheKey, groups);
          return groups;
        });
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    },
    placeholderData: () =>
      cacheKey ? getSyncMemoryCacheItem<PatientEvolutionGroupRow[]>(cacheKey) ?? undefined : undefined,
    enabled: Boolean(patientId) && enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook para carregar planos/pacotes de pagamento do paciente com cache local L1/L2.
 */
export function usePatientPaymentPlansQuery(patientId?: string | null, enabled = true) {
  const cacheKey = patientId ? PATIENT_PAYMENT_PLANS_CACHE_KEY(patientId) : "";

  return useQuery({
    queryKey: PATIENT_EXTRA_QUERY_KEYS.paymentPlans(patientId),
    queryFn: async (): Promise<PatientPaymentPlanRow[]> => {
      if (!patientId) return [];

      const cached = await getLocalCacheItem<PatientPaymentPlanRow[]>(cacheKey);

      try {
        return await coalesceInFlight(`payment_plans:${patientId}`, async () => {
          const { data, error } = await supabase
            .from("patient_payment_plans")
            .select("*")
            .eq("patient_id", patientId)
            .order("created_at", { ascending: false });

          if (error) {
            if (cached) return cached;
            throw error;
          }

          const plans = (data ?? []) as PatientPaymentPlanRow[];
          void setLocalCacheItem(cacheKey, plans);
          return plans;
        });
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    },
    placeholderData: () =>
      cacheKey ? getSyncMemoryCacheItem<PatientPaymentPlanRow[]>(cacheKey) ?? undefined : undefined,
    enabled: Boolean(patientId) && enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook para carregar resumos de compartilhamento de sessões com deduplicação e cache.
 */
export function useSessionShareSummariesQuery(sessionIds: string[], enabled = true) {
  const normalizedIds = useMemo(
    () => Array.from(new Set(sessionIds.filter(Boolean))).sort(),
    [sessionIds]
  );
  const sessionIdsKey = normalizedIds.join(",");
  const cacheKey = sessionIdsKey ? SESSION_SHARE_SUMMARIES_CACHE_KEY(sessionIdsKey) : "";

  return useQuery({
    queryKey: PATIENT_EXTRA_QUERY_KEYS.sessionShareSummaries(sessionIdsKey),
    queryFn: async (): Promise<SessionShareSummary[]> => {
      if (normalizedIds.length === 0) return [];

      const cached = await getLocalCacheItem<SessionShareSummary[]>(cacheKey);

      try {
        return await coalesceInFlight(`share_summaries:${sessionIdsKey}`, async () => {
          const summaries = await fetchSessionShareSummaries(normalizedIds);
          void setLocalCacheItem(cacheKey, summaries);
          return summaries;
        });
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    },
    placeholderData: () =>
      cacheKey ? getSyncMemoryCacheItem<SessionShareSummary[]>(cacheKey) ?? undefined : undefined,
    enabled: normalizedIds.length > 0 && enabled,
    staleTime: 60 * 1000,
  });
}

/**
 * Hook lazy para carregar colaboradores elegíveis a compartilhamento na clínica.
 * Dispara somente quando `enabled === true`.
 */
export function useClinicShareCollaboratorsQuery(
  clinicId?: string | null,
  enabled = false
) {
  const cacheKey = clinicId ? CLINIC_SHARE_COLLABORATORS_CACHE_KEY(clinicId) : "";

  return useQuery({
    queryKey: PATIENT_EXTRA_QUERY_KEYS.clinicShareCollaborators(clinicId),
    queryFn: async (): Promise<SessionShareCollaborator[]> => {
      if (!clinicId) return [];

      const cached = await getLocalCacheItem<SessionShareCollaborator[]>(cacheKey);

      try {
        return await coalesceInFlight(`share_collaborators:${clinicId}`, async () => {
          const collaborators = await fetchClinicShareCollaborators(clinicId);
          void setLocalCacheItem(cacheKey, collaborators);
          return collaborators;
        });
      } catch (err) {
        if (cached) return cached;
        throw err;
      }
    },
    placeholderData: () =>
      cacheKey ? getSyncMemoryCacheItem<SessionShareCollaborator[]>(cacheKey) ?? undefined : undefined,
    enabled: Boolean(clinicId) && enabled === true,
    staleTime: 5 * 60 * 1000,
  });
}
