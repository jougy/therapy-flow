import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  getLocalCacheItem,
  getSyncMemoryCacheItem,
  setLocalCacheItem,
} from "@/lib/indexed-db-persister";
import { isOfflineOrNetworkError } from "@/lib/local-first/networkError";
import { PATIENT_DETAIL_CACHE_KEY } from "@/hooks/queries/usePatientDataQueries";
import { fetchPatientByRef } from "@/lib/patient-routing";

export type PatientRow = Database["public"]["Tables"]["patients"]["Row"];
export type PatientClinicalSnapshotRow = Database["public"]["Tables"]["patient_clinical_snapshots"]["Row"];
export type ProfileSummary = Pick<Database["public"]["Tables"]["profiles"]["Row"], "email" | "full_name" | "id">;

export interface PatientSummaryData {
  patient: PatientRow;
  clinicalSnapshots: PatientClinicalSnapshotRow[];
  profiles: ProfileSummary[];
  profileNameById: Record<string, string> & { get?: (id: string) => string | undefined };
}

export interface UsePatientSummaryParams {
  patientRef?: string | null;
  clinicId?: string | null;
  clinicKey?: string | null;
}

export const PATIENT_SUMMARY_CACHE_KEY = (
  clinicId: string | null | undefined,
  cleanRef: string
) => `patient_summary_${clinicId || "global"}_${cleanRef}`;

function attachProfileNameGetter(
  source: Record<string, string> | undefined
): Record<string, string> & { get?: (id: string) => string | undefined } {
  const profileNameById: Record<string, string> & { get?: (id: string) => string | undefined } = {
    ...(source ?? {}),
  };
  Object.defineProperty(profileNameById, "get", {
    value: (id: string) => profileNameById[id],
    enumerable: false,
    configurable: true,
  });
  return profileNameById;
}

export function hydratePatientSummaryData(data: PatientSummaryData): PatientSummaryData {
  return {
    ...data,
    profileNameById: attachProfileNameGetter(data.profileNameById),
  };
}

/**
 * Hook com React Query para carregar resumo clínico do paciente de forma reativa e otimizada.
 * - Evita download em lote de todos os profiles da clínica.
 * - Busca apenas autores referenciados em snapshots clínicos (.limit(25)).
 * - Query Key alinhada aos padrões Pluri-Health: ["patient", resolvedClinicId, cleanRef, "summary"]
 * - Cache L1/L2 em IndexedDB para abertura imediata offline.
 */
export function usePatientSummary({
  patientRef,
  clinicId,
  clinicKey,
}: UsePatientSummaryParams) {
  const cleanRef = patientRef?.trim() || "";
  const resolvedClinicId = clinicKey || clinicId || "global";
  const cacheClinicScope = clinicId || clinicKey || "global";
  const cacheKey = cleanRef ? PATIENT_SUMMARY_CACHE_KEY(cacheClinicScope, cleanRef) : null;

  return useQuery<PatientSummaryData>({
    queryKey: ["patient", resolvedClinicId, cleanRef, "summary"],
    queryFn: async (): Promise<PatientSummaryData> => {
      if (!cleanRef) {
        throw new Error("Referência de paciente não informada.");
      }

      const cachedSummary = cacheKey ? await getLocalCacheItem<PatientSummaryData>(cacheKey) : null;

      const buildFallbackFromDetail = async (): Promise<PatientSummaryData | null> => {
        if (cachedSummary) return hydratePatientSummaryData(cachedSummary);
        const detail = await getLocalCacheItem<PatientRow>(PATIENT_DETAIL_CACHE_KEY(clinicId, cleanRef));
        if (!detail) return null;
        return {
          patient: detail,
          clinicalSnapshots: [],
          profiles: [],
          profileNameById: attachProfileNameGetter({}),
        };
      };

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        const offlineFallback = await buildFallbackFromDetail();
        if (offlineFallback) return offlineFallback;
        throw new Error("Resumo do paciente indisponível offline no cache local.");
      }

      try {
        // 1. Busca paciente por código ou UUID
        const patientRes = await fetchPatientByRef(cleanRef, clinicId, clinicKey);
        if (patientRes.error || !patientRes.data) {
          if (isOfflineOrNetworkError(patientRes.error)) {
            const fallback = await buildFallbackFromDetail();
            if (fallback) return fallback;
          }
          throw new Error(patientRes.error?.message || "Paciente não encontrado.");
        }

        const patient = patientRes.data;
        const realPatientId = patient.id;

        // 2. Busca histórico de snapshots clínicos com limite de 25
        const { data: snapshotsData, error: snapshotsError } = await supabase
          .from("patient_clinical_snapshots")
          .select("*")
          .eq("patient_id", realPatientId)
          .order("created_at", { ascending: false })
          .limit(25);

        if (snapshotsError) {
          console.warn("[usePatientSummary] Aviso ao buscar snapshots:", snapshotsError);
        }

        const clinicalSnapshots = (snapshotsData ?? []) as PatientClinicalSnapshotRow[];

        // 3. OTIMIZAÇÃO CRÍTICA: Coleta IDs únicos de autores dos snapshots
        const authorIds = Array.from(
          new Set(
            clinicalSnapshots
              .map((s) => s.created_by)
              .filter((id): id is string => Boolean(id && id.trim()))
          )
        );

        // 4. Busca APENAS os perfis dos autores envolvidos (se houver)
        let profiles: ProfileSummary[] = [];
        if (authorIds.length > 0) {
          const { data: profilesData, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name, email")
            .in("id", authorIds);

          if (!profilesError && profilesData) {
            profiles = profilesData as ProfileSummary[];
          }
        }

        // 5. Monta dicionário id -> nome estático (Record<string, string>)
        const plainProfileNames: Record<string, string> = {};
        profiles.forEach((profile) => {
          const label = profile.full_name?.trim() || profile.email?.trim() || "Colaborador";
          plainProfileNames[profile.id] = label;
        });

        const serializableSummary: PatientSummaryData = {
          patient,
          clinicalSnapshots,
          profiles,
          profileNameById: plainProfileNames,
        };

        if (cacheKey) {
          void setLocalCacheItem(cacheKey, serializableSummary);
        }
        if (clinicId) {
          void setLocalCacheItem(PATIENT_DETAIL_CACHE_KEY(clinicId, cleanRef), patient);
          if (patient.id && patient.id !== cleanRef) {
            void setLocalCacheItem(PATIENT_DETAIL_CACHE_KEY(clinicId, patient.id), patient);
          }
        }

        return hydratePatientSummaryData(serializableSummary);
      } catch (err) {
        if (isOfflineOrNetworkError(err)) {
          const fallback = await buildFallbackFromDetail();
          if (fallback) return fallback;
        }
        throw err;
      }
    },
    placeholderData: () => {
      if (!cacheKey) return undefined;
      const memoryCached = getSyncMemoryCacheItem<PatientSummaryData>(cacheKey);
      return memoryCached ? hydratePatientSummaryData(memoryCached) : undefined;
    },
    enabled: Boolean(cleanRef),
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}
