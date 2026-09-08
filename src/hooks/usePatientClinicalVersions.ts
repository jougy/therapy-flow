import { useMemo } from "react";
import type { Database } from "@/integrations/supabase/types";
import {
  buildPatientClinicalSnapshotState,
  type PatientClinicalSnapshotState,
} from "@/lib/patient-clinical-snapshots";
import { parseSnapshotState } from "@/lib/patient-formatting";
import type { ClinicalHistoryVersion } from "@/components/patients/ClinicalHistoryNavigator";

type Patient = Database["public"]["Tables"]["patients"]["Row"];
type PatientClinicalSnapshot = Database["public"]["Tables"]["patient_clinical_snapshots"]["Row"];

export interface UsePatientClinicalVersionsParams {
  patient: Patient | null;
  clinicalSnapshots: PatientClinicalSnapshot[];
  profileNameById: Record<string, string> & { get?: (id: string) => string | undefined };
}

/**
 * Hook para gerar e memoizar as versões do histórico clínico temporal do paciente.
 */
export function usePatientClinicalVersions({
  patient,
  clinicalSnapshots,
  profileNameById,
}: UsePatientClinicalVersionsParams) {
  const currentClinicalState = useMemo<PatientClinicalSnapshotState | null>(
    () => (patient ? buildPatientClinicalSnapshotState(patient) : null),
    [patient]
  );

  const clinicalHistoryVersions = useMemo<ClinicalHistoryVersion[]>(() => {
    if (!patient || !currentClinicalState) return [];

    return [
      {
        date: patient.updated_at,
        id: "current",
        isCurrent: true,
        state: currentClinicalState,
        changedFields: [],
      },
      ...clinicalSnapshots.map((snapshot) => ({
        authorLabel: snapshot.created_by
          ? (typeof profileNameById.get === "function"
              ? profileNameById.get(snapshot.created_by)
              : profileNameById[snapshot.created_by]) ?? "Colaborador"
          : "Atualização sem autor identificado",
        date: snapshot.created_at,
        id: snapshot.id,
        note: snapshot.change_note,
        changedFields: snapshot.changed_fields || [],
        state: parseSnapshotState(snapshot.snapshot_data),
      })),
    ];
  }, [clinicalSnapshots, currentClinicalState, patient, profileNameById]);

  return { currentClinicalState, clinicalHistoryVersions };
}
