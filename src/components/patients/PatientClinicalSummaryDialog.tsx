import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Pencil, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  getFunctionalIndependenceLabel,
  parseClinicalProfile,
  parseEmergencyContact,
} from "@/lib/patient-clinical-profile";
import { getPatientOriginLabel, formatPatientOriginDetails } from "@/lib/patient-origin";
import { getPatientRouteKey } from "@/lib/patient-routing";
import type { Database } from "@/integrations/supabase/types";

type PatientRow = Database["public"]["Tables"]["patients"]["Row"];

export interface PatientClinicalSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient?: PatientRow | null;
  canViewContact?: boolean;
}

const SummaryField = ({ label, value }: { label: string; value?: string | null }) => (
  <div className="min-w-0 rounded-lg bg-muted/25 px-3 py-2">
    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    <p className="mt-1 whitespace-pre-line break-words text-sm font-medium text-foreground">{value?.trim() || "—"}</p>
  </div>
);

export const PatientClinicalSummaryDialog = ({
  open,
  onOpenChange,
  patient,
  canViewContact = true,
}: PatientClinicalSummaryDialogProps) => {
  const navigate = useNavigate();

  const parsedClinicalProfile = useMemo(
    () => parseClinicalProfile(patient?.clinical_profile),
    [patient?.clinical_profile]
  );

  const parsedEmergencyContact = useMemo(
    () => parseEmergencyContact(patient?.emergency_contact),
    [patient?.emergency_contact]
  );

  const patientOriginDetails = useMemo(
    () => (patient ? formatPatientOriginDetails(patient) : null),
    [patient]
  );

  if (!patient) {
    return null;
  }

  const patientRegistrationStatus = patient.registration_complete ? "Cadastro concluído" : "Cadastro pendente";
  const patientRouteKey = getPatientRouteKey(patient);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-0 supports-[height:100dvh]:max-h-[calc(100dvh-1rem)] sm:max-w-3xl">
        <DialogHeader className="px-4 pt-5 sm:px-6">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span>Resumo do paciente</span>
          </DialogTitle>
          <DialogDescription>
            Visualização rápida das informações clínicas e cadastrais essenciais.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 overflow-y-auto px-4 py-2 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryField label="Nome" value={patient.name} />
            <SummaryField label="Status" value={patient.status} />
            <SummaryField label="Cadastro" value={patientRegistrationStatus} />
            <SummaryField
              label="Data de cadastro"
              value={
                patient.created_at
                  ? new Date(patient.created_at).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : undefined
              }
            />
            {canViewContact ? <SummaryField label="Telefone" value={patient.phone} /> : null}
            <SummaryField label="E-mail" value={patient.email} />
            <SummaryField label="CPF" value={patient.cpf} />
            <SummaryField
              label="Origem"
              value={[getPatientOriginLabel(patient.origin_type), patientOriginDetails]
                .filter(Boolean)
                .join("\n")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="space-y-3 rounded-lg border bg-muted/10 p-4">
              <div>
                <p className="text-sm font-semibold">Saúde base</p>
                <p className="text-xs text-muted-foreground">Pontos de atenção para consulta rápida.</p>
              </div>
              <div className="grid gap-2">
                <SummaryField label="Tipo sanguíneo" value={patient.blood_type} />
                <SummaryField label="Alergias" value={patient.allergies} />
                <SummaryField label="Problemas crônicos" value={patient.chronic_conditions} />
                <SummaryField label="Alertas clínicos" value={parsedClinicalProfile.clinical_alerts} />
              </div>
            </section>

            <section className="space-y-3 rounded-lg border bg-muted/10 p-4">
              <div>
                <p className="text-sm font-semibold">Histórico rápido</p>
                <p className="text-xs text-muted-foreground">Fotografia clínica e funcional atual.</p>
              </div>
              <div className="grid gap-2">
                <SummaryField label="Diagnósticos prévios" value={parsedClinicalProfile.diagnoses} />
                <SummaryField label="Medicamentos contínuos" value={patient.continuous_medications} />
                <SummaryField
                  label="Contexto funcional"
                  value={getFunctionalIndependenceLabel(parsedClinicalProfile.functional_independence)}
                />
                <SummaryField
                  label="Contato de emergência"
                  value={
                    parsedEmergencyContact.name
                      ? `${parsedEmergencyContact.name}${parsedEmergencyContact.relationship ? ` (${parsedEmergencyContact.relationship})` : ""}${parsedEmergencyContact.phone ? ` - ${parsedEmergencyContact.phone}` : ""}`
                      : null
                  }
                />
              </div>
            </section>
          </div>
        </div>

        <DialogFooter className="gap-2 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:justify-between sm:px-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => {
                onOpenChange(false);
                navigate(`/pacientes/${patientRouteKey}/cadastro`);
              }}
            >
              <FileText className="h-4 w-4" />
              <span>Ver cadastro completo</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => {
                onOpenChange(false);
                navigate(`/pacientes/${patientRouteKey}/cadastro`);
              }}
            >
              <Pencil className="h-4 w-4" />
              <span>Editar cadastro</span>
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
