import type { FC } from "react";
import { PatientPaymentsTab } from "../payments/PatientPaymentsTab";
import { usePatientWorkspace } from "../context/PatientWorkspaceContext";

export const PatientPaymentsPage: FC = () => {
  const ws = usePatientWorkspace();
  if (!ws.patient) return null;

  return (
    <div className="w-full max-w-full min-w-0">
      <PatientPaymentsTab
        patientId={ws.patient.id}
        clinicId={ws.effectiveClinicId ?? ""}
        sessions={ws.sessions}
      />
    </div>
  );
};

export default PatientPaymentsPage;
