import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
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

/**
 * Hook com React Query para carregar resumo clínico do paciente de forma reativa e otimizada.
 * - Evita download em lote de todos os profiles da clínica.
 * - Busca apenas autores referenciados em snapshots clínicos (.limit(25)).
 * - Query Key alinhada aos padrões Pluri-Health: ["patient", resolvedClinicId, cleanRef, "summary"]
 * - Record estático para nomes de colaboradores (evita instanciar Maps em cada query/render).
 */
export function usePatientSummary({
  patientRef,
  clinicId,
  clinicKey,
}: UsePatientSummaryParams) {
  const cleanRef = patientRef?.trim() || "";
  const resolvedClinicId = clinicKey || clinicId || "global";

  return useQuery<PatientSummaryData>({
    queryKey: ["patient", resolvedClinicId, cleanRef, "summary"],
    queryFn: async (): Promise<PatientSummaryData> => {
      if (!cleanRef) {
        throw new Error("Referência de paciente não informada.");
      }

      // 1. Busca paciente por código ou UUID
      const patientRes = await fetchPatientByRef(cleanRef, clinicId, clinicKey);
      if (patientRes.error || !patientRes.data) {
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
      const profileNameById: Record<string, string> & { get?: (id: string) => string | undefined } = {};
      profiles.forEach((profile) => {
        const label = profile.full_name?.trim() || profile.email?.trim() || "Colaborador";
        profileNameById[profile.id] = label;
      });

      // Compatibilidade retroativa transparente caso consumidores usem .get()
      Object.defineProperty(profileNameById, "get", {
        value: (id: string) => profileNameById[id],
        enumerable: false,
        configurable: true,
      });

      return {
        patient,
        clinicalSnapshots,
        profiles,
        profileNameById,
      };
    },
    enabled: Boolean(cleanRef),
    staleTime: 1000 * 60 * 2, // 2 minutos
  });
}
