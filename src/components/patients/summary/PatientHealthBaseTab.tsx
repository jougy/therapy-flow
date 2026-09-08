import React from "react";
import { AlertCircle, AlertTriangle, ShieldCheck } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import {
  type PatientClinicalProfile,
  getPatientRiskFlagLabel,
} from "@/lib/patient-clinical-profile";
import { SummaryBlock } from "@/components/patients/SummaryBlock";

type Patient = Database["public"]["Tables"]["patients"]["Row"];

export interface PatientHealthBaseTabProps {
  patient: Patient;
  clinicalProfile: PatientClinicalProfile;
}

export const PatientHealthBaseTab: React.FC<PatientHealthBaseTabProps> = ({
  patient,
  clinicalProfile,
}) => {
  const riskFlags = clinicalProfile.risk_flags || [];

  return (
    <div className="space-y-5">
      {/* Card de Flags de Risco Clínico com Destaque Visual */}
      {riskFlags.length > 0 ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-destructive font-semibold text-sm">
            <AlertTriangle className="h-4 w-4" />
            <span>
              Marcadores de Risco Clínico Ativos ({riskFlags.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {riskFlags.map((flag) => (
              <span
                key={flag}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-destructive/15 text-destructive border border-destructive/30 shadow-xs"
              >
                <AlertCircle className="h-3 w-3" />
                {getPatientRiskFlagLabel(flag)}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-500" />
          <span>Nenhum marcador de risco clínico crítico assinalado para este paciente.</span>
        </div>
      )}

      <SummaryBlock
        title="Perfil de Saúde Base"
        description="Informações basilares e condições preexistentes do paciente."
        values={[
          { label: "Tipo sanguíneo", value: patient.blood_type, fallback: "Não informado" },
          { label: "Problemas crônicos", value: patient.chronic_conditions, fallback: "Nenhum informado" },
          { label: "Alergias", value: patient.allergies, fallback: "Nenhuma informada" },
          { label: "Alertas clínicos", value: clinicalProfile.clinical_alerts, fallback: "Nenhum alerta" },
          {
            label: "Condições congênitas ou genéticas",
            value: clinicalProfile.congenital_genetic_conditions,
            fallback: "Nenhuma informada",
          },
          {
            label: "Histórico familiar",
            value: clinicalProfile.family_history,
            fallback: "Nenhum informado",
          },
        ]}
      />
    </div>
  );
};
