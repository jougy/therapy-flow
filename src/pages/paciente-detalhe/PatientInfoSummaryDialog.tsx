import React from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { FileText, ClipboardEdit, Share2 } from "lucide-react";
import { SummaryField } from "./pacienteDetalheHelpers";
import { getPatientOriginLabel } from "@/lib/patient-origin";
import { getFunctionalIndependenceLabel } from "@/lib/patient-clinical-profile";
import type { Patient } from "./pacienteDetalheTypes";

export interface PatientInfoSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: Patient;
  patientRegistrationStatus: string;
  canViewPatientContact: boolean;
  patientOriginDetails?: string;
  parsedClinicalProfile: {
    clinical_alerts?: string;
    diagnoses?: string;
    functional_independence?: string;
  };
  parsedEmergencyContact: {
    name?: string;
  };
  onViewFullRegistration: () => void;
  onEditRegistration: () => void;
  onOpenShareDialog: () => void;
}

export const PatientInfoSummaryDialog: React.FC<PatientInfoSummaryDialogProps> = ({
  open,
  onOpenChange,
  patient,
  patientRegistrationStatus,
  canViewPatientContact,
  patientOriginDetails,
  parsedClinicalProfile,
  parsedEmergencyContact,
  onViewFullRegistration,
  onEditRegistration,
  onOpenShareDialog,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100vh-1rem)] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-0 supports-[height:100dvh]:max-h-[calc(100dvh-1rem)] sm:max-w-3xl">
        <DialogHeader className="px-4 pt-5 sm:px-6">
          <DialogTitle>Resumo do paciente</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 overflow-y-auto px-4 py-2 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <SummaryField label="Nome" value={patient.name} />
            <SummaryField label="Status" value={patient.status} />
            <SummaryField label="Cadastro" value={patientRegistrationStatus} />
            <SummaryField
              label="Data de cadastro"
              value={patient.created_at ? new Date(patient.created_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : undefined}
            />
            {canViewPatientContact ? <SummaryField label="Telefone" value={patient.phone} /> : null}
            <SummaryField label="E-mail" value={patient.email} />
            <SummaryField label="CPF" value={patient.cpf} />
            <SummaryField label="Origem" value={[getPatientOriginLabel(patient.origin_type), patientOriginDetails].filter(Boolean).join("\n")} />
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
                <SummaryField label="Contato de emergência" value={parsedEmergencyContact.name} />
              </div>
            </section>
          </div>
        </div>
        <DialogFooter className="gap-2 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 sm:justify-between sm:px-6">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onViewFullRegistration();
              }}
            >
              <FileText className="h-4 w-4 mr-2" />
              Ver cadastro completo
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                onEditRegistration();
              }}
            >
              <ClipboardEdit className="h-4 w-4 mr-2" />
              Editar cadastro
            </Button>
          </div>
          <Button
            onClick={() => {
              onOpenChange(false);
              onOpenShareDialog();
            }}
          >
            <Share2 className="h-4 w-4 mr-2" />
            Compartilhar com o paciente
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
