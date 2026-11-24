import type { FC } from "react";
import { Lock } from "lucide-react";
import { PatientFilesPanel } from "@/components/PatientFilesPanel";
import { useFeatureFlags } from "@/contexts/FeatureFlagsContext";
import { usePatientWorkspace } from "../context/PatientWorkspaceContext";

export const PatientFilesPage: FC = () => {
  const ws = usePatientWorkspace();
  const { isFeatureEnabled } = useFeatureFlags();

  if (!ws.patient) return null;

  if (!isFeatureEnabled("storage_s3_integration")) {
    return (
      <div className="w-full max-w-full min-w-0 rounded-2xl border border-dashed p-8 text-center">
        <Lock className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">Módulo de arquivos indisponível</p>
        <p className="mt-1 text-xs text-muted-foreground">O armazenamento de arquivos não está habilitado para esta clínica.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-full min-w-0">
      <PatientFilesPanel
        clinicId={ws.clinicId ?? null}
        patientId={ws.patient.id}
        sessionId={null}
        title="Arquivos do paciente"
        variant="patient"
      />
    </div>
  );
};

export default PatientFilesPage;
