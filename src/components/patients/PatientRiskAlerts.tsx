import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { getPatientAlertItems } from "@/lib/patient-clinical-profile";
import { PatientHeaderAlert } from "./PatientHeaderAlert";
import type { Database } from "@/integrations/supabase/types";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

export interface PatientRiskAlertsProps {
  patient?: Pick<PatientRow, "allergies" | "clinical_profile"> | null;
  size?: "sm" | "md";
  className?: string;
}

export const PatientRiskAlerts = ({
  patient,
  size = "md",
  className = "flex flex-wrap items-center gap-2",
}: PatientRiskAlertsProps) => {
  const { allergyAlerts, fallRiskAlerts, structuredRiskAlerts } = useMemo(
    () => getPatientAlertItems(patient),
    [patient]
  );

  const hasAnyAlerts =
    allergyAlerts.length > 0 ||
    fallRiskAlerts.length > 0 ||
    structuredRiskAlerts.length > 0;

  if (!hasAnyAlerts) {
    return null;
  }

  return (
    <div className={className}>
      <PatientHeaderAlert
        icon={<AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400 shrink-0" />}
        items={allergyAlerts}
        title="Alergias"
        tone="rose"
        size={size}
      />
      <PatientHeaderAlert
        icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
        items={fallRiskAlerts}
        title="Risco de queda"
        tone="amber"
        size={size}
      />
      <PatientHeaderAlert
        icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />}
        items={structuredRiskAlerts}
        title="Riscos"
        tone="amber"
        size={size}
      />
    </div>
  );
};
