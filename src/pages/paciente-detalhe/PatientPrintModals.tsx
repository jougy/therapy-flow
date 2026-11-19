import type { FC } from "react";
import { PrintResponsibilityModal } from "@/components/PrintResponsibilityModal";
import { PatientRegistrationPrintView } from "@/components/patients/PatientRegistrationPrintView";
import { PrintAdultConsentModal } from "@/components/patients/PrintAdultConsentModal";
import { PrintGuardianConsentModal } from "@/components/patients/PrintGuardianConsentModal";
import { GenerateDocumentModal } from "@/components/patients/GenerateDocumentModal";
import type { Patient, Clinic, Profile } from "@/types";
import type { User } from "@supabase/supabase-js";
import type { EmergencyContact, ClinicalProfile } from "@/pages/paciente-detalhe/pacienteDetalheTypes";

interface PatientPrintModalsProps {
  patient: Patient | null;
  clinic: Clinic | null;
  profile: Profile | null;
  user: User | null;
  clinicId?: string;
  realPatientId?: string;
  parsedClinicalProfile: ClinicalProfile;
  parsedEmergencyContact: EmergencyContact;
  showPrintRegistrationModal: boolean;
  setShowPrintRegistrationModal: (open: boolean) => void;
  isPrintingRegistration: boolean;
  handleExecutePrintRegistration: () => void;
  showPrintAdultConsentModal: boolean;
  setShowPrintAdultConsentModal: (open: boolean) => void;
  showPrintGuardianConsentModal: boolean;
  setShowPrintGuardianConsentModal: (open: boolean) => void;
  showGenerateDocumentModal: boolean;
  setShowGenerateDocumentModal: (open: boolean) => void;
  initialGenerateTemplateId?: string;
  setInitialGenerateTemplateId: (id?: string) => void;
  invalidatePatientData: (patientId: string, clinicId?: string, keys?: string[]) => Promise<void>;
}

export const PatientPrintModals: FC<PatientPrintModalsProps> = ({
  patient,
  clinic,
  profile,
  user,
  clinicId,
  realPatientId,
  parsedClinicalProfile,
  parsedEmergencyContact,
  showPrintRegistrationModal,
  setShowPrintRegistrationModal,
  isPrintingRegistration,
  handleExecutePrintRegistration,
  showPrintAdultConsentModal,
  setShowPrintAdultConsentModal,
  showPrintGuardianConsentModal,
  setShowPrintGuardianConsentModal,
  showGenerateDocumentModal,
  setShowGenerateDocumentModal,
  initialGenerateTemplateId,
  setInitialGenerateTemplateId,
  invalidatePatientData,
}) => {
  if (!patient) return null;

  return (
    <>
      {/* Dossiê de Impressão do Cadastro (Renderizado sob demanda para proteção LGPD) */}
      {(showPrintRegistrationModal || isPrintingRegistration) && (
        <PatientRegistrationPrintView
          patient={patient}
          clinic={clinic}
          profile={profile}
          user={user}
          clinicalProfile={parsedClinicalProfile}
          emergencyContact={parsedEmergencyContact}
        />
      )}

      {/* Modal de Confirmação & Termo LGPD de Impressão do Cadastro */}
      <PrintResponsibilityModal
        isOpen={showPrintRegistrationModal}
        onConfirm={handleExecutePrintRegistration}
        onCancel={() => setShowPrintRegistrationModal(false)}
        documentTitle={`cadastro completo do paciente ${patient.name}`}
      />

      {/* Modal de Impressão do Termo de Consentimento Adulto (TCLE) */}
      <PrintAdultConsentModal
        open={showPrintAdultConsentModal}
        onOpenChange={setShowPrintAdultConsentModal}
        patient={patient}
        clinicId={clinicId}
        clinicName={clinic?.name}
      />

      {/* Modal de Impressão da Permissão dos Pais (Menor de Idade) */}
      <PrintGuardianConsentModal
        open={showPrintGuardianConsentModal}
        onOpenChange={setShowPrintGuardianConsentModal}
        patient={patient}
        clinicId={clinicId}
        clinicName={clinic?.name}
        onPrinted={() => {
          if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["patient"]);
        }}
      />

      {/* Modal Reutilizável de Geração de Documentos com Variáveis Automáticas */}
      <GenerateDocumentModal
        open={showGenerateDocumentModal}
        onOpenChange={(open) => {
          setShowGenerateDocumentModal(open);
          if (!open) setInitialGenerateTemplateId(undefined);
        }}
        patient={patient}
        clinicId={clinicId}
        clinicName={clinic?.name}
        initialTemplateId={initialGenerateTemplateId}
        onPrinted={() => {
          if (realPatientId) void invalidatePatientData(realPatientId, clinicId, ["patient"]);
        }}
      />
    </>
  );
};
