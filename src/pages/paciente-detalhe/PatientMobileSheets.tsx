import type { FC } from "react";
import { MobileStatusSheet } from "./MobileStatusSheet";
import { MobileShareSheet } from "./MobileShareSheet";
import { MobileTermsSheet } from "./MobileTermsSheet";
import type { Patient } from "@/types";
import type { CustomDocumentTemplate } from "@/types/documents";

interface PatientMobileSheetsProps {
  patient: Patient | null;
  mobileStatusSheetOpen: boolean;
  setMobileStatusSheetOpen: (open: boolean) => void;
  handlePatientStatusChange: (status: "ativo" | "inativo" | "arquivado") => void;
  mobileShareSheetOpen: boolean;
  setMobileShareSheetOpen: (open: boolean) => void;
  canExport: boolean;
  handleOpenShareDialog: () => void;
  navigate: (path: string) => void;
  getPatientPath: (patient: Patient, subpath?: string) => string;
  handleExportPatientJson: () => void;
  mobileTermsSheetOpen: boolean;
  setMobileTermsSheetOpen: (open: boolean) => void;
  canPrint: boolean;
  setShowGenerateDocumentModal: (open: boolean) => void;
  setInitialGenerateTemplateId: (id?: string) => void;
  setShowPrintAdultConsentModal: (open: boolean) => void;
  setShowPrintGuardianConsentModal: (open: boolean) => void;
  setShowPrintRegistrationModal: (open: boolean) => void;
  customTemplates: CustomDocumentTemplate[];
}

export const PatientMobileSheets: FC<PatientMobileSheetsProps> = ({
  patient,
  mobileStatusSheetOpen,
  setMobileStatusSheetOpen,
  handlePatientStatusChange,
  mobileShareSheetOpen,
  setMobileShareSheetOpen,
  canExport,
  handleOpenShareDialog,
  navigate,
  getPatientPath,
  handleExportPatientJson,
  mobileTermsSheetOpen,
  setMobileTermsSheetOpen,
  canPrint,
  setShowGenerateDocumentModal,
  setInitialGenerateTemplateId,
  setShowPrintAdultConsentModal,
  setShowPrintGuardianConsentModal,
  setShowPrintRegistrationModal,
  customTemplates,
}) => {
  if (!patient) return null;

  return (
    <>
      {/* Bottom Sheet Mobile: Gerenciar Status do Paciente */}
      <MobileStatusSheet
        open={mobileStatusSheetOpen}
        onOpenChange={setMobileStatusSheetOpen}
        patient={patient}
        onStatusChange={handlePatientStatusChange}
      />

      {/* Bottom Sheet Mobile: Compartilhar & Opções */}
      <MobileShareSheet
        open={mobileShareSheetOpen}
        onOpenChange={setMobileShareSheetOpen}
        patientName={patient.name}
        canExport={canExport}
        onShareRegistration={() => handleOpenShareDialog()}
        onViewFullRegistration={() => navigate(getPatientPath(patient, "resumo"))}
        onExportJson={() => handleExportPatientJson()}
      />

      {/* Bottom Sheet Mobile: Termos & Documentos */}
      <MobileTermsSheet
        open={mobileTermsSheetOpen}
        onOpenChange={setMobileTermsSheetOpen}
        patient={patient}
        canPrint={canPrint}
        onGenerateDocument={() => {
          setInitialGenerateTemplateId(undefined);
          setShowGenerateDocumentModal(true);
        }}
        onPrintAdultConsent={() => setShowPrintAdultConsentModal(true)}
        onPrintGuardianConsent={() => setShowPrintGuardianConsentModal(true)}
        onPrintRegistration={() => setShowPrintRegistrationModal(true)}
        customTemplates={customTemplates}
        onSelectCustomTemplate={(templateId) => {
          setInitialGenerateTemplateId(templateId);
          setShowGenerateDocumentModal(true);
        }}
      />
    </>
  );
};
